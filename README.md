# XIRR 投資年化報酬率計算機

純靜態的前端計算機。輸入期初部位、期間的資金進出與期末部位，計算考慮時間因素的真實年化報酬率（XIRR），以及總投入、總匯出、當前部位與總報酬。

不需要後端，建置後就是一包靜態檔案。

## 環境需求

| | 版本 |
|---|---|
| Node.js | `^22.22.3` 或 `^24.15.0` 或 `>=26.0.0` |
| npm | 隨 Node 附帶即可 |

Node 版本要求寫在 `package.json` 的 `engines`，版本不符時 npm 會警告。確認目前版本：

```bash
node -v
npm -v
```

## 從 0 到啟動

```bash
git clone <repo-url> xirr-app
cd xirr-app
npm ci          # 依 package-lock.json 安裝，版本完全可重現
npm start       # 啟動開發伺服器
```

開啟 **http://localhost:4200** 即可使用。修改原始碼會自動重新載入。

要換連接埠：

```bash
npm start -- --port 4400
```

> 用 `npm ci` 而不是 `npm install`：Angular 相關套件在 `package.json` 中是**精確版號**（無 `^`），`npm ci` 會嚴格照 lockfile 安裝，不會悄悄升版。

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm start` | 開發伺服器，http://localhost:4200 |
| `npm run build` | 正式建置，產出到 `dist/xirr-app/browser` |
| `npm test -- --watch=false` | 跑完整測試後結束 |
| `npm test` | 監看模式，改檔即重跑（互動式開發用） |
| `npm run watch` | 開發模式的持續建置 |

> **`npm test` 在終端機下預設是監看模式**，不會自己結束。CI 或只想跑一次時，務必加 `-- --watch=false`。

## 建置

```bash
npm run build
```

產物在 `dist/xirr-app/browser/`（約 300 KB），內容是 `index.html`、一個 JS bundle、一個 CSS 檔和 favicon。**沒有任何伺服器端程式**，所以任何靜態主機都能直接放：GitHub Pages、Netlify、Cloudflare Pages、S3、nginx 皆可。

本機驗證產物：

```bash
cd dist/xirr-app/browser
python3 -m http.server 4700
# 開啟 http://localhost:4700
```

## 部署（GitHub Pages）

線上站台：**https://xanxusvervr.github.io/xirr-app/**

推送到 `main` 就會自動建置並部署，設定在 `.github/workflows/deploy.yml`。流程是 `npm ci` → 跑完整測試 → 建置 → 部署，**測試沒過就不會部署**。建置在 CI 進行，所以 repo 裡不會有產物，也不需要 `gh-pages` 分支。

### base href 是自動推導的

這是 Angular 放 GitHub Pages 最常見的坑。專案頁的網址是 `https://<帳號>.github.io/<repo>/`，但預設的 `<base href="/">` 會讓所有 JS/CSS 去網域根目錄找，結果全部 404、畫面一片空白。

workflow 依 repo 名稱自動算出正確的值，**換 repo 名或 fork 都不必改設定**：

| repo 種類 | base href |
|---|---|
| `<帳號>.github.io`（使用者頁，網站在根目錄） | `/` |
| 其他（專案頁，網站在子路徑） | `/<repo名>/` |

要在本機重現子路徑的情況：

```bash
npm run build -- --base-href /xirr-app/
mkdir -p /tmp/pages/xirr-app && cp -R dist/xirr-app/browser/. /tmp/pages/xirr-app/
cd /tmp/pages && python3 -m http.server 4950
# 開啟 http://localhost:4950/xirr-app/
```

### 換到另一個 repo

1. 在 GitHub 建一個空 repo（不要勾 README／.gitignore，避免與本地衝突）
2. `git remote add origin <repo-url>` 然後 `git push -u origin main`
3. repo 的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**（不是 "Deploy from a branch"）
4. 到 **Actions** 分頁等 workflow 跑完，網址會顯示在 deploy 步驟

第 3 步沒做的話，workflow 會一路跑到最後一步才失敗——因為 Pages 還沒啟用，`deploy-pages` 沒有目標。

### 這個專案不需要的東西

網路上的教學常會叫你加這兩個，但這裡都用不到：

- **`404.html`**：那是給有前端路由的 SPA 做 deep link fallback 用的。這個 app 沒有路由，只有一頁。
- **`.nojekyll`**：用 Actions 部署時 GitHub 不會跑 Jekyll，而且產物裡也沒有底線開頭的檔案。

