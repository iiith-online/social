// import { atom } from 'jotai';
// import {
//   atomWithLocalStorage,
//   getLocalStorageItem,
//   setLocalStorageItem,
// } from './utils/atomWithLocalStorage';

export type Session = {
  baseUrl: string;
  userId: string;
  deviceId: string;
  accessToken: string;
  expiresInMs?: number;
  refreshToken?: string;
  fallbackSdkStores?: boolean;
};

export type Sessions = Session[];
export type SessionStoreName = {
  sync: string;
  crypto: string;
};

const SESSION_STORAGE_KEYS = {
  accessToken: 'matrix_iiit_access_token',
  deviceId: 'matrix_iiit_device_id',
  userId: 'matrix_iiit_user_id',
  homeserver: 'matrix_iiit_hs_base_url',
} as const;

/**
 * Session storage for the IIIT social client.
 */
// const FALLBACK_STORE_NAME: SessionStoreName = {
//   sync: 'web-sync-store',
//   crypto: 'crypto-store',
// } as const;

export function setFallbackSession(
  accessToken: string,
  deviceId: string,
  userId: string,
  baseUrl: string,
) {
  localStorage.setItem(SESSION_STORAGE_KEYS.accessToken, accessToken);
  localStorage.setItem(SESSION_STORAGE_KEYS.deviceId, deviceId);
  localStorage.setItem(SESSION_STORAGE_KEYS.userId, userId);
  localStorage.setItem(SESSION_STORAGE_KEYS.homeserver, baseUrl);
}
export const removeFallbackSession = () => {
  Object.values(SESSION_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
};
export const getFallbackSession = (): Session | undefined => {
  const baseUrl = localStorage.getItem(SESSION_STORAGE_KEYS.homeserver);
  const userId = localStorage.getItem(SESSION_STORAGE_KEYS.userId);
  const deviceId = localStorage.getItem(SESSION_STORAGE_KEYS.deviceId);
  const accessToken = localStorage.getItem(SESSION_STORAGE_KEYS.accessToken);

  if (baseUrl && userId && deviceId && accessToken) {
    const session: Session = {
      baseUrl,
      userId,
      deviceId,
      accessToken,
      fallbackSdkStores: true,
    };

    return session;
  }

  return undefined;
};
/**
 * End of migration code for old session
 */

// export const getSessionStoreName = (session: Session): SessionStoreName => {
//   if (session.fallbackSdkStores) {
//     return FALLBACK_STORE_NAME;
//   }

//   return {
//     sync: `sync${session.userId}`,
//     crypto: `crypto${session.userId}`,
//   };
// };

// export const MATRIX_SESSIONS_KEY = 'matrixSessions';
// const baseSessionsAtom = atomWithLocalStorage<Sessions>(
//   MATRIX_SESSIONS_KEY,
//   (key) => {
//     const defaultSessions: Sessions = [];
//     const sessions = getLocalStorageItem(key, defaultSessions);

//     // Before multi account support session was stored
//     // as multiple item in local storage.
//     // So we need these migration code.
//     const fallbackSession = getFallbackSession();
//     if (fallbackSession) {
//       removeFallbackSession();
//       sessions.push(fallbackSession);
//       setLocalStorageItem(key, sessions);
//     }
//     return sessions;
//   },
//   (key, value) => {
//     setLocalStorageItem(key, value);
//   }
// );

// export type SessionsAction =
//   | {
//       type: 'PUT';
//       session: Session;
//     }
//   | {
//       type: 'DELETE';
//       session: Session;
//     };

// export const sessionsAtom = atom<Sessions, [SessionsAction], undefined>(
//   (get) => get(baseSessionsAtom),
//   (get, set, action) => {
//     if (action.type === 'PUT') {
//       const sessions = [...get(baseSessionsAtom)];
//       const sessionIndex = sessions.findIndex(
//         (session) => session.userId === action.session.userId
//       );
//       if (sessionIndex === -1) {
//         sessions.push(action.session);
//       } else {
//         sessions.splice(sessionIndex, 1, action.session);
//       }
//       set(baseSessionsAtom, sessions);
//       return;
//     }
//     if (action.type === 'DELETE') {
//       const sessions = get(baseSessionsAtom).filter(
//         (session) => session.userId !== action.session.userId
//       );
//       set(baseSessionsAtom, sessions);
//     }
//   }
// );
