import React, { useMemo, useRef } from 'react';
import { Box, Button, Icon, Icons, Text } from 'folds';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  NavCategory,
  NavCategoryHeader,
  NavEmptyCenter,
  NavEmptyLayout,
} from '../../../components/nav';
import { PageNav, PageNavContent, PageNavHeader } from '../../../components/page';
import { VirtualTile } from '../../../components/virtualizer';
import { RoomNavItem } from '../../../features/room-nav';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { factoryRoomIdByActivity } from '../../../utils/sort';
import { mDirectAtom } from '../../../state/mDirectList';
import { useRecentRooms } from './useRecentRooms';
import { getExplorePath, getHomeCreatePath, getRecentRoomPath } from '../../pathUtils';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';

function RecentEmpty() {
  const navigate = useNavigate();

  return (
    <NavEmptyCenter>
      <NavEmptyLayout
        icon={<Icon size="600" src={Icons.RecentClock} />}
        title={
          <Text size="H5" align="Center">
            No conversations
          </Text>
        }
        content={
          <Text size="T300" align="Center">
            Your joined rooms and direct chats will appear here.
          </Text>
        }
        options={
          <Box gap="200" wrap="Wrap" justifyContent="Center">
            <Button onClick={() => navigate(getExplorePath())} variant="Secondary" size="300">
              <Text size="B300">Explore community</Text>
            </Button>
            <Button
              onClick={() => navigate(getHomeCreatePath())}
              variant="Secondary"
              fill="Soft"
              size="300"
            >
              <Text size="B300">Create room</Text>
            </Button>
          </Box>
        }
      />
    </NavEmptyCenter>
  );
}

export function Recent() {
  const mx = useMatrixClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rooms = useRecentRooms();
  const mDirects = useAtomValue(mDirectAtom);
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const selectedRoomId = useSelectedRoom();

  useNavToActivePathMapper('recent');

  const sortedRooms = useMemo(() => [...rooms].sort(factoryRoomIdByActivity(mx)), [mx, rooms]);

  const virtualizer = useVirtualizer({
    count: sortedRooms.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 10,
  });

  return (
    <PageNav>
      <PageNavHeader>
        <Box grow="Yes" alignItems="Center">
          <Text size="H4" truncate>
            All conversations
          </Text>
        </Box>
      </PageNavHeader>
      {sortedRooms.length === 0 ? (
        <RecentEmpty />
      ) : (
        <PageNavContent scrollRef={scrollRef}>
          <NavCategory>
            <NavCategoryHeader>
              <Text size="L400">All conversations</Text>
            </NavCategoryHeader>
            <div style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((vItem) => {
                const roomId = sortedRooms[vItem.index];
                const room = mx.getRoom(roomId);
                if (!room) return null;

                const direct = mDirects.has(roomId);
                return (
                  <VirtualTile virtualItem={vItem} key={roomId} ref={virtualizer.measureElement}>
                    <RoomNavItem
                      room={room}
                      selected={selectedRoomId === roomId}
                      showAvatar={direct}
                      direct={direct}
                      linkPath={getRecentRoomPath(getCanonicalAliasOrRoomId(mx, roomId))}
                      notificationMode={getRoomNotificationMode(
                        notificationPreferences,
                        room.roomId
                      )}
                    />
                  </VirtualTile>
                );
              })}
            </div>
          </NavCategory>
        </PageNavContent>
      )}
    </PageNav>
  );
}
