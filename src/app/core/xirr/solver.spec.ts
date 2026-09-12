import type { CashFlow } from '../model/types';
import { toEpochDay } from '../date';
import { countSignChanges, solveXirr } from './solver';

const cf = (date: string, amount: number): CashFlow => ({
  epochDay: toEpochDay(date),
  amount,
});

const rateOf = (cfs: CashFlow[]): number => {
  const r = solveXirr(cfs);
  if (r.status !== 'OK') throw new Error(`expected OK, got ${r.status}`);
  return r.rate;
};

describe('solveXirr — 黃金值', () => {
  it('[A] 一年 10%（解析解，可手算驗證）', () => {
    expect(rateOf([cf('2024-01-01', -1000), cf('2024-12-31', 1100)])).toBeCloseTo(0.1, 9);
  });

  it('[B] 範例資料 → 19.353321%', () => {
    const cfs = [
      cf('2024-01-01', -100000),
      cf('2024-03-15', -50000),
      cf('2024-08-20', 30000),
      cf('2025-01-01', 145000),
    ];
    expect(rateOf(cfs) * 100).toBeCloseTo(19.353321, 5);
  });

  it('[C] 符號變換 3 次 → 29.650138%', () => {
    const cfs = [
      cf('2024-01-01', -100000),
      cf('2024-04-01', 120000),
      cf('2024-07-01', -80000),
      cf('2025-01-01', 75000),
    ];
    expect(rateOf(cfs) * 100).toBeCloseTo(29.650138, 5);
  });

  it('[E] 一天翻倍 → 2^365 - 1，固定上限會誤報無解', () => {
    const rate = rateOf([cf('2024-01-01', -100), cf('2024-01-02', 200)]);
    expect(rate).toBeGreaterThan(1e109);
    expect(rate / (Math.pow(2, 365) - 1)).toBeCloseTo(1, 6);
  });

  it('[F] 一天 +1% → 約 3678.343%', () => {
    const rate = rateOf([cf('2024-01-01', -100), cf('2024-01-02', 101)]);
    expect(rate * 100).toBeCloseTo(3678.343, 2);
  });

  it('[H] 幾乎全損但仍有殘值 → r ~ -0.99999，固定下限會誤報無解', () => {
    // 期初 100000、一年後只剩 1。真解 -0.99998968 落在 (-1, -0.9999)，
    // 固定下限 -0.9999 時 NPV(-0.9999) = -89744，倍增右端永遠碰不到變號。
    const rate = rateOf([cf('2024-01-01', -100000), cf('2025-01-01', 1)]);
    expect(rate).toBeCloseTo(-0.999989680439, 9);
    expect(rate).toBeGreaterThan(-1);
  });

  it('[H2] 殘值更小時仍算得出數字', () => {
    const rate = rateOf([cf('2024-01-01', -100000), cf('2025-01-01', 0.01)]);
    expect(rate).toBeCloseTo(-0.999999895498, 11);
    expect(rate).toBeGreaterThan(-1);
  });

  it('-99.99% 這種原本就在區間內的損失不受影響', () => {
    const rate = rateOf([cf('2024-01-01', -100000), cf('2025-01-01', 10)]);
    expect(rate).toBeCloseTo(-0.999897451583, 9);
  });
});

describe('solveXirr — 無解', () => {
  it('[D] 全部 <= 0（只有投入、期末歸零）', () => {
    expect(solveXirr([cf('2024-01-01', -100000), cf('2025-01-01', 0)]).status)
      .toBe('NO_SOLUTION');
  });

  it('[G] 全部 >= 0（沒投入過卻一直提款）', () => {
    const cfs = [cf('2024-01-01', 0), cf('2024-06-01', 5000), cf('2025-01-01', 0)];
    expect(solveXirr(cfs).status).toBe('NO_SOLUTION');
  });
});

describe('solveXirr — 性質測試：反解往返', () => {
  const dates = ['2020-03-11', '2021-07-02', '2022-01-19', '2023-11-30', '2024-05-05'];

  for (const target of [-0.55, -0.1, 0.0001, 0.07, 0.42, 1.8, 6.5]) {
    it(`能解回 r = ${target}`, () => {
      // 先給前幾筆投入，再用「在 target 折現率下使 NPV 恰為 0」的金額當最後一筆
      const outflows: CashFlow[] = dates
        .slice(0, dates.length - 1)
        .map((d, i) => cf(d, -1000 * (i + 1)));
      const last = dates[dates.length - 1];
      const d0 = outflows[0].epochDay;
      const tLast = (toEpochDay(last) - d0) / 365;
      let pv = 0;
      for (const o of outflows) {
        pv += o.amount / Math.pow(1 + target, (o.epochDay - d0) / 365);
      }
      const closing = -pv * Math.pow(1 + target, tLast);
      expect(rateOf([...outflows, cf(last, closing)])).toBeCloseTo(target, 7);
    });
  }
});

describe('countSignChanges', () => {
  it('先付後收只變換一次', () => {
    expect(countSignChanges([cf('2024-01-01', -100), cf('2024-12-31', 110)])).toBe(1);
  });

  it('來回進出變換三次', () => {
    const cfs = [
      cf('2024-01-01', -100000),
      cf('2024-04-01', 120000),
      cf('2024-07-01', -80000),
      cf('2025-01-01', 75000),
    ];
    expect(countSignChanges(cfs)).toBe(3);
  });

  it('忽略金額為 0 的項目', () => {
    const cfs = [cf('2024-01-01', -100), cf('2024-06-01', 0), cf('2024-12-31', 110)];
    expect(countSignChanges(cfs)).toBe(1);
  });

  it('全部同號為 0 次', () => {
    expect(countSignChanges([cf('2024-01-01', -100), cf('2024-12-31', -50)])).toBe(0);
  });
});
