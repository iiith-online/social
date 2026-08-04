import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EventType, MatrixEvent, MsgType, RelationType } from 'matrix-js-sdk';
import { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';
import to from 'await-to-js';
import {
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Scroll,
  Spinner,
  Text,
  TextArea,
  config,
  toRem,
} from 'folds';
import { Page, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { BackRouteHandler } from '../../../components/BackRouteHandler';
import { VoteColumn } from '../../../components/post/VoteColumn';
import { RenderBody } from '../../../components/message';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useRoomEvent } from '../../../hooks/useRoomEvent';
import { useRoomName } from '../../../hooks/useRoomMeta';
import { getMemberDisplayName } from '../../../utils/room';
import { getReactCustomHtmlParser, LINKIFY_OPTS } from '../../../plugins/react-custom-html-parser';
import { relativeTime } from '../../../utils/time';
import {
  getPostVoteState,
  PostVote,
  PostVoteState,
  togglePostVote,
} from '../../../utils/postVote';

const getContentBody = (content: Record<string, unknown>): string =>
  typeof content.body === 'string' ? content.body : '';

const getPostTitle = (content: Record<string, unknown>): string => {
  const firstLine = getContentBody(content).split('\n')[0] ?? '';
  return firstLine.replace(/[#>*_`~|]/g, '').trim() || 'Untitled post';
};

const getPostBody = (content: Record<string, unknown>): string => {
  const lines = getContentBody(content).split('\n');
  if (lines.length <= 1) return '';
  return lines.slice(1).join('\n').replace(/[#>*_`~|]/g, '').trim();
};

type CommentItemProps = {
  room: ReturnType<typeof useRoom>;
  event: MatrixEvent;
  parserOptions: ReturnType<typeof getReactCustomHtmlParser>;
};
function CommentItem({ room, event, parserOptions }: CommentItemProps) {
  const sender = event.getSender();
  const authorName = sender
    ? getMemberDisplayName(room, sender) ?? sender.split(':')[0].replace('@', '')
    : 'unknown';
  const content = event.getContent();
  const body = typeof content.body === 'string' ? content.body : '';
  const customBody = typeof content['org.matrix.custom.html'] === 'string'
    ? (content['org.matrix.custom.html'] as string)
    : undefined;

  return (
    <SequenceCard variant="SurfaceVariant" direction="Column" gap="100" style={{ padding: config.space.S200 }}>
      <Text size="T200" priority="400">
        {authorName} · {relativeTime(event.getTs())}
      </Text>
      <RenderBody
        body={body}
        customBody={customBody}
        htmlReactParserOptions={parserOptions}
        linkifyOpts={LINKIFY_OPTS}
      />
    </SequenceCard>
  );
}

type CommentComposerProps = {
  roomId: string;
  eventId: string;
  onSent: () => void;
};
function CommentComposer({ roomId, eventId, onSent }: CommentComposerProps) {
  const mx = useMatrixClient();
  const [text, setText] = useState('');

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    // Passing the post event id as threadId makes the SDK attach the
    // m.thread relation (with an m.in_reply_to fallback) automatically.
    await mx.sendEvent(roomId, eventId, EventType.RoomMessage, {
      msgtype: MsgType.Text,
      body,
    }).catch(() => undefined);
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
        borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
      }}
    >
      <Box grow="Yes">
        <TextArea
          variant="SurfaceVariant"
          size="400"
          radii="300"
          placeholder="Add a comment"
          value={text}
          onChange={(evt: React.ChangeEvent<HTMLTextAreaElement>) => setText(evt.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
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
        <Text size="B400">Comment</Text>
      </Button>
    </Box>
  );
}

export function PostPage() {
  const mx = useMatrixClient();
  const room = useRoom();
  const roomName = useRoomName(room);
  const { eventId } = useParams();
  const post = useRoomEvent(room, eventId ?? '');

  const [comments, setComments] = useState<MatrixEvent[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [voteState, setVoteState] = useState<PostVoteState>({ upvotes: 0, downvotes: 0 });

  const parserOptions = useMemo(
    () => getReactCustomHtmlParser(mx, room.roomId, { linkifyOpts: LINKIFY_OPTS }),
    [mx, room.roomId]
  );

  const loadComments = useCallback(async () => {
    if (!eventId) return;
    setCommentsLoading(true);
    const [threads, inlines] = await Promise.all([
      mx
        .relations(room.roomId, eventId, RelationType.Thread, undefined, { limit: 200 })
        .catch(() => null),
      mx
        .relations(room.roomId, eventId, 'm.in_reply_to', undefined, { limit: 200 })
        .catch(() => null),
    ]);
    const all = [...(threads?.events ?? []), ...(inlines?.events ?? [])];
    const unique = Array.from(new Map(all.map((evt) => [evt.getId(), evt])).values());
    await Promise.all(
      unique.map(async (evt) => {
        if (evt.isEncrypted() && mx.getCrypto()) {
          await to(evt.attemptDecryption(mx.getCrypto() as CryptoBackend));
        }
      })
    );
    setComments(
      unique
        .filter((evt) => !evt.isDecryptionFailure())
        .sort((a, b) => a.getTs() - b.getTs())
    );
    setCommentsLoading(false);
  }, [mx, room.roomId, eventId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!eventId) return undefined;
    getPostVoteState(mx, room.roomId, eventId).then(setVoteState);
    return undefined;
  }, [mx, room.roomId, eventId]);

  const handleVote = useCallback(
    (vote: PostVote) => {
      if (!eventId) return;
      setVoteState((prev) => togglePostVote(mx, room.roomId, eventId, prev, vote));
    },
    [mx, room.roomId, eventId]
  );

  const renderPost = () => {
    if (post === undefined) {
      return (
        <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
          <Spinner size="300" variant="Secondary" fill="Soft" />
        </Box>
      );
    }
    if (post === null) {
      return (
        <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
          <Text size="T300" priority="400">
            Post not found.
          </Text>
        </Box>
      );
    }

    const sender = post.getSender();
    const authorName = sender
      ? getMemberDisplayName(room, sender) ?? sender.split(':')[0].replace('@', '')
      : 'unknown';
    const content = post.getContent();
    const customBody =
      typeof content['org.matrix.custom.html'] === 'string'
        ? (content['org.matrix.custom.html'] as string)
        : undefined;
    const title = getPostTitle(content);
    const preview = getPostBody(content);

    const renderComments = () => {
      if (commentsLoading) {
        return (
          <Box justifyContent="Center" style={{ padding: config.space.S300 }}>
            <Spinner size="300" variant="Secondary" fill="Soft" />
          </Box>
        );
      }
      if (comments.length === 0) {
        return (
          <Text size="T300" priority="400">
            No comments yet. Start the discussion!
          </Text>
        );
      }
      return comments.map((comment) => (
        <CommentItem
          key={comment.getId()}
          room={room}
          event={comment}
          parserOptions={parserOptions}
        />
      ));
    };

    return (
      <Box grow="Yes" direction="Column" style={{ minHeight: 0 }}>
        <Scroll variant="Background" direction="Vertical" size="300" hideTrack visibility="Hover">
          <Box direction="Column" gap="300" style={{ padding: config.space.S300 }}>
            <SequenceCard
              variant="SurfaceVariant"
              direction="Column"
              gap="200"
              style={{ padding: config.space.S300 }}
            >
              <Box gap="200" alignItems="Start">
                <VoteColumn state={voteState} onVote={handleVote} />
                <Box direction="Column" gap="100" grow="Yes" style={{ minWidth: 0 }}>
                  <Text size="T200" priority="400">
                    r/{roomName} · {authorName} · {relativeTime(post.getTs())}
                  </Text>
                  <Text size="H4">{title}</Text>
                  {preview && (
                    <RenderBody
                      body={preview}
                      customBody={customBody}
                      htmlReactParserOptions={parserOptions}
                      linkifyOpts={LINKIFY_OPTS}
                    />
                  )}
                </Box>
              </Box>
            </SequenceCard>

            <Text size="L400">
              {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
            </Text>
            {renderComments()}
          </Box>
        </Scroll>
        <CommentComposer roomId={room.roomId} eventId={eventId ?? ''} onSent={loadComments} />
      </Box>
    );
  };

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
      {renderPost()}
    </Page>
  );
}
