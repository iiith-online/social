import React, { CSSProperties, MouseEventHandler, forwardRef, useEffect, useState } from 'react';
import { MatrixEvent, MatrixEventEvent, Room, RoomEvent } from 'matrix-js-sdk';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  Text,
  Menu,
  MenuItem,
  config,
  PopOut,
  toRem,
  Line,
  RectCords,
  Badge,
  Spinner,
} from 'folds';
import { useFocusWithin, useHover } from 'react-aria';
import FocusTrap from 'focus-trap-react';
import { useAtom, useAtomValue } from 'jotai';
import { NavItem, NavItemContent, NavItemOptions, NavLink } from '../../components/nav';
import { UnreadBadge, UnreadBadgeCenter } from '../../components/unread-badge';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import {
  getDirectRoomAvatarUrl,
  getRoomAvatarUrl,
  getStateEvent,
  reactionOrEditEvent,
} from '../../utils/room';
import { nameInitials } from '../../utils/common';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomUnread } from '../../state/hooks/unread';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { getPowersLevelFromMatrixEvent, usePowerLevels } from '../../hooks/usePowerLevels';
import { copyToClipboard } from '../../utils/dom';
import { markAsRead } from '../../utils/notifications';
import { UseStateProvider } from '../../components/UseStateProvider';
import { LeaveRoomPrompt } from '../../components/leave-room-prompt';
import { useRoomTypingMember } from '../../hooks/useRoomTypingMembers';
import { TypingIndicator } from '../../components/typing-indicator';
import { stopPropagation } from '../../utils/keyboard';
import { getMatrixToRoom } from '../../plugins/matrix-to';
import { getCanonicalAliasOrRoomId, isRoomAlias } from '../../utils/matrix';
import { getViaServers } from '../../plugins/via-servers';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useOpenRoomSettings } from '../../state/hooks/roomSettings';
import { useSpaceOptionally } from '../../hooks/useSpace';
import {
  getRoomNotificationModeIcon,
  RoomNotificationMode,
} from '../../hooks/useRoomsNotificationPreferences';
import { RoomNotificationModeSwitcher } from '../../components/RoomNotificationSwitcher';
import { getRoomCreatorsForRoomId, useRoomCreators } from '../../hooks/useRoomCreators';
import { getRoomPermissionsAPI, useRoomPermissions } from '../../hooks/useRoomPermissions';
import { InviteUserPrompt } from '../../components/invite-user-prompt';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { useCallEmbed, useCallStart } from '../../hooks/useCallEmbed';
import { callChatAtom } from '../../state/callEmbed';
import { useCallPreferencesAtom } from '../../state/hooks/callPreferences';
import { roomIdToMsgDraftAtomFamily } from '../../state/room/roomInputDrafts';
import { useAutoDiscoveryInfo } from '../../hooks/useAutoDiscoveryInfo';
import { livekitSupport } from '../../hooks/useLivekitSupport';
import { MessageEvent, StateEvent } from '../../../types/matrix/room';
import { webRTCSupported } from '../../utils/rtc';

