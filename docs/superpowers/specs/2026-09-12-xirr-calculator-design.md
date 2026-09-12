# XIRR 投資年化報酬率計算機 — 設計文件

日期：2026-09-12
來源規格：`docs/spec.md`
參考架構：https://www.laneto.co/xirr-calculator

## 1. 目標與範圍

做一個純靜態前端的 XIRR 計算機，使用者輸入期初部位、資金進出記錄、期末部位，得到年化報酬率與四項彙總數字。

### 範圍內

- 三個輸入區塊：期初部位、資金進出記錄、期末部位
- 清除全部、載入範例
- 資金進出記錄：拖曳排序、複製某一筆、送出時自動依日期排序
- YAML 輸入區塊，含格式說明
- 五項計算結果：總投入金額、總匯出金額、當前總部位、年化報酬率 (XIRR)、總報酬

### 範圍外（明確不做）

- **多幣別與匯率**。單一幣別，每列只有日期與金額。原規格的「載入外幣範例不需實作」解讀為整條外幣路徑都不做，而非僅少一顆按鈕；計算結果也只列一個 XIRR，沒有原幣／台幣之分。
- 參考網站的說明欄、FAQ
- 資料持久化（localStorage、後端）
- 路由、SSR
- e2e 測試框架（拖曳改以 Playwright 手動驗收，見 §8）

## 2. 技術選型

| 套件 | 版本 | 說明 |
|---|---|---|
| `@angular/core` / `@angular/cli` | **22.1.6** | 規格指定；亦為撰寫當下的 latest |
| `@angular/cdk` | **22.1.6** | 僅用 `drag-drop`，**不裝 Angular Material** |
| `js-yaml` | **5.4.1** | 自帶 `.d.ts` |

### 決定與理由

- **只裝 CDK 不裝 Material**：拖曳排序是本專案最容易做壞的互動（拖曳預覽、佔位、放開後索引計算、觸控支援），`@angular/cdk/drag-drop` 已處理完備且可獨立安裝。手刻拖曳會在邊界情況上花掉不成比例的時間；引入整套 Material 則會為了一個功能綁上其視覺體系，而本頁只有表單與一張表格。樣式自行撰寫 CSS，日期用原生 `<input type="date">`。
- **不裝 `@types/js-yaml`**：該套件停在 4.0.9，與 js-yaml 5 自帶型別衝突。
- **不引入 NgRx**：狀態只有一份表單資料與一份計算結果，action/reducer/effect 三層在此純屬樣板成本。改用 signal-based store。
- **zoneless**：狀態全為 signal，保留 zone.js 只是多一份 runtime 負擔。

### 版本鎖定

`package.json` 中 Angular 三個套件使用精確版號（不加 `^`），避免 `npm install` 悄悄跳版。`engines` 欄位寫入 Node 需求：`^22.22.3 || ^24.15.0 || >=26.0.0`（取自 `@angular/core@22.1.6`）。

### 專案初始化

```
ng new xirr-app --directory . --style=css --test-runner=vitest \
  --zoneless --ssr=false --routing=false --ai-config=claude-code
```

- Angular 22.1.6 的 `--test-runner` 預設即為 `vitest`，不需 Karma/Jasmine。
- 檔名風格採預設的 `2025` style guide：component 檔為 `results-panel.ts`，非 `results-panel.component.ts`。
- **注意**：專案目錄非空（已有 `.git`、`docs/`、`.gitignore`）。`ng new` 會擋下，而 `--force` 會覆蓋現有的 `.gitignore`。實作時必須**先 scaffold 到暫存目錄再搬入**，保留既有 `.gitignore` 並附加 Angular 所需項目。

## 3. 架構

核心原則：**XIRR 計算完全隔離在 Angular 之外**，是一組不 import 任何 Angular 的純 TypeScript 函式，可用毫秒級的 unit test 反覆驗證數學正確性。

