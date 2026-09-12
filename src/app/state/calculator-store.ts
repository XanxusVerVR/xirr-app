import { Injectable, computed, signal } from '@angular/core';
import type {
  CalculatorForm,
  CashFlowRow,
  Outcome,
  ValidationIssue,
} from '../core/model/types';
import { exampleForm } from '../core/example';
import { runCalculation } from '../core/xirr/calculate';
import { parseForm } from '../core/yaml/parse';
import { serializeForm } from '../core/yaml/serialize';

let idCounter = 0;
function nextId(): string {
  return `row-${++idCounter}`;
}

function emptyRow(): CashFlowRow {
  return { id: nextId(), date: '', amount: null };
}

function emptyForm(): CalculatorForm {
  return {
    initial: { date: '', amount: null },
    rows: [emptyRow()],
    final: { date: '', amount: null },
  };
}

/** '' 與無法解析的內容都視為未填。'0' 是合法金額，必須保留為 0 */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

@Injectable({ providedIn: 'root' })
export class CalculatorStore {
  private readonly formState = signal<CalculatorForm>(emptyForm());
  private readonly outcomeState = signal<Outcome | null>(null);
  /** null = 乾淨（yamlText 跟隨表單）；非 null = 髒（停止跟隨） */
  private readonly yamlDraft = signal<string | null>(null);
  private readonly yamlErrorState = signal<string | null>(null);

  readonly form = this.formState.asReadonly();
  readonly outcome = this.outcomeState.asReadonly();
  readonly yamlError = this.yamlErrorState.asReadonly();

  readonly yamlDirty = computed(() => this.yamlDraft() !== null);
  readonly yamlText = computed(() => this.yamlDraft() ?? serializeForm(this.formState()));

  readonly isEmpty = computed(() => {
    const f = this.formState();
    const positionsEmpty =
      f.initial.date === '' &&
      f.initial.amount === null &&
      f.final.date === '' &&
      f.final.amount === null;
    const rowsEmpty = f.rows.every((r) => r.date === '' && r.amount === null);
    return positionsEmpty && rowsEmpty;
  });

  /** 供表格高亮使用：rowId → 該列的錯誤 */
  readonly issuesByRow = computed(() => {
    const map = new Map<string, ValidationIssue[]>();
    const outcome = this.outcomeState();
    if (!outcome || outcome.ok) return map;

    for (const issue of outcome.errors) {
      const id = issue.target.rowId;
      if (issue.target.kind !== 'row' || id === undefined) continue;
      const existing = map.get(id);
      if (existing) existing.push(issue);
      else map.set(id, [issue]);
    }
    return map;
  });

  /** 非列的錯誤（期初／期末／整體） */
  readonly generalIssues = computed(() => {
    const outcome = this.outcomeState();
    if (!outcome || outcome.ok) return [];
    return outcome.errors.filter((i) => i.target.kind !== 'row');
  });

  // --- 列操作 ---

  addRow(): void {
    this.formState.update((f) => ({ ...f, rows: [...f.rows, emptyRow()] }));
  }

  removeRow(id: string): void {
    this.formState.update((f) => {
      const rows = f.rows.filter((r) => r.id !== id);
      return { ...f, rows: rows.length > 0 ? rows : [emptyRow()] };
    });
  }

  /** 複製日期與金額，插在原列正下方 */
  duplicateRow(id: string): void {
    this.formState.update((f) => {
      const index = f.rows.findIndex((r) => r.id === id);
      if (index === -1) return f;
      const source = f.rows[index];
      const copy: CashFlowRow = { id: nextId(), date: source.date, amount: source.amount };
      const rows = [...f.rows];
      rows.splice(index + 1, 0, copy);
      return { ...f, rows };
    });
  }

  moveRow(from: number, to: number): void {
    this.formState.update((f) => {
      if (from === to) return f;
      const rows = [...f.rows];
      const [moved] = rows.splice(from, 1);
      if (moved === undefined) return f;
      rows.splice(to, 0, moved);
      return { ...f, rows };
    });
  }

  // --- 欄位編輯 ---

  setInitialDate(value: string): void {
    this.formState.update((f) => ({ ...f, initial: { ...f.initial, date: value } }));
  }

  setInitialAmount(raw: string): void {
    this.formState.update((f) => ({
      ...f,
      initial: { ...f.initial, amount: parseAmount(raw) },
    }));
  }

  setFinalDate(value: string): void {
    this.formState.update((f) => ({ ...f, final: { ...f.final, date: value } }));
  }

  setFinalAmount(raw: string): void {
    this.formState.update((f) => ({ ...f, final: { ...f.final, amount: parseAmount(raw) } }));
  }

  setRowDate(id: string, value: string): void {
    this.formState.update((f) => ({
      ...f,
      rows: f.rows.map((r) => (r.id === id ? { ...r, date: value } : r)),
    }));
  }

  setRowAmount(id: string, raw: string): void {
    this.formState.update((f) => ({
      ...f,
      rows: f.rows.map((r) => (r.id === id ? { ...r, amount: parseAmount(raw) } : r)),
    }));
  }

  // --- YAML ---

  editYaml(text: string): void {
    this.yamlDraft.set(text);
  }

  applyYaml(): void {
    const draft = this.yamlDraft();
    if (draft === null) return;

    const result = parseForm(draft, nextId);
    if (!result.ok) {
      this.yamlErrorState.set(result.message);
      return; // 保留草稿、維持髒
    }

    this.formState.set(result.form);
    this.yamlDraft.set(null);
    this.yamlErrorState.set(null);
    this.outcomeState.set(null);
  }

  discardYaml(): void {
    this.yamlDraft.set(null);
    this.yamlErrorState.set(null);
  }

  // --- 整體動作 ---

  loadExample(): void {
    this.formState.set(exampleForm(nextId));
    this.resetYaml();
    this.outcomeState.set(null);
  }

  clearAll(): void {
    this.formState.set(emptyForm());
    this.resetYaml();
    this.outcomeState.set(null);
  }

  calculate(): void {
    const run = runCalculation(this.formState());
    if (run.sortedRows !== null) {
      const rows = run.sortedRows;
      this.formState.update((f) => ({ ...f, rows }));
    }
    this.outcomeState.set(run.outcome);
  }

  private resetYaml(): void {
    this.yamlDraft.set(null);
    this.yamlErrorState.set(null);
  }
}
