/** Neutral sun-faded wood. The back of a carried or pinned window, never a mirror of the DOM. */
export const FRAME_BACK_COLOR = '#B7A894';

export const frameFaceStyle = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
} as const;

export const frameBackStyle = {
  position: 'absolute',
  inset: 0,
  borderRadius: 10,
  background: FRAME_BACK_COLOR,
  transform: 'rotateY(180deg)',
  pointerEvents: 'none',
  ...frameFaceStyle,
} as const;
