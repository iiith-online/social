import React, { useRef } from 'react';
import { Scroll } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';

import {
  Sidebar,
  SidebarContent,
  SidebarStackSeparator,
  SidebarStack,
} from '../../components/sidebar';
import {
  DirectTab,
  HomeTab,
  InboxTab,
  SettingsTab,
  UnverifiedTab,
  SearchTab,
} from './sidebar';
import { SyncStatus } from './SyncStatus';

export function SidebarNav() {
  const mx = useMatrixClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Sidebar>
      <SidebarContent
        scrollable={
          <Scroll ref={scrollRef} variant="Background" size="0">
            <SidebarStack>
              <HomeTab />
              <DirectTab />
              <SearchTab />
              <InboxTab />
            </SidebarStack>
          </Scroll>
        }
        sticky={
          <>
            <SyncStatus mx={mx} />
            <SidebarStack>
              <UnverifiedTab />
              <SettingsTab />
            </SidebarStack>
          </>
        }
      />
    </Sidebar>
  );
}
