import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { ResultsPanel } from './results-panel';

const setup = async () => {
  TestBed.configureTestingModule({ imports: [ResultsPanel] });
  const fixture = TestBed.createComponent(ResultsPanel);
  await fixture.whenStable();
  return {
    fixture,
    store: TestBed.inject(CalculatorStore),
    el: fixture.nativeElement as HTMLElement,
  };
};

const text = (el: HTMLElement, selector: string): string =>
  el.querySelector(selector)?.textContent?.trim() ?? '';

describe('ResultsPanel', () => {
  it('尚未計算時不渲染', async () => {
    const { el } = await setup();
    expect(el.querySelector('.results')).toBeNull();
  });

  it('渲染五項數字', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    store.calculate();
    await fixture.whenStable();

    expect(text(el, '[data-field="totalInvested"]')).toBe('150,000');
    expect(text(el, '[data-field="totalWithdrawn"]')).toBe('30,000');
    expect(text(el, '[data-field="currentPosition"]')).toBe('145,000');
    expect(text(el, '[data-field="totalReturn"]')).toBe('25,000');
    expect(text(el, '[data-field="xirr"]')).toBe('19.35%');
  });

  it('總報酬為負時加上負值樣式', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    store.setInitialAmount('100000');
    store.setFinalDate('2025-01-01');
    store.setFinalAmount('60000');
    store.removeRow(store.form().rows[0].id);
    store.setRowDate(store.form().rows[0].id, '2024-06-01');
    store.setRowAmount(store.form().rows[0].id, '0');
    store.calculate();
    await fixture.whenStable();

    expect(el.querySelector('[data-field="totalReturn"]')!.classList).toContain('negative');
  });

  it('顯示註記', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    store.setInitialAmount('100000');
    store.setFinalDate('2025-01-01');
    store.setFinalAmount('0');
    store.removeRow(store.form().rows[0].id);
    store.setRowDate(store.form().rows[0].id, '2024-06-01');
    store.setRowAmount(store.form().rows[0].id, '0');
    store.calculate();
    await fixture.whenStable();

    expect(text(el, '[data-field="xirr"]')).toBe('-100.00%');
    expect(el.querySelector('.notes')?.textContent).toContain('本金全數損失');
  });

  it('顯示阻擋型錯誤', async () => {
    const { fixture, store, el } = await setup();
    store.calculate(); // 空表單
    await fixture.whenStable();

    expect(el.querySelectorAll('.errors li').length).toBeGreaterThan(0);
    expect(el.querySelector('.results')).toBeNull();
  });

  it('在不完整表單上重複計算，錯誤清單不會錯亂', async () => {
    const { fixture, store, el } = await setup();
    store.calculate();
    await fixture.whenStable();
    const first = el.querySelectorAll('.errors li').length;

    store.calculate();
    await fixture.whenStable();

    expect(el.querySelectorAll('.errors li').length).toBe(first);
    expect(first).toBeGreaterThan(1);
  });

  it('錯誤消失後改顯示結果', async () => {
    const { fixture, store, el } = await setup();
    store.calculate();
    await fixture.whenStable();
    expect(el.querySelector('.errors')).not.toBeNull();

    store.loadExample();
    store.calculate();
    await fixture.whenStable();
    expect(el.querySelector('.errors')).toBeNull();
    expect(el.querySelector('.results')).not.toBeNull();
  });
});
