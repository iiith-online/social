import {
  Box,
  Button,
  Icon,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  color,
  config,
} from 'folds';
import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MatrixError } from 'matrix-js-sdk/lib/http-api/errors';
import { useAutoDiscoveryInfo } from '../../../hooks/useAutoDiscoveryInfo';
import { useAuthServer } from '../../../hooks/useAuthServer';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { CustomLoginResponse, LoginError, login, useLoginComplete } from './loginUtil';
import { getLoginPath } from '../../pathUtils';

function LoginTokenError({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <Box
      role="alert"
      aria-live="assertive"
      style={{
        backgroundColor: color.Critical.Container,
        color: color.Critical.OnContainer,
        padding: config.space.S300,
        borderRadius: config.radii.R400,
      }}
      justifyContent="Start"
      alignItems="Start"
      gap="300"
    >
      <Icon size="300" filled src={Icons.Warning} />
      <Box direction="Column" gap="100">
        <Text size="L400">Token Login</Text>
        <Text size="T300">
          <b>{message}</b>
        </Text>
        <Box gap="200" wrap="Wrap">
          <Button size="300" variant="Critical" fill="Soft" onClick={onRetry}>
            <Text size="B300">Try again</Text>
          </Button>
          <Button size="300" variant="Secondary" fill="Soft" onClick={onBack}>
            <Text size="B300">Back to sign in</Text>
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

const getLoginTokenErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case LoginError.Forbidden:
      return 'Invalid login token.';
    case LoginError.UserDeactivated:
      return 'This account has been deactivated.';
    case LoginError.InvalidRequest:
      return 'The login request was invalid.';
    case LoginError.RateLimited:
      return 'Too many login attempts. Please try again later.';
    default:
      return 'Login failed for an unknown reason.';
  }
};

type TokenLoginProps = {
  token: string;
};
export function TokenLogin({ token }: TokenLoginProps) {
  const navigate = useNavigate();
  const server = useAuthServer();
  const discovery = useAutoDiscoveryInfo();
  const baseUrl = discovery['m.homeserver'].base_url;

  const [loginState, startLogin] = useAsyncCallback<
    CustomLoginResponse,
    MatrixError,
    Parameters<typeof login>
  >(useCallback(login, []));

  useEffect(() => {
    startLogin(baseUrl, token);
  }, [baseUrl, token, startLogin]);

  useLoginComplete(loginState.status === AsyncStatus.Success ? loginState.data : undefined);

  const errorMessage =
    loginState.status === AsyncStatus.Error
      ? getLoginTokenErrorMessage(loginState.error.errcode ?? LoginError.Unknown)
      : undefined;

  return (
    <>
      {errorMessage && (
        <LoginTokenError
          message={errorMessage}
          onRetry={() => startLogin(baseUrl, token)}
          onBack={() => navigate(getLoginPath(server))}
        />
      )}
      <Overlay open={loginState.status !== AsyncStatus.Error} backdrop={<OverlayBackdrop />}>
        <OverlayCenter>
          <Spinner size="600" variant="Secondary" />
        </OverlayCenter>
      </Overlay>
    </>
  );
}
