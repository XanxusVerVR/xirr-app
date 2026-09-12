import * as yaml from 'js-yaml';
import type { CalculatorForm, CashFlowRow, PositionInput } from '../model/types';

export type ParseResult =
  | { ok: true; form: CalculatorForm }
  | { ok: false; message: string; line: number | null };

function fail(message: string, line: number | null = null): ParseResult {
  return { ok: false, message, line };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 回傳 null 代表合法；回傳字串代表錯誤訊息 */
function readPosition(
  value: unknown,
  name: string,
): { position: PositionInput } | { error: string } {
  if (!isPlainObject(value)) return { error: `${name} 必須是包含 date 與 amount 的區塊。` };

  const rawDate = value['date'];
  const date = rawDate === null || rawDate === undefined ? '' : rawDate;
  if (typeof date !== 'string') {
    return { error: `${name} 的 date 必須是 YYYY-MM-DD 格式的文字，例如 2024-01-01。` };
  }

  const rawAmount = value['amount'];
  if (rawAmount === null || rawAmount === undefined) {
    return { position: { date, amount: null } };
  }
  if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount)) {
    return { error: `${name} 的 amount 必須是數字。` };
  }

  return { position: { date, amount: rawAmount } };
}

export function parseForm(text: string, makeId: () => string): ParseResult {
  if (text.trim() === '') return fail('內容是空的，請貼上 YAML 資料。');

  let document: unknown;
  try {
    document = yaml.load(text, { schema: yaml.CORE_SCHEMA });
  } catch (error) {
    const mark = (error as { mark?: { line?: number } }).mark;
    const line = typeof mark?.line === 'number' ? mark.line + 1 : null;
    const reason = (error as Error).message ?? 'YAML 格式錯誤';
    return fail(
      line === null ? `YAML 格式錯誤：${reason}` : `第 ${line} 行的 YAML 格式錯誤：${reason}`,
      line,
    );
  }

  if (!isPlainObject(document)) {
    return fail('最外層必須是包含 initial、flows、final 的區塊。');
  }

  if (!('initial' in document)) return fail('缺少 initial 區塊（期初部位）。');
  if (!('final' in document)) return fail('缺少 final 區塊（期末部位）。');

  const initial = readPosition(document['initial'], 'initial');
  if ('error' in initial) return fail(initial.error);

  const final = readPosition(document['final'], 'final');
  if ('error' in final) return fail(final.error);

  const rawFlows = document['flows'];
  if (rawFlows !== undefined && rawFlows !== null && !Array.isArray(rawFlows)) {
    return fail('flows 必須是清單，例如：flows:\n  - date: 2024-03-15\n    amount: 50000');
  }

  const rows: CashFlowRow[] = [];
  const flows = Array.isArray(rawFlows) ? rawFlows : [];
  for (let i = 0; i < flows.length; i++) {
    const entry = readPosition(flows[i], `flows 第 ${i + 1} 筆`);
    if ('error' in entry) return fail(entry.error);
    rows.push({ id: makeId(), date: entry.position.date, amount: entry.position.amount });
  }

  return {
    ok: true,
    form: { initial: initial.position, rows, final: final.position },
  };
}
