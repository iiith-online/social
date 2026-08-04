import React from 'react';
import { Box, Switch, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SequenceCardStyle } from '../styles.css';

export function TogglesContent() {
  const [hideActivity, setHideActivity] = useSetting(settingsAtom, 'hideActivity');
  const [showDecryptionErrors, setShowDecryptionErrors] = useSetting(
    settingsAtom,
    'showDecryptionErrors'
  );

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Activity</Text>
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
      </SequenceCard>
    </Box>
  );
}
