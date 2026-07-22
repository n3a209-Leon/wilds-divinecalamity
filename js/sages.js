window.W = window.W || {};

/* 碎念賢者「攤攤」：散落世界各處的原創流浪 NPC，一坨懶洋洋的軟趴生物。
   走近時頭上冒一句「一本正經的廢話哲學」，溫吞、跳題、偶爾冒出莫名其妙的人生道理。
   ── 純表演層、零存檔：位置由世界雜湊決定（可重現、換裝置一致），沒有任何要存的資料。
   ── 缺席不影響遊戲；台詞全原創，不使用任何既有作品的角色、名字或設定。
   ── 禁 Math.random（用 W.Rng.hash2i）；每幀迴圈不建物件字面量（話泡池預先重用）。 */
W.Sages = (function() {

  /* 依情境分類，走近時抽一句。用世界雜湊挑選，同一坨在同一情境下講的話固定。 */
  var LINES = {
    greet: [
      '喔，是你啊。我剛夢到一顆會走路的石頭，醒來發現是你的腳步聲。差不多啦。',
      '嗨。我在這躺很久了，久到忘記本來要去哪。你要去哪？別告訴我，我會忘。',
      '歡迎。這裡沒有椅子，但地板其實也算一種很大的椅子。',
      '你來啦。我剛才什麼都沒做，做得非常成功。'
    ],
    wisdom: [
      '你一直往前走，最後會回到原點。所以你哪都沒去，但你變強了。人生大概就這樣。',
      '難過的時候就躺下來。地球會幫你扛著，它一直在做這件事，只是你沒發現。',
      '別急著把每件事都想通。留一點沒想通的，明天才有事做。',
      '我曾經很想當一棵樹。後來發現我不用動就能達成大部分目標，所以我算半棵了。',
      '失敗只是成功穿了件比較舊的衣服。對它好一點，它冷。',
      '肚子餓不是壞事，那代表你還活著，而且還有胃。兩個好消息。',
      '背包裡那些東西，總有一天會用到。用不到也沒關係，它們陪你走了很遠。',
      '英雄跟躺著的人差在哪？英雄會站起來。其他都一樣。',
      '昨天的你比今天笨一點，這代表你在進步。明天的你也會覺得今天的你很笨，別放心上。',
      '找不到路，是路還沒找到你。它會來的，它只是也迷路了。',
      '走太快會錯過風景，走太慢會變成風景。你自己選。',
      '你砍了很多樹，蓋了很多東西。其實你只是想找個地方，好好發呆。我懂。'
    ],
    night: [
      '晚上的世界比較誠實，因為看不清楚，大家就不裝了。',
      '星星那麼亮，其實是它們也睡不著。你不孤單。',
      '怪物晚上才出來，是因為白天要睡覺。牠們也很努力生活，只是方向不太對。'
    ],
    morning: [
      '早。太陽每天都爬起來，它其實也想賴床，但它知道你在等。',
      '白天適合做點什麼，晚上適合後悔沒做。我兩個都很擅長。'
    ]
  };

  var TRIGGER  = 74;     /* 走進 74px 觸發講話 */
  var COOLDOWN = 22;     /* 同一坨 22 秒內不重複講 */
  var SHOW     = 4.0;    /* 話泡顯示 4 秒 */
  var CHANCE   = 0.40;   /* 每個地區格有 40% 機率有一坨（比遺跡密，用來填探索空洞） */
  var SCAN     = 0.4;    /* 每 0.4 秒掃一次附近，不用每幀掃 */

  var seq = 0;
  var scanT = 0.5;
  var heard = {};        /* spotKey -> 上次講話的世界時間 */
  var firstMet = {};     /* spotKey -> 是否已初次相遇（決定要不要用 greet） */
  var active = [];       /* 話泡池：{ wx, wy, text, t } */
  var spotCache = {};    /* 'rx,ry' -> spot | null */
  var cacheOrder = [];

  /* 決定性放置：照抄 sites.js 那套（地區格雜湊 + 抖動座標）。 */
  function spotFor(rx, ry) {
    var key = rx + ',' + ry;
    if (spotCache.hasOwnProperty(key)) return spotCache[key];
    var s = null;
    if (W.CFG && W.Rng) {
      var R = W.CFG.SITE_REGION;
      var h = W.Rng.hash2i(rx, ry, W.CFG.SEED + 5501);
      if (h < CHANCE) {
        var jx = W.Rng.hash2i(rx + 13, ry + 61, W.CFG.SEED + 5502);
        var jy = W.Rng.hash2i(rx + 47, ry + 29, W.CFG.SEED + 5503);
        var tint = W.Rng.hash2i(rx + 3, ry + 88, W.CFG.SEED + 5504);
        var wx = rx * R + R * (0.15 + jx * 0.7);
        var wy = ry * R + R * (0.15 + jy * 0.7);
        var solid = (W.World && W.World.isSolidAt) ? W.World.isSolidAt(wx, wy) : false;
        if (wx > 180 && wy > 180 && wx < W.CFG.WORLD_SIZE - 180 && wy < W.CFG.WORLD_SIZE - 180 && !solid) {
          s = { k: key, wx: wx, wy: wy, tint: tint };
        }
      }
    }
    spotCache[key] = s;
    cacheOrder.push(key);
    if (cacheOrder.length > 120) delete spotCache[cacheOrder.shift()];
    return s;
  }

  function pick(cat, spot) {
    var arr = LINES[cat];
    if (!arr || !arr.length) return '';
    seq++;
    var salt = spot.k.length * 7 + ((spot.tint * 97) | 0);
    var r = (W.Rng && W.Rng.hash2i)
      ? W.Rng.hash2i(seq + salt, arr.length * 5 + 3, (W.CFG ? W.CFG.SEED : 0) + 6601)
      : ((seq * 0.6180339887) % 1);
    return arr[Math.floor(r * arr.length) % arr.length];
  }

  function pickCategory() {
    if (W.Time) {
      if (W.Time.isNight && W.Time.isNight()) return (seq % 2 ? 'night' : 'wisdom');
      var pr = W.Time.progress ? W.Time.progress() : 0.3;
      if (pr < 0.14) return (seq % 2 ? 'morning' : 'wisdom');
    }
    return 'wisdom';
  }

  /* 掃描玩家周圍 3x3 地區格，找出觸發範圍內、且過了冷卻的一坨，讓它講話。
     一次只觸發一坨，避免同時洗版。 */
  function scan() {
    if (!W.Player || !W.CFG) return;
    var now = Date.now() / 1000;   /* 冷卻用真實秒數，單調遞增即可 */
    var R = W.CFG.SITE_REGION;
    var pcx = Math.floor(W.Player.wx / R);
    var pcy = Math.floor(W.Player.wy / R);
    var rx, ry, s, dx, dy, first, cat, text;
    for (rx = pcx - 1; rx <= pcx + 1; rx++) {
      for (ry = pcy - 1; ry <= pcy + 1; ry++) {
        s = spotFor(rx, ry);
        if (!s) continue;
        dx = s.wx - W.Player.wx;
        dy = s.wy - W.Player.wy;
        if (dx * dx + dy * dy > TRIGGER * TRIGGER) continue;
        if (heard[s.k] && now - heard[s.k] < COOLDOWN) continue;
        first = !firstMet[s.k];
        firstMet[s.k] = 1;
        heard[s.k] = now;
        cat = first ? 'greet' : pickCategory();
        text = pick(cat, s);
        if (text) active.push({ wx: s.wx, wy: s.wy, text: text, t: SHOW });
        return;
      }
    }
  }

  function update(dt) {
    var i;
    for (i = active.length - 1; i >= 0; i--) {
      active[i].t -= dt;
      if (active[i].t <= 0) active.splice(i, 1);
    }
    scanT -= dt;
    if (scanT <= 0) { scanT = SCAN; scan(); }
  }

  /* 供 render 讀取目前話泡 */
  function each(fn) {
    var i;
    for (i = 0; i < active.length; i++) {
      fn(active[i].wx, active[i].wy, active[i].text, active[i].t / SHOW);
    }
  }

  /* 供 render / minimap 讀取玩家附近的一坨（5x5 地區格） */
  function eachSpot(fn) {
    if (!W.Player || !W.CFG) return;
    var R = W.CFG.SITE_REGION;
    var pcx = Math.floor(W.Player.wx / R);
    var pcy = Math.floor(W.Player.wy / R);
    var rx, ry, s;
    for (rx = pcx - 2; rx <= pcx + 2; rx++) {
      for (ry = pcy - 2; ry <= pcy + 2; ry++) {
        s = spotFor(rx, ry);
        if (s) fn(s);
      }
    }
  }

  function init() {
    heard = {};
    firstMet = {};
    active.length = 0;
    scanT = 0.5;
    seq = 0;
  }

  return {
    init: init,
    update: update,
    each: each,
    eachSpot: eachSpot,
    spotFor: spotFor,
    clear: init
  };
})();
