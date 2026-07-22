/* Phase 24：多變秘境、終極三明治、行為羈絆與野外自動變形。 */
const fs = require('fs');
const path = require('path');
const {loadProject} = require('./check-load');
const root = path.resolve(__dirname, '..');
const loaded = loadProject(root, true);
if (loaded.failures.length) process.exit(1);
const W = loaded.context.W;
let failures = 0;
function check(ok,msg){console.log((ok?'✅ ':'❌ ')+msg);if(!ok)failures++;}

const art=fs.readFileSync(path.join(root,'assets','ui','sandwich.png'));
check(art.readUInt32BE(16)===160&&art.readUInt32BE(20)===160&&(art[25]===4||art[25]===6),
  '終極三明治專用圖示尺寸與透明通道有效');

const migrated=W.Save.migrate({v:21,seed:W.CFG.SEED,time:{day:6,t:.2},bondMate:{realms:2}});
check(migrated&&migrated.v===22&&migrated.laopiLife&&migrated.laopiLife.ingredients===0,
  'v21 存檔安全升級 v22 並補上荒野生活資料');

W.Time.importData({day:12,t:.72});
W.LaopiLife.clear();
W.LaopiLife.noteCook('cook');W.LaopiLife.noteCook('soup');W.LaopiLife.noteCook('jerky');
W.LaopiLife.noteHarvest('mushroom');W.LaopiLife.noteHarvest('berry');
W.LaopiLife.noteRealmComplete(true,false,'howl');
W.LaopiLife.noteBossDown(false);
check(W.LaopiLife.status().ingredientCount===4&&W.LaopiLife.canMakeSandwich(),
  '料理、夜間採集、深入秘境與首領戰會各解鎖一種三明治材料');

W.Player.wx=820;W.Player.wy=820;W.Build.clear();W.Build.add(W.Build.TYPE.FIRE,820,820);W.Build.updateNear(820,820);
W.Inv.clear();W.Inv.add('cooked',2);W.Inv.add('jerky',2);W.Inv.add('berry',6);
check(W.Craft.make('sandwich')===true&&W.LaopiLife.status().pending,
  '集齊材料後可在營火旁每天製作一次終極三明治');
check(W.LaopiLife.chooseBoon('suit')&&W.LaopiLife.status().boonReady,
  '完成後由玩家主動選擇今日效果，不自動替玩家決定');
W.BondMate.clear();W.BondMate.spawnNearPlayer();
const hit={name:'測試守衛',dmg:8,killed:false,wx:840,wy:820,type:W.Mobs.TYPE.WOLF,boss:false,calamity:false};
for(let i=0;i<13;i++)W.BondMate.notePlayerHit(hit);
check(W.BondMate.activatePower('suit')&&W.BondMate.stats().suit>7.9,
  '三明治的戰衣效果會把下一次合體由六秒延長到八秒');
check(typeof W.Craft.make('sandwich')==='string','同一天不能重複製作終極三明治');

W.LaopiLife.clear();
for(let i=0;i<6;i++)W.LaopiLife.noteDodge();
check(W.LaopiLife.status().style==='agile'&&W.LaopiLife.dodgeSyncBonus()===6,
  '反覆完美閃避會形成彈力拍檔章節並提供實際連攜回饋');
W.LaopiLife.clear();
for(let i=0;i<6;i++)W.LaopiLife.noteGuard();
check(W.LaopiLife.status().style==='guardian'&&W.LaopiLife.guardCost(40)===34,
  '守護型選擇會形成安心守護章節並降低守護消耗');

W.Inv.add('cooked',1);W.Build.updateNear(W.Player.wx,W.Player.wy);
check(W.LaopiLife.shareFood()===true&&W.LaopiLife.status().sharedMeals===1,
  '在營火旁可和老皮分享食物，成為營地共同生活事件');

W.Time.importData({day:13,t:.2});
W.LaopiLife.importData({boon:'realm',boonDay:13,boonUsed:false});
W.Mobs.clearAll();W.Sites.clear();W.DuoRealm.clear();
const siteA={k:'phase24-rare',wx:W.Player.wx,wy:W.Player.wy,type:W.Sites.TYPE.CAVE,seed:23054};
check(W.DuoRealm.begin(siteA),'稀有秘境效果可套用到下一座入口');
W.DuoRealm.update(1.4);
let realm=W.DuoRealm.state();
check(realm.plan.length===3&&realm.plan[0]==='spring'&&realm.plan[2]==='treasure'&&realm.rare,
  '秘境只抽三間房，且三明治可保證其中一間變成稀有藏寶房');
W.DuoRealm.abort('test');

W.LaopiLife.clear();W.DuoRealm.clear();
const siteB={k:'phase24-varied',wx:W.Player.wx,wy:W.Player.wy,type:W.Sites.TYPE.RUIN,seed:23055};
W.DuoRealm.begin(siteB);W.DuoRealm.update(1.4);realm=W.DuoRealm.state();
check(realm.plan.join(',')==='key,dark,defend'&&realm.omen,
  '不同入口會決定性產生不同房間組合與深層預兆');
W.DuoRealm.abort('test');

const lifeSrc=fs.readFileSync(path.join(root,'js','laopi-life.js'),'utf8');
const mainSrc=fs.readFileSync(path.join(root,'js','main.js'),'utf8');
check(/movementMultiplier/.test(lifeSrc)&&/performTransform\('shelter'/.test(lifeSrc)&&/tryDangerPull/.test(lifeSrc)&&/W\.LaopiLife\.update/.test(mainSrc),
  '長途座騎、夜間庇護與危險拉回均接入正式遊戲迴圈');

console.log(failures?'\n=== Phase 24 荒野生活驗證失敗：'+failures+' 項 ===':'\n=== Phase 24 荒野生活驗證全部通過 ===');
process.exitCode=failures?1:0;
