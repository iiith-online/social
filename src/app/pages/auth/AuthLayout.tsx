import React, { useCallback, useEffect } from 'react';
import { Box, Header, Scroll, Spinner, Text, color } from 'folds';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import classNames from 'classnames';

import { AuthFooter } from './AuthFooter';
import * as css from './styles.css';
import * as PatternsCss from '../../styles/Patterns.css';
import { DEFAULT_HOMESERVER } from '../../hooks/useClientConfig';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import AppIcon from '../../../../public/icons/web/icon-512.png';
import { AutoDiscoveryAction, autoDiscovery } from '../../cs-api';
import { AutoDiscoveryInfoProvider } from '../../hooks/useAutoDiscoveryInfo';
import { AuthFlowsLoader } from '../../components/AuthFlowsLoader';
import { AuthFlowsProvider } from '../../hooks/useAuthFlows';
import { AuthServerProvider } from '../../hooks/useAuthServer';
import { tryDecodeURIComponent } from '../../utils/dom';
import { getLoginPath } from '../pathUtils';

function AuthLayoutLoading({ message }: { message: string }) {
  return (
    <Box justifyContent="Center" alignItems="Center" gap="200">
      <Spinner size="100" variant="Secondary" />
      <Text align="Center" size="T300">
        {message}
      </Text>
    </Box>
  );
}

function AuthLayoutError({ message }: { message: string }) {
  return (
    <Box justifyContent="Center" alignItems="Center" gap="200">
      <Text align="Center" style={{ color: color.Critical.Main }} size="T300">
        {message}
      </Text>
    </Box>
  );
}

type AuthLayoutProps = {
  redirectToServerPath?: boolean;
};

export function AuthLayout({ redirectToServerPath = true }: AuthLayoutProps) {
  const navigate = useNavigate();
  const { server: urlEncodedServer } = useParams();

  const server = DEFAULT_HOMESERVER;

  const [discoveryState, discoverServer] = useAsyncCallback(
    useCallback(async (serverName: string) => {
      const response = await autoDiscovery(fetch, serverName);
      return {
        serverName,
        response,
      };
    }, []),
  );

  useEffect(() => {
    if (server) discoverServer(server);
  }, [discoverServer, server]);

  // if server is mismatches with path server, update path
  useEffect(() => {
    if (!redirectToServerPath) return;

    if (!urlEncodedServer || tryDecodeURIComponent(urlEncodedServer) !== server) {
      navigate(getLoginPath(server), { replace: true });
    }
  }, [redirectToServerPath, urlEncodedServer, navigate, server]);

  const [autoDiscoveryError, autoDiscoveryInfo] =
    discoveryState.status === AsyncStatus.Success ? discoveryState.data.response : [];

  return (
    <Scroll variant="Background" visibility="Hover" size="300" hideTrack>
      <Box
        className={classNames(css.AuthLayout, PatternsCss.BackgroundDotPattern)}
        direction="Column"
        alignItems="Center"
        justifyContent="SpaceBetween"
        gap="400"
      >
        <Box direction="Column" className={css.AuthCard}>
          <Header className={css.AuthHeader} size="600" variant="Surface">
            <Box grow="Yes" direction="Row" gap="300" alignItems="Center">
              <img className={css.AuthLogo} src={AppIcon} alt="IIIT social logo" />
              <Text size="H3">IIIT social</Text>
            </Box>
          </Header>
          <Box className={css.AuthCardContent} direction="Column">
            {discoveryState.status === AsyncStatus.Loading && (
              <AuthLayoutLoading message="Connecting to IIIT social..." />
            )}
            {discoveryState.status === AsyncStatus.Error && (
              <AuthLayoutError message="Failed to connect to IIIT social." />
            )}
            {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_PROMPT && (
              <AuthLayoutError
                message={`Failed to connect. Homeserver configuration found with ${autoDiscoveryError.host} appears unusable.`}
              />
            )}
            {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_ERROR && (
              <AuthLayoutError message="IIIT social returned an invalid connection address." />
            )}
            {discoveryState.status === AsyncStatus.Success && autoDiscoveryInfo && (
              <AuthServerProvider value={discoveryState.data.serverName}>
                <AutoDiscoveryInfoProvider value={autoDiscoveryInfo}>
                  <AuthFlowsLoader
                    fallback={() => <AuthLayoutLoading message="Loading CAS login..." />}
                    error={() => (
                      <AuthLayoutError message="Failed to load CAS login. Please try again." />
                    )}
                  >
                    {(authFlows) => (
                      <AuthFlowsProvider value={authFlows}>
                        <Outlet />
                      </AuthFlowsProvider>
                    )}
                  </AuthFlowsLoader>
                </AutoDiscoveryInfoProvider>
              </AuthServerProvider>
            )}
          </Box>
        </Box>
        <AuthFooter />
      </Box>
    </Scroll>
  );
}
