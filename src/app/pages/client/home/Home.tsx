import React, { MouseEventHandler, forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import {
  Box,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  config,
  toRem,
} from 'folds';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { useAtom, useAtomValue } from 'jotai';
import FocusTrap from 'focus-trap-react';
import { factoryRoomIdByAtoZ, factoryRoomIdByMessageActivity } from '../../../utils/sort';
import { NavCategory, NavCategoryHeader, NavEmptyCenter, NavEmptyLayout } from '../../../components/nav';
import { getHomeRoomPath } from '../../pathUtils';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { useHomeRooms } from './useHomeRooms';
import { useRecentRooms } from '../recent/useRecentRooms';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { mDirectAtom } from '../../../state/mDirectList';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { VirtualTile } from '../../../components/virtualizer';
import { RoomNavCategoryButton, RoomNavItem } from '../../../features/room-nav';
import { makeNavCategoryId } from '../../../state/closedNavCategories';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useCategoryHandler } from '../../../hooks/useCategoryHandler';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { PageNav, PageNavHeader, PageNavContent } from '../../../components/page';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { markAsRead } from '../../../utils/notifications';
import { useClosedNavCategoriesAtom } from '../../../state/hooks/closedNavCategories';
import { stopPropagation } from '../../../utils/keyboard';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { Feed } from './Feed';

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

function HomeEmpty() {
  return (
    <NavEmptyCenter>
      <NavEmptyLayout
        icon={<Icon size="600" src={Icons.Hash} />}
        title={
          <Text size="H5" align="Center">
            No Rooms
          </Text>
        }
        content={
          <Text size="T300" align="Center">
            You do not have any rooms yet.
          </Text>
        }
      />
    </NavEmptyCenter>
  );
}

const DEFAULT_CATEGORY_ID = makeNavCategoryId('home', 'room');
const RECENT_CATEGORY_ID = makeNavCategoryId('home', 'recent');

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

function HomeRoomsList() {
  const mx = useMatrixClient();
  useNavToActivePathMapper('home');
  const scrollRef = useRef<HTMLDivElement>(null);
  const rooms = useHomeRooms();
  const recentRooms = useRecentRooms();
  const mDirects = useAtomValue(mDirectAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const notificationPreferences = useRoomsNotificationPreferencesContext();

  const selectedRoomId = useSelectedRoom();
  const noRoomToDisplay = rooms.length === 0 && recentRooms.length === 0;
  const [closedCategories, setClosedCategories] = useAtom(useClosedNavCategoriesAtom());
  const categoryDefaultsApplied = useRef(false);

  useEffect(() => {
    if (categoryDefaultsApplied.current) return;
    categoryDefaultsApplied.current = true;
    if (!closedCategories.has(DEFAULT_CATEGORY_ID)) {
      setClosedCategories({ type: 'PUT', categoryId: DEFAULT_CATEGORY_ID });
    }
  }, [closedCategories, setClosedCategories]);

  const recentCategoryClosed = closedCategories.has(RECENT_CATEGORY_ID);
  const roomsCategoryClosed =
    !categoryDefaultsApplied.current || closedCategories.has(DEFAULT_CATEGORY_ID);

  const sortedRecentRooms = useMemo(
    () =>
      recentCategoryClosed ? [] : Array.from(recentRooms).sort(factoryRoomIdByMessageActivity(mx)),
    [mx, recentCategoryClosed, recentRooms]
  );

  const sortedRooms = useMemo(() => {
    if (roomsCategoryClosed) return [];
    return Array.from(rooms).sort(factoryRoomIdByAtoZ(mx));
  }, [mx, rooms, roomsCategoryClosed]);

  const recentVirtualizer = useVirtualizer({
    count: sortedRecentRooms.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const virtualizer = useVirtualizer({
    count: sortedRooms.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 10,
  });

  const handleCategoryClick = useCategoryHandler(setClosedCategories, (categoryId) =>
    closedCategories.has(categoryId)
  );

  const renderRecentRoom = (vItem: VirtualItem) => {
    const roomId = sortedRecentRooms[vItem.index];
    const room = mx.getRoom(roomId);
    if (!room) return null;

    const direct = mDirects.has(roomId);
    const space = getRoomSpace(mx, roomToParents, roomId);
    return (
      <VirtualTile virtualItem={vItem} key={roomId} ref={recentVirtualizer.measureElement}>
        <RoomNavItem
          room={room}
          selected={selectedRoomId === roomId}
          showAvatar={direct}
          avatarRoom={space}
          direct={direct}
          spaceName={getRoomSpaceName(mx, roomToParents, roomId)}
          style={{ minHeight: toRem(44) }}
          linkPath={getHomeRoomPath(getCanonicalAliasOrRoomId(mx, roomId))}
          notificationMode={getRoomNotificationMode(notificationPreferences, room.roomId)}
        />
      </VirtualTile>
    );
  };

  return (
    <PageNav>
      <HomeHeader />
      {noRoomToDisplay && <HomeEmpty />}
      {!noRoomToDisplay && (
        <PageNavContent scrollRef={scrollRef}>
          <Box direction="Column" gap="300">
            <NavCategory>
              <NavCategoryHeader>
                <RoomNavCategoryButton
                  closed={closedCategories.has(DEFAULT_CATEGORY_ID)}
                  data-category-id={DEFAULT_CATEGORY_ID}
                  onClick={handleCategoryClick}
                >
                  Rooms
                </RoomNavCategoryButton>
              </NavCategoryHeader>
              <div
                style={{
                  position: 'relative',
                  height: virtualizer.getTotalSize(),
                }}
              >
                {virtualizer.getVirtualItems().map((vItem) => {
                  const roomId = sortedRooms[vItem.index];
                  const room = mx.getRoom(roomId);
                  if (!room) return null;
                  const selected = selectedRoomId === roomId;

                  return (
                    <VirtualTile
                      virtualItem={vItem}
                      key={vItem.index}
                      ref={virtualizer.measureElement}
                    >
                      <RoomNavItem
                        room={room}
                        selected={selected}
                        linkPath={getHomeRoomPath(getCanonicalAliasOrRoomId(mx, roomId))}
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
            <NavCategory>
              <NavCategoryHeader style={{ marginBottom: config.space.S100 }}>
                <RoomNavCategoryButton
                  closed={recentCategoryClosed}
                  data-category-id={RECENT_CATEGORY_ID}
                  onClick={handleCategoryClick}
                >
                  All conversations
                </RoomNavCategoryButton>
              </NavCategoryHeader>
              <div
                style={{
                  position: 'relative',
                  height: recentVirtualizer.getTotalSize(),
                }}
              >
                {recentVirtualizer.getVirtualItems().map((vItem) => renderRecentRoom(vItem))}
              </div>
            </NavCategory>
          </Box>
        </PageNavContent>
      )}
    </PageNav>
  );
}

export function Home() {
  const screenSize = useScreenSizeContext();

  // On mobile the Home page IS the feed; on desktop the feed is the home
  // content and the nav column lists rooms for chat access.
  if (screenSize === ScreenSize.Mobile) {
    return (
      <PageNav>
        <HomeHeader />
        <Feed />
      </PageNav>
    );
  }

  return <HomeRoomsList />;
}
