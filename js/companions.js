window.W = window.W || {};

/* 夥伴系統。
   夥伴地點由遺跡座標決定（可重現，不需存檔）；只有「已招募」需要存檔。
   新增欄位時務必同步 save.js 的 collect / apply / migrate 三處。 */
W.Mates = (function() {

  /* 前 2 位強（洞穴魔王囚禁），後 2 位弱（廢墟遊蕩） */
  var DEFS = [
    { id: 'knight', name: '\u5c0f\u9a0e\u58eb', strong: true,  dmg: 8, rate: 1.1, range: 78,  art: 'mate_knight', color: '#7fa8e8' },
    { id: 'archer', name: '\u5c0f\u7375\u4eba', strong: true,  dmg: 6, rate: 0.9, range: 235, art: 'mate_archer', color: '#8ec87f' },
    { id: 'cat',    name: '\u5c0f\u8c93',       strong: false, dmg: 2, rate: 1.6, range: 82,  art: 'mate_cat',    color: '#e8c07f' },
    { id: 'sprite', name: '\u5c0f\u7cbe\u9748', strong: false, dmg: 1, rate: 2.0, range: 195, art: 'mate_sprite', color: '#c79fe8' }
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
      actionT: 0, actionMax: 0.34,
      hitWx: 0, hitWy: 0,
      vx: 0, vy: 0,
      animT: i0 * 0.73, bob: 0, lean: 0,
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
  var _target = { kind: '', obj: null, wx: 0, wy: 0, d2: 0 };

  function nearestTarget(m, range) {
    var best = range * range, kind = '', obj = null, wx = 0, wy = 0;
    var i, e, dx, dy, d2;
    for (i = 0; i < W.Mobs.count(); i++) {
      e = W.Mobs.at(i); if (!e || !e.alive) continue;
      dx = e.wx - m.wx; dy = e.wy - m.wy; d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; kind = 'mob'; obj = e; wx = e.wx; wy = e.wy; }
    }
    if (W.Bosses && W.Bosses.nearest) {
      e = W.Bosses.nearest(m.wx, m.wy);
      if (e && e.alive) { dx=e.wx-m.wx;dy=e.wy-m.wy;d2=dx*dx+dy*dy;
        if(d2<best){best=d2;kind='boss';obj=e;wx=e.wx;wy=e.wy;} }
    }
    if (W.Calamity && W.Calamity.nearest) {
      e = W.Calamity.nearest(m.wx, m.wy);
      if (e && e.alive !== false) { dx=e.wx-m.wx;dy=e.wy-m.wy;d2=dx*dx+dy*dy;
        if(d2<best){best=d2;kind='calamity';obj=e;wx=e.wx;wy=e.wy;} }
    }
    if (!obj) return null;
    _target.kind=kind;_target.obj=obj;_target.wx=wx;_target.wy=wy;_target.d2=best;
    return _target;
  }

  function hitTarget(m, t) {
    if (t.kind === 'mob') return W.Mobs.hitAt(t.wx, t.wy, 24, m.def.dmg);
    if (t.kind === 'boss' && W.Bosses) return W.Bosses.hitAt(t.wx, t.wy, 24, m.def.dmg);
    if (t.kind === 'calamity' && W.Calamity) return W.Calamity.hitAt(t.wx, t.wy, 24, m.def.dmg);
    return null;
  }

  function faceToward(m, x, y, dt, immediate) {
    var dx=x-m.wx,dy=y-m.wy,d=Math.sqrt(dx*dx+dy*dy),k,nx,ny,len;
    if(d<0.001)return;
    nx=dx/d;ny=dy/d;k=immediate?1:(1-Math.exp(-dt*10));
    m.faceX+=(nx-m.faceX)*k;m.faceY+=(ny-m.faceY)*k;
    len=Math.sqrt(m.faceX*m.faceX+m.faceY*m.faceY)||1;m.faceX/=len;m.faceY/=len;
  }

  function update(dt) {
    var i, m, dx, dy, d, spd, tx, ty, side, back, response, desired, speed, damp, target;
    for (i = 0; i < mates.length; i++) {
      m = mates[i];
      if(m.actionT>0)m.actionT=Math.max(0,m.actionT-dt);

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

      /* 跟隨陣形跟著玩家面向旋轉，避免轉彎後四位突然交叉換位。 */
      side = (i % 2 === 0 ? -1 : 1) * (28 + Math.floor(i / 2) * 8);
      back = 48 + Math.floor(i / 2) * 34;
      tx = W.Player.wx - W.Player.faceX * back - W.Player.faceY * side;
      ty = W.Player.wy - W.Player.faceY * back + W.Player.faceX * side;
      dx = tx - m.wx;
      dy = ty - m.wy;
      d = Math.sqrt(dx * dx + dy * dy);

      if (d > 700) { m.wx=tx;m.wy=ty;m.vx=0;m.vy=0;d=0; }

      /* arrive steering：以加速度靠近而非每幀瞬間改方向，停下時也會自然減速。 */
      spd=W.CFG.PLAYER_SPEED*(m.hungry?0.58:1.08);
      response=1-Math.exp(-dt*8);
      if(d>10){
        desired=Math.min(spd,Math.max(24,(d-8)*4.2));
        m.vx+=(dx/d*desired-m.vx)*response;
        m.vy+=(dy/d*desired-m.vy)*response;
      }else{
        damp=Math.exp(-dt*12);m.vx*=damp;m.vy*=damp;
      }
      speed=Math.sqrt(m.vx*m.vx+m.vy*m.vy);
      if(speed>spd){m.vx=m.vx/speed*spd;m.vy=m.vy/speed*spd;speed=spd;}
      m.wx+=m.vx*dt;m.wy+=m.vy*dt;
      m.moving=speed>8;
      if(m.moving)faceToward(m,m.wx+m.vx,m.wy+m.vy,dt,false);
      m.animT+=dt*(m.moving?8.5:(m.def.id==='sprite'?4.2:2.1));
      m.bob=m.def.id==='sprite'?(-5+Math.sin(m.animT)*2.6):(m.moving?-Math.abs(Math.sin(m.animT))*2.5:Math.sin(m.animT)*0.55);
      m.lean=m.moving?Math.max(-0.065,Math.min(0.065,m.vx/spd*0.065)):0;

      /* 協同攻擊：飢餓時不出手 */
      m.atkT -= dt;
      if (!m.hungry && m.atkT <= 0) {
        target=nearestTarget(m,m.def.range);
        _hit=null;
        if(target){faceToward(m,target.wx,target.wy,dt,true);_hit=hitTarget(m,target);}
        if (_hit) {
          m.atkT = m.def.rate;
          m.actionT=m.actionMax;
          m.hitWx=_hit.wx||target.wx;m.hitWy=_hit.wy||target.wy;
          if (W.Game && W.Game.onMateHit) W.Game.onMateHit(m, _hit);
        } else {
          m.atkT = 0.18;
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
      mates[i].vx=0;mates[i].vy=0;mates[i].actionT=0;
    }
    if (!o) return;
    for (i = 0; i < mates.length; i++) {
      if (o[mates[i].def.id]) {
        mates[i].recruited = true;
        mates[i].wx = W.Player.wx + 30 + i * 12;
        mates[i].wy = W.Player.wy + 30;
        mates[i].vx=0;mates[i].vy=0;mates[i].actionT=0;
      }
    }
  }

  function clear() {
    var i;
    for (i = 0; i < mates.length; i++) {
      mates[i].recruited = false;
      mates[i].hungry = false;
      mates[i].vx=0;mates[i].vy=0;mates[i].actionT=0;
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
