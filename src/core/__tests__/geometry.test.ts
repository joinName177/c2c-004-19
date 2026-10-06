import { describe, expect, it } from 'vitest';
import { intersects, passesSlice, rotationsOf } from '../geometry';
import type { PackingItem, Placement } from '../models';

const item = (length: number, width: number, height: number) => ({ length, width, height }) as PackingItem;

describe('rotationsOf', () => {
  it('returns six unique rotations for three unequal edges', () => {
    expect(rotationsOf(item(2, 3, 4))).toHaveLength(6);
  });

  it('removes duplicate rotations for a cube', () => {
    expect(rotationsOf(item(3, 3, 3))).toEqual([{ length: 3, width: 3, height: 3 }]);
  });
});

describe('intersects', () => {
  const box = (x: number, y: number, z: number): Placement => ({
    itemId: 'box', x, y, z, dimensions: { length: 2, width: 2, height: 2 },
  });

  it('allows boxes whose faces only touch', () => {
    expect(intersects(box(0, 0, 0), box(2, 0, 0))).toBe(false);
  });

  it('detects boxes with overlapping volume', () => {
    expect(intersects(box(0, 0, 0), box(1, 1, 1))).toBe(true);
  });
});

describe('passesSlice', () => {
  it('includes the lower bound and excludes the upper bound', () => {
    expect(passesSlice(0, 10, 0)).toBe(true);
    expect(passesSlice(0, 10, 5)).toBe(true);
    expect(passesSlice(0, 10, 10)).toBe(false);
  });

  it('does not count stacked items sharing a boundary twice', () => {
    // 下层 z∈[0,5)，上层 z∈[5,10)，切面在 5 时只算上层。
    expect(passesSlice(0, 5, 5)).toBe(false);
    expect(passesSlice(5, 5, 5)).toBe(true);
  });

  it('at the ceiling only shows items whose top surface reaches it', () => {
    expect(passesSlice(10, 12, 23, 23)).toBe(false);
    expect(passesSlice(11, 12, 23, 23)).toBe(true);
    expect(passesSlice(0, 23, 23, 23)).toBe(true);
  });

  it('is false below or above an item', () => {
    expect(passesSlice(5, 5, 4.9)).toBe(false);
    expect(passesSlice(5, 5, 10.1)).toBe(false);
  });
});