type RoomNavItemMenuProps = {
  room: Room;
  requestClose: () => void;
  notificationMode?: RoomNotificationMode;
};
const RoomNavItemMenu = forwardRef<HTMLDivElement, RoomNavItemMenuProps>(
  ({ room, requestClose, notificationMode }, ref) => {
    const mx = useMatrixClient();
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
    const powerLevels = usePowerLevels(room);
    const creators = useRoomCreators(room);

    const permissions = useRoomPermissions(creators, powerLevels);
    const canInvite = permissions.action('invite', mx.getSafeUserId());
    const openRoomSettings = useOpenRoomSettings();
    const space = useSpaceOptionally();

    const [invitePrompt, setInvitePrompt] = useState(false);

    const handleMarkAsRead = () => {
      markAsRead(mx, room.roomId, hideActivity);
      requestClose();
    };

    const handleInvite = () => {
      setInvitePrompt(true);
    };

    const handleCopyLink = () => {
      const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
      const viaServers = isRoomAlias(roomIdOrAlias) ? undefined : getViaServers(room);
      copyToClipboard(getMatrixToRoom(roomIdOrAlias, viaServers));
      requestClose();
    };

    const handleRoomSettings = () => {
      openRoomSettings(room.roomId, space?.roomId);
      requestClose();
    };

    return (
      <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
        {invitePrompt && room && (
          <InviteUserPrompt
            room={room}
            requestClose={() => {
              setInvitePrompt(false);
              requestClose();
            }}
          />
        )}
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleMarkAsRead}
            size="300"
            after={<Icon size="100" src={Icons.CheckTwice} />}
            radii="300"
            disabled={!unread}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Mark as Read
            </Text>
          </MenuItem>
          <RoomNotificationModeSwitcher roomId={room.roomId} value={notificationMode}>
            {(handleOpen, opened, changing) => (
              <MenuItem
                size="300"
                after={
                  changing ? (
                    <Spinner size="100" variant="Secondary" />
                  ) : (
                    <Icon size="100" src={getRoomNotificationModeIcon(notificationMode)} />
                  )
                }
                radii="300"
                aria-pressed={opened}
                onClick={handleOpen}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  Notifications
                </Text>
              </MenuItem>
            )}
          </RoomNotificationModeSwitcher>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleInvite}
            variant="Primary"
            fill="None"
            size="300"
            after={<Icon size="100" src={Icons.UserPlus} />}
            radii="300"
            aria-pressed={invitePrompt}
            disabled={!canInvite}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Invite
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleCopyLink}
            size="300"
            after={<Icon size="100" src={Icons.Link} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Copy Link
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleRoomSettings}
            size="300"
            after={<Icon size="100" src={Icons.Setting} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Room Settings
            </Text>
          </MenuItem>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <UseStateProvider initial={false}>
            {(promptLeave, setPromptLeave) => (
              <>
                <MenuItem
                  onClick={() => setPromptLeave(true)}
                  variant="Critical"
                  fill="None"
                  size="300"
                  after={<Icon size="100" src={Icons.ArrowGoLeft} />}
                  radii="300"
                  aria-pressed={promptLeave}
                >
                  <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                    Leave Room
                  </Text>
                </MenuItem>
                {promptLeave && (
                  <LeaveRoomPrompt
                    roomId={room.roomId}
                    onDone={requestClose}
                    onCancel={() => setPromptLeave(false)}
                  />
                )}
              </>
            )}
          </UseStateProvider>
        </Box>
      </Menu>
    );
  }
);

function CallChatToggle() {
  const [chat, setChat] = useAtom(callChatAtom);

  return (
    <IconButton
      onClick={() => setChat(!chat)}
      aria-pressed={chat}
      aria-label="Toggle Chat"
      variant="Background"
      fill="None"
      size="300"
      radii="300"
    >
      <Icon size="50" src={Icons.Message} filled={chat} />
    </IconButton>
  );
}

type RoomNavItemProps = {
  room: Room;
  selected: boolean;
  linkPath: string;
  notificationMode?: RoomNotificationMode;
  showAvatar?: boolean;
  avatarRoom?: Room;
  direct?: boolean;
  spaceName?: string;
  style?: CSSProperties;
};

const getLatestPreviewEvent = (room: Room): MatrixEvent | undefined => {
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event && !event.isRedacted() && !reactionOrEditEvent(event)) {
      const eventType = event.getType();
      if (
        eventType === MessageEvent.RoomMessage ||
        eventType === MessageEvent.RoomMessageEncrypted ||
        eventType === MessageEvent.Sticker
      ) {
        return event;
      }
    }
  }
  return undefined;
};

const getPreviewText = (event?: MatrixEvent): string | undefined => {
  if (!event) return undefined;
  if (event.isDecryptionFailure()) return 'Unable to decrypt message';

  const content = event.getClearContent() ?? event.getContent();
  if (content.msgtype === 'm.bad.encrypted') return 'Unable to decrypt message';

  const body = typeof content.body === 'string' ? content.body.replace(/\s+/g, ' ').trim() : '';
  if (body) return body;

  if (event.isEncrypted()) return 'Encrypted message';

  return (
    {
      'm.image': 'Sent an image',
      'm.video': 'Sent a video',
      'm.audio': 'Sent an audio message',
      'm.file': 'Sent a file',
    }[content.msgtype as string] ?? 'New message'
  );
};

