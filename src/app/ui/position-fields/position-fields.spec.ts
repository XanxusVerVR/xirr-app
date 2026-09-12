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
