import { Component, computed, inject } from '@angular/core';
import { CalculatorStore } from '../../state/calculator-store';
import { formatAmount, formatPercent } from '../format';

@Component({
  selector: 'app-results-panel',
  imports: [],
  templateUrl: './results-panel.html',
  styleUrl: './results-panel.css',
})
export class ResultsPanel {
  protected readonly store = inject(CalculatorStore);

  protected readonly success = computed(() => {
    const outcome = this.store.outcome();
    return outcome?.ok ? outcome : null;
  });

  protected readonly failure = computed(() => {
    const outcome = this.store.outcome();
    return outcome && !outcome.ok ? outcome : null;
  });

  protected readonly amount = formatAmount;
  protected readonly percent = formatPercent;
}
