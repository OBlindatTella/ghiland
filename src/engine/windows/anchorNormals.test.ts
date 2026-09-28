import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { PinAnchor } from '@/contracts/world';
import { farm } from '@/worlds/farm/definition';
import { nyBalcony } from '@/worlds/ny-balcony/definition';
import { seasideHouse } from '@/worlds/seaside-house/definition';

/** Local +Z rotated by the anchor quaternion. D-023. */
const EXPECTED: Record<string, [number, number, number]> = {
  'hero-sea': [-Math.sin((15 * Math.PI) / 180), 0, -Math.cos((15 * Math.PI) / 180)],
};

function normalOf(anchor: PinAnchor): Vector3 {
  const [x, y, z, w] = anchor.quaternion;
  return new Vector3(0, 0, 1).applyQuaternion(new Quaternion(x, y, z, w));
}

describe('window anchor normals', () => {
  const worlds = [seasideHouse, nyBalcony, farm];

  it('points every authored anchor at its viewing side', () => {
    const anchors = worlds.flatMap((world) => world.pinAnchors ?? []);
    expect(anchors.map((anchor) => anchor.id).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const anchor of anchors) {
      const expected = EXPECTED[anchor.id];
      expect(expected, anchor.id).toBeTruthy();
      const normal = normalOf(anchor);
      expect(normal.x).toBeCloseTo(expected![0], 4);
      expect(normal.y).toBeCloseTo(expected![1], 4);
      expect(normal.z).toBeCloseTo(expected![2], 4);
    }
  });
});
