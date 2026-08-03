import { createClient, MatrixClient, IndexedDBStore, IndexedDBCryptoStore } from 'matrix-js-sdk';

import { cryptoCallbacks } from './secretStorageKeys';
import { clearNavToActivePathStore } from '../app/state/navToActivePath';
import { pushSessionToSW } from '../sw-session';
import { disconnectPushNotifications, unsubscribeLocalPush } from '../app/utils/pushNotifications';

type Session = {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
};

const LEGACY_SYNC_STORE_NAME = 'web-sync-store';
const SYNC_STORE_NAME_PREFIX = 'web-sync-store-v2';
const LEGACY_CRYPTO_STORE_NAME = 'crypto-store';

const getSessionStoreScope = async (session: Session): Promise<string> => {
  const scope = `${session.baseUrl}\u0000${session.userId}\u0000${session.deviceId}`;
  const subtleCrypto = globalThis.crypto?.subtle;

  if (subtleCrypto && typeof TextEncoder !== 'undefined') {
    const digest = await subtleCrypto.digest('SHA-256', new TextEncoder().encode(scope));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  }

  // Keep the fallback deterministic without ever including the access token.
  return encodeURIComponent(scope).replace(/%/g, '_');
};

const deleteIndexedDb = async (name: string): Promise<void> => {
  if (!global.indexedDB) return;

  await new Promise<void>((resolve) => {
    const request = global.indexedDB.deleteDatabase(`matrix-js-sdk:${name}`);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};

const removeLegacySyncStore = () => deleteIndexedDb(LEGACY_SYNC_STORE_NAME);

export const initClient = async (session: Session): Promise<MatrixClient> => {
  const storeScope = await getSessionStoreScope(session);
  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    localStorage: global.localStorage,
    dbName: `${SYNC_STORE_NAME_PREFIX}-${storeScope}`,
  });

  // Keep the legacy crypto name stable so matrix-js-sdk can migrate existing
  // Olm data into Rust Crypto without losing encryption keys.
  const legacyCryptoStore = new IndexedDBCryptoStore(global.indexedDB, LEGACY_CRYPTO_STORE_NAME);

  const mx = createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    store: indexedDBStore,
    cryptoStore: legacyCryptoStore,
    deviceId: session.deviceId,
    timelineSupport: true,
    cryptoCallbacks: cryptoCallbacks as any,
    verificationMethods: ['m.sas.v1'],
  });

  await indexedDBStore.startup();
  // Do not leave the old unscoped message cache available to another session.
  removeLegacySyncStore().catch(() => undefined);
  await mx.initRustCrypto();

  mx.setMaxListeners(50);

  return mx;
};

export const startClient = async (mx: MatrixClient) => {
  await mx.startClient({
    lazyLoadMembers: true,
  });
};

export const clearCacheAndReload = async (mx: MatrixClient) => {
  mx.stopClient();
  clearNavToActivePathStore(mx.getSafeUserId());
  await mx.store.deleteAllData();
  await removeLegacySyncStore();
  window.location.reload();
};

export const checkForUpdatesAndReload = async () => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  }
  window.location.reload();
};

export const logoutClient = async (mx: MatrixClient) => {
  await disconnectPushNotifications(mx);
  pushSessionToSW();
  mx.stopClient();
  try {
    await mx.logout();
  } catch {
    // ignore if failed to logout
  }
  await mx.clearStores();
  await removeLegacySyncStore();
  window.localStorage.clear();
  window.location.reload();
};

export const clearLoginData = async () => {
  await unsubscribeLocalPush();
  const dbs = await window.indexedDB.databases();

  dbs.forEach((idbInfo) => {
    const { name } = idbInfo;
    if (name) {
      window.indexedDB.deleteDatabase(name);
    }
  });

  window.localStorage.clear();
  window.location.reload();
};
