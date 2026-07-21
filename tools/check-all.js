/* 依「語法 → 載入期 → 結構」順序執行；任一層失敗立即停止。 */
const path = require('path');
const cp = require('child_process');
const steps = ['check-syntax.js','check-load.js','check-structure.js','check-phase16.js','check-phase17.js','check-phase18.js','check-phase19.js','check-save-backup.js'];

for (const step of steps) {
  console.log('\n============================================================');
  console.log('執行 ' + step);
  console.log('============================================================');
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, step)], {stdio:'inherit'});
  if (r.status !== 0) {
    console.log('\n檢查已停止：請先修正本層錯誤，再執行後續層。');
    process.exit(r.status || 1);
  }
}
console.log('\n✅ WILDS 三層崩潰檢查全部通過，可進入部署驗收。');
