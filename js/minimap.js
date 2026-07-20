window.W = window.W || {};

/* 小地圖：每 0.5 秒重畫一次到離屏 canvas，主迴圈只做一次 drawImage。 */
W.Minimap = (function() {
  var cv = null, c = null;
  var on = false;
  var timer = 999;
  var SIZE = 132;

  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.width = SIZE;
    cv.height = SIZE;
    c = cv.getContext('2d');
  }

  function toggle() {
    on = !on;
    timer = 999;
    return on;
  }

  function isOn() { return on; }

  function rebuild() {
    ensure();
    var N = W.CFG.MINI_SAMPLES;
    var step = W.CFG.MINI_STEP;
    var px = SIZE / N;
    var half = N / 2;
    var i, j, wx, wy, t;

    c.fillStyle = '#0d1209';
    c.fillRect(0, 0, SIZE, SIZE);

    for (j = 0; j < N; j++) {
      for (i = 0; i < N; i++) {
        wx = W.Player.wx + (i - half) * step;
        wy = W.Player.wy + (j - half) * step;
        if (wx < 0 || wy < 0 || wx > W.CFG.WORLD_SIZE || wy > W.CFG.WORLD_SIZE) {
          c.fillStyle = '#0d1209';
        } else {
          t = W.World.tileAt(wx, wy);
          c.fillStyle = W.World.COLORS[t];
        }
        c.fillRect(i * px, j * px, px + 1, px + 1);
      }
    }

    /* 遺跡方位標記：未搜刮金色、已搜刮灰色 */
    var si, s, mx, my, half2 = SIZE / 2;
    var hasSites = !!W.Sites;
    var scale = SIZE / (N * step);
    for (si = 0; hasSites && si < W.Sites.nearCount(); si++) {
      s = W.Sites.nearAt(si);
      mx = half2 + (s.wx - W.Player.wx) * scale;
      my = half2 + (s.wy - W.Player.wy) * scale;
      if (mx < 3 || my < 3 || mx > SIZE - 3 || my > SIZE - 3) continue;
      c.fillStyle = W.Sites.isLooted(s) ? 'rgba(150,150,150,0.9)' : '#ffd85e';
      c.beginPath();
      c.moveTo(mx, my - 5);
      c.lineTo(mx + 5, my);
      c.lineTo(mx, my + 5);
      c.lineTo(mx - 5, my);
      c.closePath();
      c.fill();
    }

    c.fillStyle = '#ffef9f';
    c.fillRect(SIZE / 2 - 2, SIZE / 2 - 2, 4, 4);
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, SIZE - 2, SIZE - 2);
  }

  function tick(dt) {
    if (!on) return;
    timer += dt;
    if (timer < W.CFG.MINI_INTERVAL) return;
    timer = 0;
    rebuild();
  }

  function draw(ctx, vw) {
    if (!on || !cv) return;
    ctx.drawImage(cv, vw - SIZE - 12, 74);
  }

  return { toggle: toggle, isOn: isOn, tick: tick, draw: draw };
})();
