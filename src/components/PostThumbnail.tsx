import React, { useState, useEffect, useRef } from 'react';
import { Play, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Post } from '../types';

interface PostThumbnailProps {
  post: Post;
  className?: string;
  thumbnailUrl?: string; // High-res thumbnail from queue
  onRequestThumbnail: (id: string, url: string) => void;
}

const videoThumbnailCache = new Map<string, string>();

export const PostThumbnail = ({ post, className, thumbnailUrl, onRequestThumbnail }: PostThumbnailProps) => {
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(videoThumbnailCache.get(post.media[0].url) || null);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const mainMedia = post.media[0];
  const isVideo = mainMedia.type === 'video';

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { 
        setIsInView(true); 
        observer.disconnect(); 
      }
    }, { rootMargin: '400px' }); // Larger margin for smoother scrolling
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;

    if (isVideo) {
      if (videoThumbnail) return;
      const video = document.createElement('video');
      video.src = `${mainMedia.url}#t=0.1`; 
      video.preload = 'metadata'; 
      video.muted = true; 
      video.playsInline = true;
      
      const captureFrame = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx && video.videoWidth > 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            videoThumbnailCache.set(mainMedia.url, dataUrl); 
            setVideoThumbnail(dataUrl);
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
      const timeout = setTimeout(() => cleanup(), 5000);
      return () => { clearTimeout(timeout); cleanup(); };
    } else {
      // Request high-res image thumbnailing only if size > 1MiB
      const ONE_MIB = 1024 * 1024;
      if (mainMedia.size && mainMedia.size > ONE_MIB) {
        onRequestThumbnail(post.id, mainMedia.url);
      }
    }
  }, [isInView, isVideo, mainMedia.url, mainMedia.size, post.id, onRequestThumbnail, videoThumbnail]);

  // Determine if we are actually expecting a high-res thumbnail
  const ONE_MIB = 1024 * 1024;
  const isHighRes = !isVideo && mainMedia.size && mainMedia.size > ONE_MIB;
  const isGenerating = isHighRes && !thumbnailUrl;

  // Use high-res thumbnail if available, then video thumb, then original
  const displayUrl = thumbnailUrl || videoThumbnail || post.thumbnail;

  if (!displayUrl && isVideo) {
    return (
      <div ref={containerRef} className={cn("w-full h-full bg-gray-100 flex items-center justify-center text-black", className)}>
        <Play size={20} className="text-gray-300" fill="currentColor" />
      </div>
    );
  }

  if (!displayUrl) {
    return (
      <div ref={containerRef} className={cn("w-full h-full bg-gray-50 flex items-center justify-center text-black", className)}>
        <ImageIcon size={20} className="text-gray-200" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <img 
        src={displayUrl} 
        alt="" 
        className={cn(
          "w-full h-full object-cover transition-all duration-700", 
          className, 
          isGenerating ? "blur-sm scale-105" : "blur-0 scale-100"
        )} 
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </div>
  );
};
