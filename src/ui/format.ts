/** 厘米数值按 1 位小数展示，并消除浮点误差。 */
export function formatCm(value: number): string {
  return `${Math.round(value * 10) / 10}`;
}
