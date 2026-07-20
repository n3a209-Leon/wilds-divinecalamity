window.W = window.W || {};

/* 建造物：玩家放置，屬於「必須存檔」的資料類型。
   新增欄位時務必同步 save.js 的 collect / apply / migrate 三處。 */
W.Build = (function() {

  var TYPE = { FIRE: 0, WALL: 1, BED: 2, FURNACE: 3, BENCH: 4, STORE: 5, FENCE: 6, RACK: 7 };
  var NAMES = ['\u71df\u706b', '\u6728\u7246', '\u7761\u888b', '\u7194\u7210', '\u5de5\u4f5c\u53f0', '\u5132\u7269\u7bb1', '\u6805\u6b04', '\u66ec\u8089\u67b6'];
  var BLOCKR = [0, 16, 0, 14, 14, 12, 14, 0];

  var list = [];
  var _near = [];
  var _nearN = 0;
  var i0;
  for (i0 = 0; i0 < 48; i0++) _near.push(null);

  function keyOf(wx, wy) {
    return Math.round(wx) + '|' + Math.round(wy);
  }

  function add(type, wx, wy) {
    var s = { type: type, wx: wx, wy: wy, k: keyOf(wx, wy) };
    list.push(s);
    return s;
  }

  function removeAt(wx, wy, r) {
    var i, dx, dy;
    for (i = list.length - 1; i >= 0; i--) {
      dx = list[i].wx - wx;
      dy = list[i].wy - wy;
      if (dx * dx + dy * dy <= r * r) {
        list.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  function updateNear(wx, wy) {
    var R = W.CFG.BUILD_NEAR;
    var i, s, dx, dy;
    _nearN = 0;
    for (i = 0; i < list.length; i++) {
      s = list[i];
      dx = s.wx - wx;
      dy = s.wy - wy;
      if (dx * dx + dy * dy > R * R) continue;
      if (_nearN >= _near.length) break;
      _near[_nearN++] = s;
    }
  }

  function blocksAt(wx, wy, pr) {
    var i, s, br, dx, dy, t;
    for (i = 0; i < _nearN; i++) {
      s = _near[i];
      br = BLOCKR[s.type];
      if (br === 0) continue;
      dx = s.wx - wx;
      dy = s.wy - wy;
      t = br + pr;
      if (dx * dx + dy * dy < t * t) return true;
    }
    return false;
  }

  /* 是否站在某種建造物附近（例如營火旁才能烤肉） */
  function nearType(wx, wy, type, range) {
    var i, s, dx, dy;
    for (i = 0; i < _nearN; i++) {
      s = _near[i];
      if (s.type !== type) continue;
      dx = s.wx - wx;
      dy = s.wy - wy;
      if (dx * dx + dy * dy <= range * range) return s;
    }
    return null;
  }

  /* 放置點是否可用：地形可走、沒有資源節點、沒有其他建造物 */
  function canPlace(wx, wy) {
    if (W.World.isSolidAt(wx, wy)) return false;
    if (W.Res.blocksAt(wx, wy, 12)) return false;
    var i, dx, dy;
    for (i = 0; i < _nearN; i++) {
      dx = _near[i].wx - wx;
      dy = _near[i].wy - wy;
      if (dx * dx + dy * dy < 26 * 26) return false;
    }
    return true;
  }

  function count() { return list.length; }
  function at(i) { return list[i]; }
  function nameOf(type) { return NAMES[type]; }

  function exportData() {
    var out = [], i, s;
    for (i = 0; i < list.length; i++) {
      s = list[i];
      out.push([s.type, Math.round(s.wx), Math.round(s.wy)]);
    }
    return out;
  }

  function importData(arr) {
    var i, r;
    list = [];
    if (!arr || !arr.length) return;
    for (i = 0; i < arr.length; i++) {
      r = arr[i];
      if (!r || r.length < 3) continue;
      if (typeof r[1] !== 'number' || typeof r[2] !== 'number') continue;
      if (!isFinite(r[1]) || !isFinite(r[2])) continue;
      if (r[0] < 0 || r[0] > 7) continue;
      add(r[0], r[1], r[2]);
    }
  }

  function clear() { list = []; _nearN = 0; }

  function stats() {
    var i, c = [0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < list.length; i++) c[list[i].type]++;
    return { total: list.length, fire: c[0], wall: c[1], bed: c[2], furnace: c[3], bench: c[4], store: c[5], fence: c[6], rack: c[7] };
  }

  return {
    TYPE: TYPE,
    NAMES: NAMES,
    add: add,
    removeAt: removeAt,
    updateNear: updateNear,
    blocksAt: blocksAt,
    nearType: nearType,
    canPlace: canPlace,
    count: count,
    at: at,
    nameOf: nameOf,
    exportData: exportData,
    importData: importData,
    clear: clear,
    stats: stats
  };
})();
