import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { cn } from '../lib/utils';

const thumbnailCache = new Map<string, string>();

export const VideoThumbnail = ({ url, className }: { url: string; className?: string }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(thumbnailCache.get(url) || null);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thumbnail || !containerRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsInView(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [thumbnail]);

  useEffect(() => {
    if (thumbnail || !isInView) return;
    const video = document.createElement('video');
    video.src = `${url}#t=0.1`; video.preload = 'metadata'; video.muted = true; video.playsInline = true;
    const captureFrame = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          thumbnailCache.set(url, dataUrl); setThumbnail(dataUrl);
        }
      } catch (err) {} finally { cleanup(); }
    };
    const handleLoadedMetadata = () => video.currentTime = 0.1;
    const handleSeeked = () => captureFrame();
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeAttribute('src'); 
      video.load();
    };
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', cleanup);
    const timeout = setTimeout(() => { if (!thumbnailCache.has(url)) cleanup(); }, 5000);
    return () => { clearTimeout(timeout); cleanup(); };
  }, [url, thumbnail, isInView]);

  if (!thumbnail) return (
    <div ref={containerRef} className={cn("w-full h-full bg-gray-100 flex items-center justify-center text-black", className)}>
      <Play size={20} className="text-gray-300" fill="currentColor" />
    </div>
  );

  return <img src={thumbnail} alt="" className={cn("w-full h-full object-cover transition-transform duration-500 group-hover:scale-110", className)} referrerPolicy="no-referrer" />;
};
