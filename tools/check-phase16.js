/* Phase 16 功能煙霧測試：在無頭瀏覽器環境驗證召喚、榮譽、涅槃、回饋與遷移。 */
const fs = require('fs');
const path = require('path');
const {loadProject} = require('./check-load');

const root = path.resolve(__dirname, '..');
const loaded = loadProject(root, true);
if (loaded.failures.length) {
  console.log('❌ 前置載入失敗，無法執行 Phase 16 煙霧測試');
  process.exit(1);
}
const W = loaded.context.W;
let failures = 0;
function check(ok, msg) { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) failures++; }

/* 祭壇：開始、手動取消、重新開始後完成。 */
W.Time.importData({day:20,t:0.2});
W.DivineArms.importData({owned:{shield:1},equipped:{shield:1}});
W.Calamity.update(0.01);
const altar = W.Calamity.altarPos();
W.Player.wx = altar.wx; W.Player.wy = altar.wy;
check(W.Calamity.summon() === 'started' && W.Calamity.stats().summoning, '祭壇召喚會先進入十秒儀式');
W.Calamity.update(3);
check(W.Calamity.stats().summonLeft > 6.9 && W.Calamity.stats().summonLeft < 7.1, '召喚倒數使用遊戲時間正確遞減');
check(W.Calamity.summon() === 'cancelled' && !W.Calamity.stats().summoning, '儀式中再次互動可取消');
check(W.Calamity.summon() === 'started', '取消後可重新開始召喚');
W.Calamity.update(10.1);
check(W.Calamity.isSummoned() && W.Calamity.boss() && W.Calamity.boss().alive, '倒數完成才生成世界災禍');

/* 榮譽：五套 Skin + 五區域首領足以解鎖全部實體外觀獎勵。 */
W.Skins.importData({owned:{abyss:1,death:1,star:1,phoenix:1,end:1},equipped:'star'});
W.Bosses.importData({'region:hydra':1,'region:dragon':1,'region:colossus':1,'region:eagle':1,'region:lava':1});
const visual = W.Rewards.visuals();
check(W.Rewards.stats().honor >= 600 && visual.trail && visual.eliteHit && visual.travel && visual.crown, '荒野榮譽會實際解鎖四種外觀回饋');

/* 不死鳥：同一輪迴一次，進入下一輪迴後重新可用。 */
W.Calamity.importData({unlocked:true,defeated:{kun:true,titan:true},ascensionCycle:2,divinityShards:2,replayNext:'kun'});
W.Skins.importData({owned:{phoenix:1},equipped:'phoenix',phoenixCycle:1});
check(W.Skins.tryPhoenixRevive() === 0.35 && W.Skins.tryPhoenixRevive() === 0, '不死鳥同一飛升輪迴只能涅槃一次');
W.Calamity.importData({unlocked:true,defeated:{kun:true,titan:true},ascensionCycle:3,divinityShards:3,replayNext:'titan'});
check(W.Skins.tryPhoenixRevive() === 0.35, '飛升輪迴提升後不死鳥會重新充能');

/* 戰鬥回饋：命中後至少凍結一幀，之後恢復。 */
W.Render.impact(10, 20, true);
check(W.Render.stepFrame(0.016) === 0 && W.Render.stepFrame(0.1) === 0 && W.Render.stepFrame(0.016) > 0, '重擊命中停頓會自動結束，不會永久鎖死遊戲');

/* v18 → v20：先升不死鳥輪迴格式，再補老皮羈絆資料。 */
const old = {v:18,seed:W.CFG.SEED,skins:{phoenixUsed:true},calamity:{ascensionCycle:4}};
const migrated = W.Save.migrate(old);
check(migrated && migrated.v === 20 && migrated.skins.phoenixCycle === 4 && migrated.bondMate, 'v18 存檔可安全遷移到 v20 並補齊老皮資料');

/* 圖片必須有 alpha，且尺寸符合行動裝置成本。 */
for (const name of ['fx_warning.png','fx_hit.png','fx_travel.png']) {
  const b = fs.readFileSync(path.join(root, 'assets', name));
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20), colorType = b[25];
  check(w <= 384 && h <= 384 && (colorType === 4 || colorType === 6), name + ' 尺寸與透明通道有效');
}

console.log(failures ? '\n=== Phase 16 煙霧測試失敗：'+failures+' 項 ===' : '\n=== Phase 16 功能煙霧測試全部通過 ===');
process.exitCode = failures ? 1 : 0;
