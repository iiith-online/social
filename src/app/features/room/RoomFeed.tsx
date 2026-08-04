import React, { useCallback, useState } from 'react';
import { Box, Button, Icon, IconButton, Icons, Text, TextArea, config, toRem } from 'folds';
import { EventType, MsgType } from 'matrix-js-sdk';
import { Page, PageHeader } from '../../components/page';
import { BackRouteHandler } from '../../components/BackRouteHandler';
import { FeedList } from '../../pages/client/home/Feed';
import { useRoom } from '../../hooks/useRoom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomName } from '../../hooks/useRoomMeta';
import { PostVote } from '../../utils/postVote';
import { useRoomPosts } from '../../pages/client/home/useFeedPosts';

type RoomPostComposerProps = {
  roomId: string;
  onSent: () => void;
};
function RoomPostComposer({ roomId, onSent }: RoomPostComposerProps) {
  const mx = useMatrixClient();
  const [text, setText] = useState('');

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    await mx
      .sendEvent(roomId, EventType.RoomMessage, {
        msgtype: MsgType.Text,
        body,
      })
      .catch(() => undefined);
    setText('');
    onSent();
  };

  const handleKeyDown = (evt: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (evt.key === 'Enter' && !evt.shiftKey) {
      evt.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      gap="200"
      alignItems="End"
      style={{
        padding: config.space.S200,
        borderBottom: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
      }}
    >
      <Box grow="Yes">
        <TextArea
          variant="SurfaceVariant"
          size="400"
          radii="300"
          placeholder="Write a post..."
          value={text}
          onChange={(evt: React.ChangeEvent<HTMLTextAreaElement>) => setText(evt.target.value)}
          onKeyDown={handleKeyDown}
          style={{ width: '100%', maxHeight: toRem(160) }}
        />
      </Box>
      <Button
        size="400"
        variant="Primary"
        radii="300"
        disabled={!text.trim()}
        onClick={handleSend}
      >
        <Text size="B400">Post</Text>
      </Button>
    </Box>
  );
}

export function RoomFeed() {
  const room = useRoom();
  const roomName = useRoomName(room);
  const { posts, loading, refresh, applyVote } = useRoomPosts(room.roomId);

  const handleVote = useCallback(
    (roomId: string, eventId: string, vote: PostVote) => applyVote(roomId, eventId, vote),
    [applyVote]
  );

  return (
    <Page>
      <PageHeader balance outlined={false}>
        <Box grow="Yes" alignItems="Center" gap="200">
          <BackRouteHandler>
            {(onBack) => (
              <IconButton size="300" variant="Background" onClick={onBack}>
                <Icon size="100" src={Icons.ArrowLeft} />
              </IconButton>
            )}
          </BackRouteHandler>
          <Box grow="Yes">
            <Text size="H4" truncate>
              r/{roomName}
            </Text>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes" direction="Column" style={{ minHeight: 0 }}>
        <RoomPostComposer roomId={room.roomId} onSent={refresh} />
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
      </Box>
    </Page>
  );
}
