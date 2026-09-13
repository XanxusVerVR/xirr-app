import type { CashFlow } from '../model/types';
import { npv, npvDerivative, npvScale } from './npv';

export type SolveResult = { status: 'OK'; rate: number } | { status: 'NO_SOLUTION' };

const NEWTON_START = 0.1;
const NEWTON_MAX_ITERATIONS = 100;
/**
 * 收斂判準：|NPV| < RELATIVE_TOLERANCE x npvScale(cfs, rate)，每次迭代按當前利率重算。
 *
 * 刻意偏離設計文件 §7 的 `|NPV| < 1e-9 x max|cf_i|`：那個式子拿未折現的原始金額
 * 去衡量折現後的殘差，量級對不上（見 npvScale 的註解與 docs/fix-notes-p1-solver.md）。
 *
 * 取 1e-12 的理由：double 的相對精度約 2.2e-16，npv 是幾乎相消的和，
 * 其浮點誤差約 n x eps x Σ|項| ~ 1e-15 x npvScale。1e-12 留了約三個數量級的餘裕，
 * 既在雜訊樓地板之上（實際可達成），又嚴格到殘差只剩下機器精度等級的利率誤差。
 * 舊的 1e-9 是拿去跟一個大得多的量比，實際上寬鬆得多。
 */
const RELATIVE_TOLERANCE = 1e-12;
/** 步長停滯判準。閾值必須相對於 |rate|——本專案的極端案例中 rate 可達 1e109，
 *  絕對閾值 1e-14 在那種量級下永遠不可能成立 */
const STEP_RELATIVE_TOLERANCE = 1e-14;
const LOWER_START = -0.9999;
const MAX_DOUBLINGS = 1000;
const MAX_LOW_HALVINGS = 60;
const BISECTION_ITERATIONS = 300;

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

function newton(cfs: readonly CashFlow[]): number | null {
  let rate = NEWTON_START;
  for (let i = 0; i < NEWTON_MAX_ITERATIONS; i++) {
    const value = npv(cfs, rate);
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value) < RELATIVE_TOLERANCE * npvScale(cfs, rate)) return rate;

    const slope = npvDerivative(cfs, rate);
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-12) return null;

    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -1) return null;
    const stepTolerance =
      STEP_RELATIVE_TOLERANCE * Math.max(Math.abs(rate), Math.abs(next));
    if (Math.abs(next - rate) <= stepTolerance) return next;
    rate = next;
  }
  return null;
}

/**
 * 兩端都用自適應擴張，任一端都不可改回固定界限。
 *
 * 右端：從 1.0 開始倍增直到 NPV 變號。「一天翻倍」的真解是 2^365 - 1 ~ 7.5e109，
 * 任何合理的固定上限都會讓它被誤報為無解（見 spec §7）。
 *
 * 左端：從 -0.9999 開始，每次把「到 -1 的剩餘距離」減半。同樣不可改回固定下限：
 * 期初 100000、期末剩 1 的真解是 -0.99998968，落在 (-1, -0.9999) 內，
 * 固定下限 -0.9999 會讓這種「幾乎全損但仍有殘值」的部位被誤報為無解。
 */
function bisection(cfs: readonly CashFlow[]): number | null {
  let low = LOWER_START;
  let valueAtLow = npv(cfs, low);
  if (!Number.isFinite(valueAtLow)) return null;

  // 右端倍增
  let high = 1;
  let valueAtHigh = npv(cfs, high);
  if (!Number.isFinite(valueAtHigh)) return null;
  let doublings = 0;
  while (valueAtLow * valueAtHigh > 0 && doublings < MAX_DOUBLINGS) {
    const nextHigh = high * 2;
    if (!Number.isFinite(nextHigh)) break;
    const nextValue = npv(cfs, nextHigh);
    if (!Number.isFinite(nextValue)) break;
    high = nextHigh;
    valueAtHigh = nextValue;
    doublings++;
  }

  let lo = low;
  let hi = high;

  // 右端找不到變號時，改逼近 -1：剩餘距離每次減半，直到 npv 不再是有限值。
  // 變號時取 [nextLow, low] 這一段當區間——兩端點相鄰，比 [nextLow, high] 窄得多，
  // 固定次數的二分才有足夠精度（用超寬區間會停在離根很遠的地方）。
  if (valueAtLow * valueAtHigh > 0) {
    let bracketed = false;
    for (let i = 0; i < MAX_LOW_HALVINGS; i++) {
      const nextLow = -1 + (1 + low) / 2;
      if (!(nextLow > -1) || nextLow === low) break;
      const nextValue = npv(cfs, nextLow);
      if (!Number.isFinite(nextValue)) break;
      if (nextValue * valueAtLow <= 0) {
        lo = nextLow;
        hi = low;
        bracketed = true;
        break;
      }
      low = nextLow;
      valueAtLow = nextValue;
    }
    // 兩端都擴張過仍未變號，才算真的無解
    if (!bracketed) return null;
  }

  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (npv(cfs, lo) * npv(cfs, mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function solveXirr(cfs: readonly CashFlow[]): SolveResult {
  if (cfs.length < 2) return { status: 'NO_SOLUTION' };

  const fromNewton = newton(cfs);
  if (fromNewton !== null) return { status: 'OK', rate: fromNewton };

  const fromBisection = bisection(cfs);
  if (fromBisection !== null) return { status: 'OK', rate: fromBisection };

  return { status: 'NO_SOLUTION' };
}
