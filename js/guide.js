window.W = window.W || {};

/* 探索導航：預設鎖定最近的存活區域首領；指南針可依序切換五位首領與世界祭壇。
   只保存 UI 選擇，不寫入存檔；舊存檔可直接沿用。 */
W.Guide = (function() {
  var selectedId = '';
  var refreshT = 0;
  var target = {
    on: false, kind: '', id: '', label: '', hint: '',
    wx: 0, wy: 0, distance: 0, arrived: false
  };

  function distanceTo(wx, wy) {
    var dx = wx - W.Player.wx, dy = wy - W.Player.wy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function regionalById(id) {
    if (!W.Bosses) return null;
    var i, b;
    for (i = 0; i < W.Bosses.count(); i++) {
      b = W.Bosses.at(i);
      if (b && b.alive && b.def && b.def.kind === 'regional' && b.def.id === id) return b;
    }
    return null;
  }

  function nearestRegional() {
    if (!W.Bosses) return null;
    var i, b, dx, dy, d2, best = null, bestD2 = Infinity;
    for (i = 0; i < W.Bosses.count(); i++) {
      b = W.Bosses.at(i);
      if (!b || !b.alive || !b.def || b.def.kind !== 'regional') continue;
      dx = b.wx - W.Player.wx; dy = b.wy - W.Player.wy; d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = b; }
    }
    return best;
  }

  function setTarget(kind, id, label, hint, wx, wy) {
    target.on = true;
    target.kind = kind;
    target.id = id;
    target.label = label;
    target.hint = hint;
    target.wx = wx;
    target.wy = wy;
    target.distance = distanceTo(wx, wy);
    target.arrived = target.distance <= (kind === 'altar' ? 82 : 135);
  }

  function altarHint(d) {
    var stats = W.Calamity && W.Calamity.stats ? W.Calamity.stats() : null;
    var unlocked = !!(W.Calamity && W.Calamity.isUnlocked && W.Calamity.isUnlocked());
    var day = W.Time && W.Time.dayNo ? W.Time.dayNo() : 1;
    var owned = W.DivineArms && W.DivineArms.stats ? W.DivineArms.stats().owned : 0;
    if (!unlocked) {
      if (day < 20 && owned < 1) return '第20天＋任一神武後開啟（尚差 ' + (20 - day) + ' 天與一件神武）';
      if (day < 20) return '第20天開啟（尚差 ' + (20 - day) + ' 天）';
      return '取得任一件神武後開啟';
    }
    if (stats && stats.summoned) return '世界災禍戰鬥中';
    if (d <= 82) return '現在按右下角 ☄️ 召喚';
    return '走近祭壇後，按右下角 ☄️ 召喚';
  }

  function refresh() {
    var b, cb, altar, d;
    if (selectedId !== 'altar') {
      b = regionalById(selectedId);
      if (!b) {
        b = nearestRegional();
        selectedId = b ? b.def.id : 'altar';
      }
      if (b) {
        setTarget('boss', b.def.id, b.def.name, '點右上角 🧭 可切換首領／祭壇', b.wx, b.wy);
        return;
      }
    }

    cb = W.Calamity && W.Calamity.boss ? W.Calamity.boss() : null;
    if (cb && cb.alive) {
      setTarget('calamity', cb.id, cb.name, '世界災禍戰鬥中', cb.wx, cb.wy);
      return;
    }
    altar = W.Calamity && W.Calamity.altarPos ? W.Calamity.altarPos() : null;
    if (!altar) { target.on = false; return; }
    d = distanceTo(altar.wx, altar.wy);
    setTarget('altar', 'altar', '世界災禍祭壇', altarHint(d), altar.wx, altar.wy);
  }

  function init() {
    var b = nearestRegional();
    selectedId = b ? b.def.id : 'altar';
    refreshT = 0;
    refresh();
  }

  function update(dt) {
    refreshT -= dt;
    if (refreshT > 0) return;
    refreshT = 0.12;
    refresh();
  }

  function cycle() {
    var i, b, found = false, next = null;
    if (selectedId === 'altar') {
      next = nearestRegional();
      selectedId = next ? next.def.id : 'altar';
    } else if (W.Bosses) {
      for (i = 0; i < W.Bosses.count(); i++) {
        b = W.Bosses.at(i);
        if (!b || !b.alive || !b.def || b.def.kind !== 'regional') continue;
        if (found) { next = b; break; }
        if (b.def.id === selectedId) found = true;
      }
      selectedId = next ? next.def.id : 'altar';
    }
    refresh();
    return '導航：' + target.label + '｜' + target.hint;
  }

  function current() { return target; }

  function select(id) {
    if (id === 'altar') { selectedId = 'altar'; refresh(); return true; }
    var b = regionalById(id);
    if (!b) return false;
    selectedId = id; refresh(); return true;
  }

  return { init: init, update: update, cycle: cycle, current: current, select: select };
})();
