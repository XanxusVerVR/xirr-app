import { Component, inject } from '@angular/core';
import { CalculatorStore } from '../../state/calculator-store';

const HELP_EXAMPLE = `initial:
  date: 2024-01-01
  amount: 100000

# 正數 = 資金投入，負數 = 資金匯出
flows:
  - date: 2024-03-15
    amount: 50000
  - date: 2024-08-20
    amount: -30000

final:
  date: 2025-01-01
  amount: 145000`;

@Component({
  selector: 'app-yaml-panel',
  imports: [],
  templateUrl: './yaml-panel.html',
  styleUrl: './yaml-panel.css',
})
export class YamlPanel {
  protected readonly store = inject(CalculatorStore);
  protected readonly helpExample = HELP_EXAMPLE;

  protected onInput(event: Event): void {
    this.store.editYaml((event.target as HTMLTextAreaElement).value);
  }
}
