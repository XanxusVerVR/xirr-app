# XIRR 投資年化報酬率計算機 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出一個純靜態前端的 Angular XIRR 計算機，使用者輸入期初部位、資金進出記錄、期末部位，得到年化報酬率與四項彙總數字。

**Architecture:** 依賴方向單向 `ui → state → core`。所有數學與驗證邏輯放在 `core/`，是不 import 任何 Angular 的純 TypeScript 函式，可用毫秒級 unit test 驗證。`state/` 是唯一的可變狀態（signal store），對外只暴露意圖明確的方法。`ui/` 元件直接注入 store，不做 input/output 轉接，也不使用 Reactive Forms。

**Tech Stack:** Angular 22.1.6（zoneless、standalone）、`@angular/cdk` 22.1.6（僅 drag-drop）、`js-yaml` 5.4.1、Vitest 4（Angular 22 預設測試執行器）、TypeScript 6。

**Spec:** `docs/superpowers/specs/2026-09-12-xirr-calculator-design.md`

## Global Constraints

這些是專案全域要求，**每個 task 的要求都隱含包含本節**：

- **Angular 版本精確鎖定 `22.1.6`**（`@angular/core`、`@angular/common`、`@angular/compiler`、`@angular/forms`、`@angular/platform-browser`、`@angular/compiler-cli`、`@angular/cdk`），`package.json` 中**不加 `^` 或 `~`**。
- **不安裝 Angular Material**。UI 依賴只有 `@angular/cdk`，且只用其 `drag-drop`。
- **不安裝 `@types/js-yaml`**（停留在 4.0.9，與 js-yaml 5 自帶型別衝突）。
- **不使用 Reactive Forms、不使用 `ngModel`**。表單一律原生 `[value]` + `(input)` 綁到 store 方法。
- **不引入 NgRx** 或其他狀態管理函式庫。
- **不引入 zod** 或其他 schema 驗證函式庫。YAML 結構驗證手寫。
- **`core/` 底下任何檔案不得 import `@angular/*`。**
- **日期一律用 `'YYYY-MM-DD'` 字串**，不使用 `Date` 物件當作資料模型。時間計算一律經由 `Date.UTC()`。
- **折現年化分母固定為 365**（與 Excel `XIRR` 一致），不用 365.25、不用實際曆法天數。
- **所有測試指令必須帶 `--watch=false`**。`--watch` 在 TTY 環境預設為 `true`，不帶會讓執行卡住。
- **`tsconfig.json` 不需要加 `"strict": true`**。TypeScript 6.0 預設即為 strict，已實測確認（`TS18047: 'x' is possibly 'null'`）。
- **測試檔不需要 import `describe` / `it` / `expect`**。`tsconfig.spec.json` 的 `types: ["vitest/globals"]` 已提供全域宣告。
- **UI 文案一律繁體中文。**
- 每個 task 結束時 commit，commit message 用英文，格式 `type: summary`。

## File Structure

| 檔案 | 職責 | Task |
|---|---|---|
| `src/app/core/model/types.ts` | 全專案共用型別。**無邏輯、無 import** | 2 |
| `src/app/core/date.ts` | `'YYYY-MM-DD'` ↔ epoch day 轉換與格式驗證 | 2 |
| `src/app/core/xirr/npv.ts` | 淨現值與其對 rate 的一階導數 | 3 |
| `src/app/core/xirr/solver.ts` | Newton-Raphson + bisection 求根；符號變換計數 | 4 |
| `src/app/core/xirr/metrics.ts` | 五項彙總數字（用 UI 符號計算） | 5 |
| `src/app/core/xirr/validate.ts` | 必填檢查、區間檢查、符號檢查、符號翻轉 | 6 |
| `src/app/core/xirr/calculate.ts` | 管線編排：必填 → 排序 → 其餘驗證 → 求解 | 7 |
| `src/app/core/yaml/serialize.ts` | 表單 → YAML 字串（手寫模板，保留註解） | 8 |
| `src/app/core/yaml/parse.ts` | YAML 字串 → 表單（js-yaml + 手寫結構驗證） | 9 |
| `src/app/core/example.ts` | 範例資料常數 | 9 |
| `src/app/state/calculator-store.ts` | 唯一可變狀態；意圖方法 | 10 |
| `src/styles.css` | 全域樣式與 CSS 變數 | 11 |
| `src/app/app.ts` / `app.html` / `app.css` | 版面組合 | 11 |
| `src/app/ui/format.ts` | 顯示格式化與極端值夾制（**UI 層職責**） | 11 |
| `src/app/ui/position-fields/` | 期初／期末部位（同一元件，靠 input 區分） | 12 |
| `src/app/ui/cash-flow-table/` | 資金進出表格：拖曳、複製、刪除、新增 | 13 |
| `src/app/ui/yaml-panel/` | YAML 編輯區、套用、捨棄、格式說明 | 14 |
| `src/app/ui/results-panel/` | 五項結果、註記、錯誤列表 | 15 |
| `src/app/ui/action-bar/` | 載入範例／清除全部／計算，含 inline 確認 | 16 |

---

### Task 1: 專案骨架與依賴

**Files:**
- Create: 整個 Angular workspace（`package.json`、`angular.json`、`tsconfig*.json`、`src/**`）
- Modify: `.gitignore`（**附加**，不可覆寫）
- Test: `src/app/app.spec.ts`

**Interfaces:**
- Consumes: 無（第一個 task）
- Produces: 可建置、可測試的 Angular workspace。後續所有 task 依賴 `npm test` 與 `npm run build` 可執行。

**背景：** 專案根目錄非空（已有 `.git/`、`docs/`、`.gitignore`）。`ng new` 會拒絕寫入，而 `--force` 會**覆蓋掉現有那份 16KB 的 `.gitignore`**。因此必須先 scaffold 到暫存目錄再搬入。

- [ ] **Step 1: Scaffold 到暫存目錄**

```bash
TMP=$(mktemp -d)
npx --yes @angular/cli@22.1.6 new xirr-app \
  --directory="$TMP" \
  --style=css \
  --test-runner=vitest \
  --zoneless \
  --ssr=false \
  --routing=false \
  --ai-config=claude-code \
  --skip-install \
  --skip-git \
  --defaults
echo "$TMP"
```

- [ ] **Step 2: 搬入專案根目錄，保留既有 `.gitignore`**

`$TMP` 用上一步輸出的路徑。Angular 產生的 `.gitignore` 不要覆蓋既有那份，改為附加其中缺少的項目。

```bash
cd /Users/xanxus/xirr-app
# 先把 Angular 的 .gitignore 挪開，避免被一起複製
mv "$TMP/.gitignore" "$TMP/.gitignore.angular"
# 複製其餘所有檔案（含 dotfiles）
cp -R "$TMP"/. .
# 將 Angular 需要而現有 .gitignore 缺少的項目附加到尾端
{
  echo ""
  echo "# Angular"
  echo "/dist"
  echo "/.angular/cache"
  echo "/node_modules"
} >> .gitignore
rm -f .gitignore.angular
rm -rf "$TMP"
```

- [ ] **Step 3: 把 Angular 版本鎖成精確版號並加上 `engines`**

編輯 `package.json`。`ng new` 產生的是 `^22.1.0` 這種範圍，實測會把 `@angular/build` / `@angular/cli` 解析成 22.1.8 而非 22.1.6。改成完全精確：

```json
{
  "name": "xirr-app",
  "version": "0.0.0",
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test"
  },
  "private": true,
  "engines": {
    "node": "^22.22.3 || ^24.15.0 || >=26.0.0"
  },
  "dependencies": {
    "@angular/cdk": "22.1.6",
    "@angular/common": "22.1.6",
    "@angular/compiler": "22.1.6",
    "@angular/core": "22.1.6",
    "@angular/forms": "22.1.6",
    "@angular/platform-browser": "22.1.6",
    "js-yaml": "5.4.1",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular/build": "22.1.6",
    "@angular/cli": "22.1.6",
    "@angular/compiler-cli": "22.1.6",
    "jsdom": "^28.0.0",
    "prettier": "^3.8.1",
    "typescript": "~6.0.2",
    "vitest": "^4.0.8"
  }
}
```

注意：`@angular/router` 已從 dependencies 移除（`--routing=false`，專案不使用路由）。`@angular/forms` 保留，因為 `@angular/cdk` 將其列為 peer dependency。

- [ ] **Step 4: 安裝依賴**

```bash
npm install --no-audit --no-fund
```

- [ ] **Step 5: 驗證版本確實鎖住**

```bash
npm ls @angular/core @angular/cdk @angular/cli js-yaml --depth=0
```

Expected：`@angular/core@22.1.6`、`@angular/cdk@22.1.6`、`@angular/cli@22.1.6`、`js-yaml@5.4.1`，**不可出現 22.1.8**。

- [ ] **Step 6: 替換 app shell 的樣板內容**

`ng new` 產生的 `src/app/app.html` 是 20KB 的歡迎頁。整份替換成：

```html
<main class="page">
  <h1>XIRR 投資年化報酬率計算機</h1>
</main>
```

`src/app/app.ts` 整份替換成：

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
```

- [ ] **Step 7: 改寫 app.spec.ts**

`ng new` 產生的測試會斷言 `Hello, xirr-app`，已不適用。整份替換成：

```ts
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('渲染標題', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('XIRR 投資年化報酬率計算機');
  });
});
```

- [ ] **Step 8: 執行測試**

```bash
npm test -- --watch=false
```

Expected: `Test Files 1 passed (1)`、`Tests 1 passed (1)`

- [ ] **Step 9: 執行建置**

```bash
npm run build
```

Expected: `Application bundle generation complete.`，無錯誤。

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Angular 22.1.6 workspace with pinned versions"
```

---

### Task 2: 共用型別與日期工具

**Files:**
- Create: `src/app/core/model/types.ts`
- Create: `src/app/core/date.ts`
- Test: `src/app/core/date.spec.ts`

**Interfaces:**
- Consumes: 無
- Produces:
  - 型別：`CashFlowRow`、`PositionInput`、`CalculatorForm`、`ResolvedPosition`、`ResolvedRow`、`ResolvedForm`、`CashFlow`、`IssueCode`、`NoteCode`、`IssueTarget`、`ValidationIssue`、`Note`、`Metrics`、`Outcome`
  - `toEpochDay(date: string): number`
  - `isValidDateString(date: string): boolean`

- [ ] **Step 1: 建立型別檔**

`src/app/core/model/types.ts`（**無 import、無邏輯**）：

```ts
/** 使用者輸入層：允許半填狀態 */
export interface CashFlowRow {
  /** 穩定識別碼，給 @for track 與 cdkDrag 用。不可用陣列索引取代 */
  id: string;
  /** 'YYYY-MM-DD'，未填為 '' */
  date: string;
  /** 未填為 null。null 與 0 意義不同：0 是合法金額 */
  amount: number | null;
}

export interface PositionInput {
  date: string;
  amount: number | null;
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
```

- [ ] **Step 2: 寫失敗的測試**

`src/app/core/date.spec.ts`：

```ts
import { isValidDateString, toEpochDay } from './date';

describe('toEpochDay', () => {
  it('紀元日為 0', () => {
    expect(toEpochDay('1970-01-01')).toBe(0);
  });

  it('不受本地時區影響', () => {
    expect(toEpochDay('2024-01-01')).toBe(19723);
  });

  it('相差整年為 365 或 366 天', () => {
    expect(toEpochDay('2024-12-31') - toEpochDay('2024-01-01')).toBe(365);
    expect(toEpochDay('2025-01-01') - toEpochDay('2024-01-01')).toBe(366);
  });
});

describe('isValidDateString', () => {
  it('接受合法日期', () => {
    expect(isValidDateString('2024-01-01')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
  });

  it('拒絕空字串與格式錯誤', () => {
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString('2024-1-1')).toBe(false);
    expect(isValidDateString('2024/01/01')).toBe(false);
  });

  it('拒絕不存在的日期', () => {
    expect(isValidDateString('2025-02-29')).toBe(false);
    expect(isValidDateString('2024-13-01')).toBe(false);
    expect(isValidDateString('2024-04-31')).toBe(false);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

```bash
npm test -- --include src/app/core/date.spec.ts --watch=false
```

Expected: FAIL，錯誤訊息指出找不到模組 `./date`

- [ ] **Step 4: 寫最小實作**

`src/app/core/date.ts`：

```ts
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** 'YYYY-MM-DD' → 距 1970-01-01 的天數。一律走 UTC，不碰本地時區 */
export function toEpochDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** 格式須為 'YYYY-MM-DD'，且該日期真實存在（擋掉 2025-02-29、2024-04-31） */
export function isValidDateString(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d
  );
}
```

- [ ] **Step 5: 執行測試確認通過**

```bash
npm test -- --include src/app/core/date.spec.ts --watch=false
```

Expected: `Tests 6 passed (6)`

- [ ] **Step 6: Commit**

```bash
git add src/app/core/model/types.ts src/app/core/date.ts src/app/core/date.spec.ts
git commit -m "feat: add shared types and timezone-safe date helpers"
```

---

### Task 3: NPV 與其導數

**Files:**
- Create: `src/app/core/xirr/npv.ts`
- Test: `src/app/core/xirr/npv.spec.ts`

**Interfaces:**
- Consumes: `CashFlow`（Task 2）、`toEpochDay`（Task 2）
- Produces:
  - `npv(cfs: readonly CashFlow[], rate: number): number`
  - `npvDerivative(cfs: readonly CashFlow[], rate: number): number`

公式（`t_i` 以第一筆現金流的日期為基準，分母固定 365）：

```
NPV(r)  = Σ  cf_i / (1 + r)^t_i
NPV'(r) = Σ  -t_i * cf_i / (1 + r)^(t_i + 1)
```

- [ ] **Step 1: 寫失敗的測試**

`src/app/core/xirr/npv.spec.ts`：

```ts
import type { CashFlow } from '../model/types';
import { toEpochDay } from '../date';
import { npv, npvDerivative } from './npv';

const cf = (date: string, amount: number): CashFlow => ({
  epochDay: toEpochDay(date),
  amount,
});

