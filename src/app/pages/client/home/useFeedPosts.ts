import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Direction,
  EventType,
  IEvent,
  MatrixClient,
  MatrixEvent,
  RelationType,
  Room,
} from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
import to from 'await-to-js';
import { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { mDirectAtom } from '../../../state/mDirectList';
import { MessageEvent } from '../../../../types/matrix/room';

export const FEED_UP_KEY = '👍';
export const FEED_DOWN_KEY = '👎';

export type FeedVote = 'up' | 'down';

export type FeedPost = {
  roomId: string;
  threadId: string;
  root: MatrixEvent;
  upvotes: number;
  downvotes: number;
  myVote?: FeedVote;
  myReactionId?: string;
  replyCount: number;
  hot: number;
};

const TIMELINE_LIMIT = 40;
const MAX_ROOMS = 25;
const MAX_POSTS_PER_ROOM = 10;
const MAX_POSTS = 60;
const RELATIONS_LIMIT = 100;
const REFRESH_INTERVAL = 60_000;

export const getPostScore = (post: FeedPost): number => post.upvotes - post.downvotes;

// Reddit hot ranking: log-scaled score plus recency in 12.5-hour half-lives.
export const hotScore = (score: number, ts: number): number =>
  Math.log10(Math.max(Math.abs(score), 1)) * Math.sign(score) + ts / 45000;

const decryptEvent = async (mx: MatrixClient, mEvent: MatrixEvent) => {
  if (mEvent.isEncrypted() && mx.getCrypto()) {
    await to(mEvent.attemptDecryption(mx.getCrypto() as CryptoBackend));
  }
  return mEvent;
};

const mapEvent = async (mx: MatrixClient, raw: Partial<IEvent>): Promise<MatrixEvent> => {
  const mEvent = new MatrixEvent(raw);
  const replaceEvt = raw.unsigned?.['m.relations']?.['m.replace'];
  if (replaceEvt) {
    mEvent.makeReplaced(new MatrixEvent(replaceEvt));
  }
  return decryptEvent(mx, mEvent);
};

const getThreadRootIds = (events: MatrixEvent[]): Set<string> =>
  events.reduce<Set<string>>((threadIds, evt) => {
    if (evt.isDecryptionFailure()) return threadIds;
    const relation = evt.getContent()?.['m.relates_to'];
    if (relation?.rel_type === RelationType.Thread && typeof relation.event_id === 'string') {
      threadIds.add(relation.event_id);
    }
    return threadIds;
  }, new Set());

// Batched async map: runs `fn` over items in batches of `batchSize`, awaiting each batch.
const mapBatched = <T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> =>
  items.length === 0
    ? Promise.resolve([])
    : Promise.all(items.slice(0, batchSize).map(fn)).then((head) =>
        mapBatched(items.slice(batchSize), batchSize, fn).then((tail) => [...head, ...tail])
      );

type FeedRoomResult = FeedPost[];

export const useFeedPosts = () => {
  const mx = useMatrixClient();
  const roomIds = useAtomValue(allRoomsAtom);
  const mDirects = useAtomValue(mDirectAtom);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const aliveRef = useRef(true);

  const getRoomPosts = useCallback(
    async (room: Room): Promise<FeedRoomResult> => {
      let chunk: Partial<IEvent>[] = [];
      try {
        const result = await mx.createMessagesRequest(
          room.roomId,
          null,
          TIMELINE_LIMIT,
          Direction.Backward
        );
        chunk = result.chunk;
      } catch {
        return [];
      }

      const events = await Promise.all(chunk.map((raw) => mapEvent(mx, raw)));
      const threadIds = getThreadRootIds(events);
      if (threadIds.size === 0) return [];

      const inWindowRoots = new Map<string, MatrixEvent>();
      events.forEach((evt) => {
        if (evt.isDecryptionFailure()) return;
        const id = evt.getId();
        if (id && threadIds.has(id)) inWindowRoots.set(id, evt);
      });

      const rootEntries = await Promise.all(
        Array.from(threadIds).map(async (threadId): Promise<[string, MatrixEvent | undefined]> => {
          const inWindow = inWindowRoots.get(threadId);
          if (inWindow) return [threadId, inWindow];
          try {
            const raw = await mx.fetchRoomEvent(room.roomId, threadId);
            return [threadId, raw ? await mapEvent(mx, raw) : undefined];
          } catch {
            return [threadId, undefined];
          }
        })
      );

      return rootEntries
        .map(([threadId, root]) => ({ threadId, root }))
        .filter(
          (entry): entry is { threadId: string; root: MatrixEvent } =>
            Boolean(
              entry.root &&
                !entry.root.isDecryptionFailure() &&
                entry.root.getType() === MessageEvent.RoomMessage &&
                typeof entry.root.getContent()?.body === 'string' &&
                (entry.root.getContent()?.body as string).trim()
            )
        )
        .slice(0, MAX_POSTS_PER_ROOM)
        .map(({ threadId, root }) => ({
          roomId: room.roomId,
          threadId,
          root,
          upvotes: 0,
          downvotes: 0,
          myVote: undefined,
          myReactionId: undefined,
          replyCount: 0,
          hot: 0,
        }));
    },
    [mx]
  );

  const enrichPost = useCallback(
    async (post: FeedPost): Promise<FeedPost> => {
      const me = mx.getSafeUserId();
      let upvotes = 0;
      let downvotes = 0;
      let myVote: FeedVote | undefined;
      let myReactionId: string | undefined;

      try {
        const reactions = await mx.relations(
          post.roomId,
          post.threadId,
          RelationType.Annotation,
          MessageEvent.Reaction
        );
        reactions.events.forEach((evt) => {
          const key = evt.getContent()?.['m.relates_to']?.key;
          const sender = evt.getSender();
          if (key === FEED_UP_KEY) {
            upvotes += 1;
            if (sender === me) {
              myVote = 'up';
              myReactionId = evt.getId();
            }
          } else if (key === FEED_DOWN_KEY) {
            downvotes += 1;
            if (sender === me) {
              myVote = 'down';
              myReactionId = evt.getId();
            }
          }
        });
      } catch {
        // no reactions visible
      }

      let replyCount = 0;
      try {
        const replies = await mx.relations(
          post.roomId,
          post.threadId,
          RelationType.Thread,
          undefined,
          { limit: RELATIONS_LIMIT }
        );
        replyCount = replies.events.length;
      } catch {
        // no replies visible
      }

      return {
        ...post,
        upvotes,
        downvotes,
        myVote,
        myReactionId,
        replyCount,
        hot: hotScore(upvotes - downvotes, post.root.getTs()),
      };
    },
    [mx]
  );

  const load = useCallback(async () => {
    const rooms = roomIds
      .map((roomId) => mx.getRoom(roomId))
      .filter(
        (room): room is Room => Boolean(room && !room.isSpaceRoom() && !mDirects.has(room.roomId))
      )
      .slice(0, MAX_ROOMS);

    const roomPosts = await mapBatched(rooms, 5, getRoomPosts);
    const collected = roomPosts.flat().slice(0, MAX_POSTS);
    const enriched = await mapBatched(collected, 8, enrichPost);

    if (aliveRef.current) setPosts(enriched);
  }, [mx, roomIds, mDirects, getRoomPosts, enrichPost]);

  useEffect(() => {
    aliveRef.current = true;
    setLoading(true);
    load().finally(() => {
      if (aliveRef.current) setLoading(false);
    });
    const interval = window.setInterval(() => setRefreshKey((key) => key + 1), REFRESH_INTERVAL);
    return () => {
      aliveRef.current = false;
      window.clearInterval(interval);
    };
  }, [load, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const applyVote = useCallback(
    (roomId: string, threadId: string, vote: FeedVote) => {
      setPosts((prev) =>
        prev.map((post) => {
          if (post.roomId !== roomId || post.threadId !== threadId) return post;

          if (post.myVote === vote) {
            if (post.myReactionId) mx.redactEvent(roomId, post.myReactionId);
            const next: FeedPost = {
              ...post,
              myVote: undefined,
              myReactionId: undefined,
              upvotes: Math.max(0, post.upvotes - (vote === 'up' ? 1 : 0)),
              downvotes: Math.max(0, post.downvotes - (vote === 'down' ? 1 : 0)),
            };
            next.hot = hotScore(getPostScore(next), post.root.getTs());
            return next;
          }

          if (post.myVote && post.myReactionId) mx.redactEvent(roomId, post.myReactionId);
          mx.sendEvent(roomId, EventType.Reaction, {
            'm.relates_to': {
              rel_type: RelationType.Annotation,
              event_id: threadId,
              key: vote === 'up' ? FEED_UP_KEY : FEED_DOWN_KEY,
            },
          });
          const wasUp = post.myVote === 'up';
          const wasDown = post.myVote === 'down';
          const next: FeedPost = {
            ...post,
            myVote: vote,
            myReactionId: undefined, // unknown until next refresh
            upvotes: Math.max(
              0,
              post.upvotes + (vote === 'up' ? 1 : 0) - (wasUp ? 1 : 0)
            ),
            downvotes: Math.max(
              0,
              post.downvotes + (vote === 'down' ? 1 : 0) - (wasDown ? 1 : 0)
            ),
          };
          next.hot = hotScore(getPostScore(next), post.root.getTs());
          return next;
        })
      );
    },
    [mx]
  );

  return { posts, loading, refresh, applyVote };
};
