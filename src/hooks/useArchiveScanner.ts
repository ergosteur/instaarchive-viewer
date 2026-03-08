import { useState, useCallback, useRef } from 'react';
// @ts-ignore
import { XzReadableStream } from 'xz-decompress';
import * as idb from 'idb-keyval';
import { ArchiveFile, Post, ServerArchive } from '../types';

export const useArchiveScanner = (
  detectedUsername: string,
  currentArchive: ServerArchive | null,
  refreshCachedArchives: () => Promise<void>
) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanningPhase, setScanningPhase] = useState<'Indexing' | 'Parsing' | 'Checking Cache' | ''>('');
  const [scannedCount, setScannedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [scannedFilesLog, setScannedFilesLog] = useState<string[]>([]);
  const [currentScanningImage, setCurrentScanningImage] = useState<string | null>(null);

  // Result state
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allStories, setAllStories] = useState<Post[]>([]);
  const [profileMetadata, setProfileMetadata] = useState<{
    username: string;
    fullName: string;
    bio: string;
    followerCount: number;
    followingCount: number;
    externalUrl: string;
    profilePic: string | null;
    allProfilePics: string[];
  }>({
    username: '',
    fullName: '',
    bio: '',
    followerCount: 0,
    followingCount: 0,
    externalUrl: '',
    profilePic: null,
    allProfilePics: [],
  });

  const resetScannerState = useCallback(() => {
    setAllPosts([]);
    setAllStories([]);
    setProfileMetadata({
      username: '',
      fullName: '',
      bio: '',
      followerCount: 0,
      followingCount: 0,
      externalUrl: '',
      profilePic: null,
      allProfilePics: [],
    });
  }, []);

  const handleFiles = useCallback(async (files: ArchiveFile[], archiveContext?: ServerArchive) => {
    if (!files || files.length === 0) return;
    setIsScanning(true);
    resetScannerState();
    setScanningPhase('Indexing');
    setScannedCount(0);
    setTotalFiles(files.length);
    setScannedFilesLog([]);
    
    console.log(`[Scanner] Starting scan of ${files.length} files...`);
    await new Promise(resolve => setTimeout(resolve, 100));

    const parseXZFile = async (file: ArchiveFile) => {
      try {
        const stream = new XzReadableStream(file.stream());
        const response = new Response(stream);
        return await response.json();
      } catch (e) { console.error(`[Scanner] XZ Parse Error:`, file.name, e); return null; }
    };

    let lastImageUpdateTime = 0;
    const throttledSetScanningImage = (url: string) => {
      const now = Date.now();
      if (now - lastImageUpdateTime > 1000) {
        setCurrentScanningImage(url);
        lastImageUpdateTime = now;
      }
    };

    const isImage = (name: string) => /\.(jpg|jpeg|png|webp|gif|bmp|svg|tiff)$/i.test(name);
    const isVideo = (name: string) => /\.(mp4|webm|ogv|mov)$/i.test(name);
    const isMedia = (name: string) => isImage(name) || isVideo(name);

    try {
      const postsMap = new Map<string, Partial<Post>>();
      const mediaFilesMap = new Map<string, ArchiveFile>();
      const discoveredProfilePics: { name: string, url: string }[] = [];
      const allImageFiles: ArchiveFile[] = [];
      
      let localFullName = '';
      let localBio = '';
      let localExternalUrl = '';
      let localFollowerCount = 0;
      let localFollowingCount = 0;
      let localProfilePic: string | null = null;

      const exportRegex = /^(\d{4}-\d{2}-\d{2})_(.+?) - (.+?)(?: - (\d+))?(?: - (story))?\.(.+)$/;
      const instaloaderRegex = /^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_UTC)(?:_(\d+))?(?:_(story))?\.(.+)$/;
      const checkIsStory = (obj: any): boolean => {
        if (!obj) return false;
        const typeName = obj.__typename || obj.typename || '';
        return (obj.is_story === true || obj.is_reel_media === true || typeName.includes('Story') || obj.audience === "MediaAudience.DEFAULT" || obj.node_type === "StoryItem" || obj.product_type === "story" || typeName === "GraphStoryVideo" || typeName === "GraphStoryImage");
      };

      let currentUsername = archiveContext?.name || currentArchive?.name || detectedUsername;
      
      // If still no username (likely local folder), try to extract from path
      if (!currentUsername && files[0]?.webkitRelativePath) {
        const pathParts = files[0].webkitRelativePath.split(/[/\\]/);
        if (pathParts.length > 1) {
          currentUsername = pathParts[0];
        }
      }
      
      if (!currentUsername) currentUsername = 'archived_user';

      let format: 'export' | 'instaloader' | 'json' | 'unknown' = 'unknown';
      let jsonFiles: ArchiveFile[] = [];

      // Pass 1: Indexing
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (i % 100 === 0 || i === files.length - 1) {
          setScannedCount(i + 1);
          setScannedFilesLog(prev => [`Indexed ${file.name}`, ...prev.slice(0, 19)]);
          // Yield to main thread
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        const lowerName = file.name.toLowerCase();
        
        if (lowerName.endsWith('.json') || lowerName.endsWith('.json.xz')) {
          jsonFiles.push(file);
          if (lowerName.includes('posts_1') || lowerName.includes('reels_1') || lowerName.includes('stories_1')) format = 'json';
          continue;
        }

        if (file.name.match(exportRegex)) format = 'export';
        else if (file.name.match(instaloaderRegex)) format = 'instaloader';

        if (lowerName.includes('_profile_pic.jpg') || (currentUsername && lowerName === `${currentUsername.toLowerCase()}.jpg`)) {
          try {
            const url = file.url || (await (async () => {
              const blob = new Blob([await file.arrayBuffer()], { type: 'image/jpeg' });
              return URL.createObjectURL(blob);
            })());
            discoveredProfilePics.push({ name: file.name, url });
            if (format === 'unknown' && lowerName.includes('_profile_pic.jpg')) format = 'instaloader';
          } catch(e) {}
        }

        if (isMedia(file.name)) {
          mediaFilesMap.set(file.webkitRelativePath || file.name, file);
          if (isImage(file.name)) allImageFiles.push(file);
        }
      }

      console.log(`[Scanner] Format Detection Complete. Result: ${format}. Media indexed: ${mediaFilesMap.size}`);

      if (jsonFiles.length > 0 && (format === 'json' || format === 'instaloader')) {
        setScanningPhase('Parsing');
        for (let i = 0; i < jsonFiles.length; i++) {
          const jsonFile = jsonFiles[i];
          setScannedCount(i + 1);
          setScannedFilesLog(prev => [`Parsing ${jsonFile.name}`, ...prev.slice(0, 19)]);
          try {
            const data = jsonFile.name.endsWith('.xz') ? await parseXZFile(jsonFile) : JSON.parse(await jsonFile.text());
            if (!data) continue;
            const items = Array.isArray(data) ? data : (data.media || [data]);
            const isStoriesFile = jsonFile.name.toLowerCase().includes('stories');

            if (data.node && (data.instaloader?.node_type === 'Profile' || data.node.__typename === 'User')) {
              const node = data.node; const iphone = node.iphone_struct || {};
              localFullName = node.full_name || ''; localBio = node.biography || iphone.biography || '';
              localExternalUrl = node.external_url || '';
              localFollowerCount = node.edge_followed_by?.count || iphone.follower_count || 0;
              localFollowingCount = node.edge_follow?.count || iphone.following_count || 0;
              if (!Array.isArray(data)) continue;
            }

            for (const [idx, item] of items.entries()) {
              const mediaList = item.media || [item];
              const postId = item.node?.id || item.id || item.title || `post_${idx}_${Date.now()}`;
              const date = item.creation_timestamp ? new Date(item.creation_timestamp * 1000).toISOString().split('T')[0] : (item.node?.taken_at_timestamp ? new Date(item.node.taken_at_timestamp * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
              const isStory = isStoriesFile || checkIsStory(item) || checkIsStory(item.node) || checkIsStory(data.instaloader) || checkIsStory(item.node?.iphone_struct) || checkIsStory(item.iphone_struct) || (item.media && Array.isArray(item.media) && item.media.some((m: any) => checkIsStory(m)));
              const post: Partial<Post> = { id: postId, date, username: currentUsername || 'archived_user', caption: item.title || item.node?.edge_media_to_caption?.edges?.[0]?.node?.text || item.node?.caption?.text || '', media: [], isStory };

              for (const [mIdx, m] of mediaList.entries()) {
                const uri = m.uri; let matchedFile: ArchiveFile | undefined;
                if (uri) { for (const [path, f] of mediaFilesMap.entries()) { if (path.endsWith(uri) || uri.endsWith(path)) { matchedFile = f; break; } } }
                if (!matchedFile) { const id = item.node?.id || item.id; if (id) { for (const [path, f] of mediaFilesMap.entries()) { if (f.name.includes(id)) { matchedFile = f; break; } } } }
                if (!matchedFile) { 
                  const jsonBase = jsonFile.name.substring(0, jsonFile.name.lastIndexOf('.'));
                  for (const ext of ['mp4', 'webm', 'jpg', 'jpeg', 'png', 'webp', 'gif']) {
                    const possibleName = `${jsonBase}.${ext}`;
                    for (const [path, f] of mediaFilesMap.entries()) { if (f.name.toLowerCase() === possibleName.toLowerCase()) { matchedFile = f; break; } }
                    if (matchedFile) break;
                  }
                }

                if (matchedFile) {
                  const type = isVideo(matchedFile.name) ? 'video' : 'image';
                  const url = matchedFile.url || URL.createObjectURL(new Blob([await matchedFile.arrayBuffer()], { type: type === 'video' ? 'video/mp4' : 'image/jpeg' }));
                  const existingMedia = post.media!.find(media => media.index === mIdx + 1);
                  if (existingMedia) { if (type === 'video' && existingMedia.type === 'image') post.media = post.media!.map(media => media.index === mIdx + 1 ? { name: matchedFile!.name, url, type, index: mIdx + 1, size: matchedFile!.size } : media); }
                  else post.media!.push({ name: matchedFile.name, url, type, index: mIdx + 1, size: matchedFile.size });
                }
              }
              if (post.media!.length > 0) postsMap.set(postId, post);
            }
          } catch (e) { console.error(`[Scanner] Error parsing JSON ${jsonFile.name}:`, e); }
          // Yield to main thread
          if (i % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
      } 
      
      if (format === 'export' || format === 'instaloader') {
        setScanningPhase('Parsing');
        const CHUNK_SIZE = 100;
        for (let j_start = 0; j_start < files.length; j_start += CHUNK_SIZE) {
          const end = Math.min(j_start + CHUNK_SIZE, files.length);
          setScannedCount(j_start);
          setScannedFilesLog(prev => [`Batch ${Math.floor(j_start/CHUNK_SIZE) + 1} processing...`, ...prev.slice(0, 19)]);
          for (let j = j_start; j < end; j++) {
            const file = files[j]; const lowerName = file.name.toLowerCase();
            const expMatch = file.name.match(exportRegex);
            const insMatch = file.name.match(instaloaderRegex);
            if (!expMatch && !insMatch) continue;

            let postId = '', date = '', user = currentUsername || 'archived_user', index = 1, ext = '', isStory = lowerName.includes('story') || file.webkitRelativePath.toLowerCase().includes('stories');
            if (expMatch) {
              const [_, dMatch, uMatch, pMatch, iStrMatch, sMatch, eMatch] = expMatch;
              date = dMatch; user = uMatch; postId = pMatch; index = iStrMatch ? parseInt(iStrMatch, 10) : 1; if (sMatch) isStory = true; ext = eMatch;
            } else if (insMatch) {
              const [_, pMatch, iStrMatch, sMatch, eMatch] = insMatch;
              postId = pMatch; date = pMatch.split('_')[0]; index = iStrMatch ? parseInt(iStrMatch, 10) : 1; if (sMatch) isStory = true; ext = eMatch;
            }

            let post = postsMap.get(postId);
            if (!post) { post = { id: postId, date, username: user, caption: '', media: [], isStory }; postsMap.set(postId, post); }
            else if (isStory) post.isStory = true;

            const lowerExt = ext.toLowerCase();
            if (lowerExt === 'txt') {
              try { post.caption = await file.text(); } catch(e) {}
            } else if (lowerExt === 'json' || lowerName.endsWith('.json.xz')) {
              try {
                const data = lowerName.endsWith('.xz') ? await parseXZFile(file) : JSON.parse(await file.text());
                if (data) {
                  const node = data.node || data; const iphone = node.iphone_struct || {};
                  const captionText = node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption?.text || iphone.caption?.text || '';
                  if (captionText) post.caption = captionText;
                  if (checkIsStory(data) || checkIsStory(node) || checkIsStory(data.instaloader) || checkIsStory(iphone)) post.isStory = true;
                }
              } catch (e) {}
            } else if (isMedia(file.name)) {
              const type = isVideo(file.name) ? 'video' : 'image';
              const url = file.url || URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: type === 'video' ? 'video/mp4' : 'image/jpeg' }));
              if (type === 'image') throttledSetScanningImage(url);
              const existingMedia = post.media!.find(m => m.index === index);
              if (existingMedia) { if (type === 'video' && existingMedia.type === 'image') post.media = post.media!.map(m => m.index === index ? { name: file.name, url, type, index, size: file.size } : m); }
              else post.media!.push({ name: file.name, url, type, index, size: file.size });
            }
          }
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      if (postsMap.size === 0) {
        console.log(`[Scanner] No posts found with standard patterns. Using mediaFilesMap: ${mediaFilesMap.size}`);
        setScanningPhase('Parsing');
        const genericGroupingMap = new Map<string, ArchiveFile[]>();
        for (const [key, file] of mediaFilesMap.entries()) {
          const match = file.name.match(/^(.*?)(?:(_|-|\s)+(\d+))?\.(.+)$/);
          let baseName = file.name;
          if (match && match[3]) { baseName = match[1].trim(); }
          else { baseName = file.name.substring(0, file.name.lastIndexOf('.')); }
          if (!genericGroupingMap.has(baseName)) genericGroupingMap.set(baseName, []);
          genericGroupingMap.get(baseName)!.push(file);
        }
        console.log(`[Scanner] Generic grouping found ${genericGroupingMap.size} base groups.`);
        let processedGroups = 0;
        const groupEntries = Array.from(genericGroupingMap.entries());
        for (const [baseName, groupFiles] of groupEntries) {
          processedGroups++;
          if (processedGroups % 10 === 0 || processedGroups === genericGroupingMap.size) {
            setScannedCount(Math.floor((processedGroups / (genericGroupingMap.size || 1)) * (files.length || 1)));
            setScannedFilesLog(prev => [`Grouping: ${baseName}`, ...prev.slice(0, 19)]);
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          groupFiles.sort((a, b) => {
            const na = a.name.match(/[_-](\d+)\.\w+$/)?.[1];
            const nb = b.name.match(/[_-](\d+)\.\w+$/)?.[1];
            if (na && nb) return parseInt(na, 10) - parseInt(nb, 10);
            return a.name.localeCompare(b.name);
          });
          const CAROUSEL_MAX = 20;
          for (let j = 0; j < groupFiles.length; j += CAROUSEL_MAX) {
            const batch = groupFiles.slice(j, j + CAROUSEL_MAX);
            const partSuffix = groupFiles.length > CAROUSEL_MAX ? `_part${Math.floor(j/CAROUSEL_MAX) + 1}` : '';
            const postId = `${baseName}${partSuffix}`;
            const post: Post = { id: postId, date: new Date().toISOString().split('T')[0], username: currentUsername || 'archived_user', caption: baseName, media: [], thumbnail: '' };
            for (const [idx, file] of batch.entries()) {
              const type = isVideo(file.name) ? 'video' : 'image';
              const url = file.url || URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: type === 'video' ? 'video/mp4' : 'image/jpeg' }));
              if (type === 'image') throttledSetScanningImage(url);
              post.media.push({ name: file.name, url, type, index: idx + 1, size: file.size });
            }
            post.thumbnail = post.media[0].url;
            postsMap.set(postId, post);
          }
        }
      }

      if (discoveredProfilePics.length > 0) {
        discoveredProfilePics.sort((a, b) => b.name.localeCompare(a.name));
        const urls = discoveredProfilePics.map(p => p.url);
        localProfilePic = urls[0];
        setProfileMetadata(prev => ({ ...prev, profilePic: localProfilePic, allProfilePics: urls }));
      } else if (allImageFiles.length > 0) {
        // Fallback: Use oldest image in archive as profile pic
        allImageFiles.sort((a, b) => a.name.localeCompare(b.name));
        const oldestFile = allImageFiles[0];
        try {
          const url = oldestFile.url || URL.createObjectURL(new Blob([await oldestFile.arrayBuffer()], { type: 'image/jpeg' }));
          localProfilePic = url;
          setProfileMetadata(prev => ({ ...prev, profilePic: localProfilePic, allProfilePics: [url] }));
        } catch(e) {}
      }

      const finalUsername = currentUsername || 'archived_user';
      const allItems = Array.from(postsMap.values()).filter(p => p.media && p.media.length > 0).map(p => {
        const sortedMedia = p.media!.sort((a, b) => a.index - b.index);
        return { ...p, username: (p.username === 'archived_user' || !p.username) ? finalUsername : p.username, media: sortedMedia, thumbnail: sortedMedia[0].url } as Post;
      });

      const posts = allItems.filter(p => !p.isStory).sort((a, b) => b.date.localeCompare(a.date));
      const stories = allItems.filter(p => p.isStory).sort((a, b) => b.date.localeCompare(a.date)); // Fixed bug here

      setAllPosts(posts);
      setAllStories(stories);
      setProfileMetadata(prev => ({
        ...prev,
        username: finalUsername,
        fullName: localFullName,
        bio: localBio,
        followerCount: localFollowerCount,
        followingCount: localFollowingCount,
        externalUrl: localExternalUrl,
        profilePic: localProfilePic || prev.profilePic,
      }));

      console.log(`[Scanner] Finalized ${posts.length} posts and ${stories.length} stories.`);

      const archiveToCache = archiveContext || currentArchive;
      const isLocal = !archiveToCache;
      const cacheKey = archiveToCache ? archiveToCache.name : (finalUsername || 'local_archive');

      if (cacheKey && (posts.length > 0 || stories.length > 0)) {
        console.log(`[Cache] Saving data for ${cacheKey} to persistent storage...`);
        let cacheThumbnail = localProfilePic;
        if (isLocal && posts.length > 0 && posts[0].media[0].type === 'image') {
          try {
            const img = new Image(); img.src = posts[0].media[0].url;
            await new Promise((res) => { img.onload = res; img.onerror = res; });
            if (img.complete && img.width > 0) {
              const canvas = document.createElement('canvas'); const size = 200;
              canvas.width = size; canvas.height = size;
              const ctx = canvas.getContext('2d');
              if (ctx) { ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, size, size); cacheThumbnail = canvas.toDataURL('image/jpeg', 0.7); }
            }
          } catch (e) {}
        }

        const cacheData = { 
          name: cacheKey, isLocal, fileCount: archiveToCache ? archiveToCache.fileCount : files.length, 
          posts: posts, // Enable caching for local archives
          stories: stories,
          profileMetadata: { 
            username: finalUsername, 
            fullName: localFullName, 
            bio: localBio, 
            followerCount: localFollowerCount, 
            followingCount: localFollowingCount, 
            externalUrl: localExternalUrl, 
            profilePic: isLocal ? cacheThumbnail : localProfilePic,
            allProfilePics: isLocal ? (cacheThumbnail ? [cacheThumbnail] : []) : discoveredProfilePics.map(p => p.url)
          }, 
          timestamp: Date.now() 
        };
        try {
          await idb.set(cacheKey, cacheData);
          console.log(`[Cache] Data saved successfully.`);
          await refreshCachedArchives();
        } catch (e) { console.error(`[Cache] Save error:`, e); }
      }
    } catch (err) { console.error(`[Scanner] Critical error during scan:`, err); } finally { setIsScanning(false); }
  }, [currentArchive, detectedUsername, resetScannerState, refreshCachedArchives]);

  return {
    isScanning,
    scanningPhase,
    scannedCount,
    totalFiles,
    scannedFilesLog,
    currentScanningImage,
    allPosts,
    allStories,
    profileMetadata,
    handleFiles,
    setAllPosts,
    setAllStories,
    setProfileMetadata,
    setIsScanning,
    setScanningPhase,
    setScannedCount,
    setTotalFiles,
    setScannedFilesLog,
    setCurrentScanningImage,
    resetScannerState
  };
};
