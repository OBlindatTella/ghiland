export interface PlayerSnapshot {
  position: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
}

export const playerRef: { current: PlayerSnapshot } = {
  current: {
    position: { x: 0, y: 1.62, z: -8.2 },
    yaw: 0,
    pitch: 0,
  },
};
