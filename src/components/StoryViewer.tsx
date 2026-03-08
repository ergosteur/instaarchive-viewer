import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Volume2, 
  VolumeX, 
  X 
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { Post } from '../types';
import { cn } from '../lib/utils';

interface StoryViewerProps {
  stories: Post[];
  onClose: () => void;
  profilePic: string | null;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({ 
  stories, 
  onClose,
  profilePic
}) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
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
      className="fixed inset-0 z-[100] bg-[#1a1a1a] flex items-center justify-center overflow-hidden text-white"
      onClick={onClose}
    >
      <div className="absolute inset-0 z-0 text-white">
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
        className="relative w-full h-full md:h-[90vh] md:max-w-[45vh] bg-black overflow-hidden md:rounded-lg shadow-2xl z-10 text-white"
        onClick={e => e.stopPropagation()}
      >
        <div 
          className="absolute top-2 left-2 right-2 z-50 flex px-1 text-white"
          style={{ gap: stories.length > 100 ? '1px' : (stories.length > 50 ? '2px' : '4px') }}
        >
          {stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden text-white">
              <div 
                className="h-full bg-white transition-all duration-75 text-white"
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
                  <img src={profilePic} alt="" className="w-full h-full object-cover text-black" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[10px] font-bold text-black uppercase">{story.username[0]}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-white">
              <span className="text-xs font-semibold">{story.username}</span>
              <span className="text-[10px] opacity-60 font-medium">{format(parseISO(story.date), 'MMM d')}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-white">
            {story.media[0].type === 'video' && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="w-full h-full flex items-center justify-center pointer-events-none text-white">
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