export function RoomNavItem({
  room,
  selected,
  showAvatar,
  avatarRoom,
  direct,
  spaceName,
  style,
  notificationMode,
  linkPath,
}: RoomNavItemProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [hover, setHover] = useState(false);
  const { hoverProps } = useHover({ onHoverChange: setHover });
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHover });
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
  const hasDraft = useAtomValue(roomIdToMsgDraftAtomFamily(room.roomId)).length > 0;
  const typingMember = useRoomTypingMember(room.roomId).filter(
    (receipt) => receipt.userId !== mx.getUserId()
  );

  const roomName = useRoomName(room);
  const [, refreshPreview] = useState(0);
  const previewEvent = getLatestPreviewEvent(room);
  const preview = getPreviewText(previewEvent);
  const previewLine = [spaceName && `in ${spaceName}`, preview].filter(Boolean).join(' · ');
  const lastEvent = room.getLastLiveEvent();
  const lastActivityLabel = lastEvent ? new Date(lastEvent.getTs()).toLocaleString() : undefined;

  useEffect(() => {
    const handleTimeline = () => refreshPreview((version) => version + 1);
    room.on(RoomEvent.Timeline, handleTimeline);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimeline);
    };
  }, [room, refreshPreview]);

  useEffect(() => {
    if (!previewEvent?.isEncrypted()) return undefined;
    const handleDecrypted = () => refreshPreview((version) => version + 1);
    previewEvent.on(MatrixEventEvent.Decrypted, handleDecrypted);
    return () => {
      previewEvent.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [previewEvent, refreshPreview]);

  const handleContextMenu: MouseEventHandler<HTMLElement> = (evt) => {
    evt.preventDefault();
    setMenuAnchor({
      x: evt.clientX,
      y: evt.clientY,
      width: 0,
      height: 0,
    });
  };

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  const optionsVisible = hover || !!menuAnchor;
  let avatarSrc: string | undefined;
  if (avatarRoom) {
    avatarSrc = getRoomAvatarUrl(mx, avatarRoom, 96, useAuthentication);
  } else if (direct) {
    avatarSrc = getDirectRoomAvatarUrl(mx, room, 96, useAuthentication);
  } else if (showAvatar) {
    avatarSrc = getRoomAvatarUrl(mx, room, 96, useAuthentication);
  }

  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const startCall = useCallStart(direct);
  const callEmbed = useCallEmbed();
  const callPref = useAtomValue(useCallPreferencesAtom());
  const autoDiscoveryInfo = useAutoDiscoveryInfo();

  const handleStartCall: MouseEventHandler<HTMLAnchorElement> = (evt) => {
    const powerLevelsEvent = getStateEvent(room, StateEvent.RoomPowerLevels);
    const powerLevels = getPowersLevelFromMatrixEvent(powerLevelsEvent);
    const creators = getRoomCreatorsForRoomId(mx, room.roomId);
    const permissions = getRoomPermissionsAPI(creators, powerLevels);

    const hasCallPermission = permissions.stateEvent(
      StateEvent.GroupCallMemberPrefix,
      mx.getSafeUserId()
    );

    // Do not join if missing permissions or no livekit support or no webRTC support
    if (!hasCallPermission || !livekitSupport(autoDiscoveryInfo) || !webRTCSupported()) {
      return;
    }

    // Do not join if already in call
    if (callEmbed) {
      return;
    }
    // Start call in second click
    if (selected) {
      evt.preventDefault();
      startCall(room, callPref);
    }
  };

  return (
    <NavItem
      variant="Background"
      radii="400"
      highlight={unread !== undefined}
      aria-selected={selected}
      data-hover={!!menuAnchor}
      data-ui-option-room-row
      onContextMenu={handleContextMenu}
      style={style}
      {...hoverProps}
      {...focusWithinProps}
    >
      <NavLink
        to={linkPath}
        title={lastActivityLabel}
        aria-label={[roomName, previewLine, lastActivityLabel].filter(Boolean).join(' · ')}
        onClick={room.isCallRoom() ? handleStartCall : undefined}
      >
        <NavItemContent data-ui-option-room-row-content>
          <Box as="span" grow="Yes" alignItems="Center" gap="200">
            <Avatar size="200" radii="400" data-ui-option-room-avatar>
              {showAvatar || avatarRoom ? (
                <RoomAvatar
                  roomId={avatarRoom?.roomId ?? room.roomId}
                  src={avatarSrc}
                  alt={roomName}
                  renderFallback={() => (
                    <Text as="span" size="H6">
                      {nameInitials(avatarRoom?.name ?? roomName)}
                    </Text>
                  )}
                />
              ) : (
                <RoomIcon
                  style={{
                    opacity: unread ? config.opacity.P500 : config.opacity.P300,
                  }}
                  filled={selected}
                  size="100"
                  joinRule={room.getJoinRule()}
                  roomType={room.getType()}
                />
              )}
            </Avatar>
            <Box as="span" grow="Yes" direction="Column" gap="100">
              <Text priority={unread ? '500' : '300'} as="span" size="Inherit" truncate>
                {roomName}
              </Text>
              {previewLine && (
                <Text as="span" data-ui-option-room-preview size="T200" priority="400" truncate>
                  {previewLine}
                </Text>
              )}
            </Box>
            {!optionsVisible && !unread && !selected && typingMember.length > 0 && (
              <Badge size="300" variant="Secondary" fill="Soft" radii="Pill" outlined>
                <TypingIndicator size="300" disableAnimation />
              </Badge>
            )}
            {!optionsVisible && hasDraft && (
              <Badge size="300" variant="Primary" fill="Soft" radii="Pill" outlined>
                <Text as="span" size="T200">
                  Draft
                </Text>
              </Badge>
            )}
            {!optionsVisible && unread && (unread.total > 0 || unread.highlight > 0) && (
              <Box
                as="span"
                alignItems="Center"
                gap="100"
                shrink="No"
                title={`${unread.total} unread${
                  unread.highlight > 0 ? `, ${unread.highlight} mentions` : ''
                }`}
              >
                {unread.total > 0 && (
                  <UnreadBadgeCenter>
                    <UnreadBadge count={unread.total} />
                  </UnreadBadgeCenter>
                )}
                {unread.highlight > 0 && (
                  <Badge variant="Success" fill="Solid" size="400" radii="Pill">
                    <Text as="span" size="L400">
                      @{unread.highlight > 99 ? '99+' : unread.highlight}
                    </Text>
                  </Badge>
                )}
              </Box>
            )}
            {!optionsVisible && notificationMode !== RoomNotificationMode.Unset && (
              <Icon
                size="50"
                src={getRoomNotificationModeIcon(notificationMode)}
                aria-label={notificationMode}
              />
            )}
            {callMembers.length > 0 && (
              <Badge variant="Critical" fill="Solid" size="400">
                <Text as="span" size="L400" truncate>
                  {callMembers.length} Live
                </Text>
              </Badge>
            )}
          </Box>
        </NavItemContent>
      </NavLink>
      {optionsVisible && (
        <NavItemOptions>
          {selected && (callEmbed?.roomId === room.roomId || room.isCallRoom()) && (
            <CallChatToggle />
          )}
          <PopOut
            id={`menu-${room.roomId}`}
            aria-expanded={!!menuAnchor}
            anchor={menuAnchor}
            offset={menuAnchor?.width === 0 ? 0 : undefined}
            alignOffset={menuAnchor?.width === 0 ? 0 : -5}
            position="Bottom"
            align={menuAnchor?.width === 0 ? 'Start' : 'End'}
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
                <RoomNavItemMenu
                  room={room}
                  requestClose={() => setMenuAnchor(undefined)}
                  notificationMode={notificationMode}
                />
              </FocusTrap>
            }
          >
            <IconButton
              onClick={handleOpenMenu}
              aria-pressed={!!menuAnchor}
              aria-controls={`menu-${room.roomId}`}
              aria-label="More Options"
              variant="Background"
              fill="None"
              size="300"
              radii="300"
            >
              <Icon size="50" src={Icons.VerticalDots} />
            </IconButton>
          </PopOut>
        </NavItemOptions>
      )}
    </NavItem>
  );
}