```
src/app/
├── core/
│   ├── model/types.ts       介面定義，無邏輯
│   ├── xirr/
│   │   ├── npv.ts           淨現值與其導數
│   │   ├── solver.ts        Newton-Raphson + bisection
│   │   ├── metrics.ts       五項彙總數字
│   │   └── validate.ts      阻擋型與註記型檢查
│   └── yaml/
│       ├── serialize.ts     表單狀態 → YAML 字串（手寫模板）
│       └── parse.ts         YAML 字串 → 表單狀態（js-yaml + 格式驗證）
├── state/calculator-store.ts    signal-based，唯一的可變狀態
├── ui/
│   ├── initial-position/    期初部位
│   ├── cash-flow-table/     資金進出記錄（拖曳、複製、刪除）
│   ├── final-position/      期末部位
│   ├── yaml-panel/          YAML 編輯區 + 格式說明
│   ├── results-panel/       五項結果 + 註記
│   └── action-bar/          載入範例 / 清除全部 / 計算
└── app.ts                   組合版面
```

**依賴方向單向**：`ui → state → core`。core 不知道 state 存在，state 不知道 ui 存在。

### 狀態管理

signal store（`WritableSignal` + `computed`）對外只暴露意圖明確的方法：`addRow()`、`removeRow(id)`、`duplicateRow(id)`、`moveRow(from, to)`、`setRowDate(id, v)`、`setRowAmount(id, v)`、`applyYaml(text)`、`loadExample()`、`clearAll()`、`calculate()`。UI 元件只呼叫這些，不直接改陣列。

### 計算觸發時機

**結果只在按下「計算報酬率」時產生**，之後停在畫面上直到下次計算。不使用 `computed` 即時重算——那會讓使用者打字打到一半就看到閃爍的錯誤訊息與中間值；且「送出後自動依日期排序」本來就假定存在一個明確的提交時機。

### 元件如何取得狀態

**元件直接注入 store**，不做 input/output 轉接。`cash-flow-table` 有六種互動（新增、刪除、複製、拖曳、改日期、改金額），全走 `output()` 會變成一長串樣板，而上層只是原封不動轉給 store。signal store 無 HTTP 等外部依賴，測試時直接 new 一個真的 store 即可。

**不用 Reactive Forms，也不用 `ngModel`**，直接原生 `[value]` + `(input)` 綁到 store 方法。真相只能有一份：驗證邏輯在 core、狀態在 store，再疊 `FormGroup` 會出現兩套並行的值與錯誤狀態，後續 bug 都會源自它們不同步。

## 4. 資料模型

### 日期一律用 `'YYYY-MM-DD'` 字串

不用 `Date` 物件。`<input type="date">` 本就綁字串；`new Date('2024-01-01')` 會被當成 UTC 午夜，在 UTC+8 顯示成前一天，是這類計算機最經典的 off-by-one。計算折現期間時直接用 `Date.UTC(y, m-1, d)` 求 epoch day 相減，全程不碰本地時區。

### 輸入層（允許半填狀態）

```ts
interface CashFlowRow {
  id: string;              // 穩定識別碼，給 @for track 與 cdkDrag 用
  date: string;            // 'YYYY-MM-DD'，未填為 ''
  amount: number | null;   // 未填為 null
}

interface CalculatorForm {
  initial: { date: string; amount: number | null };
  rows: CashFlowRow[];
  final:   { date: string; amount: number | null };
}
```

- `amount` 用 `number | null` 而非 `number`：**「沒填」與「填 0」必須分得開**。期末部位填 0 是合法輸入（全損），空白則是錯誤。
- 每列帶穩定 `id`：拖曳排序的前提。用陣列索引當 key 在拖曳後會錯位。

### 計算層（已驗證、已轉符號）

```ts
interface CashFlow {
  epochDay: number;   // 距 1970-01-01 的天數（UTC）
  amount: number;     // XIRR 慣例：流出為負、流入為正
}
```

UI 的「正數 = 投入」在跨進 core 的那一刻翻成 XIRR 慣例，core 內部不再有任何符號轉換。

### 輸出

