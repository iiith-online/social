import { useCallback, useEffect, useRef, useState } from 'react';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import {
  collectInlineComments,
  enrichPost,
  FeedPost,
  getPinnedEventIds,
  isPostEvent,
  mapBatched,
  pageRoomHistory,
  waitForCommunityRooms,
} from './useFeedPosts';

const SEARCH_PAGES_PER_ROOM = 3;
const SEARCH_MAX_RESULTS = 50;
const DEBOUNCE_MS = 400;

// E2EE rooms cannot be indexed server-side, so search pages room history
// client-side and matches post title/body against the query.
const runSearch = async (mx: MatrixClient, term: string): Promise<FeedPost[]> => {
  const ids = await waitForCommunityRooms(mx, 20);
  const rooms = ids
    .map((roomId) => mx.getRoom(roomId))
    .filter((room): room is Room => Boolean(room));

  const matches: FeedPost[] = [];
  const seen = new Set<string>();
  const inlineCounts = new Map<string, number>();
  const counted = new Set<string>();

  const scanRoom = (room: Room, from: string | null, depth: number): Promise<void> => {
    if (depth <= 0 || matches.length >= SEARCH_MAX_RESULTS) return Promise.resolve();
    return pageRoomHistory(mx, room, from).then((page) => {
      collectInlineComments(room.roomId, page.events, inlineCounts, counted);
      const pinned = getPinnedEventIds(room);
      page.events.forEach((evt) => {
        if (!isPostEvent(evt) || matches.length >= SEARCH_MAX_RESULTS) return;
        const id = evt.getId();
        if (!id) return;
        const body = typeof evt.getContent()?.body === 'string' ? evt.getContent().body : '';
        if (!body.toLowerCase().includes(term)) return;
        const key = `${room.roomId}:${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        matches.push({
          roomId: room.roomId,
          eventId: id,
          root: evt,
          upvotes: 0,
          downvotes: 0,
          myVote: undefined,
          myReactionId: undefined,
          replyCount: 0,
          pinned: pinned.has(id),
        });
      });
      if (!page.nextToken) return Promise.resolve();
      return scanRoom(room, page.nextToken, depth - 1);
    });
  };

  await mapBatched(rooms, 5, (room) => scanRoom(room, null, SEARCH_PAGES_PER_ROOM));
  return mapBatched(matches, 8, (post) => enrichPost(mx, post, inlineCounts));
};

export const useSearchPosts = () => {
  const mx = useMatrixClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FeedPost[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
    },
    []
  );

  const search = useCallback(
    (term: string) => {
      window.clearTimeout(timerRef.current);
      const trimmed = term.trim().toLowerCase();
      setQuery(term);
      if (!trimmed) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      timerRef.current = window.setTimeout(() => {
        runSearch(mx, trimmed)
          .then(setResults)
          .finally(() => setSearching(false));
      }, DEBOUNCE_MS);
    },
    [mx]
  );

  return { query, results, searching, search };
};
