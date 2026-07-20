window.W = window.W || {};

/* 確定性雜訊：同一個 (wx, wy, seed) 永遠回傳同一個值。
   完全不使用瀏覽器內建亂數，因此世界可重現、不需存檔地形。 */
W.Rng = (function() {

  function hash2i(ix, iy, seed) {
    var h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function vnoise(x, y, seed) {
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var fx = x - x0, fy = y - y0;
    var u = fx * fx * (3 - 2 * fx);
    var v = fy * fy * (3 - 2 * fy);
    var a = hash2i(x0,     y0,     seed);
    var b = hash2i(x0 + 1, y0,     seed);
    var c = hash2i(x0,     y0 + 1, seed);
    var d = hash2i(x0 + 1, y0 + 1, seed);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }

  function fbm(x, y, seed, oct) {
    var sum = 0, amp = 0.5, norm = 0, i;
    for (i = 0; i < oct; i++) {
      sum += vnoise(x, y, seed + i * 101) * amp;
      norm += amp;
      amp *= 0.5;
      x *= 2;
      y *= 2;
    }
    return sum / norm;
  }

  return {
    hash2i: hash2i,
    vnoise: vnoise,
    fbm: fbm
  };
})();
