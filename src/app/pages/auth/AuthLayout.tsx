import React, { useCallback, useEffect } from 'react';
import { Spinner, Text, color } from 'folds';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { AuthFooter } from './AuthFooter';
import '../../social/social.css';
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      <Spinner size="100" variant="Secondary" />
      <Text align="Center" size="T300">
        {message}
      </Text>
    </div>
  );
}

function AuthLayoutError({ message }: { message: string }) {
  return (
    <div className="social-auth-error">
      <Text align="Center" style={{ color: color.Critical.Main }} size="T300">
        {message}
      </Text>
    </div>
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
    }, [])
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
    <div className="social-auth-shell">
      <div className="social-auth-frame">
        <div className="social-auth-brand">
          <img className="social-brand-mark" src={AppIcon} alt="IIIT social logo" />
          <span className="social-brand-name">IIIT social</span>
        </div>
        <div className="social-auth-content">
          <div className="social-auth-hero">
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
          </div>
        </div>
        <AuthFooter />
      </div>
    </div>
  );
}
