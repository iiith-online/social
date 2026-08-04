import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import { Box, Chip, Icon, IconButton, Icons, Scroll, Spinner, Text, config, toRem } from 'folds';
import { FeedCard } from '../../../components/post/FeedCard';
import { useScreenSizeContext, ScreenSize } from '../../../hooks/useScreenSize';
import { PostVote } from '../../../utils/postVote';
import { FEED_SORTS, FeedSort, sortFeedPosts } from '../../../utils/feedSort';
import { FeedPost, useFeedPosts } from './useFeedPosts';

type FeedListProps = {
  posts: FeedPost[];
  loading: boolean;
  onVote: (roomId: string, eventId: string, vote: PostVote) => void;
  toolbar?: ReactNode;
};
export function FeedList({ posts, loading, onVote, toolbar }: FeedListProps) {
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  const [sort, setSort] = useState<FeedSort>('recommended');

  const sortedPosts = useMemo(() => sortFeedPosts(posts, sort), [posts, sort]);

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
            No posts yet.
          </Text>
          <Text size="T200" align="Center" priority="300">
            Every message in the community is a post — send one in any room.
          </Text>
        </Box>
      );
    }
    return sortedPosts.map((post) => (
      <FeedCard key={`${post.roomId}:${post.eventId}`} post={post} onVote={onVote} />
    ));
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
  const { posts, loading, refresh, applyVote } = useFeedPosts();

  const handleVote = useCallback(
    (roomId: string, eventId: string, vote: PostVote) => applyVote(roomId, eventId, vote),
    [applyVote]
  );

  return (
    <FeedList
      posts={posts}
      loading={loading}
      onVote={handleVote}
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
  );
}

export { FEED_UP_KEY, FEED_DOWN_KEY } from './useFeedPosts';
