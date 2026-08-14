/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Grid3X3, 
  Play, 
  Layers, 
  FolderOpen,
  Heart,
  MessageCircle,
  Bookmark,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { cn } from './lib/utils';
import { PRESS } from './lib/motion';
import { buildPath, findPostBySlug, parseRoute, postSlug, tabForSource } from './lib/routing';
import { LocalArchiveFile, RemoteArchiveFile } from './lib/archive-files';
import {
  deleteCachedArchive,
  getCachedArchive,
  listCachedArchives,
  listCachedArchiveNames,
  migrateLegacyCache,
  restoreArchive,
  saveDirectoryHandle,
} from './lib/archive-cache';
import {
  filesFromDirectory,
  isDirectoryPickerSupported,
  pickDirectory,
} from './lib/directory-handle';
import { CacheData, Post, ServerArchive, ServerArchiveFile } from './types';
import { ArchiveDashboard } from './components/ArchiveDashboard';
import { StoryViewer } from './components/StoryViewer';
import { PostModal } from './components/PostModal';
import { PostThumbnail } from './components/PostThumbnail';
import { useArchiveScanner } from './hooks/useArchiveScanner';
import { useThumbnailQueue } from './hooks/useThumbnailQueue';

export default function App() {
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [visiblePostsCount, setVisiblePostsCount] = useState(90);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  const [gridAspectRatio, setGridAspectRatio] = useState<'1:1' | '3:4'>('1:1');
  const [gridOffset, setGridOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [serverArchives, setServerArchives] = useState<ServerArchive[]>([]);
  const [cachedArchives, setCachedArchives] = useState<Set<string>>(new Set());
  const [localCachedArchives, setLocalCachedArchives] = useState<CacheData[]>([]);
  const [isServerMode, setIsServerMode] = useState(false);
  /** True once GET /api/archives has settled, successfully or not. */
  const [archivesFetched, setArchivesFetched] = useState(false);
  const [currentArchive, setCurrentArchive] = useState<ServerArchive | null>(null);

  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);

  /**
   * The route as it was when the app booted.
   *
   * Captured during the first render because the URL is rewritten from app
   * state as soon as anything loads; reading `window.location` later would see
   * the rewritten value rather than the link the user actually followed.
   */
  const initialRouteRef = useRef(parseRoute(window.location.pathname, window.location.search));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);

  const refreshCachedArchives = useCallback(async () => {
    try {
      // Names come from key prefixes, so listing no longer deserializes every
      // cached thumbnail blob just to find out which entries are archives.
      setCachedArchives(new Set(await listCachedArchiveNames()));
      setLocalCachedArchives((await listCachedArchives()).filter(a => a.isLocal));
    } catch (e) {
      console.error('[Cache] Failed to list cached archives:', e);
    }
  }, []);

  const {
    isScanning,
    scanningPhase,
    scannedCount,
    totalFiles,
    scannedFilesLog,
    currentScanningImage,
    allPosts,
    allStories,
    allHighlights,
    setAllHighlights,
    profileMetadata,
    handleFiles,
    setAllPosts,
    setAllStories,
    setProfileMetadata,
    setIsScanning,
    setScanningPhase,
    resetScannerState,
    registerUrl
  } = useArchiveScanner('', currentArchive, refreshCachedArchives);

  const [lastLoadedScanningImage, setLastLoadedScanningImage] = useState<string | null>(null);

  const {
    username,
    fullName,
    bio,
    followerCount,
    followingCount,
    externalUrl,
    profilePic,
    allProfilePics
  } = profileMetadata;

  // Thumbnails are keyed per archive, so the queue is scoped to the open one.
  const { cacheHits, requestThumbnail } = useThumbnailQueue(currentArchive?.name ?? username ?? '');

  useEffect(() => {
    fetch('/api/archives')
      .then(res => {
        if (res.ok) {
          setIsServerMode(true);
          return res.json();
        }
        return [];
      })
      .then(data => setServerArchives(Array.isArray(data) ? data : []))
      .catch(() => setIsServerMode(false))
      // Deep-link resolution waits on this rather than on `isServerMode`, which
      // is still false while the request is in flight.
      .finally(() => setArchivesFetched(true));
  }, []);

  useEffect(() => {
    migrateLegacyCache().finally(refreshCachedArchives);
  }, [refreshCachedArchives]);

  const clearCache = async (name: string) => { await deleteCachedArchive(name); await refreshCachedArchives(); };

  /**
   * Archives with a `- reels` sidecar directory say outright which posts are
   * reels; only fall back to the "lone video" heuristic for archives that have
   * no such directory.
   */
  const hasReelSource = useMemo(() => allPosts.some(p => p.source === 'reels'), [allPosts]);
  const isReel = useCallback((p: Post) => (
    hasReelSource ? p.source === 'reels' : p.media.length === 1 && p.media[0].type === 'video'
  ), [hasReelSource]);

  const filteredPosts = useMemo(() => {
    if (activeTab === 'reels') return allPosts.filter(isReel);
    if (activeTab === 'posts') return allPosts.filter(p => !isReel(p));
    return [];
  }, [allPosts, activeTab, isReel]);

  /** Story highlights, grouped into the circles shown under the bio. */
  const highlightGroups = useMemo(() => {
    const groups = new Map<string, Post[]>();
    for (const item of allHighlights) {
      const title = item.highlightTitle?.trim() || 'Highlights';
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title)!.push(item);
    }
    return Array.from(groups, ([title, items]) => ({
      title,
      items,
      // The cover must be a still: most highlight items are videos, and a video
      // URL in an <img> renders as a broken image.
      cover: items.find(i => i.media[0]?.type === 'image')?.thumbnail,
    }));
  }, [allHighlights]);

  const handleTabChange = (tab: 'posts' | 'reels' | 'saved') => { setActiveTab(tab); setVisiblePostsCount(90); };
  const visiblePosts = useMemo(() => filteredPosts.slice(0, visiblePostsCount), [filteredPosts, visiblePostsCount]);
  const postIndex = useMemo(() => selectedPost ? filteredPosts.findIndex(p => p.id === selectedPost.id) : -1, [selectedPost, filteredPosts]);
  const onNextPost = useCallback(() => { if (postIndex < filteredPosts.length - 1) setSelectedPost(filteredPosts[postIndex + 1]); }, [postIndex, filteredPosts]);
  const onPrevPost = useCallback(() => { if (postIndex > 0) setSelectedPost(filteredPosts[postIndex - 1]); }, [postIndex, filteredPosts]);

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { 
      const url = URL.createObjectURL(file); 
      setProfileMetadata(prev => ({ ...prev, profilePic: url, allProfilePics: [url, ...prev.allProfilePics] })); 
    }
  };

  const cycleProfilePic = () => { 
    if (allProfilePics.length > 1) { 
      const idx = allProfilePics.indexOf(profilePic || ''); 
      setProfileMetadata(prev => ({ ...prev, profilePic: allProfilePics[(idx + 1) % allProfilePics.length] }));
    } 
  };

  const loadServerArchive = useCallback(async (archive: ServerArchive) => {
    console.log(`[Cache] Attempting to load archive: ${archive.name}`);
    setIsScanning(true);
    setCurrentArchive(archive);
    setScanningPhase('Checking Cache');
    
    try {
      const cachedData = await getCachedArchive(archive.name);
      if (cachedData) {
        // Invalidate on the directory-mtime signature; fall back to file count
        // for entries cached before signatures existed.
        const fresh = archive.signature
          ? cachedData.signature === archive.signature
          : cachedData.fileCount === archive.fileCount;
        console.log(`[Cache] Cached ${archive.name}: signature ${cachedData.signature} vs ${archive.signature} -> ${fresh ? 'fresh' : 'stale'}`);
        if (fresh) {
          console.log(`[Cache] Cache hit! Restoring state...`);
          const restored = await restoreArchive(cachedData, registerUrl);
          if (restored) {
            setAllPosts(restored.posts);
            setAllStories(restored.stories);
            setAllHighlights(restored.highlights);
            setProfileMetadata({
              ...restored.profileMetadata,
              allProfilePics: restored.profileMetadata.allProfilePics
                ?? (restored.profileMetadata.profilePic ? [restored.profileMetadata.profilePic] : []),
            });
            setVisiblePostsCount(90);
            setIsScanning(false);
            console.log(`[Cache] Archive ${archive.name} loaded successfully from cache.`);
            return;
          }
        }
      }

      console.log(`[Scanner] Starting fresh scan from server API...`);
      const res = await fetch(`/api/archives/${encodeURIComponent(archive.name)}/files`);
      const entries: (ServerArchiveFile | string)[] = await res.json();

      const archiveFiles = entries.map(entry => {
        // Older servers returned bare path strings relative to the archive dir.
        const legacy = typeof entry === 'string';
        const filePath = legacy ? entry : entry.path;
        const url = legacy
          ? `/archives/${encodeURI(`${archive.name}/${filePath}`)}`
          : `/archives/${encodeURI(filePath)}`;
        const name = filePath.split(/[/\\]/).pop() || filePath;
        const source = legacy
          ? undefined
          : { kind: entry.kind, dir: filePath.split('/')[0], title: entry.title };
        return new RemoteArchiveFile(name, filePath, legacy ? 0 : entry.size, url, source, legacy ? undefined : entry.mtime);
      });

      await handleFiles(archiveFiles, archive);
    } catch (err) {
      console.error('[Scanner] Failed to load server archive:', err);
      setIsScanning(false);
    }
  }, [handleFiles, registerUrl, setAllPosts, setAllStories, setAllHighlights, setProfileMetadata, setIsScanning, setScanningPhase]);

  /**
   * Open a local archive straight from cache.
   *
   * The cached posts carry file *paths*, not URLs — blob: URLs do not survive a
   * reload — so this re-opens the stored directory handle and mints fresh URLs
   * for those paths. No re-parsing happens, which is what keeps it instant.
   *
   * If the folder can no longer be reached (permission revoked, folder moved,
   * or the browser never supported directory handles) we fall back to asking
   * for the folder again rather than rendering an archive of broken images.
   */
  const loadLocalCachedArchive = useCallback(async (archive: CacheData) => {
    console.log(`[Cache] Loading local archive from cache: ${archive.name}`);
    setIsScanning(true);
    setCurrentArchive(null);
    setScanningPhase('Checking Cache');

    try {
      const restored = await restoreArchive(archive, registerUrl);

      if (!restored) {
        console.warn(`[Cache] Folder for ${archive.name} unavailable; re-prompting.`);
        setIsScanning(false);
        await openLocalFolder(archive.name);
        return;
      }

      setAllPosts(restored.posts);
      setAllStories(restored.stories);
      setAllHighlights(restored.highlights);
      setProfileMetadata({
        ...restored.profileMetadata,
        allProfilePics: restored.profileMetadata.allProfilePics
          ?? (restored.profileMetadata.profilePic ? [restored.profileMetadata.profilePic] : []),
      });
      setVisiblePostsCount(90);
      setIsScanning(false);
      console.log(`[Cache] Local archive ${archive.name} restored from cache.`);
    } catch (err) {
      console.error('[Cache] Failed to restore local archive:', err);
      setIsScanning(false);
    }
  }, [registerUrl, setAllPosts, setAllStories, setAllHighlights, setProfileMetadata, setIsScanning, setScanningPhase]);

  const handleLocalFiles = (files: FileList | null) => {
    if (!files) return;
    handleFiles(Array.from(files).map(f => new LocalArchiveFile(f)));
  };

  /**
   * Prefer the File System Access API so the folder can be reopened later
   * without a re-prompt; fall back to <input webkitdirectory> elsewhere
   * (Firefox and Safari have no showDirectoryPicker), where the archive is
   * re-scanned from scratch on every visit.
   */
  const openLocalFolder = useCallback(async (expectedName?: string) => {
    if (!isDirectoryPickerSupported()) {
      fileInputRef.current?.click();
      return;
    }

    const handle = await pickDirectory();
    if (!handle) return;

    if (expectedName && handle.name !== expectedName) {
      console.warn(`[Cache] Picked "${handle.name}" but expected "${expectedName}"; scanning as picked.`);
    }

    // Persist before scanning so the scan records that a handle exists.
    await saveDirectoryHandle(handle.name, handle);
    const files = await filesFromDirectory(handle);
    await handleFiles(files);
  }, [handleFiles]);

  const triggerFileSelect = () => { void openLocalFolder(); };
  const loadMore = () => setVisiblePostsCount(prev => prev + 90);

  useEffect(() => {
    // Hold the URL until the deep link has been consumed, otherwise this effect
    // runs on mount with nothing loaded yet and erases the very parameters the
    // loader below is waiting to read.
    if (!hasInitialLoaded) return;

    const archive = currentArchive?.name ?? (allPosts.length > 0 ? username : null) ?? null;
    const nextPath = buildPath({
      archive,
      tab: activeTab,
      post: selectedPost ? postSlug(selectedPost) : null,
    });

    if (nextPath !== window.location.pathname + window.location.search) {
      console.log(`[Permalink] Updating URL to: ${nextPath}`);
      window.history.replaceState(null, '', nextPath);
    }
  }, [hasInitialLoaded, currentArchive?.name, username, allPosts.length, activeTab, selectedPost?.id]);

  useEffect(() => {
    if (hasInitialLoaded) return;

    const route = initialRouteRef.current;
    console.log('[Permalink] Initial route:', route);

    if (route.tab !== 'posts') setActiveTab(route.tab);

    if (!route.archive) {
      setHasInitialLoaded(true);
      return;
    }

    // Wait for the archive list before deciding the link is unresolvable.
    if (!archivesFetched) return;

    const archive = serverArchives.find(a => a.name === route.archive);
    if (archive) {
      console.log(`[Permalink] Auto-loading archive: ${route.archive}`);
      loadServerArchive(archive);
    } else {
      console.warn(`[Permalink] No archive named "${route.archive}".`);
    }
    setHasInitialLoaded(true);
  }, [serverArchives, archivesFetched, hasInitialLoaded, loadServerArchive]);

  /**
   * Apply a `?p=` deep link exactly once per opened archive.
   *
   * Keying on the archive rather than on `selectedPost` matters: re-reading the
   * URL whenever the selection changes would reopen the post the user just
   * closed, and only worked before because the URL-writing effect happened to
   * be declared first and had already stripped the param.
   */
  const appliedPostParamRef = useRef<string | null>(null);
  useEffect(() => {
    const archiveKey = currentArchive?.name ?? username;
    if (!archiveKey || allPosts.length === 0) return;
    if (appliedPostParamRef.current === archiveKey) return;
    appliedPostParamRef.current = archiveKey;

    const slug = initialRouteRef.current.post;
    if (!slug) return;
    const post = findPostBySlug(allPosts, slug);
    if (!post) return;
    // A /p/<code>/ link carries no tab, so derive the one that contains it —
    // otherwise next/prev would page through the wrong list.
    setActiveTab(tabForSource(post.source));
    setSelectedPost(post);
  }, [allPosts, currentArchive?.name, username]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <input type="file" ref={fileInputRef} className="hidden" webkitdirectory="" multiple onChange={(e) => handleLocalFiles(e.target.files)} />

      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 h-16 flex items-center px-4 md:px-8">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between text-black">
          <h1 className="text-lg md:text-xl font-bold tracking-tight italic font-serif cursor-pointer text-black/80" onClick={() => { setAllPosts([]); setAllStories([]); setCurrentArchive(null); resetScannerState(); }}>InstaArchive</h1>
          <div className="flex items-center gap-2 md:gap-8 text-black">
            {allPosts.length > 0 && activeTab === 'posts' && (
              <div className="flex items-center gap-2 md:gap-6 text-black">
                <div className="flex items-center gap-1.5 md:gap-2 text-black"><span className="hidden sm:inline text-[10px] font-bold uppercase text-gray-400 tracking-wider">Bump:</span>
                  <div className="flex bg-gray-100 p-0.5 md:p-1 rounded-lg text-black">{[0, 1, 2].map((offset) => (<button key={offset} onClick={() => setGridOffset(offset)} className={cn("px-2 md:px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all", gridOffset === offset ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-gray-700")}>{offset}</button>))}</div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 text-black"><span className="hidden sm:inline text-[10px] font-bold uppercase text-gray-400 tracking-wider">Grid:</span>
                  <div className="flex bg-gray-100 p-0.5 md:p-1 rounded-lg text-black"><button onClick={() => setGridAspectRatio('1:1')} className={cn("px-2 md:px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all", gridAspectRatio === '1:1' ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-gray-700")}>1:1</button><button onClick={() => setGridAspectRatio('3:4')} className={cn("px-2 md:px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all", gridAspectRatio === '3:4' ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-gray-700")}>3:4</button></div>
                </div>
              </div>
            )}
            <button onClick={() => { if (allPosts.length > 0) { setAllPosts([]); setAllStories([]); setCurrentArchive(null); resetScannerState(); } else { triggerFileSelect(); } }} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"><FolderOpen size={18} /><span className="hidden sm:inline">{allPosts.length > 0 ? 'Exit Archive' : 'Load Archive'}</span><span className="sm:hidden">{allPosts.length > 0 ? 'Exit' : 'Load'}</span></button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 text-black">
        {allPosts.length === 0 && !isScanning ? (
          isServerMode ? (
            <ArchiveDashboard 
              archives={serverArchives} 
              localArchives={localCachedArchives}
              cachedArchives={cachedArchives} 
              onSelect={loadServerArchive} 
              onLocalSelect={triggerFileSelect} 
              onLocalCacheSelect={loadLocalCachedArchive}
              onClearCache={clearCache} 
              isScanning={isScanning} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 text-black">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-black"><Grid3X3 size={48} strokeWidth={1} /></div>
              <div className="space-y-2 text-black"><h2 className="text-2xl font-semibold text-black/80">No Archive Selected</h2><p className="text-gray-500 max-md text-sm md:text-base text-black">Select a local archive folder to start browsing. Your files are processed locally in the browser and never uploaded.</p></div>
              <button onClick={triggerFileSelect} disabled={isScanning} className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">{isScanning ? <><Loader2 className="animate-spin" size={20} /><span className="animate-dots">Scanning</span></> : 'Select Local Archive Folder'}</button>
            </div>
          )
        ) : isScanning ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden text-black bg-[#f8fafc]">
            {currentScanningImage && (
              <img 
                src={currentScanningImage} 
                className="hidden" 
                onLoad={() => setLastLoadedScanningImage(currentScanningImage)} 
              />
            )}
            <div className="absolute inset-0 z-0">
              <AnimatePresence initial={false}>
                <motion.img 
                  key={lastLoadedScanningImage}
                  src={lastLoadedScanningImage || undefined}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  transition={{ duration: 1.5 }}
                  className="absolute inset-0 w-full h-full object-cover blur-[60px] scale-110"
                />
              </AnimatePresence>
            </div>
            <div className="absolute inset-0 bg-white/40 z-1" />
            <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center gap-8 text-black">
              <div className="text-center space-y-2 text-black"><div className="text-4xl font-bold tracking-tight italic font-serif text-black/80 drop-shadow-sm text-black">Scanning Archive...</div><div className="flex items-center justify-center gap-3 text-black"><div className="h-[1px] w-12 bg-black/10 text-black" /><p className="text-black/40 text-[10px] uppercase tracking-[0.3em] font-bold text-black">{scanningPhase === 'Indexing' ? 'Building file index' : 'Parsing metadata & media'}</p><div className="h-[1px] w-12 bg-black/10 text-black" /></div></div>
              <div className="w-full max-w-2xl space-y-4 text-black"><div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-black/40 px-1 text-black"><span className="flex items-center gap-2 text-black"><Loader2 size={12} className="animate-spin text-black" />Phase: {scanningPhase}</span><span className="text-black">{scannedCount} / {totalFiles}</span></div><div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden backdrop-blur-sm border border-black/5 shadow-inner text-black"><motion.div className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] text-black" initial={{ width: 0 }} animate={{ width: `${(scannedCount / (totalFiles || 1)) * 100}%` }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} /></div></div>
              <div className="w-full bg-white/40 backdrop-blur-3xl rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-white/40 overflow-hidden h-[500px] flex flex-col text-black"><div className="flex items-center justify-between border-b border-black/5 py-3 px-5 bg-white/20 shrink-0 text-black"><div className="flex items-center gap-2 text-black"><div className="w-2.5 h-2.5 rounded-full bg-black/10 text-black" /><div className="w-2.5 h-2.5 rounded-full bg-black/10 text-black" /><div className="w-2.5 h-2.5 rounded-full bg-black/10 text-black" /><span className="ml-3 text-black/30 uppercase tracking-[0.2em] text-[9px] font-bold text-black">System Parser Feed</span></div><div className="text-[9px] font-bold text-black/20 uppercase tracking-widest text-black">Live Output</div></div><div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide p-4 text-black">{scannedFilesLog.map((log, idx) => (<div key={`${idx}-${log}`} className="flex gap-4 leading-tight text-[11px] md:text-[12px] font-medium text-black"><span className="text-black/20 shrink-0 tabular-nums text-black">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span><span className={cn("shrink-0 px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold tracking-wider text-black", scanningPhase === 'Indexing' ? "bg-green-500/10 text-green-600/70" : "bg-blue-500/10 text-blue-600/70")}>{scanningPhase === 'Indexing' ? 'IDX' : 'PARSE'}</span><span className="truncate text-black/60 text-black">{log}</span></div>))}{scannedFilesLog.length === 0 && <div className="animate-pulse text-black/20 font-mono text-center mt-20 italic text-black">Initializing scanner context...</div>}</div></div>
            </div>
          </div>
        ) : (
          <div className="space-y-12 text-black">
            <header className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-20 px-4 text-black">
              <div className={cn("w-24 h-24 md:w-36 md:h-36 rounded-full p-1 cursor-pointer transition-transform active:scale-95 text-black", allStories.length > 0 ? "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600" : "bg-gray-200" )} onClick={() => allStories.length > 0 && setShowStoryViewer(true)}><div className="w-full h-full rounded-full bg-white p-1 text-black"><div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center overflow-hidden text-black">{profilePic ? <img src={profilePic} alt={username} className="w-full h-full object-cover text-black" onError={() => setProfileMetadata(prev => ({ ...prev, profilePic: null }))} referrerPolicy="no-referrer" /> : <span className="text-3xl font-bold text-gray-400 uppercase text-black">{username?.[0] || 'U'}</span>}</div></div></div>
              <div className="flex-1 space-y-6 text-center md:text-left text-black">
                <div className="flex flex-col md:flex-row items-center gap-4 text-black">
                  <h2 className="text-2xl font-light tracking-wide text-black">{username}</h2>
                  <div className="flex gap-2 text-black">
                    <input type="file" ref={profilePicInputRef} className="hidden text-black" accept="image/*" onChange={handleProfilePicChange} />
                    {allProfilePics.length === 0 && <button onClick={() => profilePicInputRef.current?.click()} className="bg-gray-100 hover:bg-gray-200 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors text-black">Set Profile Picture</button>}
                    {allProfilePics.length > 1 && <button onClick={cycleProfilePic} className="bg-gray-100 hover:bg-gray-200 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 text-black"><Layers size={16} />Next Profile Pic</button>}
                  </div>
                </div>
                <div className="flex justify-center md:justify-start gap-10 text-sm md:text-base text-black"><div><span className="font-semibold text-black/80 text-black">{allPosts.length}</span> posts</div><div><span className="font-semibold text-black/80 text-black">{(followerCount || 0).toLocaleString()}</span> followers</div><div><span className="font-semibold text-black/80 text-black">{(followingCount || 0).toLocaleString()}</span> following</div></div>
                <div className="space-y-1 text-black/80 text-black"><div className="font-semibold text-black">{fullName || `@${username}`}</div><div className="text-gray-600 whitespace-pre-wrap max-w-sm mx-auto md:mx-0 text-sm md:text-base text-black">{bio || 'Archived profile viewer for local files.'}</div>{externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-900 font-semibold text-sm block hover:underline truncate max-w-[250px] text-black">{externalUrl.replace(/^https?:\/\/(www\.)?/, '')}</a>}</div>
              </div>
            </header>

            {highlightGroups.length > 0 && (
              <div className="flex gap-6 md:gap-8 overflow-x-auto scrollbar-hide px-4 pb-2">
                {highlightGroups.map(group => (
                  <motion.button
                    key={group.title}
                    onClick={() => setActiveHighlight(group.title)}
                    whileTap={{ scale: 0.94 }}
                    transition={PRESS}
                    className="flex flex-col items-center gap-2 shrink-0 group/hl"
                    title={`${group.title} — ${group.items.length} item${group.items.length === 1 ? '' : 's'}`}
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full p-[2px] bg-gray-200 group-hover/hl:bg-gray-300 transition-colors">
                      <div className="w-full h-full rounded-full bg-white p-[2px]">
                        <div className="w-full h-full rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                          {group.cover ? (
                            <img src={group.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                          ) : (
                            <Play size={18} className="text-gray-400" fill="currentColor" />
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] max-w-[80px] truncate text-gray-700">{group.title}</span>
                  </motion.button>
                ))}
              </div>
            )}

            <div className="border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 text-black">
              <div className="flex justify-center gap-12 flex-1 text-black">
                <button onClick={() => handleTabChange('posts')} className={cn("flex items-center gap-2 py-4 border-t text-xs font-bold tracking-widest uppercase transition-all text-black", activeTab === 'posts' ? "border-black text-black" : "border-transparent text-gray-400")}><Grid3X3 size={14} />Posts</button>
                <button onClick={() => handleTabChange('reels')} className={cn("flex items-center gap-2 py-4 border-t text-xs font-bold tracking-widest uppercase transition-all text-black", activeTab === 'reels' ? "border-black text-black" : "border-transparent text-gray-400")}><Play size={14} />Reels</button>
                <button onClick={() => handleTabChange('saved')} className={cn("flex items-center gap-2 py-4 border-t text-xs font-bold tracking-widest uppercase transition-all text-black", activeTab === 'saved' ? "border-black text-black" : "border-transparent text-gray-400")}><Bookmark size={14} />Saved</button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-[2px] md:gap-[2px] text-black">
              {activeTab === 'posts' && Array.from({ length: gridOffset }).map((_, i) => (<div key={`blank-${i}`} className={cn("bg-gray-100/50 border border-dashed border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-300 uppercase tracking-tighter text-black", gridAspectRatio === '1:1' ? "aspect-square" : "aspect-[3/4]")}>Blank</div>))}
              {visiblePosts.map((post) => (
                <motion.div key={post.id} layoutId={post.id} onClick={() => setSelectedPost(post)} whileTap={{ scale: 0.97 }} transition={PRESS} className={cn("relative group cursor-pointer overflow-hidden bg-gray-200 transition-all duration-300 text-black", activeTab === 'reels' ? "aspect-[9/16]" : (gridAspectRatio === '1:1' ? "aspect-square" : "aspect-[3/4]"))}>
                  <PostThumbnail 
                    post={post} 
                    thumbnailUrl={cacheHits.get(post.id)} 
                    onRequestThumbnail={requestThumbnail} 
                  />
                  <div className="absolute top-2 right-2 flex gap-1.5 z-10 text-black">{post.media.length > 1 && <div className="bg-black/40 backdrop-blur-md p-1 rounded-md text-white shadow-sm text-black"><Layers size={16} /></div>}{post.media.some(m => m.type === 'video') && <div className="bg-black/40 backdrop-blur-md p-1 rounded-md text-white shadow-sm text-black"><Play size={16} fill="white" /></div>}</div>
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold z-20 text-black"><div className="flex items-center gap-2 text-black"><Heart fill="white" size={20} className="text-black" /><span>-</span></div><div className="flex items-center gap-2 text-black"><MessageCircle fill="white" size={20} className="text-black" /><span>-</span></div></div>
                </motion.div>
              ))}
            </div>
            {filteredPosts.length > visiblePostsCount && <div className="flex justify-center pt-12 text-black"><button onClick={loadMore} className="bg-white border border-gray-200 px-8 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-sm text-black">Load More</button></div>}
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedPost && (
          <PostModal 
            post={selectedPost} 
            nextPost={postIndex < filteredPosts.length - 1 ? filteredPosts[postIndex + 1] : undefined}
            prevPost={postIndex > 0 ? filteredPosts[postIndex - 1] : undefined}
            onClose={() => setSelectedPost(null)} 
            onNextPost={onNextPost} 
            onPrevPost={onPrevPost} 
            hasNextPost={postIndex < filteredPosts.length - 1} 
            hasPrevPost={postIndex > 0} 
            profilePic={profilePic} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{showStoryViewer && allStories.length > 0 && <StoryViewer stories={allStories} onClose={() => setShowStoryViewer(false)} profilePic={profilePic} />}</AnimatePresence>
      <AnimatePresence>
        {activeHighlight && (
          <StoryViewer
            stories={highlightGroups.find(g => g.title === activeHighlight)?.items ?? []}
            title={activeHighlight}
            onClose={() => setActiveHighlight(null)}
            profilePic={profilePic}
          />
        )}
      </AnimatePresence>

      {!isScanning && (
        <footer className="max-w-5xl mx-auto px-4 py-12 text-center text-xs text-gray-400 space-y-4 text-black">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 uppercase tracking-tight text-black"><span>Meta</span><span>About</span><span>Blog</span><span>Jobs</span><span>Help</span><span>API</span><span>Privacy</span><span>Terms</span><span>Locations</span><span>Instagram Lite</span><span>Threads</span><span>Contact Uploading & Non-Users</span><span>Meta Verified</span></div>
          <div className="text-black/40 text-black">© 2026 InstaArchive Viewer</div>
        </footer>
      )}
    </div>
  );
}
