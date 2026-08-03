import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, Icons } from 'folds';
import {
  SidebarAvatar,
  SidebarItem,
  SidebarItemBadge,
  SidebarItemTooltip,
} from '../../../components/sidebar';
import { UnreadBadge } from '../../../components/unread-badge';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { getRecentPath } from '../../pathUtils';
import { useRecentSelected } from '../../../hooks/router/useRecentSelected';
import { useRecentRooms } from '../recent/useRecentRooms';

export function RecentTab() {
  const navigate = useNavigate();
  const rooms = useRecentRooms();
  const unread = useRoomsUnread(rooms, roomToUnreadAtom);
  const recentSelected = useRecentSelected();

  return (
    <SidebarItem active={recentSelected}>
      <SidebarItemTooltip tooltip="Recent">
        {(triggerRef) => (
          <SidebarAvatar
            as="button"
            ref={triggerRef}
            outlined
            onClick={() => navigate(getRecentPath())}
          >
            <Icon src={Icons.RecentClock} filled={recentSelected} />
          </SidebarAvatar>
        )}
      </SidebarItemTooltip>
      {unread && (
        <SidebarItemBadge hasCount={unread.total > 0}>
          <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
        </SidebarItemBadge>
      )}
    </SidebarItem>
  );
}
