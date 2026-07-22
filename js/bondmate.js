window.W = window.W || {};

/* 老皮：開場常駐、不可解散的主角級守護夥伴。
   他不加入 W.Mates 的招募／進食／四人陣形，只有記憶與配對 Skin 進度會存檔。 */
W.BondMate = (function() {
  var DEF = {
    id: 'laopi', name: '\u8001\u76ae', strong: true,
    dmg: 10, rate: 0.85, range: 150,
    art: 'mate_laopi', color: '#f4ca19'
  };
  var GUARD_COST = 40, GUARD_CD = 16;
  var MEM_BLOCK = 1, MEM_RESCUE = 2, MEM_BOSS = 4, MEM_CALAMITY = 8;
  var MEM_FIRST_NIGHT = 16, MEM_CLOSE_CALL = 32, MEM_FIRST_REALM = 64;
  var _target = { kind: '', obj: null, wx: 0, wy: 0, d2: 0, threat: 0 };
  var _hit = null;
  var seq = 1, idleT = 18, recallT = 20, lastDay = 1, rescueFood = '';
  var sync = 0, echoT = 0, comboCd = 0;
  var suitT = 0, suitBlocked = false, suitBumpCd = 0;
  var transformKind = '', transformT = 0, transformX = 0, transformY = 0;
  var playerHitT = 0, playerHitWx = 0, playerHitWy = 0;
  var bondHitT = 0, bondHitWx = 0, bondHitWy = 0;
  var lastSiteKey = '';
  var _transformState = { kind: '', time: 0, wx: 0, wy: 0 };

  var mate = {
    def: DEF, recruited: true, permanent: true,
    wx: 0, wy: 0, vx: 0, vy: 0,
    faceX: 1, faceY: 0, moving: false,
    atkT: 0, actionT: 0, actionMax: 0.42,
    blockT: 0, hitWx: 0, hitWy: 0,
    animT: 0, bob: 0, lean: 0,
    mood: 'calm', tension: 0, mischief: 0.45, fatigue: 0,
    guardEnergy: 100, blockCd: 0
  };

  var memory = {};

  function resetMemory() {
    memory = {
      introduced: true,
      memoryBits: 0,
      daysTogether: 0,
      lastBondDay: W.Time && W.Time.dayNo ? W.Time.dayNo() : 1,
      bossWins: 0,
      calamityWins: 0,
      blocks: 0,
      pulls: 0,
      rescues: 0,
      realms: 0,
      braveRealms: 0,
      suitUses: 0,
      lastRescueDay: -1,
      lastRecallDay: -1
    };
    lastDay = memory.lastBondDay;
  }

  function spawnNearPlayer() {
    if (!W.Player) return;
    mate.wx = W.Player.wx - (W.Player.faceX || 0) * 46 - (W.Player.faceY || 1) * 30;
    mate.wy = W.Player.wy - (W.Player.faceY || 1) * 46 + (W.Player.faceX || 0) * 30;
    mate.vx = 0; mate.vy = 0;
    mate.faceX = W.Player.faceX || 1; mate.faceY = W.Player.faceY || 0;
  }

  function init() {
    if (!memory.introduced) resetMemory();
    mate.recruited = true; mate.permanent = true;
    mate.guardEnergy = 100; mate.blockCd = 0; mate.blockT = 0;
    mate.actionT = 0; mate.atkT = 0; mate.tension = 0; mate.fatigue = 0;
    mate.mischief = 0.45; mate.mood = 'calm'; idleT = 18; recallT = 20;
    sync = 0; echoT = 0; comboCd = 0; suitT = 0; suitBlocked = false; suitBumpCd = 0;
    transformKind = ''; transformT = 0; playerHitT = 0; bondHitT = 0; lastSiteKey = '';
    spawnNearPlayer();
  }

  function faceToward(x, y, dt, immediate) {
    var dx = x - mate.wx, dy = y - mate.wy, d = Math.sqrt(dx * dx + dy * dy), k, len;
    if (d < 0.001) return;
    k = immediate ? 1 : (1 - Math.exp(-dt * 10));
    mate.faceX += (dx / d - mate.faceX) * k;
    mate.faceY += (dy / d - mate.faceY) * k;
    len = Math.sqrt(mate.faceX * mate.faceX + mate.faceY * mate.faceY) || 1;
    mate.faceX /= len; mate.faceY /= len;
  }

  function nearestTarget(range) {
    var limit = range * range, best = limit, bestThreat = -1, kind = '', obj = null, wx = 0, wy = 0;
    var i, e, dx, dy, d2, px, py, pd2, threat;
    px = W.Player.wx; py = W.Player.wy;
    if (W.Mobs && W.Mobs.count) {
      for (i = 0; i < W.Mobs.count(); i++) {
        e = W.Mobs.at(i); if (!e || !e.alive) continue;
        if (W.Mobs.isHostile && !W.Mobs.isHostile(e)) continue;
        dx = e.wx - mate.wx; dy = e.wy - mate.wy; d2 = dx * dx + dy * dy;
        pd2 = (e.wx - px) * (e.wx - px) + (e.wy - py) * (e.wy - py);
        threat = e.threatT > 0 ? 3 : (pd2 < 150 * 150 ? 2 : 0);
        if (d2 <= limit && (threat > bestThreat || (threat === bestThreat && d2 < best))) {
          best = d2; bestThreat = threat; kind = 'mob'; obj = e; wx = e.wx; wy = e.wy;
        }
      }
    }
    if (W.Bosses && W.Bosses.nearest) {
      e = W.Bosses.nearest(px, py);
      if (e && e.alive) {
        dx = e.wx - mate.wx; dy = e.wy - mate.wy; d2 = dx * dx + dy * dy;
        pd2 = (e.wx - px) * (e.wx - px) + (e.wy - py) * (e.wy - py);
        threat = pd2 < 260 * 260 ? 4 : 1;
        if (d2 <= limit && (threat > bestThreat || (threat === bestThreat && d2 < best))) {
          best = d2; bestThreat = threat; kind = 'boss'; obj = e; wx = e.wx; wy = e.wy;
        }
      }
    }
    if (W.Calamity && W.Calamity.nearest) {
      e = W.Calamity.nearest(px, py);
      if (e && e.alive !== false) {
        dx = e.wx - mate.wx; dy = e.wy - mate.wy; d2 = dx * dx + dy * dy;
        pd2 = (e.wx - px) * (e.wx - px) + (e.wy - py) * (e.wy - py);
        threat = pd2 < 300 * 300 ? 5 : 1;
        if (d2 <= limit && (threat > bestThreat || (threat === bestThreat && d2 < best))) {
          best = d2; bestThreat = threat; kind = 'calamity'; obj = e; wx = e.wx; wy = e.wy;
        }
      }
    }
    if (!obj) return null;
    _target.kind = kind; _target.obj = obj; _target.wx = wx; _target.wy = wy;
    _target.d2 = best; _target.threat = bestThreat;
    return _target;
  }

  function hitTarget(t) {
    if (t.kind === 'mob') return W.Mobs.hitAt(t.wx, t.wy, 28, DEF.dmg);
    if (t.kind === 'boss' && W.Bosses) return W.Bosses.hitAt(t.wx, t.wy, 30, DEF.dmg);
    if (t.kind === 'calamity' && W.Calamity) return W.Calamity.hitAt(t.wx, t.wy, 30, DEF.dmg);
    return null;
  }

  function closeHits(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy <= 110 * 110;
  }

  function comboHit(hit, wx, wy, dmg) {
    if (hit && hit.calamity && W.Calamity) return W.Calamity.hitAt(wx, wy, 38, dmg);
    if (hit && hit.boss && W.Bosses) return W.Bosses.hitAt(wx, wy, 38, dmg);
    return W.Mobs && W.Mobs.hitAt ? W.Mobs.hitAt(wx, wy, 38, dmg) : null;
  }

  function triggerCombo() {
    if (sync < 100 || comboCd > 0 || suitT > 0) return false;
    var target = nearestTarget(360), result;
    if (!target) return false;
    var dmg = echoT > 0 ? 34 : 26;
    result = target.kind === 'calamity' && W.Calamity ? W.Calamity.hitAt(target.wx, target.wy, 44, dmg)
      : (target.kind === 'boss' && W.Bosses ? W.Bosses.hitAt(target.wx, target.wy, 44, dmg)
      : (W.Mobs && W.Mobs.hitAt ? W.Mobs.hitAt(target.wx, target.wy, 44, dmg) : null));
    if (!result) return false;
    sync = 0; comboCd = 3.5;
    mate.guardEnergy = Math.min(100, mate.guardEnergy + 18);
    mate.actionT = 0.78; mate.blockT = Math.max(mate.blockT, 0.36);
    mate.hitWx = target.wx; mate.hitWy = target.wy; mate.fatigue = Math.min(1, mate.fatigue + 0.12);
    if (W.Chatter) W.Chatter.speakMate(mate, 'combo', true);
    if (W.Game && W.Game.onBondCombo) W.Game.onBondCombo(result, target.wx, target.wy, dmg, echoT > 0);
    return true;
  }

  function addSync(amount, hit, wx, wy) {
    var mult = echoT > 0 ? 1.6 : 1;
    sync = Math.min(100, sync + amount * mult);
  }

  function activateSuit() {
    if (sync < 100 || comboCd > 0 || suitT > 0 || transformT > 0) return false;
    var duration = W.LaopiLife && W.LaopiLife.suitDuration ? W.LaopiLife.suitDuration(6) : 6;
    sync = 0; comboCd = 9; suitT = duration; suitBlocked = false; suitBumpCd = 0;
    mate.guardEnergy = Math.max(28, mate.guardEnergy);
    mate.actionT = 0.8; mate.blockT = 0; mate.fatigue = Math.min(1, mate.fatigue + 0.22);
    memory.suitUses++;
    if (W.Chatter) W.Chatter.speakMate(mate, 'combo', true);
    if (W.Game && W.Game.onBondSuit) W.Game.onBondSuit(duration);
    return true;
  }

  function activatePower(kind) {
    return kind === 'suit' ? activateSuit() : triggerCombo();
  }

  function endSuit() {
    if (suitT <= 0) return;
    suitT = 0; suitBlocked = false; suitBumpCd = 0;
    mate.fatigue = Math.max(mate.fatigue, 0.68);
    spawnNearPlayer();
    if (W.Game && W.Game.onBondSuitEnd) W.Game.onBondSuitEnd();
  }

  function performTransform(kind, wx, wy, duration) {
    if (suitT > 0) endSuit();
    transformKind = String(kind || 'sniff');
    transformT = Math.max(0.45, Math.min(3, Number(duration) || 1.15));
    transformX = isFinite(wx) ? wx : mate.wx;
    transformY = isFinite(wy) ? wy : mate.wy;
    mate.wx = transformX; mate.wy = transformY; mate.vx = 0; mate.vy = 0;
    mate.moving = false; mate.actionT = transformT;
  }

  function notePlayerHit(hit) {
    if (!hit || !isFinite(hit.wx) || !isFinite(hit.wy)) return;
    var gain = 8;
    if (bondHitT > 0 && closeHits(hit.wx, hit.wy, bondHitWx, bondHitWy)) gain += 12;
    playerHitT = 1.25; playerHitWx = hit.wx; playerHitWy = hit.wy;
    addSync(gain, hit, hit.wx, hit.wy);
  }

  function noteBondHit(hit) {
    if (!hit || !isFinite(hit.wx) || !isFinite(hit.wy)) return;
    var gain = 5;
    if (playerHitT > 0 && closeHits(hit.wx, hit.wy, playerHitWx, playerHitWy)) gain += 12;
    bondHitT = 1.25; bondHitWx = hit.wx; bondHitWy = hit.wy;
    addSync(gain, hit, hit.wx, hit.wy);
  }

  function prepareSiteLoot(site) {
    var rank = 1 + Math.min(2, Math.floor(sync / 34));
    echoT = 45; sync = Math.max(0, sync - 18);
    mate.guardEnergy = Math.min(100, mate.guardEnergy + 25);
    mate.fatigue = Math.max(0, mate.fatigue - 0.22);
    lastSiteKey = site && site.k ? site.k : lastSiteKey;
    if (W.Chatter) W.Chatter.speakMate(mate, 'site_loot', true);
    return rank;
  }

  function scanSiteNearby(danger) {
    if (danger || !W.Sites || !W.Sites.nearCount) return;
    var i, s, dx, dy;
    for (i = 0; i < W.Sites.nearCount(); i++) {
      s = W.Sites.nearAt(i);
      if (!s || W.Sites.isLooted(s) || s.k === lastSiteKey) continue;
      dx = s.wx - W.Player.wx; dy = s.wy - W.Player.wy;
      if (dx * dx + dy * dy <= 190 * 190) {
        lastSiteKey = s.k;
        if (W.Chatter) W.Chatter.speakMate(mate, 'site', true);
        if (W.Game && W.Game.onBondSiteFound) W.Game.onBondSiteFound(s);
        return;
      }
    }
  }

  function updateMood(dt, danger) {
    var hpLow = W.Stats && W.Stats.hpPct && W.Stats.hpPct() < 0.35;
    if (danger || hpLow) mate.tension = Math.min(1, mate.tension + dt * (hpLow ? 1.2 : 0.7));
    else mate.tension = Math.max(0, mate.tension - dt * 0.16);
    mate.mischief += ((danger ? 0.05 : 0.45) - mate.mischief) * Math.min(1, dt * 0.08);
    if (!danger && mate.actionT <= 0) mate.fatigue = Math.max(0, mate.fatigue - dt * 0.035);
    if (mate.fatigue > 0.72) mate.mood = 'tired';
    else if (hpLow || mate.tension > 0.72) mate.mood = 'protective';
    else if (danger || mate.tension > 0.32) mate.mood = 'alert';
    else if (mate.mischief > 0.58) mate.mood = 'goofy';
    else mate.mood = 'calm';
  }

  function updateDayMemory() {
    var day = W.Time && W.Time.dayNo ? W.Time.dayNo() : 1;
    if (day > lastDay) {
      memory.daysTogether += day - lastDay;
      memory.lastBondDay = day;
      lastDay = day;
      checkSkinUnlock();
    } else if (day < lastDay) {
      lastDay = day; memory.lastBondDay = day;
    }
    if (W.Time && W.Time.isNight && W.Time.isNight() && !(memory.memoryBits & MEM_FIRST_NIGHT)) {
      memory.memoryBits |= MEM_FIRST_NIGHT;
      if (W.Chatter) W.Chatter.speakMate(mate, 'memory_first_night', true);
      if (W.Game && W.Game.onBondMemory) W.Game.onBondMemory('\u7b2c\u4e00\u6b21\u4e00\u8d77\u904e\u591c');
    }
  }

  function update(dt) {
    var target, danger, tx, ty, dx, dy, d, spd, response, desired, damp, speed, ix, iy, il;
    if (!W.Player || !W.Stats) return;
    if (mate.actionT > 0) mate.actionT = Math.max(0, mate.actionT - dt);
    if (mate.blockT > 0) mate.blockT = Math.max(0, mate.blockT - dt);
    if (mate.blockCd > 0) mate.blockCd = Math.max(0, mate.blockCd - dt);
    if (mate.atkT > 0) mate.atkT -= dt;
    if (echoT > 0) echoT = Math.max(0, echoT - dt);
    if (comboCd > 0) comboCd = Math.max(0, comboCd - dt);
    if (suitBumpCd > 0) suitBumpCd = Math.max(0, suitBumpCd - dt);
    if (transformT > 0) transformT = Math.max(0, transformT - dt);
    if (playerHitT > 0) playerHitT = Math.max(0, playerHitT - dt);
    if (bondHitT > 0) bondHitT = Math.max(0, bondHitT - dt);
    updateDayMemory();

    target = nearestTarget(DEF.range + 100);
    danger = !!(target && target.threat >= 2);
    mate.guardEnergy = Math.min(100, mate.guardEnergy + dt * (danger ? 2 : 7));
    updateMood(dt, danger);
    scanSiteNearby(danger);

    if (transformT > 0) {
      mate.wx = transformX; mate.wy = transformY; mate.vx = 0; mate.vy = 0; mate.moving = false;
      mate.animT += dt * 4; mate.bob = Math.sin(mate.animT) * 0.35; mate.lean = 0;
      return;
    }

    if (suitT > 0) {
      suitT = Math.max(0, suitT - dt);
      mate.guardEnergy = Math.max(0, mate.guardEnergy - dt * 10);
      mate.wx = W.Player.wx; mate.wy = W.Player.wy; mate.vx = 0; mate.vy = 0; mate.moving = W.Player.moving;
      mate.faceX = W.Player.faceX; mate.faceY = W.Player.faceY;
      if (W.Player.isRolling && W.Player.isRolling() && suitBumpCd <= 0) {
        var bump = W.Mobs && W.Mobs.hitAt ? W.Mobs.hitAt(W.Player.wx, W.Player.wy, 38, 20) : null;
        if (!bump && W.Bosses) bump = W.Bosses.hitAt(W.Player.wx, W.Player.wy, 42, 20);
        if (!bump && W.Calamity) bump = W.Calamity.hitAt(W.Player.wx, W.Player.wy, 42, 20);
        if (bump) {
          suitBumpCd = 0.18;
          if (W.Game && W.Game.onBondSuitBump) W.Game.onBondSuitBump(bump, W.Player.wx, W.Player.wy);
        }
      }
      if (suitT <= 0 || mate.guardEnergy <= 0) endSuit();
      return;
    }

    if (danger && target) {
      ix = target.wx - W.Player.wx; iy = target.wy - W.Player.wy;
      il = Math.sqrt(ix * ix + iy * iy) || 1;
      tx = W.Player.wx + ix / il * 34;
      ty = W.Player.wy + iy / il * 34;
    } else {
      tx = W.Player.wx - W.Player.faceX * 54 - W.Player.faceY * 32;
      ty = W.Player.wy - W.Player.faceY * 54 + W.Player.faceX * 32;
    }
    dx = tx - mate.wx; dy = ty - mate.wy; d = Math.sqrt(dx * dx + dy * dy);
    if (d > 760) { mate.wx = tx; mate.wy = ty; mate.vx = 0; mate.vy = 0; d = 0; }
    spd = W.CFG.PLAYER_SPEED * (danger ? 1.22 : 1.1);
    response = 1 - Math.exp(-dt * 8.5);
    if (d > 9) {
      desired = Math.min(spd, Math.max(28, (d - 7) * 4.6));
      mate.vx += (dx / d * desired - mate.vx) * response;
      mate.vy += (dy / d * desired - mate.vy) * response;
    } else {
      damp = Math.exp(-dt * 12); mate.vx *= damp; mate.vy *= damp;
    }
    speed = Math.sqrt(mate.vx * mate.vx + mate.vy * mate.vy);
    if (speed > spd) { mate.vx = mate.vx / speed * spd; mate.vy = mate.vy / speed * spd; speed = spd; }
    mate.wx += mate.vx * dt; mate.wy += mate.vy * dt;
    mate.moving = speed > 8;
    if (mate.moving) faceToward(mate.wx + mate.vx, mate.wy + mate.vy, dt, false);
    mate.animT += dt * (mate.moving ? 8.8 : 2.2);
    mate.bob = mate.moving ? -Math.abs(Math.sin(mate.animT)) * 2.8 : Math.sin(mate.animT) * 0.55;
    mate.lean = mate.moving ? Math.max(-0.07, Math.min(0.07, mate.vx / spd * 0.07)) : 0;

    if (target && mate.atkT <= 0 && !W.Stats.isDead()) {
      _hit = null;
      if (_target.d2 <= DEF.range * DEF.range) {
        faceToward(target.wx, target.wy, dt, true);
        _hit = hitTarget(target);
      }
      if (_hit) {
        mate.atkT = DEF.rate; mate.actionT = mate.actionMax;
        mate.hitWx = _hit.wx || target.wx; mate.hitWy = _hit.wy || target.wy;
        mate.fatigue = Math.min(1, mate.fatigue + 0.035);
        if (W.Game && W.Game.onBondHit) W.Game.onBondHit(mate, _hit);
        noteBondHit(_hit);
      } else mate.atkT = 0.16;
    }

    idleT -= dt;
    if (idleT <= 0) {
      idleT = 20 + (seq++ % 15);
      if (!danger && mate.tension < 0.28 && W.Chatter) {
        if (W.Stats.foodPct && W.Stats.foodPct() < 0.22) W.Chatter.speakMate(mate, 'hungry');
        else if (W.Time && W.Time.isNight && W.Time.isNight()) W.Chatter.speakMate(mate, 'night');
        else W.Chatter.speakMate(mate, 'idle');
      }
    }
    if (danger) {
      recallT = Math.max(recallT, 10);
    } else {
      recallT -= dt;
      if (recallT <= 0 && memory.lastRecallDay !== lastDay &&
          (!W.Chatter || !W.Chatter.isBusy || !W.Chatter.isBusy())) {
        var recallCat = '';
        if (memory.memoryBits & MEM_RESCUE) recallCat = 'memory_close_call';
        else if (memory.memoryBits & MEM_CALAMITY) recallCat = 'memory_first_calamity';
        else if (memory.memoryBits & MEM_BOSS) recallCat = 'memory_first_boss';
        else if (memory.memoryBits & MEM_FIRST_NIGHT) recallCat = 'memory_first_night';
        if (recallCat && W.Chatter && W.Chatter.speakMate && W.Chatter.speakMate(mate, recallCat)) {
          memory.lastRecallDay = lastDay;
        }
        recallT = 22;
      }
    }
  }

  function guardable(source) {
    source = String(source || 'world-attack');
    return source.indexOf('zone') < 0 && source.indexOf('void') < 0 &&
      source.indexOf('starve') < 0 && source.indexOf('hunger') < 0 &&
      source.indexOf('floor') < 0 && source.indexOf('pool') < 0;
  }

  function absorbDamage(amount, source, sourceWx, sourceWy) {
    var dx, dy, guardCost = W.LaopiLife && W.LaopiLife.guardCost ? W.LaopiLife.guardCost(GUARD_COST) : GUARD_COST;
    if (!guardable(source) ||
        !W.Stats || W.Stats.isDead()) return amount;
    if (suitT > 0) {
      if (!suitBlocked) {
        suitBlocked = true;
        mate.actionT = 0.55; mate.fatigue = Math.min(1, mate.fatigue + 0.12);
        if (W.Game && W.Game.onBondSuitBlock) W.Game.onBondSuitBlock(amount, source);
        return 0;
      }
      return amount;
    }
    if (mate.blockCd > 0 || mate.guardEnergy < guardCost) return amount;
    dx = mate.wx - W.Player.wx; dy = mate.wy - W.Player.wy;
    if (dx * dx + dy * dy > 190 * 190) return amount;
    mate.guardEnergy -= guardCost; mate.blockCd = GUARD_CD;
    mate.blockT = 0.62; mate.actionT = 0.62; mate.fatigue = Math.min(1, mate.fatigue + 0.24);
    mate.hitWx = isFinite(sourceWx) ? sourceWx : W.Player.wx + W.Player.faceX * 48;
    mate.hitWy = isFinite(sourceWy) ? sourceWy : W.Player.wy + W.Player.faceY * 48;
    faceToward(mate.hitWx, mate.hitWy, 0, true);
    memory.blocks++; memory.memoryBits |= MEM_BLOCK;
    addSync(18, null, mate.hitWx, mate.hitWy);
    if (W.LaopiLife) {
      if (W.LaopiLife.noteGuard) W.LaopiLife.noteGuard();
      if (W.LaopiLife.tryDangerPull && W.LaopiLife.tryDangerPull(mate.hitWx, mate.hitWy)) memory.pulls++;
    }
    checkSkinUnlock();
    if (W.Chatter) W.Chatter.speakMate(mate, 'guard', true);
    if (W.Game && W.Game.onBondBlock) W.Game.onBondBlock(amount, source);
    return 0;
  }

  function tryRescue() {
    var day = W.Time && W.Time.dayNo ? W.Time.dayNo() : 1;
    var sandwichRescue = W.LaopiLife && W.LaopiLife.trySandwichRescue ? W.LaopiLife.trySandwichRescue() : 0;
    if (sandwichRescue > 0) {
      rescueFood = '\u7d42\u6975\u4e09\u660e\u6cbb';
      mate.guardEnergy = 30; mate.blockCd = GUARD_CD; mate.blockT = 1.1; mate.actionT = 1.1;
      mate.fatigue = 1; mate.tension = 1;
      memory.rescues++; memory.memoryBits |= MEM_RESCUE;
      if (W.Chatter) W.Chatter.speakMate(mate, 'revive', true);
      return sandwichRescue;
    }
    if (memory.lastRescueDay === day || mate.guardEnergy < 99.5 || !W.Inv) return 0;
    rescueFood = '';
    if (W.Inv.take('cooked', 1)) rescueFood = '\u70e4\u8089';
    else if (W.Inv.take('jerky', 1)) rescueFood = '\u8089\u4e7e';
    else if (W.Inv.take('berry', 1)) rescueFood = '\u6f3f\u679c';
    if (!rescueFood) return 0;
    mate.guardEnergy = 0; mate.blockCd = GUARD_CD; mate.blockT = 1.1; mate.actionT = 1.1;
    mate.fatigue = 1; mate.tension = 1;
    memory.lastRescueDay = day; memory.rescues++; memory.memoryBits |= MEM_RESCUE;
    if (W.LaopiLife && W.LaopiLife.noteRescue) W.LaopiLife.noteRescue();
    if (W.Chatter) W.Chatter.speakMate(mate, 'revive', true);
    return 0.25;
  }

  function noteEvent(kind) {
    if (kind === 'hurt') { mate.tension = Math.min(1, mate.tension + 0.35); idleT = Math.max(idleT, 8); }
    else if (kind === 'danger') {
      mate.tension = Math.min(1, mate.tension + 0.48); idleT = Math.max(idleT, 10);
      if (W.Chatter) W.Chatter.speakMate(mate, 'danger', true);
    }
    else if (kind === 'dodge') {
      mate.mischief = Math.min(1, mate.mischief + 0.12);
      addSync(14 + (W.LaopiLife && W.LaopiLife.dodgeSyncBonus ? W.LaopiLife.dodgeSyncBonus() : 0), null, W.Player.wx, W.Player.wy);
      if (W.LaopiLife && W.LaopiLife.noteDodge) W.LaopiLife.noteDodge();
    }
    else if (kind === 'retreat') {
      mate.tension = Math.max(mate.tension, 0.55); sync = Math.max(sync, 25);
      spawnNearPlayer();
      if (W.LaopiLife && W.LaopiLife.noteRetreat) W.LaopiLife.noteRetreat();
      if (W.Chatter) W.Chatter.speakMate(mate, 'retreat', true);
    }
  }

  function noteBossDown(calamity) {
    var first = false;
    if (calamity) {
      memory.calamityWins++;
      first = !(memory.memoryBits & MEM_CALAMITY);
      memory.memoryBits |= MEM_CALAMITY;
    } else {
      memory.bossWins++;
      first = !(memory.memoryBits & MEM_BOSS);
      memory.memoryBits |= MEM_BOSS;
    }
    if (W.Stats && W.Stats.hpPct && W.Stats.hpPct() < 0.16) memory.memoryBits |= MEM_CLOSE_CALL;
    mate.tension = 0; mate.mischief = Math.min(1, mate.mischief + 0.2);
    if (W.Chatter) W.Chatter.speakMate(mate, first ? (calamity ? 'memory_first_calamity' : 'memory_first_boss') : 'kill', true);
    if (first && W.Game && W.Game.onBondMemory) W.Game.onBondMemory(calamity ? '\u7b2c\u4e00\u6b21\u4e00\u8d77\u5e73\u606f\u4e16\u754c\u707d\u798d' : '\u7b2c\u4e00\u6b21\u4e00\u8d77\u64ca\u6557\u9996\u9818');
    if (W.LaopiLife && W.LaopiLife.noteBossDown) W.LaopiLife.noteBossDown(!!calamity);
    checkSkinUnlock();
  }

  function restoreGuard(amount) {
    amount = Math.max(0, Number(amount) || 0);
    mate.guardEnergy = Math.min(100, mate.guardEnergy + amount);
    return mate.guardEnergy;
  }

  function noteRealmComplete(brave) {
    var first = !(memory.memoryBits & MEM_FIRST_REALM);
    memory.realms++;
    if (brave) memory.braveRealms++;
    memory.memoryBits |= MEM_FIRST_REALM;
    mate.mischief = Math.min(1, mate.mischief + 0.16);
    addSync(brave ? 35 : 22, null, W.Player.wx, W.Player.wy);
    if (first && W.Game && W.Game.onBondMemory) W.Game.onBondMemory('\u7b2c\u4e00\u6b21\u4e00\u8d77\u7834\u89e3\u54c7\u585e\u79d8\u5883');
  }

  function skinEligible() {
    return memory.daysTogether >= 3 && memory.blocks >= 8 &&
      (memory.bossWins + memory.calamityWins) >= 1;
  }

  function checkSkinUnlock(silent) {
    if (skinEligible() && W.Skins && W.Skins.unlock) W.Skins.unlock('found_family', !!silent);
  }

  function exportData() {
    return {
      introduced: true,
      memoryBits: memory.memoryBits | 0,
      daysTogether: memory.daysTogether | 0,
      lastBondDay: memory.lastBondDay | 0,
      bossWins: memory.bossWins | 0,
      calamityWins: memory.calamityWins | 0,
      blocks: memory.blocks | 0,
      pulls: memory.pulls | 0,
      rescues: memory.rescues | 0,
      realms: memory.realms | 0,
      braveRealms: memory.braveRealms | 0,
      suitUses: memory.suitUses | 0,
      lastRescueDay: memory.lastRescueDay | 0,
      lastRecallDay: memory.lastRecallDay | 0
    };
  }

  function intAt(o, key, min, max, fallback) {
    var n = o && typeof o[key] === 'number' && isFinite(o[key]) ? Math.floor(o[key]) : fallback;
    return Math.max(min, Math.min(max, n));
  }

  function importData(o) {
    resetMemory();
    if (o && typeof o === 'object') {
      memory.introduced = true;
      memory.memoryBits = intAt(o, 'memoryBits', 0, 0x7fffffff, 0);
      memory.daysTogether = intAt(o, 'daysTogether', 0, 99999, 0);
      memory.lastBondDay = intAt(o, 'lastBondDay', 1, 99999, W.Time && W.Time.dayNo ? W.Time.dayNo() : 1);
      memory.bossWins = intAt(o, 'bossWins', 0, 99999, 0);
      memory.calamityWins = intAt(o, 'calamityWins', 0, 99999, 0);
      memory.blocks = intAt(o, 'blocks', 0, 999999, 0);
      memory.pulls = intAt(o, 'pulls', 0, 999999, 0);
      memory.rescues = intAt(o, 'rescues', 0, 999999, 0);
      memory.realms = intAt(o, 'realms', 0, 999999, 0);
      memory.braveRealms = intAt(o, 'braveRealms', 0, 999999, 0);
      memory.suitUses = intAt(o, 'suitUses', 0, 999999, 0);
      memory.lastRescueDay = intAt(o, 'lastRescueDay', -1, 99999, -1);
      memory.lastRecallDay = intAt(o, 'lastRecallDay', -1, 99999, -1);
    }
    lastDay = memory.lastBondDay;
    init();
    checkSkinUnlock(true);
  }

  function clear() { resetMemory(); init(); }
  function stats() {
    var shownGuardCost = W.LaopiLife && W.LaopiLife.guardCost ? W.LaopiLife.guardCost(GUARD_COST) : GUARD_COST;
    return {
      name: DEF.name, energy: mate.guardEnergy, blockReady: mate.blockCd <= 0 && mate.guardEnergy >= shownGuardCost,
      blockCd: mate.blockCd, mood: mate.mood, sync: sync, echo: echoT, comboReady: sync >= 100 && comboCd <= 0,
      suit: suitT, suitBlocked: suitBlocked, transform: transformKind, transformT: transformT,
      daysTogether: memory.daysTogether,
      blocks: memory.blocks, rescues: memory.rescues, bossWins: memory.bossWins,
      calamityWins: memory.calamityWins, realms: memory.realms, braveRealms: memory.braveRealms,
      suitUses: memory.suitUses, skinEligible: skinEligible()
    };
  }

  resetMemory();

  return {
    init: init, update: update, mate: function() { return mate; }, spawnNearPlayer: spawnNearPlayer,
    absorbDamage: absorbDamage, tryRescue: tryRescue, lastRescueFood: function() { return rescueFood; },
    noteEvent: noteEvent, notePlayerHit: notePlayerHit, prepareSiteLoot: prepareSiteLoot,
    noteBossDown: noteBossDown, noteRealmComplete: noteRealmComplete,
    restoreGuard: restoreGuard,
    activatePower: activatePower, suitActive: function() { return suitT > 0; },
    attackDamageBonus: function() { return suitT > 0 ? 12 : 0; },
    attackRangeBonus: function() { return suitT > 0 ? 34 : 0; },
    rollSpeedMultiplier: function() { return suitT > 0 ? 1.18 : 1; },
    performTransform: performTransform,
    transformState: function() {
      _transformState.kind = transformKind; _transformState.time = transformT;
      _transformState.wx = transformX; _transformState.wy = transformY;
      return _transformState;
    },
    skinEligible: skinEligible, checkSkinUnlock: checkSkinUnlock,
    exportData: exportData, importData: importData, clear: clear, stats: stats
  };
})();
