/* Phase 18 行為驗證：完美閃避、無障礙、按需素材、面板鎖定、安全更新與備份 UI。 */
const fs = require('fs');
const path = require('path');
const {loadProject} = require('./check-load');
const root = path.resolve(__dirname, '..');
const loaded = loadProject(root, true);
let bad = 0;
function check(ok,msg){console.log((ok?'✅ ':'❌ ')+msg);if(!ok)bad++;}
if(loaded.failures.length){check(false,'Phase 18 測試前置載入');process.exitCode=1;return;}
const W = loaded.context.W;

W.Settings.reset();
check(W.Settings.get('reducedMotion')===false && W.Settings.get('highContrast')===false,'無障礙設定具有安全預設值');
W.Settings.set('reducedMotion',true);W.Settings.set('highContrast',true);W.Settings.load();
check(W.Settings.get('reducedMotion')===true && W.Settings.get('highContrast')===true,'減少動態與高對比設定可保存還原');

W.Settings.reset();
W.Stats.importData({hp:100,food:100,stam:100,san:100});
const inputGetX=W.Input.getX,inputGetY=W.Input.getY;
W.Input.getX=()=>1;W.Input.getY=()=>0;
const hp=W.Stats.hp();
check(W.Player.roll()===true && W.Stats.damage(24)===false && W.Stats.hp()===hp,'完美閃避仍由傷害核心保證不扣血');
check(W.Player.perfectReady() && W.Stats.stam()===84,'早期翻滾命中返還 12 體力並準備強化攻擊');
W.Player.attack();
check(W.Player.lastAttackDamage()===W.CFG.ATTACK_DMG+W.Craft.attackBonus()+18 && !W.Player.perfectReady(),'下一擊獲得 +18 傷害後正確消耗增益');
W.Input.getX=inputGetX;W.Input.getY=inputGetY;

W.Render.slowMotion(0.3,0.25);
check(W.Render.stepFrame(0.04)===0.01,'完整動態模式會播放短暫慢動作');
W.Settings.set('reducedMotion',true);W.Render.impact(10,20,true);
check(W.Render.stepFrame(0.04)===0.04,'減少動態模式會立即清除慢動作與命中停頓');

W.Input.setLocked(true);
check(W.Input.isLocked() && W.Input.getX()===0 && W.Input.getY()===0,'面板輸入鎖定會清除移動向量');
W.Input.setLocked(false);

W.Art.load();
const first=W.Art.stats();W.Art.get('boss_lava');const after=W.Art.stats();
check(first.requested<first.total && after.requested===first.requested+1,'素材先載常用集合，Boss 圖第一次需要時再載入');

const main=fs.readFileSync(path.join(root,'js/main.js'),'utf8');
const render=fs.readFileSync(path.join(root,'js/render.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
check(/function uiModalOpen/.test(main) && /setLocked\(modal\)/.test(main) && /simDt=modal\?0:dt/.test(main),'全螢幕面板會暫停模擬並鎖定操作');
check(/drawHurtFlash[\s\S]*?reducedMotion/.test(render) && /highContrastRing/.test(render),'受傷閃爍、減少動態與高對比警示已接入渲染');
check(/type === 'SKIP_WAITING'/.test(sw) && /ASSETS\.filter\(isStartupAsset\)/.test(sw) && !/install'[\s\S]{0,80}self\.skipWaiting\(\)/.test(sw),'PWA 只在玩家確認後切換，且安裝採分階段素材快取');
check(/id="update-panel"/.test(html) && /id="btn-export"/.test(html) && /id="btn-import"/.test(html) && /applyRemote\(data\)/.test(main),'安全更新提示與 JSON 備份匯出／驗證匯入介面齊全');

W.Settings.reset();
console.log(bad?'\n=== Phase 18 行為驗證失敗：'+bad+' 項 ===':'\n=== Phase 18 行為驗證全部通過 ===');
process.exitCode=bad?1:0;
