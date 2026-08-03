import React from 'react';
import type { IIdentityProvider, ISSOFlow, LoginFlow } from 'matrix-js-sdk/lib/@types/auth';
import { useAuthFlows } from '../../hooks/useAuthFlows';
import { useAuthServer } from '../../hooks/useAuthServer';
import { usePathWithOrigin } from '../../hooks/usePathWithOrigin';
import { getLoginPath } from '../pathUtils';
import { CasLoginButton } from './CasLoginButton';

const isCasProvider = (provider: IIdentityProvider): boolean =>
  [provider.id, provider.name, provider.brand].some(
    (value) => typeof value === 'string' && value.toLowerCase().includes('cas')
  );

export function CasLandingPage() {
  const server = useAuthServer();
  const { loginFlows } = useAuthFlows();
  const casFlow = loginFlows.flows
    .filter((flow: LoginFlow) => flow.type === 'm.login.sso' || flow.type === 'm.login.cas')
    .map((flow) => flow as ISSOFlow)
    .find((flow) => flow.identity_providers?.some(isCasProvider) === true);
  const redirectUrl = usePathWithOrigin(getLoginPath(server));
  const casProvider = casFlow?.identity_providers?.find(isCasProvider);

  return (
    <div className="social-auth-hero">
      <img className="social-brand-mark" src="/icons/web/icon-512.png" alt="IIIT social" />
      <h1>IIIT social</h1>
      <p>Campus conversations, backed by Matrix.</p>
      {casProvider ? (
        <CasLoginButton
          provider={casProvider}
          redirectUrl={redirectUrl}
          loginType={casFlow?.type === 'm.login.cas' ? 'cas' : 'sso'}
        />
      ) : (
        <p className="social-auth-error">CAS login is currently unavailable on IIIT social.</p>
      )}
      <span className="social-auth-domain">matrix.iiit.ac.in</span>
    </div>
  );
}
