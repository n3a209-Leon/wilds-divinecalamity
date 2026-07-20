window.W = window.W || {};

/* 資源節點：位置由座標雜湊決定（可重現），
   只有「已採集狀態」需要記錄，因此記憶體佔用極小。 */
W.Res = (function() {
  var T = W.TERRAIN;

  var TYPE = { TREE: 0, ROCK: 1, BUSH: 2, BERRY: 3, FLINT: 4, MUSH: 5 };

  var NAMES  = ['\u6a39\u6728', '\u5ca9\u77f3', '\u8349\u53e2', '\u6f3f\u679c\u53e2', '\u71e7\u77f3', '\u591c\u5149\u8611\u83c7'];
  var BLOCKR = [9, 11, 0, 0, 0, 0];
  var ITEM   = ['wood', 'stone', 'fiber', 'berry', 'flint', 'mushroom'];
  var AMOUNT = [3, 3, 2, 2, 1, 1];
  var RESPAWN = [120000, 180000, 90000, 90000, 150000, 200000];

  var chunkNodes = {};
  var chunkKeys = [];
  var taken = {};
  var takenCount = 0;

  var _near = [];
  var _nearN = 0;
  var i0;
  for (i0 = 0; i0 < 64; i0++) _near.push(null);

  function buildNodes(cx, cy) {
    var K = W.CFG.CHUNK_SIZE, TS = W.CFG.TILE;
    var n = K / TS;
    var arr = [];
    var i, j, wx, wy, t, h, type, jx, jy, nx, ny;

    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) {
        wx = cx * K + i * TS;
        wy = cy * K + j * TS;
        t = W.World.tileAt(wx + TS / 2, wy + TS / 2);
        h = W.Rng.hash2i(wx, wy, W.CFG.SEED + 1234);
        type = -1;

        if (t === T.FOREST) {
          if (h < 0.26) type = TYPE.TREE;
          else if (h < 0.38) type = TYPE.BUSH;
          else if (h < 0.44) type = TYPE.BERRY;
        } else if (t === T.GRASS) {
          if (h < 0.05) type = TYPE.TREE;
          else if (h < 0.14) type = TYPE.BUSH;
          else if (h < 0.19) type = TYPE.BERRY;
        } else if (t === T.ROCK) {
          if (h < 0.26) type = TYPE.ROCK;
        } else if (t === T.SAND) {
          if (h < 0.05) type = TYPE.FLINT;
        }

        if (type < 0 && (t === T.FOREST || t === T.GRASS)) {
          if (W.Rng.hash2i(wx + 3517, wy + 911, W.CFG.SEED + 6001) < W.CFG.MUSH_CHANCE) type = TYPE.MUSH;
        }
        if (type < 0) continue;

        jx = W.Rng.hash2i(wx + 7,  wy + 3,  W.CFG.SEED + 55) * (TS - 14) + 7;
        jy = W.Rng.hash2i(wx + 11, wy + 19, W.CFG.SEED + 66) * (TS - 14) + 7;
        nx = wx + jx;
        ny = wy + jy;
        arr.push({
          wx: nx,
          wy: ny,
          type: type,
          k: Math.round(nx) + '|' + Math.round(ny)
        });
      }
    }
    return arr;
  }

  function nodesFor(cx, cy) {
    var k = cx + ',' + cy;
    var a = chunkNodes[k];
    if (a) return a;
    a = buildNodes(cx, cy);
    chunkNodes[k] = a;
    chunkKeys.push(k);
    if (chunkKeys.length > W.CFG.RES_CACHE_MAX) {
      delete chunkNodes[chunkKeys.shift()];
    }
    return a;
  }

  function isAlive(node, now) {
    if (node.type === TYPE.MUSH && !W.Time.isNight()) return false;
    var r = taken[node.k];
    if (r === undefined) return true;
    if (now >= r) { delete taken[node.k]; takenCount--; return true; }
    return false;
  }

  /* 每幀更新一次的鄰近節點清單。使用預先配置的陣列，迴圈內不新建物件。 */
  function updateNear(wx, wy, now) {
    var K = W.CFG.CHUNK_SIZE, R = W.CFG.NEAR_RANGE;
    var c0 = Math.floor((wx - R) / K), c1 = Math.floor((wx + R) / K);
    var r0 = Math.floor((wy - R) / K), r1 = Math.floor((wy + R) / K);
    var cx, cy, a, i, nd, dx, dy;

    _nearN = 0;
    for (cy = r0; cy <= r1; cy++) {
      for (cx = c0; cx <= c1; cx++) {
        a = nodesFor(cx, cy);
        for (i = 0; i < a.length; i++) {
          nd = a[i];
          dx = nd.wx - wx;
          dy = nd.wy - wy;
          if (dx * dx + dy * dy > R * R) continue;
          if (!isAlive(nd, now)) continue;
          if (_nearN >= _near.length) continue;
          _near[_nearN++] = nd;
        }
      }
    }
  }

  function blocksAt(wx, wy, pr) {
    var i, nd, br, dx, dy, s;
    var now = Date.now();
    for (i = 0; i < _nearN; i++) {
      nd = _near[i];
      br = BLOCKR[nd.type];
      if (br === 0) continue;
      if (!isAlive(nd, now)) continue;
      dx = nd.wx - wx;
      dy = nd.wy - wy;
      s = br + pr;
      if (dx * dx + dy * dy < s * s) return true;
    }
    return false;
  }

  /* 找出可採集目標：距離內、且偏向面朝方向者優先 */
  function findTarget(wx, wy, fx, fy) {
    var R = W.CFG.HARVEST_RANGE;
    var best = null, bestScore = -1e9;
    var i, nd, dx, dy, d2, d, dot, score;

    for (i = 0; i < _nearN; i++) {
      nd = _near[i];
      dx = nd.wx - wx;
      dy = nd.wy - wy;
      d2 = dx * dx + dy * dy;
      if (d2 > R * R) continue;
      d = Math.sqrt(d2);
      dot = (d > 0.001) ? (dx / d * fx + dy / d * fy) : 1;
      score = dot * 40 - d;
      if (score > bestScore) { bestScore = score; best = nd; }
    }
    return best;
  }

  function harvest(node, now) {
    if (!node) return null;
    if (!isAlive(node, now)) return null;
    if (taken[node.k] === undefined) takenCount++;
    taken[node.k] = now + RESPAWN[node.type];
    var n = AMOUNT[node.type] + W.Craft.yieldBonus(node.type);
    W.Inv.add(ITEM[node.type], n);
    return {
      name: NAMES[node.type],
      item: ITEM[node.type],
      n: n
    };
  }

  function nearCount() { return _nearN; }
  function nearAt(i) { return _near[i]; }

  /* 存檔用：只輸出「尚未長回」的節點，過期的直接丟棄以免存檔膨脹 */
  function exportTaken() {
    var now = Date.now();
    var o = {}, k, n = 0;
    for (k in taken) {
      if (!taken.hasOwnProperty(k)) continue;
      if (taken[k] <= now) continue;
      o[k] = taken[k];
      n++;
    }
    takenCount = n;
    return o;
  }

  function importTaken(o) {
    var now = Date.now(), k, v, n = 0;
    taken = {};
    if (!o) { takenCount = 0; return; }
    for (k in o) {
      if (!o.hasOwnProperty(k)) continue;
      v = o[k];
      if (typeof v !== 'number' || !isFinite(v)) continue;
      if (v <= now) continue;
      taken[k] = v;
      n++;
    }
    takenCount = n;
  }

  function clearTaken() {
    taken = {};
    takenCount = 0;
  }

  function stats() {
    return {
      chunks: chunkKeys.length,
      taken: takenCount,
      near: _nearN
    };
  }

  return {
    TYPE: TYPE,
    NAMES: NAMES,
    nodesFor: nodesFor,
    isAlive: isAlive,
    updateNear: updateNear,
    blocksAt: blocksAt,
    findTarget: findTarget,
    harvest: harvest,
    exportTaken: exportTaken,
    importTaken: importTaken,
    clearTaken: clearTaken,
    nameOf: function(t) { return NAMES[t] || ''; },
    nearCount: nearCount,
    nearAt: nearAt,
    stats: stats
  };
})();
