import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, ElementRef, Injector, afterNextRender, inject } from '@angular/core';
import { CalculatorStore } from '../../state/calculator-store';

@Component({
  selector: 'app-cash-flow-table',
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './cash-flow-table.html',
  styleUrl: './cash-flow-table.css',
})
export class CashFlowTable {
  protected readonly store = inject(CalculatorStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.store.moveRow(event.previousIndex, event.currentIndex);
  }

  /** 複製後把焦點移到新列的日期欄，使用者才能直接改日期 */
  protected onDuplicate(id: string): void {
    this.store.duplicateRow(id);

    const rows = this.store.form().rows;
    const index = rows.findIndex((r) => r.id === id);
    const created = rows[index + 1];
    if (created === undefined) return;

    // 新列要等變更偵測跑完才進 DOM，不能在這裡直接查詢
    afterNextRender(
      () => {
        this.host.nativeElement
          .querySelector<HTMLInputElement>(`input[data-row-id="${created.id}"]`)
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  protected onDate(id: string, event: Event): void {
    this.store.setRowDate(id, (event.target as HTMLInputElement).value);
  }

  protected onAmount(id: string, event: Event): void {
    this.store.setRowAmount(id, (event.target as HTMLInputElement).value);
  }

  protected rowHasError(id: string): boolean {
    return this.store.issuesByRow().has(id);
  }

  /** 供輸入框的 aria-invalid：只標記真的有問題的那個欄位，不是整列 */
  protected fieldHasIssue(id: string, field: 'date' | 'amount'): boolean {
    return (this.store.issuesByRow().get(id) ?? []).some((issue) => issue.target.field === field);
  }

  /** 該欄位的錯誤訊息，供 aria-describedby 指向的元素顯示；沒有問題時回傳 null */
  protected fieldIssueMessage(id: string, field: 'date' | 'amount'): string | null {
    const issue = (this.store.issuesByRow().get(id) ?? []).find(
      (i) => i.target.field === field,
    );
    return issue?.message ?? null;
  }

  /** 錯誤訊息元素的 id，輸入框的 aria-describedby 與訊息元素的 id 都由此產生，避免兩處各自拼字串而兜不起來 */
  protected fieldErrorId(id: string, field: 'date' | 'amount'): string {
    return `cf-${id}-${field}-error`;
  }
}
