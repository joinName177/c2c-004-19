import type { Dimensions, PackingItem, Placement } from './models';

export function rotationsOf(item: Pick<PackingItem, 'length' | 'width' | 'height'>): Dimensions[] {
  const [a, b, c] = [item.length, item.width, item.height];
  const candidates: Dimensions[] = [
    { length: a, width: b, height: c }, { length: a, width: c, height: b },
    { length: b, width: a, height: c }, { length: b, width: c, height: a },
    { length: c, width: a, height: b }, { length: c, width: b, height: a },
  ];
  return candidates.filter((value, index) => candidates.findIndex((candidate) =>
    candidate.length === value.length && candidate.width === value.width && candidate.height === value.height,
  ) === index);
}

export function intersects(a: Placement, b: Placement): boolean {
  return a.x < b.x + b.dimensions.length && a.x + a.dimensions.length > b.x
    && a.y < b.y + b.dimensions.width && a.y + a.dimensions.width > b.y
    && a.z < b.z + b.dimensions.height && a.z + a.dimensions.height > b.z;
}

/**
 * 水平切面是否穿过物品：下界包含、上界不包含（半开区间 [z, z+h)）。
 * 上下贴合的物品共用边界时，只有实际占据该高度的物品算作穿过。
 * 切面位于箱顶（slice === ceiling）时特殊处理：仅显示上表面实际触及箱顶
 * （z + h === ceiling）的物品，没有则为空。
 */
export function passesSlice(z: number, height: number, slice: number, ceiling?: number): boolean {
  if (ceiling !== undefined && slice === ceiling) return z + height === ceiling;
  return slice >= z && slice < z + height;
}
