import React, { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Box, Button, Icon, Icons, Scroll, Text, config, toRem } from 'folds';
import { Page, PageContent, PageHero, PageHeroSection } from '../../components/page';
import { NavItem, NavItemContent, NavLink } from '../../components/nav';
import { RoomAvatar } from '../../components/room-avatar';
import AppIcon from '../../../../public/icons/web/icon-512.png';
import { useHomeRooms } from './home/useHomeRooms';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useRoomsUnread } from '../../state/hooks/unread';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { Unread } from '../../../types/matrix/room';
import { factoryRoomIdByMessageActivity } from '../../utils/sort';
import { getCanonicalAliasOrRoomId } from '../../utils/matrix';
import { getRoomAvatarUrl } from '../../utils/room';
import {
  getExplorePath,
  getHomeCreatePath,
  getHomeRoomPath,
  getHomeSearchPath,
} from '../pathUtils';
import { nameInitials } from '../../utils/common';
import { SequenceCard } from '../../components/sequence-card';
import { SequenceCardStyle } from '../../features/settings/styles.css';

function UnreadSummary({ unread }: { unread?: Unread }) {
  if (!unread || (unread.total === 0 && unread.highlight === 0)) return null;

  return (
    <Box as="span" alignItems="Center" gap="100" shrink="No">
      {unread.total > 0 && (
        <Badge variant="Secondary" fill="Solid" size="400" radii="Pill">
          <Text as="span" size="L400">
            {unread.total > 99 ? '99+' : unread.total}
          </Text>
        </Badge>
      )}
      {unread.highlight > 0 && (
        <Badge variant="Success" fill="Solid" size="400" radii="Pill">
          <Text as="span" size="L400">
            @{unread.highlight > 99 ? '99+' : unread.highlight}
          </Text>
        </Badge>
      )}
    </Box>
  );
}

function DashboardRoom({
  mx,
  room,
  unread,
  useAuthentication,
}: {
  mx: ReturnType<typeof useMatrixClient>;
  room: Room;
  unread?: Unread;
  useAuthentication: boolean;
}) {
  const roomName = useRoomName(room);
  const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);

  return (
    <NavItem variant="Background" radii="400">
      <NavLink to={getHomeRoomPath(roomIdOrAlias)}>
        <Box grow="Yes" alignItems="Center" gap="200" style={{ padding: config.space.S100 }}>
          <Avatar size="300" radii="300">
            <RoomAvatar
              roomId={room.roomId}
              src={getRoomAvatarUrl(mx, room, 96, useAuthentication)}
              alt=""
              renderFallback={() => <Text size="H6">{nameInitials(roomName)}</Text>}
            />
          </Avatar>
          <Box grow="Yes" direction="Column" gap="100">
            <NavItemContent truncate>{roomName}</NavItemContent>
            <Text size="T200" priority="400" truncate>
              {roomIdOrAlias}
            </Text>
          </Box>
          <UnreadSummary unread={unread} />
        </Box>
      </NavLink>
    </NavItem>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="100"
      style={{ flex: '1 1 11rem', minWidth: toRem(160), padding: config.space.S300 }}
    >
      <Text size="T300" priority="400">
        {label}
      </Text>
      <Text size="H2">{value > 999 ? '999+' : value}</Text>
    </SequenceCard>
  );
}

