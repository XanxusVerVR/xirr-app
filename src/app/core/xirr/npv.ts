import type { CashFlow } from '../model/types';

const DAYS_PER_YEAR = 365;

function yearsFromStart(cfs: readonly CashFlow[], index: number): number {
  return (cfs[index].epochDay - cfs[0].epochDay) / DAYS_PER_YEAR;
}

export function npv(cfs: readonly CashFlow[], rate: number): number {
  let total = 0;
  for (let i = 0; i < cfs.length; i++) {
    total += cfs[i].amount / Math.pow(1 + rate, yearsFromStart(cfs, i));
  }
  return total;
}

export function npvDerivative(cfs: readonly CashFlow[], rate: number): number {
  let total = 0;
  for (let i = 0; i < cfs.length; i++) {
    const t = yearsFromStart(cfs, i);
    total -= (t * cfs[i].amount) / Math.pow(1 + rate, t + 1);
  }
  return total;
}

/**
 * Σ |cf_i / (1+rate)^t_i|——npv() 在此利率下實際加總的那些項的量級。
 *
 * npv() 是一個幾乎完全相消的和：它的殘差只能拿「被加總的項」來衡量，
 * 不能拿未折現的原始金額 max|cf_i| 來衡量。當最早一筆現金流的日期遠早於
 * 其餘現金流時，(1+r)^t 會把後面每一項都縮小好幾個數量級，殘差跟著變小，
 * 但 max|cf_i| 不變——收斂判準就會在利率離真解還很遠時誤判成功。
 *
 * 與 npv() 共用 yearsFromStart 與同一個 365 天分母，兩者不會各自漂移。
 * 和為 0 或非有限值時回傳 1，確保容許誤差永遠不會退化成 0。
 */
export function npvScale(cfs: readonly CashFlow[], rate: number): number {
  let total = 0;
  for (let i = 0; i < cfs.length; i++) {
    total += Math.abs(cfs[i].amount / Math.pow(1 + rate, yearsFromStart(cfs, i)));
  }
  return Number.isFinite(total) && total > 0 ? total : 1;
}
