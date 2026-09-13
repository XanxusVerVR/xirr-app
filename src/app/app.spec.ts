import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('渲染標題', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('XIRR 投資年化報酬率計算機');
  });

  it('整個表單有多個錯誤時，沒有任何輸入框的 aria-describedby 指向不存在的元素（回歸：懸空關聯）', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    // 空表單送出計算，期初/期末/唯一一列同時都是必填錯誤，涵蓋三個元件
    el.querySelector<HTMLButtonElement>('.calculate')!.click();
    await fixture.whenStable();

    const inputs = Array.from(el.querySelectorAll<HTMLElement>('input, textarea'));
    const withDescribedBy = inputs.filter((i) => i.hasAttribute('aria-describedby'));

    // 確認這個測試真的在驗證有意義的東西，而不是因為沒有欄位帶 aria-describedby 而空洞通過
    expect(withDescribedBy.length).toBeGreaterThan(0);

    for (const input of withDescribedBy) {
      const id = input.getAttribute('aria-describedby')!;
      for (const singleId of id.split(/\s+/).filter(Boolean)) {
        expect(el.querySelector(`#${singleId}`)).not.toBeNull();
      }
    }
  });
});
