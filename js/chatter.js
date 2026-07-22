window.W = window.W || {};

/* 夥伴吐槽：走進新地形、打倒王、半夜、肚子餓時，夥伴頭上冒一句白爛台詞。
   全原創台詞，四個夥伴各有性格：
     騎士＝中二熱血、獵人＝冷淡吐槽、貓＝只想吃跟睡、精靈＝狀況外的天真。
   不需存檔；純表演層，掛在 W.Mates 之外，缺席也不影響遊戲。 */
W.Chatter = (function() {

  /* 依情境分類，每個夥伴一組。播出時隨機抽一句（用世界雜湊，不用 Math.random） */
  var LINES = {
    idle: {
      knight: ['\u4eca\u5929\u4e5f\u662f\u5b88\u8b77\u516c\u4e3b\u7684\u597d\u65e5\u5b50\uff01', '\u6211\u7684\u528d\u5728\u71c3\u71d2\u2026\u55ef\uff0c\u5176\u5be6\u662f\u9913\u4e86\u3002', '\u6b63\u7fa9\u4e0d\u6703\u8fdb\u98df\uff0c\u4f46\u6211\u6703\u3002'],
      archer: ['\u53c8\u8d70\u9019\u9ebc\u9060\u3002', '\u55ef\u3002', '\u9019\u88e1\u9023\u9853\u77f3\u982d\u90fd\u9577\u5f97\u4e00\u6a23\u3002'],
      cat:    ['\u5589\u55dc\u3002', '\u53ef\u4ee5\u7761\u4e86\u55ce\uff1f', '\u6709\u9b5a\u55ce\uff1f\u6c92\u6709\u55ce\uff1f'],
      sprite: ['\u54c7\u2014\u2014\u96f2\u98c4\u904e\u53bb\u4e86\uff01', '\u6211\u521a\u521a\u597d\u50cf\u5728\u60f3\u4ec0\u9ebc\uff0c\u4f46\u5fd8\u8a18\u4e86\u3002', '\u9019\u500b\u4e16\u754c\u597d\u5927\u5594\uff5e'],
      laopi:  ['\u5148\u8eba\u4e00\u4e0b\uff0c\u8def\u53c8\u4e0d\u6703\u8dd1\u6389\u3002', '\u6211\u4e0d\u662f\u9913\uff0c\u662f\u809a\u5b50\u5728\u63d0\u6848\u3002', '\u55ef\u2026\u4eca\u5929\u4e5f\u9069\u5408\u4f38\u500b\u61f6\u8170\u3002'],
    },
    biome: {
      knight: ['\u65b0\u7684\u570b\u5ea6\uff01\u524d\u9032\uff01', '\u672a\u77e5\u7684\u571f\u5730\uff0c\u6b63\u5408\u82f1\u96c4\u7684\u80c3\u53e3\uff01'],
      archer: ['\u53c8\u4e00\u5340\u3002\u5e0c\u671b\u9019\u88e1\u6709\u80fd\u5403\u7684\u3002', '\u5730\u5f62\u8b8a\u4e86\uff0c\u5c0f\u5fc3\u9ede\u3002'],
      cat:    ['\u9019\u88e1\u7684\u571f\u646b\u8d77\u4f86\u4e0d\u932f\u3002', '\u65b0\u5730\u65b9\u2026\u53ef\u4ee5\u7761\u55ce\uff1f'],
      sprite: ['\u9019\u88e1\u7684\u7a7a\u6c23\u5617\u8d77\u4f86\u7c89\u7c89\u7684\uff01', '\u65b0\u5730\u5716\u89e3\u9396\uff01\u2026\u5730\u5716\u662f\u4ec0\u9ebc\uff1f'],
      laopi:  ['\u65b0\u5730\u65b9\u3002\u5e0c\u671b\u8349\u6478\u8d77\u4f86\u5920\u8edf\u3002', '\u4f60\u8d70\u524d\u9762\uff0c\u6211\u8ca0\u8cac\u770b\u5f8c\u9762\u3002'],
    },
    kill: {
      knight: ['\u80dc\u5229\u5c6c\u65bc\u6b63\u7fa9\uff01', '\u770b\u5230\u4e86\u55ce\uff1f\u9019\u5c31\u662f\u5be6\u529b\uff01'],
      archer: ['\u4e0b\u4e00\u500b\u3002', '\u55ef\uff0c\u6b7b\u4e86\u3002'],
      cat:    ['\u5687\u6b7b\u672c\u55b5\u4e86\u3002', '\u6253\u5b8c\u4e86\uff1f\u90a3\u53ef\u4ee5\u7761\u4e86\u5427\u3002'],
      sprite: ['\u5b83\u8eba\u4e0b\u4f86\u4f11\u606f\u4e86\u8036\uff01', '\u54c7\uff01\u525b\u525b\u767c\u751f\u4ec0\u9ebc\u4e8b\uff1f'],
      laopi:  ['\u597d\u5566\uff0c\u9019\u4e0b\u53ef\u4ee5\u8eba\u4e86\u3002', '\u6211\u5c31\u8aaa\u6211\u5011\u5f88\u6703\u6253\u5427\u3002'],
    },
    night: {
      knight: ['\u591c\u665a\u4e5f\u4e0d\u80fd\u9b06\u61c8\uff01', '\u9ed1\u6697\u4e2d\u66f4\u9700\u8981\u5149\u3002'],
      archer: ['\u5f88\u6669\u4e86\u3002\u4f60\u4e0d\u7761\u55ce\uff1f', '\u665a\u4e0a\u7684\u6771\u897f\u6bd4\u8f03\u5121\u3002'],
      cat:    ['\u9019\u624d\u662f\u672c\u55b5\u7684\u6642\u9593\u3002', '\u591c\u665a\u2026\u9069\u5408\u7761\u89ba\u3002'],
      sprite: ['\u661f\u661f\u597d\u591a\uff01\u6211\u4f86\u6578\u2026\u4e00\u3001\u4e8c\u2026\u5f88\u591a\uff01', '\u665a\u4e0a\u6703\u6709\u53ef\u6015\u7684\u6771\u897f\u55ce\uff1f'],
      laopi:  ['\u665a\u4e0a\u9760\u8fd1\u6211\u4e00\u9ede\u3002', '\u6211\u53ef\u4ee5\u62c9\u9577\u7576\u88ab\u5b50\uff0c\u4f46\u4f60\u5225\u6253\u547c\u3002'],
    },
    hungry: {
      knight: ['\u82f1\u96c4\u4e5f\u6703\u9913\u3002\u771f\u7684\u3002', '\u80c3\u2026\u80c3\u5728\u547c\u558a\u3002'],
      archer: ['\u6c92\u98df\u7269\u4e86\u3002\u4f60\u770b\u8457\u8fa6\u3002', '\u9913\u3002'],
      cat:    ['\u55b5\u55b5\u55b5\uff08\u7ffb\u8b6f\uff1a\u9913\u6b7b\u4e86\uff09', '\u98ef\u98ef\u98ef\u98ef\u98ef\u3002'],
      sprite: ['\u809a\u5b50\u5728\u5531\u6b4c\u8036\uff5e', '\u6211\u53ef\u4ee5\u5403\u5149\u55ce\uff1f\u4e0d\u884c\u55ce\uff1f'],
      laopi:  ['\u809a\u5b50\u7684\u63d0\u6848\u88ab\u99c1\u56de\u4e86\u3002', '\u4f60\u5403\u4e00\u53e3\uff0c\u6211\u5403\u2026\u5269\u4e0b\u7684\u3002'],
    },
    guard: { laopi: ['\u8eb2\u6211\u5f8c\u9762\uff01', '\u9019\u4e00\u4e0b\u6211\u4f86\u3002', '\u5148\u4e0d\u8981\u53d7\u50b7\uff0c\u6211\u5f88\u5fd9\u7684\uff01'] },
    danger: { laopi: ['\u5616\uff0c\u9760\u8fd1\u6211\u3002', '\u9019\u6b21\u771f\u7684\u4e0d\u662f\u958b\u73a9\u7b11\u3002'] },
    combo: { laopi: ['\u63a5\u4f4f\uff01\u9019\u4e00\u4e0b\u6211\u5011\u4e00\u8d77\u4f86\u3002', '\u4f60\u6253\u524d\u9762\uff0c\u6211\u5f9e\u5f8c\u9762\u62c9\u4f4f\u5b83\uff01'] },
    site: { laopi: ['\u7b49\u4e00\u4e0b\uff0c\u9019\u88e1\u6709\u5947\u602a\u7684\u5473\u9053\u3002', '\u79d8\u5883\u5728\u9644\u8fd1\uff0c\u6211\u7684\u9f3b\u5b50\u4e0d\u6703\u9a19\u4eba\u3002'] },
    site_loot: { laopi: ['\u6211\u5c31\u8aaa\u9019\u88e1\u85cf\u8457\u6771\u897f\uff01', '\u5e36\u4e0a\u9019\u80a1\u5171\u9cf4\uff0c\u4e0b\u4e00\u5834\u6703\u66f4\u597d\u6253\u3002'] },
    retreat: { laopi: ['\u5148\u56de\u53bb\u5598\u53e3\u6c23\uff0c\u6211\u6703\u8ddf\u7dca\u4f60\u3002', '\u4eca\u5929\u4e0d\u8ddf\u5b83\u62da\u547d\uff0c\u4e0b\u6b21\u518d\u6253\u56de\u4f86\u3002'] },
    revive: { laopi: ['\u9084\u6c92\u7d50\u675f\uff0c\u5148\u5403\u4e00\u53e3\u3002', '\u8d77\u4f86\uff0c\u6211\u53ef\u4e0d\u60f3\u4e00\u500b\u4eba\u8d70\u3002'] },
    memory_first_night: { laopi: ['\u9084\u8a18\u5f97\u7b2c\u4e00\u500b\u665a\u4e0a\u55ce\uff1f\u4f60\u6bd4\u72fc\u53eb\u9084\u5435\u3002', '\u6211\u5011\u7b2c\u4e00\u6b21\u4e00\u8d77\u904e\u591c\uff0c\u4f60\u6293\u6211\u6293\u5f97\u597d\u7dca\u3002'] },
    memory_first_boss: { laopi: ['\u7b2c\u4e00\u96bb\u9996\u9818\u5012\u4e0b\u6642\uff0c\u4f60\u90a3\u500b\u8868\u60c5\u6211\u9084\u8a18\u5f97\u3002', '\u6211\u5011\u9023\u9996\u9818\u90fd\u6253\u904e\u4e86\uff0c\u9019\u689d\u8def\u9084\u7b97\u4ec0\u9ebc\u3002'] },
    memory_first_calamity: { laopi: ['\u90a3\u6b21\u5929\u90fd\u5feb\u584c\u4e86\uff0c\u6211\u5011\u9084\u662f\u7ad9\u5230\u6700\u5f8c\u3002', '\u4e16\u754c\u707d\u798d\u4e5f\u6c92\u80fd\u628a\u6211\u5011\u62c6\u958b\u3002'] },
    memory_close_call: { laopi: ['\u4e0a\u6b21\u5dee\u9ede\u6551\u4e0d\u56de\u4f60\uff0c\u5225\u518d\u9019\u6a23\u5687\u6211\u3002', '\u6211\u6703\u7559\u8457\u6700\u5f8c\u4e00\u53e3\u98df\u7269\uff0c\u4f60\u4e5f\u8981\u7559\u8457\u6700\u5f8c\u4e00\u53e3\u6c23\u3002'] },
  };

  var last = {};        /* 每個夥伴上次講話的時間戳，避免話太密 */
  var active = [];      /* 目前顯示中的話泡：{ mate, text, t } */
  var COOLDOWN = 12;    /* 同一夥伴至少隔 12 秒才再講 */
  var SHOW = 3.2;       /* 一句話顯示 3.2 秒 */
  var seq = 0;

  function pick(cat, mateId) {
    var arr = LINES[cat] && LINES[cat][mateId];
    if (!arr || !arr.length) return '';
    seq++;
    var r = (W.Rng && W.Rng.hash2i) ? W.Rng.hash2i(seq, arr.length * 7 + mateId.length) : ((seq * 0.6180339887) % 1);
    var idx = Math.floor(r * arr.length) % arr.length;
    return arr[idx];
  }

  /* 讓某個情境的一個隨機夥伴發話（不強制全體講，避免洗版） */
  function speak(cat) {
    if (!W.Mates || !W.Mates.count) return;
    var now = Date.now() / 1000;
    var candidates = [], i, m;
    for (i = 0; i < W.Mates.count(); i++) {
      m = W.Mates.at(i);
      if (!m.recruited) continue;
      if (last[m.def.id] && now - last[m.def.id] < COOLDOWN) continue;
      candidates.push(m);
    }
    if (!candidates.length) return;
    seq++;
    var r2 = (W.Rng && W.Rng.hash2i) ? W.Rng.hash2i(seq * 3 + 1, candidates.length + 5) : ((seq * 0.6180339887) % 1);
    var pickIdx = Math.floor(r2 * candidates.length) % candidates.length;
    var mate = candidates[pickIdx];
    var text = pick(cat, mate.def.id);
    if (!text) return;
    last[mate.def.id] = now;
    active.push({ mate: mate, text: text, t: SHOW });
  }

  /* 特定夥伴講指定情境（打倒王時由該夥伴喊，比隨機更有臨場感） */
  function speakMate(mate, cat, force) {
    if (!mate || !mate.recruited) return false;
    var now = Date.now() / 1000;
    if (!force && last[mate.def.id] && now - last[mate.def.id] < COOLDOWN * 0.5) return false;
    var text = pick(cat, mate.def.id);
    if (!text) return false;
    if (force) {
      var i;
      for (i = active.length - 1; i >= 0; i--) if (active[i].mate === mate) active.splice(i, 1);
    }
    last[mate.def.id] = now;
    active.push({ mate: mate, text: text, t: SHOW });
    return true;
  }

  var idleT = 8;

  function update(dt) {
    var i;
    for (i = active.length - 1; i >= 0; i--) {
      active[i].t -= dt;
      if (active[i].t <= 0) active.splice(i, 1);
    }
    /* 閒置閒聊：每隔一段時間，若沒人在講話，隨機丟一句 idle */
    idleT -= dt;
    if (idleT <= 0) {
      idleT = 14 + (seq % 7);
      if (!active.length && W.Mates && W.Mates.recruitedCount && W.Mates.recruitedCount() > 0) {
        speak('idle');
      }
    }
  }

  /* 供 render 讀取目前要顯示的話泡 */
  function each(fn) {
    var i;
    for (i = 0; i < active.length; i++) {
      fn(active[i].mate, active[i].text, active[i].t / SHOW);
    }
  }

  function clear() { active.length = 0; last = {}; idleT = 8; }
  function isBusy() { return active.length > 0; }

  return {
    speak: speak,
    speakMate: speakMate,
    isBusy: function() { return active.length > 0; },
    update: update,
    each: each,
    isBusy: isBusy,
    clear: clear
  };
})();
