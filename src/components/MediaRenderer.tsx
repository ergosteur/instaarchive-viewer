import React, { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { MediaFile } from '../types';
import { cn } from '../lib/utils';

export const MediaRenderer = ({ file, className, isFullView }: { file: MediaFile; className?: string; isFullView?: boolean }) => {
  // Try to play with sound: opening the modal is a user gesture, so browsers
  // generally allow it. If this particular browser still refuses, the effect
  // below falls back to muted playback rather than leaving a stalled video.
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || file.type !== 'video') return;

    let cancelled = false;
    video.muted = false;
    video.play().catch(() => {
      if (cancelled) return;
      setIsMuted(true);
      video.muted = true;
      video.play().catch(() => { /* user can start it from the controls */ });
    });

    return () => { cancelled = true; };
  }, [file.url, file.type]);
  /**
   * In full view the media must never outgrow the viewport.
   *
   * Video is sized to its own aspect within the cap (`w-auto`) so a portrait
   * clip doesn't sit in a wide letterbox, while images keep filling the modal
   * width and only gain a height ceiling — `object-contain` stops the cap from
   * distorting anything that hits it.
   *
   * The desktop cap subtracts the modal's own padding (md:p-10 = 2.5rem each
   * side); mobile leaves room for the caption panel stacked underneath.
   */
  const fullViewCap = "max-h-[70vh] md:max-h-[calc(100vh-5rem)] object-contain";
  const videoSizing = isFullView ? `block w-auto max-w-full ${fullViewCap}` : "w-full h-full object-cover";
  const imageSizing = isFullView ? `block w-full h-auto ${fullViewCap}` : "w-full h-full object-cover";
  const sizingClass = file.type === 'video' ? videoSizing : imageSizing;
  const mediaStyle = { transform: 'translateZ(0)' };

  if (!file.url) return <div className={cn("bg-gray-100 flex items-center justify-center text-black", sizingClass)}><Play size={24} className="text-gray-300" /></div>;

  if (file.type === 'video') {
    return (
      <div className="relative w-full h-full flex items-center justify-center group/video text-black">
        <video ref={videoRef} src={file.url} className={cn("transition-all duration-300", sizingClass, className)} style={mediaStyle} playsInline autoPlay muted={isMuted} loop controls />
        <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="absolute bottom-16 right-4 z-30 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md transition-all md:opacity-0 md:group-hover/video:opacity-100">
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>
    );
  }
  return <img src={file.url} alt="" className={cn("transition-all duration-300", sizingClass, className)} style={mediaStyle} referrerPolicy="no-referrer" decoding="async" loading="eager" />;
};
