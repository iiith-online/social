import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Direction,
  IEvent,
  MatrixClient,
  MatrixEvent,
  RelationType,
  Room,
} from 'matrix-js-sdk';
import to from 'await-to-js';
import { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { COMMUNITY_SPACE_ID } from '../../../state/communitySpace';
import { MessageEvent } from '../../../../types/matrix/room';
import { getPostVoteState, togglePostVote, PostVote } from '../../../utils/postVote';

export { POST_UP_KEY as FEED_UP_KEY, POST_DOWN_KEY as FEED_DOWN_KEY } from '../../../utils/postVote';

export type FeedPost = {
  roomId: string;
  eventId: string;
  root: MatrixEvent;
  upvotes: number;
  downvotes: number;
  myVote?: PostVote;
  myReactionId?: string;
  replyCount: number;
};

const TIMELINE_LIMIT = 100;
const MAX_ROOMS = 60;
const MAX_POSTS_PER_ROOM = 20;
const MAX_POSTS = 60;
const RELATIONS_LIMIT = 100;
const REFRESH_INTERVAL = 60_000;

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

// Every message in a community room is a post. Replies (thread or inline)
// and edits are not posts — they are comments on the message they target.
const isPostEvent = (evt: MatrixEvent): boolean => {
  if (evt.isDecryptionFailure()) return false;
  const type = evt.getType();
  if (type !== MessageEvent.RoomMessage && type !== MessageEvent.RoomMessageEncrypted) {
    return false;
  }
  const content = evt.getContent();
  if (typeof content?.body !== 'string' || !content.body.trim()) return false;
  const relation = content['m.relates_to'];
  if (!relation) return true;
  return !(
    relation.rel_type === RelationType.Thread ||
    relation.rel_type === RelationType.Replace ||
    Boolean(relation['m.in_reply_to'])
  );
};

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

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const aliveRef = useRef(true);

  const fetchCommunityRoomIds = useCallback(async (): Promise<string[]> => {
    try {
      const hierarchy = await mx.getRoomHierarchy(COMMUNITY_SPACE_ID);
      return hierarchy.rooms
        .map((room) => room.room_id)
        .filter((roomId) => {
          const room = mx.getRoom(roomId);
          return Boolean(room && !room.isSpaceRoom());
        });
    } catch {
      return [];
    }
  }, [mx]);

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
      return events
        .filter(isPostEvent)
        .filter((evt) => Boolean(evt.getId()))
        .slice(0, MAX_POSTS_PER_ROOM)
        .map((root) => ({
          roomId: room.roomId,
          eventId: root.getId() ?? '',
          root,
          upvotes: 0,
          downvotes: 0,
          myVote: undefined,
          myReactionId: undefined,
          replyCount: 0,
        }));
    },
    [mx]
  );

  const enrichPost = useCallback(
    async (post: FeedPost): Promise<FeedPost> => {
      const voteState = await getPostVoteState(mx, post.roomId, post.eventId);

      // Comments are replies: thread relations plus inline replies, deduped.
      const replyIds = new Set<string>();
      try {
        const [threads, inlines] = await Promise.all([
          mx
            .relations(post.roomId, post.eventId, RelationType.Thread, undefined, {
              limit: RELATIONS_LIMIT,
            })
            .catch(() => null),
          mx
            .relations(post.roomId, post.eventId, 'm.in_reply_to', undefined, {
              limit: RELATIONS_LIMIT,
            })
            .catch(() => null),
        ]);
        threads?.events.forEach((evt) => {
          const id = evt.getId();
          if (id) replyIds.add(id);
        });
        inlines?.events.forEach((evt) => {
          const id = evt.getId();
          if (id) replyIds.add(id);
        });
      } catch {
        // no replies visible
      }

      const { upvotes, downvotes } = voteState;
      return {
        ...post,
        upvotes,
        downvotes,
        myVote: voteState.myVote,
        myReactionId: voteState.myReactionId,
        replyCount: replyIds.size,
      };
    },
    [mx]
  );

  // Rooms hydrate from the sync store asynchronously after login; retry until
  // the client knows them (bounded), so the first feed load isn't empty.
  const waitForCommunityRooms = useCallback(
    (attemptsLeft: number): Promise<string[]> =>
      fetchCommunityRoomIds().then((ids) => {
        if (ids.length > 0 || attemptsLeft <= 0) return ids;
        const { promise, resolve } = Promise.withResolvers<void>();
        window.setTimeout(resolve, 500);
        return promise.then(() => waitForCommunityRooms(attemptsLeft - 1));
      }),
    [fetchCommunityRoomIds]
  );

  const load = useCallback(async () => {
    const ids = await waitForCommunityRooms(20);

    const rooms = ids
      .map((roomId) => mx.getRoom(roomId))
      .filter((room): room is Room => Boolean(room))
      .slice(0, MAX_ROOMS);

    const roomPosts = await mapBatched(rooms, 5, getRoomPosts);
    const collected = roomPosts.flat().slice(0, MAX_POSTS);
    const enriched = await mapBatched(collected, 8, enrichPost);

    if (aliveRef.current) setPosts(enriched);
  }, [mx, waitForCommunityRooms, getRoomPosts, enrichPost]);

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
    (roomId: string, eventId: string, vote: PostVote) => {
      setPosts((prev) =>
        prev.map((post) => {
          if (post.roomId !== roomId || post.eventId !== eventId) return post;
          const nextVoteState = togglePostVote(mx, roomId, eventId, post, vote);
          const next: FeedPost = {
            ...post,
            ...nextVoteState,
            myVote: nextVoteState.myVote,
            myReactionId: nextVoteState.myReactionId,
            upvotes: nextVoteState.upvotes,
            downvotes: nextVoteState.downvotes,
          };
          return next;
        })
      );
    },
    [mx]
  );

  return { posts, loading, refresh, applyVote };
};
