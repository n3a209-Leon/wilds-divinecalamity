window.W = window.W || {};

/* 合成系統。裝備狀態 gear 屬於必須存檔的資料類型，
   新增欄位時務必同步 save.js 的 collect / apply / migrate 三處。 */
W.Craft = (function() {

  var gear = { axe: false, pick: false, bow: false, maxe: false, mpick: false };

  /* kind: tool = 取得裝備；place = 放置建造物；item = 產出物品
     need: 需要站在某種建造物旁（null 代表隨處可做） */
  var RECIPES = [
    { id: 'axe',  name: '\u77f3\u65a7',   icon: '\uD83E\uDE93', kind: 'tool',  cost: { wood: 3, stone: 2, fiber: 2 }, desc: '\u4f10\u6728\u7522\u91cf\uff0b2\uff0c\u653b\u64ca\uff0b7' },
    { id: 'bow',   name: '\u6728\u5f13', icon: '\uD83C\uDFF9', kind: 'tool', cost: { wood: 4, fiber: 4 }, desc: '\u81ea\u52d5\u7784\u6e96\u9060\u7a0b\u5c04\u64ca' },
    { id: 'arrow', name: '\u7bad\u77e2', icon: '\u27A4', kind: 'item', give: { arrow: 4 }, cost: { wood: 2, flint: 1 }, desc: '\u5f13\u7684\u5f48\u85e5\uFF0C\u4e00\u6b21\u505a 4 \u652f' },
    { id: 'pick', name: '\u77f3\u93ac',   icon: '\u26CF\uFE0F', kind: 'tool',  cost: { wood: 3, stone: 3, flint: 1 }, desc: '\u63a1\u77f3\u7522\u91cf\uff0b2' },
    { id: 'fire', name: '\u71df\u706b',   icon: '\uD83D\uDD25', kind: 'place', place: 0, cost: { wood: 5, stone: 3 }, desc: '\u65c1\u908a\u53ef\u4ee5\u70e4\u8089' },
    { id: 'fence', name: '\u6805\u6b04', icon: '\uD83D\uDEA7', kind: 'place', place: 6, cost: { wood: 2 }, desc: '\u4fbf\u5b9c\u7684\u963b\u64cb\uff0c\u9069\u5408\u570d\u57fa\u5730' },
    { id: 'rack',  name: '\u66ec\u8089\u67b6', icon: '\uD83C\uDF56', kind: 'place', place: 7, cost: { wood: 5, fiber: 3 }, desc: '\u65c1\u908a\u53ef\u4ee5\u505a\u8089\u4e7e' },
    { id: 'jerky', name: '\u8089\u4e7e', icon: '\uD83E\uDD53', kind: 'item', give: { jerky: 1 }, cost: { meat: 2 }, need: 7, desc: '\u9700\u8981\u66ec\u8089\u67b6\uff1b\u8010\u98e2\u53c8\u56de\u7cbe\u795e' },
    { id: 'wall', name: '\u6728\u7246',   icon: '\uD83E\uDDF1', kind: 'place', place: 1, cost: { wood: 4 }, desc: '\u963b\u64cb\u72fc\u7fa4' },
    { id: 'bed',  name: '\u7761\u888b',   icon: '\uD83D\uDECF\uFE0F', kind: 'place', place: 2, cost: { fiber: 8, hide: 3 }, desc: '\u91cd\u65b0\u8a2d\u5b9a\u71df\u5730' },
    { id: 'bench',   name: '\u5de5\u4f5c\u53f0', icon: '\uD83D\uDEE0\uFE0F', kind: 'place', place: 4, cost: { wood: 8, stone: 2 }, desc: '\u91d1\u5c6c\u5de5\u5177\u7684\u524d\u7f6e\u5efa\u7bc9' },
    { id: 'store',   name: '\u5132\u7269\u7bb1', icon: '\uD83D\uDDC3\uFE0F', kind: 'place', place: 5, cost: { wood: 6, fiber: 2 }, desc: '\u5b58\u653e\u80cc\u4e0d\u4e0b\u7684\u6771\u897f' },
    { id: 'furnace', name: '\u7194\u7210', icon: '\uD83C\uDFED', kind: 'place', place: 3, cost: { stone: 12, wood: 4 }, desc: '\u65c1\u908a\u53ef\u4ee5\u7194\u7149\u91d1\u5c6c' },
    { id: 'metal', name: '\u7194\u7149\u91d1\u5c6c', icon: '\uD83D\uDD29', kind: 'item', give: { metal: 1 }, cost: { stone: 4, flint: 2, wood: 2 }, need: 3, desc: '\u9700\u8981\u7ad9\u5728\u7194\u7210\u65c1' },
    { id: 'maxe',  name: '\u91d1\u5c6c\u65a7', icon: '\uD83E\uDE93', kind: 'tool', cost: { metal: 2, wood: 2 }, needGear: 'axe', need: 4, desc: '\u4f10\u6728\uff0b4\uff0c\u653b\u64ca\uff0b14\uff08\u9700\u5148\u6709\u77f3\u65a7\uff09' },
    { id: 'mpick', name: '\u91d1\u5c6c\u93ac', icon: '\u26CF\uFE0F', kind: 'tool', cost: { metal: 2, wood: 2 }, needGear: 'pick', need: 4, desc: '\u63a1\u77f3\uff0b4\uff08\u9700\u5148\u6709\u77f3\u93ac\uff09' },
    { id: 'soup',  name: '\u8611\u83c7\u6e6f', icon: '\uD83C\uDF72', kind: 'item', give: { soup: 1 }, cost: { mushroom: 2, berry: 1 }, need: 0, desc: '\u9700\u8981\u71df\u706b\uff1b\u5403\u4e86\u5927\u5e45\u56de\u5fa9' },
    { id: 'cook', name: '\u70e4\u8089',   icon: '\uD83C\uDF57', kind: 'item',  give: { cooked: 1 }, cost: { meat: 1 }, need: 0, desc: '\u9700\u8981\u7ad9\u5728\u71df\u706b\u65c1' }
  ];

  function list() { return RECIPES; }

  function canAfford(r) {
    var k;
    for (k in r.cost) {
      if (!r.cost.hasOwnProperty(k)) continue;
      if (W.Inv.count(k) < r.cost[k]) return false;
    }
    return true;
  }

  function costText(r) {
    var k, out = '';
    for (k in r.cost) {
      if (!r.cost.hasOwnProperty(k)) continue;
      if (out) out += '\u3001';
      out += W.Inv.label(k) + ' ' + r.cost[k];
    }
    return out;
  }

  function pay(r) {
    var k;
    for (k in r.cost) {
      if (!r.cost.hasOwnProperty(k)) continue;
      W.Inv.take(k, r.cost[k]);
    }
  }

  function byId(id) {
    var i;
    for (i = 0; i < RECIPES.length; i++) if (RECIPES[i].id === id) return RECIPES[i];
    return null;
  }

  /* 回傳字串代表失敗原因，回傳 true 代表成功 */
  function make(id) {
    var r = byId(id);
    if (!r) return '\u627e\u4e0d\u5230\u914d\u65b9';
    if (!canAfford(r)) return '\u6750\u6599\u4e0d\u8db3';

    if (r.need !== undefined && r.need !== null) {
      if (!W.Build.nearType(W.Player.wx, W.Player.wy, r.need, W.CFG.FIRE_RANGE)) {
        return '\u9700\u8981\u9760\u8fd1' + W.Build.nameOf(r.need);
      }
    }

    if (r.kind === 'tool') {
      if (gear[r.id]) return '\u5df2\u7d93\u64c1\u6709\u4e86';
      if (r.needGear && !gear[r.needGear]) return '\u9700\u8981\u5148\u88fd\u4f5c\u524d\u7f6e\u5de5\u5177';
      pay(r);
      gear[r.id] = true;
      return true;
    }

    if (r.kind === 'place') {
      var wx = W.Player.wx + W.Player.faceX * W.CFG.PLACE_DIST;
      var wy = W.Player.wy + W.Player.faceY * W.CFG.PLACE_DIST;
      if (!W.Build.canPlace(wx, wy)) return '\u9019\u88e1\u653e\u4e0d\u4e0b';
      pay(r);
      W.Build.add(r.place, wx, wy);
      W.Build.updateNear(W.Player.wx, W.Player.wy);
      if (r.place === W.Build.TYPE.BED) {
        W.Player.homeWx = wx;
        W.Player.homeWy = wy;
      }
      return true;
    }

    if (r.kind === 'item') {
      pay(r);
      var k;
      for (k in r.give) {
        if (!r.give.hasOwnProperty(k)) continue;
        W.Inv.add(k, r.give[k]);
      }
      return true;
    }

    return '\u672a\u77e5\u914d\u65b9\u985e\u578b';
  }

  function has(id) { return !!gear[id]; }

  function attackBonus() {
    if (gear.maxe) return W.CFG.METAL_ATK_BONUS;
    return gear.axe ? W.CFG.AXE_ATK_BONUS : 0;
  }

  function yieldBonus(resType) {
    if (resType === 0) {
      if (gear.maxe) return W.CFG.METAL_YIELD_BONUS;
      if (gear.axe) return W.CFG.TOOL_YIELD_BONUS;
    }
    if (resType === 1) {
      if (gear.mpick) return W.CFG.METAL_YIELD_BONUS;
      if (gear.pick) return W.CFG.TOOL_YIELD_BONUS;
    }
    return 0;
  }

  function exportData() {
    return { axe: !!gear.axe, pick: !!gear.pick, bow: !!gear.bow, maxe: !!gear.maxe, mpick: !!gear.mpick };
  }

  function importData(o) {
    gear.axe = !!(o && o.axe);
    gear.pick = !!(o && o.pick);
    gear.bow = !!(o && o.bow);
    gear.maxe = !!(o && o.maxe);
    gear.mpick = !!(o && o.mpick);
  }

  function clear() {
    gear.axe = false;
    gear.pick = false;
    gear.bow = false;
    gear.maxe = false;
    gear.mpick = false;
  }

  return {
    list: list,
    make: make,
    has: has,
    canAfford: canAfford,
    costText: costText,
    attackBonus: attackBonus,
    yieldBonus: yieldBonus,
    exportData: exportData,
    importData: importData,
    clear: clear
  };
})();
