import type {
  CalculatorForm,
  CashFlow,
  IssueTarget,
  PositionInput,
  ResolvedForm,
  ValidationIssue,
} from '../model/types';
import { isValidDateString, toEpochDay } from '../date';

function missingDate(target: IssueTarget, label: string): ValidationIssue {
  return { code: 'MISSING_DATE', message: `請填寫有效的${label}日期`, target };
}

function missingAmount(target: IssueTarget, label: string): ValidationIssue {
  return { code: 'MISSING_AMOUNT', message: `請填寫${label}金額`, target };
}

function checkPosition(
  position: PositionInput,
  kind: 'initial' | 'final',
  label: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isValidDateString(position.date)) {
    issues.push(missingDate({ kind, field: 'date' }, label));
  }
  if (position.amount === null || !Number.isFinite(position.amount)) {
    issues.push(missingAmount({ kind, field: 'amount' }, label));
  }
  return issues;
}

/** 步驟 1：必填檢查。必須在排序之前執行——沒有日期的列無法參與排序 */
export function validateRequired(form: CalculatorForm): ValidationIssue[] {
  const issues = [
    ...checkPosition(form.initial, 'initial', '期初部位'),
    ...checkPosition(form.final, 'final', '期末部位'),
  ];

  for (const row of form.rows) {
    if (!isValidDateString(row.date)) {
      issues.push(missingDate({ kind: 'row', rowId: row.id, field: 'date' }, '資金進出'));
    }
    if (row.amount === null || !Number.isFinite(row.amount)) {
      issues.push(missingAmount({ kind: 'row', rowId: row.id, field: 'amount' }, '資金進出'));
    }
  }

  return issues;
}

/** 呼叫前必須先確認 validateRequired 回傳空陣列 */
export function resolveForm(form: CalculatorForm): ResolvedForm {
  return {
    initial: { date: form.initial.date, amount: form.initial.amount as number },
    rows: form.rows.map((r) => ({ id: r.id, date: r.date, amount: r.amount as number })),
    final: { date: form.final.date, amount: form.final.amount as number },
  };
}

/** 步驟 3：區間檢查。資金進出彼此的順序不檢查——步驟 2 已排序 */
export function validateRanges(form: ResolvedForm): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const start = toEpochDay(form.initial.date);
  const end = toEpochDay(form.final.date);

  if (start >= end) {
    issues.push({
      code: 'DATE_ORDER',
      message: '期初日期必須早於期末日期',
      target: { kind: 'initial', field: 'date' },
    });
    return issues; // 區間本身無效時，逐列比對已無意義
  }

  for (const row of form.rows) {
    const day = toEpochDay(row.date);
    if (day < start || day > end) {
      issues.push({
        code: 'DATE_OUT_OF_RANGE',
        message: '資金進出日期必須落在期初與期末之間',
        target: { kind: 'row', rowId: row.id, field: 'date' },
      });
    }
  }

  return issues;
}

/** UI 符號（正數 = 投入）翻成 XIRR 符號（流出為負、流入為正） */
export function toCashFlows(form: ResolvedForm): CashFlow[] {
  return [
    { epochDay: toEpochDay(form.initial.date), amount: -form.initial.amount },
    ...form.rows.map((r) => ({ epochDay: toEpochDay(r.date), amount: -r.amount })),
    { epochDay: toEpochDay(form.final.date), amount: form.final.amount },
  ];
}
