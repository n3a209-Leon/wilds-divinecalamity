/* 使用記憶體版 IndexedDB 驗證真實非同步寫入、輪替與兩級復原。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {makeContext, scriptOrder} = require('./check-load');

const root = path.resolve(__dirname, '..');
const memory = {};
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function fakeIndexedDB() {
  let created = false;
  const db = {
    objectStoreNames: { contains: () => created },
    createObjectStore() { created = true; },
    transaction() {
      return { objectStore() {
        return {
          put(value, key) { return request(() => { memory[key] = clone(value); return key; }); },
          get(key) { return request(() => clone(memory[key])); },
          delete(key) { return request(() => { delete memory[key]; return undefined; }); }
        };
      }};
    }
  };
  return { open() {
    const rq = {};
    queueMicrotask(() => {
      if (!created && rq.onupgradeneeded) rq.onupgradeneeded({target:{result:db}});
      rq.result = db;
      if (rq.onsuccess) rq.onsuccess({target:{result:db}});
    });
    return rq;
  }};
}

function request(work) {
  const rq = {};
  queueMicrotask(() => {
    try { rq.result = work(); if (rq.onsuccess) rq.onsuccess({target:rq}); }
    catch (error) { rq.error = error; if (rq.onerror) rq.onerror({target:rq}); }
  });
  return rq;
}

async function run() {
  const context = makeContext();
  context.indexedDB = fakeIndexedDB();
  for (const rel of scriptOrder(root)) vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, {filename:rel});
  const W = context.W;
  W.Cloud.markDirty = function() {};
  let failures = 0;
  function check(ok, msg) { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) failures++; }

  check(await W.Save.open(), '記憶體 IndexedDB 可開啟');
  W.Inv.clear(); W.Inv.add('wood', 1); check(await W.Save.save(), '第一份主存檔寫入成功');
  W.Inv.add('wood', 1); check(await W.Save.save(), '第二次寫入建立備份 1');
  W.Inv.add('wood', 1); check(await W.Save.save(), '第三次寫入建立備份 2');
  check(memory.save && memory.save_backup_1 && memory.save_backup_2, '主存檔與兩份輪替備份同時存在');
  check(memory.save.checksum && memory.save_backup_1.checksum && memory.save_backup_2.checksum, '三份資料皆帶校驗碼');

  memory.save.checksum = 'broken-main';
  W.Inv.clear();
  check(await W.Save.load() && W.Inv.count('wood') === 2 && W.Save.info().lastRecovery === '備份 1', '主存檔損壞時自動復原備份 1');

  memory.save.checksum = 'broken-main-again';
  memory.save_backup_1.checksum = 'broken-backup-1';
  W.Inv.clear();
  check(await W.Save.load() && W.Inv.count('wood') === 1 && W.Save.info().lastRecovery === '備份 2', '主存檔與備份 1 同時損壞時復原備份 2');

  console.log(failures ? '\n=== 存檔備份實測失敗：'+failures+' 項 ===' : '\n=== 存檔備份非同步實測全部通過 ===');
  process.exitCode = failures ? 1 : 0;
}

run().catch(error => { console.error('❌ 存檔備份測試崩潰：' + error.stack); process.exitCode = 1; });

