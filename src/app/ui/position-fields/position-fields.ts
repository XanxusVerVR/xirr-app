import { Component, computed, inject, input } from '@angular/core';
import { CalculatorStore } from '../../state/calculator-store';

@Component({
  selector: 'app-position-fields',
  imports: [],
  templateUrl: './position-fields.html',
  styleUrl: './position-fields.css',
})
export class PositionFields {
  protected readonly store = inject(CalculatorStore);

  readonly kind = input.required<'initial' | 'final'>();

  protected readonly title = computed(() =>
    this.kind() === 'initial' ? '期初部位' : '期末部位',
  );

  protected readonly dateLabel = computed(() =>
    this.kind() === 'initial' ? '開始日期' : '結束日期',
  );

  protected readonly amountLabel = computed(() =>
    this.kind() === 'initial' ? '期初金額' : '期末金額',
  );

  protected readonly position = computed(() => {
    const form = this.store.form();
    return this.kind() === 'initial' ? form.initial : form.final;
  });

  protected readonly dateInvalid = computed(() => this.dateErrorMessage() !== null);
  protected readonly amountInvalid = computed(() => this.amountErrorMessage() !== null);

  protected readonly dateErrorMessage = computed(() => this.issueMessage('date'));
  protected readonly amountErrorMessage = computed(() => this.issueMessage('amount'));

  protected readonly dateErrorId = computed(() => `pos-${this.kind()}-date-error`);
  protected readonly amountErrorId = computed(() => `pos-${this.kind()}-amount-error`);

  protected onDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.kind() === 'initial') this.store.setInitialDate(value);
    else this.store.setFinalDate(value);
  }

  protected onAmount(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.kind() === 'initial') this.store.setInitialAmount(value);
    else this.store.setFinalAmount(value);
  }

  private issueMessage(field: 'date' | 'amount'): string | null {
    const issue = this.store
      .generalIssues()
      .find((i) => i.target.kind === this.kind() && i.target.field === field);
    return issue?.message ?? null;
  }
}
