# 無障礙錯誤關聯修正紀錄 — 2026-09-13

上一輪（`docs/fix-notes-p2.md` finding 4）只把 `aria-label`／`aria-invalid` 補上了資金進出表格，但沒有把欄位跟「實際的錯誤文字」連起來——螢幕報讀者只聽得到「這個欄位有問題」，卻不知道問題是什麼。本輪把三個表單元件（`cash-flow-table`、`position-fields`、`yaml-panel`）的錯誤訊息都就地渲染出來，並用 `aria-describedby` 把欄位指過去。

沒有動 `src/app/core/**`、`src/app/state/**`、`solver.ts`、`npv.ts`——三個元件都只是把 store 既有的 `issuesByRow()` / `generalIssues()` / `yamlError()` 讀得更完整（原本只呼叫 `.has()` 或做布林判斷，現在多取出 `message` 欄位），沒有新增任何 state 或驗證邏輯。

## 做法：每個欄位自己顯示自己的錯誤

`results-panel` 原本那個攤平的 `<ul class="errors">` 完全不動——它承載的是「沒有單一對應欄位」的錯誤（如期初/期末日期順序、無解），繼續留著。本輪新增的是「每個欄位旁邊」的訊息，兩處重複顯示同一句話是預期行為，不是 bug。

錯誤文字是**可見文字**，不是視覺隱藏的 `sr-only`：今天一個人若有三個欄位同時出錯，得在表格跟結果面板之間來回對照才能搞清楚哪句話對應哪個欄位，可見文字讓所有人（不只螢幕報讀者）都受益。

### 為什麼用 `aria-describedby` 而不是 `aria-errormessage`

`aria-errormessage` 語意更精準（明確表示「這是錯誤訊息」而非泛用說明），但目前主流輔助技術（尤其 VoiceOver）對它的支援仍不穩定，某些組合甚至完全不報讀被指向的內容。`aria-describedby` 支援普遍得多，缺點只是語意稍弱。三個元件都只採用 `aria-describedby`；沒有額外加 `aria-errormessage`，避免維護兩套幾乎等價的關聯卻只驗證一套的風險。

### 防止懸空關聯的手法

「有 `aria-describedby` 但指向的 id 不存在」比完全沒有這個屬性還糟——螢幕報讀者會嘗試讀取，讀到空氣。三個元件都用同一個模式讓這件事在結構上不可能發生：

```html
[attr.aria-describedby]="issueMessage(...) ? errorId(...) : null"
...
@if (issueMessage(...); as msg) {
  <p class="field-error" [id]="errorId(...)">{{ msg }}</p>
}
```

`aria-describedby` 是否存在，跟訊息元素是否渲染，都源自同一個 `issueMessage(...)` 的真假值；`id` 一律透過同一個 `errorId(...)`/`fieldErrorId(...)` 方法產生字串，屬性端與元素端不會各自拼字串而兜不起來。`cash-flow-table` 額外加了一個測試，直接走訪渲染出來的所有 `input[aria-describedby]`，逐一確認對應 id 在 DOM 中存在；`app.spec.ts` 則在組裝了全部三個元件的 `App` 上，對一個同時觸發多筆錯誤的表單做同樣的走訪斷言，作為最貼近真實使用情境的回歸測試。

## id 命名規則

| 元件 | 樣式 | 範例 |
|---|---|---|
| `cash-flow-table` | `cf-{{row.id}}-{{field}}-error` | `cf-row-3-amount-error` |
| `position-fields` | `pos-{{kind}}-{{field}}-error` | `pos-initial-date-error`、`pos-final-amount-error` |
| `yaml-panel` | 固定 `yaml-panel-error`（元件內只有一個欄位，不需要動態拼字） | `yaml-panel-error` |

`row.id` 本身已是元件內唯一（`nextId()` 遞增產生），`kind` 只有兩個值，兩者都天然避免跨列/跨欄位碰撞；不會與其他元件的 id 衝突，因為前綴（`cf-` / `pos-` / `yaml-panel-`）不重疊。

