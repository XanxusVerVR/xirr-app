/** 使用者輸入層：允許半填狀態 */
export interface CashFlowRow {
  /** 穩定識別碼，給 @for track 與 cdkDrag 用。不可用陣列索引取代 */
  id: string;
  /** 'YYYY-MM-DD'，未填為 '' */
  date: string;
  /** 未填為 null。null 與 0 意義不同：0 是合法金額 */
  amount: number | null;
  /**
   * 使用者最後輸入的原始文字（或程式設定值的字串形式）。
   * 畫面綁這個欄位，才不會在輸入 "-" 這類尚未可解析的中間狀態時被寫回覆蓋。
   * 驗證、彙總與 solver 一律只看 amount。
   */
  amountText: string;
}

export interface PositionInput {
  date: string;
  amount: number | null;
  /** 同 CashFlowRow.amountText：畫面綁定用的原始文字 */
  amountText: string;
}

export interface CalculatorForm {
  initial: PositionInput;
  rows: CashFlowRow[];
  final: PositionInput;
}

/** 已通過必填檢查的輸入：amount 保證非 null */
export interface ResolvedPosition {
  date: string;
  amount: number;
}

export interface ResolvedRow {
  id: string;
  date: string;
  amount: number;
}

export interface ResolvedForm {
  initial: ResolvedPosition;
  rows: ResolvedRow[];
  final: ResolvedPosition;
}

/** 計算層：已翻成 XIRR 符號慣例（流出為負、流入為正） */
export interface CashFlow {
  /** 距 1970-01-01 的天數（UTC） */
  epochDay: number;
  amount: number;
}

export type IssueCode =
  | 'MISSING_DATE'
  | 'MISSING_AMOUNT'
  | 'DATE_ORDER'
  | 'DATE_OUT_OF_RANGE'
  | 'NO_INVESTMENT'
  /**
   * 現金流正負皆有、理論上應有解，但 solver 仍找不到根。
   * 這是 spec §4 未列出的第 6 個代碼，刻意加入：
   * 少了它，Task 7 的管線就會有一條無法回報的分支。
   */
  | 'UNSOLVABLE';

export type NoteCode = 'SORTED' | 'TOTAL_LOSS' | 'MULTIPLE_ROOTS' | 'EXTREME_RATE';

export interface IssueTarget {
  kind: 'initial' | 'final' | 'row';
  /** kind === 'row' 時必填，用來高亮對應列 */
  rowId?: string;
  field: 'date' | 'amount';
}

export interface ValidationIssue {
  code: IssueCode;
  message: string;
  target: IssueTarget;
}

export interface Note {
  code: NoteCode;
  message: string;
}

export interface Metrics {
  totalInvested: number;
  totalWithdrawn: number;
  currentPosition: number;
  totalReturn: number;
  /** ok: true 時必為數值。全損特判為 -1（即 -100%）。顯示夾制屬 UI 層職責 */
  xirr: number;
}

export type Outcome =
  | { ok: true; metrics: Metrics; notes: Note[] }
  | { ok: false; errors: ValidationIssue[] };