```ts
type Outcome =
  | { ok: true;  metrics: Metrics; notes: Note[] }
  | { ok: false; errors: ValidationIssue[] };

interface Metrics {
  totalInvested: number;
  totalWithdrawn: number;
  currentPosition: number;
  totalReturn: number;
  xirr: number;   // ok: true 時必為數值。全損特判為 −1（即 −100%）
}

interface Note {
  code: 'SORTED' | 'TOTAL_LOSS' | 'MULTIPLE_ROOTS' | 'EXTREME_RATE';
  message: string;
}

interface ValidationIssue {
  code: 'MISSING_DATE' | 'MISSING_AMOUNT' | 'DATE_ORDER'
      | 'DATE_OUT_OF_RANGE' | 'NO_INVESTMENT';
  message: string;
  target: { kind: 'initial' | 'final' | 'row'; rowId?: string; field: 'date' | 'amount' };
}
```

用 discriminated union 強迫呼叫端處理失敗。`target` 是「錯誤訊息能指到出問題那一列」的關鍵：results panel 取得 issue 後把 `rowId` 傳回表格做高亮。

## 5. YAML 格式

畫面上固定顯示的格式說明，內容即下列範例：

```yaml
initial:
  date: 2024-01-01
  amount: 100000

flows:
  - date: 2024-03-15
    amount: 50000      # 正數 = 資金投入
  - date: 2024-08-20
    amount: -30000     # 負數 = 資金匯出

final:
  date: 2025-01-01
  amount: 145000
```

### 解析（`parse.ts`，用 js-yaml）

- 以 `{ schema: yaml.CORE_SCHEMA }` 載入。js-yaml 5 的預設已是 YAML 1.2 core schema（無 timestamp 型別），日期會維持字串；顯式指定是防止未來改版漂移的護欄。自動轉 `Date` 只發生在明確指定 `YAML11_SCHEMA` 時。
- **解析使用者輸入是安全的**：`!!js/function` 等危險標籤會被擋下並丟 `YAMLException`，不需額外沙箱。
- 語法錯誤的例外帶有 `e.mark.line`，錯誤訊息**必須回報行號**，而非只說「YAML 格式錯誤」。
- 結構驗證手寫（約 60 行），不引入 zod。

### 序列化（`serialize.ts`，手寫模板）

**不可用 `yaml.dump`**。其輸出會把日期加上引號（`date: '2024-01-01'`），並丟失所有註解與分組空行——而那些正是讓此區塊能兼作格式說明的東西。手寫約 25 行字串模板，完全控制排版。

方向不對稱是刻意的：手寫解析器不划算，手寫序列化器很划算。

## 6. 互動行為

### 拖曳排序

原規格寫「拖曳每一列的日期」。日期欄是 `<input type="date">`，若整格當拖曳把手，使用者就點不進去打字。

做法：**在日期儲存格內放一個獨立的把手圖示（`⠿`）**，`cdkDragHandle` 掛在把手上，`cdkDrag` 掛在整列。既保留「從日期那一格拖曳」的意圖，輸入框也仍可用。整列跟著移動、放置佔位、觸控支援皆由 `cdkDropList` 處理。

### 複製某一筆

每列一顆複製鈕，**複製日期與金額兩者**，插在原列正下方，焦點移到新列的日期欄。複製日期是刻意的：規格目的是「減少重複輸入一樣的內容」，同一天常有多筆進出，留著讓使用者只改需要改的欄位，比清空更省事。

### 自動排序與執行順序

按下計算後，若日期非遞增則就地排序。**執行順序不可調換**：

1. 必填檢查（日期、金額空白）→ 有錯即停，不排序
2. 依日期升冪排序 rows
3. 其餘驗證：期初 ≥ 期末、進出日期超出區間、現金流符號檢查
4. 計算

必填檢查必須在排序之前——沒有日期的列無法參與排序。此順序同時決定了：**資金進出的日期順序永遠不會產生錯誤**（在驗證前就被排好），`DATE_ORDER` 只適用於期初 vs 期末。

