window.W = window.W || {};

/* 背包：Phase 3 僅存於記憶體，Phase 5 才接存檔。 */
W.Inv = (function() {

  var ORDER = ['wood', 'stone', 'fiber', 'berry', 'flint', 'meat', 'hide', 'cooked', 'arrow', 'mushroom', 'metal', 'soup', 'jerky'];
  var LABEL = { wood: '木材', stone: '石頭', fiber: '纖維', berry: '漿果', flint: '燧石', meat: '生肉', hide: '毛皮', cooked: '烤肉', arrow: '箭矢', mushroom: '夜光蘑菇', metal: '金屬錠', soup: '蘑菇湯', jerky: '肉乾' };
  var ICON  = { wood: '\uD83E\uDEB5', stone: '\uD83E\uDEA8', fiber: '\uD83C\uDF3F', berry: '\uD83E\uDED0', flint: '\u26CF\uFE0F', meat: '\uD83E\uDD69', hide: '\uD83D\uDFEB', cooked: '\uD83C\uDF57', arrow: '\u27A4', mushroom: '\uD83C\uDF44', metal: '\uD83D\uDD29', soup: '\uD83C\uDF72', jerky: '\uD83E\uDD53' };

  var items = { wood: 0, stone: 0, fiber: 0, berry: 0, flint: 0, meat: 0, hide: 0, cooked: 0, arrow: 0, mushroom: 0, metal: 0, soup: 0, jerky: 0 };

  function total() {
    var s = 0, i;
    for (i = 0; i < ORDER.length; i++) s += items[ORDER[i]];
    return s;
  }

  /* 有容量上限，回傳「實際加入的數量」。
     呼叫端要用回傳值判斷是否裝不下，不能假設一定加得進去。 */
  function add(id, n) {
    if (items[id] === undefined) return 0;
    if (n <= 0) return 0;
    var room = W.CFG.INV_CAP - total();
    if (room <= 0) return 0;
    if (n > room) n = room;
    items[id] += n;
    return n;
  }

  function isFull() { return total() >= W.CFG.INV_CAP; }

  function take(id, n) {
    if (!items[id] || items[id] < n) return false;
    items[id] -= n;
    return true;
  }

  function count(id) {
    return items[id] || 0;
  }

  var IMG = {
    wood: 'ui/wood', stone: 'ui/stone', fiber: 'ui/fiber', berry: 'ui/berry',
    flint: 'ui/flint', meat: 'ui/meat', hide: 'ui/hide', cooked: 'ui/cooked',
    arrow: 'ui/arrow', mushroom: 'ui/mushroom', metal: 'ui/metal', soup: 'ui/soup',
    jerky: 'ui/jerky'
  };

  /* 有圖就給圖片路徑，沒有的回傳空字串讓呼叫端退回 emoji */
  function img(id) {
    return IMG[id] ? (W.CFG.ART_DIR + IMG[id] + '.png') : '';
  }

  function label(id) { return LABEL[id] || id; }
  function icon(id)  { return ICON[id] || '\u2753'; }

  function summary() {
    var out = '', i, id;
    for (i = 0; i < ORDER.length; i++) {
      id = ORDER[i];
      out += ICON[id] + ' ' + LABEL[id] + ' \u00d7 ' + items[id] + '\n';
    }
    return out;
  }

  function exportData() {
    var o = {}, i, id;
    for (i = 0; i < ORDER.length; i++) { id = ORDER[i]; o[id] = items[id]; }
    return o;
  }

  function importData(o) {
    var i, id, v;
    if (!o) return;
    for (i = 0; i < ORDER.length; i++) {
      id = ORDER[i];
      v = o[id];
      items[id] = (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : 0;
    }
  }

  function clear() {
    var i;
    for (i = 0; i < ORDER.length; i++) items[ORDER[i]] = 0;
  }

  return {
    ORDER: ORDER,
    exportData: exportData,
    importData: importData,
    clear: clear,
    add: add,
    take: take,
    count: count,
    total: total,
    isFull: isFull,
    cap: function() { return W.CFG.INV_CAP; },
    label: label,
    icon: icon,
    img: img,
    summary: summary
  };
})();
