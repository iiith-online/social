import { MatrixClient, SyncState } from 'matrix-js-sdk';
import React, { useCallback, useEffect, useState } from 'react';
import { Box, color, Text, toRem, Tooltip, TooltipProvider } from 'folds';
import { useSyncState } from '../../hooks/useSyncState';
import { SidebarItem, SidebarItemTooltip } from '../../components/sidebar';

type StateData = {
  current: SyncState | null;
  previous: SyncState | null | undefined;
  lastSyncedAt: number | null;
};

type SyncStatusProps = {
  mx: MatrixClient;
};

type SyncStatusValue = {
  color: string;
  label: string;
  lastSyncedAt: number | null;
};

const getSyncStatusValue = (
  current: SyncState | null,
  lastSyncedAt: number | null,
  isOnline: boolean
): SyncStatusValue => {
  if (!isOnline) {
    return { color: color.Critical.Main, label: 'Offline', lastSyncedAt };
  }
  if (current === SyncState.Error) {
    return { color: color.Critical.Main, label: 'Disconnected', lastSyncedAt };
  }

  if (current === SyncState.Prepared || current === SyncState.Syncing) {
    return { color: color.Success.Main, label: 'Connected', lastSyncedAt };
  }

  return {
    color: color.Warning.Main,
    label: current === SyncState.Reconnecting ? 'Reconnecting' : 'Connecting',
    lastSyncedAt,
  };
};

export const useSyncStatus = (mx: MatrixClient): SyncStatusValue => {
  const [stateData, setStateData] = useState<StateData>(() => ({
    current: mx.getSyncState(),
    previous: undefined,
    lastSyncedAt: null,
  }));
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  );

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  useSyncState(
    mx,
    useCallback((current, previous) => {
      setStateData((s) => {
        if (s.current === current && s.previous === previous) {
          return s;
        }
        return {
          current,
          previous,
          lastSyncedAt:
            current === SyncState.Prepared || current === SyncState.Syncing
              ? Date.now()
              : s.lastSyncedAt,
        };
      });
    }, [])
  );

  return getSyncStatusValue(stateData.current, stateData.lastSyncedAt, isOnline);
};

const getLastSyncedLabel = (lastSyncedAt: number | null) => {
  if (!lastSyncedAt) return 'No successful sync yet';
  const seconds = Math.max(0, Math.round((Date.now() - lastSyncedAt) / 1000));
  return `Last synced ${seconds < 2 ? 'just now' : `${seconds}s ago`}`;
};

function SyncStatusBar({ color: barColor, label }: { color: string; label: string }) {
  return (
    <SidebarItem>
      <SidebarItemTooltip tooltip={label}>
        {(triggerRef) => (
          <Box
            as="span"
            ref={triggerRef}
            style={{
              width: toRem(24),
              height: toRem(4),
              borderRadius: toRem(4),
              backgroundColor: barColor,
              opacity: 0.85,
              boxShadow: `0 0 0 ${toRem(2)} ${color.Background.Container}`,
            }}
            role="status"
            aria-label={label}
            title={label}
          />
        )}
      </SidebarItemTooltip>
    </SidebarItem>
  );
}

export function SyncStatus({ mx }: SyncStatusProps) {
  const status = useSyncStatus(mx);
  return (
    <SyncStatusBar
      color={status.color}
      label={`${status.label} · ${getLastSyncedLabel(status.lastSyncedAt)}`}
    />
  );
}

export function SyncStatusDot({ mx }: SyncStatusProps) {
  const status = useSyncStatus(mx);

  return (
    <TooltipProvider
      position="Bottom"
      offset={4}
      tooltip={
        <Tooltip>
          <Text>
            {status.label} · {getLastSyncedLabel(status.lastSyncedAt)}
          </Text>
        </Tooltip>
      }
    >
      {(triggerRef) => (
        <Box
          as="span"
          ref={triggerRef}
          style={{
            width: toRem(7),
            height: toRem(7),
            flexShrink: 0,
            borderRadius: '50%',
            backgroundColor: status.color,
            boxShadow: `0 0 0 ${toRem(2)} ${color.Background.Container}`,
          }}
          role="status"
          aria-label={`Connection: ${status.label}. ${getLastSyncedLabel(status.lastSyncedAt)}`}
          title={`${status.label} · ${getLastSyncedLabel(status.lastSyncedAt)}`}
        />
      )}
    </TooltipProvider>
  );
}
