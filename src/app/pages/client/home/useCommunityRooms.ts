import { useEffect, useState } from 'react';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { fetchCommunityRoomIds } from './useFeedPosts';

const REFRESH_INTERVAL = 60_000;

// Community rooms hydrate from the sync store asynchronously after login;
// retry until the client knows them (bounded), then refresh on an interval.
const waitForCommunityRooms = (
  fetchIds: () => Promise<string[]>,
  attemptsLeft: number
): Promise<string[]> =>
  fetchIds().then((ids) => {
    if (ids.length > 0 || attemptsLeft <= 0) return ids;
    const { promise, resolve } = Promise.withResolvers<void>();
    window.setTimeout(resolve, 500);
    return promise.then(() => waitForCommunityRooms(fetchIds, attemptsLeft - 1));
  });

export const useCommunityRoomIds = (): string[] => {
  const mx = useMatrixClient();
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    waitForCommunityRooms(() => fetchCommunityRoomIds(mx), 20).then(setRoomIds);
    const interval = window.setInterval(() => setRefreshKey((key) => key + 1), REFRESH_INTERVAL);
    return () => {
      window.clearInterval(interval);
    };
  }, [mx, refreshKey]);

  return roomIds;
};
