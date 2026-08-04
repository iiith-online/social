import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, Icon, IconButton, Icons, Scroll, Spinner, Text, config, toRem } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { VoteColumn } from '../../../components/post/VoteColumn';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useScreenSizeContext, ScreenSize } from '../../../hooks/useScreenSize';
import { getPostPath } from '../../pathUtils';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { getMemberDisplayName } from '../../../utils/room';
import { relativeTime } from '../../../utils/time';
import { PostVote } from '../../../utils/postVote';
import { FeedPost, getPostScore, useFeedPosts } from './useFeedPosts';

type FeedSort = 'hot' | 'new' | 'top';

const SORTS: Array<{ id: FeedSort; label: string }> = [
  { id: 'hot', label: 'Hot' },
  { id: 'new', label: 'New' },
  { id: 'top', label: 'Top' },
];

const sortPosts = (posts: FeedPost[], sort: FeedSort): FeedPost[] => {
  const sorted = [...posts];
  if (sort === 'new') {
    sorted.sort((a, b) => b.root.getTs() - a.root.getTs());
  } else if (sort === 'top') {
    sorted.sort(
      (a, b) => getPostScore(b) - getPostScore(a) || b.root.getTs() - a.root.getTs()
    );
  } else {
    sorted.sort((a, b) => b.hot - a.hot);
  }
  return sorted;
};

const getPostTitle = (post: FeedPost): string => {
  const body = post.root.getContent()?.body;
  const text = typeof body === 'string' ? body : '';
  const firstLine = text.split('\n')[0] ?? '';
  // strip common markdown decoration
  return firstLine.replace(/[#>*_`~|]/g, '').trim() || 'Untitled post';
};

const getPostPreview = (post: FeedPost): string => {
  const body = post.root.getContent()?.body;
  const text = typeof body === 'string' ? body : '';
  const lines = text.split('\n');
  if (lines.length <= 1) return '';
  return lines.slice(1).join(' ').replace(/[#>*_`~|]/g, '').trim();
};

type FeedCardProps = {
  post: FeedPost;
  onVote: (roomId: string, eventId: string, vote: PostVote) => void;
};
function FeedCard({ post, onVote }: FeedCardProps) {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const room = mx.getRoom(post.roomId);

  const handleOpen = useCallback(() => {
    if (!room) return;
    navigate(getPostPath(getCanonicalAliasOrRoomId(mx, room.roomId), post.eventId));
  }, [mx, navigate, room, post.eventId]);

  if (!room) return null;

  const sender = post.root.getSender();
  const authorName = sender
    ? getMemberDisplayName(room, sender) ?? sender.split(':')[0].replace('@', '')
    : 'unknown';
  const title = getPostTitle(post);
  const preview = getPostPreview(post);

  return (
    <SequenceCard
      variant="SurfaceVariant"
      direction="Column"
      gap="100"
      onClick={handleOpen}
      style={{ cursor: 'pointer', padding: config.space.S200 }}
    >
      <Box gap="200" alignItems="Start">
        <VoteColumn
          state={post}
          onVote={(vote) => onVote(post.roomId, post.eventId, vote)}
        />
        <Box direction="Column" gap="100" grow="Yes" style={{ minWidth: 0 }}>
          <Text size="T200" priority="400" truncate>
            r/{room.name ?? room.roomId} · {authorName} · {relativeTime(post.root.getTs())}
          </Text>
          <Text size="H6" truncate>
            {title}
          </Text>
          {preview && (
            <Text size="T300" priority="300" truncate>
              {preview}
            </Text>
          )}
          <Box gap="100" alignItems="Center">
            <Icon size="100" src={Icons.Message} />
            <Text size="T200" priority="400">
              {post.replyCount} {post.replyCount === 1 ? 'comment' : 'comments'}
            </Text>
          </Box>
        </Box>
      </Box>
    </SequenceCard>
  );
}

export function Feed() {
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  const { posts, loading, refresh, applyVote } = useFeedPosts();
  const [sort, setSort] = useState<FeedSort>('hot');

  const sortedPosts = useMemo(() => sortPosts(posts, sort), [posts, sort]);

  const handleVote = useCallback(
    (roomId: string, eventId: string, vote: PostVote) => applyVote(roomId, eventId, vote),
    [applyVote]
  );

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
        <Box direction="Column" gap="100" alignItems="Center" style={{ padding: config.space.S400 }}>
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
      <FeedCard key={`${post.roomId}:${post.eventId}`} post={post} onVote={handleVote} />
    ));
  };

  return (
    <Box grow="Yes" direction="Column" style={{ width: '100%' }}>
      <Box
        alignItems="Center"
        gap="200"
        style={{ padding: `${config.space.S100} ${config.space.S200}`, flexShrink: 0 }}
      >
        {SORTS.map((s) => (
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
        <IconButton
          size="300"
          variant="Surface"
          radii="Pill"
          aria-label="Refresh feed"
          onClick={refresh}
        >
          <Icon size="100" src={Icons.Reload} />
        </IconButton>
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

export { FEED_UP_KEY, FEED_DOWN_KEY } from './useFeedPosts';
