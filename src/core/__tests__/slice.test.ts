import { describe, expect, it } from 'vitest';
import { clampSliceHeight, crossesSlice, placementRange, slicePlacements } from '../slice';
import type { PackingPlan, Placement, Suitcase } from '../models';

const suitcase: Suitcase = { length: 10, width: 10, height: 8, maxWeight: 5 };
const placement = (itemId: string, z: number, height: number): Placement => ({
  itemId, x: 0, y: 0, z, dimensions: { length: 2, width: 2, height },
});

const lower = placement('lower', 0, 5);
const upper = placement('upper', 5, 3); // 上表面 8，恰好触及箱顶

describe('placementRange', () => {
  it('reports the occupied height interval', () => {
    expect(placementRange(upper)).toEqual({ bottom: 5, top: 8 });
  });
});

describe('crossesSlice', () => {
  it('includes the lower bound and excludes the upper bound', () => {
    expect(crossesSlice(lower, 0, suitcase.height)).toBe(true);
    expect(crossesSlice(lower, 4.5, suitcase.height)).toBe(true);
    expect(crossesSlice(lower, 5, suitcase.height)).toBe(false);
  });

  it('does not count stacked items sharing a boundary as both crossing', () => {
    const hits = [lower, upper].filter((entry) => crossesSlice(entry, 5, suitcase.height));
    expect(hits).toEqual([upper]);
  });

  it('shows only top surfaces touching the suitcase top when slicing at the top', () => {
    expect(crossesSlice(upper, 8, suitcase.height)).toBe(true);
    expect(crossesSlice(lower, 8, suitcase.height)).toBe(false);
  });

  it('is empty at the top when nothing reaches it', () => {
    expect(crossesSlice(placement('short', 0, 2), 8, suitcase.height)).toBe(false);
  });
});

describe('slicePlacements', () => {
  it('filters placements without mutating the plan', () => {
    const plan = { placements: [lower, upper] } as PackingPlan;
    const sliced = slicePlacements(plan, suitcase, 5);
    expect(sliced).toEqual([upper]);
    expect(plan.placements).toHaveLength(2);
  });
});

describe('clampSliceHeight', () => {
  it('clamps into the [0, suitcase height] range', () => {
    expect(clampSliceHeight(-3, 8)).toBe(0);
    expect(clampSliceHeight(4, 8)).toBe(4);
    expect(clampSliceHeight(12, 8)).toBe(8);
    expect(clampSliceHeight(12, 0)).toBe(0);
  });
});