function HomeDashboard() {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const navigate = useNavigate();
  const rooms = useHomeRooms();
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const totalUnread = useRoomsUnread(rooms, roomToUnreadAtom);

  const recentRoomIds = useMemo(
    () =>
      rooms
        .filter((roomId) => mx.getRoom(roomId))
        .sort(factoryRoomIdByMessageActivity(mx))
        .slice(0, 6),
    [mx, rooms]
  );
  const unreadRoomIds = useMemo(
    () =>
      rooms
        .filter((roomId) => {
          const unread = roomToUnread.get(roomId);
          return unread && (unread.total > 0 || unread.highlight > 0);
        })
        .sort((a, b) => {
          const aUnread = roomToUnread.get(a);
          const bUnread = roomToUnread.get(b);
          return (bUnread?.total ?? 0) - (aUnread?.total ?? 0);
        })
        .slice(0, 5),
    [roomToUnread, rooms]
  );

  const getRoom = (roomId: string) => mx.getRoom(roomId);

  return (
    <Page>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box
              direction="Column"
              gap="600"
              style={{ maxWidth: toRem(900), margin: '0 auto', paddingBottom: config.space.S700 }}
            >
              <Box direction="Column" gap="100">
                <Text size="H2">Welcome back</Text>
                <Text size="T300" priority="400">
                  Pick up where you left off in IIIT social.
                </Text>
              </Box>

              <Box gap="300" wrap="Wrap">
                <SummaryCard label="Unread messages" value={totalUnread?.total ?? 0} />
                <SummaryCard label="Mentions" value={totalUnread?.highlight ?? 0} />
              </Box>

              <Box direction="Column" gap="200">
                <Text size="L400">Quick actions</Text>
                <Box gap="200" wrap="Wrap">
                  <Button
                    variant="Secondary"
                    fill="Soft"
                    size="300"
                    before={<Icon size="200" src={Icons.Plus} />}
                    onClick={() => navigate(getHomeCreatePath())}
                  >
                    <Text size="B300">Create room</Text>
                  </Button>
                  <Button
                    variant="Secondary"
                    fill="Soft"
                    size="300"
                    before={<Icon size="200" src={Icons.Search} />}
                    onClick={() => navigate(getHomeSearchPath())}
                  >
                    <Text size="B300">Search messages</Text>
                  </Button>
                  <Button
                    variant="Secondary"
                    fill="Soft"
                    size="300"
                    before={<Icon size="200" src={Icons.Explore} />}
                    onClick={() => navigate(getExplorePath())}
                  >
                    <Text size="B300">Explore rooms</Text>
                  </Button>
                </Box>
              </Box>

              <Box direction="Column" gap="200">
                <Box alignItems="Center" justifyContent="SpaceBetween">
                  <Text size="L400">Recent rooms</Text>
                  <Text size="T200" priority="400">
                    {recentRoomIds.length} shown
                  </Text>
                </Box>
                {recentRoomIds.length > 0 ? (
                  <Box direction="Column" gap="100">
                    {recentRoomIds.map((roomId) => {
                      const room = getRoom(roomId);
                      if (!room) return null;
                      return (
                        <DashboardRoom
                          key={roomId}
                          mx={mx}
                          room={room}
                          unread={roomToUnread.get(roomId)}
                          useAuthentication={useAuthentication}
                        />
                      );
                    })}
                  </Box>
                ) : (
                  <Text size="T300" priority="400">
                    Your recent rooms will appear here.
                  </Text>
                )}
              </Box>

              <Box direction="Column" gap="200">
                <Text size="L400">Unread messages</Text>
                {unreadRoomIds.length > 0 ? (
                  <Box direction="Column" gap="100">
                    {unreadRoomIds.map((roomId) => {
                      const room = getRoom(roomId);
                      if (!room) return null;
                      return (
                        <DashboardRoom
                          key={roomId}
                          mx={mx}
                          room={room}
                          unread={roomToUnread.get(roomId)}
                          useAuthentication={useAuthentication}
                        />
                      );
                    })}
                  </Box>
                ) : (
                  <Text size="T300" priority="400">
                    You are all caught up.
                  </Text>
                )}
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}

export function WelcomePage({ homeDashboard = false }: { homeDashboard?: boolean }) {
  if (homeDashboard) return <HomeDashboard />;

  return (
    <Page>
      <Box
        grow="Yes"
        style={{ padding: config.space.S400, paddingBottom: config.space.S700 }}
        alignItems="Center"
        justifyContent="Center"
      >
        <PageHeroSection>
          <PageHero
            icon={
              <img
                width="140"
                height="72"
                style={{ objectFit: 'contain' }}
                src={AppIcon}
                alt="IIIT social logo"
              />
            }
            title="Welcome to IIIT social"
            subTitle={<span>A secure Matrix client for IIIT communities. v4.12.3</span>}
          >
            <Box justifyContent="Center">
              <Box grow="Yes" style={{ maxWidth: toRem(300) }} direction="Column" gap="300">
                <Button
                  as="a"
                  href="https://matrix.org"
                  target="_blank"
                  rel="noreferrer noopener"
                  fill="Soft"
                  before={<Icon size="200" src={Icons.Heart} />}
                >
                  <Text as="span" size="B400" truncate>
                    Support
                  </Text>
                </Button>
              </Box>
            </Box>
          </PageHero>
        </PageHeroSection>
      </Box>
    </Page>
  );
}
