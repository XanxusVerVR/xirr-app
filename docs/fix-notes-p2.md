# P2 修正紀錄 — 2026-09-12 程式碼審查

對應 `docs/2026-09-12-code-review.md` 的 finding 2、3、4。P1（solver 收斂判定，`solver.ts`）已在前一輪修正，本次未觸碰 `solver.ts` 與 `npv.ts`。

## Finding 2 — 無法解析的金額被當成空白列，無提示地略過

**位置：** `src/app/core/xirr/calculate.ts`

**問題：** `isBlankRow()` 只檢查 `date === ''` 與 `amount === null`，沒看 `amountText`。使用者打了 `abc`、`-`、`1,000` 這類無法解析成數字的內容時，`amount` 會是 `null`，於是這一列被誤判為「尚未使用」而整列跳過驗證與計算，計算照樣回報成功，使用者完全不會知道那筆資料沒被算進去。`1,000` 這個案例特別重要：結果面板本身就用千分位逗號顯示金額（如 `150,000`），使用者複製這種格式回填是很自然的操作。

**修正：** 空白列的判定加入第三個條件——原始輸入文字也必須是空的：

```ts
function isBlankRow(row: CashFlowRow): boolean {
  return row.date === '' && row.amount === null && row.amountText.trim() === '';
}
```

修正後，只要 `amountText` 有內容（即使解析失敗），該列就會進入 `validateRequired`，因為 `date === ''` 觸發 `MISSING_DATE`、`amount === null` 觸發 `MISSING_AMOUNT`，兩者都會標註在該列上，計算會被擋下而不是靜默成功。真正完全空白的列（日期、金額、原始文字皆未填）行為不變，仍會被略過。

**新增測試（`src/app/core/xirr/calculate.spec.ts`）：**
- `runCalculation — 無法解析的金額不算空白列（回歸 P2 finding 2）`
  - `amountText` 為 `'abc'`、`'-'`、`'1,000'`（`it.each`）時，日期留空的列會擋下計算，同時回報 `MISSING_DATE` 與 `MISSING_AMOUNT`，皆指向該列。
  - 真正空白的列（日期、金額、`amountText` 皆未填）仍被略過，計算照常成功（防止本次修正誤傷既有行為）。

**Before / After（實際執行 `runCalculation`，見下方「重現驗證」章節）：**
輸入：期初 `2024-01-01 / 1000`，期末 `2024-12-31 / 1100`，一列日期留空、金額文字為 `abc` / `-` / `1,000`。
- **修正前：** 成功，XIRR 10.00%，該列被靜默丟棄。
- **修正後：** 三種情況皆回傳失敗，錯誤為 `MISSING_DATE` 與 `MISSING_AMOUNT`，皆指向該列。

## Finding 3 — 負數期末部位被誤報為「期末為零、本金全損」

**位置：** `src/app/core/model/types.ts`、`src/app/core/xirr/validate.ts`

**決策（依需求指示）：** 期初部位與期末部位是「持有部位」，語意上不可為負數；**列**（資金進出）代表一筆匯出/匯入，負數是合法的提款，不受此限制。`0` 對兩個部位皆合法（期初可從零開始定期定額；期末可為本金全損）。

**修正：**
1. `types.ts`：在 `IssueCode` 聯集加入 `'NEGATIVE_POSITION'`。
2. `validate.ts`：`checkPosition()` 在金額非 null 且為負數時，回報 `NEGATIVE_POSITION`，訊息帶出欄位名稱（`「${label}是持有部位，金額不可為負數」`，`label` 為「期初部位」或「期末部位」），`target` 指向該部位的 `amount` 欄，好讓 UI 高亮對應欄位。這個檢查在 `validateRequired()` 內執行，發生於排序與 `resolveForm` 之前，因此負數部位會在進入全損特判分支之前就被擋下。
3. `calculate.ts` 的全損分支（`TOTAL_LOSS` 訊息）**未變動**——一旦負數期末部位被擋在驗證階段，該分支只可能在期末部位恰為 `0` 時觸發，原本的訊息本來就是對的。

**新增測試：**
- `src/app/core/xirr/validate.spec.ts`：期初負數、期末負數各自被擋下並回報 `NEGATIVE_POSITION`、正確的 `target`；列的負數金額仍合法（`validateRequired` 回傳空陣列）。
- `src/app/core/xirr/calculate.spec.ts`（`runCalculation — 負數部位擋下計算`）：端對端驗證期末負數、期初負數皆被 `runCalculation` 擋下；期末恰為 `0` 時仍給出 `-100%` 與 `TOTAL_LOSS`（不受影響，防止回歸）；資金進出列的負數金額仍照常計算。

