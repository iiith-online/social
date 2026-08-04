import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Icon, Icons, Text, config } from 'folds';
import { SequenceCard } from '../../components/sequence-card';
import { VoteColumn } from './VoteColumn';
import { PostMenu } from './PostMenu';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getPostPath, getProfilePath } from '../../pages/pathUtils';
import { getCanonicalAliasOrRoomId } from '../../utils/matrix';
import { getMemberDisplayName } from '../../utils/room';
import { relativeTime } from '../../utils/time';
import { PostVote } from '../../utils/postVote';
import { FeedPost } from '../../pages/client/home/useFeedPosts';
import { getPostPreview, getPostTitle } from '../../utils/feedSort';

type FeedCardProps = {
  post: FeedPost;
  onVote: (roomId: string, eventId: string, vote: PostVote) => void;
};
export function FeedCard({ post, onVote }: FeedCardProps) {
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

  const handleOpenProfile = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    if (sender) navigate(getProfilePath(sender));
  };

  return (
    <SequenceCard
      variant="SurfaceVariant"
      direction="Column"
      gap="100"
      onClick={handleOpen}
      style={{ cursor: 'pointer', padding: config.space.S200 }}
    >
      <Box gap="200" alignItems="Start">
        <VoteColumn state={post} onVote={(vote) => onVote(post.roomId, post.eventId, vote)} />
        <Box direction="Column" gap="100" grow="Yes" style={{ minWidth: 0 }}>
          <Box gap="100" alignItems="Center">
            <Box grow="Yes" style={{ minWidth: 0 }}>
              <Text size="T200" priority="400" truncate>
                s/{post.spaceName} · r/{room.name ?? room.roomId} ·{' '}
                <button
                  type="button"
                  onClick={handleOpenProfile}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'inherit',
                    font: 'inherit',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {authorName}
                </button>{' '}
                · {relativeTime(post.root.getTs())}
              </Text>
            </Box>
            <PostMenu room={room} event={post.root} />
          </Box>
          <Box gap="100" alignItems="Center" style={{ minWidth: 0 }}>
            <Box grow="Yes" style={{ minWidth: 0 }}>
              <Text size="H6" truncate>
                {title}
              </Text>
            </Box>
            {post.pinned && <Icon size="100" src={Icons.Pin} aria-label="Pinned post" />}
          </Box>
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
