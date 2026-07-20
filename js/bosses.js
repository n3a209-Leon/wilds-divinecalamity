window.W = window.W || {};

/* 地方魔王＋五位區域首領。
   洞穴守衛沿用原本夥伴流程；區域首領使用固定出生點與獨立技能。 */
W.Bosses = (function() {
  var DEFS = [
    { id: 'troll', name: '洞穴巨魔', art: 'boss_troll', color: '#7a8f5a', hp: 140, dmg: 14, kind: 'guard', reward: 'gun' },
    { id: 'shade', name: '暗影魔', art: 'boss_shade', color: '#6a4f8f', hp: 110, dmg: 10, kind: 'guard', reward: 'sword' },
    { id: 'hydra', name: '終焉九頭蛇', art: 'boss_hydra', color: '#46563c', hp: 520, dmg: 18, radius: 54, kind: 'regional', reward: 'shield' },
    { id: 'dragon', name: '冰霜聖龍', art: 'boss_dragon', color: '#8fc9df', hp: 610, dmg: 20, radius: 56, kind: 'regional', reward: 'gun' },
    { id: 'colossus', name: '腐敗巨像', art: 'boss_colossus', color: '#7d7650', hp: 720, dmg: 25, radius: 60, kind: 'regional', reward: 'axe' },
    { id: 'eagle', name: '雷霆天鷹', art: 'boss_eagle', color: '#d6b65f', hp: 560, dmg: 17, radius: 52, kind: 'regional', reward: 'wing' },
    { id: 'lava', name: '熔岩魔神', art: 'boss_lava', color: '#d95828', hp: 900, dmg: 28, radius: 62, kind: 'regional', reward: 'sword' }
  ];

  var TERRITORY = 300;
  var ATK_RANGE = 56;
  var ATK_CD = 1.6;
  var SPEED = 150;
  var REGION_HOMES = [
    { k: 'region:hydra', wx: W.CFG.START_WX + 920, wy: W.CFG.START_WY - 180 },
    { k: 'region:dragon', wx: W.CFG.START_WX - 1080, wy: W.CFG.START_WY - 760 },
    { k: 'region:colossus', wx: W.CFG.START_WX + 360, wy: W.CFG.START_WY + 1180 },
    { k: 'region:eagle', wx: W.CFG.START_WX - 1120, wy: W.CFG.START_WY + 760 },
    { k: 'region:lava', wx: W.CFG.START_WX + 1550, wy: W.CFG.START_WY + 1250 }
  ];

  var bosses = [];
  var defeated = {};
  var projectiles = [];
  var pools = [];
  var pillars = [];
  var safeZone = { on: false, wx: 0, wy: 0, r: 58, t: 0 };
  var lavaSeq = 0;
  var i0;
  for (i0 = 0; i0 < DEFS.length; i0++) {
    bosses.push({
      def: DEFS[i0], site: null, wx: 0, wy: 0, hp: DEFS[i0].hp,
      alive: false, hurt: 0, atkT: 0, skillT: 0, phase: 1, atkFx: 0,
      rewardUnlocked: false,
      faceX: 1, faceY: 0
    });
  }
  for (i0 = 0; i0 < 64; i0++) projectiles.push({ on: false, wx: 0, wy: 0, vx: 0, vy: 0, t: 0, dmg: 0, kind: 'poison' });
  for (i0 = 0; i0 < 24; i0++) pools.push({ on: false, wx: 0, wy: 0, t: 0, tick: 0, tickEvery: 0.7, r: 46, dmg: 5, kind: 'poison' });
  for (i0 = 0; i0 < 20; i0++) pillars.push({ on: false, wx: 0, wy: 0, delay: 0, t: 0, r: 40, dmg: 0, hit: false });

  function bind() {
    var i, m, b;
    for (i = 0; i < 2; i++) {
      m = W.Mates && W.Mates.at ? W.Mates.at(i) : null;
      b = bosses[i];
      b.site = m ? m.homeSite : null;
      resetBoss(b, b.site, b.site && !defeated[b.site.k]);
    }
    for (i = 2; i < bosses.length; i++) {
      b = bosses[i];
      b.site = resolveHome(REGION_HOMES[i - 2]);
      resetBoss(b, b.site, !defeated[b.site.k]);
    }
    clearHazards();
  }

  /* 固定座標若落在水域／岩壁，確定性地移到最近可站立地形；每隻都複製座標，
     不保留 World.findSpawn() 內部共用物件的參照。 */
  function resolveHome(home) {
    var s = W.World && W.World.findSpawn ? W.World.findSpawn(home.wx, home.wy) : null;
    return { k: home.k, wx: s ? s.wx : home.wx, wy: s ? s.wy : home.wy };
  }

  function resetBoss(b, site, alive) {
    if (site) { b.wx = site.wx - (b.def.kind === 'guard' ? 50 : 0); b.wy = site.wy - (b.def.kind === 'guard' ? 20 : 0); }
    b.hp = b.def.hp;
    b.alive = !!alive;
    b.hurt = 0;
    b.atkT = 0;
    b.atkFx = 0;
    b.skillT = b.def.kind === 'regional' ? 2.2 : 0;
    b.phase = 1;
    b.rewardUnlocked = false;
  }

  function update(dt) {
    updateHazards(dt);
    var i, b;
    for (i = 0; i < bosses.length; i++) {
      b = bosses[i];
      if (!b.alive || !b.site) continue;
      if (b.hurt > 0) b.hurt -= dt;
      if (b.atkFx > 0) b.atkFx -= dt;
      b.atkT -= dt;
      b.skillT -= dt;
      if (b.def.kind === 'regional') updateRegional(b, dt);
      else updateGuard(b, dt);
    }
  }

  function updateRegional(b, dt) {
    if (b.def.id === 'lava') updateLava(b, dt);
    else if (b.def.id === 'dragon') updateDragon(b, dt);
    else if (b.def.id === 'colossus') updateColossus(b, dt);
    else if (b.def.id === 'eagle') updateEagle(b, dt);
    else updateHydra(b, dt);
  }

  function updateGuard(b, dt) {
    var dx = W.Player.wx - b.wx, dy = W.Player.wy - b.wy;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var sx = b.site.wx - b.wx, sy = b.site.wy - b.wy;
    var sd = Math.sqrt(sx * sx + sy * sy) || 0.001;
    if (d < TERRITORY && sd < TERRITORY * 1.4 && !W.Stats.isDead()) {
      if (d > ATK_RANGE) moveToward(b, dx, dy, d, SPEED, dt);
      else if (b.atkT <= 0) { b.atkT = ATK_CD; b.atkFx = 0.45; damagePlayer(b.def.dmg, 'boss'); }
    } else if (sd > 8) moveToward(b, sx, sy, sd, SPEED * 0.8, dt);
  }

  function updateHydra(b, dt) {
    var dx = W.Player.wx - b.wx, dy = W.Player.wy - b.wy;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var hx = b.site.wx - b.wx, hy = b.site.wy - b.wy;
    var hd = Math.sqrt(hx * hx + hy * hy) || 0.001;
    b.phase = b.hp <= b.def.hp * 0.25 ? 3 : (b.hp <= b.def.hp * 0.6 ? 2 : 1);

    if (d > 520 || hd > 620) {
      if (hd > 8) moveToward(b, hx, hy, hd, SPEED * 0.75, dt);
      return;
    }
    b.faceX = dx / d; b.faceY = dy / d;
    if (d > 150) moveToward(b, dx, dy, d, 76 + b.phase * 10, dt);

    if (b.skillT <= 0) {
      if (b.phase === 1) hydraVolley(b, 5, 260);
      else if (b.phase === 2) { hydraVolley(b, 7, 300); spawnPool(W.Player.wx, W.Player.wy); }
      else { hydraVolley(b, 9, 340); spawnPool(W.Player.wx, W.Player.wy); spawnPool(W.Player.wx + 70, W.Player.wy - 35); }
      b.skillT = b.phase === 3 ? 1.35 : (b.phase === 2 ? 1.85 : 2.4);
      b.atkFx = 0.5;
    }
    if (d < 72 && b.atkT <= 0) {
      b.atkT = b.phase === 3 ? 0.9 : 1.25;
      b.atkFx = 0.45;
      damagePlayer(b.def.dmg + (b.phase - 1) * 4, 'hydra-bite');
    }
  }

  function updateDragon(b, dt) {
    var dx = W.Player.wx - b.wx, dy = W.Player.wy - b.wy;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var hx = b.site.wx - b.wx, hy = b.site.wy - b.wy;
    var hd = Math.sqrt(hx * hx + hy * hy) || 0.001;
    b.phase = phaseOf(b);
    if (regionalLeash(b, hx, hy, hd, d, dt)) return;
    b.faceX = dx / d; b.faceY = dy / d;
    if (d > 190) moveToward(b, dx, dy, d, 72 + b.phase * 10, dt);
    else if (d < 112) moveToward(b, -dx, -dy, d, 42, dt);

    if (b.skillT <= 0) {
      frostVolley(b, b.phase === 1 ? 4 : (b.phase === 2 ? 6 : 8), 280 + b.phase * 25);
      if (b.phase >= 2) spawnPool(W.Player.wx, W.Player.wy, 'frost', 54 + b.phase * 5, 3.4, 6, 0.75);
      if (b.phase === 3) spawnPool(W.Player.wx + 72, W.Player.wy - 36, 'frost', 48, 3.0, 6, 0.75);
      b.skillT = b.phase === 3 ? 1.45 : (b.phase === 2 ? 1.95 : 2.55);
      b.atkFx = 0.5;
    }
    if (d < 82 && b.atkT <= 0) {
      b.atkT = b.phase === 3 ? 0.95 : 1.3;
      b.atkFx = 0.45;
      damagePlayer(b.def.dmg + (b.phase - 1) * 3, 'dragon-dive');
    }
  }

  function updateColossus(b, dt) {
    var dx = W.Player.wx - b.wx, dy = W.Player.wy - b.wy;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var hx = b.site.wx - b.wx, hy = b.site.wy - b.wy;
    var hd = Math.sqrt(hx * hx + hy * hy) || 0.001;
    b.phase = phaseOf(b);
    if (regionalLeash(b, hx, hy, hd, d, dt)) return;
    b.faceX = dx / d; b.faceY = dy / d;
    if (d > 102) moveToward(b, dx, dy, d, 48 + b.phase * 8, dt);

    if (b.skillT <= 0) {
      rotVolley(b, b.phase === 1 ? 1 : (b.phase === 2 ? 3 : 5), 205 + b.phase * 18);
      spawnPool(W.Player.wx, W.Player.wy, 'rot', 58 + b.phase * 6, 4.6, 7, 0.7);
      if (b.phase === 3) {
        spawnPool(W.Player.wx - 78, W.Player.wy + 28, 'rot', 48, 4.0, 7, 0.7);
        spawnPool(W.Player.wx + 78, W.Player.wy + 28, 'rot', 48, 4.0, 7, 0.7);
      }
      b.skillT = b.phase === 3 ? 2.0 : (b.phase === 2 ? 2.55 : 3.15);
      b.atkFx = 0.52;
    }
    if (d < 108 && b.atkT <= 0) {
      b.atkT = b.phase === 3 ? 1.0 : 1.4;
      b.atkFx = 0.5;
      damagePlayer(b.def.dmg + (b.phase - 1) * 4, 'colossus-fist');
      if (b.phase >= 2) spawnPool(b.wx, b.wy, 'rot', 72, 1.2, 8, 0.55);
    }
  }

  function updateEagle(b, dt) {
    var dx = W.Player.wx - b.wx, dy = W.Player.wy - b.wy;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var hx = b.site.wx - b.wx, hy = b.site.wy - b.wy;
    var hd = Math.sqrt(hx * hx + hy * hy) || 0.001;
    b.phase = phaseOf(b);
    if (regionalLeash(b, hx, hy, hd, d, dt)) return;
    b.faceX = dx / d; b.faceY = dy / d;
    if (d > 175) moveToward(b, dx, dy, d, 118 + b.phase * 13, dt);
    else if (d < 105) moveToward(b, -dx, -dy, d, 92, dt);

    if (b.skillT <= 0) {
      thunderVolley(b, b.phase === 1 ? 5 : (b.phase === 2 ? 7 : 9), 330 + b.phase * 30);
      if (b.phase >= 2) spawnPool(W.Player.wx, W.Player.wy, 'wind', 62 + b.phase * 4, 2.2, 8, 0.62);
      b.skillT = b.phase === 3 ? 1.15 : (b.phase === 2 ? 1.55 : 2.05);
      b.atkFx = 0.45;
    }
    if (d < 74 && b.atkT <= 0) {
      b.atkT = b.phase === 3 ? 0.72 : 1.0;
      b.atkFx = 0.4;
      damagePlayer(b.def.dmg + (b.phase - 1) * 3, 'eagle-dive');
    }
  }

  function updateLava(b, dt) {
    var dx = W.Player.wx - b.wx, dy = W.Player.wy - b.wy;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var hx = b.site.wx - b.wx, hy = b.site.wy - b.wy;
    var hd = Math.sqrt(hx * hx + hy * hy) || 0.001;
    b.phase = phaseOf(b);
    if (regionalLeash(b, hx, hy, hd, d, dt)) return;
    b.faceX = dx / d; b.faceY = dy / d;
    if (d > 118) moveToward(b, dx, dy, d, 48 + b.phase * 8, dt);

    if (b.skillT <= 0) {
      lavaVolley(b, b.phase === 1 ? 3 : (b.phase === 2 ? 5 : 7), 220 + b.phase * 22);
      spawnPillars(b.phase === 1 ? 3 : (b.phase === 2 ? 5 : 7), b.phase);
      spawnPool(W.Player.wx, W.Player.wy, 'lava', 54 + b.phase * 6, 4.2, 9 + b.phase, 0.62);
      if (b.phase === 3) {
        spawnPool(W.Player.wx - 82, W.Player.wy + 34, 'lava', 50, 3.7, 12, 0.58);
        spawnPool(W.Player.wx + 82, W.Player.wy + 34, 'lava', 50, 3.7, 12, 0.58);
      }
      placeSafeZone();
      b.skillT = b.phase === 3 ? 1.7 : (b.phase === 2 ? 2.25 : 2.9);
      b.atkFx = 0.55;
    }
    if (d < 116 && b.atkT <= 0) {
      b.atkT = b.phase === 3 ? 0.95 : 1.35;
      b.atkFx = 0.5;
      if (!inLavaSafeZone()) damagePlayer(b.def.dmg + (b.phase - 1) * 5, 'lava-fist');
      spawnPillar(W.Player.wx, W.Player.wy, 0.65, 46, 18 + b.phase * 3);
    }
  }

  function phaseOf(b) {
    return b.hp <= b.def.hp * 0.25 ? 3 : (b.hp <= b.def.hp * 0.6 ? 2 : 1);
  }

  function regionalLeash(b, hx, hy, hd, playerD, dt) {
    if (playerD <= 560 && hd <= 660) return false;
    if (hd > 8) moveToward(b, hx, hy, hd, SPEED * 0.75, dt);
    return true;
  }

  function moveToward(b, dx, dy, d, speed, dt) {
    b.wx += dx / d * speed * dt;
    b.wy += dy / d * speed * dt;
    b.faceX = dx / d; b.faceY = dy / d;
  }

  function hydraVolley(b, count, speed) {
    var base = Math.atan2(W.Player.wy - b.wy, W.Player.wx - b.wx);
    var spread = 0.16, i, a;
    for (i = 0; i < count; i++) {
      a = base + (i - (count - 1) / 2) * spread;
      spawnProjectile(b.wx, b.wy - 20, Math.cos(a) * speed, Math.sin(a) * speed, 9 + b.phase * 2, 'poison');
    }
  }

  function frostVolley(b, count, speed) {
    fanVolley(b, count, speed, 0.13, 9 + b.phase * 2, 'frost');
  }

  function rotVolley(b, count, speed) {
    fanVolley(b, count, speed, 0.2, 11 + b.phase * 2, 'rot');
  }

  function thunderVolley(b, count, speed) {
    fanVolley(b, count, speed, 0.105, 8 + b.phase * 2, 'thunder');
    if (b.phase === 3) {
      var i, a;
      for (i = 0; i < 6; i++) {
        a = i * Math.PI / 3;
        spawnProjectile(b.wx, b.wy - 18, Math.cos(a) * 250, Math.sin(a) * 250, 9, 'thunder');
      }
    }
  }

  function lavaVolley(b, count, speed) {
    fanVolley(b, count, speed, 0.14, 12 + b.phase * 2, 'lava');
  }

  function fanVolley(b, count, speed, spread, dmg, kind) {
    var base = Math.atan2(W.Player.wy - b.wy, W.Player.wx - b.wx);
    var i, a;
    for (i = 0; i < count; i++) {
      a = base + (i - (count - 1) / 2) * spread;
      spawnProjectile(b.wx, b.wy - 20, Math.cos(a) * speed, Math.sin(a) * speed, dmg, kind);
    }
  }

  function spawnProjectile(wx, wy, vx, vy, dmg, kind) {
    var i, p;
    for (i = 0; i < projectiles.length; i++) if (!projectiles[i].on) {
      p = projectiles[i]; p.on = true; p.wx = wx; p.wy = wy; p.vx = vx; p.vy = vy;
      p.dmg = dmg; p.kind = kind || 'poison'; p.t = 2.2; return;
    }
  }

  function spawnPool(wx, wy, kind, radius, duration, dmg, tickEvery) {
    var i, p;
    for (i = 0; i < pools.length; i++) if (!pools[i].on) {
      p = pools[i]; p.on = true; p.wx = wx; p.wy = wy; p.t = duration || 5.5;
      p.tick = 0; p.tickEvery = tickEvery || 0.7; p.r = radius || 48;
      p.dmg = dmg || 5; p.kind = kind || 'poison'; return;
    }
  }

  function spawnPillars(count, phase) {
    lavaSeq++;
    var i, a, r;
    for (i = 0; i < count; i++) {
      a = lavaSeq * 2.399 + i * Math.PI * 2 / count;
      r = i === 0 ? 0 : 58 + (i % 3) * 42;
      spawnPillar(W.Player.wx + Math.cos(a) * r, W.Player.wy + Math.sin(a) * r,
        0.82 + (i % 2) * 0.18, 38 + phase * 5, 16 + phase * 4);
    }
  }

  function spawnPillar(wx, wy, delay, radius, dmg) {
    var i, p;
    for (i = 0; i < pillars.length; i++) if (!pillars[i].on) {
      p = pillars[i]; p.on = true; p.wx = wx; p.wy = wy; p.delay = delay;
      p.t = 0.38; p.r = radius; p.dmg = dmg; p.hit = false; return;
    }
  }

  function placeSafeZone() {
    var a = lavaSeq * 1.618, tx = W.Player.wx + Math.cos(a) * 92, ty = W.Player.wy + Math.sin(a) * 92;
    var s = W.World && W.World.findSpawn ? W.World.findSpawn(tx, ty) : null;
    safeZone.on = true; safeZone.wx = s ? s.wx : tx; safeZone.wy = s ? s.wy : ty;
    safeZone.r = 58; safeZone.t = 4.2;
  }

  function inLavaSafeZone() {
    if (!safeZone.on) return false;
    var dx = W.Player.wx - safeZone.wx, dy = W.Player.wy - safeZone.wy;
    return dx * dx + dy * dy < safeZone.r * safeZone.r;
  }

  function updateHazards(dt) {
    var i, p, dx, dy;
    if (safeZone.on) { safeZone.t -= dt; if (safeZone.t <= 0) safeZone.on = false; }
    for (i = 0; i < projectiles.length; i++) {
      p = projectiles[i]; if (!p.on) continue;
      p.t -= dt; if (p.t <= 0) { p.on = false; continue; }
      p.wx += p.vx * dt; p.wy += p.vy * dt;
      dx = W.Player.wx - p.wx; dy = W.Player.wy - p.wy;
      if (dx * dx + dy * dy < 24 * 24) {
        p.on = false;
        if (p.kind !== 'lava' || !inLavaSafeZone()) damagePlayer(p.dmg, p.kind + '-projectile');
      }
    }
    for (i = 0; i < pools.length; i++) {
      p = pools[i]; if (!p.on) continue;
      p.t -= dt; p.tick -= dt; if (p.t <= 0) { p.on = false; continue; }
      dx = W.Player.wx - p.wx; dy = W.Player.wy - p.wy;
      if (dx * dx + dy * dy < p.r * p.r && p.tick <= 0) {
        p.tick = p.tickEvery;
        if (p.kind !== 'lava' || !inLavaSafeZone()) damagePlayer(p.dmg, p.kind + '-zone');
      }
    }
    for (i = 0; i < pillars.length; i++) {
      p = pillars[i]; if (!p.on) continue;
      if (p.delay > 0) { p.delay -= dt; continue; }
      if (!p.hit) {
        p.hit = true; dx = W.Player.wx - p.wx; dy = W.Player.wy - p.wy;
        if (dx * dx + dy * dy < p.r * p.r && !inLavaSafeZone()) damagePlayer(p.dmg, 'fire-pillar');
      }
      p.t -= dt; if (p.t <= 0) p.on = false;
    }
  }

  function damagePlayer(amount, source) {
    var dmg = W.DivineArms ? W.DivineArms.absorbDamage(amount, source) : amount;
    if (dmg > 0) {
      W.Stats.damage(dmg);
      if (W.Game && W.Game.onBossHitPlayer) W.Game.onBossHitPlayer();
    }
  }

  var _res = { name: '', dmg: 0, killed: false, wx: 0, wy: 0, type: -1, boss: true };
  function hitAt(wx, wy, r, dmg) {
    var i, b, dx, dy, br, unlocked;
    for (i = 0; i < bosses.length; i++) {
      b = bosses[i]; if (!b.alive) continue;
      dx = b.wx - wx; dy = b.wy - wy; br = b.def.kind === 'regional' ? (b.def.radius || 54) : 30;
      if (dx * dx + dy * dy < (r + br) * (r + br)) {
        b.hp -= dmg; b.hurt = 0.18;
        _res.name = b.def.name; _res.dmg = dmg; _res.wx = b.wx; _res.wy = b.wy; _res.type = -1; _res.killed = false;
        if (b.hp <= 0) {
          b.alive = false; defeated[b.site.k] = 1; _res.killed = true;
          unlocked = false;
          if (b.def.reward && W.DivineArms) unlocked = W.DivineArms.unlock(b.def.reward);
          b.rewardUnlocked = !!unlocked;
          clearHazards();
          if (W.Game && W.Game.onBossDown) W.Game.onBossDown(b);
        }
        return _res;
      }
    }
    return null;
  }

  function nearest(wx, wy) {
    var i, b, dx, dy, d2, best = null, bd = 1e18;
    for (i = 0; i < bosses.length; i++) {
      b = bosses[i]; if (!b.alive) continue;
      dx = b.wx - wx; dy = b.wy - wy; d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = b; }
    }
    return best;
  }

  function eachProjectile(fn) { var i; for (i = 0; i < projectiles.length; i++) if (projectiles[i].on) fn(projectiles[i]); }
  function eachPool(fn) { var i; for (i = 0; i < pools.length; i++) if (pools[i].on) fn(pools[i]); }
  function eachPillar(fn) { var i; for (i = 0; i < pillars.length; i++) if (pillars[i].on) fn(pillars[i]); }
  function safeZoneAt() { return safeZone.on ? safeZone : null; }
  function clearHazards() {
    var i;
    for (i = 0; i < projectiles.length; i++) projectiles[i].on = false;
    for (i = 0; i < pools.length; i++) pools[i].on = false;
    for (i = 0; i < pillars.length; i++) pillars[i].on = false;
    safeZone.on = false;
  }
  function isDefeated(k) { return !!defeated[k]; }
  function count() { return bosses.length; }
  function at(i) { return bosses[i]; }
  function exportData() { var o = {}, k; for (k in defeated) if (defeated.hasOwnProperty(k)) o[k] = 1; return o; }
  function importData(o) { defeated = {}; var k; if (o) for (k in o) if (o.hasOwnProperty(k)) defeated[k] = 1; bind(); }
  function clear() { defeated = {}; bind(); }
  function exportDataCount() { var k, n = 0; for (k in defeated) if (defeated.hasOwnProperty(k)) n++; return n; }
  function stats() {
    var i, n = 0, regionalAlive = 0;
    for (i = 0; i < bosses.length; i++) if (bosses[i].alive) {
      n++; if (bosses[i].def.kind === 'regional') regionalAlive++;
    }
    return { alive: n, defeated: exportDataCount(), regionalAlive: regionalAlive, hydra: !defeated['region:hydra'] };
  }

  return {
    init: bind, update: update, hitAt: hitAt, nearest: nearest,
    eachProjectile: eachProjectile, eachPool: eachPool, eachPillar: eachPillar, safeZoneAt: safeZoneAt,
    isDefeated: isDefeated, count: count, at: at,
    exportData: exportData, importData: importData, clear: clear, stats: stats
  };
})();