排序若實際改動了順序，結果區顯示 `SORTED` 註記告知；否則列的位置突然跳動會被誤認為 bug。

### YAML 區塊的同步邊界

YAML 是表單的可編輯視圖（單向匯入／匯出，非雙向即時同步）。衝突在於：表單改動時 YAML 需重新序列化，但若使用者正在 textarea 打字尚未套用，重新序列化會蓋掉他的輸入。

解法是給 YAML 區塊一個 **dirty 狀態**：

| 狀態 | 行為 |
|---|---|
| 乾淨（未動過 textarea） | 表單一有變動就重新序列化，YAML 永遠反映當前表單 |
| 髒（在 textarea 打過字） | **停止**從表單同步，顯示「尚未套用」標示 + 「捨棄變更」按鈕 |

- 按「套用 YAML」：解析成功 → 灌回表單、轉乾淨；解析失敗 → 保留文字、顯示錯誤（含行號）、維持髒
- 「載入範例」「清除全部」：無條件覆蓋並轉乾淨——這兩個動作本就是明示的重置

選擇單向而非雙向即時同步的理由：雙向時「YAML 打到一半語法還不合法」難以處理，每打一個字都要決定是否清空表單，體驗會抖；且自動排序與拖曳排序都會反寫 YAML，覆蓋掉編輯中的內容與游標位置。

### 清除全部 / 載入範例

兩者都會覆蓋既有資料。表單非空時跳一個自製的 inline 確認（**不用 `window.confirm`**）；表單本來就空則直接執行，不打擾。清除後保留一列空白 row，讓使用者可直接開始輸入。

## 7. 計算核心

### 時間軸

```
t_i = (epochDay_i − epochDay_0) / 365
```

`epochDay_0` 為期初部位的日期。分母用 **365**（非 365.25、非實際曆法天數）——這是 Excel `XIRR` 的慣例，使用者很可能拿 Excel 對答案，與它一致比「數學上更精確」重要。

### 方程式

```
NPV(r)  = Σ  cf_i / (1 + r)^t_i  = 0
NPV'(r) = Σ  −t_i · cf_i / (1 + r)^(t_i + 1)
```

### Solver：Newton-Raphson 為主，bisection 保底

Newton 從 `r = 0.1` 起步，最多 100 次迭代。遇下列任一情況立即放棄並轉交 bisection：

- `r ≤ −1`（跳出定義域，`(1+r)^t` 無意義）
- `NPV'` 接近 0（除法會把 r 甩飛）
- 出現 `NaN` / `Infinity`

收斂判準用**相對**誤差：`|NPV| < 1e-9 × max|cf_i|`。用絕對誤差會有量級問題——同樣的閾值對本金一萬過於嚴格，對本金一億則形同虛設。

Bisection 區間左端固定 `−0.9999`；**右端從 `1.0` 開始倍增直到 NPV 變號**，終止條件為倍增 1000 次或 `hi` 溢位。

> **不可使用固定上限。** 初版設計曾訂上限 `1e7`，實測發現「一天翻倍」（`−100 @ 1/1`、`+200 @ 1/2`）的真解是 `2^365 − 1 ≈ 7.5153e109`，遠超該上限，導致倍增迴圈尚未碰到變號就撞頂，**誤報無解**。改為倍增至變號後，實測結果 `7.515336e+109` 與 `2^365 − 1` 吻合。

### 極端值顯示

`EXTREME_RATE` 註記與顯示夾制是**兩個不同的閾值**，不可混淆：

- **註記閾值**：`r < −0.99` 或 `r > 10`（低於 −99% 或高於 +1000%）→ 附 `EXTREME_RATE` 註記，數值仍照常顯示。
- **顯示夾制閾值**：`r > 1e6`（1 億 %）→ 顯示為「> 100,000,000%」，不印出無意義的精確值。此情況必然同時帶 `EXTREME_RATE` 註記。

顯示夾制屬 UI 層職責，core 一律回傳原始數值。

### 符號檢查的兩個方向

