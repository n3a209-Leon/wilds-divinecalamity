window.W = window.W || {};

/* 夥伴系統。
   夥伴地點由遺跡座標決定（可重現，不需存檔）；只有「已招募」需要存檔。
   新增欄位時務必同步 save.js 的 collect / apply / migrate 三處。 */
W.Mates = (function() {

  /* 前 2 位強（洞穴魔王囚禁），後 2 位弱（廢墟遊蕩） */
  var DEFS = [
    { id: 'knight', name: '\u5c0f\u9a0e\u58eb', strong: true,  dmg: 8, rate: 1.1, art: 'mate_knight', color: '#7fa8e8' },
    { id: 'archer', name: '\u5c0f\u7375\u4eba', strong: true,  dmg: 6, rate: 0.9, art: 'mate_archer', color: '#8ec87f' },
    { id: 'cat',    name: '\u5c0f\u8c93',       strong: false, dmg: 2, rate: 1.6, art: 'mate_cat',    color: '#e8c07f' },
    { id: 'sprite', name: '\u5c0f\u7cbe\u9748', strong: false, dmg: 1, rate: 2.0, art: 'mate_sprite', color: '#c79fe8' }
  ];

  var EAT_EVERY = 75;
  var FOODS = ['cooked', 'jerky', 'meat', 'berry'];

  var mates = [];
  var i0;
  for (i0 = 0; i0 < DEFS.length; i0++) {
    mates.push({
      def: DEFS[i0],
      recruited: false,
      wx: 0, wy: 0,
      faceX: 1, faceY: 0,
      moving: false,
      hungry: false,
      eatT: EAT_EVERY * (0.5 + i0 * 0.2),
      atkT: 0,
      homeSite: null
    });
  }

  /* 由出生點向外一圈圈掃描，強夥伴綁洞穴、弱夥伴綁廢墟 */
  function assignHomes() {
    var R = W.CFG.SITE_REGION;
    var cx = Math.floor(W.CFG.START_WX / R);
    var cy = Math.floor(W.CFG.START_WY / R);
    var caves = [], ruins = [];
    var rad, rx, ry, s;
    for (rad = 1; rad <= 14 && (caves.length < 2 || ruins.length < 2); rad++) {
      for (rx = cx - rad; rx <= cx + rad; rx++) {
        for (ry = cy - rad; ry <= cy + rad; ry++) {
          if (Math.max(Math.abs(rx - cx), Math.abs(ry - cy)) !== rad) continue;
          s = W.Sites.siteFor(rx, ry);
          if (!s) continue;
          if (s.type === W.Sites.TYPE.CAVE && caves.length < 2) caves.push(s);
          if (s.type === W.Sites.TYPE.RUIN && ruins.length < 2) ruins.push(s);
        }
      }
    }
    if (caves[0]) setHome(0, caves[0]);
    if (caves[1]) setHome(1, caves[1]);
    if (ruins[0]) setHome(2, ruins[0]);
    if (ruins[1]) setHome(3, ruins[1]);
  }

  function setHome(i, s) {
    var m = mates[i];
    m.homeSite = s;
    m.wx = s.wx + 40;
    m.wy = s.wy + 30;
  }

  function tryRecruit(i) {
    var m = mates[i];
    if (m.recruited || !m.homeSite) return false;
    if (m.def.strong && (!W.Bosses || !W.Bosses.isDefeated(m.homeSite.k))) return false;
    m.recruited = true;
    m.wx = W.Player.wx + 30;
    m.wy = W.Player.wy + 30;
    return true;
  }

  var _hit = null;

  function update(dt) {
    var i, m, dx, dy, d, spd, tx, ty;
    for (i = 0; i < mates.length; i++) {
      m = mates[i];

      if (!m.recruited) {
        if (m.homeSite) {
          dx = W.Player.wx - m.wx;
          dy = W.Player.wy - m.wy;
          if (dx * dx + dy * dy < 80 * 80) {
            if (tryRecruit(i) && W.Game && W.Game.onMateJoin) W.Game.onMateJoin(m.def);
          }
        }
        continue;
      }

      /* 進食：吃不到東西就進入飢餓，之後每幀重試直到有食物 */
      m.eatT -= dt;
      if (m.eatT <= 0) {
        m.eatT = EAT_EVERY;
        m.hungry = !eatOne();
      } else if (m.hungry) {
        m.hungry = !eatOne();
        if (!m.hungry) m.eatT = EAT_EVERY;
      }

      /* 跟隨：目標點在玩家斜後方，四位各自錯開避免疊在一起 */
      tx = W.Player.wx - W.Player.faceX * 46 + ((i % 2 === 0) ? -26 : 26);
      ty = W.Player.wy - W.Player.faceY * 46 + ((i < 2) ? -18 : 18);
      dx = tx - m.wx;
      dy = ty - m.wy;
      d = Math.sqrt(dx * dx + dy * dy);

      if (d > 700) { m.wx = tx; m.wy = ty; d = 0; }

      m.moving = d > 14;
      if (m.moving) {
        spd = W.CFG.PLAYER_SPEED * (m.hungry ? 0.55 : 1.05);
        m.wx += dx / d * Math.min(spd * dt, d);
        m.wy += dy / d * Math.min(spd * dt, d);
        m.faceX = dx / d;
        m.faceY = dy / d;
      }

      /* 協同攻擊：飢餓時不出手 */
      m.atkT -= dt;
      if (!m.hungry && m.atkT <= 0) {
        _hit = W.Mobs.hitAt(m.wx + m.faceX * 40, m.wy + m.faceY * 40, 46, m.def.dmg);
        if (!_hit && W.Bosses) {
          _hit = W.Bosses.hitAt(m.wx + m.faceX * 40, m.wy + m.faceY * 40, 46, m.def.dmg);
        }
        if (_hit) {
          m.atkT = m.def.rate;
          if (W.Game && W.Game.onMateHit) W.Game.onMateHit(m, _hit);
        } else {
          m.atkT = 0.3;
        }
      }
    }
  }

  function eatOne() {
    var k;
    for (k = 0; k < FOODS.length; k++) {
      if (W.Inv.count(FOODS[k]) > 0) {
        W.Inv.take(FOODS[k], 1);
        return true;
      }
    }
    return false;
  }

  function count() { return mates.length; }
  function at(i) { return mates[i]; }

  function recruitedCount() {
    var i, n = 0;
    for (i = 0; i < mates.length; i++) {
      if (mates[i].recruited) n++;
    }
    return n;
  }

  function hungryCount() {
    var i, n = 0;
    for (i = 0; i < mates.length; i++) {
      if (mates[i].recruited && mates[i].hungry) n++;
    }
    return n;
  }

  function exportData() {
    var o = {}, i;
    for (i = 0; i < mates.length; i++) {
      if (mates[i].recruited) o[mates[i].def.id] = 1;
    }
    return o;
  }

  function importData(o) {
    var i;
    for (i = 0; i < mates.length; i++) {
      mates[i].recruited = false;
      mates[i].hungry = false;
    }
    if (!o) return;
    for (i = 0; i < mates.length; i++) {
      if (o[mates[i].def.id]) {
        mates[i].recruited = true;
        mates[i].wx = W.Player.wx + 30 + i * 12;
        mates[i].wy = W.Player.wy + 30;
      }
    }
  }

  function clear() {
    var i;
    for (i = 0; i < mates.length; i++) {
      mates[i].recruited = false;
      mates[i].hungry = false;
    }
    assignHomes();
  }

  function stats() {
    return { total: mates.length, recruited: recruitedCount(), hungry: hungryCount() };
  }

  return {
    init: assignHomes,
    update: update,
    count: count,
    at: at,
    recruitedCount: recruitedCount,
    exportData: exportData,
    importData: importData,
    clear: clear,
    stats: stats
  };
})();
