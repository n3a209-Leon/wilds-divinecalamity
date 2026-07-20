window.W = window.W || {};

/* 遺跡：位置由座標雜湊決定，可重現，因此地點本身不需存檔。
   只有「哪些箱子已搜刮過」需要記錄——這是必須存檔的資料類型，
   新增欄位時務必同步 save.js 的 collect / apply / migrate 三處。 */
W.Sites = (function() {

  var TYPE = { RUIN: 0, CAVE: 1 };
  var NAMES = ['\u5ee2\u589f', '\u6d1e\u7a74'];

  var cache = {};
  var cacheKeys = [];
  var looted = {};
  var lootedCount = 0;

  var _near = [];
  var _nearN = 0;
  var i0;
  for (i0 = 0; i0 < 24; i0++) _near.push(null);

  /* 每個 REGION 見方的區域最多一座遺跡 */
  function siteFor(rx, ry) {
    var k = rx + ',' + ry;
    if (cache.hasOwnProperty(k)) return cache[k];

    var R = W.CFG.SITE_REGION;
    var h = W.Rng.hash2i(rx, ry, W.CFG.SEED + 7301);
    var s = null;

    if (h < W.CFG.SITE_CHANCE) {
      var jx = W.Rng.hash2i(rx + 17, ry + 5, W.CFG.SEED + 7302);
      var jy = W.Rng.hash2i(rx + 91, ry + 43, W.CFG.SEED + 7303);
      var ty = W.Rng.hash2i(rx + 7, ry + 71, W.CFG.SEED + 7304);
      var wx = rx * R + R * (0.2 + jx * 0.6);
      var wy = ry * R + R * (0.2 + jy * 0.6);

      if (wx > 200 && wy > 200 && wx < W.CFG.WORLD_SIZE - 200 && wy < W.CFG.WORLD_SIZE - 200 &&
          !W.World.isSolidAt(wx, wy)) {
        s = {
          k: k,
          wx: wx,
          wy: wy,
          type: (ty < 0.55) ? TYPE.RUIN : TYPE.CAVE,
          seed: Math.floor(h * 100000)
        };
      }
    }

    cache[k] = s;
    cacheKeys.push(k);
    if (cacheKeys.length > 96) delete cache[cacheKeys.shift()];
    return s;
  }

  function isLooted(s) {
    return !!looted[s.k];
  }

  /* 戰利品固定由遺跡座標決定，同一座遺跡永遠給同樣的東西 */
  function loot(s) {
    if (!s || isLooted(s)) return null;
    looted[s.k] = 1;
    lootedCount++;

    var h1 = W.Rng.hash2i(s.seed, 11, W.CFG.SEED + 811);
    var h2 = W.Rng.hash2i(s.seed, 29, W.CFG.SEED + 812);
    var isCave = (s.type === TYPE.CAVE);

    var metal = isCave ? (1 + Math.floor(h1 * 3)) : Math.floor(h1 * 2);
    var flint = isCave ? (2 + Math.floor(h2 * 3)) : (1 + Math.floor(h2 * 2));
    var arrow = Math.floor(h2 * 6);
    var hide  = isCave ? 0 : (1 + Math.floor(h1 * 3));
    var cooked = isCave ? 0 : Math.floor(h2 * 2);

    if (metal > 0) W.Inv.add('metal', metal);
    if (flint > 0) W.Inv.add('flint', flint);
    if (arrow > 0) W.Inv.add('arrow', arrow);
    if (hide > 0) W.Inv.add('hide', hide);
    if (cooked > 0) W.Inv.add('cooked', cooked);

    _res.name = NAMES[s.type];
    _res.metal = metal;
    _res.flint = flint;
    _res.arrow = arrow;
    _res.hide = hide;
    _res.cooked = cooked;
    return _res;
  }

  var _res = { name: '', metal: 0, flint: 0, arrow: 0, hide: 0, cooked: 0 };

  /* 每幀更新一次的鄰近遺跡清單，使用預先配置的陣列 */
  function updateNear(wx, wy) {
    var R = W.CFG.SITE_REGION;
    var range = W.CFG.SITE_NEAR;
    var r0 = Math.floor((wx - range) / R), r1 = Math.floor((wx + range) / R);
    var c0 = Math.floor((wy - range) / R), c1 = Math.floor((wy + range) / R);
    var rx, ry, s, dx, dy;

    _nearN = 0;
    for (ry = c0; ry <= c1; ry++) {
      for (rx = r0; rx <= r1; rx++) {
        s = siteFor(rx, ry);
        if (!s) continue;
        dx = s.wx - wx;
        dy = s.wy - wy;
        if (dx * dx + dy * dy > range * range) continue;
        if (_nearN >= _near.length) continue;
        _near[_nearN++] = s;
      }
    }
  }

  function nearCount() { return _nearN; }
  function nearAt(i) { return _near[i]; }

  /* 玩家腳邊可搜刮的箱子 */
  function chestAt(wx, wy) {
    var i, s, dx, dy, r = W.CFG.SITE_LOOT_RANGE;
    for (i = 0; i < _nearN; i++) {
      s = _near[i];
      if (isLooted(s)) continue;
      dx = s.wx - wx;
      dy = s.wy - wy;
      if (dx * dx + dy * dy <= r * r) return s;
    }
    return null;
  }

  function exportData() {
    var out = [], k;
    for (k in looted) {
      if (looted.hasOwnProperty(k)) out.push(k);
    }
    return out;
  }

  function importData(arr) {
    var i;
    looted = {};
    lootedCount = 0;
    if (!arr || !arr.length) return;
    for (i = 0; i < arr.length; i++) {
      if (typeof arr[i] !== 'string') continue;
      looted[arr[i]] = 1;
      lootedCount++;
    }
  }

  function clear() {
    looted = {};
    lootedCount = 0;
  }

  function stats() {
    return { near: _nearN, looted: lootedCount };
  }

  return {
    TYPE: TYPE,
    NAMES: NAMES,
    siteFor: siteFor,
    isLooted: isLooted,
    loot: loot,
    updateNear: updateNear,
    nearCount: nearCount,
    nearAt: nearAt,
    chestAt: chestAt,
    exportData: exportData,
    importData: importData,
    clear: clear,
    stats: stats
  };
})();
