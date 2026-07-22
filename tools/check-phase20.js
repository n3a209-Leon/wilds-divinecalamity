/* Phase 20：老皮常駐、守護順序、救援、羈絆 Skin 與 v20 存檔煙霧測試。 */
const fs = require('fs');
const path = require('path');
const {loadProject} = require('./check-load');
const root = path.resolve(__dirname, '..');
const loaded = loadProject(root, true);
if (loaded.failures.length) process.exit(1);
const W = loaded.context.W;
let failures = 0;
function check(ok, msg) { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) failures++; }

W.Player.wx = 500; W.Player.wy = 500; W.Player.faceX = 1; W.Player.faceY = 0;
W.BondMate.clear(); W.BondMate.spawnNearPlayer();
check(W.Mates.count() === 4 && W.BondMate.mate().permanent && W.BondMate.mate().def.name === '老皮', '老皮常駐且不占四隻招募夥伴名額');

W.Mobs.update(0);
const nearPassive = W.Mobs.at(0), farThreat = W.Mobs.at(1);
nearPassive.alive=true;nearPassive.type=0;nearPassive.wx=520;nearPassive.wy=500;nearPassive.hp=100;nearPassive.threatT=0;
farThreat.alive=true;farThreat.type=2;farThreat.wx=620;farThreat.wy=500;farThreat.hp=100;farThreat.threatT=1;
W.BondMate.mate().wx=500;W.BondMate.mate().wy=500;W.BondMate.mate().atkT=0;
W.BondMate.update(0.01);
check(farThreat.hp < 100 && nearPassive.hp === 100, '守護鎖定會優先攻擊較遠但正在威脅玩家的敵人');
W.Mobs.clearAll();

W.Stats.importData({hp:100,food:100,stam:100,san:100});
W.BondMate.mate().wx = W.Player.wx; W.BondMate.mate().wy = W.Player.wy;
W.DivineArms.clear(); W.DivineArms.unlock('shield');
const divineFirst = W.Stats.damage(12, 'wolf-contact', 530, 500);
check(divineFirst === false && W.BondMate.stats().blocks === 0 && W.BondMate.stats().energy === 100, '神武先於老皮攔截，不會浪費老皮守護能量與冷卻');
W.DivineArms.clear();
const hp0 = W.Stats.hp();
const first = W.Stats.damage(12, 'wolf-contact', 530, 500);
check(first === false && W.Stats.hp() === hp0 && W.BondMate.stats().blocks === 1 && W.BondMate.stats().energy === 60, '老皮會吸收一次敵人傷害並消耗 40 守護能量');
const second = W.Stats.damage(12, 'wolf-contact', 530, 500);
check(second === true && W.Stats.hp() < hp0, '擋傷冷卻期間下一擊正常結算，不會無限免傷');

W.Stats.update(1);
W.BondMate.mate().blockCd = 0; W.BondMate.mate().guardEnergy = 100;
const hp1 = W.Stats.hp();
const ground = W.Stats.damage(5, 'lava-zone');
check(ground === true && W.Stats.hp() < hp1 && W.BondMate.mate().guardEnergy === 100, '持續地板傷害不消耗老皮守護技');

W.Stats.update(1); W.Inv.add('cooked', 1);
W.BondMate.mate().guardEnergy = 100; W.BondMate.mate().blockCd = 0;
W.Stats.importData({hp:5,food:20,stam:20,san:100});
const lethal = W.Stats.damage(999, 'lava-zone');
check(lethal === true && !W.Stats.isDead() && W.Stats.hpPct() >= 0.25 && W.Inv.count('cooked') === 0 && W.BondMate.stats().rescues === 1, '不死鳥未觸發時老皮消耗熟食完成每日救援');

const old = {v:19,seed:W.CFG.SEED,time:{day:7,t:0.2},skins:{},calamity:{}};
const migrated = W.Save.migrate(old);
check(migrated && migrated.v === 22 && migrated.bondMate && migrated.bondMate.lastBondDay === 7 && migrated.laopiLife, 'v19 舊存檔升 v22 時補齊老皮記憶、秘境與荒野生活紀錄');

W.Skins.clear();
W.BondMate.importData({daysTogether:3,lastBondDay:7,blocks:8,bossWins:1,calamityWins:0,rescues:0,lastRescueDay:-1});
W.Rewards.sync(true);
check(W.Skins.has('found_family') && W.Skins.definition('found_family').passive, '羈絆條件解鎖「找到的家人」且維持純外觀');

for (const name of ['mate_laopi_sheet.png','player_found_family.png','player2_found_family.png']) {
  const b = fs.readFileSync(path.join(root, 'assets', name));
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20), colorType = b[25];
  const expected = name === 'mate_laopi_sheet.png' ? [576,192] : [640,384];
  check(w === expected[0] && h === expected[1] && (colorType === 4 || colorType === 6), name + ' 尺寸與透明通道符合遊戲契約');
}

console.log(failures ? '\n=== Phase 20 老皮煙霧測試失敗：'+failures+' 項 ===' : '\n=== Phase 20 老皮煙霧測試全部通過 ===');
process.exitCode = failures ? 1 : 0;
