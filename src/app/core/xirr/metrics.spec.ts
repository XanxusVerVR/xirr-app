import type { ResolvedForm } from '../model/types';
import { computeMetrics } from './metrics';

const form = (
  initialAmount: number,
  rowAmounts: number[],
  finalAmount: number,
): ResolvedForm => ({
  initial: { date: '2024-01-01', amount: initialAmount },
  rows: rowAmounts.map((amount, i) => ({
    id: `r${i}`,
    date: `2024-0${i + 2}-01`,
    amount,
  })),
  final: { date: '2025-01-01', amount: finalAmount },
});

describe('computeMetrics', () => {
  it('範例資料的四個數字', () => {
    const m = computeMetrics(form(100000, [50000, -30000], 145000), 0.19353321);
    expect(m.totalInvested).toBe(150000);
    expect(m.totalWithdrawn).toBe(30000);
    expect(m.currentPosition).toBe(145000);
    expect(m.totalReturn).toBe(25000);
    expect(m.xirr).toBeCloseTo(0.19353321, 9);
  });

  it('期末部位不計入總匯出', () => {
    const m = computeMetrics(form(100000, [], 145000), 0.45);
    expect(m.totalWithdrawn).toBe(0);
    expect(m.currentPosition).toBe(145000);
  });

  it('期初部位為 0 時只算資金進出', () => {
    const m = computeMetrics(form(0, [10000, 20000], 35000), 0.2);
    expect(m.totalInvested).toBe(30000);
    expect(m.totalReturn).toBe(5000);
  });

  it('金額為 0 的列兩邊都不計', () => {
    const m = computeMetrics(form(1000, [0], 1000), 0);
    expect(m.totalInvested).toBe(1000);
    expect(m.totalWithdrawn).toBe(0);
  });

  it('總報酬可為負', () => {
    const m = computeMetrics(form(100000, [], 60000), -0.4);
    expect(m.totalReturn).toBe(-40000);
  });

  it('性質：總報酬 === 當前總部位 + 總匯出 - 總投入', () => {
    const cases: Array<[number, number[], number]> = [
      [100000, [50000, -30000], 145000],
      [0, [1000, 2000, -500], 3200],
      [5000, [], 0],
      [250, [-100, -100, 400], 480],
      [1_000_000, [-999_999], 1],
    ];
    for (const [initial, rows, final] of cases) {
      const m = computeMetrics(form(initial, rows, final), 0.1);
      expect(m.totalReturn).toBeCloseTo(
        m.currentPosition + m.totalWithdrawn - m.totalInvested,
        9,
      );
    }
  });
});
