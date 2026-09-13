# 日期欄位分段編輯修正紀錄 — 2026-09-13

## 問題

使用者回報：選好日期（例如 `2026/02/06`）後，點進欄位、移到 **MM** 分段、按下 `0`，整個欄位被清成 `yyyy/mm/dd`，store 裡的日期也變空。三個日期欄位（`cash-flow-table` 的列日期、`position-fields` 的 `initial`／`final` 日期）共用同一個綁定模式，全部中招。

使用者的期待：輸入完日期後，按下一個數字應該**只改動那一段**，例如把月份重打成 `03`。

## 根因

跟先前修過的金額欄位「減號被吃掉」是同一種機制，只是往瀏覽器底層再深一層：

1. 在 MM 段打 `0`，會讓日期暫時「不完整」。
2. 依 HTML 規範，`<input type="date">` 只要日期不完整，`.value` 一律回報 `''`——尚未打完的各段落只存在瀏覽器內部的編輯緩衝區，不會反映在 `.value`。
3. `(input)` 事件觸發 → 原本的 `onDate` 直接呼叫 `setRowDate(id, '')` → store 的日期被寫成 `''`。
4. `[value]="row.date"` 綁定的來源從 `'2026-02-06'` 變成 `''`。
5. Angular 偵測到綁定值改變，把 `el.value = ''` 寫回 DOM——這個**寫入動作本身**會重置瀏覽器內部所有分段的編輯緩衝區，即使當時 `.value` 讀出來也已經是 `''`。讀取 `''` 跟主動賦值 `''` 對瀏覽器來說是兩件事：前者只是回報現狀，後者是一個明確的「清空」指令，會把使用者還沒打完的其他分段一併炸掉。

## 為什麼金額欄位用的 `amountText` 解法搬不過來

金額欄位是 `type="text"`，能把使用者打到一半的原始字串（例如 `"-"`、`"-0"`）原封不動存進 `amountText`，靠它撐住 `[value]` 綁定，繞過瀏覽器對 `type="number"` 的清空行為。

日期欄位沒有對應的「原始文字」可以存：分段緩衝區是瀏覽器內部狀態，`.value` 只會回報完整日期或 `''`，兩者之間沒有中間態可以讀取或還原。硬要模仿 `amountText` 存一個「部分日期字串」，既讀不到真正的分段內容，也無法組回一個合法的 `[value]`（`<input type="date">` 的 `value` 只接受 `yyyy-MM-dd` 或空字串）。因此這次不比照 `amountText`，而是換一个角度：**不要在事件裡去猜使用者打到哪、打了什麼，而是判斷「現在能不能相信這個空字串代表使用者真的要清空」**。

## 修法：input 只在非空時寫回，清空留給 blur

規則：**日期輸入框回報空字串，在欄位還有焦點時代表「還沒打完」，只有在失焦後才代表「清空」。**

對三個日期欄位（`cash-flow-table` 列日期、`position-fields` 的 `initial`／`final`）都套用同一模式：

- **`(input)`**：新值非空才呼叫對應的 setter（`setRowDate` / `setInitialDate` / `setFinalDate`）；新值是空字串時什麼都不做，讓 store 保留原本的日期。這樣 `[value]` 綁定的來源沒有變化，Angular 不會對這個元素做任何屬性寫入，瀏覽器內部尚未打完的分段緩衝區也就不會被觸碰。
- **`(blur)`**：這時再檢查一次元素的 `.value`，如果仍是空字串，才呼叫同一個 setter 傳入 `''`，把 store 的日期真正清空。

`setRowDate`／`setInitialDate`／`setFinalDate` 本身完全沒動——如需求所述，store 只負責「設值」，「什麼時候該設」的判斷留在元件裡（`cash-flow-table.ts` 的 `onDate`/`onDateBlur`，`position-fields.ts` 的 `onDate`/`onDateBlur`）。`src/app/core/**`、`src/app/state/**` 未觸碰。

### 效果

- 在 MM 段打 `0`：`input` 事件的 `value` 是 `''`，被略過，store 跟畫面都不動；接著打 `3`：`value` 變成完整的 `2026-03-06`，正常寫入。使用者只改到月份那一段，符合他的期待。
- 真的要清空、把值刪光再切到別的欄位：`blur` 觸發時 `value` 仍是 `''`，這時才清空 store，清空功能沒有壞掉。
- 欄位留空就按下「計算」：按鈕本身會先讓輸入框失焦，`blur` 先跑完把清空提交進 store，驗證邏輯才照舊正確地報「日期未填」。

## 新增測試

`jsdom` 沒有瀏覽器的分段編輯緩衝區，但這次要驗證的是**元件的事件處理邏輯**（該不該呼叫 setter），不是瀏覽器本身的分段行為，所以能忠實測到。針對三個日期欄位都補了：

- 設定日期後，dispatch `input`（`value=''`）→ store 仍是原本的日期，且畫面上的值沒有被 Angular 寫回任何東西（維持測試中模擬瀏覽器賦的 `''`，不會被強制改回舊的完整日期或別的值）。
- 接著 dispatch `blur`（`value=''`）→ store 的日期變成 `''`。
- 再 dispatch 一個完整新日期的 `input` → store 正常改成新日期（確認正常路徑沒被這次改動影響）。
- dispatch `blur` 且 `value` 非空 → 不會清空 store。

`cash-flow-table.spec.ts` 新增 4 筆，`position-fields.spec.ts` 用 `it.each(['initial', 'final'])` 對兩種 `kind` 各跑一遍、共新增 8 筆，涵蓋三個日期欄位。既有的日期相關測試（`輸入日期與金額會寫進 store`、`store 的值會反映回畫面`等）原封不動，全數維持通過。

`aria-label`／`aria-invalid`／`aria-describedby` 相關的模板與邏輯完全沒動，只新增了 `(blur)` 事件綁定。

## 測試與建置

- `npm test`（`ng test`，vitest）：**249 個測試全數通過**（baseline 237 + 本次新增 12）。
- `npm run build`：成功，無錯誤。
- 既有 237 項測試皆未修改、跳過或刪除。

## 未變動／未處理事項

- 金額欄位（`amountText` 那條路徑）完全沒動——空字串在那裡本來就代表使用者真的清空了，不是這次的問題。
- 未新增任何依賴、未使用 Reactive/Signal Forms、`ngModel`、NgRx 或 Angular Material。
- 未觸碰 `src/app/core/**`、`src/app/state/**`；`setRowDate`／`setInitialDate`／`setFinalDate` 簽名與行為都沒變。
- 這個修法無法在 jsdom 裡重現「分段緩衝區被寫入動作摧毀」這個瀏覽器層級的現象本身（jsdom 沒有這種內部狀態），只能驗證「元件不會在錯誤時機呼叫 setter」這個修法的邏輯前提；實機行為需在真實瀏覽器手動驗證（依任務要求，由後續流程處理）。
