import React, { FormEventHandler, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FocusTrap from 'focus-trap-react';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
  color,
  config,
} from 'folds';
import { NavButton, NavCategory, NavItem, NavItemContent, NavLink } from '../../../components/nav';
import {
  encodeSearchParamValueArray,
  getCreatePath,
  getExploreServerPath,
  getSpacePath,
  withSearchParam,
} from '../../pathUtils';
import { _RoomSearchParams } from '../../paths';
import { DEFAULT_HOMESERVER } from '../../../hooks/useClientConfig';
import { useExploreServer } from '../../../hooks/router/useExploreSelected';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { PageNav, PageNavContent, PageNavHeader } from '../../../components/page';
import { stopPropagation } from '../../../utils/keyboard';
import { JoinAddressPrompt } from '../../../components/join-address-prompt';
import { useOpenCreateRoomModal } from '../../../state/hooks/createRoomModal';

export function AddServer() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(false);
  const serverInputRef = useRef<HTMLInputElement>(null);

  const [exploreState] = useAsyncCallback(
    useCallback((server: string) => mx.publicRooms({ server, limit: 1 }), [mx])
  );

  const getInputServer = (): string | undefined => {
    const serverInput = serverInputRef.current;
    if (!serverInput) return undefined;
    const server = serverInput.value.trim();
    return server || undefined;
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const server = getInputServer();
    if (!server) return;
    // explore(server);

    navigate(getExploreServerPath(server));
    setDialog(false);
  };

  const handleView = () => {
    const server = getInputServer();
    if (!server) return;
    navigate(getExploreServerPath(server));
    setDialog(false);
  };

  return (
    <>
      <Overlay open={dialog} backdrop={<OverlayBackdrop />}>
        <OverlayCenter>
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              clickOutsideDeactivates: true,
              onDeactivate: () => setDialog(false),
              escapeDeactivates: stopPropagation,
            }}
          >
            <Dialog variant="Surface">
              <Header
                style={{
                  padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                  borderBottomWidth: config.borderWidth.B300,
                }}
                variant="Surface"
                size="500"
              >
                <Box grow="Yes">
                  <Text size="H4">Add Server</Text>
                </Box>
                <IconButton size="300" onClick={() => setDialog(false)} radii="300">
                  <Icon src={Icons.Cross} />
                </IconButton>
              </Header>
              <Box
                as="form"
                onSubmit={handleSubmit}
                style={{ padding: config.space.S400 }}
                direction="Column"
                gap="400"
              >
                <Text priority="400">Add server name to explore public communities.</Text>
                <Box direction="Column" gap="100">
                  <Text size="L400">Server Name</Text>
                  <Input ref={serverInputRef} name="serverInput" variant="Background" required />
                  {exploreState.status === AsyncStatus.Error && (
                    <Text style={{ color: color.Critical.Main }} size="T300">
                      Failed to load public rooms. Please try again.
                    </Text>
                  )}
                </Box>
                <Box direction="Column" gap="200">
                  {/* <Button
                    type="submit"
                    variant="Secondary"
                    before={
                      exploreState.status === AsyncStatus.Loading ? (
                        <Spinner fill="Solid" variant="Secondary" size="200" />
                      ) : undefined
                    }
                    aria-disabled={exploreState.status === AsyncStatus.Loading}
                  >
                    <Text size="B400">Save</Text>
                  </Button> */}

                  <Button type="submit" onClick={handleView} variant="Secondary" fill="Soft">
                    <Text size="B400">View</Text>
                  </Button>
                </Box>
              </Box>
            </Dialog>
          </FocusTrap>
        </OverlayCenter>
      </Overlay>
      <Button
        variant="Secondary"
        fill="Soft"
        size="300"
        before={<Icon size="100" src={Icons.Plus} />}
        onClick={() => setDialog(true)}
      >
        <Text size="B300" truncate>
          Add Server
        </Text>
      </Button>
    </>
  );
}

export function Explore() {
  const navigate = useNavigate();
  const openCreateRoomModal = useOpenCreateRoomModal();
  const [joinAddress, setJoinAddress] = useState(false);
  useNavToActivePathMapper('explore');
  const selectedServer = useExploreServer();

  return (
    <PageNav>
      <PageNavHeader>
        <Box grow="Yes" gap="300">
          <Box grow="Yes">
            <Text size="H4" truncate>
              Explore Community
            </Text>
          </Box>
        </Box>
      </PageNavHeader>

      <PageNavContent>
        <NavCategory>
          <NavItem
            variant="Background"
            radii="400"
            aria-selected={selectedServer === DEFAULT_HOMESERVER}
          >
            <NavLink to={getExploreServerPath(DEFAULT_HOMESERVER)}>
              <NavItemContent>
                <Box as="span" grow="Yes" alignItems="Center" gap="200">
                  <Avatar size="200" radii="400">
                    <Icon
                      src={Icons.Server}
                      size="100"
                      filled={selectedServer === DEFAULT_HOMESERVER}
                    />
                  </Avatar>
                  <Box as="span" grow="Yes">
                    <Text as="span" size="Inherit" truncate>
                      {DEFAULT_HOMESERVER}
                    </Text>
                  </Box>
                </Box>
              </NavItemContent>
            </NavLink>
          </NavItem>
          <NavItem variant="Background" radii="400">
            <NavButton onClick={() => openCreateRoomModal()}>
              <NavItemContent>
                <Box as="span" grow="Yes" alignItems="Center" gap="200">
                  <Avatar size="200" radii="400">
                    <Icon src={Icons.Plus} size="100" />
                  </Avatar>
                  <Box as="span" grow="Yes">
                    <Text as="span" size="Inherit" truncate>
                      Create Room
                    </Text>
                  </Box>
                </Box>
              </NavItemContent>
            </NavButton>
          </NavItem>
          <NavItem variant="Background" radii="400">
            <NavButton onClick={() => navigate(getCreatePath())}>
              <NavItemContent>
                <Box as="span" grow="Yes" alignItems="Center" gap="200">
                  <Avatar size="200" radii="400">
                    <Icon src={Icons.Plus} size="100" />
                  </Avatar>
                  <Box as="span" grow="Yes">
                    <Text as="span" size="Inherit" truncate>
                      Add Space
                    </Text>
                  </Box>
                </Box>
              </NavItemContent>
            </NavButton>
          </NavItem>
          <NavItem variant="Background" radii="400">
            <NavButton onClick={() => setJoinAddress(true)}>
              <NavItemContent>
                <Box as="span" grow="Yes" alignItems="Center" gap="200">
                  <Avatar size="200" radii="400">
                    <Icon src={Icons.Link} size="100" />
                  </Avatar>
                  <Box as="span" grow="Yes">
                    <Text as="span" size="Inherit" truncate>
                      Join with Address
                    </Text>
                  </Box>
                </Box>
              </NavItemContent>
            </NavButton>
          </NavItem>
        </NavCategory>
      </PageNavContent>
      {joinAddress && (
        <JoinAddressPrompt
          onCancel={() => setJoinAddress(false)}
          onOpen={(roomIdOrAlias, viaServers) => {
            setJoinAddress(false);
            const path = getSpacePath(roomIdOrAlias);
            navigate(
              viaServers
                ? withSearchParam<_RoomSearchParams>(path, {
                    viaServers: encodeSearchParamValueArray(viaServers),
                  })
                : path
            );
          }}
        />
      )}
    </PageNav>
  );
}
