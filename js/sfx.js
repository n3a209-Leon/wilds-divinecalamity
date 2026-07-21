window.W = window.W || {};

/* WebAudio 合成音效，零素材。
   iOS 規定 AudioContext 必須在使用者手勢中建立／解鎖，
   因此 unlock() 掛在第一次 pointerdown 上。
   雜訊用線性同餘產生器，不使用瀏覽器內建亂數。 */
W.Sfx = (function() {
  var ac = null;
  var master = null;
  var muted = false;
  var volume = W.Settings ? W.Settings.get('sfxVolume') : 0.5;

  function ensure() {
    if (ac) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = volume;
      master.connect(ac.destination);
    } catch (e) { return false; }
    return true;
  }

  function unlock() {
    if (!ensure()) return;
    if (ac.state === 'suspended') ac.resume();
  }

  function tone(freq, dur, type, vol, slide) {
    if (muted || !ac || ac.state !== 'running') return;
    var t0 = ac.currentTime;
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur);
  }

  function noise(dur, vol) {
    if (muted || !ac || ac.state !== 'running') return;
    var t0 = ac.currentTime;
    var n = Math.floor(ac.sampleRate * dur);
    var buf = ac.createBuffer(1, n, ac.sampleRate);
    var d = buf.getChannelData(0);
    var k, s = 12345;
    for (k = 0; k < n; k++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[k] = (s / 0x3fffffff - 1) * (1 - k / n);
    }
    var src = ac.createBufferSource();
    var g = ac.createGain();
    src.buffer = buf;
    g.gain.value = vol;
    src.connect(g);
    g.connect(master);
    src.start(t0);
  }

  return {
    unlock: unlock,
    setMuted: function(m) { muted = m; },
    setVolume: function(v) {
      v = Number(v); volume = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
      if (master) master.gain.value = volume;
      return volume;
    },
    volume: function() { return volume; },
    isMuted: function() { return muted; },
    isReady: function() { return !!ac && ac.state === 'running'; },
    tap:      function() { tone(660, 0.05, 'square', 0.10); },
    harvest:  function() { tone(300, 0.08, 'triangle', 0.25, 0.7); noise(0.05, 0.12); },
    hit:      function() { tone(160, 0.10, 'square', 0.30, 0.5); noise(0.06, 0.20); },
    bow:      function() { tone(900, 0.12, 'sawtooth', 0.15, 0.3); },
    arrowHit: function() { tone(220, 0.09, 'square', 0.28, 0.6); },
    kill:     function() { tone(500, 0.25, 'triangle', 0.28, 0.4); },
    eat:      function() { tone(420, 0.07, 'sine', 0.22, 1.3); tone(560, 0.07, 'sine', 0.16); },
    hurt:     function() { tone(120, 0.22, 'sawtooth', 0.32, 0.6); },
    sleep:    function() { tone(520, 0.5, 'sine', 0.16, 0.55); },
    night:    function() { tone(340, 0.7, 'sine', 0.14, 0.5); tone(255, 0.7, 'sine', 0.10, 0.5); },
    dodge:    function() { tone(760, 0.12, 'triangle', 0.18, 0.46); noise(0.08, 0.10); },
    perfectDodge: function() { tone(980, 0.08, 'sine', 0.22, 1.28); tone(1320, 0.16, 'triangle', 0.16, 0.82); },
    place:    function() { tone(240, 0.09, 'square', 0.24, 1.4); }
  };
})();
