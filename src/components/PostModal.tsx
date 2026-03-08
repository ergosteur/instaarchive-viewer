import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  MoreHorizontal, 
  Heart, 
  MessageCircle, 
  Play, 
  Bookmark 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { Post } from '../types';
import { cn } from '../lib/utils';
import { MediaRenderer } from './MediaRenderer';

interface PostModalProps {
  post: Post;
  onClose: () => void;
  onNextPost?: () => void;
  onPrevPost?: () => void;
  hasNextPost?: boolean;
  hasPrevPost?: boolean;
  profilePic: string | null;
}

export const PostModal: React.FC<PostModalProps> = ({ 
  post, onClose, onNextPost, onPrevPost, hasNextPost, hasPrevPost, profilePic
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // Preloading Logic
  useEffect(() => {
    const controller = new AbortController();
    const preloadMedia = async (index: number) => {
      if (index < 0 || index >= post.media.length) return;
      const media = post.media[index];
      if (!media.url) return;
      
      try {
        if (media.type === 'image') {
          const img = new Image();
          img.src = media.url;
        } else {
          const video = document.createElement('video');
          video.src = media.url;
          video.preload = 'auto';
        }
      } catch (e) {}
    };

    // 1. Immediate preload of first two slides
    preloadMedia(0);
    preloadMedia(1);

    // 2. Delayed preload of the rest to stay out of the way of initial render
    const timeout = setTimeout(() => {
      for (let i = 2; i < post.media.length; i++) {
        if (controller.signal.aborted) break;
        preloadMedia(i);
      }
    }, 1000);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [post.id, post.media]);

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

  const variants = { 
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 1, zIndex: 0 }), 
    center: { zIndex: 1, x: 0, opacity: 1 }, 
    exit: (d: number) => ({ zIndex: 0, x: d < 0 ? '100%' : '-100%', opacity: 1 }) 
  };
  const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center bg-[#0c1014]/95 md:bg-[#0c1014]/70 p-0 md:p-10 overflow-y-auto text-black" onClick={onClose}>
      <div className="min-h-full w-full flex items-center justify-center md:py-0">
        <button onClick={onClose} className="fixed top-4 right-4 text-white hover:text-gray-300 z-50 p-2 md:p-3 bg-black/20 rounded-full backdrop-blur-sm"><X size={24} className="md:w-8 md:h-8" /></button>
        {hasPrevPost && onPrevPost && <button onClick={(e) => { e.stopPropagation(); onPrevPost(); }} className="hidden md:block fixed left-4 md:left-10 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-50 transition-transform hover:scale-110 active:scale-90"><ChevronLeft size={48} strokeWidth={1.5} /></button>}
        {hasNextPost && onNextPost && <button onClick={(e) => { e.stopPropagation(); onNextPost(); }} className="hidden md:block fixed right-4 md:right-10 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-50 transition-transform hover:scale-110 active:scale-90"><ChevronRight size={48} strokeWidth={1.5} /></button>}
        <motion.div drag="y" dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.15} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 200 || velocity.y > 800) onClose(); }} className="bg-black flex flex-col md:flex-row w-full max-w-6xl h-auto md:rounded-sm overflow-hidden shadow-2xl relative text-black" onClick={e => e.stopPropagation()}>
          <div className="relative bg-black flex items-center justify-center group overflow-hidden w-full h-auto text-black">
            <div className="w-full grid grid-cols-1 grid-rows-1 text-black">
              <AnimatePresence initial={false} custom={direction}>
                <motion.div 
                  key={`${post.id}-${currentIndex}`} 
                  custom={direction} 
                  variants={variants} 
                  initial="enter" 
                  animate="center" 
                  exit="exit" 
                  transition={{ x: { type: "spring", stiffness: 200, damping: 26, bounce: 0 } }} 
                  drag="x" 
                  dragDirectionLock 
                  dragConstraints={{ left: 0, right: 0 }} 
                  dragElastic={0.5} 
                  onDragEnd={(e, { offset, velocity }) => {
                    const s = swipePower(offset.x, velocity.x);
                    if (s < -15000) { if (currentIndex < post.media.length - 1) paginate(1); else if (hasNextPost && onNextPost && s < -40000) onNextPost(); }
                    else if (s > 15000) { if (currentIndex > 0) paginate(-1); else if (hasPrevPost && onPrevPost && s > 40000) onPrevPost(); }
                  }} 
                  className="col-start-1 row-start-1 w-full flex items-center justify-center cursor-grab active:cursor-grabbing relative text-black"
                >
                  <MediaRenderer file={post.media[currentIndex]} isFullView={true} />
                </motion.div>
              </AnimatePresence>
            </div>
            {post.media.length > 1 && (
              <>
                {currentIndex > 0 && <button onClick={(e) => { e.stopPropagation(); paginate(-1); }} className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-30"><ChevronLeft size={24} /></button>}
                {currentIndex < post.media.length - 1 && <button onClick={(e) => { e.stopPropagation(); paginate(1); }} className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-30"><ChevronRight size={24} /></button>}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 text-black">{post.media.map((_, i) => <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === currentIndex ? "bg-blue-500 scale-125" : "bg-white/40 shadow-sm")} />)}</div>
              </>
            )}
          </div>
          <div className="w-full md:w-96 bg-white flex flex-col border-l border-gray-200 overflow-hidden shrink-0 text-black">
            <div className="p-3 md:p-4 border-b border-gray-100 flex items-center justify-between shrink-0 text-black">
              <div className="flex items-center gap-3 text-black">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-0.5 text-black"><div className="w-full h-full rounded-full bg-white p-0.5 text-black"><div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center overflow-hidden text-[10px] font-bold uppercase text-black">{profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover text-black" referrerPolicy="no-referrer" /> : <span className="text-black">{post.username[0]}</span>}</div></div></div>
                <span className="font-semibold text-sm text-black">{post.username}</span>
              </div>
              <MoreHorizontal size={20} className="text-gray-500 text-black" />
            </div>
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 min-h-0 md:max-h-[60vh] text-black">
              <div className="flex gap-3 text-black">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-[10px] font-bold uppercase overflow-hidden text-black">{profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-black">{post.username[0]}</span>}</div>
                <div className="text-sm text-black"><span className="font-semibold mr-2 text-black">{post.username}</span><span className="whitespace-pre-wrap text-black">{post.caption}</span><div className="mt-2 text-xs text-gray-500 uppercase tracking-tight text-black">{format(parseISO(post.date), 'MMMM d, yyyy')}</div></div>
              </div>
            </div>
            <div className="p-3 md:p-4 border-t border-gray-100 space-y-3 shrink-0 bg-white text-black">
              <div className="flex items-center justify-between text-black"><div className="flex items-center gap-4 text-black"><Heart size={24} className="hover:text-gray-500 cursor-pointer text-black" /><MessageCircle size={24} className="hover:text-gray-500 cursor-pointer text-black" /><Play size={24} className="hover:text-gray-500 cursor-pointer text-black" /></div><Bookmark size={24} className="hover:text-gray-500 cursor-pointer text-black" /></div>
              <div className="text-sm flex items-center gap-2 text-black"><span className="font-semibold text-black">Archived Post</span><span className="text-gray-400 font-normal text-xs text-black">{post.id}</span></div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