### 維護 action 版本

GitHub 每隔一段時間會淘汰舊的 Node runtime，Actions 會跳出 `Node.js XX is deprecated` 警告。升級時**不要只看主版號** —— 要實際確認該版的 `action.yml` 裡 `runs.using` 是什麼：

```bash
curl -s https://raw.githubusercontent.com/actions/checkout/v7.0.1/action.yml | grep "using:"
```

還要注意**間接依賴**：`upload-pages-artifact` 自己是 composite action，真正的 runtime 來自它內部呼叫的 `upload-artifact`，所以光升級 workflow 裡看得到的那幾個不會解決問題。升級後也要確認自己用到的 inputs／outputs（這裡是 `node-version`、`cache`、`path`、`page_url`）在新版還在。

## 專案結構

```
src/app/
├── core/      純 TypeScript，不含任何 Angular
│   ├── date.ts            'YYYY-MM-DD' ↔ epoch day（全程 UTC）
│   ├── xirr/npv.ts        淨現值、其導數，與折現項量級
│   ├── xirr/solver.ts     Newton-Raphson + bisection 求根
│   ├── xirr/metrics.ts    四項彙總數字
│   ├── xirr/validate.ts   驗證與 UI→XIRR 符號翻轉
│   ├── xirr/calculate.ts  管線：必填 → 排序 → 區間 → 求解
│   └── yaml/              序列化（手寫）與解析（js-yaml）
├── state/     signal store，唯一的可變狀態
└── ui/        六個元件，原生 [value]/(input) 繫結
```

依賴方向單向：**`ui → state → core`**。`core/` 不知道 `state/` 存在，`state/` 不知道 `ui/` 存在。

## 動手改之前

這些約束是刻意的，違反會讓既有設計失效：

- **`src/app/core/**` 不得 import `@angular/*`。** XIRR 數學是純 TypeScript，才能不透過 TestBed 做毫秒級測試。
- **不使用任何表單函式庫** —— 不用 Reactive Forms、不用 Signal Forms、不用 `ngModel`。驗證在 `core/`、狀態在 store，再加一層表單模型就會有兩份真相並各自漂移。
- **金額欄位在模型中保留使用者的原始文字**（`amountText`），模板綁它而非綁解析後的數值。直接綁數值會在編輯途中覆蓋輸入：`<input type="number">` 在只剩負號時回報空字串，把舊值寫回就會吃掉負號。這也是金額欄用 `type="text" inputmode="decimal"` 的原因。
- **日期一律是 `'YYYY-MM-DD'` 字串**，不用 `Date` 物件。`new Date('2024-01-01')` 是 UTC 午夜，在 UTC+8 會顯示成前一天。
- **折現年化分母固定 365**，與 Excel `XIRR` 一致 —— 使用者會拿 Excel 對答案。
- **結果只在按下「計算報酬率」時產生**，不用 `computed()` 即時重算。
- **Angular 精確鎖在 22.1.6**，`@angular/cdk` 只用 `drag-drop`，不要加 Angular Material。
- 專案是 **zoneless**，元件測試在任何預期更新 DOM 的動作後都要 `await fixture.whenStable()`。

更完整的說明見 `CLAUDE.md` 的「Project-specific decisions」一節。

## 文件

| 檔案 | 內容 |
|---|---|
| `docs/spec.md` | 原始需求 |
| `docs/superpowers/specs/2026-09-12-xirr-calculator-design.md` | 設計文件（規格權威） |
| `docs/superpowers/plans/2026-09-12-xirr-calculator.md` | 實作計畫（17 個 TDD task） |
| `docs/superpowers/plans/2026-09-12-xirr-acceptance.md` | 瀏覽器驗收紀錄與檢查清單 |
| `docs/2026-09-12-code-review.md` | 程式碼審查發現 |
| `docs/fix-notes-*.md` | 各項修正的根因與取捨 |

## 測試

237 個測試，絕大多數是 `core/` 的純函式測試（毫秒級，不需 TestBed）；元件測試刻意寫得薄。

**拖曳與版面無法用單元測試涵蓋** —— jsdom 沒有指標物理，也沒有版面引擎。這兩者靠真實瀏覽器手動驗收，步驟與預期值記在 `docs/superpowers/plans/2026-09-12-xirr-acceptance.md`，可當作回歸腳本使用。
