/* Phase 22：災禍戰場邊界、安全重生、老皮連攜與秘境共鳴。 */
const path = require('path');
const {loadProject} = require('./check-load');
const root = path.resolve(__dirname, '..');
const loaded = loadProject(root, true);
if (loaded.failures.length) process.exit(1);
const W = loaded.context.W;
let failures = 0;
function check(ok, msg) { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) failures++; }
function hazardCount() {
  let n = 0;
  W.Calamity.eachBolt(() => n++); W.Calamity.eachMeteor(() => n++);
  W.Calamity.eachEye(() => n++); W.Calamity.eachBone(() => n++);
  W.Calamity.eachShock(() => n++); W.Calamity.eachVoid(() => n++);
  return n;
}

W.Calamity.importData({unlocked:true,activeId:'kun',activeAscended:false,defeated:{kun:false,titan:false},hp:900,maxHp:1800,wx:100,wy:100});
check(W.Calamity.boss().maxHp === 1500 && W.Calamity.boss().hp === 750,
  'v51 進行中的災禍存檔會按生命比例套用新版平衡');
W.Calamity.clear();

/* 首輪災禍：血量下修、戰場有界，離場後彈幕不能追到紀錄點。 */
W.Time.importData({day:20,t:0.2});
W.DivineArms.importData({owned:{shield:1},equipped:{}});
W.Calamity.update(0.01);
const altar = W.Calamity.altarPos();
W.Player.wx = altar.wx; W.Player.wy = altar.wy;
W.Calamity.summon(); W.Calamity.update(10.1);
const firstBoss = W.Calamity.boss();
check(firstBoss && firstBoss.maxHp === 1500 && W.Calamity.stats().arenaRadius === 620,
  '首輪巨鯤血量與 620px 災禍戰場邊界生效');
for (let i = 0; i < 260; i++) W.Calamity.update(0.05);
check(hazardCount() > 0, '災禍戰鬥中能正常生成攻勢');
W.Calamity.hitAt(firstBoss.wx, firstBoss.wy, 30, 100);
const beforeRetreatHp = firstBoss.hp;
W.Player.wx = altar.wx + 700; W.Player.wy = altar.wy;
W.Calamity.update(0.05);
check(!W.Calamity.stats().engaged && hazardCount() === 0 && W.Calamity.nearest(W.Player.wx,W.Player.wy) === null,
  '離開戰場會清除全部地圖攻勢並解除遠距鎖定');
check(firstBoss.hp > beforeRetreatHp && firstBoss.hp <= firstBoss.maxHp,
  '撤離以小幅回復首領生命換取安全，不可無成本洗彈幕');
W.Player.wx = altar.wx; W.Player.wy = altar.wy;
W.Calamity.update(0.05);
check(W.Calamity.stats().engaged && W.Calamity.stats().grace > 2,
  '重新進場提供明確安全前搖，不會立即受擊');

/* 正式死亡：清場、首領歸位；紀錄點復活至少有 2.8 秒共同無敵。 */
W.Calamity.onPlayerDefeated();
check(!W.Calamity.stats().engaged && hazardCount() === 0,
  '死亡當下立即中止災禍攻勢');
W.DivineArms.clear(); W.BondMate.mate().blockCd = 99; W.Stats.importData({hp:50,food:100,stam:100,san:100});
W.Stats.revive(3.5);
const safeHp = W.Stats.hp();
check(W.Stats.damage(8,'lava-zone') === false && W.Stats.hp() === safeHp,
  '紀錄點復活安全期會阻止立即連死');
W.Stats.update(3.6);
check(W.Stats.damage(8,'lava-zone') === true && W.Stats.hp() < safeHp,
  '安全期結束後傷害流程正常恢復');

/* 玩家命中累積連攜，滿值自動夾擊；秘境把戰鬥進度轉成獎勵並回饋下一戰。 */
W.Calamity.clear(); W.Mobs.clearAll(); W.Mobs.update(0); W.BondMate.init();
W.Player.wx=500;W.Player.wy=500;W.BondMate.spawnNearPlayer();
const mob = W.Mobs.at(0);
mob.alive=true;mob.type=W.Mobs.TYPE.WOLF;mob.wx=500;mob.wy=500;mob.hp=200;mob.threatT=1;
const fakeHit = {name:'狼',dmg:11,killed:false,wx:500,wy:500,type:W.Mobs.TYPE.WOLF,boss:false,calamity:false};
for (let i = 0; i < 13; i++) W.BondMate.notePlayerHit(fakeHit);
check(mob.hp === 200 && W.BondMate.stats().sync === 100 && W.BondMate.stats().comboReady,
  '連攜滿值會保留，等待玩家選擇發動時機');
check(W.BondMate.activatePower('combo') && mob.hp === 174 && W.BondMate.stats().sync === 0,
  '短按主動連攜發動 26 傷害彈力夾擊');
W.BondMate.mate().atkT = 99; for (let i = 0; i < 36; i++) W.BondMate.update(0.1);
for (let i = 0; i < 5; i++) W.BondMate.notePlayerHit(fakeHit);
const loot = W.Sites.loot({k:'phase22-site',wx:500,wy:500,type:W.Sites.TYPE.CAVE,seed:22022});
check(loot && loot.name === '洞穴秘境' && loot.bond === 2 && W.BondMate.stats().echo > 44,
  '戰鬥連攜提高秘境搜刮，並開啟 45 秒老皮共鳴');
for (let i = 0; i < 7; i++) W.BondMate.notePlayerHit(fakeHit);
check(mob.hp === 174 && W.BondMate.stats().sync === 100 && W.BondMate.activatePower('combo') && mob.hp === 140,
  '秘境共鳴以 1.6 倍累積連攜，主動夾擊提高為 34 傷害');

console.log(failures ? '\n=== Phase 22 災禍與羈絆驗證失敗：'+failures+' 項 ===' : '\n=== Phase 22 災禍與羈絆驗證全部通過 ===');
process.exitCode = failures ? 1 : 0;
