# WILDS Phase 12：三層崩潰檢查內建化

## 新增

- 將最新《WILDS 崩潰檢查方案》做成專案內建工具。
- `node tools/check-all.js` 依序執行語法、載入期與結構契約檢查。
- 無頭 harness 會自動讀取 `index.html` 的真實腳本順序，避免手寫順序過期。
- 結構層涵蓋 DOM、跨模組 API、存檔三鐵律、素材 null guard、跨模組 key、確定性與 Service Worker 快取。

## 本輪實際發現並修正

- 診斷面板原有兩個重複的 `id="diag-actions"`，已改為共用 class，避免日後 DOM 操作指向錯誤元素。
- `drawArt()` 新增底層 `null` 保護；即使單一圖片缺失或尚未完成載入，也不會因讀取 `img.width` 導致白畫面。

## 版本

- 存檔仍為 v15，無破壞性資料變更。
- Service Worker 升為 `wilds-v36`，確保修正後的 `index.html`、`style.css` 與 `render.js` 會更新。
- Phase 9～11 的熔岩魔神、導航、快速移動與可視裝備均保留。
