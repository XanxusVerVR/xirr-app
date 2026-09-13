import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { CashFlowTable } from './cash-flow-table';

const setup = async () => {
  TestBed.configureTestingModule({ imports: [CashFlowTable] });
  const fixture = TestBed.createComponent(CashFlowTable);
  await fixture.whenStable();
  return {
    fixture,
    store: TestBed.inject(CalculatorStore),
    el: fixture.nativeElement as HTMLElement,
  };
};

describe('CashFlowTable', () => {
  it('初始渲染一列', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('.flow-row')).toHaveLength(1);
  });

  it('每列都有拖曳把手，且把手不是輸入框', async () => {
    const { el } = await setup();
    const handle = el.querySelector('.drag-handle')!;
    expect(handle).not.toBeNull();
    expect(handle.tagName).toBe('BUTTON');
  });

  it('把手與日期輸入框是不同元素', async () => {
    const { el } = await setup();
    const handle = el.querySelector('.drag-handle')!;
    expect(handle.querySelector('input')).toBeNull();
  });

  it('新增按鈕會增加一列', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLButtonElement>('.add-row')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('.flow-row')).toHaveLength(2);
  });

  it('複製按鈕會複製該列的日期與金額到下一列', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();

    el.querySelectorAll<HTMLButtonElement>('.duplicate-row')[0].click();
    await fixture.whenStable();

    const rows = store.form().rows;
    expect(rows).toHaveLength(3);
    expect(rows[1].date).toBe('2024-03-15');
    expect(rows[1].amount).toBe(50000);
  });

  it('複製後焦點移到新列的日期欄', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();

    el.querySelectorAll<HTMLButtonElement>('.duplicate-row')[0].click();
    await fixture.whenStable();

    const createdId = store.form().rows[1].id;
    expect(document.activeElement).toBe(
      el.querySelector(`input[data-row-id="${createdId}"]`),
    );
  });

  it('刪除按鈕會移除該列', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();

    el.querySelectorAll<HTMLButtonElement>('.remove-row')[0].click();
    await fixture.whenStable();

    expect(store.form().rows).toHaveLength(1);
    expect(store.form().rows[0].date).toBe('2024-08-20');
  });

  it('輸入日期與金額會寫進 store', async () => {
    const { fixture, store, el } = await setup();
    const date = el.querySelector<HTMLInputElement>('input[type="date"]')!;
    date.value = '2024-06-01';
    date.dispatchEvent(new Event('input'));

    const amount = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    amount.value = '-2500';
    amount.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(store.form().rows[0].date).toBe('2024-06-01');
    expect(store.form().rows[0].amount).toBe(-2500);
  });

  it('打到一半的中間值不會被寫回覆蓋（負號不會被吃掉）', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();

    const amount = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    expect(amount.value).toBe('50000');

    // 使用者全選後開始輸入負數。真實瀏覽器只打出 "-" 時 .value 會是 ''，
    // jsdom 也會把 '-' 清成 ''，故以 "-0"（同樣是尚未打完的中間值）重現同一條寫回路徑：
    // 舊的 [value]="amount ?? ''" 會把解析結果 -0 寫回成 "0"，負號當場消失。
    amount.value = '-0';
    amount.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(amount.value).toBe('-0');

    amount.value = '-025000';
    amount.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(amount.value).toBe('-025000');
    expect(store.form().rows[0].amount).toBe(-25000);
  });

  it('無法解析的中間內容不會被寫回，store 的 amount 維持未填', async () => {
    const { fixture, store, el } = await setup();
    const amount = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;

    store.setRowAmount(store.form().rows[0].id, '-');
    await fixture.whenStable();

    expect(store.form().rows[0].amountText).toBe('-');
    expect(store.form().rows[0].amount).toBeNull();
  });

  it('有錯誤的列會被標示', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    store.setInitialAmount('1000');
    store.setFinalDate('2025-01-01');
    store.setFinalAmount('1100');
    store.setRowDate(store.form().rows[0].id, '2024-06-01'); // 金額留空
    store.calculate();
    await fixture.whenStable();

    expect(el.querySelector('.flow-row')!.classList).toContain('has-error');
  });

  // 無法用行為測試重現「輸入負數被吃掉」這個錯誤：jsdom 沒有瀏覽器原生的
  // 「編輯中緩衝區」，所以 type="number" 在真實瀏覽器中把只含符號的內容
  // 清成 '' 這件事，jsdom 從未忠實模擬過。這裡改為釘住標記本身，確保
  // 欄位是 type="text" + inputmode="decimal"，而不是會觸發該行為的
  // type="number"。真正的修復需在真實瀏覽器手動驗證。
  it('金額欄位是 type="text" 搭配 inputmode="decimal"（避免瀏覽器把只有符號的輸入清空）', async () => {
    const { el } = await setup();
    const amount = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    expect(amount.getAttribute('type')).toBe('text');
    expect(amount.getAttribute('inputmode')).toBe('decimal');
  });

  describe('無障礙標籤（回歸 P2 finding 4）', () => {
    it('第一列的日期與金額欄位都帶有包含列號與欄位用途的 aria-label', async () => {
      const { el } = await setup();
      const row = el.querySelector<HTMLElement>('.flow-row')!;
      const date = row.querySelector<HTMLInputElement>('input[type="date"]')!;
      const amount = row.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;

      expect(date.getAttribute('aria-label')).toContain('第 1 筆');
      expect(date.getAttribute('aria-label')).toContain('日期');
      expect(amount.getAttribute('aria-label')).toContain('第 1 筆');
      expect(amount.getAttribute('aria-label')).toContain('金額');
    });

    it('新增一列後，第二列的標籤編號正確為「第 2 筆」', async () => {
      const { fixture, el } = await setup();
      el.querySelector<HTMLButtonElement>('.add-row')!.click();
      await fixture.whenStable();

      const rows = el.querySelectorAll<HTMLElement>('.flow-row');
      const secondDate = rows[1].querySelector<HTMLInputElement>('input[type="date"]')!;
      expect(secondDate.getAttribute('aria-label')).toContain('第 2 筆');
    });

    it('複製一列後，新列的標籤編號正確反映其實際位置', async () => {
      const { fixture, store, el } = await setup();
      store.loadExample();
      await fixture.whenStable();

      el.querySelectorAll<HTMLButtonElement>('.duplicate-row')[0].click();
      await fixture.whenStable();

      const rows = el.querySelectorAll<HTMLElement>('.flow-row');
      const duplicatedDate = rows[1].querySelector<HTMLInputElement>('input[type="date"]')!;
      const duplicatedAmount = rows[1].querySelector<HTMLInputElement>(
        'input[inputmode="decimal"]',
      )!;
      expect(duplicatedDate.getAttribute('aria-label')).toContain('第 2 筆');
      expect(duplicatedAmount.getAttribute('aria-label')).toContain('第 2 筆');
    });

    it('有問題的欄位帶 aria-invalid="true"，同一列沒問題的欄位不帶', async () => {
      const { fixture, store, el } = await setup();
      store.setInitialDate('2024-01-01');
      store.setInitialAmount('1000');
      store.setFinalDate('2025-01-01');
      store.setFinalAmount('1100');
      store.setRowDate(store.form().rows[0].id, '2024-06-01'); // 金額留空 → 只有金額欄有問題
      store.calculate();
      await fixture.whenStable();

      const row = el.querySelector<HTMLElement>('.flow-row')!;
      const date = row.querySelector<HTMLInputElement>('input[type="date"]')!;
      const amount = row.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;

      expect(amount.getAttribute('aria-invalid')).toBe('true');
      expect(date.getAttribute('aria-invalid')).not.toBe('true');
    });
  });
});
