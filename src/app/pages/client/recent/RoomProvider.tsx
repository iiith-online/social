import React, { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { useParams } from 'react-router-dom';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { IsDirectRoomProvider, RoomProvider } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { JoinBeforeNavigate } from '../../../features/join-before-navigate';
import { mDirectAtom } from '../../../state/mDirectList';
import { useSearchParamsViaServers } from '../../../hooks/router/useSearchParamsViaServers';
import { useRecentRooms } from './useRecentRooms';

export function RecentRouteRoomProvider({ children }: { children: ReactNode }) {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);
  const rooms = useRecentRooms();
  const { roomIdOrAlias, eventId } = useParams();
  const viaServers = useSearchParamsViaServers();
  const roomId = useSelectedRoom();
  const room = mx.getRoom(roomId);

  if (!room || !roomIdOrAlias || !rooms.includes(room.roomId)) {
    if (!roomIdOrAlias) return null;

    return (
      <JoinBeforeNavigate roomIdOrAlias={roomIdOrAlias} eventId={eventId} viaServers={viaServers} />
    );
  }

  return (
    <RoomProvider key={room.roomId} value={room}>
      <IsDirectRoomProvider value={mDirects.has(room.roomId)}>{children}</IsDirectRoomProvider>
    </RoomProvider>
  );
}
