import React, { lazy, Suspense } from 'react';
import {
  Outlet,
  Route,
  createBrowserRouter,
  createHashRouter,
  createRoutesFromElements,
  redirect,
} from 'react-router-dom';

import { ClientConfig, DEFAULT_HOMESERVER } from '../hooks/useClientConfig';
import { AuthLayout, CasLandingPage, Login } from './auth';
import {
  DIRECT_PATH,
  EXPLORE_PATH,
  HOME_PATH,
  LOGIN_PATH,
  INBOX_PATH,
  RECENT_PATH,
  SPACE_PATH,
  _CREATE_PATH,
  _INVITES_PATH,
  _JOIN_PATH,
  _LOBBY_PATH,
  _NOTIFICATIONS_PATH,
  _ROOM_PATH,
  _SEARCH_PATH,
  CREATE_PATH,
  ROOT_PATH,
} from './paths';
import {
  getAppPathFromHref,
  getExploreServerPath,
  getHomePath,
  getInboxNotificationsPath,
  getLoginPath,
  getOriginBaseUrl,
  getSpaceLobbyPath,
} from './pathUtils';
import { ClientBindAtoms, ClientLayout, ClientRoot } from './client';
import { Home, HomeRouteRoomProvider, HomeSearch } from './client/home';
import { Recent, RecentRouteRoomProvider } from './client/recent';
import { Direct, DirectCreate, DirectRouteRoomProvider } from './client/direct';
import { RouteSpaceProvider, Space, SpaceRouteRoomProvider, SpaceSearch } from './client/space';
import { Explore, PublicRooms } from './client/explore';
import { Notifications, Inbox, Invites } from './client/inbox';
import { setAfterLoginRedirectPath } from './afterLoginRedirectPath';
import { Room } from '../features/room';
import { Lobby } from '../features/lobby';
import { WelcomePage } from './client/WelcomePage';
import { SidebarNav } from './client/SidebarNav';
import { PageRoot } from '../components/page';
import { ScreenSize } from '../hooks/useScreenSize';
import { MobileFriendlyPageNav, MobileFriendlyClientNav } from './MobileFriendly';
import { ClientInitStorageAtom } from './client/ClientInitStorageAtom';
import { ClientNonUIFeatures } from './client/ClientNonUIFeatures';
import { AuthRouteThemeManager, UnAuthRouteThemeManager } from './ThemeManager';
import { ReceiveSelfDeviceVerification } from '../components/DeviceVerification';
import { AutoRestoreBackupOnVerification } from '../components/BackupRestore';
import { RoomSettingsRenderer } from '../features/room-settings';
import { ClientRoomsNotificationPreferences } from './client/ClientRoomsNotificationPreferences';
import { SpaceSettingsRenderer } from '../features/space-settings';
import { UserRoomProfileRenderer } from '../components/UserRoomProfileRenderer';
import { CreateRoomModalRenderer } from '../features/create-room';
import { HomeCreateRoom } from './client/home/CreateRoom';
import { Create } from './client/create';
import { CreateSpaceModalRenderer } from '../features/create-space';
import { SearchModalRenderer } from '../features/search';
import { getFallbackSession } from '../state/sessions';
import { CallStatusRenderer } from './CallStatusRenderer';

const CallEmbedProvider = lazy(() =>
  import('../components/CallEmbedProvider').then((module) => ({
    default: module.CallEmbedProvider,
  }))
);

