window.W = window.W || {};

W.Camera = {
  wx: W.CFG.START_WX,
  wy: W.CFG.START_WY,
  zoom: 1,
  vw: 0,
  vh: 0,

  setViewport: function(w, h) {
    this.vw = w;
    this.vh = h;
  },

  snapTo: function(wx, wy) {
    this.wx = wx;
    this.wy = wy;
  },

  follow: function(wx, wy, dt) {
    var k = 1 - Math.exp(-W.CFG.CAM_LERP * dt);
    this.wx += (wx - this.wx) * k;
    this.wy += (wy - this.wy) * k;
  },

  worldToScreenInto: function(wx, wy, out) {
    out.sx = (wx - this.wx) * this.zoom + this.vw / 2;
    out.sy = (wy - this.wy) * this.zoom + this.vh / 2;
    return out;
  },

  screenToWorldInto: function(sx, sy, out) {
    out.wx = (sx - this.vw / 2) / this.zoom + this.wx;
    out.wy = (sy - this.vh / 2) / this.zoom + this.wy;
    return out;
  },

  viewLeft:   function() { return this.wx - this.vw / 2 / this.zoom; },
  viewRight:  function() { return this.wx + this.vw / 2 / this.zoom; },
  viewTop:    function() { return this.wy - this.vh / 2 / this.zoom; },
  viewBottom: function() { return this.wy + this.vh / 2 / this.zoom; }
};
