# Phase 7：素材接線 + 檔案體檢

## 一、圖片轉檔（36 張）

來源 6 張大圖 → 切成專案需要的單張去背 PNG，尺寸對齊原有素材規格。

| 來源 | 產出 |
|---|---|
| 精靈／騎士／獵人／貓 六格圖 | `mate_sprite`、`mate_knight`、`mate_archer`、`mate_cat` 及各自 `_walk` |
| 九頭蛇／聖龍／腐敗巨像／天鷹 | `boss_hydra`、`boss_dragon`、`boss_colossus`、`boss_eagle` 及各自 `_atk` |
| 巨魔／暗影魔 | `boss_troll`、`boss_shade` 及各自 `_atk` |
| 巨鯤／骷髏泰坦 | `cal_kun`、`cal_titan` 及各自 `_atk` |
| 神武五件 | `ui/divine_shield/gun/sword/axe/wing` 及各自 `_on` |
| 木籠 | `cage`、`cage_broken` |

處理方式：白／淺灰棋盤背景以邊緣 flood fill 去除（邊緣做 alpha 漸層，光暈不會留白邊）→ 自動裁邊 → 等比縮放至原素材尺寸 → 調色盤量化。
36 張合計約 578 KB（未量化前 2.3 MB）。

## 二、修正的問題

1. **`art.js` 素材清單漏登錄（最嚴重）**
   `boss_*`、`mate_*`、`cal_*`、`cage`、`ui/divine_*` 等 45 個名稱從未列入 `NAMES`，
   `W.Art.get()` 永遠回傳 null，所有相關圖片等於沒接上，畫面一路走向量退路。已補齊為 91 項。

2. **`sw.js` 快取清單過期且安裝不耐錯**
   - 缺少全部新素材 → 離線開啟時圖片全破。
   - `cache.addAll()` 是原子操作，只要一個檔案 404，整個 Service Worker 安裝失敗。
     改為 CORE 用 `addAll`、素材逐筆 `add().catch()`。
   - 取用策略改為：靜態素材快取優先（手機開局明顯變快）、HTML 網路優先並回寫快取。
   - `CACHE_VERSION` 升至 `wilds-v31`。

3. **`config.js` 重複鍵 `ART_BENCH_H`**（先 46 後 44，後者靜默覆蓋前者）。已移除重複定義。

4. **夥伴／首領／木籠貼圖被壓成正方形**
   這幾處直接用 `drawImage(img, x, y, h, h)`，忽略原圖長寬比，
   九頭蛇（320×204）之類的寬幅圖會被拉長變形。改用既有的 `drawArt()`，等比繪製。

5. **`_atk` 攻擊幀從未使用**
   `bosses.js` 新增 `atkFx` 計時器（攻擊時 0.45–0.5 秒），
   `render.js` 在該期間改用 `_atk` 圖，找不到就自動退回待機圖。

6. **世界災禍只有向量畫法**
   `calamity.js` 為巨鯤／泰坦補上 `art` 欄位與 `atkFx`，
   `render.js` 優先畫 `cal_kun` / `cal_titan`（含攻擊幀），圖沒載到才走原本的向量繪製。

7. **神武 HUD 加上圖示**
   `ui/divine_*` 之前完全沒有被任何程式碼引用。
   現在神盾／神槍／神劍會顯示對應圖示，發動中自動換成 `_on` 版本。
   為避免每次刷新都動 DOM，加了狀態簽章比對，只在狀態改變時重建。

## 三、還沒動、但建議之後處理

- `docs/01_REGION_BOSSES.md` 寫了 5 位區域首領，`bosses.js` 只實作 3 位。
  `boss_dragon`、`boss_colossus`、`boss_eagle` 的圖已備妥，但冰霜聖龍、腐敗巨像、雷霆天鷹尚未實作，
  對應的神斧、神翼在 `divine-arms.js` 也還沒有定義。
- `render.js` 有 1178 行，`drawBosses` 與 `drawCalamityBattle` 的血條／名牌邏輯高度重複，
  之後若要加新首領，建議先抽成共用函式再加，不然會複製第三份。
- 所有 JS 已通過 `node --check`。`render.js` 的括號差值為 +1，
  來源是第 452 行字串內的 `'rgba(...'` 片段，屬正常寫法，非語法錯誤。
