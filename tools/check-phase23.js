/* Phase 23：老皮萬用變形、雙人哇塞秘境、主動連攜與老皮戰衣。 */
const path = require('path');
const fs = require('fs');
const {loadProject} = require('./check-load');
const root = path.resolve(__dirname, '..');
const loaded = loadProject(root, true);
if (loaded.failures.length) process.exit(1);
const W = loaded.context.W;
let failures = 0;
function check(ok,msg){console.log((ok?'✅ ':'❌ ')+msg);if(!ok)failures++;}

const art=fs.readFileSync(path.join(root,'assets','mate_laopi_transform_sheet.png'));
check(art.readUInt32BE(16)===1088&&art.readUInt32BE(20)===362&&(art[25]===4||art[25]===6),
  '老皮四格變形素材尺寸、透明通道與格數有效');
const mainSrc=fs.readFileSync(path.join(root,'js','main.js'),'utf8');
check(/var chest = !realmCombat/.test(mainSrc)&&/if \(!realmCombat && W\.Sites/.test(mainSrc),
  '秘境機關與戰鬥期間不會繞回舊版一鍵開箱流程');

W.Time.importData({day:8,t:0.25});
W.Stats.importData({hp:100,food:100,stam:100,san:100});
W.Mobs.clearAll(); W.Sites.clear(); W.BondMate.clear(); W.DuoRealm.clear();
const spawn=W.World.findSpawn(1800,1800,(x,y)=>!W.World.isSolidAt(x,y));
W.Player.wx=spawn?spawn.wx:W.CFG.START_WX;W.Player.wy=spawn?spawn.wy:W.CFG.START_WY;
W.BondMate.spawnNearPlayer();
const site={k:'phase23-realm',wx:W.Player.wx,wy:W.Player.wy,type:W.Sites.TYPE.CAVE,seed:23053};

check(W.DuoRealm.begin(site) && W.DuoRealm.state().phase==='sniff','靠近未搜刮秘境會由老皮嗅聞開啟雙人試煉');
W.DuoRealm.update(1.4);
let st=W.DuoRealm.state();
check(st.phase==='bridge' && W.BondMate.stats().transform==='sniff','嗅聞完成後出現老皮變橋機關');
W.Player.wx=st.objectiveWx;W.Player.wy=st.objectiveWy;
check(W.DuoRealm.tryAction() && W.DuoRealm.state().phase==='bridge_anim','玩家親自按鍵命令老皮搭橋');
W.DuoRealm.update(1.2);st=W.DuoRealm.state();
W.Player.wx=st.objectiveWx;W.Player.wy=st.objectiveWy;
check(st.phase==='spring' && W.DuoRealm.tryAction(),'過橋後老皮能變成彈簧送玩家上高台');
W.DuoRealm.update(1.0);st=W.DuoRealm.state();
W.Player.wx=st.objectiveWx;W.Player.wy=st.objectiveWy;
check(st.phase==='key' && W.DuoRealm.tryAction(),'高台石門需要老皮伸長身體開鎖');
W.DuoRealm.update(1.1);
check(W.DuoRealm.state().phase==='fight' && W.Mobs.challengeAlive('realm:phase23-realm')>0,'開鎖後生成可追蹤的雙人戰鬥波次');
W.Mobs.clearChallenge('realm:phase23-realm');W.DuoRealm.update(0.05);
check(W.DuoRealm.state().phase==='choice' && W.DuoRealm.state().choice,'第一波結束提供安全離開或繼續深入的抉擇');
check(W.DuoRealm.choose(true) && W.DuoRealm.state().phase==='fight2','繼續深入會啟動更強的共鳴守衛');
W.Mobs.clearChallenge('realm:phase23-realm');W.DuoRealm.update(0.05);
check(!W.DuoRealm.isActive() && W.Sites.isLooted(site) && W.BondMate.stats().realms===1 && W.BondMate.stats().braveRealms===1,
  '完成深層秘境才寫入搜刮、共同秘境與勇氣紀錄');

W.Mobs.clearAll();W.Mobs.update(0);W.BondMate.init();
W.Player.wx=700;W.Player.wy=700;W.BondMate.spawnNearPlayer();
const mob=W.Mobs.at(0);mob.alive=true;mob.type=W.Mobs.TYPE.WOLF;mob.wx=730;mob.wy=700;mob.hp=300;mob.threatT=1;
const hit={name:'狼',dmg:10,killed:false,wx:730,wy:700,type:W.Mobs.TYPE.WOLF,boss:false,calamity:false};
for(let i=0;i<13;i++)W.BondMate.notePlayerHit(hit);
check(W.BondMate.stats().comboReady && mob.hp===300,'連攜滿值不會自動消耗或偷放技能');
check(W.BondMate.activatePower('suit') && W.BondMate.suitActive() && W.BondMate.attackDamageBonus()===12 && W.BondMate.attackRangeBonus()===34,
  '長按選擇會進入六秒老皮戰衣並強化伸縮拳');
check(W.BondMate.absorbDamage(40,'wolf-contact',730,700)===0 && W.BondMate.stats().suitBlocked,
  '老皮戰衣能吸收一次重擊');
check(W.BondMate.absorbDamage(40,'wolf-contact',730,700)===40,
  '戰衣擋傷用完後下一次攻擊會正常結算');
const beforeEnergy=W.BondMate.stats().energy;W.BondMate.update(1);
check(W.BondMate.stats().energy<beforeEnergy && W.BondMate.stats().suit>4.8,
  '老皮戰衣會隨時間消耗守護能量而非永久無敵');

const migrated=W.Save.migrate({v:20,seed:W.CFG.SEED,time:{day:8},bondMate:{blocks:3}});
check(migrated&&migrated.v===22&&migrated.bondMate.realms===0&&migrated.bondMate.braveRealms===0&&migrated.bondMate.suitUses===0&&migrated.laopiLife,
  'v20 存檔安全遷移到 v22 並補齊秘境、戰衣與荒野生活紀錄');

console.log(failures?'\n=== Phase 23 老皮變形冒險驗證失敗：'+failures+' 項 ===':'\n=== Phase 23 老皮變形冒險驗證全部通過 ===');
process.exitCode=failures?1:0;
