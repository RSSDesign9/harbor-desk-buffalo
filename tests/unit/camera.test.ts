import { describe, expect, it } from 'vitest';
import { CAMERA_BOUNDS, easeCamera, PRESETS, slipPose } from '../../src/scene/camera.ts';
import { slipGeom } from '../../src/data/site.ts';

describe('camera poses and easing', () => {
  it('eases with DESIGN’s camera curve: monotonic, symmetric, 0→1', () => {
    expect(easeCamera(0)).toBe(0);
    expect(easeCamera(1)).toBe(1);
    expect(easeCamera(0.5)).toBeCloseTo(0.5, 3);
    expect(easeCamera(0.25) + easeCamera(0.75)).toBeCloseTo(1, 3);
    let prev = 0;
    for (let x = 0.01; x <= 1; x += 0.01) {
      const y = easeCamera(x);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = y;
    }
  });

  it('frames B-12 from its open-water side and keeps every preset target inside the bounds', () => {
    const p = slipPose(slipGeom('B-12')!);
    expect(p.target[0]).toBeCloseTo(-4.88, 1);
    expect(p.target[2]).toBeCloseTo(1.27, 1);
    // Camera sits to the north-east (water side): +x and −z (north) of the target.
    expect(p.position[0]).toBeGreaterThan(p.target[0]);
    expect(p.position[2]).toBeLessThan(p.target[2]);
    for (const pose of [...Object.values(PRESETS), p]) {
      for (let i = 0; i < 3; i++) {
        expect(pose.target[i]).toBeGreaterThanOrEqual(CAMERA_BOUNDS.min[i]!);
        expect(pose.target[i]).toBeLessThanOrEqual(CAMERA_BOUNDS.max[i]!);
      }
    }
  });
});
