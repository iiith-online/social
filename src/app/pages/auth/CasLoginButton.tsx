import { createClient } from 'matrix-js-sdk/lib/matrix';
import { SSOAction } from 'matrix-js-sdk/lib/@types/auth';
import type { IIdentityProvider } from 'matrix-js-sdk/lib/@types/auth';
import React, { useMemo } from 'react';
import { useAutoDiscoveryInfo } from '../../hooks/useAutoDiscoveryInfo';

type CasLoginButtonProps = {
  provider: IIdentityProvider;
  redirectUrl: string;
  loginType: 'sso' | 'cas';
};

export function CasLoginButton({ provider, redirectUrl, loginType }: CasLoginButtonProps) {
  const discovery = useAutoDiscoveryInfo();
  const baseUrl = discovery['m.homeserver'].base_url;
  const mx = useMemo(() => createClient({ baseUrl }), [baseUrl]);
  const iconUrl = provider.icon && mx.mxcUrlToHttp(provider.icon, 96, 96, 'crop', false);
  const loginUrl = mx.getSsoLoginUrl(redirectUrl, loginType, provider.id, SSOAction.LOGIN);

  return (
    <a className="social-cas-button" href={loginUrl}>
      {iconUrl && <img className="social-avatar" src={iconUrl} alt="" />}
      <span>Continue with IIIT CAS</span>
    </a>
  );
}