## 各元件的變動

### `cash-flow-table`

- **`cash-flow-table.ts`**：新增 `fieldIssueMessage(id, field)`，從既有的 `store.issuesByRow().get(id)` 找出對應 `field` 的 issue 並回傳其 `message`（沒有就回 `null`）；新增 `fieldErrorId(id, field)` 統一產生 `cf-{id}-{field}-error`。既有的 `fieldHasIssue()`／`rowHasError()` 完全不動。
- **`cash-flow-table.html`**：日期、金額欄位各自加上 `[attr.aria-describedby]`，並在各自的 cell 內新增 `@if` 區塊渲染 `<p class="field-error">`。日期欄原本 `.date-cell` 是「拖曳把手 + input」一列橫排的 flex 容器，直接把 `<p>` 塞進去會變成第三個橫排項目、把版面撐歪，因此新增一層 `.date-input-row` 把把手跟 input 包起來，`.date-cell` 改成直向排列（把手+input 一行、錯誤文字另起一行）；金額欄沒有這個問題，`<p>` 直接接在 input 後面即可。
- **`cash-flow-table.css`**：新增 `.date-input-row`（原本 `.date-cell` 的 flex 橫排規則搬過來）、`.field-error`（`color: var(--danger)`、`0.78rem`、`overflow-wrap: break-word`）、通用 `.cell { min-width: 0 }`（grid item 預設 `min-width: auto` 會被長錯誤文字撐開，導致 480px 窄螢幕下橫向溢出；加了這行才能讓文字正常換行而不是撐破格線）。480px media query 本身未變動，因為它調整的是欄寬比例，跟這次加的文字元素無關；有另外用瀏覽器層級檢查確認窄寬度下沒有出現水平捲軸（見下方 dump 前也做過手動核對欄寬）。

### `position-fields`

- **`position-fields.ts`**：把原本的 `hasIssue(field): boolean` 換成 `issueMessage(field): string | null`（回傳整個 issue 的 `message`），`dateInvalid`/`amountInvalid` 改成由 `dateErrorMessage()`/`amountErrorMessage()`（新的 `computed`）是否非 `null` 推導，維持既有語意；新增 `dateErrorId`/`amountErrorId` 兩個 `computed`，回傳 `pos-{kind}-{field}-error`。
- **`position-fields.html`**：兩個欄位補上先前完全缺失的 `[attr.aria-invalid]`，以及 `[attr.aria-describedby]` + `@if` 渲染的 `<p class="field-error">`。`[class.invalid]` 保持不動。
- **`position-fields.css`**：新增 `.field-error` 規則（`color: var(--danger)`，`0.8rem`）。

### `yaml-panel`

- **`yaml-panel.html`**：`textarea` 加上 `[attr.aria-invalid]="store.yamlError() ? 'true' : null"` 與 `[attr.aria-describedby]="store.yamlError() ? 'yaml-panel-error' : null"`；既有的 `<p class="yaml-error">{{ error }}</p>` 加上 `id="yaml-panel-error"`，文字（含「第 N 行」）完全不變。
- **`yaml-panel.ts`**：無需變動——`store.yamlError()` 已經是完整訊息字串，不需要額外的 lookup。
- **`yaml-panel.css`**：無需變動，`.yaml-error` 本來就用 `var(--danger)`。

## 新增測試

