import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, Switch, Button, color, Spinner } from 'folds';
import { IPusherRequest } from 'matrix-js-sdk';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { getNotificationState, usePermissionState } from '../../../hooks/usePermission';
import { useEmailNotifications } from '../../../hooks/useEmailNotifications';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useClientConfig } from '../../../hooks/useClientConfig';
import { getOriginBaseUrl } from '../../../pages/pathUtils';
import {
  disconnectPushNotifications,
  enablePushNotifications,
  getPushStatus,
  PushNotificationStatus,
  sendTestPushNotification,
} from '../../../utils/pushNotifications';

function EmailNotification() {
  const mx = useMatrixClient();
  const [result, refreshResult] = useEmailNotifications();

  const [setState, setEnable] = useAsyncCallback(
    useCallback(
      async (email: string, enable: boolean) => {
        if (enable) {
          await mx.setPusher({
            kind: 'email',
            app_id: 'm.email',
            pushkey: email,
            app_display_name: 'Email Notifications',
            device_display_name: email,
            lang: 'en',
            data: {
              brand: 'IIIT social',
            },
            append: true,
          });
          return;
        }
        await mx.setPusher({
          pushkey: email,
          app_id: 'm.email',
          kind: null,
        } as unknown as IPusherRequest);
      },
      [mx]
    )
  );

  const handleChange = (value: boolean) => {
    if (result && result.email) {
      setEnable(result.email, value).then(() => {
        refreshResult();
      });
    }
  };

  return (
    <SettingTile
      title="Email Notification"
      description={
        <>
          {result && !result.email && (
            <Text as="span" style={{ color: color.Critical.Main }} size="T200">
              Your account does not have any email attached.
            </Text>
          )}
          {result && result.email && <>Send notification to your email. {`("${result.email}")`}</>}
          {result === null && (
            <Text as="span" style={{ color: color.Critical.Main }} size="T200">
              Unexpected Error!
            </Text>
          )}
          {result === undefined && 'Send notification to your email.'}
        </>
      }
      after={
        <>
          {setState.status !== AsyncStatus.Loading &&
            typeof result === 'object' &&
            result?.email && <Switch value={result.enabled} onChange={handleChange} />}
          {(setState.status === AsyncStatus.Loading || result === undefined) && (
            <Spinner variant="Secondary" />
          )}
        </>
      }
    />
  );
}

export function SystemNotification() {
  const mx = useMatrixClient();
  const { hashRouter } = useClientConfig();
  const notifPermission = usePermissionState('notifications', getNotificationState());
  const [, setShowNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [notifyWhenActive, setNotifyWhenActive] = useSetting(settingsAtom, 'notifyWhenActive');
  const [isNotificationSounds, setIsNotificationSounds] = useSetting(
    settingsAtom,
    'isNotificationSounds'
  );

  const [pushStatus, setPushStatus] = useState<PushNotificationStatus>();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string>();
  const [pushNotice, setPushNotice] = useState<string>();

  const refreshPushStatus = useCallback(() => {
    getPushStatus()
      .then(setPushStatus)
      .catch(() => setPushStatus('stale'));
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshPushStatus();
    };
    refreshPushStatus();
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [notifPermission, refreshPushStatus]);

  const runPushAction = async (action: () => Promise<void>) => {
    setPushBusy(true);
    setPushError(undefined);
    setPushNotice(undefined);
    try {
      await action();
      refreshPushStatus();
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Push notification setup failed.');
    } finally {
      setPushBusy(false);
    }
  };

  const sendTest = () =>
    runPushAction(async () => {
      await sendTestPushNotification();
      setPushNotice('Test sent. Background the app to see the notification.');
    });

  const pushDescription = {
    unsupported: 'Web Push is not supported here. On iPhone or iPad, install the app first.',
    'permission-required': 'Enable reliable notifications when this app is closed.',
    blocked:
      'Notification permission is blocked. Allow it in this site’s browser settings, then choose Check again.',
    inactive: 'Push notifications are disconnected on this device.',
    active: 'Push notifications are active on this device.',
    stale: 'The saved push subscription needs to be enabled again.',
  }[pushStatus ?? 'inactive'];

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">System</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Push notifications on this device"
          description={
            <span aria-live="polite">
              {pushDescription}
              {pushNotice && (
                <Text as="span" style={{ color: color.Success.Main }} size="T200">
                  {' '}
                  {pushNotice}
                </Text>
              )}
              {pushError && (
                <Text as="span" style={{ color: color.Critical.Main }} size="T200">
                  {' '}
                  {pushError}
                </Text>
              )}
            </span>
          }
          after={
            <Box gap="100">
              {pushStatus === 'active' && (
                <>
                  <Button
                    style={{ minHeight: 44 }}
                    size="300"
                    radii="300"
                    disabled={pushBusy}
                    onClick={sendTest}
                  >
                    <Text size="B300">Send test</Text>
                  </Button>
                  <Button
                    style={{ minHeight: 44 }}
                    size="300"
                    radii="300"
                    variant="Critical"
                    disabled={pushBusy}
                    onClick={() =>
                      runPushAction(async () => {
                        await disconnectPushNotifications(mx);
                        setShowNotifications(false);
                      })
                    }
                  >
                    <Text size="B300">Disconnect</Text>
                  </Button>
                </>
              )}
              {pushStatus === 'blocked' && (
                <Button
                  style={{ minHeight: 44 }}
                  size="300"
                  radii="300"
                  disabled={pushBusy}
                  onClick={refreshPushStatus}
                >
                  <Text size="B300">Check again</Text>
                </Button>
              )}
              {pushStatus !== 'active' && pushStatus !== 'blocked' && (
                <Button
                  style={{ minHeight: 44 }}
                  size="300"
                  radii="300"
                  disabled={pushBusy || pushStatus === 'unsupported'}
                  onClick={() =>
                    runPushAction(async () => {
                      await enablePushNotifications(mx, getOriginBaseUrl(hashRouter));
                      setShowNotifications(true);
                    })
                  }
                >
                  <Text size="B300">Enable</Text>
                </Button>
              )}
              {pushBusy && <Spinner variant="Secondary" />}
            </Box>
          }
        />
      </SequenceCard>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Notify while the app is open"
          description="Show message notifications even while IIIT social is active."
          after={<Switch value={notifyWhenActive} onChange={setNotifyWhenActive} />}
        />
      </SequenceCard>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Notification Sound"
          description="Play a sound when new messages arrive."
          after={<Switch value={isNotificationSounds} onChange={setIsNotificationSounds} />}
        />
      </SequenceCard>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <EmailNotification />
      </SequenceCard>
    </Box>
  );
}
