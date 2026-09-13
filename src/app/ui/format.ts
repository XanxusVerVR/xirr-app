/** 超過此報酬率就不印精確值——那串數字對使用者沒有意義 */
export const DISPLAY_CLAMP = 1e6;

const wholeFormatter = new Intl.NumberFormat('zh-TW', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('zh-TW', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('zh-TW', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * 金額顯示：整數不顯示小數，有小數才顯示到小數第 2 位。
 *
 * 幣別不同，需要的精度也不同：台幣的 150,000 不該變成 150,000.00，
 * 但以 USDT 計價時 7,500.75 被四捨五入成 7,501 會失真——而且四個彙總
 * 數字各自捨入後，畫面上會出現「當前部位 + 總匯出 - 總投入」對不起來
 * 的情況（實測可差 1）。
 *
 * 先以 toFixed(2) 收斂再判斷是否為整數，而不是直接看原值：浮點運算會
 * 留下 100.00000000000001 這種殘值，直接判斷會讓它顯示成 100.00。
 * 用 toFixed 而非乘 100 取整，是為了避免大數在乘法時損失精度。
 */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return wholeFormatter.format(value);

  const rounded = Number(value.toFixed(2));
  // -0 會被格式化成 "-0"；近零負值捨入後也會落到 -0
  const normalised = Object.is(rounded, -0) ? 0 : rounded;

  return Number.isInteger(normalised)
    ? wholeFormatter.format(normalised)
    : decimalFormatter.format(normalised);
}

export function formatPercent(rate: number): string {
  if (rate > DISPLAY_CLAMP) return '> 100,000,000%';
  return `${percentFormatter.format(rate * 100)}%`;
}
