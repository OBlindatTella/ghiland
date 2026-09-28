import { describe, expect, it } from 'vitest';
import { CAMERA_FRAME_PRIORITY } from '@/engine/render/frameOrder';

describe('frame order', () => {
  it('writes the camera before priority-0 listeners and the composer', () => {
    expect(CAMERA_FRAME_PRIORITY).toBeLessThan(0);
  });
});
