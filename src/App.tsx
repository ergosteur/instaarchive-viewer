/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Grid3X3, 
  Play, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  FolderOpen,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Loader2,
  Volume2,
  VolumeX,
  Zap,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
// @ts-ignore
import { XzReadableStream } from 'xz-decompress';
import * as idb from 'idb-keyval';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface MediaFile {
  name: string;
  url: string;
  type: 'image' | 'video';
  index: number;
}

interface Post {
  id: string;
  date: string;
  username: string;
  caption: string;
  media: MediaFile[];
  thumbnail: string;
  isStory?: boolean;
}

/**
 * Common interface for both local File objects and remote server-side files.
 */
interface ArchiveFile {
  name: string;
  webkitRelativePath: string;
  size: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): ReadableStream<Uint8Array>;
  url?: string;
}

class LocalArchiveFile implements ArchiveFile {
  constructor(private file: File) {}
  get name() { return this.file.name; }
  get webkitRelativePath() { return this.file.webkitRelativePath; }
  get size() { return this.file.size; }
  text() { return this.file.text(); }
  arrayBuffer() { return this.file.arrayBuffer(); }
  stream() { return this.file.stream(); }
}

class RemoteArchiveFile implements ArchiveFile {
  constructor(
    public name: string,
    public webkitRelativePath: string,
    public size: number,
    public url: string
  ) {}
  async text() {
    const res = await fetch(this.url);
    return res.text();
  }
  async arrayBuffer() {
    const res = await fetch(this.url);
    return res.arrayBuffer();
  }
  stream() {
    const transform = new TransformStream();
    fetch(this.url).then(res => {
      if (res.body) res.body.pipeTo(transform.writable);
      else transform.writable.getWriter().close();
    });
    return transform.readable;
  }
}

interface ServerArchive {
  name: string;
  thumbnail: string;
  path: string;
  fileCount: number;
}

// --- Components ---