- `cash-flow-table.spec.ts`：有錯欄位的 `aria-describedby` 指向存在的元素且文字正確；沒錯欄位不帶 `aria-describedby` 也沒有錯誤元素；完全沒錯誤時兩個屬性都不存在；走訪所有 `input[aria-describedby]` 確認無懸空關聯。
- `position-fields.spec.ts`：有錯誤時 `aria-invalid`＋`aria-describedby` 皆正確關聯到對應文字；沒有錯誤時兩者皆不存在；只有其中一欄有問題時另一欄不受影響；期初與期末各自的 id 不互相衝突（同一測試內用 `TestBed.resetTestingModule()` 換另一個 `kind` 重新渲染）。
- `yaml-panel.spec.ts`：套用失敗時 `aria-invalid`＋`aria-describedby` 關聯到含行號的錯誤文字；沒有錯誤時兩者皆不存在；捨棄變更後兩者一併清除。
- `app.spec.ts`：組裝全部三個表單元件的 `App`，空表單直接按「計算報酬率」觸發期初、期末、資金進出列同時出錯，走訪畫面上每一個 `input`／`textarea`，斷言凡是帶 `aria-describedby` 的都能在 DOM 中找到對應 id（含防呆：先確認確實有欄位帶了這個屬性，避免測試因為選錯選擇器而空洞通過）。

## 測試與建置

- `npm test`（`ng test`，vitest）：**237 個測試全數通過**（baseline 225 + 本次新增 12）。
- `npm run build`：成功，無錯誤。
- 既有 225 項測試皆未修改、跳過或刪除。

## Dump：多欄位同時出錯時的 aria 屬性（實際執行輸出）

在 `App`（三個表單元件都掛載）上設定：期初日期已填但金額留空、期末日期留空但金額已填、唯一一列日期已填但金額留空，然後呼叫 `store.calculate()`。走訪畫面上所有 `input`／`textarea`，印出 `aria-label`、`aria-invalid`、`aria-describedby`，並實際用 `querySelector('#' + id)` 驗證是否解析得到：

```
label="(no aria-label)" invalid=null describedby=null resolves=n/a
  → 期初日期欄（合法，靠 <label> 原生關聯，本來就沒有也不需要 aria-label）

label="(no aria-label)" invalid="true" describedby="pos-initial-amount-error" resolves=YES ("請填寫期初部位金額")
  → 期初金額欄

label="第 1 筆資金進出的日期" invalid=null describedby=null resolves=n/a
  → 資金進出列日期欄（合法）

label="第 1 筆資金進出的金額" invalid="true" describedby="cf-row-1-amount-error" resolves=YES ("請填寫資金進出金額")
  → 資金進出列金額欄

label="(no aria-label)" invalid="true" describedby="pos-final-date-error" resolves=YES ("請填寫有效的期末部位日期")
  → 期末日期欄

label="(no aria-label)" invalid=null describedby=null resolves=n/a
  → 期末金額欄（合法）

label="(yaml textarea, aria-labelledby=yaml-panel-heading)" invalid=null describedby=null resolves=n/a
  → YAML textarea（此情境下尚未觸發解析錯誤，故無 aria-invalid/aria-describedby；套用非法 YAML 時的行為見 yaml-panel.spec.ts 的無障礙錯誤關聯測試）
```

七個欄位裡三個帶 `aria-describedby`，全部 `resolves=YES` 且訊息內容與欄位語意相符（期初部位金額／資金進出金額／期末部位日期），沒有欄位不帶任何屬性就被誤標，也沒有懸空關聯。此 dump 由暫時性測試腳本產生、驗證完畢後已移除，未留在程式庫中。

## 未變動／未處理事項

- `results-panel` 的摘要列表未變動（依需求，該處保留用於「無單一對應欄位」的錯誤）。
- **`aria-live` / `role="alert"` 在按下「計算」時主動宣告錯誤——刻意不在本輪處理**，維持現狀。這代表：若使用者已經聚焦在某個欄位上按下計算鍵，該欄位新出現的 `aria-describedby` 內容不會被主動朗讀，需要使用者自行重新聚焦該欄位才會聽到。這是已知、刻意留下的範圍外事項。
- 未新增任何依賴、未使用 Reactive/Signal Forms、`ngModel`、NgRx 或 Angular Material。
- 未觸碰 `src/app/core/**`、`src/app/state/**`（讀取的 `issue.message`／`yamlError()` 皆為既有欄位，無需改動 store 或 core）、`solver.ts`、`npv.ts`。
- 未對既有 225 項測試做任何弱化、跳過或刪除。
