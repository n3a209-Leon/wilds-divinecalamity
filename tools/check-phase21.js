const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function must(ok, message) {
  if (!ok) throw new Error('Phase 21 驗證失敗：' + message);
  console.log('✅ ' + message);
}

const hudTools = (index.match(/<div id="hud-tools">([\s\S]*?)<\/div>/) || [,''])[1];
const primaryIds = Array.from(hudTools.matchAll(/id="([^"]+)"/g), m => m[1]);
must(primaryIds.length === 3 && primaryIds.indexOf('btn-guide') >= 0 && primaryIds.indexOf('btn-menu') >= 0 && primaryIds.indexOf('menu-badge') >= 0,
  '右上角只保留導航、功能與功能鍵紅點');

const quickItems = Array.from(index.matchAll(/class="quick-item[^"]*" id="([^"]+)"/g), m => m[1]);
const required = ['btn-travel','btn-equip','btn-skin','btn-journal','btn-rewards','btn-settings','btn-mute','btn-sync','btn-diag'];
must(quickItems.length === required.length && required.every(id => quickItems.indexOf(id) >= 0), '九項快速功能完整且沒有遺漏');

const ids = Array.from(index.matchAll(/\sid="([^"]+)"/g), m => m[1]);
must(new Set(ids).size === ids.length, '精簡 HUD 沒有產生重複 DOM id');
must(index.indexOf('aria-controls="quick-menu"') >= 0 && index.indexOf('aria-hidden="true"') >= 0 && index.indexOf('role="dialog"') >= 0,
  '快速面板具備可讀的無障礙狀態');

must(css.indexOf('#hud-pos, #hud-chunk, #hud-fps { display:none; }') >= 0, '座標、區塊與 FPS 已退出常駐 HUD');
must(css.indexOf('grid-template-columns:repeat(3,minmax(0,1fr))') >= 0 && css.indexOf('grid-template-columns:repeat(5,minmax(0,1fr))') >= 0,
  '直向三欄與低高度橫向五欄配置齊全');
must(css.indexOf('env(safe-area-inset-top)') >= 0 && css.indexOf('env(safe-area-inset-right)') >= 0, 'HUD 與面板納入手機安全區');
must((css.match(/{/g) || []).length === (css.match(/}/g) || []).length, 'CSS 區塊括號完整');

must(main.indexOf("on('btn-menu', 'click', toggleQuickMenu)") >= 0 && main.indexOf("on('quick-menu-backdrop', 'click', closeQuickMenu)") >= 0,
  '功能鍵、遮罩與關閉流程已綁定');
must(main.indexOf("if(e.key==='Escape'&&quickMenuOpen)") >= 0, '鍵盤 Esc 可收起快速面板');
must(main.indexOf("'update-panel','quick-menu'") >= 0, '快速面板展開時會暫停模擬並鎖定操作');
must(main.indexOf("function(){closeQuickMenu();openTravel();}") >= 0 && main.indexOf("function(){closeQuickMenu();openRewards();}") >= 0,
  '快速功能選擇後會自動收起再開啟目標面板');
must(main.indexOf("document.getElementById('menu-badge')") >= 0 && main.indexOf("document.getElementById('reward-badge')") >= 0,
  '獎勵數量同步到功能鍵與獎勵鍵');
must(main.indexOf("silent?'音效關':'音效'") >= 0 && main.indexOf("signedIn?'已同步':'雲端'") >= 0,
  '音效與雲端按鈕會反映目前狀態');

must(sw.indexOf("var CACHE_VERSION = 'wilds-v55-wild-ecology';") >= 0, 'Service Worker 已切換為目前部署快取');

console.log('\n=== Phase 21 精簡 UI 驗證全部通過 ===');
