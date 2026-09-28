import { describe, expect, it } from 'vitest';
import type { AcousticPortal, WorldZone } from '@/contracts/environment';
import { distanceToOpenPortal, occlusionCutoff, zoneAt } from '@/engine/audio/occlusion';

const portal: AcousticPortal = {
  id: 'open-glass',
  between: ['interior', 'terrace'],
  bounds: { min: [-4, 0, 4.4], max: [0, 3.2, 4.6] },
  open: true,
};

const zones: WorldZone[] = [
  { id: 'corridor', bounds: [{ min: [-1.1, 0, -9], max: [1.1, 2.4, -3.5] }], kind: 'interior', exposureTarget: 1 },
  { id: 'terrace', bounds: [{ min: [-7, 0, 4.5], max: [7, 3, 9] }], kind: 'exterior', exposureTarget: 1 },
];

describe('portal occlusion', () => {
  it('is quietest deep in the corridor and open on the terrace', () => {
    const far = distanceToOpenPortal(0, -8.2, [portal]);
    const near = distanceToOpenPortal(-2, 4.5, [portal]);
    expect(far).toBeGreaterThan(8);
    expect(near).toBeLessThan(0.2);
    expect(occlusionCutoff(near, 3000, 900, 8, false)).toBeGreaterThan(2500);
    expect(occlusionCutoff(far, 3000, 900, 8, false)).toBeLessThanOrEqual(900);
    expect(occlusionCutoff(far, 3000, 900, 8, true)).toBe(18000);
  });

  it('reads interior and exterior zones', () => {
    expect(zoneAt(0, 1.62, -8.2, zones)?.id).toBe('corridor');
    expect(zoneAt(0, 1.62, 7, zones)?.kind).toBe('exterior');
  });
});
