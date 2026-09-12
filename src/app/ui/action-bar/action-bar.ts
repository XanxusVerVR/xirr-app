import { Component, inject, signal } from '@angular/core';
import { CalculatorStore } from '../../state/calculator-store';

type PendingAction = 'example' | 'clear' | null;

@Component({
  selector: 'app-action-bar',
  imports: [],
  templateUrl: './action-bar.html',
  styleUrl: './action-bar.css',
})
export class ActionBar {
  protected readonly store = inject(CalculatorStore);

  /** 純畫面暫態，不進 store */
  protected readonly pending = signal<PendingAction>(null);

  protected readonly confirmLabel = (): string =>
    this.pending() === 'example' ? '載入範例' : '清除全部';

  protected requestExample(): void {
    if (this.store.isEmpty()) this.store.loadExample();
    else this.pending.set('example');
  }

  protected requestClear(): void {
    if (this.store.isEmpty()) this.store.clearAll();
    else this.pending.set('clear');
  }

  protected confirm(): void {
    const action = this.pending();
    if (action === 'example') this.store.loadExample();
    else if (action === 'clear') this.store.clearAll();
    this.pending.set(null);
  }

  protected cancel(): void {
    this.pending.set(null);
  }
}
