import { ReactNode, useCallback, useEffect, useMemo } from 'react';
import { createClient } from 'matrix-js-sdk/lib/matrix';
import { AsyncStatus, useAsyncCallback } from '../hooks/useAsyncCallback';
import { useAutoDiscoveryInfo } from '../hooks/useAutoDiscoveryInfo';
import { AuthFlows } from '../hooks/useAuthFlows';

type AuthFlowsLoaderProps = {
  fallback?: () => ReactNode;
  error?: (err: unknown) => ReactNode;
  children: (authFlows: AuthFlows) => ReactNode;
};
export function AuthFlowsLoader({ fallback, error, children }: AuthFlowsLoaderProps) {
  const autoDiscoveryInfo = useAutoDiscoveryInfo();
  const baseUrl = autoDiscoveryInfo['m.homeserver'].base_url;

  const mx = useMemo(() => createClient({ baseUrl }), [baseUrl]);

  const [state, load] = useAsyncCallback(
    useCallback(async () => {
      const loginFlows = await mx.loginFlows();
      return { loginFlows } satisfies AuthFlows;
    }, [mx])
  );

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === AsyncStatus.Idle || state.status === AsyncStatus.Loading) {
    return fallback?.();
  }

  if (state.status === AsyncStatus.Error) {
    return error?.(state.error);
  }

  return children(state.data);
}
