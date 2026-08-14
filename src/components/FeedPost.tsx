import React from 'react';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react';
import { Post } from '../types';
import { formatDateSafe } from '../lib/utils';
import { MediaCarousel } from './MediaCarousel';

interface FeedPostProps {
  post: Post;
  profilePic: string | null;
  /** Off-screen posts keep their video paused. */
  paused: boolean;
}

/**
 * One post in the mobile feed, laid out like Instagram's: header, media,
 * action row, then caption.
 *
 * Media is capped below full viewport height so the next post always peeks in
 * at the bottom — that overlap is what tells you the page scrolls rather than
 * pages.
 */
export const FeedPost: React.FC<FeedPostProps> = ({ post, profilePic, paused }) => (
  <article className="bg-white border-b border-gray-200">
    <header className="flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-0.5 shrink-0">
          <div className="w-full h-full rounded-full bg-white p-0.5">
            <div className="w-full h-full rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[10px] font-bold uppercase">
              {profilePic
                ? <img src={profilePic} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                : <span>{post.username[0]}</span>}
            </div>
          </div>
        </div>
        <span className="font-semibold text-sm truncate">{post.username}</span>
      </div>
      <MoreHorizontal size={20} className="text-gray-500 shrink-0" />
    </header>

    {/*
      Taller ceiling than the modal so ordinary portrait media (9:16 reels,
      4:5 photos) fills the feed width instead of sitting in side bars, while
      still stopping anything extreme from swallowing the screen.
    */}
    <MediaCarousel post={post} paused={paused} heightCap="max-h-[85vh]" fillWidth className="bg-black" />

    <div className="px-3 pt-3 pb-1 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Heart size={24} className="cursor-pointer" />
        <MessageCircle size={24} className="cursor-pointer" />
        <Send size={24} className="cursor-pointer" />
      </div>
      <Bookmark size={24} className="cursor-pointer" />
    </div>

    {post.caption && (
      <div className="px-3 pb-1 text-sm">
        <span className="font-semibold mr-2">{post.username}</span>
        <span className="whitespace-pre-wrap">{post.caption}</span>
      </div>
    )}

    <div className="px-3 pb-3 pt-1 text-[10px] uppercase tracking-wide text-gray-400">
      {formatDateSafe(post.date, 'MMMM d, yyyy')}
    </div>
  </article>
);
