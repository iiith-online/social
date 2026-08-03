import { createContext, useContext } from 'react';
import { ILoginFlowsResponse } from 'matrix-js-sdk/lib/@types/auth';

export type AuthFlows = {
  loginFlows: ILoginFlowsResponse;
};

const AuthFlowsContext = createContext<AuthFlows | null>(null);

export const AuthFlowsProvider = AuthFlowsContext.Provider;

export const useAuthFlows = (): AuthFlows => {
  const authFlows = useContext(AuthFlowsContext);
  if (!authFlows) {
    throw new Error('Auth Flow info is not loaded!');
  }
  return authFlows;
};
