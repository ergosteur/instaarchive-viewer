import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Post } from '../types';
import { FeedPost } from './FeedPost';

interface PostFeedProps {
  posts: Post[];
  /** Post the feed should open at. */
  initialPostId: string;
  profilePic: string | null;
  onClose: () => void;
  /** Fires as the post crossing the viewport centre changes. */
  onActivePostChange: (post: Post) => void;
  title?: string;
}

/** Posts added each time the feed grows in either direction. */
const BATCH = 6;
/** Render this many ahead of the entry point so the first scroll is smooth. */
const LOOKAHEAD = 3;

/**
 * The mobile post view: a real scrolling feed, not a modal.
 *
 * Only a window of posts around the entry point is mounted — a profile can hold
 * thousands, and mounting them all would mean thousands of full-size images.
 * The window grows in both directions as you scroll; growing *upwards* shifts
 * everything below it, so the scroll position is corrected in the same frame to
 * keep the content under your thumb still.
 */
export const PostFeed: React.FC<PostFeedProps> = ({
  posts, initialPostId, profilePic, onClose, onActivePostChange, title,
}) => {
  const initialIndex = useMemo(() => {
    const found = posts.findIndex(p => p.id === initialPostId);
    return found === -1 ? 0 : found;
  }, [posts, initialPostId]);

  const [range, setRange] = useState(() => ({
    start: initialIndex,
    end: Math.min(posts.length, initialIndex + LOOKAHEAD + 1),
  }));
  const [activeId, setActiveId] = useState(initialPostId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  /** Distance from the bottom of the content, captured before a prepend. */
  const anchorRef = useRef<number | null>(null);

  const visible = posts.slice(range.start, range.end);

  const extendDown = useCallback(() => {
    setRange(r => (r.end >= posts.length ? r : { ...r, end: Math.min(posts.length, r.end + BATCH) }));
  }, [posts.length]);

  const extendUp = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setRange(r => {
      if (r.start === 0) return r;
      // Measure from the bottom: prepending changes scrollHeight, but the
      // distance between our position and the end of the content does not.
      anchorRef.current = el.scrollHeight - el.scrollTop;
      return { ...r, start: Math.max(0, r.start - BATCH) };
    });
  }, []);

  // Restore the scroll position in the same frame the prepended posts appear,
  // before the browser paints, so nothing visibly jumps.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && anchorRef.current !== null) {
      el.scrollTop = el.scrollHeight - anchorRef.current;
      anchorRef.current = null;
    }
  }, [range.start]);

  // Grow the window when either end comes into view.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target === bottomSentinelRef.current) extendDown();
        if (entry.target === topSentinelRef.current) extendUp();
      }
    }, { root, rootMargin: '600px 0px' });

    if (topSentinelRef.current) observer.observe(topSentinelRef.current);
    if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);
    return () => observer.disconnect();
  }, [extendDown, extendUp]);

  // Track the post crossing the viewport centre. The negative margins collapse
  // the root to a thin band, so exactly one post qualifies at a time.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = (entry.target as HTMLElement).dataset.postId;
        if (id) setActiveId(id);
      }
    }, { root, rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    root.querySelectorAll('[data-post-id]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [visible.length, range.start]);

  useEffect(() => {
    const post = posts.find(p => p.id === activeId);
    if (post) onActivePostChange(post);
  }, [activeId, posts, onActivePostChange]);

  // Escape closes, matching the modal it replaces.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <header className="flex items-center gap-3 px-2 h-12 border-b border-gray-200 bg-white/95 backdrop-blur-md shrink-0">
        <button onClick={onClose} aria-label="Back" className="p-2 -ml-1 active:opacity-60">
          <ChevronLeft size={24} />
        </button>
        <span className="font-semibold text-base">{title ?? 'Posts'}</span>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div ref={topSentinelRef} aria-hidden />
        {visible.map(post => (
          <div key={post.id} data-post-id={post.id}>
            <FeedPost post={post} profilePic={profilePic} paused={post.id !== activeId} />
          </div>
        ))}
        <div ref={bottomSentinelRef} aria-hidden />
        {range.end >= posts.length && (
          <div className="py-10 text-center text-xs uppercase tracking-widest text-gray-400">
            End of {title?.toLowerCase() ?? 'posts'}
          </div>
        )}
      </div>
    </div>
  );
};
