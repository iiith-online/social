import React, { MouseEventHandler, useState } from 'react';
import { Box, config, Icon, Icons, Menu, MenuItem, PopOut, RectCords, Text } from 'folds';
import FocusTrap from 'focus-trap-react';
import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';
import { useHomeSearchSelected } from '../../../hooks/router/useHomeSelected';
import { stopPropagation } from '../../../utils/keyboard';
import { getHomeSearchPath } from '../../pathUtils';
import { searchModalAtom } from '../../../state/searchModal';

export function SearchTab() {
  const navigate = useNavigate();
  const [opened, setOpen] = useAtom(searchModalAtom);
  const messageSearchSelected = useHomeSearchSelected();
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => (currentState ? undefined : cords));
  };

  const openSearch = () => {
    setMenuAnchor(undefined);
    setOpen(true);
  };

  const openMessageSearch = () => {
    setMenuAnchor(undefined);
    navigate(getHomeSearchPath());
  };

  return (
    <SidebarItem active={!!menuAnchor || opened || messageSearchSelected}>
      <SidebarItemTooltip tooltip="Search">
        {(triggerRef) => (
          <>
            <SidebarAvatar
              as="button"
              ref={triggerRef}
              aria-label="Search"
              aria-pressed={!!menuAnchor || opened || messageSearchSelected}
              outlined
              onClick={handleMenu}
            >
              <Icon src={Icons.Search} filled={opened || messageSearchSelected} />
            </SidebarAvatar>
            {menuAnchor && (
              <PopOut
                anchor={menuAnchor}
                position="Right"
                align="Center"
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
                    <Menu>
                      <Box
                        direction="Column"
                        gap="100"
                        style={{ padding: config.space.S100 }}
                      >
                        <MenuItem
                          onClick={openSearch}
                          size="300"
                          radii="300"
                          aria-pressed={opened}
                        >
                          <Text as="span" size="T300" truncate>
                            Search rooms & people
                          </Text>
                        </MenuItem>
                        <MenuItem
                          onClick={openMessageSearch}
                          size="300"
                          radii="300"
                          aria-pressed={messageSearchSelected}
                        >
                          <Text as="span" size="T300" truncate>
                            Message Search
                          </Text>
                        </MenuItem>
                      </Box>
                    </Menu>
                  </FocusTrap>
                }
              />
            )}
          </>
        )}
      </SidebarItemTooltip>
    </SidebarItem>
  );
}
