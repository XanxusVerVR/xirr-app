import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from './calculator-store';

const make = (): CalculatorStore => {
  TestBed.configureTestingModule({});
  return TestBed.inject(CalculatorStore);
};

const fill = (store: CalculatorStore): void => {
  store.setInitialDate('2024-01-01');
  store.setInitialAmount('100000');
  store.setFinalDate('2025-01-01');
  store.setFinalAmount('145000');
  const [first] = store.form().rows;
  store.setRowDate(first.id, '2024-03-15');
  store.setRowAmount(first.id, '50000');
};

describe('CalculatorStore — 初始狀態', () => {
  it('保留一列空白資金進出', () => {
    const store = make();
    expect(store.form().rows).toHaveLength(1);
    expect(store.form().rows[0].date).toBe('');
    expect(store.form().rows[0].amount).toBeNull();
  });

  it('尚未計算時沒有結果', () => {
    expect(make().outcome()).toBeNull();
  });

  it('空表單的 isEmpty 為 true', () => {
    expect(make().isEmpty()).toBe(true);
  });
});

describe('CalculatorStore — 列操作', () => {
  it('addRow 追加空白列', () => {
    const store = make();
    store.addRow();
    expect(store.form().rows).toHaveLength(2);
  });

  it('removeRow 移除指定列', () => {
    const store = make();
    store.addRow();
    const [first] = store.form().rows;
    store.removeRow(first.id);
    expect(store.form().rows.map((r) => r.id)).not.toContain(first.id);
  });

  it('移除最後一列後仍保留一列空白', () => {
    const store = make();
    store.removeRow(store.form().rows[0].id);
    expect(store.form().rows).toHaveLength(1);
  });

  it('duplicateRow 複製日期與金額，插在原列正下方', () => {
    const store = make();
    store.addRow();
    const [a, b] = store.form().rows;
    store.setRowDate(a.id, '2024-05-01');
    store.setRowAmount(a.id, '1234');
    store.duplicateRow(a.id);

    const rows = store.form().rows;
    expect(rows).toHaveLength(3);
    expect(rows[1].date).toBe('2024-05-01');
    expect(rows[1].amount).toBe(1234);
    expect(rows[2].id).toBe(b.id);
  });

  it('duplicateRow 產生新的 id', () => {
    const store = make();
    const [a] = store.form().rows;
    store.duplicateRow(a.id);
    const rows = store.form().rows;
    expect(rows[1].id).not.toBe(rows[0].id);
  });

  it('moveRow 依索引搬移', () => {
    const store = make();
    store.addRow();
    store.addRow();
    const ids = store.form().rows.map((r) => r.id);
    store.moveRow(0, 2);
    expect(store.form().rows.map((r) => r.id)).toEqual([ids[1], ids[2], ids[0]]);
  });
});

describe('CalculatorStore — 金額解析', () => {
  it('空字串視為未填', () => {
    const store = make();
    store.setInitialAmount('');
    expect(store.form().initial.amount).toBeNull();
  });

  it('0 是合法金額，不是未填', () => {
    const store = make();
    store.setInitialAmount('0');
    expect(store.form().initial.amount).toBe(0);
  });

  it('無法解析的內容視為未填', () => {
    const store = make();
    store.setInitialAmount('abc');
    expect(store.form().initial.amount).toBeNull();
  });

  it('接受負數與小數', () => {
    const store = make();
    store.setFinalAmount('-12.5');
    expect(store.form().final.amount).toBeCloseTo(-12.5, 9);
  });

  it('在已有數值的欄位上覆寫負數，負號不會被吃掉', () => {
    const store = make();
    store.loadExample();
    const rowId = store.form().rows[0].id;
    expect(store.form().rows[0].amount).toBe(50000);

    // 使用者全選後輸入 "-25000"：type=number 在只有負號時 .value 回傳 ''
    store.setRowAmount(rowId, '');
    store.setRowAmount(rowId, '-2');
    store.setRowAmount(rowId, '-25000');

    expect(store.form().rows[0].amount).toBe(-25000);
    expect(store.form().rows[0].amountText).toBe('-25000');
  });

  it('amountText 保留使用者打的原始文字，amount 仍是解析後的值', () => {
    const store = make();
    store.setInitialAmount('abc');
    expect(store.form().initial.amountText).toBe('abc');
    expect(store.form().initial.amount).toBeNull();
  });

  it('程式設定的表單，amountText 與 amount 一致', () => {
    const store = make();
    store.loadExample();
    expect(store.form().initial.amountText).toBe('100000');
    expect(store.form().rows[1].amountText).toBe('-30000');
    expect(store.form().final.amountText).toBe('145000');

    store.clearAll();
    expect(store.form().initial.amountText).toBe('');
    expect(store.form().rows[0].amountText).toBe('');
  });
});

