import React, { MouseEventHandler, forwardRef, useRef, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { Box, Icon, IconButton, Icons, Menu, MenuItem, PopOut, RectCords, Text, config, toRem } from 'folds';
import { useAtomValue } from 'jotai';
import FocusTrap from 'focus-trap-react';
import { getHomeRoomPath } from '../../pathUtils';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { mDirectAtom } from '../../../state/mDirectList';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { RoomNavItem } from '../../../features/room-nav';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { PageNav, PageNavHeader, PageNavContent } from '../../../components/page';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { markAsRead } from '../../../utils/notifications';
import { stopPropagation } from '../../../utils/keyboard';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { useHomeRooms } from './useHomeRooms';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { Feed } from './Feed';
import { useCommunityRoomIds } from './useCommunityRooms';

type HomeMenuProps = {
  requestClose: () => void;
};
const HomeMenu = forwardRef<HTMLDivElement, HomeMenuProps>(({ requestClose }, ref) => {
  const orphanRooms = useHomeRooms();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const unread = useRoomsUnread(orphanRooms, roomToUnreadAtom);
  const mx = useMatrixClient();

  const handleMarkAsRead = () => {
    if (!unread) return;
    orphanRooms.forEach((rId) => markAsRead(mx, rId, hideActivity));
    requestClose();
  };

  return (
    <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={handleMarkAsRead}
          size="300"
          after={<Icon size="100" src={Icons.CheckTwice} />}
          radii="300"
          aria-disabled={!unread}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Mark as Read
          </Text>
        </MenuItem>
      </Box>
    </Menu>
  );
});

function HomeHeader() {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <>
      <PageNavHeader data-ui-option-home-header>
        <Box alignItems="Center" grow="Yes" gap="300">
          <Box grow="Yes">
            <Text size="H4" truncate>
              Home
            </Text>
          </Box>
          <Box>
            <IconButton
              aria-label="Home options"
              aria-pressed={!!menuAnchor}
              variant="Background"
              onClick={handleOpenMenu}
            >
              <Icon src={Icons.VerticalDots} size="200" />
            </IconButton>
          </Box>
        </Box>
      </PageNavHeader>
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={6}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              returnFocusOnDeactivate: false,
              onDeactivate: () => setMenuAnchor(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
              isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
              escapeDeactivates: stopPropagation,
            }}
          >
            <HomeMenu requestClose={() => setMenuAnchor(undefined)} />
          </FocusTrap>
        }
      />
    </>
  );
}

const getRoomSpaceName = (
  mx: ReturnType<typeof useMatrixClient>,
  roomToParents: Map<string, Set<string>>,
  roomId: string
) => {
  const parentIds = roomToParents.get(roomId);
  if (!parentIds) return undefined;

  const names = Array.from(parentIds)
    .map((parentId) => mx.getRoom(parentId)?.name)
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names.join(' · ') : undefined;
};

const getRoomSpace = (
  mx: ReturnType<typeof useMatrixClient>,
  roomToParents: Map<string, Set<string>>,
  roomId: string
): Room | undefined =>
  Array.from(roomToParents.get(roomId) ?? [])
    .map((parentId) => mx.getRoom(parentId))
    .find((space): space is Room => Boolean(space?.isSpaceRoom()));

function CommunityRoomsList() {
  const mx = useMatrixClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const communityRoomIds = useCommunityRoomIds();
  const mDirects = useAtomValue(mDirectAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const selectedRoomId = useSelectedRoom();

  return (
    <PageNav>
      <HomeHeader />
      <PageNavContent scrollRef={scrollRef}>
        <Box direction="Column" gap="100">
          {communityRoomIds.length === 0 ? (
            <Box justifyContent="Center" style={{ padding: config.space.S300 }}>
              <Text size="T300" priority="400" align="Center">
                No rooms in the community yet.
              </Text>
            </Box>
          ) : (
            communityRoomIds.map((roomId) => {
              const room = mx.getRoom(roomId);
              if (!room) return null;
              const direct = mDirects.has(roomId);
              const space = getRoomSpace(mx, roomToParents, roomId);
              return (
                <RoomNavItem
                  key={roomId}
                  room={room}
                  selected={selectedRoomId === roomId}
                  showAvatar={direct}
                  avatarRoom={space}
                  direct={direct}
                  spaceName={getRoomSpaceName(mx, roomToParents, roomId)}
                  linkPath={getHomeRoomPath(getCanonicalAliasOrRoomId(mx, roomId))}
                  notificationMode={getRoomNotificationMode(notificationPreferences, room.roomId)}
                />
              );
            })
          )}
        </Box>
      </PageNavContent>
    </PageNav>
  );
}

export function Home() {
  const screenSize = useScreenSizeContext();

  // On mobile the Home page IS the feed; on desktop the feed is the home
  // content and the nav column lists the community rooms.
  if (screenSize === ScreenSize.Mobile) {
    return (
      <PageNav>
        <HomeHeader />
        <Feed />
      </PageNav>
    );
  }

  return <CommunityRoomsList />;
}
