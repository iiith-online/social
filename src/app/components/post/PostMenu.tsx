import React, { useState } from 'react';
import { Box, Icon, IconButton, Icons, Menu, PopOut, RectCords, config } from 'folds';
import FocusTrap from 'focus-trap-react';
import { MatrixEvent, Room } from 'matrix-js-sdk';
import { StateEvent } from '../../../types/matrix/room';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { stopPropagation } from '../../utils/keyboard';
import {
  MessageCopyLinkItem,
  MessageDeleteItem,
  MessagePinItem,
  MessageReportItem,
} from '../../features/room/message/Message';

type PostMenuProps = {
  room: Room;
  event: MatrixEvent;
};
export function PostMenu({ room, event }: PostMenuProps) {
  const mx = useMatrixClient();
  const [menuAnchor, setMenuAnchor] = useState<RectCords | undefined>();

  const closeMenu = () => setMenuAnchor(undefined);
  const me = mx.getSafeUserId();
  const creators = useRoomCreators(room);
  const powerLevels = usePowerLevels(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const canPin = permissions.stateEvent(StateEvent.RoomPinnedEvents, me);
  const canDelete = permissions.action('redact', me);
  const isOwn = event.getSender() === me;

  return (
    <>
      <IconButton
        size="300"
        variant="SurfaceVariant"
        radii="300"
        aria-label="Post options"
        onClick={(evt) => {
          evt.stopPropagation();
          setMenuAnchor({ x: evt.clientX, y: evt.clientY, width: 0, height: 0 });
        }}
      >
        <Icon size="100" src={Icons.VerticalDots} />
      </IconButton>
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={4}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: closeMenu,
              clickOutsideDeactivates: true,
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                <MessageCopyLinkItem room={room} mEvent={event} onClose={closeMenu} />
                {canPin && <MessagePinItem room={room} mEvent={event} onClose={closeMenu} />}
                {canDelete && <MessageDeleteItem room={room} mEvent={event} onClose={closeMenu} />}
                {!isOwn && <MessageReportItem room={room} mEvent={event} onClose={closeMenu} />}
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}
