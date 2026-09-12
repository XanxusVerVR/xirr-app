import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { ActionBar } from './action-bar';

const setup = async () => {
  TestBed.configureTestingModule({ imports: [ActionBar] });
  const fixture = TestBed.createComponent(ActionBar);
  await fixture.whenStable();
  return {
    fixture,
    store: TestBed.inject(CalculatorStore),
    el: fixture.nativeElement as HTMLElement,
  };
};

const click = async (
  fixture: { whenStable: () => Promise<unknown> },
  el: HTMLElement,
  selector: string,
) => {
  el.querySelector<HTMLButtonElement>(selector)!.click();
  await fixture.whenStable();
};

describe('ActionBar', () => {
  it('計算按鈕觸發計算', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await click(fixture, el, '.calculate');
    expect(store.outcome()?.ok).toBe(true);
  });

  it('表單為空時載入範例不需確認', async () => {
    const { fixture, store, el } = await setup();
    await click(fixture, el, '.load-example');
    expect(store.form().rows).toHaveLength(2);
    expect(el.querySelector('.confirm-bar')).toBeNull();
  });

  it('表單非空時載入範例先顯示確認', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    await fixture.whenStable();

    await click(fixture, el, '.load-example');
    expect(el.querySelector('.confirm-bar')).not.toBeNull();
    expect(store.form().rows).toHaveLength(1); // 尚未執行
  });

  it('確認後才真的載入範例', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    await fixture.whenStable();
    await click(fixture, el, '.load-example');
    await click(fixture, el, '.confirm-yes');

    expect(store.form().rows).toHaveLength(2);
    expect(el.querySelector('.confirm-bar')).toBeNull();
  });

  it('取消確認不改動表單', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    await fixture.whenStable();
    await click(fixture, el, '.clear-all');
    await click(fixture, el, '.confirm-no');

    expect(store.form().initial.date).toBe('2024-01-01');
    expect(el.querySelector('.confirm-bar')).toBeNull();
  });

  it('確認後才真的清除全部', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();
    await click(fixture, el, '.clear-all');
    await click(fixture, el, '.confirm-yes');

    expect(store.form().initial.date).toBe('');
    expect(store.form().rows).toHaveLength(1);
  });

  it('表單為空時清除全部不需確認', async () => {
    const { fixture, el } = await setup();
    await click(fixture, el, '.clear-all');
    expect(el.querySelector('.confirm-bar')).toBeNull();
  });

  it('確認訊息會說明是哪個動作', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();
    await click(fixture, el, '.load-example');
    expect(el.querySelector('.confirm-bar')?.textContent).toContain('載入範例');
  });
});
