import { describe, expect, it } from 'vitest';
import { FRAME_BACK_COLOR, frameBackStyle, frameFaceStyle } from '@/shell/windows/frameBack';

describe('window back face', () => {
  it('hides the DOM front from behind and paints a neutral back panel', () => {
    expect(frameFaceStyle.backfaceVisibility).toBe('hidden');
    expect(frameBackStyle.backfaceVisibility).toBe('hidden');
    expect(frameBackStyle.transform).toContain('rotateY(180deg)');
    expect(frameBackStyle.background).toBe(FRAME_BACK_COLOR);
    expect(FRAME_BACK_COLOR).not.toBe('#141413');
    expect(frameBackStyle.pointerEvents).toBe('none');
  });
});