import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import {
  Box,
  Chip,
  Icon,
  IconButton,
  Icons,
  Input,
  Scroll,
  Spinner,
  Text,
  config,
  toRem,
} from 'folds';
import { FeedCard } from '../../../components/post/FeedCard';
import { useScreenSizeContext, ScreenSize } from '../../../hooks/useScreenSize';
import { PostVote } from '../../../utils/postVote';
import { FEED_SORTS, sortFeedPosts } from '../../../utils/feedSort';
import { feedSortAtom } from '../../../state/feedSort';
import { FeedPost, useFeedPosts } from './useFeedPosts';
import { useSearchPosts } from './useSearchPosts';

type FeedListProps = {
  posts: FeedPost[];
  loading: boolean;
  onVote: (roomId: string, eventId: string, vote: PostVote) => void;
  toolbar?: ReactNode;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  emptyText?: string;
};
export function FeedList({
  posts,
  loading,
  onVote,
  toolbar,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyText,
}: FeedListProps) {
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  const [sort, setSort] = useAtom(feedSortAtom);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const sortedPosts = useMemo(() => sortFeedPosts(posts, sort), [posts, sort]);

  // Arms a sentinel that triggers the next page once it nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loadingMore || !onLoadMore) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) onLoadMore();
        });
      },
      { rootMargin: '800px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, onLoadMore, posts.length]);

  const renderFeedContent = () => {
    if (loading && posts.length === 0) {
      return (
        <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
          <Spinner size="300" variant="Secondary" fill="Soft" />
        </Box>
      );
    }
    if (sortedPosts.length === 0) {
      return (
        <Box
          direction="Column"
          gap="100"
          alignItems="Center"
          style={{ padding: config.space.S400 }}
        >
          <Text size="T300" align="Center" priority="400">
            {emptyText ?? 'No posts yet.'}
          </Text>
          {!emptyText && (
            <Text size="T200" align="Center" priority="300">
              Every message in the community is a post — send one in any room.
            </Text>
          )}
        </Box>
      );
    }
    return (
      <>
        {sortedPosts.map((post) => (
          <FeedCard key={`${post.roomId}:${post.eventId}`} post={post} onVote={onVote} />
        ))}
        {hasMore && (
          <Box direction="Column" alignItems="Center" gap="100" style={{ minHeight: toRem(48) }}>
            <div ref={sentinelRef} style={{ height: toRem(8) }} />
            {loadingMore && <Spinner size="300" variant="Secondary" fill="Soft" />}
          </Box>
        )}
        {!hasMore && (
          <Text size="T200" align="Center" priority="300" style={{ padding: config.space.S200 }}>
            End of posts
          </Text>
        )}
      </>
    );
  };

  return (
    <Box grow="Yes" direction="Column" style={{ width: '100%', minHeight: 0 }}>
      <Box
        alignItems="Center"
        gap="200"
        style={{ padding: `${config.space.S100} ${config.space.S200}`, flexShrink: 0 }}
      >
        {FEED_SORTS.map((s) => (
          <Chip
            key={s.id}
            variant={sort === s.id ? 'Primary' : 'Secondary'}
            outlined={sort === s.id}
            radii="Pill"
            onClick={() => setSort(s.id)}
          >
            <Text size="B300">{s.label}</Text>
          </Chip>
        ))}
        <Box grow="Yes" />
        {toolbar}
      </Box>
      <Scroll variant="Background" direction="Vertical" size="300" hideTrack visibility="Hover">
        <Box
          direction="Column"
          gap="200"
          style={{
            maxWidth: toRem(760),
            margin: '0 auto',
            padding: `${config.space.S200} ${isMobile ? config.space.S200 : config.space.S300}`,
          }}
        >
          {renderFeedContent()}
        </Box>
      </Scroll>
    </Box>
  );
}

export function Feed() {
  const { posts, loading, loadingMore, hasMore, refresh, loadMore, applyVote } = useFeedPosts();
  const { results, searching, search } = useSearchPosts();
  const [searchTerm, setSearchTerm] = useState('');
  const searchingActive = searchTerm.trim().length > 0;

  const handleVote = useCallback(
    (roomId: string, eventId: string, vote: PostVote) => applyVote(roomId, eventId, vote),
    [applyVote]
  );

  const handleSearchChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = evt.target;
      setSearchTerm(value);
      search(value);
    },
    [search]
  );

  const handleLoadMore = useCallback(() => {
    if (!searchingActive) loadMore();
  }, [searchingActive, loadMore]);

  return (
    <Box grow="Yes" direction="Column" style={{ minHeight: 0 }}>
      <Box style={{ padding: `${config.space.S100} ${config.space.S200}`, flexShrink: 0 }}>
        <Box grow="Yes">
          <Input
            size="300"
            variant="SurfaceVariant"
            radii="300"
            placeholder="Search posts…"
            value={searchTerm}
            onChange={handleSearchChange}
            before={<Icon size="100" src={Icons.Search} />}
          />
        </Box>
      </Box>
      <FeedList
        posts={searchingActive ? results : posts}
        loading={searchingActive ? searching : loading}
        onVote={handleVote}
        hasMore={searchingActive ? false : hasMore}
        loadingMore={loadingMore}
        onLoadMore={handleLoadMore}
        emptyText={searchingActive ? 'No posts match your search.' : undefined}
        toolbar={
          <IconButton
            size="300"
            variant="Surface"
            radii="Pill"
            aria-label="Refresh feed"
            onClick={refresh}
          >
            <Icon size="100" src={Icons.Reload} />
          </IconButton>
        }
      />
    </Box>
  );
}

export { FEED_UP_KEY, FEED_DOWN_KEY } from './useFeedPosts';