方程式要有解，現金流序列必須同時出現正值與負值。同號有兩個方向，處理方式相反：

| 情況 | 意義 | 處理 |
|---|---|---|
| 現金流**全部 ≤ 0**（只有投入，期末 0） | 本金全部虧光 | 特判為 **−100%**，加 `TOTAL_LOSS` 註記，不報錯 |
| 現金流**全部 ≥ 0**（只有匯出，期末 0） | 沒投入過錢卻一直提款 | **阻擋**，`NO_INVESTMENT`：沒有任何資金投入 |

**期初部位填 0 是合法的**——代表從零開始定期定額，第一筆真正的投入在資金進出裡。故必填檢查只看「有沒有填」，不看「是不是大於 0」。

### 錯誤分級

**阻擋型**（`ValidationIssue`，帶 `target` 指到出問題的欄位）：

`MISSING_DATE`、`MISSING_AMOUNT`、`DATE_ORDER`（期初 ≥ 期末）、`DATE_OUT_OF_RANGE`（進出日期落在期初～期末之外）、`NO_INVESTMENT`、`UNSOLVABLE`

`UNSOLVABLE` 是實作計畫階段補上的：現金流正負皆有、理論上應有解，但 solver 仍找不到根。少了它，計算管線就會有一條無法回報的分支。實務上不應觸發。

**註記型**（照算，結果旁附說明）：

| 代碼 | 觸發條件 |
|---|---|
| `SORTED` | 排序實際改動了列順序 |
| `TOTAL_LOSS` | 本金全損，XIRR 特判為 −100% |
| `MULTIPLE_ROOTS` | 符號變換 ≥ 2 次，理論上可能存在多組解，此結果為其中之一 |
| `EXTREME_RATE` | 結果低於 −99% 或高於 +1000% |

關於 `MULTIPLE_ROOTS`：根的數量上限等於現金流的符號變換次數（笛卡兒符號法則），典型的「先投入、最後收回」只變換一次，保證唯一解。符號變換 ≥ 2 次**只是必要條件而非充分條件**——真實投資記錄（定期定額 + 中途部分賣出 + 再買回）常變換多次卻幾乎都只有一個經濟上合理的根。因此**不做多重解偵測**（昂貴且不可靠），僅附註記。

### 彙總數字用 UI 符號計算

```ts
totalInvested   = initial.amount + Σ max(row.amount, 0)
totalWithdrawn  = Σ max(−row.amount, 0)
currentPosition = final.amount
totalReturn     = currentPosition + totalWithdrawn − totalInvested
```

**期末部位視為未實現，不計入總匯出**。「總匯出金額」反映實際已取回的錢；期末部位是仍在市場裡的未實現部位，混在一起會讓「當前總部位」與「總匯出金額」語意重疊。如此四個數字構成可驗算的恆等式：

```
總報酬 = 當前總部位 + 總匯出 − 總投入
```

刻意**不從已翻好符號的 `CashFlow[]` 反推**——那會變成「翻成負的再翻回來」，是未來符號錯誤的溫床。`metrics.ts` 直接吃原始輸入，`solver.ts` 吃翻過符號的陣列，兩條路徑獨立。

### 顯示格式

金額千分位、無小數；XIRR 百分比至小數 2 位；`totalReturn` 為負時以顏色區分。

## 8. 測試策略

**採 TDD**：先寫失敗的測試再寫實作。核心的 solver 是純函式，測試跑起來是毫秒級。

### 第 1 層：core 純函式（絕大多數測試，不需 TestBed）

已驗證的黃金值直接寫入測試檔：

