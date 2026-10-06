export const ITEM_COLORS = ['#df6d45', '#507d68', '#d8a84e', '#5978a7', '#9d6a83', '#6d7d86'];

export function itemColor(itemIndex: number): string {
  return ITEM_COLORS[itemIndex % ITEM_COLORS.length];
}
