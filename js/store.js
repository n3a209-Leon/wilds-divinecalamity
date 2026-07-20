window.W = window.W || {};

/* 共用倉庫：所有儲物箱共用同一份庫存。
   這樣玩家不用記東西放在哪一箱，也不需要為每個箱子存一份資料。
   屬於必須存檔的資料類型，新增欄位時同步 save.js 的 collect / apply / migrate 三處。 */
W.Store = (function() {

  var items = {};

  function total() {
    var k, n = 0;
    for (k in items) {
      if (items.hasOwnProperty(k)) n += items[k];
    }
    return n;
  }

  function count(id) {
    return items[id] || 0;
  }

  /* 回傳實際存入的數量（倉庫可能滿了） */
  function deposit(id, n) {
    if (n <= 0) return 0;
    var room = W.CFG.STORE_CAP - total();
    if (room <= 0) return 0;
    if (n > room) n = room;
    if (!W.Inv.take(id, n)) return 0;
    items[id] = (items[id] || 0) + n;
    return n;
  }

  /* 回傳實際取出的數量（背包可能滿了） */
  function withdraw(id, n) {
    if (n <= 0) return 0;
    var have = items[id] || 0;
    if (have <= 0) return 0;
    if (n > have) n = have;
    var got = W.Inv.add(id, n);
    if (got <= 0) return 0;
    items[id] -= got;
    if (items[id] <= 0) delete items[id];
    return got;
  }

  /* 一鍵存入：把背包裡所有「非工具類」資源丟進倉庫 */
  function depositAll() {
    var order = W.Inv.ORDER, i, id, moved = 0;
    for (i = 0; i < order.length; i++) {
      id = order[i];
      moved += deposit(id, W.Inv.count(id));
    }
    return moved;
  }

  /* 讀檔時背包可能超過上限（舊存檔沒有容量概念）。
     多出來的自動移進倉庫，玩家蓋個儲物箱就能拿回來，不會憑空消失。 */
  function absorbOverflow() {
    /* 搬到只剩九成，留點空間，否則讀檔後第一次採集就會「背包已滿」 */
    var target = Math.floor(W.CFG.INV_CAP * 0.9);
    if (W.Inv.total() <= W.CFG.INV_CAP) return 0;
    var order = W.Inv.ORDER, moved = 0, i, id, need;
    for (i = order.length - 1; i >= 0; i--) {
      need = W.Inv.total() - target;
      if (need <= 0) break;
      id = order[i];
      moved += deposit(id, Math.min(need, W.Inv.count(id)));
    }
    return moved;
  }

  function ids() {
    var out = [], k;
    for (k in items) {
      if (items.hasOwnProperty(k) && items[k] > 0) out.push(k);
    }
    return out;
  }

  function exportData() {
    var o = {}, k;
    for (k in items) {
      if (items.hasOwnProperty(k) && items[k] > 0) o[k] = items[k];
    }
    return o;
  }

  function importData(o) {
    var k, v;
    items = {};
    if (!o) return;
    for (k in o) {
      if (!o.hasOwnProperty(k)) continue;
      v = o[k];
      if (typeof v !== 'number' || !isFinite(v) || v <= 0) continue;
      items[k] = Math.floor(v);
    }
  }

  function clear() { items = {}; }

  function stats() {
    return { total: total(), cap: W.CFG.STORE_CAP, kinds: ids().length };
  }

  return {
    count: count,
    total: total,
    deposit: deposit,
    withdraw: withdraw,
    depositAll: depositAll,
    absorbOverflow: absorbOverflow,
    ids: ids,
    exportData: exportData,
    importData: importData,
    clear: clear,
    stats: stats
  };
})();
