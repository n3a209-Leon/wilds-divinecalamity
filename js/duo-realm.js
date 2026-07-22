window.W = window.W || {};

/* Phase 24 哇塞秘境：每座入口決定性抽取三間房，仍保留 v53 的安全離開／深入抉擇。
   關卡中途狀態不寫入存檔；只有真正完成後才標記 Sites.looted。 */
W.DuoRealm = (function() {
  var PHASE_NAME = {
    sniff: '老皮正在嗅出這次不一樣的路線',
    bridge: '伸縮機關：走到裂隙前讓老皮變成橋',
    bridge_anim: '老皮伸長身體搭起通道',
    spring: '彈力機關：走到高台前讓老皮變成彈簧',
    spring_anim: '抓穩！老皮準備把你彈上去',
    key: '古老石門：靠近後讓老皮伸手解鎖',
    key_anim: '老皮的手指正鑽進古老機關',
    dark: '黑暗嗅聞：跟著老皮留下的氣味走',
    dark_anim: '老皮確認了黑暗中的安全腳步',
    defend: '雙人守點：老皮撐住石門，保護他清掉守衛',
    treasure: '稀有房間：老皮聞到了不屬於這裡的香味',
    treasure_anim: '老皮從牆縫裡拉出了共鳴藏寶',
    fight: '雙人戰鬥：擊退秘境守衛',
    choice: '寶藏抉擇：安全離開，或帶著預兆繼續深入',
    fight2: '共鳴挑戰：撐過最後一波守衛'
  };
  var ICON = { bridge: '🌉', spring: '🌀', key: '🔑', dark: '👃', defend: '🛡️', treasure: '🥪' };
  var ROOM_POOL = ['bridge', 'spring', 'key', 'dark', 'defend'];
  var OMENS = [
    { id: 'howl', name: '狼群回音', desc: '深層守衛數量增加，戰利品也更豐富' },
    { id: 'heavy', name: '沉重腳步', desc: '深層出現強壯巨獸，但老皮能提前標出位置' },
    { id: 'hunger', name: '飢餓詛咒', desc: '深入時消耗少量飽食，換取額外秘境獎勵' }
  ];
  var active = false, site = null, key = '', phase = 'idle', phaseT = 0;
  var cx = 0, cy = 0, ox = 0, oy = 0, tx = 0, ty = 0, dirX = 1, dirY = 0;
  var spawned = 0, waveSeen = false, pulse = 0, roomIndex = 0, rareBonus = 0;
  var roomPlan = [], currentRoom = '', rareRoom = false, omen = OMENS[0];
  var _state = {
    active:false, phase:'idle', name:'', hint:'', icon:'', interactable:false, choice:false,
    combat:false, dark:false, distance:0, objectiveWx:0, objectiveWy:0,
    room:'', roomIndex:0, roomCount:3, rare:false, omen:'', omenDesc:'', plan:roomPlan
  };
  var _screen = { sx: 0, sy: 0 };

  function walkable(x, y) {
    return x > 48 && y > 48 && x < W.CFG.WORLD_SIZE - 48 && y < W.CFG.WORLD_SIZE - 48 &&
      !W.World.isSolidAt(x, y);
  }

  function safePoint(distance, turn) {
    var base = Math.atan2(dirY, dirX) + turn;
    var i, a, x, y;
    for (i = 0; i < 8; i++) {
      a = base + i * Math.PI / 4;
      x = cx + Math.cos(a) * distance; y = cy + Math.sin(a) * distance;
      if (walkable(x, y)) { tx = x; ty = y; return; }
    }
    tx = cx; ty = cy;
  }

  function setObjective(distance, turn) {
    safePoint(distance, turn);
    ox = tx; oy = ty;
  }

  function setPhase(next, duration) {
    phase = next; phaseT = Math.max(0, duration || 0);
    if (W.Game && W.Game.onDuoRealmPhase) W.Game.onDuoRealmPhase(next, PHASE_NAME[next] || '');
  }

  function buildPlan(s) {
    var seed = Math.abs(Math.floor(Number(s.seed) || 0));
    var start = (seed + 2) % ROOM_POOL.length, i;
    roomPlan.length = 0;
    for (i = 0; i < 3; i++) roomPlan.push(ROOM_POOL[(start + i) % ROOM_POOL.length]);
    rareRoom = !!(W.LaopiLife && W.LaopiLife.consumeRareRealm && W.LaopiLife.consumeRareRealm());
    if (rareRoom) roomPlan[2] = 'treasure';
    omen = OMENS[(seed + (s.type || 0) * 2) % OMENS.length];
  }

  function begin(s) {
    if (active || !s || (W.Sites && W.Sites.isLooted(s))) return false;
    site = s; active = true; key = 'realm:' + s.k; cx = s.wx; cy = s.wy;
    var ang = W.Rng.hash2i(s.seed, 53, W.CFG.SEED + 953) * Math.PI * 2;
    dirX = Math.cos(ang); dirY = Math.sin(ang);
    spawned = 0; waveSeen = false; pulse = 0; roomIndex = 0; rareBonus = 0; currentRoom = '';
    buildPlan(s); ox = cx; oy = cy;
    setPhase('sniff', 1.35);
    if (W.BondMate && W.BondMate.performTransform) W.BondMate.performTransform('sniff', cx - dirX * 34, cy - dirY * 34, 1.35);
    if (W.Game && W.Game.onDuoRealmStart) W.Game.onDuoRealmStart(s, roomPlan, omen);
    return true;
  }

  function spawnOne(type, angle, distance, strong) {
    var i, a, x, y;
    for (i = 0; i < 8; i++) {
      a = angle + i * Math.PI / 4;
      x = W.Player.wx + Math.cos(a) * distance; y = W.Player.wy + Math.sin(a) * distance;
      if (W.Mobs.spawnChallenge(key, x, y, type, strong)) { spawned++; return true; }
    }
    return false;
  }

  function spawnWave(strong, roomFight) {
    if (!W.Mobs || !W.Mobs.spawnChallenge) return 0;
    if (W.Mobs.clearChallenge) W.Mobs.clearChallenge(key);
    spawned = 0;
    var T = W.Mobs.TYPE, seedAng = Math.atan2(dirY, dirX);
    if (roomFight) {
      spawnOne(T.BOAR, seedAng, 106, false);
      spawnOne(T.WOLF, seedAng + 2.4, 118, false);
    } else if (strong) {
      spawnOne(T.BEAR, seedAng, 128, true);
      spawnOne(T.WOLF, seedAng + 2.1, 112, true);
      spawnOne(T.WOLF, seedAng + 4.2, 112, true);
      if (omen.id === 'howl') spawnOne(T.WOLF, seedAng + 5.2, 138, true);
      if (omen.id === 'heavy') spawnOne(T.BOAR, seedAng + 3.15, 142, true);
    } else {
      spawnOne(T.WOLF, seedAng, 118, false);
      spawnOne(T.BOAR, seedAng + 2.1, 108, false);
      spawnOne(T.WOLF, seedAng + 4.2, 118, false);
    }
    waveSeen = spawned > 0;
    return spawned;
  }

  function startRoom() {
    if (roomIndex >= roomPlan.length) {
      currentRoom = 'fight'; setPhase('fight', 0); spawnWave(false, false);
      if (!waveSeen) setPhase('choice', 0);
      return;
    }
    currentRoom = roomPlan[roomIndex];
    if (currentRoom === 'bridge') {
      setObjective(82, 0); setPhase('bridge', 0); safePoint(178, 0);
    } else if (currentRoom === 'spring') {
      setObjective(58, Math.PI * 0.5); setPhase('spring', 0); safePoint(145, Math.PI * 0.5);
    } else if (currentRoom === 'key') {
      setObjective(62, Math.PI); setPhase('key', 0);
    } else if (currentRoom === 'dark') {
      setObjective(112, site && site.type ? Math.PI * 0.72 : -Math.PI * 0.72); setPhase('dark', 0);
      if (W.BondMate) W.BondMate.performTransform('sniff', cx - dirX * 28, cy - dirY * 28, 1.1);
    } else if (currentRoom === 'defend') {
      ox = cx + dirX * 28; oy = cy + dirY * 28; setPhase('defend', 0); spawnWave(false, true);
      if (!waveSeen) advanceRoom();
    } else if (currentRoom === 'treasure') {
      setObjective(74, -Math.PI * 0.5); setPhase('treasure', 0);
    }
  }

  function advanceRoom() { roomIndex++; startRoom(); }

  function finish(brave) {
    var rewardTier = (brave ? 2 : 1) + rareBonus;
    var loot = W.Sites && W.Sites.loot ? W.Sites.loot(site, rewardTier) : null;
    if (W.Mobs && W.Mobs.clearChallenge) W.Mobs.clearChallenge(key);
    if (W.BondMate && W.BondMate.noteRealmComplete) W.BondMate.noteRealmComplete(!!brave);
    if (W.LaopiLife && W.LaopiLife.noteRealmComplete) W.LaopiLife.noteRealmComplete(!!brave, rareBonus > 0, omen.id);
    active = false; phase = 'idle'; phaseT = 0;
    if (W.Game && W.Game.onDuoRealmComplete) W.Game.onDuoRealmComplete(loot, !!brave, rareBonus > 0, omen);
    site = null; key = ''; spawned = 0; waveSeen = false; currentRoom = '';
    return loot;
  }

  function choose(brave) {
    if (!active || phase !== 'choice') return false;
    if (W.LaopiLife && W.LaopiLife.noteRealmChoice) W.LaopiLife.noteRealmChoice(!!brave);
    if (!brave) { finish(false); return true; }
    if (omen.id === 'hunger' && W.Stats) W.Stats.eat(-8, 0);
    setPhase('fight2', 0); spawnWave(true, false);
    if (!waveSeen) finish(true);
    return true;
  }

  function interactable() {
    if (!active || ['bridge', 'spring', 'key', 'dark', 'treasure'].indexOf(phase) < 0) return false;
    var dx = W.Player.wx - ox, dy = W.Player.wy - oy;
    return dx * dx + dy * dy <= 68 * 68;
  }

  function tryAction() {
    if (!interactable()) return false;
    if (phase === 'bridge') {
      setPhase('bridge_anim', 1.15);
      if (W.BondMate) W.BondMate.performTransform('bridge', (W.Player.wx + tx) * 0.5, (W.Player.wy + ty) * 0.5, 1.15);
    } else if (phase === 'spring') {
      setPhase('spring_anim', 0.95);
      if (W.BondMate) W.BondMate.performTransform('spring', ox, oy, 0.95);
    } else if (phase === 'key') {
      setPhase('key_anim', 1.05);
      if (W.BondMate) W.BondMate.performTransform('sniff', ox, oy, 1.05);
    } else if (phase === 'dark') {
      setPhase('dark_anim', 1.05);
      if (W.BondMate) W.BondMate.performTransform('sniff', ox, oy, 1.05);
    } else if (phase === 'treasure') {
      setPhase('treasure_anim', 0.95); rareBonus = 1;
      if (W.BondMate) W.BondMate.performTransform('spring', ox, oy, 0.95);
    }
    return true;
  }

  function abort(reason) {
    if (!active) return;
    if (W.Mobs && W.Mobs.clearChallenge) W.Mobs.clearChallenge(key);
    active = false; phase = 'idle'; site = null; key = ''; spawned = 0; waveSeen = false; currentRoom = '';
    if (W.Game && W.Game.onDuoRealmAbort) W.Game.onDuoRealmAbort(reason || '你離開了秘境，機關已重置');
  }

  function clear() {
    if (W.Mobs && W.Mobs.clearChallenge && key) W.Mobs.clearChallenge(key);
    active = false; site = null; key = ''; phase = 'idle'; phaseT = 0; spawned = 0; waveSeen = false;
    currentRoom = ''; roomPlan.length = 0; rareBonus = 0; rareRoom = false;
  }

  function update(dt) {
    if (!active) return;
    pulse += dt;
    var dx = W.Player.wx - cx, dy = W.Player.wy - cy;
    if (W.Stats && W.Stats.isDead && W.Stats.isDead()) { abort('老皮先把你帶離秘境，機關已重置'); return; }
    if (dx * dx + dy * dy > 620 * 620) { abort('你離開太遠，哇塞秘境已重置'); return; }
    if (phaseT > 0) phaseT = Math.max(0, phaseT - dt);

    if (phase === 'sniff' && phaseT <= 0) {
      startRoom();
    } else if (phase === 'bridge_anim' && phaseT <= 0) {
      if (walkable(tx, ty)) { W.Player.wx = tx; W.Player.wy = ty; }
      advanceRoom();
    } else if (phase === 'spring_anim' && phaseT <= 0) {
      if (walkable(tx, ty)) { W.Player.wx = tx; W.Player.wy = ty; }
      advanceRoom();
    } else if ((phase === 'key_anim' || phase === 'dark_anim' || phase === 'treasure_anim') && phaseT <= 0) {
      advanceRoom();
    } else if (phase === 'defend' && waveSeen && W.Mobs.challengeAlive(key) <= 0) {
      waveSeen = false; advanceRoom();
    } else if ((phase === 'fight' || phase === 'fight2') && waveSeen && W.Mobs.challengeAlive(key) <= 0) {
      waveSeen = false;
      if (phase === 'fight2') finish(true);
      else setPhase('choice', 0);
    }
  }

  function state() {
    var dx = active ? W.Player.wx - ox : 0, dy = active ? W.Player.wy - oy : 0;
    _state.active = active; _state.phase = phase;
    _state.name = site && W.Sites && W.Sites.NAMES ? W.Sites.NAMES[site.type] : '哇塞秘境';
    _state.hint = PHASE_NAME[phase] || '';
    _state.icon = ICON[phase] || ((phase === 'fight' || phase === 'fight2') ? '⚔️' : (phase === 'defend' ? '🛡️' : '🐾'));
    _state.interactable = interactable(); _state.choice = phase === 'choice';
    _state.combat = phase === 'fight' || phase === 'fight2' || phase === 'defend';
    _state.dark = phase === 'dark' || phase === 'dark_anim';
    _state.distance = Math.sqrt(dx * dx + dy * dy);
    _state.objectiveWx = ox; _state.objectiveWy = oy;
    _state.room = currentRoom; _state.roomIndex = Math.min(3, roomIndex + 1); _state.roomCount = 3;
    _state.rare = rareRoom; _state.omen = omen.name; _state.omenDesc = omen.desc; _state.plan = roomPlan;
    return _state;
  }

  function draw(ctx) {
    if (!active || !ctx) return;
    var z = W.Camera.zoom, a = 0.48 + Math.sin(pulse * 4) * 0.12, i, px, py;
    W.Camera.worldToScreenInto(cx, cy, _screen);
    ctx.save();
    ctx.strokeStyle = rareRoom ? 'rgba(220,160,255,' + a + ')' : 'rgba(255,215,105,' + a + ')';
    ctx.lineWidth = 3 * z; ctx.setLineDash([10*z, 7*z]);
    ctx.beginPath(); ctx.ellipse(_screen.sx, _screen.sy + 8*z, 178*z, 94*z, 0, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    if (interactable()) {
      W.Camera.worldToScreenInto(ox, oy, _screen);
      ctx.fillStyle = 'rgba(255,226,115,0.16)'; ctx.strokeStyle = 'rgba(255,239,174,0.95)'; ctx.lineWidth = 3*z;
      ctx.beginPath(); ctx.arc(_screen.sx, _screen.sy, (25 + Math.sin(pulse*5)*3)*z, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.font = Math.max(20, 28*z) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff3bd'; ctx.fillText(ICON[phase] || '🐾', _screen.sx, _screen.sy - 4*z);
    }
    if (phase === 'dark' || phase === 'dark_anim') {
      ctx.fillStyle = 'rgba(255,226,105,.7)';
      for (i = 1; i <= 4; i++) {
        px = W.Player.wx + (ox - W.Player.wx) * i / 5;
        py = W.Player.wy + (oy - W.Player.wy) * i / 5;
        W.Camera.worldToScreenInto(px, py, _screen);
        ctx.beginPath(); ctx.ellipse(_screen.sx, _screen.sy, 5*z, 3*z, i*.7, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawOverlay(ctx) {
    if (!active || !ctx || (phase !== 'dark' && phase !== 'dark_anim')) return;
    var g;
    W.Camera.worldToScreenInto(W.Player.wx, W.Player.wy, _screen);
    ctx.save();
    g = ctx.createRadialGradient(_screen.sx, _screen.sy, 45, _screen.sx, _screen.sy, 235);
    g.addColorStop(0, 'rgba(3,5,8,0)'); g.addColorStop(0.38, 'rgba(3,5,8,.12)'); g.addColorStop(1, 'rgba(3,5,8,.78)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W.Camera.vw, W.Camera.vh);
    ctx.restore();
  }

  return {
    begin: begin, update: update, draw: draw, drawOverlay: drawOverlay, state: state,
    tryAction: tryAction, choose: choose, abort: abort, clear: clear,
    isActive: function() { return active; }, interactable: interactable
  };
})();