| 案例 | 輸入 | 預期 |
|---|---|---|
| A | `−1000 @ 2024-01-01`、`+1100 @ 2024-12-31` | `10.000000%`（解析解，可手算驗證） |
| B | §5 的 YAML 範例資料 | `19.353321%` |
| C | `−100000 @ 1/1`、`+120000 @ 4/1`、`−80000 @ 7/1`、`+75000 @ 次年 1/1` | `29.650138%` + `MULTIPLE_ROOTS` |
| E | `−100 @ 1/1`、`+200 @ 1/2` | `EXTREME_RATE`，`r ≈ 7.515336e109` |
| F | `−100 @ 1/1`、`+101 @ 1/2` | `≈ 3678.343%` + `EXTREME_RATE` 註記；**未**觸發顯示夾制 |
| D | `−100000 @ 1/1`、`0 @ 次年 1/1` | `TOTAL_LOSS`，`−100%` |
| G | 期初 0、僅有匯出、期末 0 | 阻擋，`NO_INVESTMENT` |

B 的彙總數字驗算：總投入 150000、總匯出 30000、當前部位 145000、總報酬 25000。

再加兩個**性質測試**（比固定案例更能抓到符號與時間軸的錯誤）：

- **反解往返**：隨機取 `r` 與一組日期，反推出必然收斂到 `r` 的現金流，丟進 solver 應解回同一個 `r`
- **恆等式**：對任意合法輸入，`總報酬 === 當前總部位 + 總匯出 − 總投入` 必須成立

YAML 層同樣用往返性質測試：`parse(serialize(form))` 必須等於 `form`。

### 第 2 層：store（vitest，仍不需 TestBed）

驗證意圖方法的行為契約：

- `duplicateRow` 插在原列正下方且 id 不重複
- `moveRow` 的索引計算
- `applyYaml` 的 dirty 狀態轉換（乾淨→髒→套用→乾淨；套用失敗時維持髒）
- `calculate` 的執行順序（必填檢查 → 排序 → 其餘驗證 → 計算）

### 第 3 層：元件（TestBed + vitest，刻意寫得薄）

只測「狀態正確反映到畫面」：結果面板渲染五個數字、錯誤的 `target.rowId` 確實讓對應列高亮、YAML 髒掉時「尚未套用」標示出現。不重複測第 1、2 層已覆蓋的邏輯。

### 拖曳：手動驗收，不寫自動化測試

拖曳是本專案最難用單元測試覆蓋、最依賴真實瀏覽器行為的部分。與其為單一互動架起整套 e2e 框架，改以 Playwright 實際操作驗收。**驗收清單**：

- [ ] 從日期格的把手可拖曳整列
- [ ] 拖曳過程顯示放置佔位
- [ ] 放開後列順序正確，且各列的日期與金額未錯位
- [ ] 日期輸入框仍可點擊、可打字（未被拖曳把手攔截）
- [ ] 拖曳後按計算，結果與拖曳前一致（順序不影響 XIRR）

其餘功能一併做一輪手動驗收：清除全部、載入範例、複製某一筆、自動排序註記、YAML 套用成功與失敗、各項阻擋型錯誤能指到正確欄位。

## 9. 決策摘要

| 決策 | 選擇 | 主要理由 |
|---|---|---|
| 幣別 | 單一幣別，無匯率 | 結果只列一個 XIRR；YAML 格式更乾淨 |
| YAML 同步 | 單向匯入／匯出 + dirty 狀態 | 雙向同步在語法未完成時體驗會抖，且會被排序覆蓋 |
| UI 依賴 | 僅 CDK，手寫 CSS | 拖曳交給成熟實作，視覺不被 Material 綁架 |
| 期末部位 | 視為未實現，不計入總匯出 | 語意不重疊，四數字構成可驗算恆等式 |
| 錯誤處理 | 分級（阻擋 / 註記） | 能事先判定的不讓使用者猜；能算但不可靠的仍給數字並誠實標註 |
| 狀態管理 | signal store | NgRx 三層樣板在此規模純屬成本 |
| 計算觸發 | 明確按鈕觸發 | `computed` 即時重算會讓打字過程出現閃爍的錯誤與中間值 |
| 表單 | 原生 binding，無 Reactive Forms | 避免狀態與驗證出現兩份真相 |
| 測試 | 重 core、薄元件、拖曳手動 | 價值集中在數學正確性，e2e 框架不划算 |
