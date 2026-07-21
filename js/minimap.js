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

    /* 魔王方位：範圍內畫菱形實際位置，超出範圍就貼邊畫箭頭指方向。
       未擊敗紅色、已擊敗暗灰。守衛型較小、區域型較大。 */
    if (W.Bosses && W.Bosses.count) {
      var bi, b, bx, by, dead, edge, ang, col, sz;
      for (bi = 0; bi < W.Bosses.count(); bi++) {
        b = W.Bosses.at(bi);
        if (!b || !b.site) continue;
        dead = !b.alive;
        col = dead ? 'rgba(120,120,120,0.85)' : '#ff5a4a';
        sz = (b.def && b.def.kind === 'regional') ? 6 : 5;

        bx = half2 + (b.site.wx - W.Player.wx) * scale;
        by = half2 + (b.site.wy - W.Player.wy) * scale;

        if (bx >= 4 && by >= 4 && bx <= SIZE - 4 && by <= SIZE - 4) {
          /* 範圍內：實心菱形＋外框，跟遺跡區隔 */
          c.fillStyle = col;
          c.beginPath();
          c.moveTo(bx, by - sz);
          c.lineTo(bx + sz, by);
          c.lineTo(bx, by + sz);
          c.lineTo(bx - sz, by);
          c.closePath();
          c.fill();
          if (!dead) {
            c.strokeStyle = 'rgba(255,255,255,0.9)';
            c.lineWidth = 1.5;
            c.stroke();
          }
        } else if (!dead) {
          /* 超出範圍：貼著邊緣畫箭頭，只對還沒擊敗的王指路 */
          ang = Math.atan2(by - half2, bx - half2);
          var ex = half2 + Math.cos(ang) * (half2 - 8);
          var ey = half2 + Math.sin(ang) * (half2 - 8);
          c.save();
          c.translate(ex, ey);
          c.rotate(ang);
          c.fillStyle = col;
          c.beginPath();
          c.moveTo(6, 0);
          c.lineTo(-4, -4);
          c.lineTo(-4, 4);
          c.closePath();
          c.fill();
          c.restore();
        }
      }
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
