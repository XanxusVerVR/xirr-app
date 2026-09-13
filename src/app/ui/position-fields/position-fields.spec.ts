import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { PositionFields } from './position-fields';

const setup = async (kind: 'initial' | 'final') => {
  TestBed.configureTestingModule({ imports: [PositionFields] });
  const fixture = TestBed.createComponent(PositionFields);
  fixture.componentRef.setInput('kind', kind);
  await fixture.whenStable();
  return { fixture, store: TestBed.inject(CalculatorStore), el: fixture.nativeElement as HTMLElement };
};

describe('PositionFields', () => {
  it('期初顯示期初標題', async () => {
    const { el } = await setup('initial');
    expect(el.querySelector('h2')?.textContent).toContain('期初部位');
  });

  it('期末顯示期末標題', async () => {
    const { el } = await setup('final');
    expect(el.querySelector('h2')?.textContent).toContain('期末部位');
  });

  it('輸入日期會寫進 store', async () => {
    const { fixture, store, el } = await setup('initial');
    const input = el.querySelector<HTMLInputElement>('input[type="date"]')!;
    input.value = '2024-01-01';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(store.form().initial.date).toBe('2024-01-01');
  });

  it('輸入金額會寫進 store', async () => {
    const { fixture, store, el } = await setup('final');
    const input = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    input.value = '145000';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(store.form().final.amount).toBe(145000);
  });

  it('打到一半的中間值不會被寫回覆蓋', async () => {
    const { fixture, store, el } = await setup('final');
    store.loadExample();
    await fixture.whenStable();

    const input = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    expect(input.value).toBe('145000');

    // "-0" 是輸入負數時必經的中間值；舊的 [value]="amount ?? ''" 會寫回 "0" 吃掉負號
    input.value = '-0';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(input.value).toBe('-0');
    expect(store.form().final.amountText).toBe('-0');
  });

  it('store 的值會反映回畫面', async () => {
    const { fixture, store, el } = await setup('initial');
    store.loadExample();
    await fixture.whenStable();
    expect(el.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe('2024-01-01');
  });

  it('有錯誤時欄位加上 invalid 樣式', async () => {
    const { fixture, store, el } = await setup('initial');
    store.calculate(); // 空表單必定產生必填錯誤
    await fixture.whenStable();
    expect(el.querySelector('input[type="date"]')!.classList).toContain('invalid');
  });

  describe('無障礙錯誤關聯', () => {
    it('有錯誤時欄位帶 aria-invalid、aria-describedby，指向的元素存在且文字是對應訊息', async () => {
      const { fixture, store, el } = await setup('initial');
      store.calculate(); // 空表單必定產生必填錯誤
      await fixture.whenStable();

      const date = el.querySelector<HTMLInputElement>('input[type="date"]')!;
      const amount = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;

      expect(date.getAttribute('aria-invalid')).toBe('true');
      const dateDescribedBy = date.getAttribute('aria-describedby');
      expect(dateDescribedBy).toBeTruthy();
      const dateError = el.querySelector(`#${dateDescribedBy}`);
      expect(dateError).not.toBeNull();
      expect(dateError!.textContent).toContain('日期');

      expect(amount.getAttribute('aria-invalid')).toBe('true');
      const amountDescribedBy = amount.getAttribute('aria-describedby');
      expect(amountDescribedBy).toBeTruthy();
      const amountError = el.querySelector(`#${amountDescribedBy}`);
      expect(amountError).not.toBeNull();
      expect(amountError!.textContent).toContain('金額');
    });

    it('沒有錯誤時不帶 aria-invalid、不帶 aria-describedby，也沒有錯誤元素', async () => {
      const { fixture, store, el } = await setup('initial');
      store.loadExample(); // 合法表單，計算前不應有任何驗證錯誤
      await fixture.whenStable();

      const date = el.querySelector<HTMLInputElement>('input[type="date"]')!;
      const amount = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;

      expect(date.getAttribute('aria-invalid')).toBeNull();
      expect(date.getAttribute('aria-describedby')).toBeNull();
      expect(amount.getAttribute('aria-invalid')).toBeNull();
      expect(amount.getAttribute('aria-describedby')).toBeNull();
      expect(el.querySelector('.field-error')).toBeNull();
    });

    it('只有金額有問題時，只有金額欄帶 aria-invalid／aria-describedby，日期欄不受影響', async () => {
      const { fixture, store, el } = await setup('initial');
      store.setInitialDate('2024-01-01'); // 日期合法
      store.setFinalDate('2025-01-01');
      store.setFinalAmount('1000');
      store.calculate(); // 期初金額留空 → 只有期初金額有問題
      await fixture.whenStable();

      const date = el.querySelector<HTMLInputElement>('input[type="date"]')!;
      const amount = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;

      expect(amount.getAttribute('aria-invalid')).toBe('true');
      expect(amount.getAttribute('aria-describedby')).toBeTruthy();
      expect(date.getAttribute('aria-invalid')).toBeNull();
      expect(date.getAttribute('aria-describedby')).toBeNull();
    });

    it('期初與期末各自的錯誤只關聯到自己的欄位，id 不互相衝突', async () => {
      const initialSetup = await setup('initial');
      initialSetup.store.calculate();
      await initialSetup.fixture.whenStable();
      const initialDateId = initialSetup.el
        .querySelector<HTMLInputElement>('input[type="date"]')!
        .getAttribute('aria-describedby');

      // 同一支測試內要換一個 kind 重新渲染元件，TestBed 不能在同一個測試裡二次
      // configureTestingModule，必須先手動 reset（跨 it 之間由測試框架自動 reset）
      TestBed.resetTestingModule();
      const finalSetup = await setup('final');
      finalSetup.store.calculate();
      await finalSetup.fixture.whenStable();
      const finalDateId = finalSetup.el
        .querySelector<HTMLInputElement>('input[type="date"]')!
        .getAttribute('aria-describedby');

      expect(initialDateId).toBeTruthy();
      expect(finalDateId).toBeTruthy();
      expect(initialDateId).not.toBe(finalDateId);
    });
  });

  // 無法用行為測試重現「輸入負數被吃掉」這個錯誤：jsdom 沒有瀏覽器原生的
  // 「編輯中緩衝區」，所以 type="number" 在真實瀏覽器中把只含符號的內容
  // 清成 '' 這件事，jsdom 從未忠實模擬過。這裡改為釘住標記本身，確保
  // 欄位是 type="text" + inputmode="decimal"，而不是會觸發該行為的
  // type="number"。真正的修復需在真實瀏覽器手動驗證。
  it('金額欄位是 type="text" 搭配 inputmode="decimal"（避免瀏覽器把只有符號的輸入清空）', async () => {
    const { el } = await setup('initial');
    const input = el.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });
});
