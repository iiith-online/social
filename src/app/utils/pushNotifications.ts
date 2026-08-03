import { IPusherRequest, MatrixClient } from 'matrix-js-sdk';

const STORAGE_KEY = 'push-registration-v1';
const RECONCILE_INTERVAL = 24 * 60 * 60 * 1000;

export type PushNotificationStatus =
  | 'unsupported'
  | 'permission-required'
  | 'blocked'
  | 'inactive'
  | 'active'
  | 'stale';

type PushGatewayConfig = {
  enabled: boolean;
  vapidPublicKey: string;
  appId: string;
  notifyUrl: string;
};

class PushRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type PushRegistration = {
  pushKey: string;
  managementToken: string;
  appId: string;
  notifyUrl: string;
  clickBase: string;
  lastReconciledAt: number;
  previewMode?: 'maximum' | 'private';
};

const apiUrl = (path: string) => new URL(path, window.location.origin).href;

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(apiUrl(path), init);
  if (!response.ok) {
    const result = await response.json().catch(() => undefined);
    throw new PushRequestError(
      result?.error || `Push request failed (${response.status}).`,
      response.status
    );
  }
  return response.json() as Promise<T>;
};

const decodeVapidKey = (value: string): Uint8Array => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const bytes = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
};

const sameKey = (subscription: PushSubscription, key: Uint8Array): boolean => {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((value, index) => value === key[index]);
};

export const pushSupported = () =>
  'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

export const getPushRegistration = (): PushRegistration | undefined => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as PushRegistration) : undefined;
  } catch {
    return undefined;
  }
};

const savePushRegistration = (registration: PushRegistration) =>
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(registration));

const setHttpPusher = (mx: MatrixClient, registration: PushRegistration) =>
  mx.setPusher({
    app_id: registration.appId,
    pushkey: registration.pushKey,
    kind: 'http',
    app_display_name: 'IIIT social',
    device_display_name: 'This browser',
    lang: navigator.language || 'en',
    data: { url: registration.notifyUrl },
    append: true,
  });

const deleteHttpPusher = (mx: MatrixClient, registration: PushRegistration) =>
  mx.setPusher({
    app_id: registration.appId,
    pushkey: registration.pushKey,
    kind: null,
  } as unknown as IPusherRequest);

const gatewayRequest = (registration: PushRegistration, method: 'POST' | 'DELETE', body?: object) =>
  request('/api/push/subscription', {
    method,
    headers: {
      Authorization: `Bearer ${registration.managementToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

export const getPushStatus = async (): Promise<PushNotificationStatus> => {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const registration = getPushRegistration();
  if (!registration) {
    return Notification.permission === 'default' ? 'permission-required' : 'inactive';
  }
  const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  return Notification.permission === 'granted' && subscription ? 'active' : 'stale';
};

export const enablePushNotifications = async (
  mx: MatrixClient,
  clickBase: string
): Promise<void> => {
  if (!pushSupported()) throw new Error('Push notifications are not supported.');
  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await window.Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');
  const config = await request<PushGatewayConfig>('/api/push/config');
  if (!config.enabled || !config.vapidPublicKey) {
    throw new Error('Push notifications are currently unavailable.');
  }

  const worker = await navigator.serviceWorker.ready;
  const vapidKey = decodeVapidKey(config.vapidPublicKey);
  let subscription = await worker.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, vapidKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await worker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey as unknown as BufferSource,
  });

  const current = getPushRegistration();
  const subscriptionBody = { subscription, clickBase, previewMode: 'maximum' };
  let gateway;
  try {
    gateway = await request<{ pushKey: string; managementToken: string }>(
      '/api/push/subscription',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(current ? { Authorization: `Bearer ${current.managementToken}` } : {}),
        },
        body: JSON.stringify(subscriptionBody),
      }
    );
  } catch (error) {
    if (current && error instanceof PushRequestError && [401, 404].includes(error.status)) {
      window.localStorage.removeItem(STORAGE_KEY);
      gateway = await request<{ pushKey: string; managementToken: string }>(
        '/api/push/subscription',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscriptionBody),
        }
      );
    } else {
      await subscription.unsubscribe();
      throw error;
    }
  }

  const registration: PushRegistration = {
    ...gateway,
    appId: config.appId,
    notifyUrl: config.notifyUrl,
    clickBase,
    lastReconciledAt: Date.now(),
    previewMode: 'maximum',
  };
  try {
    await setHttpPusher(mx, registration);
    savePushRegistration(registration);
  } catch (error) {
    await Promise.allSettled([gatewayRequest(registration, 'DELETE'), subscription.unsubscribe()]);
    throw error;
  }
};

export const unsubscribeLocalPush = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;
  const subscription = await (await navigator.serviceWorker.ready).pushManager?.getSubscription();
  if (subscription && !(await subscription.unsubscribe())) {
    throw new Error('Could not disconnect this browser from push notifications.');
  }
  window.localStorage.removeItem(STORAGE_KEY);
};

export const disconnectPushNotifications = async (mx: MatrixClient): Promise<void> => {
  const registration = getPushRegistration();
  await unsubscribeLocalPush();
  if (!registration) return;
  await Promise.allSettled([
    deleteHttpPusher(mx, registration),
    gatewayRequest(registration, 'DELETE'),
  ]);
};

export const sendTestPushNotification = async (): Promise<void> => {
  const registration = getPushRegistration();
  if (!registration) throw new Error('Push notifications are not enabled.');
  await request('/api/push/test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${registration.managementToken}` },
  });
};

export const reconcilePushNotifications = async (
  mx: MatrixClient,
  clickBase: string,
  force = false
): Promise<void> => {
  const registration = getPushRegistration();
  const previewNeedsUpdate = registration?.previewMode !== 'maximum';
  if (!registration || !pushSupported() || Notification.permission !== 'granted') {
    return;
  }
  const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (!subscription) {
    await enablePushNotifications(mx, clickBase);
    return;
  }
  if (
    !force &&
    !previewNeedsUpdate &&
    Date.now() - registration.lastReconciledAt < RECONCILE_INTERVAL
  ) {
    return;
  }
  await gatewayRequest(registration, 'POST', {
    subscription,
    clickBase,
    previewMode: 'maximum',
  });
  const { pushers } = await mx.getPushers();
  if (
    !pushers.some(
      (pusher) => pusher.app_id === registration.appId && pusher.pushkey === registration.pushKey
    )
  ) {
    await setHttpPusher(mx, registration);
  }
  savePushRegistration({
    ...registration,
    clickBase,
    previewMode: 'maximum',
    lastReconciledAt: Date.now(),
  });
};
