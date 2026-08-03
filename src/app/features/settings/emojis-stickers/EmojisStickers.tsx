import React from 'react';
import { Box, Text } from 'folds';
import { GlobalPacks } from './GlobalPacks';
import { UserPack } from './UserPack';
import { ImagePack } from '../../../plugins/custom-emoji';

type EmojisStickersContentProps = {
  onViewPack: (pack: ImagePack) => void;
};
export function EmojisStickersContent({ onViewPack }: EmojisStickersContentProps) {
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Emojis & Stickers</Text>
      <Box direction="Column" gap="700">
        <UserPack onViewPack={onViewPack} />
        <GlobalPacks onViewPack={onViewPack} />
      </Box>
    </Box>
  );
}