describe('CalculatorStore — YAML dirty 狀態', () => {
  it('初始為乾淨，yamlText 跟隨表單', () => {
    const store = make();
    expect(store.yamlDirty()).toBe(false);
    store.setInitialDate('2024-01-01');
    expect(store.yamlText()).toContain('date: 2024-01-01');
  });

  it('editYaml 後轉髒，且停止跟隨表單', () => {
    const store = make();
    store.editYaml('initial:\n  date: 2099-01-01\n');
    expect(store.yamlDirty()).toBe(true);

    store.setInitialDate('2024-01-01');
    expect(store.yamlText()).toContain('2099-01-01');
    expect(store.yamlText()).not.toContain('2024-01-01');
  });

  it('applyYaml 成功後灌回表單並轉乾淨', () => {
    const store = make();
    store.editYaml(`
initial:
  date: 2024-01-01
  amount: 100000
flows:
  - date: 2024-03-15
    amount: 50000
final:
  date: 2025-01-01
  amount: 145000
`);
    store.applyYaml();

    expect(store.yamlDirty()).toBe(false);
    expect(store.yamlError()).toBeNull();
    expect(store.form().initial.amount).toBe(100000);
    expect(store.form().rows).toHaveLength(1);
  });

  it('applyYaml 套用空的 flows 時仍保留一列空白，讓使用者有地方輸入', () => {
    const store = make();
    store.editYaml(`
initial:
  date: 2024-01-01
  amount: 100000
flows: []
final:
  date: 2025-01-01
  amount: 145000
`);
    store.applyYaml();

    expect(store.form().rows).toHaveLength(1);
    expect(store.form().rows[0].date).toBe('');
    expect(store.form().rows[0].amount).toBeNull();
    expect(store.form().rows[0].amountText).toBe('');
  });

  it('applyYaml 灌回的金額，amountText 與 amount 一致', () => {
    const store = make();
    store.editYaml(`
initial:
  date: 2024-01-01
  amount: 100000
flows:
  - date: 2024-03-15
    amount: -30000
final:
  date: 2025-01-01
  amount: 145000
`);
    store.applyYaml();

    expect(store.form().initial.amountText).toBe('100000');
    expect(store.form().rows[0].amountText).toBe('-30000');
  });

  it('applyYaml 失敗時保留草稿、維持髒、顯示錯誤', () => {
    const store = make();
    store.editYaml('initial:\n  date: 2024-01-01\n   amount: 5\n');
    store.applyYaml();

    expect(store.yamlDirty()).toBe(true);
    expect(store.yamlError()).not.toBeNull();
    expect(store.yamlError()).toContain('第 3 行');
    expect(store.yamlText()).toContain('amount: 5');
  });

  it('discardYaml 丟掉草稿並轉乾淨', () => {
    const store = make();
    store.setInitialDate('2024-01-01');
    store.editYaml('壞掉的內容');
    store.applyYaml();
    store.discardYaml();

    expect(store.yamlDirty()).toBe(false);
    expect(store.yamlError()).toBeNull();
    expect(store.yamlText()).toContain('date: 2024-01-01');
  });

  it('loadExample 與 clearAll 無條件轉乾淨', () => {
    const store = make();
    store.editYaml('隨便打的東西');
    store.loadExample();
    expect(store.yamlDirty()).toBe(false);

    store.editYaml('又打了東西');
    store.clearAll();
    expect(store.yamlDirty()).toBe(false);
  });
});

