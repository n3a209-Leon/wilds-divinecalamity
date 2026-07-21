# WILDS 崩潰檢查方案（專案內建版）

本專案已將最新檢查方案做成可重複執行的三層工具。每次修改程式碼、增加素材或準備部署前，都必須依序執行；上層失敗時會立即停止，避免錯誤污染後續結果。

## 一鍵執行

在專案根目錄執行：

```bash
node tools/check-all.js
```

## 三層檢查

1. `tools/check-syntax.js`
   - 對 `js/*.js` 與 `sw.js` 全部執行 `node --check`。
   - 抓括號、字串、關鍵字及語法解析錯誤。

2. `tools/check-load.js`
   - 自動解析 `index.html` 的真實 `<script>` 順序，不維護容易過期的手寫清單。
   - 在 Node VM 中建立 DOM、Canvas、Firebase、IndexedDB、Audio 與 PWA stub。
   - 逐檔實際執行，攔截載入順序與未定義 API 所造成的開機白畫面。

3. `tools/check-structure.js`
   - DOM id 引用與重複 id。
   - 跨模組 `W.X.method()` 與實際 export。
   - `travel` 與主手裝備存檔契約。
   - `drawArt` 素材 null 保護。
   - `region:xxx` 跨模組 key。
   - 禁止 `Math.random` 的確定性鐵律。
   - Service Worker 腳本快取、版本與實體路徑。
   - `art.js` 素材清單與 PNG 實體檔案。

結構層後會繼續執行 Phase 16～19 行為回歸與 v19 雙備份實測；任一項失敗同樣停止發行。

## 判讀標準

- 語法層：全部 `✅`。
- 載入期：顯示「全部模組載入成功，無載入期崩潰」。
- 結構層：顯示「結構層全部通過」。
- 最終必須顯示：「WILDS 三層崩潰檢查全部通過」。

Python 括號差值只作為沒有 Node 時的片段預警；完整專案一律以 `node --check` 為最終仲裁。
