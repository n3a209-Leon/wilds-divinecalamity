window.W = window.W || {};

/* 生物：使用固定大小物件池，迴圈內不新建物件。
   生物是動態的，不隨座標可重現，因此「不寫入存檔」——離開後重新生成。 */
W.Mobs = (function() {
  var T = W.TERRAIN;

  var TYPE = { DEER: 0, RABBIT: 1, WOLF: 2, SHADOW: 3, BOAR: 4, BEAR: 5, CROW: 6 };
  var NAMES = ['\u9e7f', '\u5154\u5b50', '\u72fc', '\u9670\u5f71', '\u91ce\u8c6c', '\u718a', '\u70cf\u9d09'];
  var HP    = [26, 12, 34, 20, 46, 92, 8];
  var SPEED = [130, 175, 168, 150, 152, 138, 190];
  var RAD   = [12, 8, 12, 12, 13, 18, 7];

  var pool = [];
  var poolN = 0;
  var spawnT = 0;
  var seq = 1;
  var wanderSeq = 1;

  function ensurePool() {
    var i;
    if (pool.length > 0) return;
    for (i = 0; i < W.CFG.MOB_MAX; i++) {
      pool.push({
        alive: false, type: 0, wx: 0, wy: 0,
        vx: 0, vy: 0, hp: 0, t: 0, cd: 0, seed: 0, hurt: 0
      });
    }
  }

  function aliveCount() {
    var i, n = 0;
    for (i = 0; i < pool.length; i++) if (pool[i].alive) n++;
    return n;
  }

  function walkable(wx, wy) {
    return !W.World.isSolidAt(wx, wy);
  }

  function trySpawn() {
    ensurePool();
    if (aliveCount() >= W.CFG.MOB_MAX) return;

    var h1 = W.Rng.hash2i(seq, 17, W.CFG.SEED + 4001);
    var h2 = W.Rng.hash2i(seq, 91, W.CFG.SEED + 4002);
    var h3 = W.Rng.hash2i(seq, 55, W.CFG.SEED + 4003);
    seq++;

    var ang = h1 * Math.PI * 2;
    var dist = W.CFG.MOB_SPAWN_MIN + h2 * (W.CFG.MOB_SPAWN_MAX - W.CFG.MOB_SPAWN_MIN);
    var wx = W.Player.wx + Math.cos(ang) * dist;
    var wy = W.Player.wy + Math.sin(ang) * dist;

    if (wx < 40 || wy < 40 || wx > W.CFG.WORLD_SIZE - 40 || wy > W.CFG.WORLD_SIZE - 40) return;
    if (!walkable(wx, wy)) return;

    /* 理智過低會招來陰影：不掉東西、天亮或理智回復就消失。
       這是「夜裡待在黑暗」的懲罰，不是普通生態的一部分。 */
    if (W.Stats && W.Stats.isLowSan && W.Stats.isLowSan()) {
      var im = null, ii, shn = 0;
      for (ii = 0; ii < pool.length; ii++) {
        if (pool[ii].alive && pool[ii].type === TYPE.SHADOW) shn++;
      }
      /* 陰影有獨立上限，不然整個生物池會被塞滿 */
      if (shn >= W.CFG.SHADOW_MAX) return;
      for (ii = 0; ii < pool.length; ii++) if (!pool[ii].alive) { im = pool[ii]; break; }
      if (im) {
        im.alive = true; im.type = TYPE.SHADOW; im.wx = wx; im.wy = wy;
        im.vx = 0; im.vy = 0; im.hp = HP[TYPE.SHADOW];
        im.t = 0; im.cd = 0; im.hurt = 0; im.seed = seq;
      }
      return;
    }

    var terr = W.World.tileAt(wx, wy);
    var wolfCut = W.Time.isNight() ? W.CFG.NIGHT_WOLF_CHANCE : 0;
    var noWolf = (W.Time.dayNo() <= 1);
    var type;
    if (terr === T.FOREST)      type = (!noWolf && h3 < Math.max(0.05, wolfCut)) ? TYPE.WOLF : ((h3 < 0.30) ? TYPE.DEER : ((h3 < 0.50) ? TYPE.BOAR : ((h3 < 0.58) ? TYPE.CROW : ((h3 < 0.62 && !noWolf) ? TYPE.BEAR : TYPE.RABBIT))));
    else if (terr === T.GRASS)  type = (!noWolf && h3 < Math.max(0.02, wolfCut * 0.6)) ? TYPE.WOLF : ((h3 < 0.34) ? TYPE.DEER : ((h3 < 0.48) ? TYPE.BOAR : ((h3 < 0.60) ? TYPE.CROW : TYPE.RABBIT)));
    else if (terr === T.ROCK)   type = (!noWolf && h3 < (W.Time.isNight() ? 0.20 : 0.06)) ? TYPE.WOLF : ((h3 < 0.30) ? TYPE.CROW : ((h3 < 0.36 && !noWolf) ? TYPE.BEAR : TYPE.RABBIT));
    else return;

    var i, m = null;
    for (i = 0; i < pool.length; i++) if (!pool[i].alive) { m = pool[i]; break; }
    if (!m) return;

    m.alive = true;
    m.type = type;
    m.wx = wx;
    m.wy = wy;
    m.vx = 0;
    m.vy = 0;
    m.hp = HP[type];
    m.t = 0;
    m.cd = 0;
    m.hurt = 0;
    m.seed = seq;
  }

  function newDir(m) {
    var h = W.Rng.hash2i(m.seed, wanderSeq++, W.CFG.SEED + 909);
    var g = W.Rng.hash2i(m.seed, wanderSeq++, W.CFG.SEED + 910);
    var ang = h * Math.PI * 2;
    if (g < 0.35) { m.vx = 0; m.vy = 0; }
    else { m.vx = Math.cos(ang); m.vy = Math.sin(ang); }
    m.t = 1.0 + g * 2.4;
  }

  function moveMob(m, dt, spd) {
    var nx = m.wx + m.vx * spd * dt;
    var ny = m.wy + m.vy * spd * dt;
    if (walkable(nx, m.wy)) m.wx = nx; else m.vx = -m.vx;
    if (walkable(m.wx, ny)) m.wy = ny; else m.vy = -m.vy;
  }

  function update(dt) {
    ensurePool();

    spawnT += dt;
    if (spawnT >= W.CFG.MOB_SPAWN_INTERVAL * (W.Time.isNight() ? W.CFG.NIGHT_SPAWN_MUL : 1)) {
      spawnT = 0;
      trySpawn();
    }

    var px = W.Player.wx, py = W.Player.wy;
    var i, m, dx, dy, d2, d, spd, inv, fire, fdx, fdy, fd;

    for (i = 0; i < pool.length; i++) {
      m = pool[i];
      if (!m.alive) continue;

      dx = px - m.wx;
      dy = py - m.wy;
      d2 = dx * dx + dy * dy;

      if (d2 > W.CFG.MOB_DESPAWN * W.CFG.MOB_DESPAWN) { m.alive = false; continue; }

      d = Math.sqrt(d2);
      if (m.cd > 0) m.cd -= dt;
      if (m.hurt > 0) m.hurt -= dt;

      spd = SPEED[m.type];
      if(W.Skins&&W.Skins.enemySpeedMultiplier)spd*=W.Skins.enemySpeedMultiplier(m.wx,m.wy);

      if (m.type === TYPE.SHADOW) {
        if (!W.Stats.isLowSan() || !W.Time.isNight()) { m.alive = false; continue; }
        if (d < 520 && !W.Stats.isDead()) {
          inv = (d > 0.001) ? 1 / d : 0;
          m.vx = dx * inv;
          m.vy = dy * inv;
          if (d < W.CFG.WOLF_HIT_RANGE) {
            if (m.cd <= 0) {
              m.cd = W.CFG.WOLF_HIT_CD;
              if (W.Stats.damage(W.CFG.WOLF_DMG) && W.Game && W.Game.onHurt) W.Game.onHurt();
            }
            m.vx = 0; m.vy = 0;
          }
        }
        moveMob(m, dt, spd);
        continue;
      }

      if (m.type === TYPE.BEAR || (m.type === TYPE.BOAR && m.hurt > 0)) {
        /* 熊主動攻擊但視野短；野豬平常無害，被打了才追過來 */
        var aggro = (m.type === TYPE.BEAR) ? W.CFG.BEAR_AGGRO : W.CFG.WOLF_AGGRO;
        if (d < aggro && !W.Stats.isDead()) {
          inv = (d > 0.001) ? 1 / d : 0;
          m.vx = dx * inv;
          m.vy = dy * inv;
          if (d < W.CFG.WOLF_HIT_RANGE + 6) {
            if (m.cd <= 0) {
              m.cd = W.CFG.WOLF_HIT_CD;
              if (W.Stats.damage((m.type === TYPE.BEAR) ? W.CFG.BEAR_DMG : W.CFG.BOAR_DMG) && W.Game && W.Game.onHurt) W.Game.onHurt();
            }
            m.vx = 0; m.vy = 0;
          }
        } else {
          m.t -= dt;
          if (m.t <= 0) newDir(m);
          spd *= 0.4;
        }
        moveMob(m, dt, spd);
        continue;
      }

      if (m.type === TYPE.WOLF) {
        var fire = W.Build.nearType(m.wx, m.wy, W.Build.TYPE.FIRE, W.CFG.FIRE_FEAR);
        if (fire) {
          /* 怕火：往反方向退開 */
          fdx = m.wx - fire.wx;
          fdy = m.wy - fire.wy;
          fd = Math.sqrt(fdx * fdx + fdy * fdy);
          if (fd > 0.001) { m.vx = fdx / fd; m.vy = fdy / fd; }
          moveMob(m, dt, spd);
          continue;
        }
        if (d < W.CFG.WOLF_AGGRO * (W.Time.isNight() ? W.CFG.NIGHT_AGGRO_MUL : 1) && !W.Stats.isDead()) {
          inv = (d > 0.001) ? 1 / d : 0;
          m.vx = dx * inv;
          m.vy = dy * inv;
          if (d < W.CFG.WOLF_HIT_RANGE) {
            if (m.cd <= 0) {
              m.cd = W.CFG.WOLF_HIT_CD;
              if (W.Stats.damage(W.CFG.WOLF_DMG) && W.Game && W.Game.onHurt) W.Game.onHurt();
            }
            m.vx = 0;
            m.vy = 0;
          }
        } else {
          m.t -= dt;
          if (m.t <= 0) newDir(m);
          spd *= 0.45;
        }
      } else {
        if (d < ((m.type === TYPE.CROW) ? W.CFG.CROW_FLEE : W.CFG.FLEE_RANGE) || m.hurt > 0) {
          inv = (d > 0.001) ? 1 / d : 0;
          m.vx = -dx * inv;
          m.vy = -dy * inv;
        } else {
          m.t -= dt;
          if (m.t <= 0) newDir(m);
          spd *= 0.4;
        }
      }

      moveMob(m, dt, spd);
    }
  }

  /* 玩家攻擊：回傳結果物件或 null（結果物件為單一共用實例，避免每次配置） */
  var _hit = { name: '', killed: false, dmg: 0, type: 0 };

  function attack(wx, wy, fx, fy, dmg) {
    var R = W.CFG.ATTACK_RANGE;
    var best = null, bestScore = -1e9;
    var i, m, dx, dy, d2, d, dot, score;

    for (i = 0; i < pool.length; i++) {
      m = pool[i];
      if (!m.alive) continue;
      dx = m.wx - wx;
      dy = m.wy - wy;
      d2 = dx * dx + dy * dy;
      if (d2 > R * R) continue;
      d = Math.sqrt(d2);
      dot = (d > 0.001) ? (dx / d * fx + dy / d * fy) : 1;
      if (dot < 0.1) continue;
      score = dot * 40 - d;
      if (score > bestScore) { bestScore = score; best = m; }
    }

    if (!best) return null;
    return applyHit(best, dmg);
  }

  /* 近戰與箭矢共用的結算：扣血、受擊標記、擊殺掉落。
     只有這一份，不准另外複製一套。 */
  function applyHit(m, dmg) {
    m.hp -= dmg;
    m.hurt = 3.0;
    _hit.name = NAMES[m.type];
    _hit.type = m.type;
    _hit.dmg = dmg;
    _hit.killed = false;

    if (m.hp <= 0) {
      m.alive = false;
      _hit.killed = true;
      if (m.type === TYPE.SHADOW) {
        /* 陰影不留下任何東西 */
      } else if (m.type === TYPE.RABBIT) {
        W.Inv.add('meat', 1);
        W.Inv.add('hide', 1);
      } else if (m.type === TYPE.CROW) {
        /* 烏鴉沒有可用的部位 */
      } else if (m.type === TYPE.BOAR) {
        W.Inv.add('meat', 3);
        W.Inv.add('hide', 2);
      } else if (m.type === TYPE.BEAR) {
        W.Inv.add('meat', 5);
        W.Inv.add('hide', 4);
      } else {
        W.Inv.add('meat', 2);
        W.Inv.add('hide', 2);
      }
    }
    return _hit;
  }

  /* 圓形範圍命中最近一隻（箭矢用） */
  function hitAt(wx, wy, r, dmg) {
    var best = null, bd = r * r, k, m, dx, dy, d2;
    for (k = 0; k < pool.length; k++) {
      m = pool[k];
      if (!m.alive) continue;
      dx = m.wx - wx;
      dy = m.wy - wy;
      d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = m; }
    }
    if (!best) return null;
    return applyHit(best, dmg);
  }

  function count() { return pool.length; }
  function at(i) { return pool[i]; }
  function radius(type) { return RAD[type]; }
  function nameOf(type) { return NAMES[type]; }

  function clearAll() {
    var i;
    for (i = 0; i < pool.length; i++) pool[i].alive = false;
  }

  function stats() {
    var i, n = 0, w = 0, sh = 0;
    for (i = 0; i < pool.length; i++) {
      if (!pool[i].alive) continue;
      n++;
      if (pool[i].type === TYPE.WOLF) w++;
      if (pool[i].type === TYPE.SHADOW) sh++;
    }
    return { alive: n, wolves: w, shadows: sh, cap: W.CFG.MOB_MAX };
  }

  return {
    TYPE: TYPE,
    update: update,
    attack: attack,
    hitAt: hitAt,
    count: count,
    at: at,
    radius: radius,
    nameOf: nameOf,
    clearAll: clearAll,
    stats: stats
  };
})();
