import * as yaml from 'js-yaml';
import type { CalculatorForm } from '../model/types';
import { serializeForm } from './serialize';

const baseForm = (): CalculatorForm => ({
  initial: { date: '2024-01-01', amount: 100000 },
  rows: [
    { id: 'a', date: '2024-03-15', amount: 50000 },
    { id: 'b', date: '2024-08-20', amount: -30000 },
  ],
  final: { date: '2025-01-01', amount: 145000 },
});

describe('serializeForm', () => {
  it('產生預期的完整輸出', () => {
    expect(serializeForm(baseForm())).toBe(
      [
        'initial:',
        '  date: 2024-01-01',
        '  amount: 100000',
        '',
        '# 正數 = 資金投入，負數 = 資金匯出',
        'flows:',
        '  - date: 2024-03-15',
        '    amount: 50000',
        '  - date: 2024-08-20',
        '    amount: -30000',
        '',
        'final:',
        '  date: 2025-01-01',
        '  amount: 145000',
        '',
      ].join('\n'),
    );
  });

  it('日期不加引號', () => {
    expect(serializeForm(baseForm())).toContain('date: 2024-01-01');
    expect(serializeForm(baseForm())).not.toContain("'2024-01-01'");
  });

  it('保留正負號說明註解', () => {
    expect(serializeForm(baseForm())).toContain('# 正數 = 資金投入，負數 = 資金匯出');
  });

  it('沒有資金進出時輸出空陣列', () => {
    const f = baseForm();
    f.rows = [];
    expect(serializeForm(f)).toContain('flows: []');
  });

  it('空日期輸出為引號包住的空字串', () => {
    const f = baseForm();
    f.initial.date = '';
    expect(serializeForm(f)).toContain("date: ''");
  });

  it('未填金額輸出為 YAML null', () => {
    const f = baseForm();
    f.final.amount = null;
    expect(serializeForm(f)).toContain('  amount:\n');
  });

  it('輸出必為合法 YAML，且日期維持字串', () => {
    const parsed = yaml.load(serializeForm(baseForm()), { schema: yaml.CORE_SCHEMA }) as {
      initial: { date: unknown };
      flows: unknown[];
    };
    expect(typeof parsed.initial.date).toBe('string');
    expect(parsed.flows).toHaveLength(2);
  });

  it('半填表單的輸出也是合法 YAML', () => {
    const f = baseForm();
    f.initial.date = '';
    f.initial.amount = null;
    f.rows[0].amount = null;
    const parsed = yaml.load(serializeForm(f), { schema: yaml.CORE_SCHEMA }) as {
      initial: { date: string; amount: unknown };
    };
    expect(parsed.initial.date).toBe('');
    expect(parsed.initial.amount).toBeNull();
  });
});
