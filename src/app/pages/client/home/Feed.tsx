import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, Icon, IconButton, Icons, Scroll, Spinner, Text, config, toRem } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useScreenSizeContext, ScreenSize } from '../../../hooks/useScreenSize';
import { getHomeRoomPath } from '../../pathUtils';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { getMemberDisplayName } from '../../../utils/room';
import { FEED_DOWN_KEY, FEED_UP_KEY, FeedPost, FeedVote, getPostScore, useFeedPosts } from './useFeedPosts';

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

const timeAgo = (ts: number): string => {
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString();
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

type VoteButtonProps = {
  post: FeedPost;
  vote: FeedVote;
  onVote: (roomId: string, threadId: string, vote: FeedVote) => void;
};
function VoteButton({ post, vote, onVote }: VoteButtonProps) {
  const active = post.myVote === vote;
  const isUp = vote === 'up';

  const handleClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    onVote(post.roomId, post.threadId, vote);
  };

  return (
    <IconButton
      size="300"
      variant={active ? 'Primary' : 'Surface'}
      radii="Pill"
      aria-pressed={active}
      aria-label={isUp ? 'Upvote' : 'Downvote'}
      onClick={handleClick}
      style={{ width: toRem(28), minWidth: toRem(28), height: toRem(28) }}
    >
      <Icon size="100" src={isUp ? Icons.ArrowTop : Icons.ArrowBottom} />
    </IconButton>
  );
}

type FeedCardProps = {
  post: FeedPost;
  onVote: (roomId: string, threadId: string, vote: FeedVote) => void;
};
function FeedCard({ post, onVote }: FeedCardProps) {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const room = mx.getRoom(post.roomId);

  const handleOpen = useCallback(() => {
    if (!room) return;
    navigate(getHomeRoomPath(getCanonicalAliasOrRoomId(mx, room.roomId), post.threadId));
  }, [mx, navigate, room, post.threadId]);

  if (!room) return null;

  const sender = post.root.getSender();
  const authorName = sender
    ? getMemberDisplayName(room, sender) ?? sender.split(':')[0].replace('@', '')
    : 'unknown';
  const title = getPostTitle(post);
  const preview = getPostPreview(post);
  const score = getPostScore(post);

  return (
    <SequenceCard
      variant="SurfaceVariant"
      direction="Column"
      gap="100"
      onClick={handleOpen}
      style={{ cursor: 'pointer', padding: config.space.S200 }}
    >
      <Box gap="200" alignItems="Start">
        <Box direction="Column" alignItems="Center" gap="100" shrink="No">
          <VoteButton post={post} vote="up" onVote={onVote} />
          <Text size="T300" priority={score >= 0 ? '400' : '500'}>
            {score}
          </Text>
          <VoteButton post={post} vote="down" onVote={onVote} />
        </Box>
        <Box direction="Column" gap="100" grow="Yes" style={{ minWidth: 0 }}>
          <Text size="T200" priority="400" truncate>
            r/{room.name ?? room.roomId} · {authorName} · {timeAgo(post.root.getTs())}
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
    (roomId: string, threadId: string, vote: FeedVote) => applyVote(roomId, threadId, vote),
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
            Posts are threads — reply in thread to any message to create a post.
          </Text>
        </Box>
      );
    }
    return sortedPosts.map((post) => (
      <FeedCard key={`${post.roomId}:${post.threadId}`} post={post} onVote={handleVote} />
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
          style={{ padding: `${config.space.S200} ${isMobile ? config.space.S200 : config.space.S300}` }}
        >
          {renderFeedContent()}
        </Box>
      </Scroll>
    </Box>
  );
}

export { FEED_UP_KEY, FEED_DOWN_KEY };