const ArchiveDashboard = ({ 
  archives, 
  cachedArchives,
  onSelect,
  onLocalSelect,
  onClearCache,
  isScanning
}: { 
  archives: ServerArchive[]; 
  cachedArchives: Set<string>;
  onSelect: (archive: ServerArchive) => void;
  onLocalSelect: () => void;
  onClearCache: (name: string) => void;
  isScanning: boolean;
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight font-serif italic text-black/80">Archive Explorer</h2>
        <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
          Browse hosted collections or open a local archive folder. All processing happens locally in your browser for maximum privacy.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
        {/* Local Folder Card */}
        <button 
          onClick={onLocalSelect}
          disabled={isScanning}
          className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center gap-4 group disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors shadow-inner">
            <FolderOpen size={24} />
          </div>
          <div className="text-center px-4">
            <span className="font-bold text-sm block text-black/80">Open Local Folder</span>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest leading-tight block mt-1">Processed in Browser</span>
          </div>
        </button>

        {/* Server Archives */}
        {archives.map((archive) => {
          const isCached = cachedArchives.has(archive.name);
          return (
            <div key={archive.path} className="relative group">
              <button
                onClick={() => onSelect(archive)}
                disabled={isScanning}
                className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all flex flex-col text-left disabled:opacity-50"
              >
                <div className="flex-1 bg-gray-100 overflow-hidden relative">
                  {archive.thumbnail ? (
                    <img src={archive.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Grid3X3 size={48} strokeWidth={1} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={32} fill="white" className="text-white" />
                  </div>
                  
                  {isCached && (
                    <div className="absolute top-2 left-2 bg-blue-500 text-white p-1 rounded-md shadow-lg flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider z-10 pr-2">
                      <Zap size={10} fill="currentColor" />
                      Cached
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-1">
                  <span className="font-bold text-sm block truncate uppercase tracking-tight text-black/80">{archive.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">{archive.fileCount} items</span>
                </div>
              </button>
              
              {isCached && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearCache(archive.name);
                  }}
                  className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20"
                  title="Clear Cache"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StoryViewer = ({ 
  stories, 
  onClose,
  profilePic
}: { 
  stories: Post[]; 
  onClose: () => void;
  profilePic: string | null;
}) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const story = stories[currentStoryIndex];

  useEffect(() => {
    setProgress(0);
    let duration = 5000;
    const interval = 50;
    
    const updateProgress = () => {
      if (story.media[0].type === 'video' && videoRef.current) {
        const currentTime = videoRef.current.currentTime;
        const totalTime = videoRef.current.duration;
        if (totalTime) {
          setProgress((currentTime / totalTime) * 100);
        }
      } else {
        setProgress(prev => {
          const step = (interval / duration) * 100;
          if (prev >= 100) return 100;
          return prev + step;
        });
      }
    };

    const timer = setInterval(() => {
      updateProgress();
    }, interval);

    return () => clearInterval(timer);
  }, [currentStoryIndex, story.media]);

  useEffect(() => {
    if (progress >= 100) {
      if (currentStoryIndex < stories.length - 1) {
        setCurrentStoryIndex(prev => prev + 1);
      } else {
        onClose();
      }
    }
  }, [progress, currentStoryIndex, stories.length, onClose]);

  const nextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const prevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#1a1a1a] flex items-center justify-center overflow-hidden"
      onClick={onClose}
    >
      <div className="absolute inset-0 z-0">
        <img 
          src={story.media[0].url} 
          alt="" 
          className="w-full h-full object-cover blur-3xl opacity-30"
        />
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); prevStory(); }}
        className={cn(
          "hidden md:flex absolute left-4 lg:left-20 z-50 text-white/80 hover:text-white transition-all bg-white/10 p-3 rounded-full backdrop-blur-md",
          currentStoryIndex === 0 && "opacity-0 pointer-events-none"
        )}
      >
        <ChevronLeft size={32} strokeWidth={1.5} />
      </button>

      <button 
        onClick={(e) => { e.stopPropagation(); nextStory(); }}
        className="hidden md:flex absolute right-4 lg:right-20 z-50 text-white/80 hover:text-white transition-all bg-white/10 p-3 rounded-full backdrop-blur-md"
      >
        <ChevronRight size={32} strokeWidth={1.5} />
      </button>

      <div 
        className="relative w-full h-full md:h-[90vh] md:max-w-[45vh] bg-black overflow-hidden md:rounded-lg shadow-2xl z-10"
        onClick={e => e.stopPropagation()}
      >
        <div 
          className="absolute top-2 left-2 right-2 z-50 flex px-1"
          style={{ gap: stories.length > 100 ? '1px' : (stories.length > 50 ? '2px' : '4px') }}
        >
          {stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-75"
                style={{ 
                  width: i < currentStoryIndex ? '100%' : (i === currentStoryIndex ? `${progress}%` : '0%') 
                }}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-6 left-4 right-4 z-50 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 p-0.5">
              <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {profilePic ? (
                  <img src={profilePic} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[10px] font-bold text-black uppercase">{story.username[0]}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{story.username}</span>
              <span className="text-[10px] opacity-60 font-medium">{format(parseISO(story.date), 'MMM d')}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {story.media[0].type === 'video' && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="w-full h-full flex items-center justify-center pointer-events-none">
          {story.media[0].type === 'video' ? (
            <video 
              ref={videoRef}
              src={story.media[0].url} 
              className="w-full h-full object-contain"
              autoPlay 
              muted={isMuted}
              playsInline
              controls
              onEnded={nextStory}
            />
          ) : (
            <img 
              src={story.media[0].url} 
              alt="" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        <div className="absolute inset-0 z-20 flex">
          <div className="w-1/4 h-full cursor-pointer" onClick={prevStory} title="Previous Story" />
          <div className="w-3/4 h-full cursor-pointer" onClick={nextStory} title="Next Story" />
        </div>

        {story.caption && (
          <div className="absolute bottom-16 left-4 right-4 z-50 bg-black/20 backdrop-blur-sm p-3 rounded-lg text-white text-xs text-center border border-white/10">
            {story.caption}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const thumbnailCache = new Map<string, string>();

const VideoThumbnail = ({ url, className }: { url: string; className?: string }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(thumbnailCache.get(url) || null);
  const [isInView, setIsInView] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thumbnail || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [thumbnail]);

  useEffect(() => {
    if (thumbnail || !isInView) return;

    const video = document.createElement('video');
    video.src = `${url}#t=0.1`;
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    const captureFrame = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          thumbnailCache.set(url, dataUrl);
          setThumbnail(dataUrl);
        }
      } catch (err) {
      } finally {
        cleanup();
      }
    };

    const handleLoadedMetadata = () => { video.currentTime = 0.1; };
    const handleSeeked = () => { captureFrame(); };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.src = ''; video.load();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', cleanup);

    const timeout = setTimeout(() => { if (!thumbnailCache.has(url)) cleanup(); }, 5000);
    return () => { clearTimeout(timeout); cleanup(); };
  }, [url, thumbnail, isInView]);

  if (!thumbnail) {
    return (
      <div ref={containerRef} className={cn("w-full h-full bg-gray-100 flex items-center justify-center", className)}>
        <Play size={20} className="text-gray-300" fill="currentColor" />
      </div>
    );
  }

  return (
    <img 
      src={thumbnail} 
      alt="" 
      className={cn("w-full h-full object-cover transition-transform duration-500 group-hover:scale-110", className)}
      referrerPolicy="no-referrer"
    />
  );
};

const MediaRenderer = ({ file, className, isFullView }: { file: MediaFile; className?: string; isFullView?: boolean }) => {
  const [isMuted, setIsMuted] = useState(false);
  const sizingClass = isFullView ? "w-full h-auto block" : "w-full h-full object-cover";
  const mediaStyle = { transform: 'translateZ(0)' };

  if (file.type === 'video') {
    return (
      <div className="relative w-full h-full flex items-center justify-center group/video">
        <video src={file.url} className={cn("transition-all duration-300", sizingClass, className)} style={mediaStyle} playsInline autoPlay muted={isMuted} loop controls />
        <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="absolute bottom-16 right-4 z-30 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md transition-all md:opacity-0 md:group-hover/video:opacity-100">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>
    );
  }
  return <img src={file.url} alt="" className={cn("transition-all duration-300", sizingClass, className)} style={mediaStyle} referrerPolicy="no-referrer" />;
};

const PostModal = ({ 
  post, onClose, onNextPost, onPrevPost, hasNextPost, hasPrevPost, profilePic
}: { 
  post: Post; onClose: () => void; onNextPost?: () => void; onPrevPost?: () => void; hasNextPost?: boolean; hasPrevPost?: boolean; profilePic: string | null;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  useEffect(() => setCurrentIndex(0), [post.id]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onNextPost?.();
      else if (e.key === 'ArrowLeft') onPrevPost?.();
      else if (e.key === '.') paginate(1);
      else if (e.key === ',') paginate(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNextPost, onPrevPost, currentIndex, post.media.length, onClose]);

  const paginate = (newDirection: number) => {
    const nextIndex = currentIndex + newDirection;
    if (nextIndex >= 0 && nextIndex < post.media.length) { setDirection(newDirection); setCurrentIndex(nextIndex); }
  };

  const variants = { enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%' }), center: { zIndex: 1, x: 0 }, exit: (d: number) => ({ zIndex: 0, x: d < 0 ? '100%' : '-100%' }) };
  const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center bg-[#0c1014]/95 md:bg-[#0c1014]/70 p-0 md:p-10 overflow-y-auto text-black" onClick={onClose}>
      <div className="min-h-full w-full flex items-center justify-center md:py-0">
        <button onClick={onClose} className="fixed top-4 right-4 text-white hover:text-gray-300 z-50 p-2 md:p-3 bg-black/20 rounded-full backdrop-blur-sm"><X size={24} className="md:w-8 md:h-8" /></button>
        {hasPrevPost && onPrevPost && <button onClick={(e) => { e.stopPropagation(); onPrevPost(); }} className="hidden md:block fixed left-4 md:left-10 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-50 transition-transform hover:scale-110 active:scale-90"><ChevronLeft size={48} strokeWidth={1.5} /></button>}
        {hasNextPost && onNextPost && <button onClick={(e) => { e.stopPropagation(); onNextPost(); }} className="hidden md:block fixed right-4 md:right-10 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-50 transition-transform hover:scale-110 active:scale-90"><ChevronRight size={48} strokeWidth={1.5} /></button>}
        <motion.div drag="y" dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.15} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 200 || velocity.y > 800) onClose(); }} className="bg-black flex flex-col md:flex-row w-full max-w-6xl h-auto md:rounded-sm overflow-hidden shadow-2xl relative text-black" onClick={e => e.stopPropagation()}>
          <div className="relative bg-black flex items-center justify-center group overflow-hidden w-full h-auto">
            <div className="w-full grid grid-cols-1 grid-rows-1">
              <AnimatePresence initial={false} custom={direction}>
                <motion.div key={`${post.id}-${currentIndex}`} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ x: { type: "spring", stiffness: 300, damping: 30 } }} drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={0.5} onDragEnd={(e, { offset, velocity }) => {
                  const s = swipePower(offset.x, velocity.x);
                  if (s < -15000) { if (currentIndex < post.media.length - 1) paginate(1); else if (hasNextPost && onNextPost && s < -40000) onNextPost(); }
                  else if (s > 15000) { if (currentIndex > 0) paginate(-1); else if (hasPrevPost && onPrevPost && s > 40000) onPrevPost(); }
                }} className="col-start-1 row-start-1 w-full flex items-center justify-center cursor-grab active:cursor-grabbing relative">
                  <MediaRenderer file={post.media[currentIndex]} isFullView={true} />
                </motion.div>
              </AnimatePresence>
            </div>
            {post.media.length > 1 && (
              <>
                {currentIndex > 0 && <button onClick={(e) => { e.stopPropagation(); paginate(-1); }} className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-30"><ChevronLeft size={24} /></button>}
                {currentIndex < post.media.length - 1 && <button onClick={(e) => { e.stopPropagation(); paginate(1); }} className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-30"><ChevronRight size={24} /></button>}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">{post.media.map((_, i) => <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === currentIndex ? "bg-blue-500 scale-125" : "bg-white/40 shadow-sm")} />)}</div>
              </>
            )}
          </div>
          <div className="w-full md:w-96 bg-white flex flex-col border-l border-gray-200 overflow-hidden shrink-0">
            <div className="p-3 md:p-4 border-b border-gray-100 flex items-center justify-between shrink-0 text-black">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-0.5"><div className="w-full h-full rounded-full bg-white p-0.5"><div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center overflow-hidden text-[10px] font-bold uppercase">{profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{post.username[0]}</span>}</div></div></div>
                <span className="font-semibold text-sm">{post.username}</span>
              </div>
              <MoreHorizontal size={20} className="text-gray-500" />
            </div>
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 min-h-0 md:max-h-[60vh] text-black">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-[10px] font-bold uppercase overflow-hidden">{profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{post.username[0]}</span>}</div>
                <div className="text-sm"><span className="font-semibold mr-2">{post.username}</span><span className="whitespace-pre-wrap">{post.caption}</span><div className="mt-2 text-xs text-gray-500 uppercase tracking-tight">{format(parseISO(post.date), 'MMMM d, yyyy')}</div></div>
              </div>
            </div>
            <div className="p-3 md:p-4 border-t border-gray-100 space-y-3 shrink-0 bg-white text-black">
              <div className="flex items-center justify-between"><div className="flex items-center gap-4"><Heart size={24} className="hover:text-gray-500 cursor-pointer" /><MessageCircle size={24} className="hover:text-gray-500 cursor-pointer" /><Play size={24} className="hover:text-gray-500 cursor-pointer" /></div><Bookmark size={24} className="hover:text-gray-500 cursor-pointer" /></div>
              <div className="text-sm flex items-center gap-2 text-black"><span className="font-semibold text-black">Archived Post</span><span className="text-gray-400 font-normal text-xs">{post.id}</span></div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allStories, setAllStories] = useState<Post[]>([]);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [visiblePostsCount, setVisiblePostsCount] = useState(90);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [username, setUsername] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [externalUrl, setExternalUrl] = useState<string>('');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [allProfilePics, setAllProfilePics] = useState<string[]>([]);
  const [gridAspectRatio, setGridAspectRatio] = useState<'1:1' | '3:4'>('1:1');
  const [gridOffset, setGridOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [serverArchives, setServerArchives] = useState<ServerArchive[]>([]);
  const [cachedArchives, setCachedArchives] = useState<Set<string>>(new Set());
  const [isServerMode, setIsServerMode] = useState(false);
  const [currentArchive, setCurrentArchive] = useState<ServerArchive | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [scannedFilesLog, setScannedFilesLog] = useState<string[]>([]);
  const [scanningPhase, setScanningPhase] = useState<'Indexing' | 'Parsing' | ''>('');
  const [currentScanningImage, setCurrentScanningImage] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const profilePicInputRef = React.useRef<HTMLInputElement>(null);

  const refreshCachedArchives = useCallback(async () => {
    try {
      const keys = await idb.keys();
      setCachedArchives(new Set(keys.map(String)));
    } catch (e) {}
  }, []);

  const clearCache = async (name: string) => { await idb.del(name); await refreshCachedArchives(); };
  const resetProfileState = useCallback(() => { setUsername(''); setFullName(''); setBio(''); setFollowerCount(0); setFollowingCount(0); setExternalUrl(''); setProfilePic(null); setAllProfilePics([]); }, []);

  useEffect(() => {
    fetch('/api/archives').then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) { setServerArchives(data); setIsServerMode(true); } }).catch(() => setIsServerMode(false));
    refreshCachedArchives();
  }, [refreshCachedArchives]);

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
    if (file) { const url = URL.createObjectURL(file); setProfilePic(url); setAllProfilePics(prev => [url, ...prev]); }
  };

  const cycleProfilePic = () => { if (allProfilePics.length > 1) { const idx = allProfilePics.indexOf(profilePic || ''); setProfilePic(allProfilePics[(idx + 1) % allProfilePics.length]); } };

  const handleFiles = async (files: ArchiveFile[], archiveContext?: ServerArchive) => {
    if (!files || files.length === 0) return;
    setIsScanning(true); resetProfileState(); setScanningPhase('Indexing'); setScannedCount(0); setTotalFiles(files.length); setScannedFilesLog([]); setGridOffset(0);
    await new Promise(resolve => setTimeout(resolve, 100));

    const parseXZFile = async (file: ArchiveFile) => {
      try {
        const stream = new XzReadableStream(file.stream());
        const response = new Response(stream);
        return await response.json();
      } catch (e) { return null; }
    };

    let lastImageUpdateTime = 0;
    const throttledSetScanningImage = (url: string) => {
      const now = Date.now();
      if (now - lastImageUpdateTime > 1000) {
        setCurrentScanningImage(url);
        lastImageUpdateTime = now;
      }
    };

    try {
      const postsMap = new Map<string, Partial<Post>>();
      const mediaFilesMap = new Map<string, ArchiveFile>();
      const discoveredProfilePics: { name: string, url: string }[] = [];
      
      // Local metadata tracking to avoid stale React state in the cache object
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

      let detectedUsername = archiveContext?.name || currentArchive?.name || '';
      if (detectedUsername) setUsername(detectedUsername);

      let format: 'export' | 'instaloader' | 'json' | 'unknown' = 'unknown';
      let jsonFiles: ArchiveFile[] = [];

      let i = 0;
      for (const file of files) {
        i++; if (i % 50 === 0 || i === files.length) { setScannedCount(i); setScannedFilesLog(prev => [`Indexed ${file.name}`, ...prev.slice(0, 19)]); }
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.json') || lowerName.endsWith('.json.xz')) {
          jsonFiles.push(file);
          if (lowerName.includes('posts_1') || lowerName.includes('reels_1') || lowerName.includes('stories_1')) format = 'json';
          else if (format === 'unknown' && (lowerName.includes('story') || lowerName.includes('post'))) format = 'json';
          continue;
        }
        if (lowerName.includes('_profile_pic.jpg')) {
          const url = file.url || URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: 'image/jpeg' }));
          discoveredProfilePics.push({ name: file.name, url });
          if (!detectedUsername && file.webkitRelativePath) {
            const parts = file.webkitRelativePath.split(/[/\\]/);
            if (parts.length > 1) { detectedUsername = parts[0]; setUsername(detectedUsername); }
          }
          if (format === 'unknown') format = 'instaloader';
          continue;
        }
        const exportMatch = file.name.match(exportRegex);
        if (exportMatch) {
          if (!detectedUsername || detectedUsername === currentArchive?.name) { detectedUsername = exportMatch[2]; setUsername(detectedUsername); }
          format = 'export';
        }
        const loaderMatch = file.name.match(instaloaderRegex);
        if (loaderMatch && format === 'unknown') format = 'instaloader';
        if (['jpg', 'jpeg', 'png', 'webp', 'mp4'].some(ext => lowerName.endsWith(ext))) {
          mediaFilesMap.set(file.webkitRelativePath || file.name, file);
        }
      }

      if (format === 'json' || format === 'instaloader') {
        setScanningPhase('Parsing'); setTotalFiles(jsonFiles.length);
        let filesProcessed = 0;
        for (const jsonFile of jsonFiles) {
          filesProcessed++;
          try {
            const data = jsonFile.name.endsWith('.xz') ? await parseXZFile(jsonFile) : JSON.parse(await jsonFile.text());
            if (!data) continue;
            const items = Array.isArray(data) ? data : (data.media || [data]);
            const isStoriesFile = jsonFile.name.toLowerCase().includes('stories');
            if (jsonFiles.length === 1) setTotalFiles(items.length);
            else { setScannedCount(filesProcessed); setScannedFilesLog(prev => [`Parsing ${jsonFile.name}`, ...prev.slice(0, 19)]); }

            if (data.node && (data.instaloader?.node_type === 'Profile' || data.node.__typename === 'User')) {
              const node = data.node; const iphone = node.iphone_struct || {};
              localFullName = node.full_name || '';
              localBio = node.biography || iphone.biography || '';
              localExternalUrl = node.external_url || '';
              localFollowerCount = node.edge_followed_by?.count || iphone.follower_count || 0;
              localFollowingCount = node.edge_follow?.count || iphone.following_count || 0;
              
              setFullName(localFullName); setBio(localBio); setExternalUrl(localExternalUrl);
              setFollowerCount(localFollowerCount); setFollowingCount(localFollowingCount);
              if (!Array.isArray(data)) continue;
            }

            for (const [idx, item] of items.entries()) {
              if (jsonFiles.length === 1 && (idx % 10 === 0 || idx === items.length - 1)) {
                setScannedCount(idx + 1); setScannedFilesLog(prev => [`Parsing metadata for ${item.id || item.node?.id || 'item'}`, ...prev.slice(0, 19)]);
              }
              const mediaList = item.media || [item];
              const postId = item.node?.id || item.id || item.title || `post_${idx}_${Date.now()}`;
              const date = item.creation_timestamp ? new Date(item.creation_timestamp * 1000).toISOString().split('T')[0] : (item.node?.taken_at_timestamp ? new Date(item.node.taken_at_timestamp * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
              const isStory = isStoriesFile || checkIsStory(item) || checkIsStory(item.node) || checkIsStory(data.instaloader) || checkIsStory(item.node?.iphone_struct) || checkIsStory(item.iphone_struct) || (item.media && Array.isArray(item.media) && item.media.some((m: any) => checkIsStory(m)));
              const post: Partial<Post> = { id: postId, date, username: detectedUsername || 'archived_user', caption: item.title || item.node?.edge_media_to_caption?.edges?.[0]?.node?.text || item.node?.caption?.text || '', media: [], isStory };

              for (const [mIdx, m] of mediaList.entries()) {
                const uri = m.uri; let matchedFile: ArchiveFile | undefined;
                if (uri) { for (const [path, f] of mediaFilesMap.entries()) { if (path.endsWith(uri) || uri.endsWith(path)) { matchedFile = f; break; } } }
                if (!matchedFile) { const id = item.node?.id || item.id; if (id) { for (const [path, f] of mediaFilesMap.entries()) { if (f.name.includes(id)) { matchedFile = f; break; } } } }
                if (!matchedFile) { const jsonBase = jsonFile.name.substring(0, jsonFile.name.lastIndexOf('.')); for (const ext of ['mp4', 'jpg', 'jpeg', 'png', 'webp']) { const possibleName = `${jsonBase}.${ext}`; for (const [path, f] of mediaFilesMap.entries()) { if (f.name.toLowerCase() === possibleName.toLowerCase()) { matchedFile = f; break; } } if (matchedFile) break; } }

                if (matchedFile) {
                  const type = matchedFile.name.toLowerCase().endsWith('mp4') ? 'video' : 'image';
                  const url = matchedFile.url || URL.createObjectURL(new Blob([await matchedFile.arrayBuffer()], { type: type === 'video' ? 'video/mp4' : 'image/jpeg' }));
                  const existingMedia = post.media!.find(media => media.index === mIdx + 1);
                  if (existingMedia) { if (type === 'video' && existingMedia.type === 'image') post.media = post.media!.map(media => media.index === mIdx + 1 ? { name: matchedFile!.name, url, type, index: mIdx + 1 } : media); }
                  else post.media!.push({ name: matchedFile.name, url, type, index: mIdx + 1 });
                }
              }
              if (post.media!.length > 0) postsMap.set(postId, post);
            }
          } catch (e) {}
        }
      } 
      
      if (format !== 'json') {
        setScanningPhase('Parsing'); setScannedCount(0); setTotalFiles(files.length);
        const CHUNK_SIZE = 100;
        for (let j_start = 0; j_start < files.length; j_start += CHUNK_SIZE) {
          const end = Math.min(j_start + CHUNK_SIZE, files.length);
          setScannedCount(j_start); setScannedFilesLog(prev => [`Processing batch ${Math.floor(j_start/CHUNK_SIZE) + 1}...`, ...prev.slice(0, 19)]);
          for (let j = j_start; j < end; j++) {
            const file = files[j]; const lowerName = file.name.toLowerCase();
            if (detectedUsername && lowerName === `${detectedUsername.toLowerCase()}.jpg`) {
              const url = file.url || URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: 'image/jpeg' }));
              if (!discoveredProfilePics.some(p => p.name === file.name)) discoveredProfilePics.push({ name: file.name, url });
              continue;
            }
            let postId = '', date = '', user = detectedUsername || 'archived_user', index = 1, ext = '', isStory = lowerName.includes('story') || file.webkitRelativePath.toLowerCase().includes('stories');
            if (format === 'export') {
              const match = file.name.match(exportRegex);
              if (!match) continue;
              const [_, dMatch, uMatch, pMatch, iStrMatch, sMatch, eMatch] = match;
              date = dMatch; user = uMatch; postId = pMatch; index = iStrMatch ? parseInt(iStrMatch, 10) : 1; if (sMatch) isStory = true; ext = eMatch;
            } else if (format === 'instaloader') {
              const match = file.name.match(instaloaderRegex);
              if (!match) continue;
              const [_, pMatch, iStrMatch, sMatch, eMatch] = match;
              postId = pMatch; date = pMatch.split('_')[0]; index = iStrMatch ? parseInt(iStrMatch, 10) : 1; if (sMatch) isStory = true; ext = eMatch;
            } else continue;

            let post = postsMap.get(postId);
            if (!post) { post = { id: postId, date, username: user, caption: '', media: [], isStory }; postsMap.set(postId, post); }
            else if (isStory) post.isStory = true;

            const lowerExt = ext.toLowerCase();
            if (lowerExt === 'txt') post.caption = await file.text();
            else if (lowerExt === 'json' || lowerName.endsWith('.json.xz')) {
              try {
                const data = lowerName.endsWith('.xz') ? await parseXZFile(file) : JSON.parse(await file.text());
                if (!data) continue;
                const node = data.node || data; const iphone = node.iphone_struct || {};
                if (node.edge_media_to_caption?.edges?.[0]?.node?.text) post.caption = node.edge_media_to_caption.edges[0].node.text;
                else if (node.caption?.text) post.caption = node.caption.text;
                else if (iphone.caption?.text) post.caption = iphone.caption.text;
                if (checkIsStory(data) || checkIsStory(node) || checkIsStory(data.instaloader) || checkIsStory(iphone)) post.isStory = true;
                if (data.node && (data.instaloader?.node_type === 'Profile' || data.node.__typename === 'User')) {
                  const n = data.node; const iph = n.iphone_struct || {};
                  localFullName = n.full_name || '';
                  localBio = n.biography || iph.biography || '';
                  localExternalUrl = n.external_url || '';
                  localFollowerCount = n.edge_followed_by?.count || iph.follower_count || 0;
                  localFollowingCount = n.edge_follow?.count || iph.following_count || 0;
                  
                  setFullName(localFullName); setBio(localBio); setExternalUrl(localExternalUrl);
                  setFollowerCount(localFollowerCount); setFollowingCount(localFollowingCount);
                }
              } catch (e) {}
            } else if (['jpg', 'jpeg', 'png', 'webp', 'mp4'].includes(lowerExt)) {
              const type = lowerExt === 'mp4' ? 'video' : 'image';
              const url = file.url || URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: type === 'video' ? 'video/mp4' : 'image/jpeg' }));
              if (type === 'image') throttledSetScanningImage(url);
              const existingMedia = post.media!.find(m => m.index === index);
              if (existingMedia) { if (type === 'video' && existingMedia.type === 'image') post.media = post.media!.map(m => m.index === index ? { name: file.name, url, type, index } : m); }
              else post.media!.push({ name: file.name, url, type, index });
            }
          }
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      if (discoveredProfilePics.length > 0) {
        discoveredProfilePics.sort((a, b) => b.name.localeCompare(a.name));
        const urls = discoveredProfilePics.map(p => p.url);
        setAllProfilePics(urls); 
        localProfilePic = urls[0];
        setProfilePic(localProfilePic);
      }

      const finalUsername = detectedUsername || 'archived_user';
      const allItems = Array.from(postsMap.values()).filter(p => p.media && p.media.length > 0).map(p => {
        const sortedMedia = p.media!.sort((a, b) => a.index - b.index);
        return { ...p, username: (p.username === 'archived_user' || !p.username) ? finalUsername : p.username, media: sortedMedia, thumbnail: sortedMedia[0].url } as Post;
      });

      const posts = allItems.filter(p => !p.isStory).sort((a, b) => b.date.localeCompare(a.date));
      const stories = allItems.filter(p => p.isStory).sort((a, b) => a.date.localeCompare(b.date));

      setAllPosts(posts); setAllStories(stories); setVisiblePostsCount(90);
      console.log(`[Scanner] Finalized ${posts.length} posts and ${stories.length} stories.`);

      const archiveToCache = archiveContext || currentArchive;
      if (archiveToCache) {
        if (posts.length === 0 && stories.length === 0) {
          console.warn(`[Cache] Skipping cache save for ${archiveToCache.name} because no items were found.`);
          return;
        }
        
        console.log(`[Cache] Saving data for ${archiveToCache.name} to persistent storage...`);
        const cacheData = { 
          name: archiveToCache.name, 
          fileCount: archiveToCache.fileCount, 
          posts, 
          stories, 
          profileMetadata: { 
            username: finalUsername, 
            fullName: localFullName, 
            bio: localBio, 
            followerCount: localFollowerCount, 
            followingCount: localFollowingCount, 
            externalUrl: localExternalUrl, 
            profilePic: localProfilePic 
          }, 
          allProfilePics: discoveredProfilePics.map(p => p.url), 
          timestamp: Date.now() 
        };
        try {
          await idb.set(archiveToCache.name, cacheData);
          console.log(`[Cache] Data for ${archiveToCache.name} saved successfully.`);
          await refreshCachedArchives();
        } catch (e) {
          console.error(`[Cache] Failed to save to IndexedDB:`, e);
        }
      }
    } catch (err) {
      console.error(`[Scanner] Critical error during scan:`, err);
    } finally { setIsScanning(false); }
  };

  const loadServerArchive = async (archive: ServerArchive) => {
    console.log(`[Cache] Attempting to load archive: ${archive.name}`);
    setIsScanning(true);
    setCurrentArchive(archive);
    setCurrentScanningImage(null);
    setScanningPhase('Checking Cache');
    
    try {
      const cachedData = await idb.get(archive.name);
      if (cachedData) {
        console.log(`[Cache] Found cached data for ${archive.name}. File count: ${cachedData.fileCount} (Server has: ${archive.fileCount})`);
        if (cachedData.fileCount === archive.fileCount) {
          console.log(`[Cache] Cache hit! Restoring state...`);
          setAllPosts(cachedData.posts);
          setAllStories(cachedData.stories);
          setUsername(cachedData.profileMetadata.username);
          setFullName(cachedData.profileMetadata.fullName);
          setBio(cachedData.profileMetadata.bio);
          setFollowerCount(cachedData.profileMetadata.followerCount);
          setFollowingCount(cachedData.profileMetadata.followingCount);
          setExternalUrl(cachedData.profileMetadata.externalUrl);
          setProfilePic(cachedData.profileMetadata.profilePic);
          setAllProfilePics(cachedData.allProfilePics);
          setVisiblePostsCount(90);
          setIsScanning(false);
          console.log(`[Cache] Archive ${archive.name} loaded successfully from cache.`);
          return;
        } else {
          console.log(`[Cache] Cache mismatch (file count changed). Proceeding with fresh scan.`);
        }
      } else {
        console.log(`[Cache] No cached data found for ${archive.name}.`);
      }

      console.log(`[Scanner] Starting fresh scan from server API...`);
      const res = await fetch(`/api/archives/${archive.name}/files`);
      const filePaths: string[] = await res.json();
      console.log(`[Scanner] Server reported ${filePaths.length} files.`);
      
      const archiveFiles = filePaths.map(p => {
        const name = p.split(/[/\\]/).pop() || p;
        return new RemoteArchiveFile(name, p, 0, `/archives/${archive.name}/${p}`);
      });

      await handleFiles(archiveFiles, archive);
    } catch (err) {
      console.error('[Scanner] Failed to load server archive:', err);
      setIsScanning(false);
    }
  };

  const handleLocalFiles = (files: FileList | null) => { if (!files) return; const archiveFiles = Array.from(files).map(f => new LocalArchiveFile(f)); handleFiles(archiveFiles); };
  const triggerFileSelect = () => fileInputRef.current?.click();
  const loadMore = () => setVisiblePostsCount(prev => prev + 90);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <input type="file" ref={fileInputRef} className="hidden" webkitdirectory="" multiple onChange={(e) => handleLocalFiles(e.target.files)} />

      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 h-16 flex items-center px-4 md:px-8">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold tracking-tight italic font-serif cursor-pointer text-black/80" onClick={() => { setAllPosts([]); setAllStories([]); setCurrentArchive(null); resetProfileState(); }}>InstaArchive</h1>
          <div className="flex items-center gap-2 md:gap-8 text-black">
            {allPosts.length > 0 && activeTab === 'posts' && (
              <div className="flex items-center gap-2 md:gap-6">
                <div className="flex items-center gap-1.5 md:gap-2"><span className="hidden sm:inline text-[10px] font-bold uppercase text-gray-400 tracking-wider">Bump:</span>
                  <div className="flex bg-gray-100 p-0.5 md:p-1 rounded-lg">{[0, 1, 2].map((offset) => (<button key={offset} onClick={() => setGridOffset(offset)} className={cn("px-2 md:px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all", gridOffset === offset ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-gray-700")}>{offset}</button>))}</div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2"><span className="hidden sm:inline text-[10px] font-bold uppercase text-gray-400 tracking-wider">Grid:</span>
                  <div className="flex bg-gray-100 p-0.5 md:p-1 rounded-lg"><button onClick={() => setGridAspectRatio('1:1')} className={cn("px-2 md:px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all", gridAspectRatio === '1:1' ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-gray-700")}>1:1</button><button onClick={() => setGridAspectRatio('3:4')} className={cn("px-2 md:px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all", gridAspectRatio === '3:4' ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-gray-700")}>3:4</button></div>
                </div>
              </div>
            )}
            <button onClick={() => { if (allPosts.length > 0) { setAllPosts([]); setAllStories([]); setCurrentArchive(null); resetProfileState(); } else { triggerFileSelect(); } }} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"><FolderOpen size={18} /><span className="hidden sm:inline">{allPosts.length > 0 ? 'Exit Archive' : 'Load Archive'}</span><span className="sm:hidden">{allPosts.length > 0 ? 'Exit' : 'Load'}</span></button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 text-black">
        {allPosts.length === 0 && !isScanning ? (
          isServerMode ? (
            <ArchiveDashboard archives={serverArchives} cachedArchives={cachedArchives} onSelect={loadServerArchive} onLocalSelect={triggerFileSelect} onClearCache={clearCache} isScanning={isScanning} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400"><Grid3X3 size={48} strokeWidth={1} /></div>
              <div className="space-y-2"><h2 className="text-2xl font-semibold text-black/80">No Archive Selected</h2><p className="text-gray-500 max-md text-sm md:text-base">Select a local archive folder to start browsing. Your files are processed locally in the browser and never uploaded.</p></div>
              <button onClick={triggerFileSelect} disabled={isScanning} className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">{isScanning ? <><Loader2 className="animate-spin" size={20} /><span className="animate-dots">Scanning</span></> : 'Select Local Archive Folder'}</button>
            </div>
          )
        ) : isScanning ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
            <AnimatePresence>{currentScanningImage && (<motion.div key={currentScanningImage} initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0"><img src={currentScanningImage} alt="" className="w-full h-full object-cover blur-[100px] scale-110" /></motion.div>)}</AnimatePresence>
            <div className="absolute inset-0 bg-white/20 z-1" />
            <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center gap-8">
              <div className="text-center space-y-2"><div className="text-4xl font-bold tracking-tight italic font-serif text-black/80 drop-shadow-sm">Scanning Archive...</div><div className="flex items-center justify-center gap-3"><div className="h-[1px] w-12 bg-black/10" /><p className="text-black/40 text-[10px] uppercase tracking-[0.3em] font-bold">{scanningPhase === 'Indexing' ? 'Building file index' : 'Parsing metadata & media'}</p><div className="h-[1px] w-12 bg-black/10" /></div></div>
              <div className="w-full max-w-2xl space-y-4"><div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-black/40 px-1"><span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" />Phase: {scanningPhase}</span><span>{scannedCount} / {totalFiles}</span></div><div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden backdrop-blur-sm border border-black/5 shadow-inner"><motion.div className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" initial={{ width: 0 }} animate={{ width: `${(scannedCount / (totalFiles || 1)) * 100}%` }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} /></div></div>
              <div className="w-full bg-white/40 backdrop-blur-3xl rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-white/40 overflow-hidden h-[500px] flex flex-col text-black"><div className="flex items-center justify-between border-b border-black/5 py-3 px-5 bg-white/20 shrink-0"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-black/10" /><div className="w-2.5 h-2.5 rounded-full bg-black/10" /><div className="w-2.5 h-2.5 rounded-full bg-black/10" /><span className="ml-3 text-black/30 uppercase tracking-[0.2em] text-[9px] font-bold">System Parser Feed</span></div><div className="text-[9px] font-bold text-black/20 uppercase tracking-widest">Live Output</div></div><div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide p-4">{scannedFilesLog.map((log, idx) => (<div key={`${idx}-${log}`} className="flex gap-4 leading-tight text-[11px] md:text-[12px] font-medium"><span className="text-black/20 shrink-0 tabular-nums">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span><span className={cn("shrink-0 px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold tracking-wider", scanningPhase === 'Indexing' ? "bg-green-500/10 text-green-600/70" : "bg-blue-500/10 text-blue-600/70")}>{scanningPhase === 'Indexing' ? 'IDX' : 'PARSE'}</span><span className="truncate text-black/60">{log}</span></div>))}{scannedFilesLog.length === 0 && <div className="animate-pulse text-black/20 font-mono text-center mt-20 italic">Initializing scanner context...</div>}</div></div>
            </div>
          </div>
        ) : (
          <div className="space-y-12 text-black">
            <header className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-20 px-4">
              <div className={cn("w-24 h-24 md:w-36 md:h-36 rounded-full p-1 cursor-pointer transition-transform active:scale-95", allStories.length > 0 ? "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600" : "bg-gray-200" )} onClick={() => allStories.length > 0 && setShowStoryViewer(true)}><div className="w-full h-full rounded-full bg-white p-1"><div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">{profilePic ? <img src={profilePic} alt={username} className="w-full h-full object-cover" onError={() => setProfilePic(null)} referrerPolicy="no-referrer" /> : <span className="text-3xl font-bold text-gray-400 uppercase">{username[0]}</span>}</div></div></div>
              <div className="flex-1 space-y-6 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <h2 className="text-2xl font-light tracking-wide">{username}</h2>
                  <div className="flex gap-2">
                    <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                    {allProfilePics.length === 0 && <button onClick={() => profilePicInputRef.current?.click()} className="bg-gray-100 hover:bg-gray-200 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">Set Profile Picture</button>}
                    {allProfilePics.length > 1 && <button onClick={cycleProfilePic} className="bg-gray-100 hover:bg-gray-200 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"><Layers size={16} />Next Profile Pic</button>}
                  </div>
                </div>
                <div className="flex justify-center md:justify-start gap-10 text-sm md:text-base"><div><span className="font-semibold text-black/80">{allPosts.length}</span> posts</div><div><span className="font-semibold text-black/80">{followerCount.toLocaleString()}</span> followers</div><div><span className="font-semibold text-black/80">{followingCount.toLocaleString()}</span> following</div></div>
                <div className="space-y-1 text-black/80"><div className="font-semibold">{fullName || `@${username}`}</div><div className="text-gray-600 whitespace-pre-wrap max-w-sm mx-auto md:mx-0 text-sm md:text-base">{bio || 'Archived profile viewer for local files.'}</div>{externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-900 font-semibold text-sm block hover:underline truncate max-w-[250px]">{externalUrl.replace(/^https?:\/\/(www\.)?/, '')}</a>}</div>
              </div>
            </header>

            <div className="border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex justify-center gap-12 flex-1">
                <button onClick={() => handleTabChange('posts')} className={cn("flex items-center gap-2 py-4 border-t text-xs font-bold tracking-widest uppercase transition-all", activeTab === 'posts' ? "border-black text-black" : "border-transparent text-gray-400")}><Grid3X3 size={14} />Posts</button>
                <button onClick={() => handleTabChange('reels')} className={cn("flex items-center gap-2 py-4 border-t text-xs font-bold tracking-widest uppercase transition-all", activeTab === 'reels' ? "border-black text-black" : "border-transparent text-gray-400")}><Play size={14} />Reels</button>
                <button onClick={() => handleTabChange('saved')} className={cn("flex items-center gap-2 py-4 border-t text-xs font-bold tracking-widest uppercase transition-all", activeTab === 'saved' ? "border-black text-black" : "border-transparent text-gray-400")}><Bookmark size={14} />Saved</button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-[2px] md:gap-[2px]">
              {activeTab === 'posts' && Array.from({ length: gridOffset }).map((_, i) => (<div key={`blank-${i}`} className={cn("bg-gray-100/50 border border-dashed border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-300 uppercase tracking-tighter", gridAspectRatio === '1:1' ? "aspect-square" : "aspect-[3/4]")}>Blank</div>))}
              {visiblePosts.map((post) => (
                <motion.div key={post.id} layoutId={post.id} onClick={() => setSelectedPost(post)} className={cn("relative group cursor-pointer overflow-hidden bg-gray-200 transition-all duration-300", activeTab === 'reels' ? "aspect-[9/16]" : (gridAspectRatio === '1:1' ? "aspect-square" : "aspect-[3/4]"))}>
                  {post.media[0].type === 'video' ? <VideoThumbnail url={post.media[0].url} /> : <img src={post.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />}
                  <div className="absolute top-2 right-2 flex gap-1.5 z-10">{post.media.length > 1 && <div className="bg-black/40 backdrop-blur-md p-1 rounded-md text-white shadow-sm"><Layers size={16} /></div>}{post.media.some(m => m.type === 'video') && <div className="bg-black/40 backdrop-blur-md p-1 rounded-md text-white shadow-sm"><Play size={16} fill="white" /></div>}</div>
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold z-20 text-black"><div className="flex items-center gap-2"><Heart fill="white" size={20} /><span>-</span></div><div className="flex items-center gap-2"><MessageCircle fill="white" size={20} /><span>-</span></div></div>
                </motion.div>
              ))}
            </div>
            {filteredPosts.length > visiblePostsCount && <div className="flex justify-center pt-12"><button onClick={loadMore} className="bg-white border border-gray-200 px-8 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-sm text-black">Load More</button></div>}
          </div>
        )}
      </main>

      <AnimatePresence>{selectedPost && <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} onNextPost={onNextPost} onPrevPost={onPrevPost} hasNextPost={postIndex < filteredPosts.length - 1} hasPrevPost={postIndex > 0} profilePic={profilePic} />}</AnimatePresence>
      <AnimatePresence>{showStoryViewer && allStories.length > 0 && <StoryViewer stories={allStories} onClose={() => setShowStoryViewer(false)} profilePic={profilePic} />}</AnimatePresence>

      {!isScanning && (
        <footer className="max-w-5xl mx-auto px-4 py-12 text-center text-xs text-gray-400 space-y-4">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 uppercase tracking-tight"><span>Meta</span><span>About</span><span>Blog</span><span>Jobs</span><span>Help</span><span>API</span><span>Privacy</span><span>Terms</span><span>Locations</span><span>Instagram Lite</span><span>Threads</span><span>Contact Uploading & Non-Users</span><span>Meta Verified</span></div>
          <div className="text-black/40">© 2026 InstaArchive Viewer</div>
        </footer>
      )}
    </div>
  );
}