describe('CalculatorStore — 載入範例與清除', () => {
  it('loadExample 填入範例資料', () => {
    const store = make();
    store.loadExample();
    expect(store.form().initial).toEqual({
      date: '2024-01-01',
      amount: 100000,
      amountText: '100000',
    });
    expect(store.form().rows).toHaveLength(2);
    expect(store.isEmpty()).toBe(false);
  });

  it('clearAll 清空並保留一列空白', () => {
    const store = make();
    store.loadExample();
    store.calculate();
    store.clearAll();

    expect(store.form().initial).toEqual({ date: '', amount: null, amountText: '' });
    expect(store.form().rows).toHaveLength(1);
    expect(store.outcome()).toBeNull();
    expect(store.isEmpty()).toBe(true);
  });
});

describe('CalculatorStore — 計算', () => {
  it('成功時產生結果', () => {
    const store = make();
    store.loadExample();
    store.calculate();

    const outcome = store.outcome();
    expect(outcome?.ok).toBe(true);
    if (outcome?.ok) expect(outcome.metrics.xirr * 100).toBeCloseTo(19.353321, 5);
  });

  it('日期順序不對時把排序結果寫回表單', () => {
    const store = make();
    fill(store); // rows[0] = 2024-03-15
    store.addRow();
    const rows = store.form().rows;
    store.setRowDate(rows[1].id, '2024-02-01'); // 比第一列早，順序是錯的
    store.setRowAmount(rows[1].id, '1000');

    expect(store.form().rows.map((r) => r.date)).toEqual(['2024-03-15', '2024-02-01']);
    store.calculate();
    expect(store.form().rows.map((r) => r.date)).toEqual(['2024-02-01', '2024-03-15']);
  });

  it('必填檢查失敗時不動表單順序', () => {
    const store = make();
    fill(store);
    store.addRow();
    const rows = store.form().rows;
    store.setRowDate(rows[1].id, '2024-02-01'); // 金額留空
    const before = store.form().rows.map((r) => r.id);

    store.calculate();
    expect(store.form().rows.map((r) => r.id)).toEqual(before);
    expect(store.outcome()?.ok).toBe(false);
  });

  it('issuesByRow 依 rowId 索引錯誤', () => {
    const store = make();
    fill(store);
    const rowId = store.form().rows[0].id;
    store.setRowAmount(rowId, '');

    store.calculate();
    expect(store.issuesByRow().get(rowId)?.[0].code).toBe('MISSING_AMOUNT');
  });

  it('重新計算會覆蓋前次結果', () => {
    const store = make();
    store.loadExample();
    store.calculate();
    expect(store.outcome()?.ok).toBe(true);

    store.setFinalDate('2023-01-01');
    store.calculate();
    expect(store.outcome()?.ok).toBe(false);
  });

  it('只填期初期末、資金進出列維持空白時仍能算出結果', () => {
    const store = make();
    store.setInitialDate('2024-01-01');
    store.setInitialAmount('100000');
    store.setFinalDate('2025-01-01');
    store.setFinalAmount('120000');
    // 資金進出列刻意不填，保持 emptyForm() 給的那一列空白

    store.calculate();

    const outcome = store.outcome();
    expect(outcome?.ok).toBe(true);
    if (outcome?.ok) expect(outcome.metrics.xirr * 100).toBeCloseTo(19.940237, 5);
  });
});
