window.W = window.W || {};

/* 快速移動：營地永久可用；區域首領地點需親自探索或擊敗後解鎖；
   世界祭壇需親自探索或完成解鎖條件。戰鬥中禁止傳送。 */
W.Travel = (function() {
  var discovered = {};
  var scanT = 0, cooldown = 0;
  var points = [];
  var result = { ok: false, msg: '', point: null };

  function makePoint(id, name, icon, kind, order) {
    return { id:id, name:name, icon:icon, kind:kind, order:order || 0,
      wx:0, wy:0, unlocked:false, status:'', distance:0, boss:null };
  }

  function ensurePoints() {
    if (points.length) return;
    points.push(makePoint('home', '目前營地', '⛺', 'home', 0));
    if (W.Bosses) {
      var i, b, order = 0;
      for (i = 0; i < W.Bosses.count(); i++) {
        b = W.Bosses.at(i);
        if (!b || !b.def || b.def.kind !== 'regional') continue;
        points.push(makePoint('boss:' + b.def.id, b.def.name + '領地', '⚔️', 'boss', order++));
      }
    }
    points.push(makePoint('altar', '世界災禍祭壇', '☄️', 'altar', 0));
  }

  function updatePoint(p) {
    var dx, dy, defeated = false, altar;
    if (p.kind === 'home') {
      p.wx = W.Player.homeWx || W.CFG.START_WX;
      p.wy = W.Player.homeWy || W.CFG.START_WY;
      p.unlocked = true;
      p.status = '可隨時返回';
    } else if (p.kind === 'boss') {
      p.boss = regionalBoss(p.id.slice(5));
      if (p.boss && p.boss.site) {
        p.wx = p.boss.site.wx; p.wy = p.boss.site.wy;
      } else if (p.boss) {
        p.wx = p.boss.wx; p.wy = p.boss.wy;
      }
      defeated = !!(W.Bosses && W.Bosses.isDefeated && W.Bosses.isDefeated('region:' + p.id.slice(5)));
      p.unlocked = !!discovered[p.id] || defeated;
      p.status = defeated ? '已平定，可直接抵達' : (p.unlocked ? '已發現，抵達領地外圍' : '尚未探索');
    } else {
      altar = W.Calamity && W.Calamity.altarPos ? W.Calamity.altarPos() : null;
      if (altar) { p.wx = altar.wx; p.wy = altar.wy; }
      p.unlocked = !!discovered.altar || !!(W.Calamity && W.Calamity.isUnlocked && W.Calamity.isUnlocked());
      p.status = p.unlocked ? '已解鎖，可抵達祭壇旁' : '第20天＋任一神武後解鎖';
    }
    dx = p.wx - W.Player.wx; dy = p.wy - W.Player.wy;
    p.distance = Math.sqrt(dx * dx + dy * dy);
  }

  function regionalBoss(id) {
    if (!W.Bosses) return null;
    var i, b;
    for (i = 0; i < W.Bosses.count(); i++) {
      b = W.Bosses.at(i);
      if (b && b.def && b.def.kind === 'regional' && b.def.id === id) return b;
    }
    return null;
  }

  function list() {
    ensurePoints();
    var i;
    for (i = 0; i < points.length; i++) updatePoint(points[i]);
    return points;
  }

  function discover(id, point) {
    if (discovered[id]) return;
    discovered[id] = 1;
    if (W.Game && W.Game.onWaypointDiscovered) W.Game.onWaypointDiscovered(point);
  }

  function scan() {
    var ps = list(), i, p, dx, dy, r;
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      if (p.kind === 'home' || discovered[p.id]) continue;
      r = p.kind === 'altar' ? 260 : 480;
      dx = p.wx - W.Player.wx; dy = p.wy - W.Player.wy;
      if (dx * dx + dy * dy <= r * r) discover(p.id, p);
    }
  }

  function update(dt) {
    if (cooldown > 0) { cooldown -= dt; if (cooldown < 0) cooldown = 0; }
    scanT -= dt;
    if (scanT > 0) return;
    scanT = 0.45;
    scan();
  }

  function combatReason() {
    if (W.Stats && W.Stats.isDead && W.Stats.isDead()) return '死亡狀態無法快速移動';
    if (cooldown > 0) return '傳送能量尚未穩定（' + Math.ceil(cooldown) + ' 秒）';
    var b = W.Bosses && W.Bosses.nearest ? W.Bosses.nearest(W.Player.wx, W.Player.wy) : null;
    if (b && nearObject(b, 430)) return '首領戰鬥中，無法快速移動';
    b = W.Calamity && W.Calamity.boss ? W.Calamity.boss() : null;
    if (b && b.alive && nearObject(b, 620)) return '世界災禍戰鬥中，無法快速移動';
    if (W.Mobs && W.Mobs.TYPE) {
      var i, m, hostile;
      for (i = 0; i < W.Mobs.count(); i++) {
        m = W.Mobs.at(i); if (!m || !m.alive) continue;
        hostile = m.type === W.Mobs.TYPE.WOLF || m.type === W.Mobs.TYPE.SHADOW ||
          m.type === W.Mobs.TYPE.BEAR || (m.type === W.Mobs.TYPE.BOAR && m.hurt > 0);
        if (hostile && nearObject(m, 190)) return '附近仍有敵人，無法快速移動';
      }
    }
    return '';
  }

  function nearObject(o, range) {
    var dx = o.wx - W.Player.wx, dy = o.wy - W.Player.wy;
    return dx * dx + dy * dy <= range * range;
  }

  function pointById(id) {
    var ps = list(), i;
    for (i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
    return null;
  }

  function go(id) {
    result.ok = false; result.point = null;
    var p = pointById(id), reason = combatReason(), tx, ty, spawn, defeated;
    if (!p) { result.msg = '找不到這個傳送地點'; return result; }
    if (!p.unlocked) { result.msg = '這個地點尚未解鎖'; return result; }
    if (reason) { result.msg = reason; return result; }
    if (p.distance < 90) { result.msg = '你已經在 ' + p.name + ' 附近'; return result; }

    tx = p.wx; ty = p.wy;
    if (p.kind === 'altar') {
      tx += 112;
    } else if (p.kind === 'boss') {
      defeated = !!(W.Bosses && W.Bosses.isDefeated && W.Bosses.isDefeated('region:' + p.id.slice(5)));
      if (!defeated) {
        tx += Math.cos(p.order * 2.399 + 0.6) * 610;
        ty += Math.sin(p.order * 2.399 + 0.6) * 610;
      }
    }
    spawn = W.World && W.World.findSpawn ? W.World.findSpawn(tx, ty) : null;
    W.Player.wx = spawn ? spawn.wx : tx;
    W.Player.wy = spawn ? spawn.wy : ty;
    W.Player.spawn();
    if (W.Camera && W.Camera.snapTo) W.Camera.snapTo(W.Player.wx, W.Player.wy);
    if (W.Sites) W.Sites.updateNear(W.Player.wx, W.Player.wy);
    if (W.Build) W.Build.updateNear(W.Player.wx, W.Player.wy);
    if (W.Guide) W.Guide.init();
    if (W.Render && W.Render.flash) W.Render.flash('rgba(85,205,235,0.58)', 0.45);
    cooldown = 3;
    result.ok = true; result.point = p; result.msg = '已快速移動至「' + p.name + '」';
    return result;
  }

  function exportData() {
    var out = [], k;
    for (k in discovered) if (discovered.hasOwnProperty(k) && discovered[k]) out.push(k);
    return out;
  }

  function importData(arr) {
    discovered = {};
    if (!arr || !arr.length) return;
    var i, id;
    for (i = 0; i < arr.length; i++) {
      id = arr[i];
      if (id === 'altar' || /^boss:(hydra|dragon|colossus|eagle|lava)$/.test(id)) discovered[id] = 1;
    }
  }

  function clear() { discovered = {}; cooldown = 0; scanT = 0; }
  function stats() { var n = 1, k; for (k in discovered) if (discovered.hasOwnProperty(k) && discovered[k]) n++; return { unlocked:n, cooldown:cooldown }; }

  return { update:update, list:list, go:go, combatReason:combatReason,
    exportData:exportData, importData:importData, clear:clear, stats:stats };
})();
