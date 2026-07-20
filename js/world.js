window.W = window.W || {};

/* 地形代碼（數字，避免每幀字串比較）
   0 深水  1 淺水  2 沙地  3 草地  4 森林  5 石地  6 岩壁 */
W.TERRAIN = {
  DEEP:   0,
  WATER:  1,
  SAND:   2,
  GRASS:  3,
  FOREST: 4,
  ROCK:   5,
  CLIFF:  6
};

W.World = (function() {
  var T = W.TERRAIN;

  var SOLID = [true, true, false, false, false, false, true];

  var BASE = ['#1d3a52', '#2f6b86', '#cbb887', '#4d7a3a', '#2f5a2a', '#77776e', '#4a4a45'];
  var SPEC = ['#24455f', '#3a7d99', '#d8c79b', '#588a42', '#376634', '#8b8b81', '#585851'];

  var cache = {};
  var cacheKeys = [];
  var pending = [];
  var builtCount = 0;
  var lastFrame = 0;

  function tileAt(wx, wy) {
    var S = W.CFG.TERRAIN_SCALE;
    var h = W.Rng.fbm(wx * S, wy * S, W.CFG.SEED, 4);
    var m = W.Rng.fbm(wx * S * 2.1 + 913.7, wy * S * 2.1 + 417.3, W.CFG.SEED + 7777, 3);

    if (h < 0.30) return T.DEEP;
    if (h < 0.375) return T.WATER;
    if (h < 0.425) return T.SAND;
    if (h < 0.72) return (m > 0.56) ? T.FOREST : T.GRASS;
    if (h < 0.845) return T.ROCK;
    return T.CLIFF;
  }

  function isSolidAt(wx, wy) {
    return SOLID[tileAt(wx, wy)];
  }

  function isSolidTile(t) {
    return SOLID[t];
  }

  function key(cx, cy) {
    return cx + ',' + cy;
  }

  function buildChunk(cx, cy) {
    var K = W.CFG.CHUNK_SIZE, TS = W.CFG.TILE;
    var n = K / TS;
    var cv = document.createElement('canvas');
    cv.width = K;
    cv.height = K;
    var c = cv.getContext('2d');
    var i, j, wx, wy, t, dots, d, hx, hy;

    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) {
        wx = cx * K + i * TS;
        wy = cy * K + j * TS;
        t = tileAt(wx + TS / 2, wy + TS / 2);
        c.fillStyle = BASE[t];
        c.fillRect(i * TS, j * TS, TS, TS);

        c.fillStyle = SPEC[t];
        dots = (t === T.FOREST) ? 5 : 3;
        for (d = 0; d < dots; d++) {
          hx = W.Rng.hash2i(wx + d * 31, wy + d * 57, W.CFG.SEED + 31) * TS;
          hy = W.Rng.hash2i(wx + d * 91, wy + d * 13, W.CFG.SEED + 62) * TS;
          c.fillRect(i * TS + hx, j * TS + hy, (t === T.FOREST) ? 4 : 3, (t === T.FOREST) ? 5 : 3);
        }
      }
    }

    builtCount++;
    return cv;
  }

  function get(cx, cy) {
    var k = key(cx, cy);
    var e = cache[k];
    if (e) { e.used = lastFrame; return e.cv; }
    return null;
  }

  function request(cx, cy) {
    var k = key(cx, cy);
    if (cache[k]) return;
    var i;
    for (i = 0; i < pending.length; i++) {
      if (pending[i].cx === cx && pending[i].cy === cy) return;
    }
    pending.push({ cx: cx, cy: cy });
  }

  function evictIfNeeded() {
    if (cacheKeys.length <= W.CFG.CHUNK_CACHE_MAX) return;
    var oldestK = null, oldestUsed = Infinity, idx = -1, i, e;
    for (i = 0; i < cacheKeys.length; i++) {
      e = cache[cacheKeys[i]];
      if (e && e.used < oldestUsed) { oldestUsed = e.used; oldestK = cacheKeys[i]; idx = i; }
    }
    if (oldestK !== null) {
      cache[oldestK].cv.width = 1;
      cache[oldestK].cv.height = 1;
      delete cache[oldestK];
      cacheKeys.splice(idx, 1);
    }
  }

  function tick(frame) {
    lastFrame = frame;
    var made = 0, job, k;
    while (pending.length > 0 && made < W.CFG.CHUNK_BUDGET) {
      job = pending.shift();
      k = key(job.cx, job.cy);
      if (!cache[k]) {
        cache[k] = { cv: buildChunk(job.cx, job.cy), used: frame };
        cacheKeys.push(k);
        made++;
      }
    }
    evictIfNeeded();
  }

  /* 出生點搜尋：由中心向外一圈一圈找可站立的位置（確定性，不用亂數） */
  function findSpawn(wx, wy, ok) {
    var TS = W.CFG.TILE, ring, i, tx, ty;
    if (!ok) ok = function(x, y) { return !isSolidAt(x, y); };
    if (ok(wx, wy)) return setSpawn(wx, wy);
    for (ring = 1; ring < 260; ring++) {
      for (i = -ring; i <= ring; i++) {
        tx = wx + i * TS;
        ty = wy - ring * TS;
        if (ok(tx, ty)) return setSpawn(tx, ty);
        ty = wy + ring * TS;
        if (ok(tx, ty)) return setSpawn(tx, ty);
      }
      for (i = -ring + 1; i < ring; i++) {
        tx = wx - ring * TS;
        ty = wy + i * TS;
        if (ok(tx, ty)) return setSpawn(tx, ty);
        tx = wx + ring * TS;
        if (ok(tx, ty)) return setSpawn(tx, ty);
      }
    }
    return null;
  }

  var _spawn = { wx: 0, wy: 0 };

  function setSpawn(wx, wy) {
    _spawn.wx = wx;
    _spawn.wy = wy;
    return _spawn;
  }

  function stats() {
    return {
      cached: cacheKeys.length,
      pending: pending.length,
      built: builtCount
    };
  }

  return {
    tileAt: tileAt,
    isSolidAt: isSolidAt,
    isSolidTile: isSolidTile,
    get: get,
    request: request,
    tick: tick,
    findSpawn: findSpawn,
    COLORS: BASE,
    stats: stats,
    NAMES: ['深水', '淺水', '沙地', '草地', '森林', '石地', '岩壁']
  };
})();
