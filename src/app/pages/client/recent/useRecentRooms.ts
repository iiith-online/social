import { RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { mDirectAtom } from '../../../state/mDirectList';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { Membership } from '../../../../types/matrix/room';
import { isRoom } from '../../../utils/room';

export const useRecentRooms = () => {
  const mx = useMatrixClient();
  const allRooms = useAtomValue(allRoomsAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const [, setActivityVersion] = useState(0);

  useEffect(() => {
    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = (
      _event,
      room,
      toStartOfTimeline,
      removed,
      data
    ) => {
      if (!room || toStartOfTimeline || removed || !data.liveEvent) return;
      setActivityVersion((version) => version + 1);
    };

    mx.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [mx]);

  const roomIds = new Set([...allRooms, ...mDirects]);
  return Array.from(roomIds).filter((roomId) => {
    const room = mx.getRoom(roomId);
    return room?.getMyMembership() === Membership.Join && isRoom(room);
  });
};
