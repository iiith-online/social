import to from 'await-to-js';
import { createClient } from 'matrix-js-sdk/lib/matrix';
import { MatrixError } from 'matrix-js-sdk/lib/http-api/errors';
import type { LoginResponse } from 'matrix-js-sdk/lib/@types/auth';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorCode } from '../../../cs-errorcode';
import {
  deleteAfterLoginRedirectPath,
  getAfterLoginRedirectPath,
} from '../../afterLoginRedirectPath';
import { getHomePath } from '../../pathUtils';
import { setFallbackSession } from '../../../state/sessions';

export enum LoginError {
  Forbidden = 'Forbidden',
  UserDeactivated = 'UserDeactivated',
  InvalidRequest = 'InvalidRequest',
  RateLimited = 'RateLimited',
  Unknown = 'Unknown',
}

export type CustomLoginResponse = {
  baseUrl: string;
  response: LoginResponse;
};

export const login = async (baseUrl: string, token: string): Promise<CustomLoginResponse> => {
  const mx = createClient({ baseUrl });
  const [err, res] = await to<LoginResponse, MatrixError>(
    mx.loginRequest({
      type: 'm.login.token',
      token,
      initial_device_display_name: 'IIIT social Web',
    })
  );

  if (err) {
    if (err.httpStatus === 400) {
      throw new MatrixError({ errcode: LoginError.InvalidRequest });
    }
    if (err.httpStatus === 429) {
      throw new MatrixError({ errcode: LoginError.RateLimited });
    }
    if (err.errcode === ErrorCode.M_USER_DEACTIVATED) {
      throw new MatrixError({ errcode: LoginError.UserDeactivated });
    }
    if (err.httpStatus === 403) {
      throw new MatrixError({ errcode: LoginError.Forbidden });
    }
    throw new MatrixError({ errcode: LoginError.Unknown });
  }
  if (!res) {
    throw new MatrixError({ errcode: LoginError.Unknown });
  }

  return { baseUrl, response: res };
};

export const useLoginComplete = (data?: CustomLoginResponse) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (data) {
      const { response: loginRes, baseUrl: loginBaseUrl } = data;
      setFallbackSession(loginRes.access_token, loginRes.device_id, loginRes.user_id, loginBaseUrl);
      const afterLoginRedirectUrl = getAfterLoginRedirectPath();
      deleteAfterLoginRedirectPath();
      navigate(afterLoginRedirectUrl ?? getHomePath(), { replace: true });
    }
  }, [data, navigate]);
};
