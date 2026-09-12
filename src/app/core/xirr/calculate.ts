import type {
  CalculatorForm,
  CashFlow,
  CashFlowRow,
  Note,
  NoteCode,
  Outcome,
} from '../model/types';
import { toEpochDay } from '../date';
import { computeMetrics } from './metrics';
import { countSignChanges, solveXirr } from './solver';
import { resolveForm, toCashFlows, validateRanges, validateRequired } from './validate';

export interface CalculationRun {
  outcome: Outcome;
  /** 排序後的列，供 store 寫回表單。必填檢查失敗時為 null（未排序） */
  sortedRows: CashFlowRow[] | null;
  sorted: boolean;
}

const EXTREME_LOW = -0.99;
const EXTREME_HIGH = 10;

const NOTE_MESSAGES: Record<NoteCode, string> = {
  SORTED: '資金進出記錄的日期順序不正確，已自動依日期重新排序。',
  TOTAL_LOSS: '期末部位為 0 且期間沒有任何資金匯出，本金全數損失，年化報酬率為 -100%。',
  MULTIPLE_ROOTS:
    '現金流方向多次變換，理論上可能存在多組解，此結果為其中之一。',
  EXTREME_RATE: '年化報酬率極端，通常來自極短的投資期間或極大的金額變動，請確認輸入是否正確。',
};

function note(code: NoteCode): Note {
  return { code, message: NOTE_MESSAGES[code] };
}

/** 穩定排序：同日期維持原有順序 */
function sortByDate(rows: readonly CashFlowRow[]): { rows: CashFlowRow[]; changed: boolean } {
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const diff = toEpochDay(a.row.date) - toEpochDay(b.row.date);
      return diff !== 0 ? diff : a.index - b.index;
    });
  const changed = sorted.some((entry, i) => entry.index !== i);
  return { rows: sorted.map((entry) => entry.row), changed };
}

function collectNotes(cfs: readonly CashFlow[], rate: number, sorted: boolean): Note[] {
  const notes: Note[] = [];
  if (sorted) notes.push(note('SORTED'));
  if (countSignChanges(cfs) >= 2) notes.push(note('MULTIPLE_ROOTS'));
  if (rate < EXTREME_LOW || rate > EXTREME_HIGH) notes.push(note('EXTREME_RATE'));
  return notes;
}

/** 完全空白的列（日期與金額皆未填）視為「尚未使用」，不參與驗證與計算 */
function isBlankRow(row: CashFlowRow): boolean {
  return row.date === '' && row.amount === null;
}

export function runCalculation(form: CalculatorForm): CalculationRun {
  // 步驟 0：過濾完全空白的列——半填的列（只填了其中一格）仍要照常報錯
  const activeRows = form.rows.filter((r) => !isBlankRow(r));
  const blankRows = form.rows.filter((r) => isBlankRow(r));
  const active: CalculatorForm = { ...form, rows: activeRows };

  // 步驟 1：必填檢查。必須在排序之前——沒有日期的列無法參與排序
  const required = validateRequired(active);
  if (required.length > 0) {
    return { outcome: { ok: false, errors: required }, sortedRows: null, sorted: false };
  }

  // 步驟 2：排序。空白列固定留在最後，不參與排序也不影響 sorted 判定
  const { rows: sortedActiveRows, changed: sorted } = sortByDate(activeRows);
  const sortedRows = [...sortedActiveRows, ...blankRows];
  const ordered: CalculatorForm = { ...form, rows: sortedActiveRows };

  // 步驟 3：其餘驗證
  const resolved = resolveForm(ordered);
  const ranges = validateRanges(resolved);
  if (ranges.length > 0) {
    return { outcome: { ok: false, errors: ranges }, sortedRows, sorted };
  }

  // 步驟 4：符號判定與求解
  const cfs = toCashFlows(resolved);
  const hasOutflow = cfs.some((c) => c.amount < 0);
  const hasInflow = cfs.some((c) => c.amount > 0);

  if (!hasOutflow) {
    return {
      outcome: {
        ok: false,
        errors: [
          {
            code: 'NO_INVESTMENT',
            message: '沒有任何資金投入，無法計算報酬率。',
            target: { kind: 'initial', field: 'amount' },
          },
        ],
      },
      sortedRows,
      sorted,
    };
  }

  if (!hasInflow) {
    // 本金全損：數學上無根，極限為 -100%。特判而非報錯。
    // 這裡不呼叫 collectNotes：-100% 會觸發 EXTREME_RATE，但那句提醒
    // 跟 TOTAL_LOSS 講的是同一件事，兩句並列只是噪音。
    const notes: Note[] = [];
    if (sorted) notes.push(note('SORTED'));
    notes.push(note('TOTAL_LOSS'));
    return {
      outcome: { ok: true, metrics: computeMetrics(resolved, -1), notes },
      sortedRows,
      sorted,
    };
  }

  const solved = solveXirr(cfs);
  if (solved.status !== 'OK') {
    return {
      outcome: {
        ok: false,
        errors: [
          {
            code: 'UNSOLVABLE',
            message: '無法求得年化報酬率，請確認輸入的日期與金額。',
            target: { kind: 'initial', field: 'amount' },
          },
        ],
      },
      sortedRows,
      sorted,
    };
  }

  return {
    outcome: {
      ok: true,
      metrics: computeMetrics(resolved, solved.rate),
      notes: collectNotes(cfs, solved.rate, sorted),
    },
    sortedRows,
    sorted,
  };
}
