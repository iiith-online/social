import { FeedPost } from '../pages/client/home/useFeedPosts';

export type FeedSort = 'recommended' | 'recent' | 'top';

export const FEED_SORTS: Array<{ id: FeedSort; label: string }> = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'recent', label: 'Recent' },
  { id: 'top', label: 'Top' },
];

export const getInteractions = (post: FeedPost): number =>
  post.upvotes + post.downvotes + post.replyCount;

const getAgeDays = (post: FeedPost): number => (Date.now() - post.root.getTs()) / 86400000;

// Pinned posts always sort above the rest, within any tab.
const pinRank = (post: FeedPost): number => (post.pinned ? 0 : 1);

export const sortFeedPosts = (posts: FeedPost[], sort: FeedSort): FeedPost[] => {
  const sorted = [...posts];
  if (sort === 'recent') {
    sorted.sort(
      (a, b) => pinRank(a) - pinRank(b) || b.root.getTs() - a.root.getTs()
    );
  } else if (sort === 'top') {
    sorted.sort(
      (a, b) =>
        pinRank(a) - pinRank(b) ||
        getInteractions(b) - getInteractions(a) ||
        b.root.getTs() - a.root.getTs()
    );
  } else {
    // recommended: (1 + days old) * interactions
    sorted.sort(
      (a, b) =>
        pinRank(a) - pinRank(b) ||
        (1 + getAgeDays(b)) * getInteractions(b) -
          (1 + getAgeDays(a)) * getInteractions(a) ||
        b.root.getTs() - a.root.getTs()
    );
  }
  return sorted;
};

const stripMarkdown = (text: string): string => text.replace(/[#>*_`~|]/g, '').trim();

export const getPostTitle = (post: FeedPost): string => {
  const body = post.root.getContent()?.body;
  const text = typeof body === 'string' ? body : '';
  const firstLine = text.split('\n')[0] ?? '';
  return stripMarkdown(firstLine) || 'Untitled post';
};

export const getPostPreview = (post: FeedPost): string => {
  const body = post.root.getContent()?.body;
  const text = typeof body === 'string' ? body : '';
  const lines = text.split('\n');
  if (lines.length <= 1) return '';
  return stripMarkdown(lines.slice(1).join(' '));
};
