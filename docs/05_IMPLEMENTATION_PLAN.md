# 實作分期

## Phase A：資料與存檔骨架
- 新增 RegionBosses、DivineArms、Calamities、Skins 四模組。
- 存檔升級 v8，新增 regionBosses、divineArms、calamities、skins。
- 所有模組均提供 exportData/importData/clear/stats。

## Phase B：第一隻區域王＋第一件神武
- 九頭蛇完整 AI。
- 毒液投射物與毒池。
- 神盾掉落、啟用與 HUD。

## Phase C：其餘四隻區域王
- 逐隻加入，避免一次引入過多未測試技能。

## Phase D：Day 20 祭壇與第一隻災禍
- 祭壇互動、倒數、取消、戰鬥鎖定。
- 深淵巨鯤三階段。
- Skin 解鎖與選擇介面。

## Phase E：共鳴與 New Game+
- 兩件、五件共鳴。
- 災禍輪替與神格。
- New Game+ 世界倍率。

## 測試最低標準
- 舊 v0–v7 存檔可遷移。
- 缺少任一新 JS 檔時舊遊戲不崩潰。
- 每種攻擊均可避開，且具明確前搖。
- 箭矢與夥伴可鎖定區域王及災禍。
- 服務工作者快取版本更新且包含新增檔案。
