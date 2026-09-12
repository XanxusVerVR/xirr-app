import type { CalculatorForm } from './model/types';
import { amountToText } from './amount-text';

/** 載入範例用的資料。XIRR 約為 19.353321% */
export function exampleForm(makeId: () => string): CalculatorForm {
  return {
    initial: { date: '2024-01-01', amount: 100000, amountText: amountToText(100000) },
    rows: [
      { id: makeId(), date: '2024-03-15', amount: 50000, amountText: amountToText(50000) },
      { id: makeId(), date: '2024-08-20', amount: -30000, amountText: amountToText(-30000) },
    ],
    final: { date: '2025-01-01', amount: 145000, amountText: amountToText(145000) },
  };
}
