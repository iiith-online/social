import React from 'react';
import { Icon, Icons } from 'folds';
import { useNavigate } from 'react-router-dom';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';
import { useExploreSelected } from '../../../hooks/router/useExploreSelected';
import { getExploreServerPath } from '../../pathUtils';
import { DEFAULT_HOMESERVER } from '../../../hooks/useClientConfig';

export function ExploreTab() {
  const navigate = useNavigate();
  const exploreSelected = useExploreSelected();

  const handleExploreClick = () => navigate(getExploreServerPath(DEFAULT_HOMESERVER));

  return (
    <SidebarItem active={exploreSelected}>
      <SidebarItemTooltip tooltip="Explore Community">
        {(triggerRef) => (
          <SidebarAvatar
            as="button"
            ref={triggerRef}
            aria-label="Explore community"
            outlined
            onClick={handleExploreClick}
          >
            <Icon src={Icons.Explore} filled={exploreSelected} />
          </SidebarAvatar>
        )}
      </SidebarItemTooltip>
    </SidebarItem>
  );
}
