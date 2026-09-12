import type { CashFlow } from '../model/types';
import { toEpochDay } from '../date';
import { npv, npvDerivative } from './npv';

const cf = (date: string, amount: number): CashFlow => ({
  epochDay: toEpochDay(date),
  amount,
});

describe('npv', () => {
  it('r = 0 時等於單純加總', () => {
    const cfs = [cf('2024-01-01', -1000), cf('2024-12-31', 1100)];
    expect(npv(cfs, 0)).toBeCloseTo(100, 9);
  });

  it('在真實報酬率處為零：一年 10%', () => {
    const cfs = [cf('2024-01-01', -1000), cf('2024-12-31', 1100)];
    expect(npv(cfs, 0.1)).toBeCloseTo(0, 9);
  });

  it('第一筆現金流不被折現', () => {
    const cfs = [cf('2024-01-01', -500)];
    expect(npv(cfs, 0.5)).toBeCloseTo(-500, 9);
  });

  it('隨 r 遞減（現金流為先付後收時）', () => {
    const cfs = [cf('2024-01-01', -1000), cf('2024-12-31', 1100)];
    expect(npv(cfs, 0.2)).toBeLessThan(npv(cfs, 0.1));
  });
});

describe('npvDerivative', () => {
  it('與數值微分一致', () => {
    const cfs = [
      cf('2024-01-01', -100000),
      cf('2024-03-15', -50000),
      cf('2024-08-20', 30000),
      cf('2025-01-01', 145000),
    ];
    const r = 0.15;
    const h = 1e-6;
    const numeric = (npv(cfs, r + h) - npv(cfs, r - h)) / (2 * h);
    // 導數量級約 -2e5，用絕對誤差比對會受中央差分的抵消誤差影響，改比相對值
    expect(npvDerivative(cfs, r) / numeric).toBeCloseTo(1, 6);
  });

  it('第一筆現金流對導數無貢獻（t = 0）', () => {
    const cfs = [cf('2024-01-01', -500)];
    expect(npvDerivative(cfs, 0.3)).toBeCloseTo(0, 12);
  });
});
