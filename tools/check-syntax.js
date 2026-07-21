/* Layer 1：以 Node 完整解析器檢查所有 JS 與 Service Worker。 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'js'))
  .filter(f => f.endsWith('.js')).sort().map(f => path.join(root, 'js', f));
files.push(...fs.readdirSync(path.join(root, 'tools'))
  .filter(f => f.endsWith('.js')).sort().map(f => path.join(root, 'tools', f)));
files.push(path.join(root, 'sw.js'));

let bad = false;
for (const file of files) {
  const r = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  const rel = path.relative(root, file);
  if (r.status === 0) console.log('✅ ' + rel);
  else {
    bad = true;
    console.log('❌ ' + rel);
    console.log((r.stderr || r.stdout || '').trim());
  }
}
console.log(bad ? '\n=== 語法層失敗 ===' : '\n=== 語法層全部通過 ===');
process.exitCode = bad ? 1 : 0;
