import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Post } from '../types';
import { cn } from '../lib/utils';
import { NAVIGATE, prefersReducedMotion, withVelocity } from '../lib/motion';
import { MediaRenderer } from './MediaRenderer';

interface MediaCarouselProps {
  post: Post;
  /** Pause video even when this slide is on screen (feed: only one plays). */
  paused?: boolean;
  /** Override the media height ceiling (the feed allows taller media). */
  heightCap?: string;
  /** Size video to the container width (see MediaRenderer). */
  fillWidth?: boolean;
  className?: string;
}

/**
 * The horizontal slide strip for one post.
 *
 * Shared by the desktop modal and the mobile feed so a carousel behaves the
 * same in both. Horizontal drag belongs to the carousel and never navigates
 * between posts — vertical movement is the page's to handle.
 */
export const MediaCarousel: React.FC<MediaCarouselProps> = ({ post, paused, heightCap, fillWidth, className }) => {
  const [index, setIndex] = useState(0);
  const [slide, setSlide] = useState<{ dir: number; velocity: number }>({ dir: 0, velocity: 0 });
  const reduceMotion = prefersReducedMotion();

  useEffect(() => setIndex(0), [post.id]);

  const paginate = (dir: number, velocity = 0) => {
    const next = index + dir;
    if (next < 0 || next >= post.media.length) return;
    setSlide({ dir, velocity });
    setIndex(next);
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 1, zIndex: 0 }),
    center: { x: 0, opacity: 1, zIndex: 1 },
    exit: (d: number) => ({ x: d < 0 ? '100%' : '-100%', opacity: 1, zIndex: 0 }),
  };
  const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;
  const current = post.media[index];

  return (
    <div className={cn('relative bg-black flex items-center justify-center group overflow-hidden w-full', className)}>
      <div className="w-full grid grid-cols-1 grid-rows-1">
        <AnimatePresence initial={false} custom={slide.dir}>
          <motion.div
            key={`${post.id}-${index}`}
            custom={slide.dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduceMotion ? { duration: 0 } : withVelocity(slide.velocity, NAVIGATE)}
            drag={post.media.length > 1 ? 'x' : false}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(e, { offset, velocity }) => {
              const power = swipePower(offset.x, velocity.x);
              if (power < -15000) paginate(1, velocity.x);
              else if (power > 15000) paginate(-1, velocity.x);
            }}
            className="col-start-1 row-start-1 w-full flex items-center justify-center relative touch-pan-y"
          >
            {current && <MediaRenderer file={current} isFullView paused={paused} heightCap={heightCap} fillWidth={fillWidth} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {post.media.length > 1 && (
        <>
          {index > 0 && (
            <button
              aria-label="Previous photo"
              onClick={(e) => { e.stopPropagation(); paginate(-1); }}
              className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-30"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {index < post.media.length - 1 && (
            <button
              aria-label="Next photo"
              onClick={(e) => { e.stopPropagation(); paginate(1); }}
              className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-30"
            >
              <ChevronRight size={24} />
            </button>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
            {post.media.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all',
                  i === index ? 'bg-blue-500 scale-125' : 'bg-white/40 shadow-sm',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
