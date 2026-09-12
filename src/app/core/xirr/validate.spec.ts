import type { CalculatorForm, ResolvedForm } from '../model/types';
import { toEpochDay } from '../date';
import { resolveForm, toCashFlows, validateRanges, validateRequired } from './validate';

const baseForm = (): CalculatorForm => ({
  initial: { date: '2024-01-01', amount: 100000 },
  rows: [
    { id: 'a', date: '2024-03-15', amount: 50000 },
    { id: 'b', date: '2024-08-20', amount: -30000 },
  ],
  final: { date: '2025-01-01', amount: 145000 },
});

describe('validateRequired', () => {
  it('完整表單無錯誤', () => {
    expect(validateRequired(baseForm())).toEqual([]);
  });

  it('期初日期空白', () => {
    const f = baseForm();
    f.initial.date = '';
    const issues = validateRequired(f);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('MISSING_DATE');
    expect(issues[0].target).toEqual({ kind: 'initial', field: 'date' });
  });

  it('期末金額空白', () => {
    const f = baseForm();
    f.final.amount = null;
    const issues = validateRequired(f);
    expect(issues[0].code).toBe('MISSING_AMOUNT');
    expect(issues[0].target).toEqual({ kind: 'final', field: 'amount' });
  });

  it('金額為 0 是合法的，不算空白', () => {
    const f = baseForm();
    f.final.amount = 0;
    f.initial.amount = 0;
    expect(validateRequired(f)).toEqual([]);
  });

  it('列的錯誤帶得出 rowId', () => {
    const f = baseForm();
    f.rows[1].date = '';
    const issues = validateRequired(f);
    expect(issues[0].target).toEqual({ kind: 'row', rowId: 'b', field: 'date' });
  });

  it('日期格式非法也算 MISSING_DATE', () => {
    const f = baseForm();
    f.rows[0].date = '2025-02-29';
    expect(validateRequired(f)[0].code).toBe('MISSING_DATE');
  });

  it('回報全部錯誤而非只回第一個', () => {
    const f = baseForm();
    f.initial.date = '';
    f.final.amount = null;
    f.rows[0].amount = null;
    expect(validateRequired(f)).toHaveLength(3);
  });
});

describe('resolveForm', () => {
  it('把 amount 收斂成 number', () => {
    const r = resolveForm(baseForm());
    expect(r.initial.amount).toBe(100000);
    expect(r.rows.map((x) => x.amount)).toEqual([50000, -30000]);
    expect(r.final.amount).toBe(145000);
  });
});

describe('validateRanges', () => {
  const resolved = (): ResolvedForm => resolveForm(baseForm());

  it('合法區間無錯誤', () => {
    expect(validateRanges(resolved())).toEqual([]);
  });

  it('期初晚於期末', () => {
    const f = resolved();
    f.initial.date = '2025-06-01';
    const issues = validateRanges(f);
    expect(issues[0].code).toBe('DATE_ORDER');
    expect(issues[0].target).toEqual({ kind: 'initial', field: 'date' });
  });

  it('期初等於期末也擋', () => {
    const f = resolved();
    f.final.date = f.initial.date;
    expect(validateRanges(f)[0].code).toBe('DATE_ORDER');
  });

  it('進出日期早於期初', () => {
    const f = resolved();
    f.rows[0].date = '2023-12-31';
    const issues = validateRanges(f);
    expect(issues[0].code).toBe('DATE_OUT_OF_RANGE');
    expect(issues[0].target).toEqual({ kind: 'row', rowId: 'a', field: 'date' });
  });

  it('進出日期晚於期末', () => {
    const f = resolved();
    f.rows[1].date = '2025-02-01';
    expect(validateRanges(f)[0].code).toBe('DATE_OUT_OF_RANGE');
  });

  it('進出日期等於邊界是合法的', () => {
    const f = resolved();
    f.rows[0].date = '2024-01-01';
    f.rows[1].date = '2025-01-01';
    expect(validateRanges(f)).toEqual([]);
  });
});

describe('toCashFlows', () => {
  it('翻成 XIRR 符號慣例', () => {
    const cfs = toCashFlows(resolveForm(baseForm()));
    expect(cfs.map((c) => c.amount)).toEqual([-100000, -50000, 30000, 145000]);
  });

  it('日期轉成 epochDay 且順序保持輸入順序', () => {
    const cfs = toCashFlows(resolveForm(baseForm()));
    expect(cfs.map((c) => c.epochDay)).toEqual([
      toEpochDay('2024-01-01'),
      toEpochDay('2024-03-15'),
      toEpochDay('2024-08-20'),
      toEpochDay('2025-01-01'),
    ]);
  });
});
