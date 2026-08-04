import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { Icon, Icons, IconSrc } from 'folds';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';
import { useHomeSelected } from '../../../hooks/router/useHomeSelected';
import { getHomePath } from '../../pathUtils';
import { FeedSort } from '../../../utils/feedSort';
import { feedSortAtom } from '../../../state/feedSort';

type FeedTabProps = {
  sort: FeedSort;
  label: string;
  icon: IconSrc;
};
function FeedTab({ sort, label, icon }: FeedTabProps) {
  const navigate = useNavigate();
  const homeSelected = useHomeSelected();
  const [feedSort, setFeedSort] = useAtom(feedSortAtom);
  const active = homeSelected && feedSort === sort;

  const handleClick = useCallback(() => {
    setFeedSort(sort);
    navigate(getHomePath());
  }, [navigate, setFeedSort, sort]);

  return (
    <SidebarItem active={active}>
      <SidebarItemTooltip tooltip={label}>
        {(triggerRef) => (
          <SidebarAvatar
            as="button"
            ref={triggerRef}
            aria-label={label}
            outlined
            onClick={handleClick}
          >
            <Icon src={icon} filled={active} />
          </SidebarAvatar>
        )}
      </SidebarItemTooltip>
    </SidebarItem>
  );
}

export function RecentFeedTab() {
  return <FeedTab sort="recent" label="Recent" icon={Icons.RecentClock} />;
}

export function TopFeedTab() {
  return <FeedTab sort="top" label="Top" icon={Icons.ArrowUpDown} />;
}
