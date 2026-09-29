import { describe, expect, it } from 'vitest';
import { CAMERA_FRAME_PRIORITY, PROJECTOR_FRAME_PRIORITY } from '@/engine/render/frameOrder';

describe('frame order', () => {
  it('writes the camera, then the projector, before the composer', () => {
    expect(CAMERA_FRAME_PRIORITY).toBeLessThan(PROJECTOR_FRAME_PRIORITY);
    expect(PROJECTOR_FRAME_PRIORITY).toBe(0);
  });
});