export const createRouter = (clientConfig: ClientConfig, screenSize: ScreenSize) => {
  const { hashRouter } = clientConfig;
  const mobile = screenSize === ScreenSize.Mobile;

  const routes = createRoutesFromElements(
    <Route>
      <Route
        loader={() => {
          if (getFallbackSession()) return redirect(getHomePath());
          return null;
        }}
        element={
          <>
            <AuthLayout redirectToServerPath={false} />
            <UnAuthRouteThemeManager />
          </>
        }
      >
        <Route index element={<CasLandingPage />} />
      </Route>
      <Route
        loader={() => {
          if (getFallbackSession()) {
            return redirect(getHomePath());
          }

          return null;
        }}
        element={
          <>
            <AuthLayout />
            <UnAuthRouteThemeManager />
          </>
        }
      >
        <Route path={LOGIN_PATH} element={<Login />} />
      </Route>
      <Route path="/register/*" loader={() => redirect(ROOT_PATH)} />
      <Route path="/reset-password/*" loader={() => redirect(ROOT_PATH)} />
      <Route
        loader={() => {
          const session = getFallbackSession();
          if (!session) {
            const afterLoginPath = getAppPathFromHref(
              getOriginBaseUrl(hashRouter),
              window.location.href
            );
            if (afterLoginPath) setAfterLoginRedirectPath(afterLoginPath);
            return redirect(getLoginPath());
          }
          return null;
        }}
        element={
          <AuthRouteThemeManager>
            <ClientRoot>
              <ClientInitStorageAtom>
                <ClientRoomsNotificationPreferences>
                  <ClientBindAtoms>
                    <ClientNonUIFeatures>
                      <Suspense fallback={null}>
                        <CallEmbedProvider>
                          <ClientLayout
                            nav={
                              <MobileFriendlyClientNav>
                                <SidebarNav />
                              </MobileFriendlyClientNav>
                            }
                          >
                            <Outlet />
                          </ClientLayout>
                          <CallStatusRenderer />
                        </CallEmbedProvider>
                      </Suspense>
                      <SearchModalRenderer />
                      <UserRoomProfileRenderer />
                      <CreateRoomModalRenderer />
                      <CreateSpaceModalRenderer />
                      <RoomSettingsRenderer />
                      <SpaceSettingsRenderer />
                      <ReceiveSelfDeviceVerification />
                      <AutoRestoreBackupOnVerification />
                    </ClientNonUIFeatures>
                  </ClientBindAtoms>
                </ClientRoomsNotificationPreferences>
              </ClientInitStorageAtom>
            </ClientRoot>
          </AuthRouteThemeManager>
        }
      >
        <Route
          path={RECENT_PATH}
          element={
            <PageRoot
              nav={
                <MobileFriendlyPageNav path={RECENT_PATH}>
                  <Recent />
                </MobileFriendlyPageNav>
              }
            >
              <Outlet />
            </PageRoot>
          }
        >
          {mobile ? null : <Route index element={<WelcomePage />} />}
          <Route
            path={_ROOM_PATH}
            element={
              <RecentRouteRoomProvider>
                <Room />
              </RecentRouteRoomProvider>
            }
          />
        </Route>
        <Route
          path={HOME_PATH}
          element={
            <PageRoot
              nav={
                <MobileFriendlyPageNav path={HOME_PATH}>
                  <Home />
                </MobileFriendlyPageNav>
              }
            >
              <Outlet />
            </PageRoot>
          }
        >
          {mobile ? null : <Route index element={<WelcomePage homeDashboard />} />}
          <Route path={_CREATE_PATH} element={<HomeCreateRoom />} />
          <Route path={_JOIN_PATH} element={<p>join</p>} />
          <Route path={_SEARCH_PATH} element={<HomeSearch />} />
          <Route
            path={_ROOM_PATH}
            element={
              <HomeRouteRoomProvider>
                <Room />
              </HomeRouteRoomProvider>
            }
          />
        </Route>
        <Route
          path={DIRECT_PATH}
          element={
            <PageRoot
              nav={
                <MobileFriendlyPageNav path={DIRECT_PATH}>
                  <Direct />
                </MobileFriendlyPageNav>
              }
            >
              <Outlet />
            </PageRoot>
          }
        >
          {mobile ? null : <Route index element={<WelcomePage />} />}
          <Route path={_CREATE_PATH} element={<DirectCreate />} />
          <Route
            path={_ROOM_PATH}
            element={
              <DirectRouteRoomProvider>
                <Room />
              </DirectRouteRoomProvider>
            }
          />
        </Route>
        <Route
          path={SPACE_PATH}
          element={
            <RouteSpaceProvider>
              <PageRoot
                nav={
                  <MobileFriendlyPageNav path={SPACE_PATH}>
                    <Space />
                  </MobileFriendlyPageNav>
                }
              >
                <Outlet />
              </PageRoot>
            </RouteSpaceProvider>
          }
        >
          {mobile ? null : (
            <Route
              index
              loader={({ params }) => {
                const { spaceIdOrAlias } = params;
                if (spaceIdOrAlias) {
                  return redirect(getSpaceLobbyPath(spaceIdOrAlias));
                }
                return null;
              }}
              element={<WelcomePage />}
            />
          )}
          <Route path={_LOBBY_PATH} element={<Lobby />} />
          <Route path={_SEARCH_PATH} element={<SpaceSearch />} />
          <Route
            path={_ROOM_PATH}
            element={
              <SpaceRouteRoomProvider>
                <Room />
              </SpaceRouteRoomProvider>
            }
          />
        </Route>
        <Route
          path={EXPLORE_PATH}
          element={
            <PageRoot
              nav={
                <MobileFriendlyPageNav path={EXPLORE_PATH}>
                  <Explore />
                </MobileFriendlyPageNav>
              }
            >
              <Outlet />
            </PageRoot>
          }
        >
          <Route
            index
            loader={() => redirect(getExploreServerPath(DEFAULT_HOMESERVER))}
            element={<WelcomePage />}
          />
          <Route path={`${DEFAULT_HOMESERVER}/`} element={<PublicRooms />} />
        </Route>
        <Route path={CREATE_PATH} element={<Create />} />
        <Route
          path={INBOX_PATH}
          element={
            <PageRoot
              nav={
                <MobileFriendlyPageNav path={INBOX_PATH}>
                  <Inbox />
                </MobileFriendlyPageNav>
              }
            >
              <Outlet />
            </PageRoot>
          }
        >
          {mobile ? null : (
            <Route
              index
              loader={() => redirect(getInboxNotificationsPath())}
              element={<WelcomePage />}
            />
          )}
          <Route path={_NOTIFICATIONS_PATH} element={<Notifications />} />
          <Route path={_INVITES_PATH} element={<Invites />} />
        </Route>
      </Route>
      <Route path="/*" element={<p>Page not found</p>} />
    </Route>
  );

  if (hashRouter?.enabled) {
    return createHashRouter(routes, { basename: hashRouter.basename });
  }
  return createBrowserRouter(routes, {
    basename: import.meta.env.BASE_URL,
  });
};
