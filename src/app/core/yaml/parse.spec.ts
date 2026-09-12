import type { CalculatorForm } from '../model/types';
import { serializeForm } from './serialize';
import { parseForm } from './parse';

const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const okForm = (text: string): CalculatorForm => {
  const r = parseForm(text, ids());
  if (!r.ok) throw new Error(`expected ok, got: ${r.message}`);
  return r.form;
};

const VALID = `
initial:
  date: 2024-01-01
  amount: 100000

flows:
  - date: 2024-03-15
    amount: 50000
  - date: 2024-08-20
    amount: -30000

final:
  date: 2025-01-01
  amount: 145000
`;

describe('parseForm — 成功', () => {
  it('解析完整文件', () => {
    const form = okForm(VALID);
    expect(form.initial).toEqual({ date: '2024-01-01', amount: 100000 });
    expect(form.final).toEqual({ date: '2025-01-01', amount: 145000 });
    expect(form.rows).toEqual([
      { id: 'id-1', date: '2024-03-15', amount: 50000 },
      { id: 'id-2', date: '2024-08-20', amount: -30000 },
    ]);
  });

  it('日期維持字串，不被轉成 Date', () => {
    expect(typeof okForm(VALID).initial.date).toBe('string');
  });

  it('接受空的 flows', () => {
    const form = okForm(`
initial:
  date: 2024-01-01
  amount: 100
flows: []
final:
  date: 2025-01-01
  amount: 200
`);
    expect(form.rows).toEqual([]);
  });

  it('flows 缺席視同空陣列', () => {
    const form = okForm(`
initial:
  date: 2024-01-01
  amount: 100
final:
  date: 2025-01-01
  amount: 200
`);
    expect(form.rows).toEqual([]);
  });

  it('接受 null 金額與空日期（半填狀態）', () => {
    const form = okForm(`
initial:
  date: ''
  amount:
flows: []
final:
  date: 2025-01-01
  amount: 200
`);
    expect(form.initial).toEqual({ date: '', amount: null });
  });

  it('接受負數與小數', () => {
    const form = okForm(`
initial:
  date: 2024-01-01
  amount: 1234.56
flows:
  - date: 2024-06-01
    amount: -78.9
final:
  date: 2025-01-01
  amount: 2000
`);
    expect(form.initial.amount).toBeCloseTo(1234.56, 9);
    expect(form.rows[0].amount).toBeCloseTo(-78.9, 9);
  });
});

describe('parseForm — 失敗', () => {
  const fail = (text: string) => {
    const r = parseForm(text, ids());
    if (r.ok) throw new Error('expected failure');
    return r;
  };

  it('語法錯誤回報行號', () => {
    const r = fail('initial:\n  date: 2024-01-01\n   amount: 5\n');
    expect(r.line).toBe(3);
    expect(r.message).toContain('第 3 行');
  });

  it('空白文件', () => {
    expect(fail('   ').message).toContain('內容是空的');
  });

  it('最上層不是物件', () => {
    expect(fail('- 1\n- 2\n').message).toContain('最外層');
  });

  it('缺少 initial', () => {
    expect(fail('final:\n  date: 2025-01-01\n  amount: 1\n').message).toContain('initial');
  });

  it('缺少 final', () => {
    expect(fail('initial:\n  date: 2024-01-01\n  amount: 1\n').message).toContain('final');
  });

  it('flows 不是陣列', () => {
    const r = fail(`
initial:
  date: 2024-01-01
  amount: 1
flows: 5
final:
  date: 2025-01-01
  amount: 1
`);
    expect(r.message).toContain('flows');
  });

  it('金額不是數字', () => {
    const r = fail(`
initial:
  date: 2024-01-01
  amount: abc
flows: []
final:
  date: 2025-01-01
  amount: 1
`);
    expect(r.message).toContain('amount');
  });

  it('日期不是字串', () => {
    const r = fail(`
initial:
  date: 20240101
  amount: 1
flows: []
final:
  date: 2025-01-01
  amount: 1
`);
    expect(r.message).toContain('date');
  });

  it('flows 的元素不是物件', () => {
    const r = fail(`
initial:
  date: 2024-01-01
  amount: 1
flows:
  - 5
final:
  date: 2025-01-01
  amount: 1
`);
    expect(r.message).toContain('flows');
  });

  it('拒絕危險標籤', () => {
    expect(fail('a: !!js/function "function(){}"').ok).toBe(false);
  });
});

describe('parseForm — 往返性質', () => {
  it('parse(serialize(form)) 還原出相同的日期與金額', () => {
    const original: CalculatorForm = {
      initial: { date: '2024-01-01', amount: 100000 },
      rows: [
        { id: 'a', date: '2024-03-15', amount: 50000 },
        { id: 'b', date: '2024-08-20', amount: -30000 },
      ],
      final: { date: '2025-01-01', amount: 145000 },
    };
    const round = okForm(serializeForm(original));
    expect(round.initial).toEqual(original.initial);
    expect(round.final).toEqual(original.final);
    expect(round.rows.map(({ date, amount }) => ({ date, amount }))).toEqual(
      original.rows.map(({ date, amount }) => ({ date, amount })),
    );
  });

  it('半填表單同樣可往返', () => {
    const original: CalculatorForm = {
      initial: { date: '', amount: null },
      rows: [{ id: 'a', date: '2024-03-15', amount: null }],
      final: { date: '2025-01-01', amount: 0 },
    };
    const round = okForm(serializeForm(original));
    expect(round.initial).toEqual({ date: '', amount: null });
    expect(round.rows[0].amount).toBeNull();
    expect(round.final.amount).toBe(0);
  });
});
