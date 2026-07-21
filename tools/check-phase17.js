/* Phase 17 行為驗證：設定持久化、翻滾耗體力／無敵、音量與素材契約。 */
const fs = require('fs');
const path = require('path');
const {loadProject} = require('./check-load');
const root = path.resolve(__dirname, '..');
const r = loadProject(root, true);
let bad = 0;
function check(ok,msg){console.log((ok?'✅ ':'❌ ')+msg);if(!ok)bad++;}
if(r.failures.length){check(false,'Phase 17 測試前置載入');process.exitCode=1;return;}
const W=r.context.W;

W.Settings.reset();
check(W.Settings.get('shake')===1 && W.Settings.get('haptics')===true && W.Settings.get('lowPower')===false,'設定預設值完整');
W.Settings.set('shake',0.5);W.Settings.set('lowPower',true);W.Settings.set('sfxVolume',0.75);
check(W.Settings.get('shake')===0.5 && W.Settings.dprCap()===1 && W.Sfx.volume()===0.75,'設定即時套用震動、DPR 與音量');
W.Settings.load();
check(W.Settings.get('lowPower')===true && W.Settings.get('sfxVolume')===0.75,'設定可由 localStorage 還原');

W.Stats.importData({hp:100,food:100,stam:100,san:100});
W.Input.getX=()=>1;W.Input.getY=()=>0;
const hp=W.Stats.hp(),stam=W.Stats.stam(),rolled=W.Player.roll();
check(rolled===true && W.Player.isRolling() && W.Stats.stam()===stam-28,'翻滾消耗 28 體力並進入無敵狀態');
check(W.Stats.damage(25)===false && W.Stats.hp()===hp,'翻滾期間傷害核心拒絕扣血');
check(W.Player.roll()==='cooldown','翻滾期間不可連續觸發');

const art=fs.readFileSync(path.join(root,'js/art.js'),'utf8');
let pngOk=/'fx_dodge', 'fx_phase'/.test(art);
for(const spec of [['fx_dodge.png',256],['fx_phase.png',384]]){
  const b=fs.readFileSync(path.join(root,'assets',spec[0]));
  pngOk=pngOk&&b.readUInt32BE(16)===spec[1]&&b.readUInt32BE(20)===spec[1]&&(b[25]===4||b[25]===6)&&b.length>10000;
}
check(pngOk,'兩張 Phase 17 實體特效尺寸、透明通道與素材登錄有效');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
check(!/\.\/assets\/player_abyss\.png/.test(sw) && /c\.put\(req, copy\)/.test(sw),'Skin 改為首次使用時快取');

W.Settings.reset();
console.log(bad?'\n=== Phase 17 行為驗證失敗：'+bad+' 項 ===':'\n=== Phase 17 行為驗證全部通過 ===');
process.exitCode=bad?1:0;
