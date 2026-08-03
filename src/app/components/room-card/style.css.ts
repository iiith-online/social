import { style } from '@vanilla-extract/css';
import { DefaultReset, config } from 'folds';
import { ContainerColor } from '../../styles/ContainerColor.css';

export const CardGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  alignItems: 'start',
  gap: config.space.S400,
});

export const RoomCardBase = style([
  DefaultReset,
  ContainerColor({ variant: 'SurfaceVariant' }),
  {
    alignSelf: 'start',
    padding: config.space.S400,
    borderRadius: config.radii.R500,
  },
]);

export const RoomCardTopic = style({
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  cursor: 'pointer',

  ':hover': {
    textDecoration: 'underline',
  },
});

export const ActionButton = style({
  flex: '1 1 0',
  minWidth: 1,
});
