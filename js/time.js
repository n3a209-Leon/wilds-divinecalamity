window.W = window.W || {};

/* 世界時鐘：t 為一天內的進度 0~1，day 為第幾天。
   屬於必須存檔的資料類型，新增欄位時同步 save.js 的 collect / apply / migrate 三處。 */
W.Time = (function() {

  var t = 0.16;   /* 從早上開始 */
  var day = 1;

  function update(dt) {
    t += dt / W.CFG.DAY_LENGTH;
    while (t >= 1) { t -= 1; day++; }
  }

  /* 0 = 全亮，1 = 最暗 */
  function darkness() {
    var d = W.CFG.NIGHT_DARK;
    if (t < 0.06) return d * (1 - t / 0.06) * 0.85;      /* 黎明 */
    if (t < 0.55) return 0;                               /* 白天 */
    if (t < 0.68) return d * (t - 0.55) / 0.13;           /* 黃昏 */
    if (t < 0.94) return d;                               /* 夜晚 */
    return d * (1 - (t - 0.94) / 0.06);                   /* 天亮中 */
  }

  function isNight() { return t >= 0.62 && t < 0.96; }

  function phase() {
    if (t < 0.06) return '\u9ece\u660e';
    if (t < 0.55) return '\u767d\u5929';
    if (t < 0.68) return '\u9ec3\u660f';
    if (t < 0.94) return '\u591c\u665a';
    return '\u5929\u4eae\u4e2d';
  }

  function clock() {
    /* 位移 6 小時，讓 t=0 對應清晨 06:00，時鐘讀起來才自然 */
    var mins = Math.floor((((t * 24) + 6) % 24) * 60);
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function dayNo() { return day; }
  function progress() { return t; }

  function skipToDawn() {
    if (t > 0.5) { day++; }
    t = 0.08;
  }

  function exportData() {
    return { t: t, day: day };
  }

  function importData(o) {
    if (!o) return;
    if (typeof o.t === 'number' && isFinite(o.t) && o.t >= 0 && o.t < 1) t = o.t;
    if (typeof o.day === 'number' && isFinite(o.day) && o.day >= 1) day = Math.floor(o.day);
  }

  function clear() { t = 0.16; day = 1; }

  return {
    update: update,
    darkness: darkness,
    isNight: isNight,
    phase: phase,
    clock: clock,
    dayNo: dayNo,
    progress: progress,
    skipToDawn: skipToDawn,
    exportData: exportData,
    importData: importData,
    clear: clear
  };
})();
