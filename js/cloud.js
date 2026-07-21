window.W = window.W || {};

/* 雲端同步（Firebase compat SDK）
   路徑：users/{uid}/data/wilds:save —— 與 Venus OS 同一個專案，靠鍵值前綴隔離。

   三鐵律在這裡收尾：
     上傳 = upload()、下載還原 = download()、遷移 = 沿用 W.Save.migrate()
   雲端資料一律先過 migrate 才寫回本機，避免舊版雲端檔污染新版本機檔。

   衝突規則：比較 savedAt，新的贏。手動下載若會蓋掉較新的本機檔，需二次確認。 */
W.Cloud = (function() {

  var KEY = 'wilds:save';
  var ready = false;
  var reason = '\u672a\u521d\u59cb\u5316';
  var uid = null;
  var email = '';
  var busy = false;
  var lastUp = 0;
  var lastDown = 0;
  var lastError = '';
  var dirty = false;
  var autoT = 0;
  var db = null;
  var auth = null;
  var chain = Promise.resolve();
  var onState = null;

  /* 所有雲端動作排進同一條佇列，避免自動同步與手動按鈕互相打架。
     用拒絕（busy）擋掉使用者操作體驗很差，排隊等前一個做完才是對的。 */
  function enqueue(fn) {
    chain = chain.then(fn, fn);
    return chain;
  }

  function fb() {
    return (typeof firebase !== 'undefined') ? firebase : null;
  }

  function init() {
    var f = fb();
    if (!W.FIREBASE_CONFIG) { reason = '\u672a\u8a2d\u5b9a'; return false; }
    if (!f) { reason = 'SDK \u672a\u8f09\u5165'; return false; }
    try {
      if (!f.apps || !f.apps.length) f.initializeApp(W.FIREBASE_CONFIG);
      db = f.firestore();
      auth = f.auth();
      auth.onAuthStateChanged(function(u) {
        uid = u ? u.uid : null;
        email = (u && u.email) ? u.email : '';
        if (uid) { reason = '\u5df2\u767b\u5165'; syncNow(); }
        else { reason = '\u672a\u767b\u5165'; }
        if (onState) onState(!!uid);
      });
      ready = true;
      reason = '\u5df2\u521d\u59cb\u5316';
      return true;
    } catch (err) {
      lastError = String(err);
      reason = '\u521d\u59cb\u5316\u5931\u6557';
      return false;
    }
  }

  function signIn() {
    var f = fb();
    if (!ready || !f) return Promise.resolve('\u96f2\u7aef\u672a\u555f\u7528');
    var provider = new f.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider).then(function() {
      return true;
    }).catch(function(err) {
      /* iPhone 加到主畫面時常擋 popup，改用轉址 */
      lastError = String(err && err.code ? err.code : err);
      try {
        auth.signInWithRedirect(provider);
        return '\u6539\u7528\u8f49\u5740\u767b\u5165\u4e2d';
      } catch (e2) {
        return '\u767b\u5165\u5931\u6557\uff1a' + lastError;
      }
    });
  }

  function signOut() {
    if (!ready || !auth) return Promise.resolve(false);
    return auth.signOut().then(function() { return true; });
  }

  function docRef() {
    return db.collection('users').doc(uid).collection('data').doc(KEY);
  }

  function upload() {
    if (!ready) return Promise.resolve('\u96f2\u7aef\u672a\u555f\u7528');
    if (!uid) return Promise.resolve('\u5c1a\u672a\u767b\u5165');
    return enqueue(doUpload);
  }

  function doUpload() {
    if (!uid) return Promise.resolve('\u5c1a\u672a\u767b\u5165');
    busy = true;

    /* 用 snapshot 取得「已寫入本機的那一份」，本機與雲端時間戳才會一致 */
    return W.Save.snapshot().then(function(payload) {
      if (!payload) {
        busy = false;
        return '\u672c\u6a5f\u5b58\u6a94\u4e0d\u53ef\u7528';
      }
      return docRef().set({
        payload: JSON.stringify(payload),
        savedAt: payload.savedAt,
        v: payload.v,
        day: (payload.time && payload.time.day) ? payload.time.day : 0
      }).then(function() {
        busy = false;
        dirty = false;
        lastUp = payload.savedAt;
        return true;
      });
    }).catch(function(err) {
      busy = false;
      lastError = String(err && err.code ? err.code : err);
      return '\u4e0a\u50b3\u5931\u6557\uff1a' + lastError;
    });
  }

  /* 只取回雲端資料，不寫本機，讓呼叫端決定要不要套用 */
  function fetchRemote() {
    if (!ready) return Promise.resolve(null);
    if (!uid) return Promise.resolve(null);
    return docRef().get().then(function(snap) {
      if (!snap.exists) return null;
      var d = snap.data();
      if (!d || !d.payload) return null;
      var obj;
      try {
        obj = JSON.parse(d.payload);
      } catch (e) {
        lastError = '\u96f2\u7aef\u8cc7\u6599\u89e3\u6790\u5931\u6557';
        return null;
      }
      if (!obj || typeof obj !== 'object') return null;
      return { data: obj, savedAt: d.savedAt || obj.savedAt || 0 };
    }).catch(function(err) {
      lastError = String(err && err.code ? err.code : err);
      return null;
    });
  }

  function download(force) {
    if (!ready) return Promise.resolve('\u96f2\u7aef\u672a\u555f\u7528');
    if (!uid) return Promise.resolve('\u5c1a\u672a\u767b\u5165');
    return fetchRemote().then(function(r) {
      if (!r) return '\u96f2\u7aef\u6c92\u6709\u5b58\u6a94';
      var local = W.Save.info().lastSaved || 0;
      if (!force && local > r.savedAt) return 'newer-local';
      return W.Save.applyRemote(r.data).then(function(ok) {
        if (!ok) return '\u96f2\u7aef\u5b58\u6a94\u7248\u672c\u4e0d\u76f8\u5bb9';
        lastDown = r.savedAt;
        return true;
      });
    });
  }

  function flagCount(o, prefix) {
    var n = 0, k;
    if (!o || typeof o !== 'object') return 0;
    for (k in o) if (o.hasOwnProperty(k) && o[k] && (!prefix || k.indexOf(prefix) === 0)) n++;
    return n;
  }

  function progressSummary(data, savedAt) {
    data = data || {};
    var cal = data.calamity || {}, journal = data.journal || {}, skins = data.skins || {};
    return {
      savedAt: savedAt || data.savedAt || 0,
      day: data.time && isFinite(data.time.day) ? Math.max(1, Math.floor(data.time.day)) : 1,
      bosses: flagCount(data.bosses),
      regions: flagCount(data.bosses, 'region:'),
      divine: flagCount(data.divineArms && data.divineArms.owned),
      skins: flagCount(skins.owned),
      journal: flagCount(journal.claimed),
      ascension: Math.max(0, Math.floor(Number(cal.ascensionCycle) || 0)),
      shards: Math.max(0, Math.floor(Number(cal.divinityShards) || 0))
    };
  }

  /* 僅比較摘要，不套用任何資料。覆蓋仍必須由玩家按下明確選項。 */
  function compare() {
    if (!ready) return Promise.resolve('\u96f2\u7aef\u672a\u555f\u7528');
    if (!uid) return Promise.resolve('\u5c1a\u672a\u767b\u5165');
    return Promise.all([W.Save.snapshot(), fetchRemote()]).then(function(all) {
      if (!all[1]) return '\u96f2\u7aef\u6c92\u6709\u5b58\u6a94';
      return {
        local: progressSummary(all[0], all[0] && all[0].savedAt),
        remote: progressSummary(all[1].data, all[1].savedAt)
      };
    });
  }

  /* 自動同步：新的一方覆蓋舊的一方 */
  function syncNow() {
    if (!ready || !uid) return Promise.resolve(false);
    return enqueue(doSync);
  }

  function doSync() {
    if (!uid) return Promise.resolve(false);
    return fetchRemote().then(function(r) {
      var local = W.Save.info().lastSaved || 0;
      if (!r) return doUpload();
      if (r.savedAt > local) {
        return W.Save.applyRemote(r.data).then(function(ok) {
          if (ok) lastDown = r.savedAt;
          return ok ? 'downloaded' : '\u7248\u672c\u4e0d\u76f8\u5bb9';
        });
      }
      if (local > r.savedAt) return doUpload();
      return 'in-sync';
    });
  }

  function markDirty() { dirty = true; }

  function tick(dt) {
    if (!ready || !uid) return;
    autoT += dt;
    if (autoT < W.CFG.CLOUD_INTERVAL) return;
    autoT = 0;
    if (dirty) upload();
  }

  function info() {
    return {
      ready: ready,
      reason: reason,
      uid: uid ? (uid.substring(0, 8) + '\u2026') : '',
      email: email,
      lastUp: lastUp,
      lastDown: lastDown,
      dirty: dirty,
      lastError: lastError
    };
  }

  return {
    init: init,
    setOnState: function(fn) { onState = fn; },
    signIn: signIn,
    signOut: signOut,
    upload: upload,
    download: download,
    compare: compare,
    syncNow: syncNow,
    markDirty: markDirty,
    tick: tick,
    info: info,
    isSignedIn: function() { return !!uid; }
  };
})();
