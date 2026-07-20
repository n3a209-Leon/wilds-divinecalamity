window.W = window.W || {};

W.Input = (function() {
  var moveX = 0, moveY = 0;
  var joyOn = false, joyId = null;
  var ox = 0, oy = 0;
  var keys = {};
  var elBase = null, elKnob = null;
  var tapPend = false;
  var tapSX = 0, tapSY = 0;
  var tapT0 = 0, tapX0 = 0, tapY0 = 0, tapId = null;

  /* iOS 上對 touchstart 呼叫 preventDefault 會抑制後續的 click 事件，
     導致所有按鈕失效（滑鼠不受影響，所以電腦上測不出來）。
     點在 UI 元素上時 input.js 完全不介入，讓 click 正常送達。
     不用 closest()，手刻迴圈相容性最穩。 */
  function isUiTarget(t) {
    while (t && t !== document.body) {
      if (t.tagName === 'BUTTON') return true;
      if (t.id && (
        t.id === 'actions' ||
        t.id === 'goal-card' ||
        t.id === 'btn-diag' ||
        t.id.indexOf('-panel') >= 0
      )) return true;
      t = t.parentNode;
    }
    return false;
  }

  function setVec(dx, dy) {
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; len = 1; }
    if (len < W.CFG.JOY_DEADZONE) { dx = 0; dy = 0; }
    moveX = dx;
    moveY = dy;
  }

  function showJoy(px, py) {
    elBase.style.display = 'block';
    elBase.style.left = (px - 60) + 'px';
    elBase.style.top  = (py - 60) + 'px';
    elKnob.style.left = '34px';
    elKnob.style.top  = '34px';
  }

  function moveKnob(dx, dy) {
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; }
    elKnob.style.left = (34 + dx * W.CFG.JOY_RADIUS * 0.6) + 'px';
    elKnob.style.top  = (34 + dy * W.CFG.JOY_RADIUS * 0.6) + 'px';
  }

  function hideJoy() {
    elBase.style.display = 'none';
  }

  function onStart(e) {
    if (isUiTarget(e.target)) return;
    var i, t;
    for (i = 0; i < e.changedTouches.length; i++) {
      t = e.changedTouches[i];
      if (!joyOn && t.clientX < window.innerWidth * W.CFG.JOY_ZONE) {
        joyOn = true;
        joyId = t.identifier;
        ox = t.clientX;
        oy = t.clientY;
        showJoy(ox, oy);
      } else if (tapId === null && t.clientX >= window.innerWidth * W.CFG.JOY_ZONE) {
        /* 右半螢幕的輕點：用來點選建物 */
        tapId = t.identifier;
        tapT0 = performance.now();
        tapX0 = t.clientX;
        tapY0 = t.clientY;
      }
    }
    e.preventDefault();
  }

  function onMove(e) {
    if (isUiTarget(e.target)) return;
    var i, t, dx, dy;
    for (i = 0; i < e.changedTouches.length; i++) {
      t = e.changedTouches[i];
      if (joyOn && t.identifier === joyId) {
        dx = (t.clientX - ox) / W.CFG.JOY_RADIUS;
        dy = (t.clientY - oy) / W.CFG.JOY_RADIUS;
        setVec(dx, dy);
        moveKnob(dx, dy);
      }
    }
    e.preventDefault();
  }

  function onEnd(e) {
    if (isUiTarget(e.target)) return;
    var i, t;
    for (i = 0; i < e.changedTouches.length; i++) {
      t = e.changedTouches[i];
      if (joyOn && t.identifier === joyId) {
        joyOn = false;
        joyId = null;
        moveX = 0;
        moveY = 0;
        hideJoy();
      }
      if (tapId !== null && t.identifier === tapId) {
        var mv = Math.abs(t.clientX - tapX0) + Math.abs(t.clientY - tapY0);
        if (performance.now() - tapT0 < 300 && mv < 14) {
          tapPend = true;
          tapSX = t.clientX;
          tapSY = t.clientY;
        }
        tapId = null;
      }
    }
    e.preventDefault();
  }

  var mouseDown = false;

  function onMouseDown(e) {
    if (isUiTarget(e.target)) return;
    if (e.clientX < window.innerWidth * W.CFG.JOY_ZONE) {
      mouseDown = true;
      ox = e.clientX; oy = e.clientY;
      showJoy(ox, oy);
    }
  }

  function onMouseMove(e) {
    if (!mouseDown) return;
    var dx = (e.clientX - ox) / W.CFG.JOY_RADIUS;
    var dy = (e.clientY - oy) / W.CFG.JOY_RADIUS;
    setVec(dx, dy);
    moveKnob(dx, dy);
  }

  function onMouseUp() {
    if (!mouseDown) return;
    mouseDown = false;
    moveX = 0; moveY = 0;
    hideJoy();
  }

  function readKeys() {
    if (joyOn || mouseDown) return;
    var dx = 0, dy = 0;
    if (keys['a'] || keys['arrowleft'])  dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    if (keys['w'] || keys['arrowup'])    dy -= 1;
    if (keys['s'] || keys['arrowdown'])  dy += 1;
    if (dx === 0 && dy === 0) { moveX = 0; moveY = 0; return; }
    var len = Math.sqrt(dx * dx + dy * dy);
    moveX = dx / len;
    moveY = dy / len;
  }

  function init() {
    elBase = document.getElementById('joy-base');
    elKnob = document.getElementById('joy-knob');
    var opt = { passive: false };
    window.addEventListener('touchstart',  onStart, opt);
    window.addEventListener('touchmove',   onMove,  opt);
    window.addEventListener('touchend',    onEnd,   opt);
    window.addEventListener('touchcancel', function(e) { tapId = null; onEnd(e); }, opt);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('keydown', function(e) { keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup',   function(e) { keys[e.key.toLowerCase()] = false; });
    document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
  }

  return {
    init: init,
    update: readKeys,
    getX: function() { return moveX; },
    getY: function() { return moveY; },
    isActive: function() { return joyOn || mouseDown; },
    consumeTap: function(out) {
      if (!tapPend) return false;
      tapPend = false;
      out.sx = tapSX;
      out.sy = tapSY;
      return true;
    }
  };
})();
