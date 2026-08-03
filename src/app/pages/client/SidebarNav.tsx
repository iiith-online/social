import React, { useRef } from 'react';
import { Box, Scroll, Text } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useResolvedUiOption } from '../../hooks/useUiOption';

import {
  Sidebar,
  SidebarContent,
  SidebarStackSeparator,
  SidebarStack,
} from '../../components/sidebar';
import {
  DirectTab,
  HomeTab,
  SpaceTabs,
  InboxTab,
  ExploreTab,
  SettingsTab,
  UnverifiedTab,
  SearchTab,
} from './sidebar';
import { SyncStatus } from './SyncStatus';

function MobileUiOptionNav() {
  const labels = ['Home', 'Direct', 'Explore', 'Inbox', 'You'];
  const tabs = [<HomeTab />, <DirectTab />, <ExploreTab />, <InboxTab />, <SettingsTab />];

  return (
    <Sidebar data-ui-option-mobile-sidebar>
      <SidebarStack data-ui-option-mobile-nav role="navigation" aria-label="Primary navigation">
        {tabs.map((tab, index) => (
          <Box
            key={labels[index]}
            data-ui-option-mobile-tab
            direction="Column"
            alignItems="Center"
            justifyContent="Center"
            gap="100"
            grow="Yes"
            shrink="Yes"
          >
            {tab}
            <Text data-ui-option-mobile-tab-label size="T200" priority="400" truncate>
              {labels[index]}
            </Text>
          </Box>
        ))}
      </SidebarStack>
    </Sidebar>
  );
}

export function SidebarNav() {
  const mx = useMatrixClient();
  const screenSize = useScreenSizeContext();
  const uiOption = useResolvedUiOption();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (screenSize === ScreenSize.Mobile && uiOption === 'matrix-android') {
    return <MobileUiOptionNav />;
  }

  return (
    <Sidebar>
      <SidebarContent
        scrollable={
          <Scroll ref={scrollRef} variant="Background" size="0">
            <SidebarStack>
              <HomeTab />
              <DirectTab />
            </SidebarStack>
            <SpaceTabs scrollRef={scrollRef} />
            <SidebarStackSeparator />
            <SidebarStack>
              <ExploreTab />
            </SidebarStack>
          </Scroll>
        }
        sticky={
          <>
            <SidebarStackSeparator />
            <SidebarStack>
              <SearchTab />
              <UnverifiedTab />
              <InboxTab />
              <SyncStatus mx={mx} />
              <SettingsTab />
            </SidebarStack>
          </>
        }
      />
    </Sidebar>
  );
}
