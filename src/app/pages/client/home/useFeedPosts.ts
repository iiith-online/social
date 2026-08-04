import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

// Replies may carry their relation inside the encrypted payload or in the
// plaintext part of the event; check both so no reply is mistaken for a post.
export const getEventRelation = (evt: MatrixEvent): Record<string, unknown> | undefined =>
  (evt.getContent()?.['m.relates_to'] as Record<string, unknown> | undefined) ??
  (evt.getWireContent()?.['m.relates_to'] as Record<string, unknown> | undefined);

export const getInReplyToEventId = (
  relation: Record<string, unknown> | undefined
): string | undefined => {
  const inReplyTo = relation?.['m.in_reply_to'];
  if (!inReplyTo || typeof inReplyTo !== 'object') return undefined;
  const eventId = (inReplyTo as Record<string, unknown>).event_id;
  return typeof eventId === 'string' ? eventId : undefined;
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
  const relation = getEventRelation(evt);
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

export const fetchCommunityRoomIds = async (mx: MatrixClient): Promise<string[]> => {
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
};

export const getRoomPosts = async (
  mx: MatrixClient,
  room: Room
): Promise<{ posts: FeedPost[]; inlineComments: Map<string, number> }> => {
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
    return { posts: [], inlineComments: new Map() };
  }

  const events = await Promise.all(chunk.map((raw) => mapEvent(mx, raw)));

  // The server does not index m.in_reply_to relations, so inline replies
  // (how other clients reply) never surface via the relations endpoint.
  // Count them from the fetched window so they still register as comments.
  const inlineComments = new Map<string, number>();
  events.forEach((evt) => {
    if (evt.isDecryptionFailure() || evt.isRedacted()) return;
    const relation = getEventRelation(evt);
    if (!relation || relation.rel_type === RelationType.Thread) return;
    const target = getInReplyToEventId(relation);
    if (!target) return;
    inlineComments.set(target, (inlineComments.get(target) ?? 0) + 1);
  });

  return {
    posts: events
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
      })),
    inlineComments,
  };
};

export const enrichPost = async (
  mx: MatrixClient,
  post: FeedPost,
  inlineComments?: Map<string, number>
): Promise<FeedPost> => {
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
      if (evt.isRedacted()) return;
      const id = evt.getId();
      if (id) replyIds.add(id);
    });
    inlines?.events.forEach((evt) => {
      if (evt.isRedacted()) return;
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
    replyCount: replyIds.size + (inlineComments?.get(post.eventId) ?? 0),
  };
};

const makeApplyVote =
  (mx: MatrixClient, setPosts: Dispatch<SetStateAction<FeedPost[]>>) =>
  (roomId: string, eventId: string, vote: PostVote) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.roomId !== roomId || post.eventId !== eventId) return post;
        const nextVoteState = togglePostVote(mx, roomId, eventId, post, vote);
        return {
          ...post,
          ...nextVoteState,
          myVote: nextVoteState.myVote,
          myReactionId: nextVoteState.myReactionId,
          upvotes: nextVoteState.upvotes,
          downvotes: nextVoteState.downvotes,
        };
      })
    );
  };

// Rooms hydrate from the sync store asynchronously after login; retry until
// the client knows them (bounded), so the first load isn't empty.
const waitForCommunityRooms = (mx: MatrixClient, attemptsLeft: number): Promise<string[]> =>
  fetchCommunityRoomIds(mx).then((ids) => {
    if (ids.length > 0 || attemptsLeft <= 0) return ids;
    const { promise, resolve } = Promise.withResolvers<void>();
    window.setTimeout(resolve, 500);
    return promise.then(() => waitForCommunityRooms(mx, attemptsLeft - 1));
  });

const useFeedRefresh = (load: () => Promise<void>) => {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    load().finally(() => undefined);
    const interval = window.setInterval(() => setRefreshKey((key) => key + 1), REFRESH_INTERVAL);
    return () => {
      window.clearInterval(interval);
    };
  }, [load, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  return { refresh };
};

export const useFeedPosts = () => {
  const mx = useMatrixClient();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const ids = await waitForCommunityRooms(mx, 20);
    const rooms = ids
      .map((roomId) => mx.getRoom(roomId))
      .filter((room): room is Room => Boolean(room));

    const roomResults = await mapBatched(rooms, 5, (room) => getRoomPosts(mx, room));
    const inlineComments = roomResults.reduce(
      (merged, result) => {
        result.inlineComments.forEach((count, target) => {
          merged.set(target, (merged.get(target) ?? 0) + count);
        });
        return merged;
      },
      new Map<string, number>()
    );
    const collected = roomResults.flatMap((result) => result.posts).slice(0, MAX_POSTS);
    const enriched = await mapBatched(collected, 8, (post) =>
      enrichPost(mx, post, inlineComments)
    );

    setPosts(enriched);
    setLoading(false);
  }, [mx]);

  const { refresh } = useFeedRefresh(load);

  const applyVote = useMemo(() => makeApplyVote(mx, setPosts), [mx]);

  return { posts, loading, refresh, applyVote };
};

export const useRoomPosts = (roomId: string) => {
  const mx = useMatrixClient();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const room = mx.getRoom(roomId);
    if (!room) {
      setLoading(false);
      return;
    }
    const { posts: roomPosts, inlineComments } = await getRoomPosts(mx, room);
    const enriched = await mapBatched(roomPosts, 8, (post) =>
      enrichPost(mx, post, inlineComments)
    );
    setPosts(enriched);
    setLoading(false);
  }, [mx, roomId]);

  const { refresh } = useFeedRefresh(load);

  const applyVote = useMemo(() => makeApplyVote(mx, setPosts), [mx]);

  return { posts, loading, refresh, applyVote };
};
