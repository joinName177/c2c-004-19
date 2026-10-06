import type { PackingPlan, Placement, Suitcase } from './models';

export interface HeightRange {
  bottom: number;
  top: number;
}

/** 物品在箱内占据的高度区间，下界包含、上界不包含。 */
export function placementRange(placement: Placement): HeightRange {
  return { bottom: placement.z, top: placement.z + placement.dimensions.height };
}

/**
 * 判断物品是否穿过指定高度的水平切片。
 * 切面按 [bottom, top) 判定，上下贴合的物品不会因共用边界同时命中；
 * 切到箱顶时仅显示上表面实际触及箱顶的物品，没有则为空。
 */
export function crossesSlice(placement: Placement, height: number, suitcaseHeight: number): boolean {
  const { bottom, top } = placementRange(placement);
  if (height >= suitcaseHeight) return top === suitcaseHeight;
  return bottom <= height && height < top;
}

/** 只读筛选穿过切片的摆放，不修改装箱结果与统计。 */
export function slicePlacements(plan: PackingPlan, suitcase: Suitcase, height: number): Placement[] {
  return plan.placements.filter((placement) => crossesSlice(placement, height, suitcase.height));
}

/** 重新装箱或缩小箱高后，把越界切片修正回 [0, 箱高] 区间。 */
export function clampSliceHeight(height: number, suitcaseHeight: number): number {
  if (!(height > 0)) return 0;
  return Math.min(height, Math.max(suitcaseHeight, 0));
}
