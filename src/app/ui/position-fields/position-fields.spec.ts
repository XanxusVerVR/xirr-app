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
    const input = el.querySelector<HTMLInputElement>('input[type="number"]')!;
    input.value = '145000';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(store.form().final.amount).toBe(145000);
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
});
