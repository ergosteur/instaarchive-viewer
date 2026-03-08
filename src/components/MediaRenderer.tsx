import React, { useState } from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { MediaFile } from '../types';
import { cn } from '../lib/utils';

export const MediaRenderer = ({ file, className, isFullView }: { file: MediaFile; className?: string; isFullView?: boolean }) => {
  const [isMuted, setIsMuted] = useState(false);
  const sizingClass = isFullView ? "w-full h-auto block" : "w-full h-full object-cover";
  const mediaStyle = { transform: 'translateZ(0)' };

  if (!file.url) return <div className={cn("bg-gray-100 flex items-center justify-center text-black", sizingClass)}><Play size={24} className="text-gray-300" /></div>;

  if (file.type === 'video') {
    return (
      <div className="relative w-full h-full flex items-center justify-center group/video text-black">
        <video src={file.url} className={cn("transition-all duration-300", sizingClass, className)} style={mediaStyle} playsInline autoPlay muted={isMuted} loop controls />
        <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="absolute bottom-16 right-4 z-30 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md transition-all md:opacity-0 md:group-hover/video:opacity-100">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>
    );
  }
  return <img src={file.url} alt="" className={cn("transition-all duration-300", sizingClass, className)} style={mediaStyle} referrerPolicy="no-referrer" decoding="async" loading="eager" />;
};
