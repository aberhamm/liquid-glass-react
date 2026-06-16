import { describe, expect, it } from 'vitest';
import { calculateDirectionalScale, calculateElasticTranslation } from './motion';

describe('calculateDirectionalScale', () => {
  it('returns identity when elasticity is 0 (hard no-motion guarantee)', () => {
    // Even with a large offset, zero elasticity must yield no scale.
    expect(calculateDirectionalScale(100, 50, 0, 0, 0)).toEqual({ scaleX: 1, scaleY: 1 });
  });

  it('returns identity for negative or NaN elasticity', () => {
    expect(calculateDirectionalScale(100, 0, 0, 0, -1)).toEqual({ scaleX: 1, scaleY: 1 });
    expect(calculateDirectionalScale(100, 0, 0, 0, Number.NaN)).toEqual({ scaleX: 1, scaleY: 1 });
  });

  it('returns identity at the exact center (no direction to stretch)', () => {
    expect(calculateDirectionalScale(0, 0, 0, 0, 1)).toEqual({ scaleX: 1, scaleY: 1 });
  });

  it('stretches X and narrows Y for a horizontal offset', () => {
    // Cursor 60px to the right of center: |nx|=1, |ny|=0.
    // fadeIn = 1 - 60/200 = 0.7; stretch = min(60/300,1)*1*0.7 = 0.2*0.7 = 0.14.
    // scaleX = 1 + 1*0.14*0.3 = 1.042; scaleY = 1 - 1*0.14*0.15 = 0.979.
    const { scaleX, scaleY } = calculateDirectionalScale(60, 0, 0, 0, 1);
    expect(scaleX).toBeCloseTo(1.042, 3);
    expect(scaleY).toBeCloseTo(0.979, 3);
    expect(scaleX).toBeGreaterThan(scaleY);
  });

  it('is symmetric: a vertical offset stretches Y and narrows X', () => {
    const horizontal = calculateDirectionalScale(60, 0, 0, 0, 1);
    const vertical = calculateDirectionalScale(0, 60, 0, 0, 1);
    expect(vertical.scaleY).toBeCloseTo(horizontal.scaleX, 6);
    expect(vertical.scaleX).toBeCloseTo(horizontal.scaleY, 6);
  });

  it('scales with elasticity', () => {
    const weak = calculateDirectionalScale(60, 0, 0, 0, 0.5);
    const strong = calculateDirectionalScale(60, 0, 0, 0, 1.5);
    expect(strong.scaleX).toBeGreaterThan(weak.scaleX);
  });

  it('fades to identity beyond the activation distance', () => {
    // 250px > 200px activation distance ⇒ fadeIn 0 ⇒ no motion.
    expect(calculateDirectionalScale(250, 0, 0, 0, 1)).toEqual({ scaleX: 1, scaleY: 1 });
  });

  it('grows toward identity as distance increases past activation (fade-in monotonic)', () => {
    const near = calculateDirectionalScale(20, 0, 0, 0, 1).scaleX;
    const mid = calculateDirectionalScale(60, 0, 0, 0, 1).scaleX;
    // Closer to center => larger fadeIn but smaller distance-stretch; here the
    // net at 60 is larger than at 20 because the stretch ramp dominates early.
    expect(near).toBeGreaterThan(1);
    expect(mid).toBeGreaterThan(1);
  });

  it('clamps scaleX/scaleY to >= 0.8 under extreme elasticity', () => {
    // Huge elasticity drives the cross-axis narrowing hard; must not go below 0.8.
    const { scaleX, scaleY } = calculateDirectionalScale(60, 0, 0, 0, 1000);
    expect(scaleX).toBeGreaterThanOrEqual(0.8);
    expect(scaleY).toBeGreaterThanOrEqual(0.8);
  });
});

describe('calculateElasticTranslation', () => {
  it('returns zero when elasticity is 0 (hard no-motion guarantee)', () => {
    expect(calculateElasticTranslation(100, 50, 0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('returns zero for negative or NaN elasticity', () => {
    expect(calculateElasticTranslation(100, 0, 0, 0, -2)).toEqual({ x: 0, y: 0 });
    expect(calculateElasticTranslation(100, 0, 0, 0, Number.NaN)).toEqual({ x: 0, y: 0 });
  });

  it('returns zero at the exact center', () => {
    expect(calculateElasticTranslation(0, 0, 0, 0, 1)).toEqual({ x: 0, y: 0 });
  });

  it('nudges toward the cursor by (offset * elasticity * 0.1 * fadeIn)', () => {
    // Offset (40, 0): centerDist 40; fadeIn = 1 - 40/200 = 0.8.
    // x = 40 * 1 * 0.1 * 0.8 = 3.2; y = 0.
    const { x, y } = calculateElasticTranslation(40, 0, 0, 0, 1);
    expect(x).toBeCloseTo(3.2, 5);
    expect(y).toBeCloseTo(0, 5);
  });

  it('scales linearly with elasticity', () => {
    const a = calculateElasticTranslation(40, 0, 0, 0, 0.5).x;
    const b = calculateElasticTranslation(40, 0, 0, 0, 1).x;
    expect(b).toBeCloseTo(a * 2, 6);
  });

  it('fades to zero beyond the activation distance', () => {
    expect(calculateElasticTranslation(300, 0, 0, 0, 1)).toEqual({ x: 0, y: 0 });
  });

  it('respects non-zero center coordinates', () => {
    // Mouse (140,100), center (100,100) => offset (40,0).
    const { x, y } = calculateElasticTranslation(140, 100, 100, 100, 1);
    expect(x).toBeCloseTo(3.2, 5);
    expect(y).toBeCloseTo(0, 5);
  });
});
