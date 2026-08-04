import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Text } from 'folds';
import { SidebarAvatar, SidebarItem, SidebarItemBadge, SidebarItemTooltip } from '../../../components/sidebar';
import { RoomUnreadProvider } from '../../../components/RoomUnreadProvider';
import { UnreadBadge } from '../../../components/unread-badge';
import { RoomAvatar } from '../../../components/room-avatar';
import { useCommunityRoomIds } from '../home/useCommunityRooms';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { getHomeRoomPath } from '../../pathUtils';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { getRoomAvatarUrl } from '../../../utils/room';
import { nameInitials } from '../../../utils/common';

export function CommunityRoomsNav() {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const navigate = useNavigate();
  const communityRoomIds = useCommunityRoomIds();
  const selectedRoomId = useSelectedRoom();

  const handleOpen = useCallback(
    (roomId: string) => {
      navigate(getHomeRoomPath(getCanonicalAliasOrRoomId(mx, roomId)));
    },
    [mx, navigate]
  );

  return (
    <>
      {communityRoomIds.map((roomId) => {
        const room = mx.getRoom(roomId);
        if (!room) return null;
        const roomName = room.name ?? roomId;
        return (
          <RoomUnreadProvider key={roomId} roomId={roomId}>
            {(unread) => (
              <SidebarItem active={selectedRoomId === roomId}>
                <SidebarItemTooltip tooltip={roomName}>
                  {(triggerRef) => (
                    <SidebarAvatar
                      as="button"
                      ref={triggerRef}
                      aria-label={roomName}
                      size="400"
                      onClick={() => handleOpen(roomId)}
                    >
                      <RoomAvatar
                        roomId={roomId}
                        src={getRoomAvatarUrl(mx, room, 96, useAuthentication) ?? undefined}
                        alt={roomName}
                        renderFallback={() => (
                          <Text size="H4">{nameInitials(roomName, 2)}</Text>
                        )}
                      />
                    </SidebarAvatar>
                  )}
                </SidebarItemTooltip>
                {unread && (
                  <SidebarItemBadge hasCount={unread.total > 0}>
                    <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
                  </SidebarItemBadge>
                )}
              </SidebarItem>
            )}
          </RoomUnreadProvider>
        );
      })}
    </>
  );
}
