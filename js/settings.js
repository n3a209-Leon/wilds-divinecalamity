window.W = window.W || {};

/* 裝置端遊戲體驗設定。這些選項不屬於角色進度，因此不進存檔與雲端：
   同一份存檔在手機可用省電模式，在桌機仍可保留完整特效。 */
W.Settings = (function() {
  var KEY = 'wilds:settings:v1';
  var DEFAULTS = {
    shake: 1,
    haptics: true,
    flashes: true,
    reducedMotion: false,
    highContrast: false,
    damageNumbers: true,
    lowPower: false,
    sfxVolume: 0.5
  };
  var data = copy(DEFAULTS);

  function copy(o) {
    var out = {}, k;
    for (k in o) if (o.hasOwnProperty(k)) out[k] = o[k];
    return out;
  }

  function clampNumber(v, lo, hi, fallback) {
    v = Number(v);
    return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
  }

  function sanitize(o) {
    var out = copy(DEFAULTS);
    if (!o || typeof o !== 'object') return out;
    out.shake = clampNumber(o.shake, 0, 1, DEFAULTS.shake);
    out.haptics = o.haptics !== false;
    out.flashes = o.flashes !== false;
    out.reducedMotion = !!o.reducedMotion;
    out.highContrast = !!o.highContrast;
    out.damageNumbers = o.damageNumbers !== false;
    out.lowPower = !!o.lowPower;
    out.sfxVolume = clampNumber(o.sfxVolume, 0, 1, DEFAULTS.sfxVolume);
    return out;
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      data = raw ? sanitize(JSON.parse(raw)) : copy(DEFAULTS);
    } catch (e) { data = copy(DEFAULTS); }
    return copy(data);
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  function get(key) { return data.hasOwnProperty(key) ? data[key] : undefined; }

  function set(key, value) {
    if (!DEFAULTS.hasOwnProperty(key)) return false;
    var next = copy(data);
    next[key] = value;
    data = sanitize(next);
    save();
    if (W.Sfx && W.Sfx.setVolume) W.Sfx.setVolume(data.sfxVolume);
    return data[key];
  }

  function reset() {
    data = copy(DEFAULTS);
    save();
    if (W.Sfx && W.Sfx.setVolume) W.Sfx.setVolume(data.sfxVolume);
    return copy(data);
  }

  function stats() { return copy(data); }
  function dprCap() { return data.lowPower ? 1 : W.CFG.MAX_DPR; }
  function vibrate(ms) {
    if (!data.haptics || !navigator.vibrate) return false;
    navigator.vibrate(ms);
    return true;
  }

  load();
  return { load:load, save:save, get:get, set:set, reset:reset, stats:stats, dprCap:dprCap, vibrate:vibrate };
})();
