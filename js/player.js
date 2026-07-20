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

  update: function(dt) {
    if (this.cd > 0) this.cd -= dt;
    if (this.atkCd > 0) this.atkCd -= dt;
    W.Res.updateNear(this.wx, this.wy, Date.now());
    W.Build.updateNear(this.wx, this.wy);

    var mx = W.Input.getX();
    var my = W.Input.getY();

    this.moving = (mx !== 0 || my !== 0);

    if (this.moving) {
      this.faceX = mx;
      this.faceY = my;

      var moveMult = (W.DivineArms && W.DivineArms.speedMultiplier) ? W.DivineArms.speedMultiplier() : 1;
      var step = W.CFG.PLAYER_SPEED * moveMult * dt;
      var nx = this.wx + mx * step;
      var ny = this.wy + my * step;

      this.blocked = false;

      if (canStand(nx, this.wy)) { this.wx = nx; }
      else if (mx !== 0) { this.blocked = true; }

      if (canStand(this.wx, ny)) { this.wy = ny; }
      else if (my !== 0) { this.blocked = true; }
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
    return W.Mobs.attack(this.wx, this.wy, this.faceX, this.faceY, W.CFG.ATTACK_DMG + W.Craft.attackBonus());
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