**Before / After（實際執行 `runCalculation`）：**
輸入：期初 `2024-01-01 / 1000`，期末 `2024-12-31 / -500`，無資金進出列。
- **修正前：** 成功，XIRR = -100.00%，當前總部位 = -500，註記「期末部位為 0 且期間沒有任何資金匯出，本金全數損失」——與畫面顯示的 -500 自相矛盾。
- **修正後：** 失敗，`NEGATIVE_POSITION`，訊息「期末部位是持有部位，金額不可為負數」，`target = { kind: 'final', field: 'amount' }`。

期末恰為 `0` 的既有案例（`[D] 本金全損`）行為不變：仍是成功、`-100%`、附 `TOTAL_LOSS` 註記。

## Finding 4 — 資金進出欄位缺少可供輔助技術識別的標籤

**位置：** `src/app/ui/cash-flow-table/cash-flow-table.html`、`cash-flow-table.ts`

**問題：** 每列的日期與金額 `<input>` 沒有 `<label>`、`aria-label` 或 `aria-labelledby`；欄名只是 `.flow-head` 底下獨立的 `<span>`，未與任何欄位關聯。畫面上也沒有依欄位精確標示 `aria-invalid`——`rowHasError()` 只回報「這一列有沒有錯」，沒有指出是哪個欄位。

**修正：**
1. `@for (... ; track row.id; let i = $index)` 取得列序號，日期與金額欄位各自加上 `[attr.aria-label]`：
   - 日期：`'第 ' + (i + 1) + ' 筆資金進出的日期'`
   - 金額：`'第 ' + (i + 1) + ' 筆資金進出的金額'`
2. `cash-flow-table.ts` 新增 `fieldHasIssue(id, field)`，從 `store.issuesByRow()` 取出該列的 issue 清單，比對 `issue.target.field`，只標記真的有問題的那個欄位（而不是整列都標記）。
3. 模板上兩個欄位各自綁定 `[attr.aria-invalid]="fieldHasIssue(row.id, 'date'/'amount') ? 'true' : null"`——沒問題時整個屬性移除，而不是留著 `aria-invalid="false"`。
4. `rowHasError()`（驅動 `.has-error` class 的整列樣式）保留不動。

**新增測試（`src/app/ui/cash-flow-table/cash-flow-table.spec.ts`，`無障礙標籤（回歸 P2 finding 4）`）：**
- 第一列日期／金額欄位的 `aria-label` 同時包含列號（「第 1 筆」）與欄位用途（「日期」／「金額」）。
- 新增一列後，第二列標籤正確顯示「第 2 筆」。
- 複製一列後，新插入列的標籤依實際位置正確顯示「第 2 筆」。
- 造出「金額留空、日期已填」的驗證錯誤後，金額欄位有 `aria-invalid="true"`，同列的日期欄位沒有。

**Before / After：**
- **修正前：** `aria-label` 數量為 0（日期、金額欄位皆無任何可存取名稱）；`aria-invalid` 完全未使用。
- **修正後（實際跑測試確認）：** 每個欄位的 `aria-label` 含列號與欄位用途，例如 `第 1 筆資金進出的日期`／`第 1 筆資金進出的金額`；新增／複製後編號正確跟隨實際位置；有問題的欄位帶 `aria-invalid="true"`，同列另一欄位不帶。

## 重現驗證（直接執行核心模組，非斷言）

用 `npx tsx` 直接 import `src/app/core/xirr/calculate.ts` 的 `runCalculation`，重現三則書面案例：

**Finding 2 — `amountText` 為 `abc` / `-` / `1,000`（日期留空，期初 2024-01-01/1000、期末 2024-12-31/1100）：**

三種情況皆輸出一致：
```json
{
  "ok": false,
  "errors": [
    { "code": "MISSING_DATE", "message": "請填寫有效的資金進出日期",
      "target": { "kind": "row", "rowId": "bad", "field": "date" } },
    { "code": "MISSING_AMOUNT", "message": "請填寫資金進出金額",
      "target": { "kind": "row", "rowId": "bad", "field": "amount" } }
  ]
}
```

**Finding 3 — 期初 2024-01-01/1000、期末 2024-12-31/-500、無資金進出列：**

```json
{
  "ok": false,
  "errors": [
    { "code": "NEGATIVE_POSITION", "message": "期末部位是持有部位，金額不可為負數",
      "target": { "kind": "final", "field": "amount" } }
  ]
}
```

## 測試與建置

- `npm test`（`ng test`，vitest）：**225 個測試全數通過**（baseline 210 + 本次新增 15）。
- `npm run build`：成功，無錯誤。
- Git 樹狀態：僅本次修改的 8 個檔案（`types.ts`、`calculate.ts`、`validate.ts`、`cash-flow-table.ts`/`.html` 及三份對應 `.spec.ts`），無其他變更。

## 未變動 / 未處理事項

- 未觸碰 `solver.ts`、`npv.ts`（依指示，P1 已於前一輪修正）。
- 未新增任何依賴、未使用 Reactive/Signal Forms、`ngModel`、NgRx 或 Angular Material。
- 未對既有 210 項測試做任何弱化、跳過或刪除。
