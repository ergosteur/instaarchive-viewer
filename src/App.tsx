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
import * as idb from 'idb-keyval';

import { cn } from './lib/utils';
import { LocalArchiveFile, RemoteArchiveFile } from './lib/archive-files';
import { Post, ServerArchive } from './types';
import { ArchiveDashboard } from './components/ArchiveDashboard';
import { StoryViewer } from './components/StoryViewer';
import { PostModal } from './components/PostModal';
import { VideoThumbnail } from './components/VideoThumbnail';
import { useArchiveScanner } from './hooks/useArchiveScanner';

export default function App() {
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [visiblePostsCount, setVisiblePostsCount] = useState(90);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  const [gridAspectRatio, setGridAspectRatio] = useState<'1:1' | '3:4'>('1:1');
  const [gridOffset, setGridOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [serverArchives, setServerArchives] = useState<ServerArchive[]>([]);
  const [cachedArchives, setCachedArchives] = useState<Set<string>>(new Set());
  const [localCachedArchives, setLocalCachedArchives] = useState<any[]>([]);
  const [isServerMode, setIsServerMode] = useState(false);
  const [currentArchive, setCurrentArchive] = useState<ServerArchive | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);

  const refreshCachedArchives = useCallback(async () => {
    try {
      const keys = await idb.keys();
      setCachedArchives(new Set(keys.map(String)));

      const locals: any[] = [];
      for (const key of keys) {
        const data: any = await idb.get(key);
        if (data && data.isLocal) {
          // Fallback for missing allProfilePics in local cached metadata
          if (!data.profileMetadata.allProfilePics) {
            data.profileMetadata.allProfilePics = data.profileMetadata.profilePic ? [data.profileMetadata.profilePic] : [];
          }
          locals.push(data);
        }
      }
      setLocalCachedArchives(locals);
    } catch (e) {}
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
    profileMetadata,
    handleFiles,
    setAllPosts,
    setAllStories,
    setProfileMetadata,
    setIsScanning,
    setScanningPhase,
    resetScannerState
  } = useArchiveScanner('', currentArchive, refreshCachedArchives);

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

  useEffect(() => {
    fetch('/api/archives')
      .then(res => {
        if (res.ok) {
          setIsServerMode(true);
          return res.json();
        }
        return [];
      })
      .then(data => setServerArchives(data))
      .catch(() => setIsServerMode(false));
  }, []);

  useEffect(() => {
    refreshCachedArchives();
  }, [refreshCachedArchives]);

  const clearCache = async (name: string) => { await idb.del(name); await refreshCachedArchives(); };

  const filteredPosts = useMemo(() => {
    if (activeTab === 'reels') return allPosts.filter(p => p.media.length === 1 && p.media[0].type === 'video');
    if (activeTab === 'posts') return allPosts.filter(p => !(p.media.length === 1 && p.media[0].type === 'video'));
    return [];
  }, [allPosts, activeTab]);

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
      const cachedData = await idb.get(archive.name);
      if (cachedData) {
        console.log(`[Cache] Found cached data for ${archive.name}. File count: ${cachedData.fileCount} (Server has: ${archive.fileCount})`);
        if (cachedData.fileCount === archive.fileCount) {
          console.log(`[Cache] Cache hit! Restoring state...`);
          setAllPosts(cachedData.posts);
          setAllStories(cachedData.stories);
          
          // Handle migration from old cache schema where allProfilePics was a separate top-level key
          const profileMetadata = { ...cachedData.profileMetadata };
          if (!profileMetadata.allProfilePics && cachedData.allProfilePics) {
            profileMetadata.allProfilePics = cachedData.allProfilePics;
          }
          if (!profileMetadata.allProfilePics) {
            profileMetadata.allProfilePics = profileMetadata.profilePic ? [profileMetadata.profilePic] : [];
          }
          
          setProfileMetadata(profileMetadata);
          setVisiblePostsCount(90);
          setIsScanning(false);
          console.log(`[Cache] Archive ${archive.name} loaded successfully from cache.`);
          return;
        }
      }

      console.log(`[Scanner] Starting fresh scan from server API...`);
      const res = await fetch(`/api/archives/${archive.name}/files`);
      const filePaths: string[] = await res.json();
      
      const archiveFiles = filePaths.map(p => {
        const name = p.split(/[/\\]/).pop() || p;
        return new RemoteArchiveFile(name, p, 0, `/archives/${archive.name}/${p}`);
      });

      await handleFiles(archiveFiles, archive);
    } catch (err) {
      console.error('[Scanner] Failed to load server archive:', err);
      setIsScanning(false);
    }
  }, [handleFiles, setAllPosts, setAllStories, setProfileMetadata, setIsScanning, setScanningPhase]);

  const handleLocalFiles = (files: FileList | null) => { if (!files) return; const archiveFiles = Array.from(files).map(f => new LocalArchiveFile(f)); handleFiles(archiveFiles); };
  const triggerFileSelect = () => fileInputRef.current?.click();
  const loadMore = () => setVisiblePostsCount(prev => prev + 90);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (currentArchive) params.set('a', currentArchive.name);
    else if (allPosts.length > 0 && username) params.set('a', username);
    else params.delete('a');

    if (activeTab !== 'posts') params.set('t', activeTab);
    else params.delete('t');

    if (selectedPost) params.set('p', selectedPost.id);
    else params.delete('p');

    const newSearch = params.toString();
    const currentSearch = new URLSearchParams(window.location.search).toString();
    if (newSearch !== currentSearch) {
      console.log(`[Permalink] Updating URL to: ?${newSearch}`);
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState(null, '', newUrl);
    }
  }, [currentArchive?.name, username, allPosts.length, activeTab, selectedPost?.id]);

  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);
  useEffect(() => {
    if (hasInitialLoaded || serverArchives.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const archiveName = params.get('a');
    const tab = params.get('t');
    const postId = params.get('p');
    console.log('[Permalink] Initial read from URL:', { archiveName, tab, postId });
    if (archiveName) {
      const archive = serverArchives.find(a => a.name === archiveName);
      if (archive) {
        console.log(`[Permalink] Auto-loading archive: ?a=${archiveName}`);
        loadServerArchive(archive);
        if (tab && ['posts', 'reels', 'saved'].includes(tab)) {
          setActiveTab(tab as any);
        }
      }
    }
    setHasInitialLoaded(true);
  }, [serverArchives, hasInitialLoaded, loadServerArchive]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('p');
    if (postId && allPosts.length > 0 && !selectedPost) {
      const post = allPosts.find(p => p.id === postId);
      if (post) setSelectedPost(post);
    }
  }, [allPosts, selectedPost]);

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
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden text-black">
            <AnimatePresence>{currentScanningImage && (<motion.div key={currentScanningImage} initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 text-black"><img src={currentScanningImage} alt="" className="w-full h-full object-cover blur-[100px] scale-110 text-black" /></motion.div>)}</AnimatePresence>
            <div className="absolute inset-0 bg-white/20 z-1 text-black" />
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
                <motion.div key={post.id} layoutId={post.id} onClick={() => setSelectedPost(post)} className={cn("relative group cursor-pointer overflow-hidden bg-gray-200 transition-all duration-300 text-black", activeTab === 'reels' ? "aspect-[9/16]" : (gridAspectRatio === '1:1' ? "aspect-square" : "aspect-[3/4]"))}>
                  {post.media[0].type === 'video' ? <VideoThumbnail url={post.media[0].url} /> : <img src={post.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 text-black" referrerPolicy="no-referrer" />}
                  <div className="absolute top-2 right-2 flex gap-1.5 z-10 text-black">{post.media.length > 1 && <div className="bg-black/40 backdrop-blur-md p-1 rounded-md text-white shadow-sm text-black"><Layers size={16} /></div>}{post.media.some(m => m.type === 'video') && <div className="bg-black/40 backdrop-blur-md p-1 rounded-md text-white shadow-sm text-black"><Play size={16} fill="white" /></div>}</div>
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold z-20 text-black"><div className="flex items-center gap-2 text-black"><Heart fill="white" size={20} className="text-black" /><span>-</span></div><div className="flex items-center gap-2 text-black"><MessageCircle fill="white" size={20} className="text-black" /><span>-</span></div></div>
                </motion.div>
              ))}
            </div>
            {filteredPosts.length > visiblePostsCount && <div className="flex justify-center pt-12 text-black text-black"><button onClick={loadMore} className="bg-white border border-gray-200 px-8 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-sm text-black text-black">Load More</button></div>}
          </div>
        )}
      </main>

      <AnimatePresence>{selectedPost && <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} onNextPost={onNextPost} onPrevPost={onPrevPost} hasNextPost={postIndex < filteredPosts.length - 1} hasPrevPost={postIndex > 0} profilePic={profilePic} />}</AnimatePresence>
      <AnimatePresence>{showStoryViewer && allStories.length > 0 && <StoryViewer stories={allStories} onClose={() => setShowStoryViewer(false)} profilePic={profilePic} />}</AnimatePresence>

      {!isScanning && (
        <footer className="max-w-5xl mx-auto px-4 py-12 text-center text-xs text-gray-400 space-y-4 text-black">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 uppercase tracking-tight text-black text-black"><span>Meta</span><span>About</span><span>Blog</span><span>Jobs</span><span>Help</span><span>API</span><span>Privacy</span><span>Terms</span><span>Locations</span><span>Instagram Lite</span><span>Threads</span><span>Contact Uploading & Non-Users</span><span>Meta Verified</span></div>
          <div className="text-black/40 text-black">© 2026 InstaArchive Viewer</div>
        </footer>
      )}
    </div>
  );
}
