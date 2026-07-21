window.W = window.W || {};

/* 存檔系統
   三鐵律：任何新資料類型必須同時接上「寫入 collect()」「還原 apply()」「版本遷移 migrate()」，
   缺一即代表換裝置或改版後資料消失。新增欄位時三個函式都要動。
   儲存介質：只用 IndexedDB（不使用瀏覽器同步型儲存，避免 Safari 隱私模式問題）。 */
W.Save = (function() {

  var DB_NAME = 'wilds';
  var STORE = 'kv';
  var KEY = 'save';
  var BACKUP_1 = 'save_backup_1';
  var BACKUP_2 = 'save_backup_2';
  var VERSION = 19;

  var db = null;
  var ok = false;
  var reason = '\u5c1a\u672a\u521d\u59cb\u5316';
  var lastSaved = 0;
  var lastError = '';
  var lastRecovery = '';
  var lastOverflow = 0;
  var autoT = 0;
  var writeChain = Promise.resolve(true);

  function open() {
    return new Promise(function(resolve) {
      var req;
      try {
        req = indexedDB.open(DB_NAME, 1);
      } catch (err) {
        ok = false;
        reason = 'indexedDB \u4e0d\u53ef\u7528';
        resolve(false);
        return;
      }
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = function(e) {
        db = e.target.result;
        ok = true;
        reason = '\u6b63\u5e38';
        resolve(true);
      };
      req.onerror = function() {
        ok = false;
        reason = '\u958b\u555f\u5931\u6557\uff08\u53ef\u80fd\u662f\u96b1\u79c1\u700f\u89bd\uff09';
        resolve(false);
      };
    });
  }

  function putAt(key, val) {
    return new Promise(function(resolve) {
      if (!db) { resolve(false); return; }
      var tx, st, rq;
      try {
        tx = db.transaction(STORE, 'readwrite');
        st = tx.objectStore(STORE);
        rq = st.put(val, key);
      } catch (err) {
        lastError = String(err);
        resolve(false);
        return;
      }
      rq.onsuccess = function() { resolve(true); };
      rq.onerror = function() { lastError = 'put ' + key + ' \u5931\u6557'; resolve(false); };
    });
  }

  function put(val) { return putAt(KEY, val); }

  function readAt(key) {
    return new Promise(function(resolve) {
      if (!db) { resolve(null); return; }
      var tx, st, rq;
      try {
        tx = db.transaction(STORE, 'readonly');
        st = tx.objectStore(STORE);
        rq = st.get(key);
      } catch (err) {
        lastError = String(err);
        resolve(null);
        return;
      }
      rq.onsuccess = function() { resolve(rq.result || null); };
      rq.onerror = function() { lastError = 'get ' + key + ' \u5931\u6557'; resolve(null); };
    });
  }

  function read() { return readAt(KEY); }

  function removeAt(key) {
    return new Promise(function(resolve) {
      if (!db) { resolve(false); return; }
      var tx, rq;
      try {
        tx = db.transaction(STORE, 'readwrite');
        rq = tx.objectStore(STORE).delete(key);
      } catch (err) {
        resolve(false);
        return;
      }
      rq.onsuccess = function() { resolve(true); };
      rq.onerror = function() { resolve(false); };
    });
  }

  function remove() { return removeAt(KEY); }

  /* 新存檔帶輕量校驗碼；舊版本沒有校驗碼仍可正常遷移。 */
  function checksumOf(data) {
    if (!data || typeof data !== 'object') return '';
    var had = Object.prototype.hasOwnProperty.call(data, 'checksum');
    var old = data.checksum;
    data.checksum = '';
    var s;
    try { s = JSON.stringify(data); }
    catch (err) { s = ''; }
    if (had) data.checksum = old; else delete data.checksum;
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function seal(data) {
    if (!data || typeof data !== 'object') return data;
    data.checksum = '';
    data.checksum = checksumOf(data);
    return data;
  }

  function valid(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.v !== undefined && (!isFinite(data.v) || data.v < 0 || data.v > VERSION)) return false;
    if (data.checksum && data.checksum !== checksumOf(data)) return false;
    return true;
  }

  function rotateAndPut(data) {
    return Promise.all([readAt(KEY), readAt(BACKUP_1)]).then(function(old) {
      var p = Promise.resolve(true);
      if (valid(old[1])) p = p.then(function() { return putAt(BACKUP_2, old[1]); });
      if (valid(old[0])) p = p.then(function() { return putAt(BACKUP_1, old[0]); });
      return p.then(function() { return putAt(KEY, data); });
    });
  }

  /* 序列化所有寫入，避免 pagehide、手動存檔與自動存檔同時輪替備份。 */
  function safeWrite(data) {
    var job = writeChain.then(function() { return rotateAndPut(data); });
    writeChain = job.then(function() { return true; }, function() { return false; });
    return job;
  }

  /* --- 鐵律一：寫入 --- */
  function collect() {
    return {
      v: VERSION,
      seed: W.CFG.SEED,
      savedAt: Date.now(),
      player: {
        wx: W.Player.wx,
        wy: W.Player.wy,
        faceX: W.Player.faceX,
        faceY: W.Player.faceY
      },
      inv: W.Inv.exportData(),
      taken: W.Res.exportTaken(),
      stats: W.Stats.exportData(),
      home: { wx: W.Player.homeWx, wy: W.Player.homeWy },
      gear: W.Craft.exportData(),
      builds: W.Build.exportData(),
      time: W.Time.exportData(),
      sites: W.Sites.exportData(),
      store: W.Store.exportData(),
      mates: W.Mates.exportData(),
      bosses: W.Bosses.exportData(),
      divineArms: W.DivineArms.exportData(),
      calamity: W.Calamity.exportData(),
      travel: W.Travel ? W.Travel.exportData() : [],
      journal: W.Journal ? W.Journal.exportData() : {},
      skins: W.Skins ? W.Skins.exportData() : {},
      rewards: W.Rewards ? W.Rewards.exportData() : {}
    };
  }

  /* --- 鐵律二：還原 --- */
  function apply(data) {
    if (!data) return false;
    data = migrate(data);
    if (!data) return false;

    var p = data.player;
    if (p && isFinite(p.wx) && isFinite(p.wy)) {
      W.Player.wx = p.wx;
      W.Player.wy = p.wy;
      W.Player.faceX = isFinite(p.faceX) ? p.faceX : 0;
      W.Player.faceY = isFinite(p.faceY) ? p.faceY : 1;
    }
    W.Inv.importData(data.inv);
    W.Res.importTaken(data.taken);
    W.Stats.importData(data.stats);
    W.Craft.importData(data.gear);
    W.Build.importData(data.builds);
    W.Time.importData(data.time);
    W.Sites.importData(data.sites);
    /* 順序不可調換：夥伴的招募判定依賴魔王是否已被擊敗 */
    W.Bosses.importData(data.bosses);
    W.DivineArms.importData(data.divineArms);
    W.Calamity.importData(data.calamity);
    if (W.Travel) W.Travel.importData(data.travel);
    if (W.Journal) W.Journal.importData(data.journal);
    if (W.Skins) W.Skins.importData(data.skins);
    if (W.Rewards) W.Rewards.importData(data.rewards);
    W.Mates.importData(data.mates);
    W.Store.importData(data.store);
    lastOverflow = W.Store.absorbOverflow();
    if (data.home && isFinite(data.home.wx) && isFinite(data.home.wy)) {
      W.Player.homeWx = data.home.wx;
      W.Player.homeWy = data.home.wy;
    }
    return true;
  }

  /* --- 鐵律三：版本遷移 --- */
  function migrate(data) {
    if (typeof data !== 'object') return null;
    var v = data.v || 0;

    if (v === 0) {
      data.v = 1;
      if (!data.player) data.player = { wx: W.CFG.START_WX, wy: W.CFG.START_WY };
      if (!data.inv) data.inv = {};
      if (!data.taken) data.taken = {};
      v = 1;
    }

    if (v === 1) {
      /* v1 沒有生存數值與出生點，補上預設值 */
      if (!data.stats) data.stats = { hp: 100, food: 100, stam: 100 };
      if (!data.home) data.home = null;
      data.v = 2;
      v = 2;
    }

    if (v === 2) {
      /* v2 沒有裝備與建造物，補上空值 */
      if (!data.gear) data.gear = { axe: false, pick: false };
      if (!data.builds) data.builds = [];
      data.v = 3;
      v = 3;
    }

    if (v === 3) {
      /* v3 沒有世界時鐘，從第一天早上開始 */
      if (!data.time) data.time = { t: 0.16, day: 1 };
      data.v = 4;
      v = 4;
    }

    if (v === 4) {
      /* v4 沒有遺跡搜刮紀錄，視為全部未搜刮 */
      if (!data.sites) data.sites = [];
      data.v = 5;
      v = 5;
    }

    if (v === 5) {
      /* v5 沒有倉庫，視為空倉庫 */
      if (!data.store) data.store = {};
      data.v = 6;
      v = 6;
    }

    if (v === 6) {
      /* v6 沒有夥伴與魔王紀錄，視為一位都沒招募、魔王都還在 */
      if (!data.mates) data.mates = {};
      if (!data.bosses) data.bosses = {};
      data.v = 7;
      v = 7;
    }

    if (v === 7) {
      /* v7 沒有神武與世界災禍入口狀態 */
      if (!data.divineArms) data.divineArms = {};
      if (!data.calamity) data.calamity = {};
      data.v = 8;
      v = 8;
    }


    if (v === 8) {
      /* v8 沒有災禍 Skin 收藏與裝備狀態 */
      if (!data.skins) data.skins = {};
      data.v = 9;
      v = 9;
    }

    if (v === 9) {
      /* v9 神武資料只有神盾欄位；新欄位由 importData 安全補零 */
      if (!data.divineArms) data.divineArms = {};
      data.v = 10;
      v = 10;
    }

    if (v === 10) {
      /* v10 沒有神武共鳴計數，新欄位由 importData 安全補零 */
      if (!data.divineArms) data.divineArms = {};
      data.v = 11;
      v = 11;
    }

    if (v === 11) {
      /* v11 尚未支援第二位世界災禍；舊資料由 calamity.importData 相容處理 */
      if (!data.calamity) data.calamity = {};
      data.v = 12;
      v = 12;
    }

    if (v === 12) {
      /* v12 沒有飛升輪迴與神格碎片 */
      if (!data.calamity) data.calamity = {};
      if (typeof data.calamity.ascensionCycle !== 'number') data.calamity.ascensionCycle = 0;
      if (typeof data.calamity.divinityShards !== 'number') data.calamity.divinityShards = 0;
      if (!data.calamity.replayNext) data.calamity.replayNext = 'kun';
      data.v = 13;
      v = 13;
    }

    if (v === 13) {
      /* v13 尚未保存神斧／神翼的怒氣、閃避冷卻與五神領域計數。 */
      if (!data.divineArms) data.divineArms = {};
      data.v = 14;
      v = 14;
    }

    if (v === 14) {
      /* v14 尚未記錄已探索的快速移動地點；營地永遠可用。 */
      if (!data.travel) data.travel = [];
      data.v = 15;
      v = 15;
    }

    if (v === 15) {
      /* v15 沒有冒險日誌；既有成就會由 journal.update 補登，獎勵仍需手動領取。 */
      if (!data.journal) data.journal = {};
      data.v = 16;
      v = 16;
    }

    if (v === 16) {
      /* v16 沒有獎勵中心的已讀狀態；收藏與榮譽由既有進度安全回推。 */
      if (!data.rewards) data.rewards = {};
      data.v = 17;
      v = 17;
    }

    if (v === 17) {
      /* v17 只有兩套災禍 Skin；新增 Skin 與不死鳥涅槃狀態由 importData 安全補值。 */
      if (!data.skins) data.skins = {};
      if (typeof data.skins.phoenixUsed !== 'boolean') data.skins.phoenixUsed = false;
      data.v = 18;
      v = 18;
    }

    if (v === 18) {
      /* v18 的不死鳥只有永久單次旗標；v19 改成每次飛升輪迴各可使用一次。 */
      if (!data.skins) data.skins = {};
      if (typeof data.skins.phoenixCycle !== 'number') {
        var savedCycle = data.calamity && typeof data.calamity.ascensionCycle === 'number'
          ? Math.max(0, Math.floor(data.calamity.ascensionCycle)) : 0;
        data.skins.phoenixCycle = data.skins.phoenixUsed ? savedCycle : -1;
      }
      data.v = 19;
      v = 19;
    }

    /* 種子不同代表是另一個世界，座標與採集狀態不可沿用，只保留背包 */
    if (data.seed !== W.CFG.SEED) {
      data.player = null;
      data.taken = {};
      data.home = null;
      data.builds = [];
      data.sites = [];
      data.store = {};
      data.mates = {};
      data.bosses = {};
      data.divineArms = {};
      data.calamity = {};
      data.travel = [];
      data.journal = {};
      data.skins = {};
      data.rewards = {};
    }

    if (v > VERSION) return null;
    return data;
  }

  /* 產生快照並寫回本機，回傳「實際存下去的那一份」。
     雲端上傳必須用這一份，否則雲端會帶著另一個時間戳，
     下次比對就會誤判成雲端比較新而反覆下載。 */
  function snapshot() {
    if (!ok) return Promise.resolve(null);
    var d = seal(collect());
    return safeWrite(d).then(function(r) {
      if (!r) return null;
      lastSaved = d.savedAt;
      if (W.Cloud) W.Cloud.markDirty();
      return d;
    });
  }

  function save() {
    return snapshot().then(function(d) { return !!d; });
  }

  function load() {
    if (!ok) return Promise.resolve(false);
    return read().then(function(d) {
      if (valid(d) && apply(d)) {
        lastSaved = d.savedAt || 0;
        lastRecovery = '';
        return true;
      }
      lastError = d ? '主存檔校驗失敗，正在嘗試備份' : '';
      return recoverBackup();
    });
  }

  function recoverBackup() {
    return readAt(BACKUP_1).then(function(first) {
      if (valid(first) && apply(first)) return restoreRecovered(first, '備份 1');
      return readAt(BACKUP_2).then(function(second) {
        if (valid(second) && apply(second)) return restoreRecovered(second, '備份 2');
        return false;
      });
    });
  }

  function restoreRecovered(data, label) {
    seal(data);
    lastSaved = data.savedAt || 0;
    lastRecovery = label;
    lastError = '';
    return putAt(KEY, data).then(function(r) { return !!r; });
  }

  /* 雲端下載後的套用路徑：一律先過 migrate，再進 apply，最後寫回本機 IDB。
     少了寫回這一步，重開 App 會被舊的本機檔蓋掉。 */
  function applyRemote(data) {
    if (!valid(data)) return Promise.resolve(false);
    var m = migrate(data);
    if (!m) return Promise.resolve(false);
    if (!apply(m)) return Promise.resolve(false);
    lastSaved = m.savedAt || Date.now();
    seal(m);
    return safeWrite(m).then(function(r) { return !!r; });
  }

  function wipe() {
    W.Inv.clear();
    W.Res.clearTaken();
    W.Craft.clear();
    W.Build.clear();
    W.Time.clear();
    W.Sites.clear();
    W.Store.clear();
    W.Bosses.clear();
    W.DivineArms.clear();
    W.Calamity.clear();
    if (W.Skins) W.Skins.clear();
    if (W.Rewards) W.Rewards.clear();
    W.Mates.clear();
    lastSaved = 0;
    lastRecovery = '';
    return Promise.all([remove(), removeAt(BACKUP_1), removeAt(BACKUP_2)]).then(function() { return true; });
  }

  function tick(dt) {
    if (!ok) return;
    autoT += dt;
    if (autoT < W.CFG.AUTOSAVE_INTERVAL) return;
    autoT = 0;
    save();
  }

  function info() {
    return {
      ok: ok,
      reason: reason,
      lastSaved: lastSaved,
      lastError: lastError,
      lastRecovery: lastRecovery,
      version: VERSION,
      overflow: lastOverflow
    };
  }

  return {
    open: open,
    save: save,
    load: load,
    wipe: wipe,
    tick: tick,
    info: info,
    collect: collect,
    snapshot: snapshot,
    apply: apply,
    migrate: migrate,
    applyRemote: applyRemote
  };
})();
