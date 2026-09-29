import { describe, expect, it } from 'vitest';
import { dampExposure, exposureTarget, zoneAt } from '@/engine/environment/exposure';
import { seasideHouse } from '@/worlds/seaside-house/definition';

describe('corridor exposure', () => {
  it('shifts from about 1.2 in the corridor toward 0.9 facing the glass', () => {
    expect(zoneAt({ x: 0, z: -6 }, seasideHouse.zones)).toBe('corridor');
    expect(exposureTarget('corridor', 1)).toBeCloseTo(1.2, 2);
    expect(exposureTarget('interior', 1)).toBeCloseTo(0.9, 2);
    expect(exposureTarget('interior', 0)).toBeCloseTo(1, 2);
    expect(exposureTarget('terrace', 0.2)).toBeCloseTo(0.9, 2);
    const settled = dampExposure(1.2, 0.9, 8);
    expect(settled).toBeLessThan(0.95);
  });
});
