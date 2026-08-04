import React from 'react';
import { Box, Icon, IconButton, Icons, Text, toRem } from 'folds';
import { getPostScore, PostVote, PostVoteState } from '../../utils/postVote';

type VoteColumnProps = {
  state: PostVoteState;
  onVote: (vote: PostVote) => void;
};
export function VoteColumn({ state, onVote }: VoteColumnProps) {
  const score = getPostScore(state);

  const renderVoteButton = (vote: PostVote) => {
    const active = state.myVote === vote;
    const isUp = vote === 'up';
    return (
      <IconButton
        size="300"
        variant={active ? 'Primary' : 'Surface'}
        radii="Pill"
        aria-pressed={active}
        aria-label={isUp ? 'Upvote' : 'Downvote'}
        onClick={(evt) => {
          evt.stopPropagation();
          onVote(vote);
        }}
        style={{ width: toRem(28), minWidth: toRem(28), height: toRem(28) }}
      >
        <Icon size="100" src={isUp ? Icons.ArrowTop : Icons.ArrowBottom} />
      </IconButton>
    );
  };

  return (
    <Box direction="Column" alignItems="Center" gap="100" shrink="No">
      {renderVoteButton('up')}
      <Text size="T300" priority={score >= 0 ? '400' : '500'}>
        {score}
      </Text>
      {renderVoteButton('down')}
    </Box>
  );
}

// Horizontal variant for comment rows: votes and score on one line.
export function CompactVoteColumn({ state, onVote }: VoteColumnProps) {
  const score = getPostScore(state);

  const renderVoteButton = (vote: PostVote) => {
    const active = state.myVote === vote;
    const isUp = vote === 'up';
    return (
      <IconButton
        size="300"
        variant={active ? 'Primary' : 'Surface'}
        radii="Pill"
        aria-pressed={active}
        aria-label={isUp ? 'Upvote' : 'Downvote'}
        onClick={(evt) => {
          evt.stopPropagation();
          onVote(vote);
        }}
        style={{ width: toRem(24), minWidth: toRem(24), height: toRem(24) }}
      >
        <Icon size="100" src={isUp ? Icons.ArrowTop : Icons.ArrowBottom} />
      </IconButton>
    );
  };

  return (
    <Box direction="Row" alignItems="Center" gap="100" shrink="No">
      {renderVoteButton('up')}
      <Text size="T200" priority={score >= 0 ? '400' : '500'}>
        {score}
      </Text>
      {renderVoteButton('down')}
    </Box>
  );
}