describe('npv', () => {
  it('r = 0 時等於單純加總', () => {
    const cfs = [cf('2024-01-01', -1000), cf('2024-12-31', 1100)];
    expect(npv(cfs, 0)).toBeCloseTo(100, 9);
  });

  it('在真實報酬率處為零：一年 10%', () => {
    const cfs = [cf('2024-01-01', -1000), cf('2024-12-31', 1100)];
    expect(npv(cfs, 0.1)).toBeCloseTo(0, 9);
  });

  it('第一筆現金流不被折現', () => {
    const cfs = [cf('2024-01-01', -500)];
    expect(npv(cfs, 0.5)).toBeCloseTo(-500, 9);
  });

  it('隨 r 遞減（現金流為先付後收時）', () => {
    const cfs = [cf('2024-01-01', -1000), cf('2024-12-31', 1100)];
    expect(npv(cfs, 0.2)).toBeLessThan(npv(cfs, 0.1));
  });
});

describe('npvDerivative', () => {
  it('與數值微分一致', () => {
    const cfs = [
      cf('2024-01-01', -100000),
      cf('2024-03-15', -50000),
      cf('2024-08-20', 30000),
      cf('2025-01-01', 145000),
    ];
    const r = 0.15;
    const h = 1e-6;
    const numeric = (npv(cfs, r + h) - npv(cfs, r - h)) / (2 * h);
    // 導數量級約 -2e5，用絕對誤差比對會受中央差分的抵消誤差影響，改比相對值
    expect(npvDerivative(cfs, r) / numeric).toBeCloseTo(1, 6);
  });

  it('第一筆現金流對導數無貢獻（t = 0）', () => {
    const cfs = [cf('2024-01-01', -500)];
    expect(npvDerivative(cfs, 0.3)).toBeCloseTo(0, 12);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/core/xirr/npv.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./npv`

- [ ] **Step 3: 寫最小實作**

`src/app/core/xirr/npv.ts`：

```ts
import type { CashFlow } from '../model/types';

const DAYS_PER_YEAR = 365;

function yearsFromStart(cfs: readonly CashFlow[], index: number): number {
  return (cfs[index].epochDay - cfs[0].epochDay) / DAYS_PER_YEAR;
}

export function npv(cfs: readonly CashFlow[], rate: number): number {
  let total = 0;
  for (let i = 0; i < cfs.length; i++) {
    total += cfs[i].amount / Math.pow(1 + rate, yearsFromStart(cfs, i));
  }
  return total;
}

export function npvDerivative(cfs: readonly CashFlow[], rate: number): number {
  let total = 0;
  for (let i = 0; i < cfs.length; i++) {
    const t = yearsFromStart(cfs, i);
    total -= (t * cfs[i].amount) / Math.pow(1 + rate, t + 1);
  }
  return total;
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test -- --include src/app/core/xirr/npv.spec.ts --watch=false
```

Expected: `Tests 6 passed (6)`

- [ ] **Step 5: Commit**

```bash
git add src/app/core/xirr/npv.ts src/app/core/xirr/npv.spec.ts
git commit -m "feat: add NPV and its derivative"
```

---

### Task 4: Solver（Newton-Raphson + bisection）

**Files:**
- Create: `src/app/core/xirr/solver.ts`
- Test: `src/app/core/xirr/solver.spec.ts`

**Interfaces:**
- Consumes: `CashFlow`（Task 2）、`npv` / `npvDerivative`（Task 3）
- Produces:
  - `type SolveResult = { status: 'OK'; rate: number } | { status: 'NO_SOLUTION' }`
  - `solveXirr(cfs: readonly CashFlow[]): SolveResult`
  - `countSignChanges(cfs: readonly CashFlow[]): number`

**演算法要求（不可簡化）：**

1. Newton 從 `r = 0.1` 起步，最多 100 次迭代。遇 `r <= -1`、`|NPV'|` 接近 0、或出現 `NaN`/`Infinity` 時**立即放棄並轉交 bisection**。
2. 收斂判準用**相對**誤差 `|NPV| < 1e-9 * max|cf_i|`，不可用絕對誤差（本金一萬與一億的量級差異會讓絕對閾值失效）。
3. Bisection 左端固定 `-0.9999`；**右端從 1.0 開始倍增直到 NPV 變號**，終止條件為倍增 1000 次或 `hi` 非有限值。
4. **右端不可使用固定上限。** spec §7 記載：初版用固定上限 `1e7`，導致「一天翻倍」（真解 `2^365 - 1 ≈ 7.5153e109`）被誤報為無解。

- [ ] **Step 1: 寫失敗的測試**

`src/app/core/xirr/solver.spec.ts`：

```ts
import type { CashFlow } from '../model/types';
import { toEpochDay } from '../date';
import { countSignChanges, solveXirr } from './solver';

const cf = (date: string, amount: number): CashFlow => ({
  epochDay: toEpochDay(date),
  amount,
});

const rateOf = (cfs: CashFlow[]): number => {
  const r = solveXirr(cfs);
  if (r.status !== 'OK') throw new Error(`expected OK, got ${r.status}`);
  return r.rate;
};

describe('solveXirr — 黃金值', () => {
  it('[A] 一年 10%（解析解，可手算驗證）', () => {
    expect(rateOf([cf('2024-01-01', -1000), cf('2024-12-31', 1100)])).toBeCloseTo(0.1, 9);
  });

  it('[B] 範例資料 → 19.353321%', () => {
    const cfs = [
      cf('2024-01-01', -100000),
      cf('2024-03-15', -50000),
      cf('2024-08-20', 30000),
      cf('2025-01-01', 145000),
    ];
    expect(rateOf(cfs) * 100).toBeCloseTo(19.353321, 5);
  });

  it('[C] 符號變換 3 次 → 29.650138%', () => {
    const cfs = [
      cf('2024-01-01', -100000),
      cf('2024-04-01', 120000),
      cf('2024-07-01', -80000),
      cf('2025-01-01', 75000),
    ];
    expect(rateOf(cfs) * 100).toBeCloseTo(29.650138, 5);
  });

  it('[E] 一天翻倍 → 2^365 - 1，固定上限會誤報無解', () => {
    const rate = rateOf([cf('2024-01-01', -100), cf('2024-01-02', 200)]);
    expect(rate).toBeGreaterThan(1e109);
    expect(rate / (Math.pow(2, 365) - 1)).toBeCloseTo(1, 6);
  });

  it('[F] 一天 +1% → 約 3678.343%', () => {
    const rate = rateOf([cf('2024-01-01', -100), cf('2024-01-02', 101)]);
    expect(rate * 100).toBeCloseTo(3678.343, 2);
  });
});

describe('solveXirr — 無解', () => {
  it('[D] 全部 <= 0（只有投入、期末歸零）', () => {
    expect(solveXirr([cf('2024-01-01', -100000), cf('2025-01-01', 0)]).status)
      .toBe('NO_SOLUTION');
  });

  it('[G] 全部 >= 0（沒投入過卻一直提款）', () => {
    const cfs = [cf('2024-01-01', 0), cf('2024-06-01', 5000), cf('2025-01-01', 0)];
    expect(solveXirr(cfs).status).toBe('NO_SOLUTION');
  });
});

describe('solveXirr — 性質測試：反解往返', () => {
  const dates = ['2020-03-11', '2021-07-02', '2022-01-19', '2023-11-30', '2024-05-05'];

  for (const target of [-0.55, -0.1, 0.0001, 0.07, 0.42, 1.8, 6.5]) {
    it(`能解回 r = ${target}`, () => {
      // 先給前幾筆投入，再用「在 target 折現率下使 NPV 恰為 0」的金額當最後一筆
      const outflows: CashFlow[] = dates
        .slice(0, dates.length - 1)
        .map((d, i) => cf(d, -1000 * (i + 1)));
      const last = dates[dates.length - 1];
      const d0 = outflows[0].epochDay;
      const tLast = (toEpochDay(last) - d0) / 365;
      let pv = 0;
      for (const o of outflows) {
        pv += o.amount / Math.pow(1 + target, (o.epochDay - d0) / 365);
      }
      const closing = -pv * Math.pow(1 + target, tLast);
      expect(rateOf([...outflows, cf(last, closing)])).toBeCloseTo(target, 7);
    });
  }
});

describe('countSignChanges', () => {
  it('先付後收只變換一次', () => {
    expect(countSignChanges([cf('2024-01-01', -100), cf('2024-12-31', 110)])).toBe(1);
  });

  it('來回進出變換三次', () => {
    const cfs = [
      cf('2024-01-01', -100000),
      cf('2024-04-01', 120000),
      cf('2024-07-01', -80000),
      cf('2025-01-01', 75000),
    ];
    expect(countSignChanges(cfs)).toBe(3);
  });

  it('忽略金額為 0 的項目', () => {
    const cfs = [cf('2024-01-01', -100), cf('2024-06-01', 0), cf('2024-12-31', 110)];
    expect(countSignChanges(cfs)).toBe(1);
  });

  it('全部同號為 0 次', () => {
    expect(countSignChanges([cf('2024-01-01', -100), cf('2024-12-31', -50)])).toBe(0);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/core/xirr/solver.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./solver`

- [ ] **Step 3: 寫實作**

`src/app/core/xirr/solver.ts`：

```ts
import type { CashFlow } from '../model/types';
import { npv, npvDerivative } from './npv';

export type SolveResult = { status: 'OK'; rate: number } | { status: 'NO_SOLUTION' };

const NEWTON_START = 0.1;
const NEWTON_MAX_ITERATIONS = 100;
const RELATIVE_TOLERANCE = 1e-9;
const LOWER_BOUND = -0.9999;
const MAX_DOUBLINGS = 1000;
const BISECTION_ITERATIONS = 300;

function scaleOf(cfs: readonly CashFlow[]): number {
  let max = 0;
  for (const c of cfs) max = Math.max(max, Math.abs(c.amount));
  return max === 0 ? 1 : max;
}

/** 笛卡兒符號法則所用的符號變換次數。根的數量上限等於此值。金額為 0 者略過 */
export function countSignChanges(cfs: readonly CashFlow[]): number {
  let changes = 0;
  let previous = 0;
  for (const c of cfs) {
    const sign = Math.sign(c.amount);
    if (sign === 0) continue;
    if (previous !== 0 && sign !== previous) changes++;
    previous = sign;
  }
  return changes;
}

function newton(cfs: readonly CashFlow[], tolerance: number): number | null {
  let rate = NEWTON_START;
  for (let i = 0; i < NEWTON_MAX_ITERATIONS; i++) {
    const value = npv(cfs, rate);
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value) < tolerance) return rate;

    const slope = npvDerivative(cfs, rate);
    if (!Number.isFinite(slope) || Math.abs(slope) < 1e-12) return null;

    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -1) return null;
    if (Math.abs(next - rate) < 1e-14) return next;
    rate = next;
  }
  return null;
}

/**
 * 右端從 1.0 開始倍增直到 NPV 變號。
 * 不可改回固定上限：「一天翻倍」的真解是 2^365 - 1 ~ 7.5e109，
 * 任何合理的固定上限都會讓它被誤報為無解（見 spec §7）。
 */
function bisection(cfs: readonly CashFlow[]): number | null {
  const low = LOWER_BOUND;
  const valueAtLow = npv(cfs, low);
  if (!Number.isFinite(valueAtLow)) return null;

  let high = 1;
  let valueAtHigh = npv(cfs, high);
  let doublings = 0;
  while (valueAtLow * valueAtHigh > 0) {
    high *= 2;
    doublings++;
    if (doublings > MAX_DOUBLINGS || !Number.isFinite(high)) return null;
    valueAtHigh = npv(cfs, high);
    if (!Number.isFinite(valueAtHigh)) return null;
  }

  let lo = low;
  let hi = high;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (npv(cfs, lo) * npv(cfs, mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function solveXirr(cfs: readonly CashFlow[]): SolveResult {
  if (cfs.length < 2) return { status: 'NO_SOLUTION' };

  const tolerance = RELATIVE_TOLERANCE * scaleOf(cfs);
  const fromNewton = newton(cfs, tolerance);
  if (fromNewton !== null) return { status: 'OK', rate: fromNewton };

  const fromBisection = bisection(cfs);
  if (fromBisection !== null) return { status: 'OK', rate: fromBisection };

  return { status: 'NO_SOLUTION' };
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test -- --include src/app/core/xirr/solver.spec.ts --watch=false
```

Expected: `Tests 18 passed (18)`

若 [E] 失敗且訊息為 `expected OK, got NO_SOLUTION`，代表 bisection 的右端用了固定上限——回頭檢查 `bisection()` 的倍增迴圈。

- [ ] **Step 5: Commit**

```bash
git add src/app/core/xirr/solver.ts src/app/core/xirr/solver.spec.ts
git commit -m "feat: add XIRR solver with Newton-Raphson and bisection fallback"
```

---

### Task 5: 彙總數字

**Files:**
- Create: `src/app/core/xirr/metrics.ts`
- Test: `src/app/core/xirr/metrics.spec.ts`

**Interfaces:**
- Consumes: `ResolvedForm`、`Metrics`（Task 2）
- Produces: `computeMetrics(form: ResolvedForm, xirr: number): Metrics`

**關鍵要求：** 用 **UI 符號**（正數 = 投入）直接從 `ResolvedForm` 計算，**不可**從已翻好符號的 `CashFlow[]` 反推。反推等於「翻成負的再翻回來」，是未來符號錯誤的溫床。

```
totalInvested   = initial.amount + Σ max(row.amount, 0)
totalWithdrawn  = Σ max(-row.amount, 0)
currentPosition = final.amount
totalReturn     = currentPosition + totalWithdrawn - totalInvested
```

期末部位視為未實現，**不計入 totalWithdrawn**。

- [ ] **Step 1: 寫失敗的測試**

`src/app/core/xirr/metrics.spec.ts`：

```ts
import type { ResolvedForm } from '../model/types';
import { computeMetrics } from './metrics';

const form = (
  initialAmount: number,
  rowAmounts: number[],
  finalAmount: number,
): ResolvedForm => ({
  initial: { date: '2024-01-01', amount: initialAmount },
  rows: rowAmounts.map((amount, i) => ({
    id: `r${i}`,
    date: `2024-0${i + 2}-01`,
    amount,
  })),
  final: { date: '2025-01-01', amount: finalAmount },
});

describe('computeMetrics', () => {
  it('範例資料的四個數字', () => {
    const m = computeMetrics(form(100000, [50000, -30000], 145000), 0.19353321);
    expect(m.totalInvested).toBe(150000);
    expect(m.totalWithdrawn).toBe(30000);
    expect(m.currentPosition).toBe(145000);
    expect(m.totalReturn).toBe(25000);
    expect(m.xirr).toBeCloseTo(0.19353321, 9);
  });

  it('期末部位不計入總匯出', () => {
    const m = computeMetrics(form(100000, [], 145000), 0.45);
    expect(m.totalWithdrawn).toBe(0);
    expect(m.currentPosition).toBe(145000);
  });

  it('期初部位為 0 時只算資金進出', () => {
    const m = computeMetrics(form(0, [10000, 20000], 35000), 0.2);
    expect(m.totalInvested).toBe(30000);
    expect(m.totalReturn).toBe(5000);
  });

  it('金額為 0 的列兩邊都不計', () => {
    const m = computeMetrics(form(1000, [0], 1000), 0);
    expect(m.totalInvested).toBe(1000);
    expect(m.totalWithdrawn).toBe(0);
  });

  it('總報酬可為負', () => {
    const m = computeMetrics(form(100000, [], 60000), -0.4);
    expect(m.totalReturn).toBe(-40000);
  });

  it('性質：總報酬 === 當前總部位 + 總匯出 - 總投入', () => {
    const cases: Array<[number, number[], number]> = [
      [100000, [50000, -30000], 145000],
      [0, [1000, 2000, -500], 3200],
      [5000, [], 0],
      [250, [-100, -100, 400], 480],
      [1_000_000, [-999_999], 1],
    ];
    for (const [initial, rows, final] of cases) {
      const m = computeMetrics(form(initial, rows, final), 0.1);
      expect(m.totalReturn).toBeCloseTo(
        m.currentPosition + m.totalWithdrawn - m.totalInvested,
        9,
      );
    }
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/core/xirr/metrics.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./metrics`

- [ ] **Step 3: 寫最小實作**

`src/app/core/xirr/metrics.ts`：

```ts
import type { Metrics, ResolvedForm } from '../model/types';

/**
 * 一律使用 UI 符號（正數 = 投入）直接從輸入計算。
 * 不可從已翻好符號的 CashFlow[] 反推——那會變成翻兩次，容易出錯。
 */
export function computeMetrics(form: ResolvedForm, xirr: number): Metrics {
  let totalInvested = form.initial.amount;
  let totalWithdrawn = 0;

  for (const row of form.rows) {
    if (row.amount > 0) totalInvested += row.amount;
    else if (row.amount < 0) totalWithdrawn += -row.amount;
  }

  // 期末部位視為未實現，不計入 totalWithdrawn
  const currentPosition = form.final.amount;
  const totalReturn = currentPosition + totalWithdrawn - totalInvested;

  return { totalInvested, totalWithdrawn, currentPosition, totalReturn, xirr };
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test -- --include src/app/core/xirr/metrics.spec.ts --watch=false
```

Expected: `Tests 6 passed (6)`

- [ ] **Step 5: Commit**

```bash
git add src/app/core/xirr/metrics.ts src/app/core/xirr/metrics.spec.ts
git commit -m "feat: add summary metrics with UI sign convention"
```

---

### Task 6: 驗證與符號翻轉

**Files:**
- Create: `src/app/core/xirr/validate.ts`
- Test: `src/app/core/xirr/validate.spec.ts`

**Interfaces:**
- Consumes: `CalculatorForm`、`ResolvedForm`、`ValidationIssue`、`CashFlow`（Task 2）、`isValidDateString` / `toEpochDay`（Task 2）
- Produces:
  - `validateRequired(form: CalculatorForm): ValidationIssue[]`
  - `resolveForm(form: CalculatorForm): ResolvedForm`（**呼叫前必須先確認 `validateRequired` 回傳空陣列**）
  - `validateRanges(form: ResolvedForm): ValidationIssue[]`
  - `toCashFlows(form: ResolvedForm): CashFlow[]`

**符號翻轉規則**（UI → XIRR）：期初部位 `-amount`、每筆進出 `-amount`、期末部位 `+amount`。

- [ ] **Step 1: 寫失敗的測試**

`src/app/core/xirr/validate.spec.ts`：

```ts
import type { CalculatorForm, ResolvedForm } from '../model/types';
import { toEpochDay } from '../date';
import { resolveForm, toCashFlows, validateRanges, validateRequired } from './validate';

const baseForm = (): CalculatorForm => ({
  initial: { date: '2024-01-01', amount: 100000 },
  rows: [
    { id: 'a', date: '2024-03-15', amount: 50000 },
    { id: 'b', date: '2024-08-20', amount: -30000 },
  ],
  final: { date: '2025-01-01', amount: 145000 },
});

describe('validateRequired', () => {
  it('完整表單無錯誤', () => {
    expect(validateRequired(baseForm())).toEqual([]);
  });

  it('期初日期空白', () => {
    const f = baseForm();
    f.initial.date = '';
    const issues = validateRequired(f);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('MISSING_DATE');
    expect(issues[0].target).toEqual({ kind: 'initial', field: 'date' });
  });

  it('期末金額空白', () => {
    const f = baseForm();
    f.final.amount = null;
    const issues = validateRequired(f);
    expect(issues[0].code).toBe('MISSING_AMOUNT');
    expect(issues[0].target).toEqual({ kind: 'final', field: 'amount' });
  });

  it('金額為 0 是合法的，不算空白', () => {
    const f = baseForm();
    f.final.amount = 0;
    f.initial.amount = 0;
    expect(validateRequired(f)).toEqual([]);
  });

  it('列的錯誤帶得出 rowId', () => {
    const f = baseForm();
    f.rows[1].date = '';
    const issues = validateRequired(f);
    expect(issues[0].target).toEqual({ kind: 'row', rowId: 'b', field: 'date' });
  });

  it('日期格式非法也算 MISSING_DATE', () => {
    const f = baseForm();
    f.rows[0].date = '2025-02-29';
    expect(validateRequired(f)[0].code).toBe('MISSING_DATE');
  });

  it('回報全部錯誤而非只回第一個', () => {
    const f = baseForm();
    f.initial.date = '';
    f.final.amount = null;
    f.rows[0].amount = null;
    expect(validateRequired(f)).toHaveLength(3);
  });
});

describe('resolveForm', () => {
  it('把 amount 收斂成 number', () => {
    const r = resolveForm(baseForm());
    expect(r.initial.amount).toBe(100000);
    expect(r.rows.map((x) => x.amount)).toEqual([50000, -30000]);
    expect(r.final.amount).toBe(145000);
  });
});

describe('validateRanges', () => {
  const resolved = (): ResolvedForm => resolveForm(baseForm());

  it('合法區間無錯誤', () => {
    expect(validateRanges(resolved())).toEqual([]);
  });

  it('期初晚於期末', () => {
    const f = resolved();
    f.initial.date = '2025-06-01';
    const issues = validateRanges(f);
    expect(issues[0].code).toBe('DATE_ORDER');
    expect(issues[0].target).toEqual({ kind: 'initial', field: 'date' });
  });

  it('期初等於期末也擋', () => {
    const f = resolved();
    f.final.date = f.initial.date;
    expect(validateRanges(f)[0].code).toBe('DATE_ORDER');
  });

  it('進出日期早於期初', () => {
    const f = resolved();
    f.rows[0].date = '2023-12-31';
    const issues = validateRanges(f);
    expect(issues[0].code).toBe('DATE_OUT_OF_RANGE');
    expect(issues[0].target).toEqual({ kind: 'row', rowId: 'a', field: 'date' });
  });

  it('進出日期晚於期末', () => {
    const f = resolved();
    f.rows[1].date = '2025-02-01';
    expect(validateRanges(f)[0].code).toBe('DATE_OUT_OF_RANGE');
  });

  it('進出日期等於邊界是合法的', () => {
    const f = resolved();
    f.rows[0].date = '2024-01-01';
    f.rows[1].date = '2025-01-01';
    expect(validateRanges(f)).toEqual([]);
  });
});

describe('toCashFlows', () => {
  it('翻成 XIRR 符號慣例', () => {
    const cfs = toCashFlows(resolveForm(baseForm()));
    expect(cfs.map((c) => c.amount)).toEqual([-100000, -50000, 30000, 145000]);
  });

  it('日期轉成 epochDay 且順序保持輸入順序', () => {
    const cfs = toCashFlows(resolveForm(baseForm()));
    expect(cfs.map((c) => c.epochDay)).toEqual([
      toEpochDay('2024-01-01'),
      toEpochDay('2024-03-15'),
      toEpochDay('2024-08-20'),
      toEpochDay('2025-01-01'),
    ]);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/core/xirr/validate.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./validate`

- [ ] **Step 3: 寫實作**

`src/app/core/xirr/validate.ts`：

```ts
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
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test -- --include src/app/core/xirr/validate.spec.ts --watch=false
```

Expected: `Tests 16 passed (16)`

- [ ] **Step 5: Commit**

```bash
git add src/app/core/xirr/validate.ts src/app/core/xirr/validate.spec.ts
git commit -m "feat: add validation and UI-to-XIRR sign conversion"
```

---

### Task 7: 計算管線編排

**Files:**
- Create: `src/app/core/xirr/calculate.ts`
- Test: `src/app/core/xirr/calculate.spec.ts`

**Interfaces:**
- Consumes: 全部 core 模組（Task 2–6）
- Produces:
  - `interface CalculationRun { outcome: Outcome; sortedRows: CashFlowRow[] | null; sorted: boolean }`
  - `runCalculation(form: CalculatorForm): CalculationRun`

**執行順序不可調換**（spec §6）：

1. **必填檢查** → 有錯即停，**不排序**，`sortedRows` 回 `null`
2. **依日期升冪排序** rows（穩定排序，同日期維持原順序）
3. **其餘驗證**：期初 ≥ 期末、進出日期超出區間
4. **符號判定與求解**

符號判定的三個分支（順序重要）：

| 條件 | 結果 |
|---|---|
| 沒有任何負值現金流（= 沒投入過錢） | 阻擋，`NO_INVESTMENT` |
| 沒有任何正值現金流（= 本金全損） | `xirr = -1`，附 `TOTAL_LOSS` 註記 |
| 兩者皆有 | 呼叫 `solveXirr`；若仍回 `NO_SOLUTION` 則阻擋，`UNSOLVABLE` |

全部金額皆為 0 時落在第一個分支（`NO_INVESTMENT`），這是正確的。

註記產生規則：

| 註記 | 條件 |
|---|---|
| `SORTED` | 步驟 2 實際改動了列順序 |
| `TOTAL_LOSS` | 走到全損分支 |
| `MULTIPLE_ROOTS` | `countSignChanges(cfs) >= 2` |
| `EXTREME_RATE` | `rate < -0.99` 或 `rate > 10` |

- [ ] **Step 1: 寫失敗的測試**

`src/app/core/xirr/calculate.spec.ts`：

```ts
import type { CalculatorForm, NoteCode } from '../model/types';
import { runCalculation } from './calculate';

const form = (over: Partial<CalculatorForm> = {}): CalculatorForm => ({
  initial: { date: '2024-01-01', amount: 100000 },
  rows: [
    { id: 'a', date: '2024-03-15', amount: 50000 },
    { id: 'b', date: '2024-08-20', amount: -30000 },
  ],
  final: { date: '2025-01-01', amount: 145000 },
  ...over,
});

const noteCodes = (run: ReturnType<typeof runCalculation>): NoteCode[] =>
  run.outcome.ok ? run.outcome.notes.map((n) => n.code) : [];

describe('runCalculation — 正常路徑', () => {
  it('回傳五項數字與正確的 XIRR', () => {
    const run = runCalculation(form());
    expect(run.outcome.ok).toBe(true);
    if (!run.outcome.ok) return;
    expect(run.outcome.metrics.xirr * 100).toBeCloseTo(19.353321, 5);
    expect(run.outcome.metrics.totalInvested).toBe(150000);
    expect(run.outcome.metrics.totalWithdrawn).toBe(30000);
    expect(run.outcome.metrics.currentPosition).toBe(145000);
    expect(run.outcome.metrics.totalReturn).toBe(25000);
  });

  it('順序已正確時不附 SORTED 註記', () => {
    expect(noteCodes(runCalculation(form()))).not.toContain('SORTED');
    expect(runCalculation(form()).sorted).toBe(false);
  });
});

describe('runCalculation — 排序', () => {
  it('日期倒置時排序並附 SORTED 註記', () => {
    const run = runCalculation(
      form({
        rows: [
          { id: 'b', date: '2024-08-20', amount: -30000 },
          { id: 'a', date: '2024-03-15', amount: 50000 },
        ],
      }),
    );
    expect(run.sorted).toBe(true);
    expect(run.sortedRows?.map((r) => r.id)).toEqual(['a', 'b']);
    expect(noteCodes(run)).toContain('SORTED');
    if (run.outcome.ok) expect(run.outcome.metrics.xirr * 100).toBeCloseTo(19.353321, 5);
  });

  it('同日期維持原順序（穩定排序）', () => {
    const run = runCalculation(
      form({
        rows: [
          { id: 'x', date: '2024-05-01', amount: 100 },
          { id: 'y', date: '2024-05-01', amount: 200 },
        ],
      }),
    );
    expect(run.sortedRows?.map((r) => r.id)).toEqual(['x', 'y']);
    expect(run.sorted).toBe(false);
  });

  it('必填檢查失敗時不排序', () => {
    const run = runCalculation(
      form({
        rows: [
          { id: 'b', date: '2024-08-20', amount: -30000 },
          { id: 'a', date: '', amount: 50000 },
        ],
      }),
    );
    expect(run.sortedRows).toBeNull();
    expect(run.sorted).toBe(false);
    expect(run.outcome.ok).toBe(false);
  });
});

describe('runCalculation — 阻擋型錯誤', () => {
  it('期初晚於期末', () => {
    const run = runCalculation(form({ final: { date: '2023-01-01', amount: 145000 } }));
    expect(run.outcome.ok).toBe(false);
    if (run.outcome.ok) return;
    expect(run.outcome.errors[0].code).toBe('DATE_ORDER');
  });

  it('[G] 只有匯出、沒有投入 → NO_INVESTMENT', () => {
    const run = runCalculation(
      form({
        initial: { date: '2024-01-01', amount: 0 },
        rows: [{ id: 'a', date: '2024-06-01', amount: -5000 }],
        final: { date: '2025-01-01', amount: 0 },
      }),
    );
    expect(run.outcome.ok).toBe(false);
    if (run.outcome.ok) return;
    expect(run.outcome.errors[0].code).toBe('NO_INVESTMENT');
  });

  it('全部金額為 0 → NO_INVESTMENT', () => {
    const run = runCalculation(
      form({
        initial: { date: '2024-01-01', amount: 0 },
        rows: [],
        final: { date: '2025-01-01', amount: 0 },
      }),
    );
    expect(run.outcome.ok).toBe(false);
    if (run.outcome.ok) return;
    expect(run.outcome.errors[0].code).toBe('NO_INVESTMENT');
  });
});

describe('runCalculation — 註記', () => {
  it('[D] 本金全損 → -100% 且附 TOTAL_LOSS，不是錯誤', () => {
    const run = runCalculation(
      form({ rows: [], final: { date: '2025-01-01', amount: 0 } }),
    );
    expect(run.outcome.ok).toBe(true);
    if (!run.outcome.ok) return;
    expect(run.outcome.metrics.xirr).toBe(-1);
    expect(noteCodes(run)).toContain('TOTAL_LOSS');
    expect(run.outcome.metrics.totalReturn).toBe(-100000);
  });

  it('[C] 符號變換 3 次 → MULTIPLE_ROOTS', () => {
    const run = runCalculation(
      form({
        rows: [
          { id: 'a', date: '2024-04-01', amount: -120000 },
          { id: 'b', date: '2024-07-01', amount: 80000 },
        ],
        final: { date: '2025-01-01', amount: 75000 },
      }),
    );
    expect(noteCodes(run)).toContain('MULTIPLE_ROOTS');
  });

  it('先付後收不附 MULTIPLE_ROOTS', () => {
    const run = runCalculation(form({ rows: [] }));
    expect(noteCodes(run)).not.toContain('MULTIPLE_ROOTS');
  });

  it('[E] 一天翻倍 → EXTREME_RATE，且不是錯誤', () => {
    const run = runCalculation(
      form({
        initial: { date: '2024-01-01', amount: 100 },
        rows: [],
        final: { date: '2024-01-02', amount: 200 },
      }),
    );
    expect(run.outcome.ok).toBe(true);
    expect(noteCodes(run)).toContain('EXTREME_RATE');
  });

  it('[F] 一天 +1% → 3678% 仍附 EXTREME_RATE（超過 1000% 門檻）', () => {
    const run = runCalculation(
      form({
        initial: { date: '2024-01-01', amount: 100 },
        rows: [],
        final: { date: '2024-01-02', amount: 101 },
      }),
    );
    expect(noteCodes(run)).toContain('EXTREME_RATE');
    if (run.outcome.ok) expect(run.outcome.metrics.xirr * 100).toBeCloseTo(3678.343, 2);
  });

  it('一般報酬率不附 EXTREME_RATE', () => {
    expect(noteCodes(runCalculation(form()))).not.toContain('EXTREME_RATE');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/core/xirr/calculate.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./calculate`

- [ ] **Step 3: 寫實作**

`src/app/core/xirr/calculate.ts`：

```ts
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

export function runCalculation(form: CalculatorForm): CalculationRun {
  // 步驟 1：必填檢查。必須在排序之前——沒有日期的列無法參與排序
  const required = validateRequired(form);
  if (required.length > 0) {
    return { outcome: { ok: false, errors: required }, sortedRows: null, sorted: false };
  }

  // 步驟 2：排序
  const { rows: sortedRows, changed: sorted } = sortByDate(form.rows);
  const ordered: CalculatorForm = { ...form, rows: sortedRows };

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
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test -- --include src/app/core/xirr/calculate.spec.ts --watch=false
```

Expected: `Tests 14 passed (14)`

- [ ] **Step 5: 全部 core 測試一起跑一次**

```bash
npm test -- --watch=false
```

Expected: 全綠。

- [ ] **Step 6: Commit**

```bash
git add src/app/core/xirr/calculate.ts src/app/core/xirr/calculate.spec.ts src/app/core/model/types.ts
git commit -m "feat: add calculation pipeline with ordered validation and notes"
```

---

### Task 8: YAML 序列化

**Files:**
- Create: `src/app/core/yaml/serialize.ts`
- Test: `src/app/core/yaml/serialize.spec.ts`

**Interfaces:**
- Consumes: `CalculatorForm`（Task 2）
- Produces: `serializeForm(form: CalculatorForm): string`

**為何手寫而不用 `yaml.dump`：** `yaml.dump` 會把日期加上引號（`date: '2024-01-01'`），並丟失所有註解與分組空行——而那些正是讓此區塊能兼作格式說明的東西。

**輸出格式**（半填狀態也必須能序列化，因為 YAML 隨時鏡射表單）：

- 日期為空字串時輸出 `date: ''`
- 金額為 `null` 時輸出 `amount:`（YAML null）
- `rows` 為空時輸出 `flows: []`
- 正負號說明放在 `flows:` 上方一行註解，不逐列重複

- [ ] **Step 1: 寫失敗的測試**

`src/app/core/yaml/serialize.spec.ts`：

```ts
import * as yaml from 'js-yaml';
import type { CalculatorForm } from '../model/types';
import { serializeForm } from './serialize';

const baseForm = (): CalculatorForm => ({
  initial: { date: '2024-01-01', amount: 100000 },
  rows: [
    { id: 'a', date: '2024-03-15', amount: 50000 },
    { id: 'b', date: '2024-08-20', amount: -30000 },
  ],
  final: { date: '2025-01-01', amount: 145000 },
});

describe('serializeForm', () => {
  it('產生預期的完整輸出', () => {
    expect(serializeForm(baseForm())).toBe(
      [
        'initial:',
        '  date: 2024-01-01',
        '  amount: 100000',
        '',
        '# 正數 = 資金投入，負數 = 資金匯出',
        'flows:',
        '  - date: 2024-03-15',
        '    amount: 50000',
        '  - date: 2024-08-20',
        '    amount: -30000',
        '',
        'final:',
        '  date: 2025-01-01',
        '  amount: 145000',
        '',
      ].join('\n'),
    );
  });

  it('日期不加引號', () => {
    expect(serializeForm(baseForm())).toContain('date: 2024-01-01');
    expect(serializeForm(baseForm())).not.toContain("'2024-01-01'");
  });

  it('保留正負號說明註解', () => {
    expect(serializeForm(baseForm())).toContain('# 正數 = 資金投入，負數 = 資金匯出');
  });

  it('沒有資金進出時輸出空陣列', () => {
    const f = baseForm();
    f.rows = [];
    expect(serializeForm(f)).toContain('flows: []');
  });

  it('空日期輸出為引號包住的空字串', () => {
    const f = baseForm();
    f.initial.date = '';
    expect(serializeForm(f)).toContain("date: ''");
  });

  it('未填金額輸出為 YAML null', () => {
    const f = baseForm();
    f.final.amount = null;
    expect(serializeForm(f)).toContain('  amount:\n');
  });

  it('輸出必為合法 YAML，且日期維持字串', () => {
    const parsed = yaml.load(serializeForm(baseForm()), { schema: yaml.CORE_SCHEMA }) as {
      initial: { date: unknown };
      flows: unknown[];
    };
    expect(typeof parsed.initial.date).toBe('string');
    expect(parsed.flows).toHaveLength(2);
  });

  it('半填表單的輸出也是合法 YAML', () => {
    const f = baseForm();
    f.initial.date = '';
    f.initial.amount = null;
    f.rows[0].amount = null;
    const parsed = yaml.load(serializeForm(f), { schema: yaml.CORE_SCHEMA }) as {
      initial: { date: string; amount: unknown };
    };
    expect(parsed.initial.date).toBe('');
    expect(parsed.initial.amount).toBeNull();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/core/yaml/serialize.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./serialize`

- [ ] **Step 3: 寫最小實作**

`src/app/core/yaml/serialize.ts`：

```ts
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
```

**注意 `.trimEnd()`：** `amount` 為 null 時若輸出 `  amount: ` 帶尾端空白，測試的完整字串比對會失敗，部分編輯器也會自動去除。

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test -- --include src/app/core/yaml/serialize.spec.ts --watch=false
```

Expected: `Tests 8 passed (8)`

- [ ] **Step 5: Commit**

```bash
git add src/app/core/yaml/serialize.ts src/app/core/yaml/serialize.spec.ts
git commit -m "feat: add hand-written YAML serializer preserving comments"
```

---

### Task 9: YAML 解析與範例資料

**Files:**
- Create: `src/app/core/yaml/parse.ts`
- Create: `src/app/core/example.ts`
- Test: `src/app/core/yaml/parse.spec.ts`

**Interfaces:**
- Consumes: `CalculatorForm`（Task 2）、`serializeForm`（Task 8，僅測試用）
- Produces:
  - `type ParseResult = { ok: true; form: CalculatorForm } | { ok: false; message: string; line: number | null }`
  - `parseForm(text: string, makeId: () => string): ParseResult`
  - `exampleForm(makeId: () => string): CalculatorForm`（`src/app/core/example.ts`）

**要求：**

- 必須以 `{ schema: yaml.CORE_SCHEMA }` 載入。js-yaml 5 的預設已是 YAML 1.2 core schema（日期維持字串），顯式指定是防止未來改版漂移的護欄。
- 語法錯誤時 `YAMLException` 帶有 `e.mark.line`（0-based），**錯誤訊息必須回報行號**（轉成 1-based）。
- 結構驗證手寫，不引入 zod。
- `makeId` 由呼叫端注入，測試才能產生可預期的 id。

- [ ] **Step 1: 寫失敗的測試**

`src/app/core/yaml/parse.spec.ts`：

```ts
import type { CalculatorForm } from '../model/types';
import { serializeForm } from './serialize';
import { parseForm } from './parse';

const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const okForm = (text: string): CalculatorForm => {
  const r = parseForm(text, ids());
  if (!r.ok) throw new Error(`expected ok, got: ${r.message}`);
  return r.form;
};

const VALID = `
initial:
  date: 2024-01-01
  amount: 100000

flows:
  - date: 2024-03-15
    amount: 50000
  - date: 2024-08-20
    amount: -30000

final:
  date: 2025-01-01
  amount: 145000
`;

describe('parseForm — 成功', () => {
  it('解析完整文件', () => {
    const form = okForm(VALID);
    expect(form.initial).toEqual({ date: '2024-01-01', amount: 100000 });
    expect(form.final).toEqual({ date: '2025-01-01', amount: 145000 });
    expect(form.rows).toEqual([
      { id: 'id-1', date: '2024-03-15', amount: 50000 },
      { id: 'id-2', date: '2024-08-20', amount: -30000 },
    ]);
  });

  it('日期維持字串，不被轉成 Date', () => {
    expect(typeof okForm(VALID).initial.date).toBe('string');
  });

  it('接受空的 flows', () => {
    const form = okForm(`
initial:
  date: 2024-01-01
  amount: 100
flows: []
final:
  date: 2025-01-01
  amount: 200
`);
    expect(form.rows).toEqual([]);
  });

  it('flows 缺席視同空陣列', () => {
    const form = okForm(`
initial:
  date: 2024-01-01
  amount: 100
final:
  date: 2025-01-01
  amount: 200
`);
    expect(form.rows).toEqual([]);
  });

  it('接受 null 金額與空日期（半填狀態）', () => {
    const form = okForm(`
initial:
  date: ''
  amount:
flows: []
final:
  date: 2025-01-01
  amount: 200
`);
    expect(form.initial).toEqual({ date: '', amount: null });
  });

  it('接受負數與小數', () => {
    const form = okForm(`
initial:
  date: 2024-01-01
  amount: 1234.56
flows:
  - date: 2024-06-01
    amount: -78.9
final:
  date: 2025-01-01
  amount: 2000
`);
    expect(form.initial.amount).toBeCloseTo(1234.56, 9);
    expect(form.rows[0].amount).toBeCloseTo(-78.9, 9);
  });
});

describe('parseForm — 失敗', () => {
  const fail = (text: string) => {
    const r = parseForm(text, ids());
    if (r.ok) throw new Error('expected failure');
    return r;
  };

  it('語法錯誤回報行號', () => {
    const r = fail('initial:\n  date: 2024-01-01\n   amount: 5\n');
    expect(r.line).toBe(3);
    expect(r.message).toContain('第 3 行');
  });

  it('空白文件', () => {
    expect(fail('   ').message).toContain('內容是空的');
  });

  it('最上層不是物件', () => {
    expect(fail('- 1\n- 2\n').message).toContain('最外層');
  });

  it('缺少 initial', () => {
    expect(fail('final:\n  date: 2025-01-01\n  amount: 1\n').message).toContain('initial');
  });

  it('缺少 final', () => {
    expect(fail('initial:\n  date: 2024-01-01\n  amount: 1\n').message).toContain('final');
  });

  it('flows 不是陣列', () => {
    const r = fail(`
initial:
  date: 2024-01-01
  amount: 1
flows: 5
final:
  date: 2025-01-01
  amount: 1
`);
    expect(r.message).toContain('flows');
  });

  it('金額不是數字', () => {
    const r = fail(`
initial:
  date: 2024-01-01
  amount: abc
flows: []
final:
  date: 2025-01-01
  amount: 1
`);
    expect(r.message).toContain('amount');
  });

  it('日期不是字串', () => {
    const r = fail(`
initial:
  date: 20240101
  amount: 1
flows: []
final:
  date: 2025-01-01
  amount: 1
`);
    expect(r.message).toContain('date');
  });

  it('flows 的元素不是物件', () => {
    const r = fail(`
initial:
  date: 2024-01-01
  amount: 1
flows:
  - 5
final:
  date: 2025-01-01
  amount: 1
`);
    expect(r.message).toContain('flows');
  });

  it('拒絕危險標籤', () => {
    expect(fail('a: !!js/function "function(){}"').ok).toBe(false);
  });
});

describe('parseForm — 往返性質', () => {
  it('parse(serialize(form)) 還原出相同的日期與金額', () => {
    const original: CalculatorForm = {
      initial: { date: '2024-01-01', amount: 100000 },
      rows: [
        { id: 'a', date: '2024-03-15', amount: 50000 },
        { id: 'b', date: '2024-08-20', amount: -30000 },
      ],
      final: { date: '2025-01-01', amount: 145000 },
    };
    const round = okForm(serializeForm(original));
    expect(round.initial).toEqual(original.initial);
    expect(round.final).toEqual(original.final);
    expect(round.rows.map(({ date, amount }) => ({ date, amount }))).toEqual(
      original.rows.map(({ date, amount }) => ({ date, amount })),
    );
  });

  it('半填表單同樣可往返', () => {
    const original: CalculatorForm = {
      initial: { date: '', amount: null },
      rows: [{ id: 'a', date: '2024-03-15', amount: null }],
      final: { date: '2025-01-01', amount: 0 },
    };
    const round = okForm(serializeForm(original));
    expect(round.initial).toEqual({ date: '', amount: null });
    expect(round.rows[0].amount).toBeNull();
    expect(round.final.amount).toBe(0);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/core/yaml/parse.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./parse`

- [ ] **Step 3: 寫實作**

`src/app/core/yaml/parse.ts`：

```ts
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
```

`src/app/core/example.ts`：

```ts
import type { CalculatorForm } from './model/types';

/** 載入範例用的資料。XIRR 約為 19.353321% */
export function exampleForm(makeId: () => string): CalculatorForm {
  return {
    initial: { date: '2024-01-01', amount: 100000 },
    rows: [
      { id: makeId(), date: '2024-03-15', amount: 50000 },
      { id: makeId(), date: '2024-08-20', amount: -30000 },
    ],
    final: { date: '2025-01-01', amount: 145000 },
  };
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test -- --include src/app/core/yaml/parse.spec.ts --watch=false
```

Expected: `Tests 18 passed (18)`

- [ ] **Step 5: Commit**

```bash
git add src/app/core/yaml/parse.ts src/app/core/yaml/parse.spec.ts src/app/core/example.ts
git commit -m "feat: add YAML parser with line-numbered errors and example data"
```

---

### Task 10: Signal Store

**Files:**
- Create: `src/app/state/calculator-store.ts`
- Test: `src/app/state/calculator-store.spec.ts`

**Interfaces:**
- Consumes: 全部 core 模組（Task 2–9）
- Produces: `CalculatorStore`，`@Injectable({ providedIn: 'root' })`
  - 唯讀 signal：`form`、`outcome`、`yamlText`、`yamlDirty`、`yamlError`、`isEmpty`、`issuesByRow`、`generalIssues`
  - 方法：`addRow()`、`removeRow(id)`、`duplicateRow(id)`、`moveRow(from, to)`、`setInitialDate(v)`、`setInitialAmount(raw)`、`setFinalDate(v)`、`setFinalAmount(raw)`、`setRowDate(id, v)`、`setRowAmount(id, raw)`、`editYaml(text)`、`applyYaml()`、`discardYaml()`、`loadExample()`、`clearAll()`、`calculate()`

**Dirty 狀態的模型：** 內部用 `yamlDraft: string | null`。`null` = 乾淨（`yamlText` 由表單即時序列化而來）；非 `null` = 髒（`yamlText` 回傳草稿，且**停止**跟隨表單）。這個表示法讓「停止同步」成為型別上的必然，而非靠一個容易忘記更新的布林旗標。

**金額輸入的解析：** 元件傳進來的是 `<input>` 的原始字串。空字串 → `null`；無法解析成有限數字 → `null`；其餘 → `Number(raw)`。

- [ ] **Step 1: 寫失敗的測試**

`src/app/state/calculator-store.spec.ts`：

```ts
import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from './calculator-store';

const make = (): CalculatorStore => {
  TestBed.configureTestingModule({});
  return TestBed.inject(CalculatorStore);
};

const fill = (store: CalculatorStore): void => {
  store.setInitialDate('2024-01-01');
  store.setInitialAmount('100000');
  store.setFinalDate('2025-01-01');
  store.setFinalAmount('145000');
  const [first] = store.form().rows;
  store.setRowDate(first.id, '2024-03-15');
  store.setRowAmount(first.id, '50000');
};

describe('CalculatorStore — 初始狀態', () => {
  it('保留一列空白資金進出', () => {
    const store = make();
    expect(store.form().rows).toHaveLength(1);
    expect(store.form().rows[0].date).toBe('');
    expect(store.form().rows[0].amount).toBeNull();
  });

  it('尚未計算時沒有結果', () => {
    expect(make().outcome()).toBeNull();
  });

  it('空表單的 isEmpty 為 true', () => {
    expect(make().isEmpty()).toBe(true);
  });
});

describe('CalculatorStore — 列操作', () => {
  it('addRow 追加空白列', () => {
    const store = make();
    store.addRow();
    expect(store.form().rows).toHaveLength(2);
  });

  it('removeRow 移除指定列', () => {
    const store = make();
    store.addRow();
    const [first] = store.form().rows;
    store.removeRow(first.id);
    expect(store.form().rows.map((r) => r.id)).not.toContain(first.id);
  });

  it('移除最後一列後仍保留一列空白', () => {
    const store = make();
    store.removeRow(store.form().rows[0].id);
    expect(store.form().rows).toHaveLength(1);
  });

  it('duplicateRow 複製日期與金額，插在原列正下方', () => {
    const store = make();
    store.addRow();
    const [a, b] = store.form().rows;
    store.setRowDate(a.id, '2024-05-01');
    store.setRowAmount(a.id, '1234');
    store.duplicateRow(a.id);

    const rows = store.form().rows;
    expect(rows).toHaveLength(3);
    expect(rows[1].date).toBe('2024-05-01');
    expect(rows[1].amount).toBe(1234);
    expect(rows[2].id).toBe(b.id);
  });

  it('duplicateRow 產生新的 id', () => {
    const store = make();
    const [a] = store.form().rows;
    store.duplicateRow(a.id);
    const rows = store.form().rows;
    expect(rows[1].id).not.toBe(rows[0].id);
  });

  it('moveRow 依索引搬移', () => {
    const store = make();
    store.addRow();
    store.addRow();
    const ids = store.form().rows.map((r) => r.id);
    store.moveRow(0, 2);
    expect(store.form().rows.map((r) => r.id)).toEqual([ids[1], ids[2], ids[0]]);
  });
});

describe('CalculatorStore — 金額解析', () => {
  it('空字串視為未填', () => {
    const store = make();
    store.setInitialAmount('');
    expect(store.form().initial.amount).toBeNull();
  });

  it('0 是合法金額，不是未填', () => {
    const store = make();
    store.setInitialAmount('0');
    expect(store.form().initial.amount).toBe(0);
  });

  it('無法解析的內容視為未填', () => {
    const store = make();
    store.setInitialAmount('abc');
    expect(store.form().initial.amount).toBeNull();
  });

  it('接受負數與小數', () => {
    const store = make();
    store.setFinalAmount('-12.5');
    expect(store.form().final.amount).toBeCloseTo(-12.5, 9);
  });
});

describe('CalculatorStore — YAML dirty 狀態', () => {
  it('初始為乾淨，yamlText 跟隨表單', () => {
    const store = make();
    expect(store.yamlDirty()).toBe(false);
    store.setInitialDate('2024-01-01');
    expect(store.yamlText()).toContain('date: 2024-01-01');
  });

  it('editYaml 後轉髒，且停止跟隨表單', () => {
    const store = make();
    store.editYaml('initial:\n  date: 2099-01-01\n');
    expect(store.yamlDirty()).toBe(true);

    store.setInitialDate('2024-01-01');
    expect(store.yamlText()).toContain('2099-01-01');
    expect(store.yamlText()).not.toContain('2024-01-01');
  });

  it('applyYaml 成功後灌回表單並轉乾淨', () => {
    const store = make();
    store.editYaml(`
initial:
  date: 2024-01-01
  amount: 100000
flows:
  - date: 2024-03-15
    amount: 50000
final:
  date: 2025-01-01
  amount: 145000
`);
    store.applyYaml();

    expect(store.yamlDirty()).toBe(false);
    expect(store.yamlError()).toBeNull();
    expect(store.form().initial.amount).toBe(100000);
    expect(store.form().rows).toHaveLength(1);
  });

  it('applyYaml 失敗時保留草稿、維持髒、顯示錯誤', () => {
    const store = make();
    store.editYaml('initial:\n  date: 2024-01-01\n   amount: 5\n');
    store.applyYaml();

    expect(store.yamlDirty()).toBe(true);
    expect(store.yamlError()).not.toBeNull();
    expect(store.yamlError()).toContain('第 3 行');
    expect(store.yamlText()).toContain('amount: 5');
  });

  it('discardYaml 丟掉草稿並轉乾淨', () => {
    const store = make();
    store.setInitialDate('2024-01-01');
    store.editYaml('壞掉的內容');
    store.applyYaml();
    store.discardYaml();

    expect(store.yamlDirty()).toBe(false);
    expect(store.yamlError()).toBeNull();
    expect(store.yamlText()).toContain('date: 2024-01-01');
  });

  it('loadExample 與 clearAll 無條件轉乾淨', () => {
    const store = make();
    store.editYaml('隨便打的東西');
    store.loadExample();
    expect(store.yamlDirty()).toBe(false);

    store.editYaml('又打了東西');
    store.clearAll();
    expect(store.yamlDirty()).toBe(false);
  });
});

describe('CalculatorStore — 載入範例與清除', () => {
  it('loadExample 填入範例資料', () => {
    const store = make();
    store.loadExample();
    expect(store.form().initial).toEqual({ date: '2024-01-01', amount: 100000 });
    expect(store.form().rows).toHaveLength(2);
    expect(store.isEmpty()).toBe(false);
  });

  it('clearAll 清空並保留一列空白', () => {
    const store = make();
    store.loadExample();
    store.calculate();
    store.clearAll();

    expect(store.form().initial).toEqual({ date: '', amount: null });
    expect(store.form().rows).toHaveLength(1);
    expect(store.outcome()).toBeNull();
    expect(store.isEmpty()).toBe(true);
  });
});

describe('CalculatorStore — 計算', () => {
  it('成功時產生結果', () => {
    const store = make();
    store.loadExample();
    store.calculate();

    const outcome = store.outcome();
    expect(outcome?.ok).toBe(true);
    if (outcome?.ok) expect(outcome.metrics.xirr * 100).toBeCloseTo(19.353321, 5);
  });

  it('日期順序不對時把排序結果寫回表單', () => {
    const store = make();
    fill(store); // rows[0] = 2024-03-15
    store.addRow();
    const rows = store.form().rows;
    store.setRowDate(rows[1].id, '2024-02-01'); // 比第一列早，順序是錯的
    store.setRowAmount(rows[1].id, '1000');

    expect(store.form().rows.map((r) => r.date)).toEqual(['2024-03-15', '2024-02-01']);
    store.calculate();
    expect(store.form().rows.map((r) => r.date)).toEqual(['2024-02-01', '2024-03-15']);
  });

  it('必填檢查失敗時不動表單順序', () => {
    const store = make();
    fill(store);
    store.addRow();
    const rows = store.form().rows;
    store.setRowDate(rows[1].id, '2024-02-01'); // 金額留空
    const before = store.form().rows.map((r) => r.id);

    store.calculate();
    expect(store.form().rows.map((r) => r.id)).toEqual(before);
    expect(store.outcome()?.ok).toBe(false);
  });

  it('issuesByRow 依 rowId 索引錯誤', () => {
    const store = make();
    fill(store);
    const rowId = store.form().rows[0].id;
    store.setRowAmount(rowId, '');

    store.calculate();
    expect(store.issuesByRow().get(rowId)?.[0].code).toBe('MISSING_AMOUNT');
  });

  it('重新計算會覆蓋前次結果', () => {
    const store = make();
    store.loadExample();
    store.calculate();
    expect(store.outcome()?.ok).toBe(true);

    store.setFinalDate('2023-01-01');
    store.calculate();
    expect(store.outcome()?.ok).toBe(false);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/state/calculator-store.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./calculator-store`

- [ ] **Step 3: 寫實作**

`src/app/state/calculator-store.ts`：

```ts
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
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test -- --include src/app/state/calculator-store.spec.ts --watch=false
```

Expected: `Tests 24 passed (24)`

- [ ] **Step 5: Commit**

```bash
git add src/app/state/calculator-store.ts src/app/state/calculator-store.spec.ts
git commit -m "feat: add signal store with YAML dirty-state tracking"
```

---

### Task 11: 樣式基礎、版面骨架與顯示格式化

**Files:**
- Modify: `src/styles.css`
- Modify: `src/app/app.html`、`src/app/app.css`
- Create: `src/app/ui/format.ts`
- Test: `src/app/ui/format.spec.ts`

**Interfaces:**
- Consumes: 無
- Produces:
  - `formatAmount(value: number): string`
  - `formatPercent(rate: number): string`
  - `DISPLAY_CLAMP = 1e6`
  - CSS 變數：`--bg`、`--surface`、`--border`、`--text`、`--muted`、`--accent`、`--danger`、`--positive`

**顯示夾制屬 UI 層職責**（spec §7）。core 一律回傳原始數值，`formatPercent` 負責在 `rate > DISPLAY_CLAMP` 時改印 `> 100,000,000%`。

注意兩個閾值不同，不要混淆：

| 閾值 | 值 | 效果 |
|---|---|---|
| `EXTREME_RATE` 註記 | `rate < -0.99` 或 `rate > 10` | Task 7 產生註記，數值照常顯示 |
| 顯示夾制 | `rate > 1e6` | 本 task 改印 `> 100,000,000%` |

- [ ] **Step 1: 寫失敗的測試**

`src/app/ui/format.spec.ts`：

```ts
import { formatAmount, formatPercent } from './format';

describe('formatAmount', () => {
  it('加上千分位且不顯示小數', () => {
    expect(formatAmount(1234567)).toBe('1,234,567');
    expect(formatAmount(1000)).toBe('1,000');
    expect(formatAmount(0)).toBe('0');
  });

  it('四捨五入到整數', () => {
    expect(formatAmount(1234.56)).toBe('1,235');
  });

  it('負數保留負號', () => {
    expect(formatAmount(-40000)).toBe('-40,000');
  });
});

describe('formatPercent', () => {
  it('顯示到小數兩位', () => {
    expect(formatPercent(0.19353321)).toBe('19.35%');
    expect(formatPercent(0.1)).toBe('10.00%');
  });

  it('全損顯示 -100.00%', () => {
    expect(formatPercent(-1)).toBe('-100.00%');
  });

  it('千分位也適用於大數', () => {
    expect(formatPercent(36.78343)).toBe('3,678.34%');
  });

  it('超過夾制閾值時改印上限', () => {
    expect(formatPercent(7.515336e109)).toBe('> 100,000,000%');
    expect(formatPercent(2e6)).toBe('> 100,000,000%');
  });

  it('恰在閾值上不夾制', () => {
    expect(formatPercent(1e6)).toBe('100,000,000.00%');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/ui/format.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./format`

- [ ] **Step 3: 寫實作**

`src/app/ui/format.ts`：

```ts
/** 超過此報酬率就不印精確值——那串數字對使用者沒有意義 */
export const DISPLAY_CLAMP = 1e6;

const amountFormatter = new Intl.NumberFormat('zh-TW', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('zh-TW', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(value: number): string {
  return amountFormatter.format(value);
}

export function formatPercent(rate: number): string {
  if (rate > DISPLAY_CLAMP) return '> 100,000,000%';
  return `${percentFormatter.format(rate * 100)}%`;
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test -- --include src/app/ui/format.spec.ts --watch=false
```

Expected: `Tests 8 passed (8)`

- [ ] **Step 5: 寫全域樣式**

`src/styles.css` 整份替換成：

```css
:root {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --border: #d8dce3;
  --text: #1c2430;
  --muted: #6b7787;
  --accent: #2f6feb;
  --danger: #c0392b;
  --positive: #1f8a4c;
  --radius: 8px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
  line-height: 1.6;
}

button {
  font: inherit;
  cursor: pointer;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  padding: 0.4rem 0.9rem;
}

button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

button.primary:hover:not(:disabled) {
  color: #fff;
  filter: brightness(1.08);
}

input,
textarea {
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.35rem 0.5rem;
  width: 100%;
}

input:focus,
textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

input.invalid {
  border-color: var(--danger);
  background: #fdf3f2;
}
```

- [ ] **Step 6: 寫版面骨架**

`src/app/app.html`：

```html
<main class="page">
  <header class="page-header">
    <h1>XIRR 投資年化報酬率計算機</h1>
    <p class="lede">
      輸入期初部位、期間的資金進出與期末部位，計算考慮時間因素的真實年化報酬率。
    </p>
  </header>
</main>
```

`src/app/app.css`：

```css
.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.6rem;
}

.lede {
  margin: 0;
  color: var(--muted);
}

:host ::ng-deep .card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.1rem 1.2rem;
}

:host ::ng-deep .card > h2 {
  margin: 0 0 0.8rem;
  font-size: 1.05rem;
}
```

- [ ] **Step 7: 執行全部測試與建置**

```bash
npm test -- --watch=false && npm run build
```

Expected: 全綠且建置成功。

- [ ] **Step 8: Commit**

```bash
git add src/styles.css src/app/app.html src/app/app.css src/app/ui/format.ts src/app/ui/format.spec.ts
git commit -m "feat: add design tokens, page shell, and display formatting"
```

---

### Task 12: 期初／期末部位元件

**Files:**
- Create: `src/app/ui/position-fields/position-fields.ts`
- Create: `src/app/ui/position-fields/position-fields.html`
- Create: `src/app/ui/position-fields/position-fields.css`
- Modify: `src/app/app.ts`、`src/app/app.html`
- Test: `src/app/ui/position-fields/position-fields.spec.ts`

**Interfaces:**
- Consumes: `CalculatorStore`（Task 10）
- Produces: `PositionFields` 元件，selector `app-position-fields`，signal input `kind: 'initial' | 'final'`

期初與期末的欄位結構完全相同，用同一個元件靠 `kind` 區分，不寫兩份。

- [ ] **Step 1: 寫失敗的測試**

`src/app/ui/position-fields/position-fields.spec.ts`：

```ts
import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { PositionFields } from './position-fields';

const setup = async (kind: 'initial' | 'final') => {
  TestBed.configureTestingModule({ imports: [PositionFields] });
  const fixture = TestBed.createComponent(PositionFields);
  fixture.componentRef.setInput('kind', kind);
  await fixture.whenStable();
  return { fixture, store: TestBed.inject(CalculatorStore), el: fixture.nativeElement as HTMLElement };
};

describe('PositionFields', () => {
  it('期初顯示期初標題', async () => {
    const { el } = await setup('initial');
    expect(el.querySelector('h2')?.textContent).toContain('期初部位');
  });

  it('期末顯示期末標題', async () => {
    const { el } = await setup('final');
    expect(el.querySelector('h2')?.textContent).toContain('期末部位');
  });

  it('輸入日期會寫進 store', async () => {
    const { fixture, store, el } = await setup('initial');
    const input = el.querySelector<HTMLInputElement>('input[type="date"]')!;
    input.value = '2024-01-01';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(store.form().initial.date).toBe('2024-01-01');
  });

  it('輸入金額會寫進 store', async () => {
    const { fixture, store, el } = await setup('final');
    const input = el.querySelector<HTMLInputElement>('input[type="number"]')!;
    input.value = '145000';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(store.form().final.amount).toBe(145000);
  });

  it('store 的值會反映回畫面', async () => {
    const { fixture, store, el } = await setup('initial');
    store.loadExample();
    await fixture.whenStable();
    expect(el.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe('2024-01-01');
  });

  it('有錯誤時欄位加上 invalid 樣式', async () => {
    const { fixture, store, el } = await setup('initial');
    store.calculate(); // 空表單必定產生必填錯誤
    await fixture.whenStable();
    expect(el.querySelector('input[type="date"]')!.classList).toContain('invalid');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/ui/position-fields/position-fields.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./position-fields`

- [ ] **Step 3: 寫元件**

`src/app/ui/position-fields/position-fields.ts`：

```ts
import { Component, computed, inject, input } from '@angular/core';
import { CalculatorStore } from '../../state/calculator-store';

@Component({
  selector: 'app-position-fields',
  imports: [],
  templateUrl: './position-fields.html',
  styleUrl: './position-fields.css',
})
export class PositionFields {
  protected readonly store = inject(CalculatorStore);

  readonly kind = input.required<'initial' | 'final'>();

  protected readonly title = computed(() =>
    this.kind() === 'initial' ? '期初部位' : '期末部位',
  );

  protected readonly dateLabel = computed(() =>
    this.kind() === 'initial' ? '開始日期' : '結束日期',
  );

  protected readonly amountLabel = computed(() =>
    this.kind() === 'initial' ? '期初金額' : '期末金額',
  );

  protected readonly position = computed(() => {
    const form = this.store.form();
    return this.kind() === 'initial' ? form.initial : form.final;
  });

  protected readonly dateInvalid = computed(() => this.hasIssue('date'));
  protected readonly amountInvalid = computed(() => this.hasIssue('amount'));

  protected onDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.kind() === 'initial') this.store.setInitialDate(value);
    else this.store.setFinalDate(value);
  }

  protected onAmount(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.kind() === 'initial') this.store.setInitialAmount(value);
    else this.store.setFinalAmount(value);
  }

  private hasIssue(field: 'date' | 'amount'): boolean {
    return this.store
      .generalIssues()
      .some((i) => i.target.kind === this.kind() && i.target.field === field);
  }
}
```

`src/app/ui/position-fields/position-fields.html`：

```html
<section class="card">
  <h2>{{ title() }}</h2>
  <div class="fields">
    <label>
      <span>{{ dateLabel() }}</span>
      <input
        type="date"
        [class.invalid]="dateInvalid()"
        [value]="position().date"
        (input)="onDate($event)"
      />
    </label>
    <label>
      <span>{{ amountLabel() }}</span>
      <input
        type="number"
        step="any"
        placeholder="0"
        [class.invalid]="amountInvalid()"
        [value]="position().amount ?? ''"
        (input)="onAmount($event)"
      />
    </label>
  </div>
</section>
```

`src/app/ui/position-fields/position-fields.css`：

```css
.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.9rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

label > span {
  font-size: 0.85rem;
  color: var(--muted);
}
```

- [ ] **Step 4: 掛進版面**

`src/app/app.ts`：

```ts
import { Component } from '@angular/core';
import { PositionFields } from './ui/position-fields/position-fields';

@Component({
  selector: 'app-root',
  imports: [PositionFields],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
```

在 `src/app/app.html` 的 `</header>` 之後插入：

```html
  <app-position-fields kind="initial" />
  <app-position-fields kind="final" />
```

- [ ] **Step 5: 執行測試確認通過**

```bash
npm test -- --include src/app/ui/position-fields/position-fields.spec.ts --watch=false
```

Expected: `Tests 6 passed (6)`

- [ ] **Step 6: Commit**

```bash
git add src/app/ui/position-fields src/app/app.ts src/app/app.html
git commit -m "feat: add initial and final position fields"
```

---

### Task 13: 資金進出表格（拖曳、複製、新增、刪除）

**Files:**
- Create: `src/app/ui/cash-flow-table/cash-flow-table.ts`
- Create: `src/app/ui/cash-flow-table/cash-flow-table.html`
- Create: `src/app/ui/cash-flow-table/cash-flow-table.css`
- Modify: `src/app/app.ts`、`src/app/app.html`
- Test: `src/app/ui/cash-flow-table/cash-flow-table.spec.ts`

**Interfaces:**
- Consumes: `CalculatorStore`（Task 10）、`@angular/cdk/drag-drop`
- Produces: `CashFlowTable` 元件，selector `app-cash-flow-table`

**拖曳的關鍵設計**（spec §6）：日期欄是 `<input type="date">`，是可互動控制項。若把整格或整列當拖曳把手，使用者就點不進去打字。因此：

- `cdkDrag` 掛在**整列**（整列跟著移動）
- `cdkDragHandle` 掛在日期儲存格內的**獨立把手按鈕**（`⠿`），**不可掛在 `<input>` 上**
- 放開後呼叫 `store.moveRow(event.previousIndex, event.currentIndex)`

**複製後的焦點**（spec §6）：複製完成後焦點必須移到**新列的日期欄**，讓使用者能直接改日期。因為新列要等變更偵測跑完才存在於 DOM，必須用 `afterNextRender` 而非直接 `querySelector`。

- [ ] **Step 1: 寫失敗的測試**

`src/app/ui/cash-flow-table/cash-flow-table.spec.ts`：

```ts
import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { CashFlowTable } from './cash-flow-table';

const setup = async () => {
  TestBed.configureTestingModule({ imports: [CashFlowTable] });
  const fixture = TestBed.createComponent(CashFlowTable);
  await fixture.whenStable();
  return {
    fixture,
    store: TestBed.inject(CalculatorStore),
    el: fixture.nativeElement as HTMLElement,
  };
};

describe('CashFlowTable', () => {
  it('初始渲染一列', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('.flow-row')).toHaveLength(1);
  });

  it('每列都有拖曳把手，且把手不是輸入框', async () => {
    const { el } = await setup();
    const handle = el.querySelector('.drag-handle')!;
    expect(handle).not.toBeNull();
    expect(handle.tagName).toBe('BUTTON');
  });

  it('把手與日期輸入框是不同元素', async () => {
    const { el } = await setup();
    const handle = el.querySelector('.drag-handle')!;
    expect(handle.querySelector('input')).toBeNull();
  });

  it('新增按鈕會增加一列', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLButtonElement>('.add-row')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('.flow-row')).toHaveLength(2);
  });

  it('複製按鈕會複製該列的日期與金額到下一列', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();

    el.querySelectorAll<HTMLButtonElement>('.duplicate-row')[0].click();
    await fixture.whenStable();

    const rows = store.form().rows;
    expect(rows).toHaveLength(3);
    expect(rows[1].date).toBe('2024-03-15');
    expect(rows[1].amount).toBe(50000);
  });

  it('複製後焦點移到新列的日期欄', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();

    el.querySelectorAll<HTMLButtonElement>('.duplicate-row')[0].click();
    await fixture.whenStable();

    const createdId = store.form().rows[1].id;
    expect(document.activeElement).toBe(
      el.querySelector(`input[data-row-id="${createdId}"]`),
    );
  });

  it('刪除按鈕會移除該列', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();

    el.querySelectorAll<HTMLButtonElement>('.remove-row')[0].click();
    await fixture.whenStable();

    expect(store.form().rows).toHaveLength(1);
    expect(store.form().rows[0].date).toBe('2024-08-20');
  });

  it('輸入日期與金額會寫進 store', async () => {
    const { fixture, store, el } = await setup();
    const date = el.querySelector<HTMLInputElement>('input[type="date"]')!;
    date.value = '2024-06-01';
    date.dispatchEvent(new Event('input'));

    const amount = el.querySelector<HTMLInputElement>('input[type="number"]')!;
    amount.value = '-2500';
    amount.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(store.form().rows[0].date).toBe('2024-06-01');
    expect(store.form().rows[0].amount).toBe(-2500);
  });

  it('有錯誤的列會被標示', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    store.setInitialAmount('1000');
    store.setFinalDate('2025-01-01');
    store.setFinalAmount('1100');
    store.setRowDate(store.form().rows[0].id, '2024-06-01'); // 金額留空
    store.calculate();
    await fixture.whenStable();

    expect(el.querySelector('.flow-row')!.classList).toContain('has-error');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/ui/cash-flow-table/cash-flow-table.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./cash-flow-table`

- [ ] **Step 3: 寫元件**

`src/app/ui/cash-flow-table/cash-flow-table.ts`：

```ts
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, ElementRef, Injector, afterNextRender, inject } from '@angular/core';
import { CalculatorStore } from '../../state/calculator-store';

@Component({
  selector: 'app-cash-flow-table',
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './cash-flow-table.html',
  styleUrl: './cash-flow-table.css',
})
export class CashFlowTable {
  protected readonly store = inject(CalculatorStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.store.moveRow(event.previousIndex, event.currentIndex);
  }

  /** 複製後把焦點移到新列的日期欄，使用者才能直接改日期 */
  protected onDuplicate(id: string): void {
    this.store.duplicateRow(id);

    const rows = this.store.form().rows;
    const index = rows.findIndex((r) => r.id === id);
    const created = rows[index + 1];
    if (created === undefined) return;

    // 新列要等變更偵測跑完才進 DOM，不能在這裡直接查詢
    afterNextRender(
      () => {
        this.host.nativeElement
          .querySelector<HTMLInputElement>(`input[data-row-id="${created.id}"]`)
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  protected onDate(id: string, event: Event): void {
    this.store.setRowDate(id, (event.target as HTMLInputElement).value);
  }

  protected onAmount(id: string, event: Event): void {
    this.store.setRowAmount(id, (event.target as HTMLInputElement).value);
  }

  protected rowHasError(id: string): boolean {
    return this.store.issuesByRow().has(id);
  }
}
```

`src/app/ui/cash-flow-table/cash-flow-table.html`：

```html
<section class="card">
  <h2>資金進出記錄</h2>
  <p class="hint">正數代表資金投入，負數代表資金匯出。可拖曳日期左側的把手調整順序。</p>

  <div class="flow-head">
    <span>日期</span>
    <span>金額</span>
    <span class="actions-col">操作</span>
  </div>

  <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="flow-list">
    @for (row of store.form().rows; track row.id) {
      <div class="flow-row" [class.has-error]="rowHasError(row.id)" cdkDrag>
        <div class="cell date-cell">
          <button
            type="button"
            class="drag-handle"
            cdkDragHandle
            aria-label="拖曳調整順序"
            title="拖曳調整順序"
          >
            ⠿
          </button>
          <input
            type="date"
            [attr.data-row-id]="row.id"
            [value]="row.date"
            (input)="onDate(row.id, $event)"
          />
        </div>

        <div class="cell">
          <input
            type="number"
            step="any"
            placeholder="0"
            [value]="row.amount ?? ''"
            (input)="onAmount(row.id, $event)"
          />
        </div>

        <div class="cell row-actions">
          <button
            type="button"
            class="duplicate-row"
            (click)="onDuplicate(row.id)"
            title="複製這一筆"
            aria-label="複製這一筆"
          >
            複製
          </button>
          <button
            type="button"
            class="remove-row"
            (click)="store.removeRow(row.id)"
            title="刪除這一筆"
            aria-label="刪除這一筆"
          >
            刪除
          </button>
        </div>
      </div>
    }
  </div>

  <button type="button" class="add-row" (click)="store.addRow()">＋ 新增一筆</button>
</section>
```

`src/app/ui/cash-flow-table/cash-flow-table.css`：

```css
.hint {
  margin: -0.4rem 0 0.9rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.flow-head,
.flow-row {
  display: grid;
  grid-template-columns: minmax(190px, 1.2fr) minmax(120px, 1fr) auto;
  gap: 0.6rem;
  align-items: center;
}

.flow-head {
  font-size: 0.8rem;
  color: var(--muted);
  padding: 0 0.2rem 0.4rem;
}

.flow-row {
  padding: 0.35rem 0.2rem;
  border-radius: var(--radius);
}

.flow-row.has-error {
  background: #fdf3f2;
  box-shadow: inset 0 0 0 1px var(--danger);
}

.date-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* 把手必須是獨立元素，不可覆蓋在 input 上，否則日期欄位無法點擊輸入 */
.drag-handle {
  flex: 0 0 auto;
  padding: 0.25rem 0.4rem;
  color: var(--muted);
  cursor: grab;
  line-height: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.row-actions {
  display: flex;
  gap: 0.35rem;
}

.row-actions button {
  padding: 0.3rem 0.6rem;
  font-size: 0.85rem;
}

.add-row {
  margin-top: 0.8rem;
}

.cdk-drag-preview {
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.14);
  padding: 0.35rem 0.5rem;
}

.cdk-drag-placeholder {
  opacity: 0.4;
  background: #eef3fd;
  border: 1px dashed var(--accent);
  border-radius: var(--radius);
}

.cdk-drag-animating,
.flow-list.cdk-drop-list-dragging .flow-row:not(.cdk-drag-placeholder) {
  transition: transform 180ms cubic-bezier(0, 0, 0.2, 1);
}
```

- [ ] **Step 4: 掛進版面**

`src/app/app.ts` 的 `imports` 加入 `CashFlowTable`（並 import 該類別）。`src/app/app.html` 把表格插在兩個 `app-position-fields` 之間：

```html
  <app-position-fields kind="initial" />
  <app-cash-flow-table />
  <app-position-fields kind="final" />
```

- [ ] **Step 5: 執行測試確認通過**

```bash
npm test -- --include src/app/ui/cash-flow-table/cash-flow-table.spec.ts --watch=false
```

Expected: `Tests 9 passed (9)`

若「複製後焦點」一項失敗且 `document.activeElement` 是 `<body>`，代表 `afterNextRender` 的回呼尚未執行——在斷言前多加一次 `fixture.detectChanges()` 再 `await fixture.whenStable()`。

- [ ] **Step 6: Commit**

```bash
git add src/app/ui/cash-flow-table src/app/app.ts src/app/app.html
git commit -m "feat: add cash flow table with drag handle, duplicate and delete"
```

---

### Task 14: YAML 面板

**Files:**
- Create: `src/app/ui/yaml-panel/yaml-panel.ts`
- Create: `src/app/ui/yaml-panel/yaml-panel.html`
- Create: `src/app/ui/yaml-panel/yaml-panel.css`
- Modify: `src/app/app.ts`、`src/app/app.html`
- Test: `src/app/ui/yaml-panel/yaml-panel.spec.ts`

**Interfaces:**
- Consumes: `CalculatorStore`（Task 10）
- Produces: `YamlPanel` 元件，selector `app-yaml-panel`

**dirty 狀態的畫面行為**（spec §6）：乾淨時 textarea 跟隨表單；髒掉時顯示「尚未套用」標示與「捨棄變更」按鈕，且**停止**跟隨表單。面板下方固定顯示格式說明。

- [ ] **Step 1: 寫失敗的測試**

`src/app/ui/yaml-panel/yaml-panel.spec.ts`：

```ts
import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { YamlPanel } from './yaml-panel';

const setup = async () => {
  TestBed.configureTestingModule({ imports: [YamlPanel] });
  const fixture = TestBed.createComponent(YamlPanel);
  await fixture.whenStable();
  return {
    fixture,
    store: TestBed.inject(CalculatorStore),
    el: fixture.nativeElement as HTMLElement,
  };
};

const type = async (
  fixture: { whenStable: () => Promise<unknown> },
  el: HTMLElement,
  text: string,
) => {
  const area = el.querySelector<HTMLTextAreaElement>('textarea')!;
  area.value = text;
  area.dispatchEvent(new Event('input'));
  await fixture.whenStable();
};

describe('YamlPanel', () => {
  it('乾淨時 textarea 跟隨表單', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();
    expect(el.querySelector('textarea')!.value).toContain('date: 2024-01-01');
  });

  it('乾淨時不顯示尚未套用標示', async () => {
    const { el } = await setup();
    expect(el.querySelector('.dirty-badge')).toBeNull();
  });

  it('編輯後顯示尚未套用標示與捨棄按鈕', async () => {
    const { fixture, el } = await setup();
    await type(fixture, el, 'initial:\n  date: 2099-01-01\n');
    expect(el.querySelector('.dirty-badge')?.textContent).toContain('尚未套用');
    expect(el.querySelector('.discard-yaml')).not.toBeNull();
  });

  it('髒掉後表單變動不會覆蓋草稿', async () => {
    const { fixture, store, el } = await setup();
    await type(fixture, el, 'my draft');
    store.loadExample();
    await fixture.whenStable();
    expect(el.querySelector('textarea')!.value).toBe('my draft');
  });

  it('套用合法 YAML 會灌回表單並清掉標示', async () => {
    const { fixture, store, el } = await setup();
    await type(
      fixture,
      el,
      'initial:\n  date: 2024-01-01\n  amount: 100000\nflows: []\nfinal:\n  date: 2025-01-01\n  amount: 145000\n',
    );
    el.querySelector<HTMLButtonElement>('.apply-yaml')!.click();
    await fixture.whenStable();

    expect(store.form().initial.amount).toBe(100000);
    expect(el.querySelector('.dirty-badge')).toBeNull();
    expect(el.querySelector('.yaml-error')).toBeNull();
  });

  it('套用失敗顯示帶行號的錯誤且維持髒', async () => {
    const { fixture, el } = await setup();
    await type(fixture, el, 'initial:\n  date: 2024-01-01\n   amount: 5\n');
    el.querySelector<HTMLButtonElement>('.apply-yaml')!.click();
    await fixture.whenStable();

    expect(el.querySelector('.yaml-error')?.textContent).toContain('第 3 行');
    expect(el.querySelector('.dirty-badge')).not.toBeNull();
  });

  it('捨棄變更後回到跟隨表單', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();
    await type(fixture, el, '亂打的內容');
    el.querySelector<HTMLButtonElement>('.discard-yaml')!.click();
    await fixture.whenStable();

    expect(el.querySelector('textarea')!.value).toContain('date: 2024-01-01');
    expect(el.querySelector('.dirty-badge')).toBeNull();
  });

  it('顯示格式說明範例', async () => {
    const { el } = await setup();
    const help = el.querySelector('.yaml-help')!.textContent ?? '';
    expect(help).toContain('initial:');
    expect(help).toContain('flows:');
    expect(help).toContain('final:');
    expect(help).toContain('正數 = 資金投入');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/ui/yaml-panel/yaml-panel.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./yaml-panel`

- [ ] **Step 3: 寫元件**

`src/app/ui/yaml-panel/yaml-panel.ts`：

```ts
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
```

`src/app/ui/yaml-panel/yaml-panel.html`：

```html
<section class="card">
  <div class="yaml-head">
    <h2>YAML 輸入</h2>
    @if (store.yamlDirty()) {
      <span class="dirty-badge">尚未套用</span>
    }
  </div>

  <p class="hint">
    不想用上方表單時，可以直接在這裡編輯 YAML，按「套用 YAML」後即可計算。
  </p>

  <textarea rows="14" spellcheck="false" [value]="store.yamlText()" (input)="onInput($event)"></textarea>

  @if (store.yamlError(); as error) {
    <p class="yaml-error">{{ error }}</p>
  }

  <div class="yaml-actions">
    <button type="button" class="apply-yaml" [disabled]="!store.yamlDirty()" (click)="store.applyYaml()">
      套用 YAML
    </button>
    @if (store.yamlDirty()) {
      <button type="button" class="discard-yaml" (click)="store.discardYaml()">捨棄變更</button>
    }
  </div>

  <details class="yaml-help-wrap">
    <summary>資料格式說明</summary>
    <p class="hint">
      <code>initial</code> 是期初部位、<code>final</code> 是期末部位、<code>flows</code>
      是資金進出記錄。日期一律使用 <code>YYYY-MM-DD</code> 格式。
    </p>
    <pre class="yaml-help">{{ helpExample }}</pre>
  </details>
</section>
```

`src/app/ui/yaml-panel/yaml-panel.css`：

```css
.yaml-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.yaml-head h2 {
  margin: 0;
}

.dirty-badge {
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: #fff5e0;
  border: 1px solid #e0b551;
  color: #8a5b00;
}

.hint {
  margin: 0.5rem 0 0.8rem;
  font-size: 0.85rem;
  color: var(--muted);
}

textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
}

.yaml-error {
  margin: 0.6rem 0 0;
  color: var(--danger);
  font-size: 0.88rem;
}

.yaml-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.yaml-help-wrap {
  margin-top: 1rem;
  border-top: 1px solid var(--border);
  padding-top: 0.8rem;
}

summary {
  cursor: pointer;
  font-size: 0.9rem;
}

.yaml-help {
  margin: 0;
  padding: 0.8rem;
  background: #f3f5f8;
  border-radius: var(--radius);
  font-size: 0.82rem;
  overflow-x: auto;
}
```

- [ ] **Step 4: 掛進版面**

`src/app/app.ts` 的 `imports` 加入 `YamlPanel`。`src/app/app.html` 在 `app-position-fields kind="final"` 之後加入 `<app-yaml-panel />`。

- [ ] **Step 5: 執行測試確認通過**

```bash
npm test -- --include src/app/ui/yaml-panel/yaml-panel.spec.ts --watch=false
```

Expected: `Tests 8 passed (8)`

- [ ] **Step 6: Commit**

```bash
git add src/app/ui/yaml-panel src/app/app.ts src/app/app.html
git commit -m "feat: add YAML panel with dirty-state indicator and format help"
```

---

### Task 15: 結果面板

**Files:**
- Create: `src/app/ui/results-panel/results-panel.ts`
- Create: `src/app/ui/results-panel/results-panel.html`
- Create: `src/app/ui/results-panel/results-panel.css`
- Modify: `src/app/app.ts`、`src/app/app.html`
- Test: `src/app/ui/results-panel/results-panel.spec.ts`

**Interfaces:**
- Consumes: `CalculatorStore`（Task 10）、`formatAmount` / `formatPercent`（Task 11）
- Produces: `ResultsPanel` 元件，selector `app-results-panel`

顯示五項數字、註記、以及非列的錯誤。尚未計算時整個面板不渲染。

- [ ] **Step 1: 寫失敗的測試**

`src/app/ui/results-panel/results-panel.spec.ts`：

```ts
import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { ResultsPanel } from './results-panel';

const setup = async () => {
  TestBed.configureTestingModule({ imports: [ResultsPanel] });
  const fixture = TestBed.createComponent(ResultsPanel);
  await fixture.whenStable();
  return {
    fixture,
    store: TestBed.inject(CalculatorStore),
    el: fixture.nativeElement as HTMLElement,
  };
};

const text = (el: HTMLElement, selector: string): string =>
  el.querySelector(selector)?.textContent?.trim() ?? '';

describe('ResultsPanel', () => {
  it('尚未計算時不渲染', async () => {
    const { el } = await setup();
    expect(el.querySelector('.results')).toBeNull();
  });

  it('渲染五項數字', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    store.calculate();
    await fixture.whenStable();

    expect(text(el, '[data-field="totalInvested"]')).toBe('150,000');
    expect(text(el, '[data-field="totalWithdrawn"]')).toBe('30,000');
    expect(text(el, '[data-field="currentPosition"]')).toBe('145,000');
    expect(text(el, '[data-field="totalReturn"]')).toBe('25,000');
    expect(text(el, '[data-field="xirr"]')).toBe('19.35%');
  });

  it('總報酬為負時加上負值樣式', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    store.setInitialAmount('100000');
    store.setFinalDate('2025-01-01');
    store.setFinalAmount('60000');
    store.removeRow(store.form().rows[0].id);
    store.setRowDate(store.form().rows[0].id, '2024-06-01');
    store.setRowAmount(store.form().rows[0].id, '0');
    store.calculate();
    await fixture.whenStable();

    expect(el.querySelector('[data-field="totalReturn"]')!.classList).toContain('negative');
  });

  it('顯示註記', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    store.setInitialAmount('100000');
    store.setFinalDate('2025-01-01');
    store.setFinalAmount('0');
    store.removeRow(store.form().rows[0].id);
    store.setRowDate(store.form().rows[0].id, '2024-06-01');
    store.setRowAmount(store.form().rows[0].id, '0');
    store.calculate();
    await fixture.whenStable();

    expect(text(el, '[data-field="xirr"]')).toBe('-100.00%');
    expect(el.querySelector('.notes')?.textContent).toContain('本金全數損失');
  });

  it('顯示阻擋型錯誤', async () => {
    const { fixture, store, el } = await setup();
    store.calculate(); // 空表單
    await fixture.whenStable();

    expect(el.querySelectorAll('.errors li').length).toBeGreaterThan(0);
    expect(el.querySelector('.results')).toBeNull();
  });

  it('錯誤消失後改顯示結果', async () => {
    const { fixture, store, el } = await setup();
    store.calculate();
    await fixture.whenStable();
    expect(el.querySelector('.errors')).not.toBeNull();

    store.loadExample();
    store.calculate();
    await fixture.whenStable();
    expect(el.querySelector('.errors')).toBeNull();
    expect(el.querySelector('.results')).not.toBeNull();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/ui/results-panel/results-panel.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./results-panel`

- [ ] **Step 3: 寫元件**

`src/app/ui/results-panel/results-panel.ts`：

```ts
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
```

`src/app/ui/results-panel/results-panel.html`：

```html
@if (store.outcome()) {
  <section class="card">
    <h2>計算結果</h2>

    @if (failure(); as failed) {
      <ul class="errors">
        @for (issue of failed.errors; track issue.code + (issue.target.rowId ?? '')) {
          <li>{{ issue.message }}</li>
        }
      </ul>
    }

    @if (success(); as result) {
      <dl class="results">
        <div class="metric">
          <dt>總投入金額</dt>
          <dd data-field="totalInvested">{{ amount(result.metrics.totalInvested) }}</dd>
        </div>
        <div class="metric">
          <dt>總匯出金額</dt>
          <dd data-field="totalWithdrawn">{{ amount(result.metrics.totalWithdrawn) }}</dd>
        </div>
        <div class="metric">
          <dt>當前總部位</dt>
          <dd data-field="currentPosition">{{ amount(result.metrics.currentPosition) }}</dd>
        </div>
        <div class="metric">
          <dt>總報酬</dt>
          <dd
            data-field="totalReturn"
            [class.negative]="result.metrics.totalReturn < 0"
            [class.positive]="result.metrics.totalReturn > 0"
          >
            {{ amount(result.metrics.totalReturn) }}
          </dd>
        </div>
        <div class="metric highlight">
          <dt>年化報酬率 (XIRR)</dt>
          <dd
            data-field="xirr"
            [class.negative]="result.metrics.xirr < 0"
            [class.positive]="result.metrics.xirr > 0"
          >
            {{ percent(result.metrics.xirr) }}
          </dd>
        </div>
      </dl>

      @if (result.notes.length > 0) {
        <ul class="notes">
          @for (note of result.notes; track note.code) {
            <li>{{ note.message }}</li>
          }
        </ul>
      }
    }
  </section>
}
```

`src/app/ui/results-panel/results-panel.css`：

```css
.errors {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--danger);
}

.errors li + li {
  margin-top: 0.2rem;
}

.results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.8rem;
  margin: 0;
}

.metric {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.7rem 0.8rem;
}

.metric.highlight {
  border-color: var(--accent);
  background: #f2f6fe;
}

dt {
  font-size: 0.8rem;
  color: var(--muted);
}

dd {
  margin: 0.2rem 0 0;
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
}

dd.negative {
  color: var(--danger);
}

dd.positive {
  color: var(--positive);
}

.notes {
  margin: 1rem 0 0;
  padding-left: 1.2rem;
  font-size: 0.87rem;
  color: var(--muted);
}

.notes li + li {
  margin-top: 0.25rem;
}
```

- [ ] **Step 4: 掛進版面**

`src/app/app.ts` 的 `imports` 加入 `ResultsPanel`。`src/app/app.html` 把 `<app-results-panel />` 放在 `app-position-fields kind="final"` 之後、`<app-yaml-panel />` 之前。

- [ ] **Step 5: 執行測試確認通過**

```bash
npm test -- --include src/app/ui/results-panel/results-panel.spec.ts --watch=false
```

Expected: `Tests 6 passed (6)`

- [ ] **Step 6: Commit**

```bash
git add src/app/ui/results-panel src/app/app.ts src/app/app.html
git commit -m "feat: add results panel with metrics, notes and errors"
```

---

### Task 16: 動作列（計算／載入範例／清除全部）

**Files:**
- Create: `src/app/ui/action-bar/action-bar.ts`
- Create: `src/app/ui/action-bar/action-bar.html`
- Create: `src/app/ui/action-bar/action-bar.css`
- Modify: `src/app/app.ts`、`src/app/app.html`
- Test: `src/app/ui/action-bar/action-bar.spec.ts`

**Interfaces:**
- Consumes: `CalculatorStore`（Task 10）
- Produces: `ActionBar` 元件，selector `app-action-bar`

**確認機制**（spec §6）：「載入範例」與「清除全部」都會覆蓋既有資料。表單**非空**時顯示 inline 確認（**不可用 `window.confirm`**）；表單本來就空則直接執行，不打擾。確認狀態存在元件內部，不進 store——它是純粹的畫面暫態。

- [ ] **Step 1: 寫失敗的測試**

`src/app/ui/action-bar/action-bar.spec.ts`：

```ts
import { TestBed } from '@angular/core/testing';
import { CalculatorStore } from '../../state/calculator-store';
import { ActionBar } from './action-bar';

const setup = async () => {
  TestBed.configureTestingModule({ imports: [ActionBar] });
  const fixture = TestBed.createComponent(ActionBar);
  await fixture.whenStable();
  return {
    fixture,
    store: TestBed.inject(CalculatorStore),
    el: fixture.nativeElement as HTMLElement,
  };
};

const click = async (
  fixture: { whenStable: () => Promise<unknown> },
  el: HTMLElement,
  selector: string,
) => {
  el.querySelector<HTMLButtonElement>(selector)!.click();
  await fixture.whenStable();
};

describe('ActionBar', () => {
  it('計算按鈕觸發計算', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await click(fixture, el, '.calculate');
    expect(store.outcome()?.ok).toBe(true);
  });

  it('表單為空時載入範例不需確認', async () => {
    const { fixture, store, el } = await setup();
    await click(fixture, el, '.load-example');
    expect(store.form().rows).toHaveLength(2);
    expect(el.querySelector('.confirm-bar')).toBeNull();
  });

  it('表單非空時載入範例先顯示確認', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    await fixture.whenStable();

    await click(fixture, el, '.load-example');
    expect(el.querySelector('.confirm-bar')).not.toBeNull();
    expect(store.form().rows).toHaveLength(1); // 尚未執行
  });

  it('確認後才真的載入範例', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    await fixture.whenStable();
    await click(fixture, el, '.load-example');
    await click(fixture, el, '.confirm-yes');

    expect(store.form().rows).toHaveLength(2);
    expect(el.querySelector('.confirm-bar')).toBeNull();
  });

  it('取消確認不改動表單', async () => {
    const { fixture, store, el } = await setup();
    store.setInitialDate('2024-01-01');
    await fixture.whenStable();
    await click(fixture, el, '.clear-all');
    await click(fixture, el, '.confirm-no');

    expect(store.form().initial.date).toBe('2024-01-01');
    expect(el.querySelector('.confirm-bar')).toBeNull();
  });

  it('確認後才真的清除全部', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();
    await click(fixture, el, '.clear-all');
    await click(fixture, el, '.confirm-yes');

    expect(store.form().initial.date).toBe('');
    expect(store.form().rows).toHaveLength(1);
  });

  it('表單為空時清除全部不需確認', async () => {
    const { fixture, el } = await setup();
    await click(fixture, el, '.clear-all');
    expect(el.querySelector('.confirm-bar')).toBeNull();
  });

  it('確認訊息會說明是哪個動作', async () => {
    const { fixture, store, el } = await setup();
    store.loadExample();
    await fixture.whenStable();
    await click(fixture, el, '.load-example');
    expect(el.querySelector('.confirm-bar')?.textContent).toContain('載入範例');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test -- --include src/app/ui/action-bar/action-bar.spec.ts --watch=false
```

Expected: FAIL，找不到模組 `./action-bar`

- [ ] **Step 3: 寫元件**

`src/app/ui/action-bar/action-bar.ts`：

```ts
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
```

`src/app/ui/action-bar/action-bar.html`：

```html
<section class="action-bar">
  <button type="button" class="calculate primary" (click)="store.calculate()">
    計算報酬率
  </button>
  <button type="button" class="load-example" (click)="requestExample()">載入範例</button>
  <button type="button" class="clear-all" (click)="requestClear()">清除全部</button>
</section>

@if (pending()) {
  <div class="confirm-bar">
    <span>目前的資料會被覆蓋，確定要{{ confirmLabel() }}嗎？</span>
    <div class="confirm-actions">
      <button type="button" class="confirm-yes primary" (click)="confirm()">
        確定{{ confirmLabel() }}
      </button>
      <button type="button" class="confirm-no" (click)="cancel()">取消</button>
    </div>
  </div>
}
```

`src/app/ui/action-bar/action-bar.css`：

```css
.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.confirm-bar {
  margin-top: 0.8rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.7rem 0.9rem;
  background: #fff8e8;
  border: 1px solid #e0b551;
  border-radius: var(--radius);
  font-size: 0.9rem;
}

.confirm-actions {
  display: flex;
  gap: 0.5rem;
}
```

- [ ] **Step 4: 掛進版面**

`src/app/app.ts` 的 `imports` 加入 `ActionBar`。`src/app/app.html` 最終應為：

```html
<main class="page">
  <header class="page-header">
    <h1>XIRR 投資年化報酬率計算機</h1>
    <p class="lede">
      輸入期初部位、期間的資金進出與期末部位，計算考慮時間因素的真實年化報酬率。
    </p>
  </header>

  <app-position-fields kind="initial" />
  <app-cash-flow-table />
  <app-position-fields kind="final" />
  <app-action-bar />
  <app-results-panel />
  <app-yaml-panel />
</main>
```

- [ ] **Step 5: 執行測試確認通過**

```bash
npm test -- --include src/app/ui/action-bar/action-bar.spec.ts --watch=false
```

Expected: `Tests 8 passed (8)`

- [ ] **Step 6: 全部測試與建置**

```bash
npm test -- --watch=false && npm run build
```

Expected: 全綠，建置成功。

- [ ] **Step 7: Commit**

```bash
git add src/app/ui/action-bar src/app/app.ts src/app/app.html
git commit -m "feat: add action bar with inline overwrite confirmation"
```

---

### Task 17: 手動驗收

**Files:**
- Create: `docs/superpowers/plans/2026-09-12-xirr-acceptance.md`（驗收紀錄）

**Interfaces:**
- Consumes: 完成的應用程式
- Produces: 驗收紀錄文件

拖曳是整個專案最難用單元測試覆蓋、最依賴真實瀏覽器行為的部分，改以實際操作驗收（spec §8），不建 e2e 框架。

- [ ] **Step 1: 啟動開發伺服器**

```bash
npm start
```

在 `http://localhost:4200` 開啟。

- [ ] **Step 2: 用 Playwright 逐項操作並記錄結果**

拖曳驗收清單：

- [ ] 從日期格的把手（`⠿`）可拖曳整列
- [ ] 拖曳過程顯示放置佔位（虛線框）
- [ ] 放開後列順序正確，且各列的日期與金額**未錯位**
- [ ] 日期輸入框仍可點擊、可打字（未被拖曳把手攔截）
- [ ] 拖曳後按計算，結果與拖曳前一致（順序不影響 XIRR）

其餘功能驗收清單：

- [ ] 載入範例 → 五項結果為 150,000 / 30,000 / 145,000 / 25,000 / 19.35%
- [ ] 清除全部（表單非空）→ 先出現確認列，取消不動資料，確定才清空
- [ ] 複製某一筆 → 新列出現在原列正下方，日期與金額都被複製
- [ ] 把日期改成倒序後按計算 → 自動重排，並出現「已自動依日期重新排序」註記
- [ ] YAML 區塊在未編輯時跟隨表單變動
- [ ] 在 YAML 區塊打字 → 出現「尚未套用」標示，且此後表單變動不再覆蓋草稿
- [ ] 套用合法 YAML → 灌回表單、標示消失
- [ ] 套用有語法錯誤的 YAML → 顯示帶行號的錯誤，草稿保留
- [ ] 捨棄變更 → 回到跟隨表單
- [ ] 期初日期晚於期末 → 顯示「期初日期必須早於期末日期」
- [ ] 資金進出日期超出區間 → 對應列被標紅
- [ ] 必填欄位留空 → 錯誤訊息指到正確欄位
- [ ] 期末部位填 0 且無匯出 → 顯示 -100% 與本金全損註記，**不是錯誤**
- [ ] 視窗縮到手機寬度（約 400px）→ 版面不破、無水平捲動

- [ ] **Step 3: 寫驗收紀錄**

把每一項的實際結果記到 `docs/superpowers/plans/2026-09-12-xirr-acceptance.md`，未通過的項目附上畫面與說明。

- [ ] **Step 4: 修正驗收發現的問題**

若有未通過項目，逐一修正並補上對應的單元測試（若該問題可用單元測試覆蓋）。

- [ ] **Step 5: 最終驗證**

```bash
npm test -- --watch=false && npm run build
```

Expected: 全綠，建置成功。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: record manual acceptance results"
```
