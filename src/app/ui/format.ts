/** 超過此報酬率就不印精確值——那串數字對使用者沒有意義 */
export const DISPLAY_CLAMP = 1e6;

const amountFormatter = new Intl.NumberFormat('zh-TW', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('zh-TW', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(value: number): string {
  return amountFormatter.format(value);
}

export function formatPercent(rate: number): string {
  if (rate > DISPLAY_CLAMP) return '> 100,000,000%';
  return `${percentFormatter.format(rate * 100)}%`;
}
