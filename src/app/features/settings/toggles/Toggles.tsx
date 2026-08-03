import React from 'react';
import { Box, Switch, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SequenceCardStyle } from '../styles.css';

export function TogglesContent() {
  const [hideActivity, setHideActivity] = useSetting(settingsAtom, 'hideActivity');
  const [hideMembershipEvents, setHideMembershipEvents] = useSetting(
    settingsAtom,
    'hideMembershipEvents'
  );
  const [hideNickAvatarEvents, setHideNickAvatarEvents] = useSetting(
    settingsAtom,
    'hideNickAvatarEvents'
  );
  const [showDecryptionErrors, setShowDecryptionErrors] = useSetting(
    settingsAtom,
    'showDecryptionErrors'
  );
  const [showCallEvents, setShowCallEvents] = useSetting(settingsAtom, 'showCallEvents');
  const [showRoomChanges, setShowRoomChanges] = useSetting(settingsAtom, 'showRoomChanges');
  const [showHiddenEvents, setShowHiddenEvents] = useSetting(settingsAtom, 'showHiddenEvents');

  return (
    <Box direction="Column" gap="700">
      <Box direction="Column" gap="100">
        <Text size="L400">Room activity</Text>
        <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
          <SettingTile
            title="Show typing and read receipts"
            description="Display activity indicators from other people in rooms."
            after={
              <Switch
                variant="Primary"
                value={!hideActivity}
                onChange={(value) => setHideActivity(!value)}
              />
            }
          />
          <SettingTile
            title="Show membership events"
            description="Display joins, leaves, invites, and membership changes in the timeline."
            after={
              <Switch
                variant="Primary"
                value={!hideMembershipEvents}
                onChange={(value) => setHideMembershipEvents(!value)}
              />
            }
          />
          <SettingTile
            title="Show profile changes"
            description="Display display-name and avatar changes in the timeline."
            after={
              <Switch
                variant="Primary"
                value={!hideNickAvatarEvents}
                onChange={(value) => setHideNickAvatarEvents(!value)}
              />
            }
          />
          <SettingTile
            title="Show call events"
            description="Display notices when someone joins or leaves a call."
            after={<Switch variant="Primary" value={showCallEvents} onChange={setShowCallEvents} />}
          />
          <SettingTile
            title="Show room changes"
            description="Display room name, topic, and avatar changes in the timeline."
            after={
              <Switch variant="Primary" value={showRoomChanges} onChange={setShowRoomChanges} />
            }
          />
        </SequenceCard>
      </Box>
      <Box direction="Column" gap="100">
        <Text size="L400">System events</Text>
        <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
          <SettingTile
            title="Show decryption errors"
            description="Keep unable-to-decrypt notices visible when an encrypted message cannot be read."
            after={
              <Switch
                variant="Primary"
                value={showDecryptionErrors}
                onChange={setShowDecryptionErrors}
              />
            }
          />
          <SettingTile
            title="Show hidden and unsupported events"
            description="Display event types that are normally hidden from the timeline."
            after={
              <Switch variant="Primary" value={showHiddenEvents} onChange={setShowHiddenEvents} />
            }
          />
        </SequenceCard>
      </Box>
    </Box>
  );
}
