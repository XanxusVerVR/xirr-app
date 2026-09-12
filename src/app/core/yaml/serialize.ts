import type { CalculatorForm, PositionInput } from '../model/types';

export const SIGN_LEGEND = '# 正數 = 資金投入，負數 = 資金匯出';

/** 空字串必須加引號，否則 YAML 會解析成 null 而非 '' */
function dateLiteral(date: string): string {
  return date === '' ? "''" : date;
}

/** null 輸出為空值，YAML 會解析回 null */
function amountLiteral(amount: number | null): string {
  return amount === null ? '' : String(amount);
}

function positionBlock(name: string, position: PositionInput): string[] {
  return [
    `${name}:`,
    `  date: ${dateLiteral(position.date)}`,
    `  amount: ${amountLiteral(position.amount)}`.trimEnd(),
  ];
}

export function serializeForm(form: CalculatorForm): string {
  const lines: string[] = [
    ...positionBlock('initial', form.initial),
    '',
    SIGN_LEGEND,
  ];

  if (form.rows.length === 0) {
    lines.push('flows: []');
  } else {
    lines.push('flows:');
    for (const row of form.rows) {
      lines.push(`  - date: ${dateLiteral(row.date)}`);
      lines.push(`    amount: ${amountLiteral(row.amount)}`.trimEnd());
    }
  }

  lines.push('', ...positionBlock('final', form.final), '');
  return lines.join('\n');
}
