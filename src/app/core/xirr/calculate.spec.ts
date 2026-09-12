import type { CalculatorForm, NoteCode } from '../model/types';
import { runCalculation } from './calculate';

const form = (over: Partial<CalculatorForm> = {}): CalculatorForm => ({
  initial: { date: '2024-01-01', amount: 100000 },
  rows: [
    { id: 'a', date: '2024-03-15', amount: 50000 },
    { id: 'b', date: '2024-08-20', amount: -30000 },
  ],
  final: { date: '2025-01-01', amount: 145000 },
  ...over,
});

const noteCodes = (run: ReturnType<typeof runCalculation>): NoteCode[] =>
  run.outcome.ok ? run.outcome.notes.map((n) => n.code) : [];

describe('runCalculation — 正常路徑', () => {
  it('回傳五項數字與正確的 XIRR', () => {
    const run = runCalculation(form());
    expect(run.outcome.ok).toBe(true);
    if (!run.outcome.ok) return;
    expect(run.outcome.metrics.xirr * 100).toBeCloseTo(19.353321, 5);
    expect(run.outcome.metrics.totalInvested).toBe(150000);
    expect(run.outcome.metrics.totalWithdrawn).toBe(30000);
    expect(run.outcome.metrics.currentPosition).toBe(145000);
    expect(run.outcome.metrics.totalReturn).toBe(25000);
  });

  it('順序已正確時不附 SORTED 註記', () => {
    expect(noteCodes(runCalculation(form()))).not.toContain('SORTED');
    expect(runCalculation(form()).sorted).toBe(false);
  });
});

describe('runCalculation — 排序', () => {
  it('日期倒置時排序並附 SORTED 註記', () => {
    const run = runCalculation(
      form({
        rows: [
          { id: 'b', date: '2024-08-20', amount: -30000 },
          { id: 'a', date: '2024-03-15', amount: 50000 },
        ],
      }),
    );
    expect(run.sorted).toBe(true);
    expect(run.sortedRows?.map((r) => r.id)).toEqual(['a', 'b']);
    expect(noteCodes(run)).toContain('SORTED');
    if (run.outcome.ok) expect(run.outcome.metrics.xirr * 100).toBeCloseTo(19.353321, 5);
  });

  it('同日期維持原順序（穩定排序）', () => {
    const run = runCalculation(
      form({
        rows: [
          { id: 'x', date: '2024-05-01', amount: 100 },
          { id: 'y', date: '2024-05-01', amount: 200 },
        ],
      }),
    );
    expect(run.sortedRows?.map((r) => r.id)).toEqual(['x', 'y']);
    expect(run.sorted).toBe(false);
  });

  it('必填檢查失敗時不排序', () => {
    const run = runCalculation(
      form({
        rows: [
          { id: 'b', date: '2024-08-20', amount: -30000 },
          { id: 'a', date: '', amount: 50000 },
        ],
      }),
    );
    expect(run.sortedRows).toBeNull();
    expect(run.sorted).toBe(false);
    expect(run.outcome.ok).toBe(false);
  });
});

describe('runCalculation — 阻擋型錯誤', () => {
  it('期初晚於期末', () => {
    const run = runCalculation(form({ final: { date: '2023-01-01', amount: 145000 } }));
    expect(run.outcome.ok).toBe(false);
    if (run.outcome.ok) return;
    expect(run.outcome.errors[0].code).toBe('DATE_ORDER');
  });

  it('[G] 只有匯出、沒有投入 → NO_INVESTMENT', () => {
    const run = runCalculation(
      form({
        initial: { date: '2024-01-01', amount: 0 },
        rows: [{ id: 'a', date: '2024-06-01', amount: -5000 }],
        final: { date: '2025-01-01', amount: 0 },
      }),
    );
    expect(run.outcome.ok).toBe(false);
    if (run.outcome.ok) return;
    expect(run.outcome.errors[0].code).toBe('NO_INVESTMENT');
  });

  it('全部金額為 0 → NO_INVESTMENT', () => {
    const run = runCalculation(
      form({
        initial: { date: '2024-01-01', amount: 0 },
        rows: [],
        final: { date: '2025-01-01', amount: 0 },
      }),
    );
    expect(run.outcome.ok).toBe(false);
    if (run.outcome.ok) return;
    expect(run.outcome.errors[0].code).toBe('NO_INVESTMENT');
  });
});

describe('runCalculation — 註記', () => {
  it('[D] 本金全損 → -100% 且附 TOTAL_LOSS，不是錯誤', () => {
    const run = runCalculation(
      form({ rows: [], final: { date: '2025-01-01', amount: 0 } }),
    );
    expect(run.outcome.ok).toBe(true);
    if (!run.outcome.ok) return;
    expect(run.outcome.metrics.xirr).toBe(-1);
    expect(noteCodes(run)).toContain('TOTAL_LOSS');
    expect(run.outcome.metrics.totalReturn).toBe(-100000);
  });

  it('[C] 符號變換 3 次 → MULTIPLE_ROOTS', () => {
    const run = runCalculation(
      form({
        rows: [
          { id: 'a', date: '2024-04-01', amount: -120000 },
          { id: 'b', date: '2024-07-01', amount: 80000 },
        ],
        final: { date: '2025-01-01', amount: 75000 },
      }),
    );
    expect(noteCodes(run)).toContain('MULTIPLE_ROOTS');
  });

  it('先付後收不附 MULTIPLE_ROOTS', () => {
    const run = runCalculation(form({ rows: [] }));
    expect(noteCodes(run)).not.toContain('MULTIPLE_ROOTS');
  });

  it('[E] 一天翻倍 → EXTREME_RATE，且不是錯誤', () => {
    const run = runCalculation(
      form({
        initial: { date: '2024-01-01', amount: 100 },
        rows: [],
        final: { date: '2024-01-02', amount: 200 },
      }),
    );
    expect(run.outcome.ok).toBe(true);
    expect(noteCodes(run)).toContain('EXTREME_RATE');
  });

  it('[F] 一天 +1% → 3678% 仍附 EXTREME_RATE（超過 1000% 門檻）', () => {
    const run = runCalculation(
      form({
        initial: { date: '2024-01-01', amount: 100 },
        rows: [],
        final: { date: '2024-01-02', amount: 101 },
      }),
    );
    expect(noteCodes(run)).toContain('EXTREME_RATE');
    if (run.outcome.ok) expect(run.outcome.metrics.xirr * 100).toBeCloseTo(3678.343, 2);
  });

  it('一般報酬率不附 EXTREME_RATE', () => {
    expect(noteCodes(runCalculation(form()))).not.toContain('EXTREME_RATE');
  });
});
