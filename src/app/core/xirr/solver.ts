import type { CashFlow } from '../model/types';
import { npv, npvDerivative } from './npv';

export type SolveResult = { status: 'OK'; rate: number } | { status: 'NO_SOLUTION' };

const NEWTON_START = 0.1;
const NEWTON_MAX_ITERATIONS = 100;
const RELATIVE_TOLERANCE = 1e-9;
const LOWER_BOUND = -0.9999;
const MAX_DOUBLINGS = 1000;
const BISECTION_ITERATIONS = 300;

function scaleOf(cfs: readonly CashFlow[]): number {
  let max = 0;
  for (const c of cfs) max = Math.max(max, Math.abs(c.amount));
  return max === 0 ? 1 : max;
}

/** 笛卡兒符號法則所用的符號變換次數。根的數量上限等於此值。金額為 0 者略過 */
export function countSignChanges(cfs: readonly CashFlow[]): number {
  let changes = 0;
  let previous = 0;
  for (const c of cfs) {
    const sign = Math.sign(c.amount);
    if (sign === 0) continue;
    if (previous !== 0 && sign !== previous) changes++;
    previous = sign;
  }
  return changes;
}

function newton(cfs: readonly CashFlow[], tolerance: number): number | null {
  let rate = NEWTON_START;
  for (let i = 0; i < NEWTON_MAX_ITERATIONS; i++) {
    const value = npv(cfs, rate);
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value) < tolerance) return rate;

    const slope = npvDerivative(cfs, rate);
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-12) return null;

    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -1) return null;
    if (Math.abs(next - rate) < 1e-14) return next;
    rate = next;
  }
  return null;
}

/**
 * 右端從 1.0 開始倍增直到 NPV 變號。
 * 不可改回固定上限：「一天翻倍」的真解是 2^365 - 1 ~ 7.5e109，
 * 任何合理的固定上限都會讓它被誤報為無解（見 spec §7）。
 */
function bisection(cfs: readonly CashFlow[]): number | null {
  const low = LOWER_BOUND;
  const valueAtLow = npv(cfs, low);
  if (!Number.isFinite(valueAtLow)) return null;

  let high = 1;
  let valueAtHigh = npv(cfs, high);
  let doublings = 0;
  while (valueAtLow * valueAtHigh > 0) {
    high *= 2;
    doublings++;
    if (doublings > MAX_DOUBLINGS || !Number.isFinite(high)) return null;
    valueAtHigh = npv(cfs, high);
    if (!Number.isFinite(valueAtHigh)) return null;
  }

  let lo = low;
  let hi = high;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (npv(cfs, lo) * npv(cfs, mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function solveXirr(cfs: readonly CashFlow[]): SolveResult {
  if (cfs.length < 2) return { status: 'NO_SOLUTION' };

  const tolerance = RELATIVE_TOLERANCE * scaleOf(cfs);
  const fromNewton = newton(cfs, tolerance);
  if (fromNewton !== null) return { status: 'OK', rate: fromNewton };

  const fromBisection = bisection(cfs);
  if (fromBisection !== null) return { status: 'OK', rate: fromBisection };

  return { status: 'NO_SOLUTION' };
}
