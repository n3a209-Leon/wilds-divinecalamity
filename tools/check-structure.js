/* Layer 3：DOM/API/存檔/null/key/確定性/快取契約交叉比對。 */
const fs = require('fs');
const path = require('path');
const {loadProject} = require('./check-load');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(f=>f.endsWith('.js')).sort().map(f=>'js/'+f);
let failures = 0;
function pass(msg){ console.log('✅ ' + msg); }
function fail(msg){ failures++; console.log('❌ ' + msg); }
function check(ok,msg){ ok ? pass(msg) : fail(msg); }

const html = read('index.html');
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
const usedIds = new Set();
for (const rel of jsFiles) {
  const src = read(rel);
  for (const m of src.matchAll(/getElementById\(\s*["']([^"']+)["']/g)) usedIds.add(m[1]);
  for (const m of src.matchAll(/\bon\(\s*["']([^"']+)["']/g)) usedIds.add(m[1]);
}
const missingIds = [...usedIds].filter(id=>!ids.has(id));
check(!missingIds.length, 'DOM 契約：所有程式引用 id 都存在' + (missingIds.length?'（缺 '+missingIds.join(', ')+'）':''));
const duplicateIds = [...ids].filter(id => (html.match(new RegExp('\\bid=["\\\']'+id+'["\\\']','g'))||[]).length > 1);
check(!duplicateIds.length, 'DOM 契約：index.html 沒有重複 id' + (duplicateIds.length?'（'+duplicateIds.join(', ')+'）':''));

const loaded = loadProject(root, true);
check(!loaded.failures.length, 'API 前置：全部模組可依真實順序載入');
if (!loaded.failures.length) {
  const calls = new Map();
  for (const rel of loaded.order) {
    const src = read(rel);
    for (const m of src.matchAll(/W\.([A-Z][A-Za-z0-9_]*)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
      if (m[1] === 'Game' && /^on[A-Z]/.test(m[2])) continue;
      calls.set(m[1]+'.'+m[2], [m[1],m[2],rel]);
    }
  }
  const missingApi = [];
  for (const [label,[mod,method,rel]] of calls) {
    if (!loaded.context.W[mod] || typeof loaded.context.W[mod][method] !== 'function') missingApi.push(label+' @ '+rel);
  }
  check(!missingApi.length, 'API 契約：跨模組呼叫都有 export' + (missingApi.length?'（'+missingApi.join('; ')+'）':''));
}

const save = read('js/save.js'), craft = read('js/craft.js');
check(/travel:\s*W\.Travel/.test(save) && /importData\(data\.travel\)/.test(save) && /data\.travel/.test(save), '存檔三鐵律：travel collect/apply/migrate 齊全');
check(/journal:\s*W\.Journal/.test(save) && /importData\(data\.journal\)/.test(save) && /data\.journal/.test(save), '存檔三鐵律：journal collect/apply/migrate 齊全');
check(/rewards:\s*W\.Rewards/.test(save) && /importData\(data\.rewards\)/.test(save) && /data\.rewards/.test(save), '存檔三鐵律：rewards collect/apply/migrate 齊全');
check(/bondMate:\s*W\.BondMate/.test(save) && /importData\(data\.bondMate\)/.test(save) && /data\.bondMate/.test(save), '存檔三鐵律：老皮 collect/apply/migrate 齊全');
check(/equipped:\s*gear\.equipped/.test(craft) && /o\.equipped/.test(craft), '存檔三鐵律：主手裝備可匯出與還原');
check(/var VERSION = 20/.test(save), '存檔版本為 v20');
check(/BACKUP_1\s*=\s*'save_backup_1'/.test(save) && /BACKUP_2\s*=\s*'save_backup_2'/.test(save) && /recoverBackup/.test(save) && /checksumOf/.test(save), '存檔安全：雙輪替備份、校驗與自動復原齊全');

const render = read('js/render.js');
check(/function drawArt\([^)]*\)\s*{\s*\/\*[\s\S]*?\*\/\s*if \(!img\) return;/.test(render), '素材保護：drawArt 底層具有 null guard');

const travel = read('js/travel.js'), bosses = read('js/bosses.js');
check(/isDefeated\('region:' \+/.test(travel) && /k:\s*'region:/.test(bosses), '跨模組 key：travel 與 bosses 都使用 region:xxx');

const randomHits = [];
for (const rel of jsFiles) if (/Math\.random\s*\(/.test(read(rel))) randomHits.push(rel);
check(!randomHits.length, '架構鐵律：沒有 Math.random，世界保持確定性' + (randomHits.length?'（'+randomHits.join(', ')+'）':''));

const sw = read('sw.js');
const scriptPaths = [...html.matchAll(/<script\s+src="(js\/[^"]+\.js)"/g)].map(m=>m[1]);
const cached = new Set([...sw.matchAll(/["']\.\/([^"']+)["']/g)].map(m=>m[1]));
const uncached = scriptPaths.filter(p=>!cached.has(p));
check(!uncached.length, 'Service Worker：所有本機腳本均已快取' + (uncached.length?'（'+uncached.join(', ')+'）':''));
check(/CACHE_VERSION\s*=\s*'wilds-v51-compact-ui'/.test(sw), 'Service Worker 版本為 wilds-v51-compact-ui');
const missingCache = [...cached].filter(p=>!exists(p));
check(!missingCache.length, 'Service Worker：快取路徑全部存在' + (missingCache.length?'（'+missingCache.join(', ')+'）':''));

const art = read('js/art.js');
const names = art.match(/var NAMES = \[([\s\S]*?)\n\s*\];/);
const artNames = names ? [...names[1].matchAll(/'([^']+)'/g)].map(m=>m[1]) : [];
const missingArt = artNames.filter(n=>!exists('assets/'+n+'.png'));
check(!!names && !missingArt.length, '素材契約：art.js 登錄素材全部存在' + (missingArt.length?'（'+missingArt.join(', ')+'）':''));

const skinSrc = read('js/skins.js');
const skinPaths = [...skinSrc.matchAll(/'((?:assets\/)?player2?_(?:abyss|death|star|phoenix|end|found_family)\.png)'/g)].map(m=>m[1]);
const missingSkins = skinPaths.filter(p=>!exists(p));
check(skinPaths.length===12 && !missingSkins.length, 'Skin 契約：兩名角色 × 六套實體動畫素材完整' + (missingSkins.length?'（'+missingSkins.join(', ')+'）':''));
check(/phoenixCycle/.test(skinSrc) && /data\.skins\.phoenixCycle/.test(save), 'Skin 存檔：不死鳥按飛升輪迴重置且具備遷移');

const calamity = read('js/calamity.js');
check(/SUMMON_TIME\s*=\s*10/.test(calamity) && /cancelSummon/.test(calamity) && /onCalamitySummonStart/.test(calamity), '祭壇契約：十秒召喚、主動取消與離開中止齊全');
check(/'fx_warning', 'fx_hit', 'fx_travel'/.test(art) && ['assets/fx_warning.png','assets/fx_hit.png','assets/fx_travel.png'].every(exists), 'Phase 16 特效素材：預警、命中、傳送均已登錄並存在');
check(/impact:impact/.test(render) && /travelFx:travelFx/.test(render) && /stepFrame:stepFrame/.test(render), '戰鬥回饋契約：命中停頓、鏡頭震動與傳送特效均已 export');

const settings = read('js/settings.js'), player = read('js/player.js'), cloud = read('js/cloud.js');
check(/W\.Settings\s*=/.test(settings) && /dprCap:dprCap/.test(settings) && /vibrate:vibrate/.test(settings), 'Phase 17 設定契約：省電、震動與裝置端保存 API 齊全');
check(ids.has('settings-panel') && ids.has('settings-list') && ids.has('btn-settings'), 'Phase 17 設定面板 DOM 齊全');
check(/function\s+doRoll/.test(read('js/main.js')) && /roll:\s*function/.test(player) && /isRolling:\s*function/.test(player) && /rollCooldown:\s*function/.test(player), 'Phase 17 翻滾契約：按鈕、體力翻滾、無敵狀態與冷卻 API 齊全');
check(/W\.Player\s*&&\s*W\.Player\.isRolling/.test(read('js/stats.js')), 'Phase 17 翻滾無敵由傷害核心入口統一保護');
check(/skillReady\(b, dt\)/.test(bosses) && /attackReady\(b,/.test(calamity) && /onBossPhase/.test(bosses) && /onCalamityPhase/.test(calamity) && /phaseFx:phaseFx/.test(render), 'Phase 17 首領契約：真實技能前搖、區域首領與災禍轉階事件及實體特效齊全');
check(/compare:\s*compare/.test(cloud) && ids.has('cloud-conflict-panel') && ids.has('conflict-local') && ids.has('conflict-remote'), 'Phase 17 雲端契約：存檔摘要比較與雙版本 UI 齊全');
check(/'fx_dodge', 'fx_phase'/.test(art) && ['assets/fx_dodge.png','assets/fx_phase.png'].every(exists), 'Phase 17 特效素材：翻滾與首領轉階均已登錄並存在');
const precachedSkins = skinPaths.filter(p=>sw.indexOf("'./"+p+"'")>=0);
check(!precachedSkins.length && /c\.put\(req, copy\)/.test(sw), 'Phase 17 Skin 延遲快取：不阻塞首次安裝，使用時仍會加入 runtime cache');
check(!/settings:\s*W\.Settings/.test(save), '裝置設定不混入角色存檔與雲端進度');

console.log(failures ? '\n=== 結構層失敗：'+failures+' 項 ===' : '\n=== 結構層全部通過 ===');
process.exitCode = failures ? 1 : 0;
