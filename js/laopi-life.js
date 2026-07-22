window.W = window.W || {};

/* Phase 24：老皮與荒野生活。
   這裡只保存「已發生的共同經歷」與三明治任務；即時變形、移動加成與待選面板均為暫態。 */
W.LaopiLife = (function() {
  var ING_BREAD = 1, ING_HERB = 2, ING_SAUCE = 4, ING_FILLING = 8, ING_ALL = 15;
  var STYLE = {
    brave: { name: '冒險狂搭檔', line: '老皮會先聞出深處的危險，也知道你八成還是會往前走。' },
    guardian: { name: '安心守護搭檔', line: '老皮更常站在你與危險中間，撤退也不再被當成失敗。' },
    sharing: { name: '三明治搭檔', line: '你們最擅長把荒野裡的一天，收進一頓好吃的東西裡。' },
    agile: { name: '彈力拍檔', line: '老皮已經抓到你的翻滾節奏，總能在下一拍接上攻勢。' }
  };
  var data = {};
  var pendingChoice = false, travelT = 0, rideT = 0, idleT = 0, wildCd = 0, pullCd = 0;
  var lastDaySeen = 1;
  var _status = {};

  function reset() {
    data = {
      ingredients: 0,
      cookActions: 0,
      nightGatherActions: 0,
      sandwichesMade: 0,
      lastSandwichDay: -1,
      boon: '',
      boonDay: -1,
      boonUsed: true,
      brave: 0,
      guardian: 0,
      sharing: 0,
      agile: 0,
      style: '',
      sharedMeals: 0,
      lastShareDay: -1,
      campMemories: 0,
      lastCampDay: -1,
      rareRooms: 0,
      wildTransforms: 0,
      dangerPulls: 0
    };
    pendingChoice = false; travelT = 0; rideT = 0; idleT = 0; wildCd = 0; pullCd = 0;
    lastDaySeen = dayNo();
  }

  function dayNo() { return W.Time && W.Time.dayNo ? W.Time.dayNo() : 1; }
  function emit(name, a, b) { if (W.Game && typeof W.Game[name] === 'function') W.Game[name](a, b); }
  function hasIngredient(bit) { return (data.ingredients & bit) !== 0; }

  function unlock(bit, label) {
    if (hasIngredient(bit)) return false;
    data.ingredients |= bit;
    emit('onSandwichIngredient', label, ingredientProgress());
    return true;
  }

  function styleForScores() {
    var keys = ['brave', 'guardian', 'sharing', 'agile'];
    var best = keys[0], i;
    for (i = 1; i < keys.length; i++) if (data[keys[i]] > data[best]) best = keys[i];
    return data[best] >= 6 ? best : '';
  }

  function maybeStyle() {
    var best = styleForScores(), cur = data.style;
    if (!best) return;
    if (!cur || (best !== cur && data[best] >= data[cur] + 4)) {
      data.style = best;
      emit('onBondChapter', STYLE[best].name, STYLE[best].line);
    }
  }

  function score(kind, amount) {
    if (!STYLE[kind]) return;
    data[kind] = Math.min(999999, data[kind] + Math.max(0, Math.floor(amount || 0)));
    maybeStyle();
  }

  function noteCook(recipeId) {
    if (recipeId !== 'cook' && recipeId !== 'soup' && recipeId !== 'jerky') return;
    data.cookActions++;
    if (data.cookActions >= 3) unlock(ING_BREAD, '特製麵包');
  }

  function noteHarvest(item) {
    if (!W.Time || !W.Time.isNight || !W.Time.isNight()) return;
    if (item !== 'mushroom' && item !== 'berry') return;
    data.nightGatherActions++;
    if (data.nightGatherActions >= 2) unlock(ING_HERB, '月光香草');
  }

  function noteRealmChoice(brave) { score(brave ? 'brave' : 'guardian', brave ? 2 : 2); }

  function noteRealmComplete(brave, rareRoom) {
    if (brave) unlock(ING_SAUCE, '秘境醬汁');
    if (rareRoom) { data.rareRooms++; score('brave', 1); }
  }

  function noteBossDown(calamity) {
    unlock(ING_FILLING, calamity ? '災禍傳說配料' : '首領傳說配料');
    score('brave', calamity ? 2 : 1);
  }

  function noteDodge() { score('agile', 1); }
  function noteGuard() { score('guardian', 1); }
  function noteRetreat() { score('guardian', 1); }
  function noteRescue() { score('guardian', 2); }

  function ingredientProgress() {
    var n = 0;
    if (hasIngredient(ING_BREAD)) n++;
    if (hasIngredient(ING_HERB)) n++;
    if (hasIngredient(ING_SAUCE)) n++;
    if (hasIngredient(ING_FILLING)) n++;
    return n;
  }

  function recipeText() {
    var parts = [
      (hasIngredient(ING_BREAD) ? '✓' : '○') + '麵包',
      (hasIngredient(ING_HERB) ? '✓' : '○') + '香草',
      (hasIngredient(ING_SAUCE) ? '✓' : '○') + '醬汁',
      (hasIngredient(ING_FILLING) ? '✓' : '○') + '傳說配料'
    ];
    if (data.lastSandwichDay === dayNo()) return '今天已和老皮做過一次 · ' + parts.join(' ');
    return '長期任務 ' + ingredientProgress() + '/4 · ' + parts.join(' ');
  }

  function sandwichReason() {
    if ((data.ingredients & ING_ALL) !== ING_ALL) return '終極三明治材料尚未找齊（' + ingredientProgress() + '/4）';
    if (data.lastSandwichDay === dayNo()) return '今天已經和老皮做過終極三明治了';
    return '';
  }

  function canMakeSandwich() { return sandwichReason() === ''; }

  function makeSandwich() {
    var reason = sandwichReason();
    if (reason) return reason;
    data.lastSandwichDay = dayNo();
    data.sandwichesMade++;
    pendingChoice = true;
    score('sharing', 3);
    emit('onSandwichReady');
    return true;
  }

  function chooseBoon(kind) {
    if (!pendingChoice || ['guard', 'suit', 'rescue', 'realm'].indexOf(kind) < 0) return false;
    pendingChoice = false;
    data.boon = kind; data.boonDay = dayNo(); data.boonUsed = false;
    if (W.Stats) { W.Stats.eat(35, 14); if (W.Stats.addSan) W.Stats.addSan(18); }
    if (kind === 'guard') {
      if (W.BondMate && W.BondMate.restoreGuard) W.BondMate.restoreGuard(100);
      data.boonUsed = true;
    }
    emit('onSandwichBoon', kind);
    return true;
  }

  function boonReady(kind) {
    return data.boon === kind && data.boonDay === dayNo() && !data.boonUsed;
  }

  function suitDuration(base) {
    if (!boonReady('suit')) return base;
    data.boonUsed = true;
    return base + 2;
  }

  function trySandwichRescue() {
    if (!boonReady('rescue')) return 0;
    data.boonUsed = true;
    noteRescue();
    return 0.48;
  }

  function consumeRareRealm() {
    if (!boonReady('realm')) return false;
    data.boonUsed = true;
    return true;
  }

  function guardCost(base) {
    return data.style === 'guardian' ? Math.max(1, base - 6) : base;
  }

  function dodgeSyncBonus() { return data.style === 'agile' ? 6 : 0; }

  function shareFood() {
    var nearCamp = W.Build && W.Build.nearType &&
      (W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.FIRE, W.CFG.SAN_FIRE_RANGE) ||
       W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.FURNACE, W.CFG.SAN_FIRE_RANGE) ||
       W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.BED, W.CFG.SLEEP_RANGE));
    if (!nearCamp) return '要在營火、熔爐或睡袋旁，才能坐下來和老皮分享';
    var food = '';
    if (W.Inv.take('cooked', 1)) food = '烤肉';
    else if (W.Inv.take('jerky', 1)) food = '肉乾';
    else if (W.Inv.take('berry', 1)) food = '漿果';
    if (!food) return '背包裡沒有適合分享的烤肉、肉乾或漿果';
    data.sharedMeals++; data.lastShareDay = dayNo();
    score('sharing', 2);
    if (W.BondMate && W.BondMate.restoreGuard) W.BondMate.restoreGuard(data.style === 'sharing' ? 38 : 26);
    if (W.Stats && W.Stats.addSan) W.Stats.addSan(8);
    emit('onSharedMeal', food);
    return true;
  }

  function onCampRest() {
    var day = dayNo();
    if (data.lastCampDay === day) return '';
    data.lastCampDay = day; data.campMemories++;
    var style = data.style;
    if (data.lastShareDay === day - 1 || data.lastShareDay === day) {
      return '老皮把最後一口留給你：「明天再去找更誇張的材料。」';
    }
    if (style === 'brave') return '老皮望著火光：「今天那條危險的路？我就知道你會選。」';
    if (style === 'guardian') return '老皮把身體捲成靠墊：「活著回來，就算很厲害的冒險。」';
    if (style === 'agile') return '老皮笑著重播你今天的翻滾，還故意把動作做得更誇張。';
    if (style === 'sharing') return '老皮已經開始認真規劃明天的三明治，表情比打首領還嚴肅。';
    return '老皮安靜地坐在營火旁，和你一起聽荒野慢慢睡著。';
  }

  function dangerNear() {
    var i, m, dx, dy;
    if (W.Mobs && W.Mobs.count) {
      for (i = 0; i < W.Mobs.count(); i++) {
        m = W.Mobs.at(i); if (!m || !m.alive) continue;
        dx = m.wx - W.Player.wx; dy = m.wy - W.Player.wy;
        if (dx * dx + dy * dy < 155 * 155) return true;
      }
    }
    m = W.Bosses && W.Bosses.nearest ? W.Bosses.nearest(W.Player.wx, W.Player.wy) : null;
    if (m) { dx = m.wx - W.Player.wx; dy = m.wy - W.Player.wy; if (dx * dx + dy * dy < 260 * 260) return true; }
    m = W.Calamity && W.Calamity.nearest ? W.Calamity.nearest(W.Player.wx, W.Player.wy) : null;
    if (m) { dx = m.wx - W.Player.wx; dy = m.wy - W.Player.wy; if (dx * dx + dy * dy < 340 * 340) return true; }
    return false;
  }

  function tryDangerPull(sourceWx, sourceWy) {
    if (pullCd > 0 || !W.Player || !isFinite(sourceWx) || !isFinite(sourceWy)) return false;
    var dx = W.Player.wx - sourceWx, dy = W.Player.wy - sourceWy, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = W.Player.wx + dx / len * 46, ny = W.Player.wy + dy / len * 46;
    nx = Math.max(24, Math.min(W.CFG.WORLD_SIZE - 24, nx));
    ny = Math.max(24, Math.min(W.CFG.WORLD_SIZE - 24, ny));
    if (W.World && W.World.isSolidAt && W.World.isSolidAt(nx, ny)) return false;
    W.Player.wx = nx; W.Player.wy = ny;
    pullCd = 18; data.dangerPulls++; data.wildTransforms++;
    score('guardian', 1);
    if (W.BondMate && W.BondMate.performTransform) W.BondMate.performTransform('pull', nx, ny, 0.7);
    emit('onWildTransform', 'pull');
    return true;
  }

  function update(dt) {
    if (!W.Player || !W.Stats || W.Stats.isDead()) return;
    var day = dayNo(), danger = dangerNear(), realm = W.DuoRealm && W.DuoRealm.isActive && W.DuoRealm.isActive();
    if (day !== lastDaySeen) { lastDaySeen = day; travelT = 0; idleT = 0; }
    if (wildCd > 0) wildCd = Math.max(0, wildCd - dt);
    if (pullCd > 0) pullCd = Math.max(0, pullCd - dt);
    if (rideT > 0) rideT = Math.max(0, rideT - dt);

    if (W.Player.moving && !danger && !realm) {
      travelT += dt; idleT = 0;
      if (travelT >= 3.2 && wildCd <= 0) {
        travelT = 0; rideT = 5.5; wildCd = 42; data.wildTransforms++;
        if (W.BondMate && W.BondMate.performTransform) W.BondMate.performTransform('ride', W.Player.wx, W.Player.wy, 0.9);
        emit('onWildTransform', 'ride');
      }
    } else {
      travelT = Math.max(0, travelT - dt * 2);
      if (!W.Player.moving && !danger && !realm) idleT += dt; else idleT = 0;
    }

    if (idleT >= 5 && wildCd <= 0 && W.Time && W.Time.isNight && W.Time.isNight()) {
      var nearWarmth = W.Build && W.Build.nearType &&
        (W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.FIRE, W.CFG.SAN_FIRE_RANGE) ||
         W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.FURNACE, W.CFG.SAN_FIRE_RANGE) ||
         W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.BED, W.CFG.SLEEP_RANGE));
      if (!nearWarmth) {
        idleT = 0; wildCd = 72; data.wildTransforms++;
        if (W.BondMate && W.BondMate.performTransform) W.BondMate.performTransform('shelter', W.Player.wx - 10, W.Player.wy + 4, 2.6);
        if (W.Stats.addSan) W.Stats.addSan(8);
        emit('onWildTransform', 'shelter');
      }
    }
  }

  function movementMultiplier() { return rideT > 0 ? 1.12 : 1; }

  function exportData() {
    return {
      ingredients: data.ingredients | 0, cookActions: data.cookActions | 0,
      nightGatherActions: data.nightGatherActions | 0, sandwichesMade: data.sandwichesMade | 0,
      lastSandwichDay: data.lastSandwichDay | 0, boon: data.boon || '', boonDay: data.boonDay | 0,
      boonUsed: !!data.boonUsed, brave: data.brave | 0, guardian: data.guardian | 0,
      sharing: data.sharing | 0, agile: data.agile | 0, style: data.style || '',
      sharedMeals: data.sharedMeals | 0, lastShareDay: data.lastShareDay | 0,
      campMemories: data.campMemories | 0, lastCampDay: data.lastCampDay | 0,
      rareRooms: data.rareRooms | 0, wildTransforms: data.wildTransforms | 0,
      dangerPulls: data.dangerPulls | 0
    };
  }

  function intAt(o, key, min, max, fallback) {
    var n = o && typeof o[key] === 'number' && isFinite(o[key]) ? Math.floor(o[key]) : fallback;
    return Math.max(min, Math.min(max, n));
  }

  function importData(o) {
    reset();
    if (!o || typeof o !== 'object') return;
    data.ingredients = intAt(o, 'ingredients', 0, ING_ALL, 0);
    data.cookActions = intAt(o, 'cookActions', 0, 999999, 0);
    data.nightGatherActions = intAt(o, 'nightGatherActions', 0, 999999, 0);
    data.sandwichesMade = intAt(o, 'sandwichesMade', 0, 999999, 0);
    data.lastSandwichDay = intAt(o, 'lastSandwichDay', -1, 999999, -1);
    data.boon = ['guard', 'suit', 'rescue', 'realm'].indexOf(o.boon) >= 0 ? o.boon : '';
    data.boonDay = intAt(o, 'boonDay', -1, 999999, -1); data.boonUsed = o.boonUsed !== false;
    data.brave = intAt(o, 'brave', 0, 999999, 0); data.guardian = intAt(o, 'guardian', 0, 999999, 0);
    data.sharing = intAt(o, 'sharing', 0, 999999, 0); data.agile = intAt(o, 'agile', 0, 999999, 0);
    data.style = STYLE[o.style] ? o.style : '';
    data.sharedMeals = intAt(o, 'sharedMeals', 0, 999999, 0);
    data.lastShareDay = intAt(o, 'lastShareDay', -1, 999999, -1);
    data.campMemories = intAt(o, 'campMemories', 0, 999999, 0);
    data.lastCampDay = intAt(o, 'lastCampDay', -1, 999999, -1);
    data.rareRooms = intAt(o, 'rareRooms', 0, 999999, 0);
    data.wildTransforms = intAt(o, 'wildTransforms', 0, 999999, 0);
    data.dangerPulls = intAt(o, 'dangerPulls', 0, 999999, 0);
    pendingChoice = false; lastDaySeen = dayNo();
  }

  function status() {
    _status.ingredients = data.ingredients; _status.ingredientCount = ingredientProgress();
    _status.ready = canMakeSandwich(); _status.pending = pendingChoice;
    _status.sandwichesMade = data.sandwichesMade; _status.lastSandwichDay = data.lastSandwichDay;
    _status.boon = data.boon; _status.boonReady = data.boonDay === dayNo() && !data.boonUsed;
    _status.style = data.style; _status.styleName = data.style ? STYLE[data.style].name : '還在一起摸索';
    _status.styleLine = data.style ? STYLE[data.style].line : '老皮正在記住你面對危險、食物與撤退時做出的選擇。';
    _status.sharedMeals = data.sharedMeals; _status.campMemories = data.campMemories;
    _status.rareRooms = data.rareRooms; _status.wildTransforms = data.wildTransforms; _status.dangerPulls = data.dangerPulls;
    return _status;
  }

  reset();
  return {
    update: update, movementMultiplier: movementMultiplier, tryDangerPull: tryDangerPull,
    noteCook: noteCook, noteHarvest: noteHarvest, noteRealmChoice: noteRealmChoice,
    noteRealmComplete: noteRealmComplete, noteBossDown: noteBossDown, noteDodge: noteDodge,
    noteGuard: noteGuard, noteRetreat: noteRetreat, noteRescue: noteRescue,
    shareFood: shareFood, onCampRest: onCampRest, guardCost: guardCost,
    dodgeSyncBonus: dodgeSyncBonus, suitDuration: suitDuration,
    trySandwichRescue: trySandwichRescue, consumeRareRealm: consumeRareRealm,
    recipeText: recipeText, sandwichReason: sandwichReason, canMakeSandwich: canMakeSandwich,
    makeSandwich: makeSandwich, chooseBoon: chooseBoon, status: status,
    exportData: exportData, importData: importData, clear: reset
  };
})();
