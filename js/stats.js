window.W = window.W || {};

/* 生存數值：生命 / 飽食 / 體力。
   新增欄位時務必同步 save.js 的 collect / apply / migrate 三處。 */
W.Stats = (function() {

  var hp = 100, hpMax = 100;
  var food = 100, foodMax = 100;
  var stam = 100, stamMax = 100;
  var san = 100, sanMax = 100;
  var dead = false;
  var hurtT = 0;
  var invT = 0;

  function update(dt) {
    if (dead) return;

    food -= W.CFG.FOOD_DRAIN * dt;
    if (food < 0) food = 0;

    if (food <= 0) {
      hp -= W.CFG.STARVE_DPS * dt;
    } else if (food > 50 && hp < hpMax) {
      hp += W.CFG.HP_REGEN * dt;
    }

    stam += W.CFG.STAM_REGEN * dt;
    if (stam > stamMax) stam = stamMax;

    updateSanity(dt);

    if (hp > hpMax) hp = hpMax;
    if (hurtT > 0) hurtT -= dt;
    if (invT > 0) invT -= dt;

    if (hp <= 0) handleLethal();
  }

  /* 理智值：夜裡會掉，靠近營火回得比掉得快，白天緩慢自然回復。
     這是「夜晚要不要出門」的第二層壓力來源。 */
  function updateSanity(dt) {
    var night = W.Time && W.Time.isNight();
    var nearFire = false;

    if (W.Build && W.Build.nearType) {
      nearFire = !!(W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.FIRE, W.CFG.SAN_FIRE_RANGE) ||
                    W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.FURNACE, W.CFG.SAN_FIRE_RANGE));
    }

    if (nearFire) {
      san += W.CFG.SAN_FIRE_REGEN * dt;
    } else if (night) {
      var dark = W.Time ? W.Time.darkness() : 0;
      san -= (dark > 0.5 ? W.CFG.SAN_DARK_DRAIN : W.CFG.SAN_NIGHT_DRAIN) * dt;
    } else {
      san += W.CFG.SAN_DAY_REGEN * dt;
    }

    if (san > sanMax) san = sanMax;
    if (san < 0) san = 0;
  }

  function addSan(n) {
    san += n;
    if (san > sanMax) san = sanMax;
    if (san < 0) san = 0;
  }

  /* 所有敵人傷害共用同一入口；source 與來源座標讓老皮辨識
     投射物、近戰，以及不該浪費守護冷卻的持續地板傷害。 */
  function damage(n, source, sourceWx, sourceWy) {
    if (dead) return false;
    if (invT > 0) return false;
    if (W.Player && W.Player.isRolling && W.Player.isRolling()) {
      if (W.Player.evadeDamage) W.Player.evadeDamage(n);
      return false;
    }
    /* 所有敵人傷害只在這裡依序結算：翻滾 → 神武 → 老皮 → Skin → 扣血。 */
    if (W.DivineArms && W.DivineArms.absorbDamage) {
      n = W.DivineArms.absorbDamage(n, source || 'world-attack');
      if (n <= 0) return false;
    }
    if (W.BondMate && W.BondMate.absorbDamage) {
      n = W.BondMate.absorbDamage(n, source || 'world-attack', sourceWx, sourceWy);
      if (n <= 0) return false;
    }
    if(W.Skins&&W.Skins.enemyDamageMultiplier)n*=W.Skins.enemyDamageMultiplier();
    invT = W.CFG.HURT_IFRAME;
    hp -= n;
    hurtT = 0.35;
    if (hp <= 0) handleLethal();
    return true;
  }

  function handleLethal() {
    var pct=W.Skins&&W.Skins.tryPhoenixRevive?W.Skins.tryPhoenixRevive():0;
    if(pct>0){hp=hpMax*pct;food=Math.max(food,foodMax*.25);stam=stamMax;dead=false;hurtT=0;invT=1.6;return true;}
    pct=W.BondMate&&W.BondMate.tryRescue?W.BondMate.tryRescue():0;
    if(pct>0){hp=hpMax*pct;food=Math.max(food,foodMax*.2);stam=Math.max(stam,stamMax*.35);dead=false;hurtT=0;invT=1.2;if(W.Game&&W.Game.onBondRescue)W.Game.onBondRescue(W.BondMate.lastRescueFood());return true;}
    hp=0;dead=true;return false;
  }

  function spend(n) {
    if (stam < n) return false;
    stam -= n;
    return true;
  }

  function addStam(n) {
    stam = Math.max(0, Math.min(stamMax, stam + Number(n || 0)));
    return stam;
  }

  function eat(food_add, hp_delta) {
    food += food_add;
    if (food > foodMax) food = foodMax;
    hp += hp_delta;
    if (hp > hpMax) hp = hpMax;
    if (hp <= 0) handleLethal();
  }

  function revive() {
    san = sanMax * 0.6;
    hp = hpMax * 0.5;
    food = foodMax * 0.4;
    stam = stamMax;
    dead = false;
    hurtT = 0;
    invT = 0;
  }

  function exportData() {
    return { hp: hp, food: food, stam: stam, san: san };
  }

  function importData(o) {
    if (!o) return;
    if (typeof o.hp === 'number' && isFinite(o.hp))     hp   = Math.max(1, Math.min(hpMax, o.hp));
    if (typeof o.food === 'number' && isFinite(o.food)) food = Math.max(0, Math.min(foodMax, o.food));
    if (typeof o.stam === 'number' && isFinite(o.stam)) stam = Math.max(0, Math.min(stamMax, o.stam));
    san = (typeof o.san === 'number' && isFinite(o.san)) ? Math.max(0, Math.min(sanMax, o.san)) : sanMax;
    dead = false;
  }

  return {
    update: update,
    damage: damage,
    spend: spend,
    addStam: addStam,
    eat: eat,
    revive: revive,
    exportData: exportData,
    importData: importData,
    hp:    function() { return hp; },
    food:  function() { return food; },
    stam:  function() { return stam; },
    san:   function() { return san; },
    addSan: addSan,
    hpPct:   function() { return hp / hpMax; },
    foodPct: function() { return food / foodMax; },
    stamPct: function() { return stam / stamMax; },
    sanPct:  function() { return san / sanMax; },
    isLowSan: function() { return (san / sanMax) < W.CFG.SAN_LOW; },
    isDead:  function() { return dead; },
    isHurt:  function() { return hurtT > 0; }
  };
})();
