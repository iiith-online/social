import { RoomToParents } from '../../types/matrix/room';

// The single community this app serves: everything (feed, notifications,
// auto-join) is scoped to this space and its room subtree.
export const COMMUNITY_SPACE_ID = '!y0BHB4cmD2DaPooiNn:matrix.iiit.ac.in';
export const COMMUNITY_SPACE_VIA_SERVERS = ['matrix.iiit.ac.in'];

// Whether a room belongs to the community space's subtree (the space itself
// included), walking the parent chain from roomToParents.
export const isRoomInCommunity = (
  roomToParents: RoomToParents,
  roomId: string
): boolean => {
  const walk = (id: string, visited: Set<string>): boolean => {
    if (id === COMMUNITY_SPACE_ID) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const parents = roomToParents.get(id);
    if (!parents) return false;
    return Array.from(parents).some((parentId) => walk(parentId, visited));
  };
  return walk(roomId, new Set());
};
