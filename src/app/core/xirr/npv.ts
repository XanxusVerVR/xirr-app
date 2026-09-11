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
