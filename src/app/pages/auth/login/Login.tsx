import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthServer } from '../../../hooks/useAuthServer';
import { useClientConfig } from '../../../hooks/useClientConfig';
import { CasLandingPage } from '../CasLandingPage';
import { getLoginPath, withSearchParam } from '../../pathUtils';
import { usePathWithOrigin } from '../../../hooks/usePathWithOrigin';
import { LoginPathSearchParams } from '../../paths';
import { TokenLogin } from './TokenLogin';

const getLoginTokenFromUrl = (): string | undefined => {
  const params = new URLSearchParams(window.location.search);
  return params.get('loginToken') ?? undefined;
};

export function Login() {
  const server = useAuthServer();
  const { hashRouter } = useClientConfig();
  const [searchParams] = useSearchParams();
  const loginTokenFromSearch = searchParams.get('loginToken') ?? undefined;
  const loginTokenFromUrl = getLoginTokenFromUrl();
  const loginToken = loginTokenFromSearch ?? loginTokenFromUrl;
  const absoluteLoginPath = usePathWithOrigin(getLoginPath(server));

  useEffect(() => {
    if (hashRouter?.enabled && loginTokenFromUrl) {
      window.location.replace(
        withSearchParam<LoginPathSearchParams>(absoluteLoginPath, {
          loginToken: loginTokenFromUrl,
        })
      );
    }
  }, [absoluteLoginPath, hashRouter?.enabled, loginTokenFromUrl]);

  if (hashRouter?.enabled && loginTokenFromUrl) return null;
  if (loginToken) return <TokenLogin token={loginToken} />;

  return <CasLandingPage />;
}
