import React from 'react';
import { Box, Text, color } from 'folds';
import type { IIdentityProvider, ISSOFlow, LoginFlow } from 'matrix-js-sdk/lib/@types/auth';
import { useAuthFlows } from '../../hooks/useAuthFlows';
import { useAuthServer } from '../../hooks/useAuthServer';
import { usePathWithOrigin } from '../../hooks/usePathWithOrigin';
import { getLoginPath } from '../pathUtils';
import { CasLoginButton } from './CasLoginButton';

const isCasProvider = (provider: IIdentityProvider): boolean =>
  [provider.id, provider.name, provider.brand].some(
    (value) => typeof value === 'string' && value.toLowerCase().includes('cas'),
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
    <Box direction="Column" gap="500">
      <Box direction="Column" alignItems="Center" gap="200">
        <Text as="h1" align="Center" size="H2">
          Welcome to IIIT social
        </Text>
        <Text align="Center" priority="400">
          Sign in with your IIIT account to continue.
        </Text>
      </Box>
      {casProvider ? (
        <CasLoginButton
          provider={casProvider}
          redirectUrl={redirectUrl}
          loginType={casFlow?.type === 'm.login.cas' ? 'cas' : 'sso'}
        />
      ) : (
        <Text align="Center" style={{ color: color.Critical.Main }}>
          CAS login is currently unavailable on IIIT social.
        </Text>
      )}
    </Box>
  );
}
