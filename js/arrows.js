window.W = window.W || {};

/* 箭矢：固定大小物件池，發射與更新都不新建物件。
   命中與掉落一律呼叫 W.Mobs.hitAt()，與近戰共用同一套結算邏輯。 */
W.Arrows = (function() {
  var MAX = 16;
  var pool = [];
  var i;
  for (i = 0; i < MAX; i++) {
    pool.push({ on: false, wx: 0, wy: 0, vx: 0, vy: 0, t: 0, tgt: null });
  }

  function fire(wx, wy, target) {
    var a = null, k;
    for (k = 0; k < MAX; k++) {
      if (!pool[k].on) { a = pool[k]; break; }
    }
    if (!a) return false;
    var dx = target.wx - wx;
    var dy = target.wy - wy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    a.on = true;
    a.wx = wx;
    a.wy = wy;
    a.vx = dx / len * W.CFG.ARROW_SPEED;
    a.vy = dy / len * W.CFG.ARROW_SPEED;
    a.t = 1.4;
    a.tgt = target;
    return true;
  }

  function update(dt) {
    var k, a, dx, dy, len, tx, ty, cur, hit;
    for (k = 0; k < MAX; k++) {
      a = pool[k];
      if (!a.on) continue;
      a.t -= dt;
      if (a.t <= 0) { a.on = false; a.tgt = null; continue; }

      if (a.tgt && a.tgt.alive) {
        dx = a.tgt.wx - a.wx;
        dy = a.tgt.wy - a.wy;
        len = Math.sqrt(dx * dx + dy * dy) || 1;
        tx = dx / len * W.CFG.ARROW_SPEED;
        ty = dy / len * W.CFG.ARROW_SPEED;
        cur = Math.min(1, W.CFG.ARROW_TURN * dt);
        a.vx += (tx - a.vx) * cur;
        a.vy += (ty - a.vy) * cur;
      }

      a.wx += a.vx * dt;
      a.wy += a.vy * dt;

      hit = W.Mobs.hitAt(a.wx, a.wy, 22, W.CFG.ARROW_DMG);
      if (!hit && W.Bosses) hit = W.Bosses.hitAt(a.wx, a.wy, 22, W.CFG.ARROW_DMG);
      if (!hit && W.Calamity && W.Calamity.hitAt) hit = W.Calamity.hitAt(a.wx, a.wy, 22, W.CFG.ARROW_DMG);
      if (hit) {
        a.on = false;
        a.tgt = null;
        if (W.Game && W.Game.onArrowHit) W.Game.onArrowHit(hit, a.wx, a.wy);
      }
    }
  }

  function each(fn) {
    var k;
    for (k = 0; k < MAX; k++) {
      if (pool[k].on) fn(pool[k]);
    }
  }

  function clearAll() {
    var k;
    for (k = 0; k < MAX; k++) { pool[k].on = false; pool[k].tgt = null; }
  }

  function activeCount() {
    var k, n = 0;
    for (k = 0; k < MAX; k++) if (pool[k].on) n++;
    return n;
  }

  return { fire: fire, update: update, each: each, clearAll: clearAll, activeCount: activeCount };
})();
