import type { Metrics, ResolvedForm } from '../model/types';

/**
 * 一律使用 UI 符號（正數 = 投入）直接從輸入計算。
 * 不可從已翻好符號的 CashFlow[] 反推——那會變成翻兩次，容易出錯。
 */
export function computeMetrics(form: ResolvedForm, xirr: number): Metrics {
  let totalInvested = form.initial.amount;
  let totalWithdrawn = 0;

  for (const row of form.rows) {
    if (row.amount > 0) totalInvested += row.amount;
    else if (row.amount < 0) totalWithdrawn += -row.amount;
  }

  // 期末部位視為未實現，不計入 totalWithdrawn
  const currentPosition = form.final.amount;
  const totalReturn = currentPosition + totalWithdrawn - totalInvested;

  return { totalInvested, totalWithdrawn, currentPosition, totalReturn, xirr };
}
