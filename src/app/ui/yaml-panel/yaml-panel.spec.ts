import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { YamlPanel } from './yaml-panel';

const setup = async () => {
  TestBed.configureTestingModule({ imports: [YamlPanel] });
  const fixture = TestBed.createComponent(YamlPanel);
  await fixture.whenStable();
  return {
    fixture,
    store: TestBed.inject(CalculatorStore),
    el: fixture.nativeElement as HTMLElement,
  };
};

const type = async (
  fixture: { whenStable: () => Promise<unknown> },
  el: HTMLElement,
  text: string,
) => {
  const area = el.querySelector<HTMLTextAreaElement>('textarea')!;
  area.value = text;
  area.dispatchEvent(new Event('input'));
  await fixture.whenStable();
};

describe('YamlPanel', () => {
  it('乾淨時 textarea 跟隨表單', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();
    expect(el.querySelector('textarea')!.value).toContain('date: 2024-01-01');
  });

  it('乾淨時不顯示尚未套用標示', async () => {
    const { el } = await setup();
    expect(el.querySelector('.dirty-badge')).toBeNull();
  });

  it('編輯後顯示尚未套用標示與捨棄按鈕', async () => {
    const { fixture, el } = await setup();
    await type(fixture, el, 'initial:\n  date: 2099-01-01\n');
    expect(el.querySelector('.dirty-badge')?.textContent).toContain('尚未套用');
    expect(el.querySelector('.discard-yaml')).not.toBeNull();
  });

  it('髒掉後表單變動不會覆蓋草稿', async () => {
    const { fixture, store, el } = await setup();
    await type(fixture, el, 'my draft');
    // 一般的表單編輯，不是「載入範例」「清除全部」那種明示重置——
    // 那兩個動作依 spec §6 會無條件轉乾淨，拿來當這裡的觸發會測錯東西
    store.setInitialDate('2024-01-01');
    await fixture.whenStable();
    expect(el.querySelector('textarea')!.value).toBe('my draft');
  });

  it('套用合法 YAML 會灌回表單並清掉標示', async () => {
    const { fixture, store, el } = await setup();
    await type(
      fixture,
      el,
      'initial:\n  date: 2024-01-01\n  amount: 100000\nflows: []\nfinal:\n  date: 2025-01-01\n  amount: 145000\n',
    );
    el.querySelector<HTMLButtonElement>('.apply-yaml')!.click();
    await fixture.whenStable();

    expect(store.form().initial.amount).toBe(100000);
    expect(el.querySelector('.dirty-badge')).toBeNull();
    expect(el.querySelector('.yaml-error')).toBeNull();
  });

  it('套用失敗顯示帶行號的錯誤且維持髒', async () => {
    const { fixture, el } = await setup();
    await type(fixture, el, 'initial:\n  date: 2024-01-01\n   amount: 5\n');
    el.querySelector<HTMLButtonElement>('.apply-yaml')!.click();
    await fixture.whenStable();

    expect(el.querySelector('.yaml-error')?.textContent).toContain('第 3 行');
    expect(el.querySelector('.dirty-badge')).not.toBeNull();
  });

  describe('無障礙錯誤關聯', () => {
    it('套用失敗時 textarea 帶 aria-invalid 與 aria-describedby，指向的元素存在且文字含行號', async () => {
      const { fixture, el } = await setup();
      await type(fixture, el, 'initial:\n  date: 2024-01-01\n   amount: 5\n');
      el.querySelector<HTMLButtonElement>('.apply-yaml')!.click();
      await fixture.whenStable();

      const textarea = el.querySelector<HTMLTextAreaElement>('textarea')!;
      expect(textarea.getAttribute('aria-invalid')).toBe('true');
      const describedBy = textarea.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const errorEl = el.querySelector(`#${describedBy}`);
      expect(errorEl).not.toBeNull();
      expect(errorEl!.textContent).toContain('第 3 行');
    });

    it('沒有錯誤時 textarea 不帶 aria-invalid 也不帶 aria-describedby', async () => {
      const { el } = await setup();
      const textarea = el.querySelector<HTMLTextAreaElement>('textarea')!;
      expect(textarea.getAttribute('aria-invalid')).toBeNull();
      expect(textarea.getAttribute('aria-describedby')).toBeNull();
      expect(el.querySelector('.yaml-error')).toBeNull();
    });

    it('捨棄變更後，textarea 的 aria-invalid／aria-describedby 一併清除', async () => {
      const { fixture, el } = await setup();
      await type(fixture, el, 'initial:\n  date: 2024-01-01\n   amount: 5\n');
      el.querySelector<HTMLButtonElement>('.apply-yaml')!.click();
      await fixture.whenStable();

      el.querySelector<HTMLButtonElement>('.discard-yaml')!.click();
      await fixture.whenStable();

      const textarea = el.querySelector<HTMLTextAreaElement>('textarea')!;
      expect(textarea.getAttribute('aria-invalid')).toBeNull();
      expect(textarea.getAttribute('aria-describedby')).toBeNull();
    });
  });

  it('捨棄變更後回到跟隨表單', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();
    await type(fixture, el, '亂打的內容');
    el.querySelector<HTMLButtonElement>('.discard-yaml')!.click();
    await fixture.whenStable();

    expect(el.querySelector('textarea')!.value).toContain('date: 2024-01-01');
    expect(el.querySelector('.dirty-badge')).toBeNull();
  });

  it('顯示格式說明範例', async () => {
    const { el } = await setup();
    const help = el.querySelector('.yaml-help')!.textContent ?? '';
    expect(help).toContain('initial:');
    expect(help).toContain('flows:');
    expect(help).toContain('final:');
    expect(help).toContain('正數 = 資金投入');
  });
});
