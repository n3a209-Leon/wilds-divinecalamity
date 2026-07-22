window.W = window.W || {};

/* 四角取樣的可站立判定。半徑縮 0.72 讓角色能順利通過單格縫隙。 */
function canStand(wx, wy) {
  var r = W.CFG.PLAYER_RADIUS * 0.72;
  if (W.World.isSolidAt(wx - r, wy - r)) return false;
  if (W.World.isSolidAt(wx + r, wy - r)) return false;
  if (W.World.isSolidAt(wx - r, wy + r)) return false;
  if (W.World.isSolidAt(wx + r, wy + r)) return false;
  if (W.Res.blocksAt(wx, wy, r)) return false;
  if (W.Build.blocksAt(wx, wy, r)) return false;
  return true;
}

/* 高速翻滾拆成短距離步進，避免低幀率時穿過岩壁或大型素材。 */
function moveSafe(p, dx, dy) {
  var dist = Math.sqrt(dx * dx + dy * dy), steps = Math.max(1, Math.ceil(dist / 10));
  var sx = dx / steps, sy = dy / steps, i, nx, ny;
  p.blocked = false;
  for (i = 0; i < steps; i++) {
    nx = p.wx + sx; ny = p.wy + sy;
    if (canStand(nx, p.wy)) p.wx = nx; else if (sx !== 0) p.blocked = true;
    if (canStand(p.wx, ny)) p.wy = ny; else if (sy !== 0) p.blocked = true;
    if (p.blocked) break;
  }
}

W.Player = {
  blocked: false,
  cd: 0,
  atkCd: 0,
  homeWx: 0,
  homeWy: 0,
  wx: W.CFG.START_WX,
  wy: W.CFG.START_WY,
  faceX: 0,
  faceY: 1,
  moving: false,
  rollT: 0,
  rollCd: 0,
  rollX: 0,
  rollY: 1,
  rollPerfect: false,
  perfectT: 0,
  perfectDodges: 0,
  lastAttackDmg: W.CFG.ATTACK_DMG,

  update: function(dt) {
    if (this.cd > 0) this.cd -= dt;
    if (this.atkCd > 0) this.atkCd -= dt;
    if (this.rollCd > 0) this.rollCd = Math.max(0, this.rollCd - dt);
    if (this.perfectT > 0) this.perfectT = Math.max(0, this.perfectT - dt);
    W.Res.updateNear(this.wx, this.wy, Date.now());
    W.Build.updateNear(this.wx, this.wy);

    var mx = W.Input.getX();
    var my = W.Input.getY();

    if (this.rollT > 0) {
      this.rollT = Math.max(0, this.rollT - dt);
      this.moving = true;
      var rollMul = W.BondMate && W.BondMate.rollSpeedMultiplier ? W.BondMate.rollSpeedMultiplier() : 1;
      moveSafe(this, this.rollX * 430 * rollMul * dt, this.rollY * 430 * rollMul * dt);
    } else {
      this.moving = (mx !== 0 || my !== 0);

      if (this.moving) {
        this.faceX = mx;
        this.faceY = my;

        var moveMult = (W.DivineArms && W.DivineArms.speedMultiplier) ? W.DivineArms.speedMultiplier() : 1;
        if (W.LaopiLife && W.LaopiLife.movementMultiplier) moveMult *= W.LaopiLife.movementMultiplier();
        var step = W.CFG.PLAYER_SPEED * moveMult * dt;

        moveSafe(this, mx * step, my * step);
      }
    }

    var r = W.CFG.PLAYER_RADIUS;
    var max = W.CFG.WORLD_SIZE - r;
    if (this.wx < r)   this.wx = r;
    if (this.wy < r)   this.wy = r;
    if (this.wx > max) this.wx = max;
    if (this.wy > max) this.wy = max;
  },

  spawn: function() {
    var now = Date.now();
    var s = W.World.findSpawn(this.wx, this.wy, function(x, y) {
      if (W.World.isSolidAt(x, y)) return false;
      W.Res.updateNear(x, y, now);
      return !W.Res.blocksAt(x, y, W.CFG.PLAYER_RADIUS * 0.72);
    });
    if (s) { this.wx = s.wx; this.wy = s.wy; }
    if (!this.homeWx) { this.homeWx = this.wx; this.homeWy = this.wy; }
    W.Res.updateNear(this.wx, this.wy, now);
  },

  attack: function() {
    if (this.atkCd > 0) return null;
    if (!W.Stats.spend(W.CFG.ATTACK_COST)) return 'tired';
    this.atkCd = W.CFG.ATTACK_COOLDOWN;
    this.lastAttackDmg = W.CFG.ATTACK_DMG + W.Craft.attackBonus() + (this.perfectT > 0 ? 18 : 0)
      + (W.BondMate && W.BondMate.attackDamageBonus ? W.BondMate.attackDamageBonus() : 0);
    this.perfectT = 0;
    return W.Mobs.attack(this.wx, this.wy, this.faceX, this.faceY, this.lastAttackDmg, this.attackRange());
  },

  /* 28 體力、0.28 秒無敵、0.78 秒共用冷卻。移動方向優先，靜止時朝面向翻滾。 */
  roll: function() {
    if (W.Stats.isDead()) return 'dead';
    if (this.rollT > 0 || this.rollCd > 0) return 'cooldown';
    if (!W.Stats.spend(28)) return 'tired';
    var x = W.Input.getX(), y = W.Input.getY(), len;
    if (x === 0 && y === 0) { x = this.faceX; y = this.faceY; }
    len = Math.sqrt(x * x + y * y) || 1;
    this.rollX = x / len; this.rollY = y / len;
    this.faceX = this.rollX; this.faceY = this.rollY;
    this.rollT = 0.28; this.rollCd = 0.78;
    this.rollPerfect = false;
    return true;
  },

  evadeDamage: function(amount) {
    if (!this.isRolling() || this.rollPerfect || this.rollT < 0.12) return false;
    this.rollPerfect = true; this.perfectT = 2.5; this.perfectDodges++;
    if (W.Stats && W.Stats.addStam) W.Stats.addStam(12);
    if (W.Game && W.Game.onPerfectDodge) W.Game.onPerfectDodge({amount:amount,wx:this.wx,wy:this.wy});
    return true;
  },

  isRolling: function() { return this.rollT > 0; },
  rollCooldown: function() { return Math.max(0, this.rollCd); },
  perfectReady: function() { return this.perfectT > 0; },
  lastAttackDamage: function() { return this.lastAttackDmg || (W.CFG.ATTACK_DMG + W.Craft.attackBonus()); },
  attackRange: function() {
    return W.CFG.ATTACK_RANGE + (W.BondMate && W.BondMate.attackRangeBonus ? W.BondMate.attackRangeBonus() : 0);
  },

  goHome: function() {
    this.wx = this.homeWx || W.CFG.START_WX;
    this.wy = this.homeWy || W.CFG.START_WY;
  },

  harvest: function(now) {
    if (this.cd > 0) return null;
    var nd = W.Res.findTarget(this.wx, this.wy, this.faceX, this.faceY);
    if (!nd) return null;
    this.cd = W.CFG.HARVEST_COOLDOWN;
    return W.Res.harvest(nd, now);
  },

  terrain: function() { return W.World.tileAt(this.wx, this.wy); },

  chunkX: function() { return Math.floor(this.wx / W.CFG.CHUNK_SIZE); },
  chunkY: function() { return Math.floor(this.wy / W.CFG.CHUNK_SIZE); }
};
