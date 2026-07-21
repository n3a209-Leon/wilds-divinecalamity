window.W = window.W || {};

W.Render = (function() {
  var ctx = null;
  var _p = { sx: 0, sy: 0 };
  var nightCv = null, nightCtx = null, nightW = 0, nightH = 0;
  var lightCv = null;
  var sprite = null;
  var spriteReady = false;
  var walkT = 0;
  var spriteUrl = '';
  var sanGrad = null;
  var sanKey = '';
  var slashT = 0;
  var slashFx = 0, slashFy = 1;
  var flashT = 0, flashMax = 0.28, flashColor = 'rgba(255,255,255,0.25)';

  function slash(fx, fy) {
    slashT = 0.16;
    slashFx = fx;
    slashFy = fy;
  }

  /* main.js 的災禍、飛升、Skin 與神武事件共用的全畫面閃光。 */
  function flash(color, duration) {
    if (W.Settings && (!W.Settings.get('flashes') || W.Settings.get('reducedMotion'))) return;
    flashColor = color || 'rgba(255,255,255,0.25)';
    flashMax = (typeof duration === 'number' && duration > 0) ? duration : 0.28;
    flashT = flashMax;
  }

  /* Phase 16 戰鬥回饋：效果池不在每幀建立物件，命中停頓只凍結遊戲模擬，
     特效與鏡頭震動仍用真實時間播放。 */
  var hitstopT = 0, slowT = 0, slowScale = 0.35, shakeT = 0, shakeMax = 0, shakeAmp = 0, shakePhase = 0, shakeX = 0, shakeY = 0;
  var IMPACT_MAX = 12, TRAVEL_MAX = 3, DODGE_MAX = 4, PHASE_MAX = 3;
  var impactPool = [], travelPool = [], dodgePool = [], phasePool = [], fi;
  for (fi = 0; fi < IMPACT_MAX; fi++) impactPool.push({on:false,wx:0,wy:0,t:0,max:0,strong:false,rot:0});
  for (fi = 0; fi < TRAVEL_MAX; fi++) travelPool.push({on:false,wx:0,wy:0,t:0,max:0});
  for (fi = 0; fi < DODGE_MAX; fi++) dodgePool.push({on:false,wx:0,wy:0,t:0,max:0,rot:0,flip:false});
  for (fi = 0; fi < PHASE_MAX; fi++) phasePool.push({on:false,wx:0,wy:0,t:0,max:0});

  function shake(strength, duration) {
    if (W.Settings && W.Settings.get('reducedMotion')) return;
    var mul = W.Settings ? Number(W.Settings.get('shake')) : 1;
    if (!isFinite(mul) || mul <= 0) return;
    var d = duration || 0.16, s = (strength || 3) * mul;
    if (d >= shakeT || s > shakeAmp) { shakeT = d; shakeMax = d; shakeAmp = s; }
  }

  function impact(wx, wy, strong) {
    var i, p;
    for (i = 0; i < IMPACT_MAX; i++) if (!impactPool[i].on) {
      p = impactPool[i]; p.on = true; p.wx = wx; p.wy = wy; p.max = strong ? 0.34 : 0.25;
      p.t = p.max; p.strong = !!strong; p.rot = (i % 6) * 0.47; break;
    }
    if (!(W.Settings && W.Settings.get('reducedMotion'))) {
      hitstopT = Math.max(hitstopT, (W.Settings && W.Settings.get('lowPower')) ? 0.025 : (strong ? 0.075 : 0.045));
    }
    shake(strong ? 7 : 4, strong ? 0.24 : 0.14);
  }

  function travelFx(wx, wy) {
    var i, p;
    for (i = 0; i < TRAVEL_MAX; i++) if (!travelPool[i].on) {
      p = travelPool[i]; p.on = true; p.wx = wx; p.wy = wy; p.max = 0.9; p.t = p.max; break;
    }
    shake(3, 0.28);
  }

  function dodgeFx(wx, wy, fx, fy) {
    var i, p;
    for (i = 0; i < DODGE_MAX; i++) if (!dodgePool[i].on) {
      p = dodgePool[i]; p.on = true; p.wx = wx; p.wy = wy; p.max = 0.34; p.t = p.max;
      p.rot = Math.atan2(fy || 0, fx || 1); p.flip = (fx || 0) < 0; break;
    }
  }

  function phaseFx(wx, wy) {
    var i, p;
    for (i = 0; i < PHASE_MAX; i++) if (!phasePool[i].on) {
      p = phasePool[i]; p.on = true; p.wx = wx; p.wy = wy; p.max = 1.05; p.t = p.max; break;
    }
    shake(9, 0.45);
  }

  function stepFrame(realDt) {
    var stopped = hitstopT > 0, slowed = slowT > 0, i, p, k;
    if (W.Settings && W.Settings.get('reducedMotion')) {
      hitstopT = 0; slowT = 0; shakeT = 0; shakeX = 0; shakeY = 0;
      stopped = false; slowed = false;
    }
    if (hitstopT > 0) hitstopT = Math.max(0, hitstopT - realDt);
    if (slowT > 0) slowT = Math.max(0, slowT - realDt);
    for (i = 0; i < IMPACT_MAX; i++) { p = impactPool[i]; if (p.on) { p.t -= realDt; if (p.t <= 0) p.on = false; } }
    for (i = 0; i < TRAVEL_MAX; i++) { p = travelPool[i]; if (p.on) { p.t -= realDt; if (p.t <= 0) p.on = false; } }
    for (i = 0; i < DODGE_MAX; i++) { p = dodgePool[i]; if (p.on) { p.t -= realDt; if (p.t <= 0) p.on = false; } }
    for (i = 0; i < PHASE_MAX; i++) { p = phasePool[i]; if (p.on) { p.t -= realDt; if (p.t <= 0) p.on = false; } }
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - realDt); shakePhase += realDt * 92;
      k = shakeMax > 0 ? shakeT / shakeMax : 0;
      shakeX = Math.sin(shakePhase) * shakeAmp * k;
      shakeY = Math.cos(shakePhase * 1.37) * shakeAmp * 0.72 * k;
    } else { shakeX = 0; shakeY = 0; }
    return stopped ? 0 : (slowed ? realDt * slowScale : realDt);
  }

  function slowMotion(duration, scale) {
    if (W.Settings && W.Settings.get('reducedMotion')) return;
    slowT = Math.max(slowT, Math.max(0, Number(duration) || 0));
    slowScale = Math.max(0.12, Math.min(1, Number(scale) || 0.35));
  }

  function highContrastRing(sx, sy, radius) {
    if (!(W.Settings && W.Settings.get('highContrast'))) return;
    ctx.save();
    ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([7, 4]); ctx.stroke();
    ctx.restore();
  }

  function drawCenteredFx(img, sx, sy, size, alpha, rotation) {
    if (!img) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(sx, sy); ctx.rotate(rotation || 0);
    ctx.drawImage(img, -size / 2, -size / 2, size, size); ctx.restore();
  }

  function drawFeedbackFx() {
    var z = W.Camera.zoom, hit = W.Art.get('fx_hit'), portal = W.Art.get('fx_travel');
    var dodge = W.Art.get('fx_dodge'), phase = W.Art.get('fx_phase');
    var vis = W.Rewards && W.Rewards.visuals ? W.Rewards.visuals() : {eliteHit:false,travel:false};
    var low = W.Settings && W.Settings.get('lowPower');
    var i, p, life, size;
    for (i = 0; i < IMPACT_MAX; i++) {
      p = impactPool[i]; if (!p.on) continue; life = p.t / p.max;
      W.Camera.worldToScreenInto(p.wx, p.wy, _p);
      size = (p.strong ? 112 : 78) * z * (1.2 - life * 0.35) * (vis.eliteHit ? 1.16 : 1);
      drawCenteredFx(hit, _p.sx, _p.sy, size, Math.min(1, life * 2.8), p.rot + (1-life)*0.3);
      if (vis.eliteHit && !low) drawCenteredFx(hit, _p.sx, _p.sy, size * 0.62, Math.min(0.7, life * 2), -p.rot);
    }
    for (i = 0; i < TRAVEL_MAX; i++) {
      p = travelPool[i]; if (!p.on) continue; life = p.t / p.max;
      W.Camera.worldToScreenInto(p.wx, p.wy, _p); size = (vis.travel ? 205 : 165) * z * (1.08 - life * 0.12);
      drawCenteredFx(portal, _p.sx, _p.sy + 10*z, size, Math.min(0.92, life * 2.4), (1-life)*0.55);
      if (vis.travel && !low) drawCenteredFx(portal, _p.sx, _p.sy + 10*z, size*0.72, Math.min(0.42, life), -(1-life)*0.8);
    }
    for (i = 0; i < DODGE_MAX; i++) {
      p = dodgePool[i]; if (!p.on) continue; life = p.t / p.max;
      W.Camera.worldToScreenInto(p.wx, p.wy, _p); size = 118 * z * (1.08 - life * 0.18);
      ctx.save(); ctx.globalAlpha = Math.min(0.95, life * 2.6); ctx.translate(_p.sx, _p.sy + 5*z);
      ctx.rotate(p.rot); if (p.flip) ctx.scale(1,-1);
      if (dodge) ctx.drawImage(dodge, -size*.52, -size*.5, size, size); ctx.restore();
    }
    for (i = 0; i < PHASE_MAX; i++) {
      p = phasePool[i]; if (!p.on) continue; life = p.t / p.max;
      W.Camera.worldToScreenInto(p.wx, p.wy, _p); size = (210 + (1-life)*85) * z;
      drawCenteredFx(phase, _p.sx, _p.sy, size, Math.min(1, life*2.2), (1-life)*0.75);
    }
  }

  function drawHonorTrail() {
    var vis = W.Rewards && W.Rewards.visuals ? W.Rewards.visuals() : null;
    if (!vis || !vis.trail || !W.Player.moving) return;
    W.Camera.worldToScreenInto(W.Player.wx, W.Player.wy, _p);
    var z=W.Camera.zoom,i,k,x,y;
    for(i=0;i<4;i++){k=(artT*2.3+i*.24)%1;x=_p.sx-W.Player.faceX*(14+i*7)*z+Math.sin(artT*5+i)*4*z;y=_p.sy-W.Player.faceY*(8+i*5)*z+10*z;
      ctx.fillStyle='rgba(255,210,95,'+(0.6*(1-k))+')';ctx.beginPath();ctx.arc(x,y,(2.8-i*.35)*z,0,Math.PI*2);ctx.fill();}
  }

  function drawHonorCrown() {
    var vis = W.Rewards && W.Rewards.visuals ? W.Rewards.visuals() : null;
    if (!vis || !vis.crown) return;
    W.Camera.worldToScreenInto(W.Player.wx, W.Player.wy, _p);
    var z=W.Camera.zoom,y=_p.sy-75*z,pulse=1+Math.sin(artT*4)*.08;
    ctx.save();ctx.strokeStyle='rgba(255,225,120,0.92)';ctx.fillStyle='rgba(255,205,75,0.28)';ctx.lineWidth=2*z;
    ctx.beginPath();ctx.ellipse(_p.sx,y,18*z*pulse,6*z*pulse,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(255,245,190,0.95)';ctx.beginPath();ctx.arc(_p.sx,y,2.5*z,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  var _pulse = 0;

  var NODE_ART      = ['tree', 'rock', 'grass', 'berry', '', 'ui/mushroom'];
  var NODE_ART_DEAD = ['tree_cut', 'rock_mined', 'grass_cut', 'berry_empty', '', ''];
  var MOB_ART       = ['deer', 'rabbit', 'wolf', '', 'boar', 'bear', 'crow'];
  var MOB_ART_MOVE  = ['deer_walk', 'rabbit_hop', 'wolf_run', '', 'boar_run', 'bear_walk', 'crow_fly'];
  var artT = 0;
  var BOSS_ZONE_STYLE = {
    poison: ['rgba(104,45,130,0.28)', 'rgba(177,93,220,0.72)'],
    frost: ['rgba(100,205,235,0.22)', 'rgba(170,240,255,0.82)'],
    rot: ['rgba(92,105,42,0.30)', 'rgba(178,190,82,0.78)'],
    wind: ['rgba(238,218,120,0.16)', 'rgba(255,235,145,0.82)'],
    lava: ['rgba(220,65,20,0.28)', 'rgba(255,145,45,0.88)']
  };
  var BOSS_SHOT_STYLE = {
    poison: ['#a85bd6', 'rgba(220,160,255,0.8)'],
    frost: ['#8edff3', 'rgba(225,250,255,0.95)'],
    rot: ['#99a84c', 'rgba(225,235,135,0.9)'],
    thunder: ['#ffd45f', 'rgba(255,250,195,0.95)'],
    lava: ['#ff6a22', 'rgba(255,220,110,0.98)']
  };

  /* 統一的素材繪製：以腳底（sx, sy）為錨點，等比例縮放到指定世界高度 */
  function drawArt(img, sx, sy, hWorld, flip) {
    /* 素材遺失或尚未載入時安全略過，避免 img.width 造成整局白畫面。 */
    if (!img) return;
    var h = hWorld * W.Camera.zoom;
    var w = h * (img.width / img.height);
    if (flip) {
      ctx.save();
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, sy - h, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, sx - w / 2, sy - h, w, h);
    }
  }

  /* 三幀夥伴素材：以腳底為旋轉錨點，保留透明邊緣並加入細微浮動／前傾。 */
  function drawArtFrame(img, frame, frames, sx, sy, hWorld, flip, bob, tilt, step) {
    if (!img) return;
    var sw=img.width/frames,sh=img.height;
    var h=hWorld*W.Camera.zoom,w=h*(sw/sh);
    step=step||0;
    ctx.save();ctx.translate(sx+step*0.65*W.Camera.zoom,sy+(bob||0)*W.Camera.zoom);
    ctx.scale(1+Math.abs(step)*0.018,1-Math.abs(step)*0.025);
    if(flip)ctx.scale(-1,1);
    ctx.rotate(flip?-(tilt||0):(tilt||0));
    ctx.drawImage(img,Math.floor(frame)*sw,0,sw,sh,-w/2,-h,w,h);
    ctx.restore();
  }

  function shadow(sx, sy, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  var DMG_MAX = 10;
  var dmgPool = [];
  (function() {
    var k;
    for (k = 0; k < DMG_MAX; k++) {
      dmgPool.push({ on: false, wx: 0, wy: 0, t: 0, txt: '' });
    }
  })();

  var sleepT = 0;
  var _cg = { wx: 0, wy: 0 };

  function dmgText(wx, wy, txt) {
    if (W.Settings && !W.Settings.get('damageNumbers')) return;
    var k;
    for (k = 0; k < DMG_MAX; k++) {
      if (!dmgPool[k].on) {
        dmgPool[k].on = true;
        dmgPool[k].wx = wx;
        dmgPool[k].wy = wy;
        dmgPool[k].t = 0.7;
        dmgPool[k].txt = txt;
        return;
      }
    }
  }

  function drawDmg(dt) {
    var k, d, a;
    for (k = 0; k < DMG_MAX; k++) {
      d = dmgPool[k];
      if (!d.on) continue;
      d.t -= dt;
      if (d.t <= 0) { d.on = false; continue; }
      d.wy -= 46 * dt;
      W.Camera.worldToScreenInto(d.wx, d.wy, _p);
      a = Math.min(1, d.t / 0.25);
      ctx.font = 'bold ' + Math.round(15 * W.Camera.zoom) + 'px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.8 * a) + ')';
      ctx.lineWidth = 3;
      ctx.strokeText(d.txt, _p.sx, _p.sy);
      ctx.fillStyle = 'rgba(255,120,90,' + a + ')';
      ctx.fillText(d.txt, _p.sx, _p.sy);
    }
  }

  function drawArrow(a) {
    W.Camera.worldToScreenInto(a.wx, a.wy, _p);
    var z = W.Camera.zoom;
    var ang = Math.atan2(a.vy, a.vx);
    ctx.save();
    ctx.translate(_p.sx, _p.sy);
    ctx.rotate(ang);
    ctx.strokeStyle = '#d8c690';
    ctx.lineWidth = 3 * z;
    ctx.beginPath();
    ctx.moveTo(-10 * z, 0);
    ctx.lineTo(8 * z, 0);
    ctx.stroke();
    ctx.fillStyle = '#eee';
    ctx.beginPath();
    ctx.moveTo(12 * z, 0);
    ctx.lineTo(5 * z, -3 * z);
    ctx.lineTo(5 * z, 3 * z);
    ctx.fill();
    ctx.restore();
  }

  /* 遺跡：廢墟用斷柱、洞穴用岩壁開口，中間放一個箱子 */
  function drawOneSite(s, sx, sy) {
    var z = W.Camera.zoom;
    var looted = W.Sites.isLooted(s);
    var i, ang, px, py;

    if (s.type === 0) {
      var pillar = W.Art.get('ruin');
      for (i = 0; i < 5; i++) {
        ang = i * (Math.PI * 2 / 5) + 0.5;
        px = sx + Math.cos(ang) * 52 * z;
        py = sy + Math.sin(ang) * 26 * z;
        if (pillar) {
          drawArt(pillar, px, py + 4 * z, W.CFG.ART_RUIN_H, (i % 2) === 1);
        } else {
          ctx.fillStyle = '#8a8a80';
          ctx.fillRect(px - 7 * z, py - 16 * z, 14 * z, 20 * z);
        }
      }
    } else {
      var cave = W.Art.get('cave');
      if (cave) {
        drawArt(cave, sx, sy + 10 * z, W.CFG.ART_CAVE_H, false);
      } else {
        ctx.fillStyle = '#5d5b55';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 6 * z, 46 * z, 30 * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    var box = W.Art.get(looted ? 'chest_open' : 'chest');
    if (box) {
      shadow(sx, sy + 6 * z, 13 * z, 5 * z);
      drawArt(box, sx, sy + 8 * z, W.CFG.ART_CHEST_H, false);
    } else {
      ctx.fillStyle = looted ? '#5a4a33' : '#8a6532';
      ctx.fillRect(sx - 13 * z, sy - 12 * z, 26 * z, 20 * z);
    }

    if (!looted) {
      ctx.strokeStyle = 'rgba(255,225,140,' + (0.45 + 0.25 * Math.sin(artT * 3)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 8 * z, 30 * z, 14 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSites(before) {
    if (!W.Sites) return;
    var C = W.Camera;
    var py = W.Player.wy;
    var i, s, n = W.Sites.nearCount();
    for (i = 0; i < n; i++) {
      s = W.Sites.nearAt(i);
      if (before ? (s.wy >= py) : (s.wy < py)) continue;
      W.Camera.worldToScreenInto(s.wx, s.wy, _p);
      if (_p.sx < -120 || _p.sy < -120 || _p.sx > C.vw + 120 || _p.sy > C.vh + 120) continue;
      drawOneSite(s, _p.sx, _p.sy);
    }
  }

  /* 夥伴與魔王：素材還沒到，先用色圈＋名牌占位，
     圖檔一旦加入 art.js 的清單就會自動改用圖片。 */
  var _mateFxP={sx:0,sy:0};
  function drawMateAttackFx(m,sx,sy,z){
    if(!m.actionT||m.actionT<=0)return;
    var life=Math.max(0,Math.min(1,m.actionT/(m.actionMax||0.34)));
    W.Camera.worldToScreenInto(m.hitWx,m.hitWy,_mateFxP);
    ctx.save();ctx.globalAlpha=Math.min(1,life*2.6);
    if(m.def.id==='archer'){
      ctx.strokeStyle='#ffe9a3';ctx.lineWidth=2*z;ctx.beginPath();ctx.moveTo(sx+m.faceX*9*z,sy-24*z);ctx.lineTo(_mateFxP.sx,_mateFxP.sy-12*z);ctx.stroke();
      ctx.fillStyle='#fff5c9';ctx.beginPath();ctx.arc(_mateFxP.sx,_mateFxP.sy-12*z,3.2*z,0,Math.PI*2);ctx.fill();
    }else if(m.def.id==='sprite'){
      var pulse=(8+(1-life)*10)*z;ctx.fillStyle='rgba(218,145,255,0.42)';ctx.beginPath();ctx.arc(_mateFxP.sx,_mateFxP.sy-10*z,pulse,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#f1c9ff';ctx.lineWidth=2*z;ctx.beginPath();ctx.moveTo(sx,sy-28*z);ctx.lineTo(_mateFxP.sx,_mateFxP.sy-10*z);ctx.stroke();
    }else if(m.def.id==='cat'){
      ctx.strokeStyle='#ffe5d0';ctx.lineWidth=2.5*z;for(var c=-1;c<=1;c++){ctx.beginPath();ctx.moveTo(_mateFxP.sx-12*z,_mateFxP.sy+(c*5-16)*z);ctx.lineTo(_mateFxP.sx+12*z,_mateFxP.sy+(c*5-22)*z);ctx.stroke();}
    }else{
      ctx.strokeStyle='#e9dcff';ctx.lineWidth=4*z;ctx.beginPath();ctx.arc(sx+m.faceX*12*z,sy-18*z,23*z,-1.2,1.1);ctx.stroke();
    }
    ctx.restore();
  }

  function drawMates() {
    if (!W.Mates) return;
    var i, m, img, sheet, frameNo, z, r, h, cg, ch;
    z = W.Camera.zoom;
    for (i = 0; i < W.Mates.count(); i++) {
      m = W.Mates.at(i);
      if (!m.recruited && !m.homeSite) continue;
      W.Camera.worldToScreenInto(m.wx, m.wy, _p);
      if (_p.sx < -80 || _p.sx > W.Camera.vw + 80 || _p.sy < -80 || _p.sy > W.Camera.vh + 80) continue;

      sheet=W.Art.get(m.def.art+'_sheet');
      img=sheet;
      frameNo=m.actionT>0?2:(m.moving?1:0);
      r = 12 * z;

      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(_p.sx, _p.sy + r * 0.6, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      if (img) {
        h=m.def.id==='sprite'?54:58;
        drawArtFrame(sheet,frameNo,3,_p.sx,_p.sy+r*0.6,h,m.faceX<0,m.bob,m.lean,m.actionT>0?0:(m.moving?Math.sin(m.animT):Math.sin(m.animT)*0.18));
        drawMateAttackFx(m,_p.sx,_p.sy+r*0.6,z);
      } else {
        ctx.fillStyle = m.def.color;
        ctx.beginPath();
        ctx.arc(_p.sx, _p.sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a2419';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = 'bold ' + Math.round(11 * z) + 'px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(m.def.name, _p.sx, _p.sy - 16 * z);
        ctx.fillStyle = '#f0f4e6';
        ctx.fillText(m.def.name, _p.sx, _p.sy - 16 * z);
      }

      if (m.recruited && m.hungry) {
        ctx.font = Math.round(13 * z) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\uD83C\uDF56', _p.sx, _p.sy - 30 * z);
      }

      if (!m.recruited && m.def.strong) {
        cg = W.Art.get('cage');
        if (cg) {
          drawArt(cg, _p.sx, _p.sy + r * 0.6, 60, false);
        } else {
          ctx.strokeStyle = '#8a7a5a';
          ctx.lineWidth = 3;
          ctx.strokeRect(_p.sx - 16 * z, _p.sy - 26 * z, 32 * z, 34 * z);
          ctx.beginPath();
          ctx.moveTo(_p.sx - 8 * z, _p.sy - 26 * z); ctx.lineTo(_p.sx - 8 * z, _p.sy + 8 * z);
          ctx.moveTo(_p.sx, _p.sy - 26 * z); ctx.lineTo(_p.sx, _p.sy + 8 * z);
          ctx.moveTo(_p.sx + 8 * z, _p.sy - 26 * z); ctx.lineTo(_p.sx + 8 * z, _p.sy + 8 * z);
          ctx.stroke();
        }
      }
    }
  }

  function drawBosses() {
    if (!W.Bosses) return;
    var i, b, img, z, r, h, w, wind;
    z = W.Camera.zoom;
    for (i = 0; i < W.Bosses.count(); i++) {
      b = W.Bosses.at(i);
      if (!b.alive) continue;
      W.Camera.worldToScreenInto(b.wx, b.wy, _p);
      if (_p.sx < -120 || _p.sx > W.Camera.vw + 120 || _p.sy < -120 || _p.sy > W.Camera.vh + 120) continue;

      wind = b.def.kind === 'regional' && (b.skillWind > 0 || (b.atkT > 0 && b.atkT < 0.28));
      if (wind) {
        drawCenteredFx(W.Art.get('fx_warning'), _p.sx, _p.sy + 6*z, 118*z,
          0.46 + 0.22*Math.sin(artT*18), -artT*0.45);
        ctx.save(); ctx.strokeStyle='rgba(255,215,115,0.82)'; ctx.lineWidth=3*z; ctx.setLineDash([8*z,5*z]);
        ctx.beginPath(); ctx.moveTo(_p.sx,_p.sy); ctx.lineTo(_p.sx+b.faceX*105*z,_p.sy+b.faceY*105*z); ctx.stroke(); ctx.restore();
        highContrastRing(_p.sx, _p.sy, 58 * z);
      }
      img = (b.atkFx > 0 ? W.Art.get(b.def.art + '_atk') : null) || W.Art.get(b.def.art);
      r = 26 * z;

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(_p.sx, _p.sy + r * 0.6, r, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (img) {
        drawArt(img, _p.sx, _p.sy + r * 0.6, (b.def.kind === 'regional' ? 150 : 96), b.faceX < 0);
      } else {
        ctx.fillStyle = (b.hurt > 0) ? '#e06050' : b.def.color;
        ctx.beginPath();
        ctx.arc(_p.sx, _p.sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e1a14';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      w = (b.def.kind === 'regional' ? 110 : 60) * z;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(_p.sx - w / 2, _p.sy - 44 * z, w, 6 * z);
      ctx.fillStyle = '#d85a4a';
      ctx.fillRect(_p.sx - w / 2, _p.sy - 44 * z, w * Math.max(0, b.hp / b.def.hp), 6 * z);

      ctx.font = 'bold ' + Math.round(12 * z) + 'px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(b.def.name, _p.sx, _p.sy - 50 * z);
      ctx.fillStyle = '#ffb0a0';
      ctx.fillText(b.def.name + (b.def.kind === 'regional' ? ' · 階段 ' + b.phase : ''), _p.sx, _p.sy - 50 * z);
    }
  }

  function drawBossHazards() {
    if (!W.Bosses) return;
    var z = W.Camera.zoom;
    var safe = W.Bosses.safeZoneAt ? W.Bosses.safeZoneAt() : null;
    if (safe) {
      W.Camera.worldToScreenInto(safe.wx, safe.wy, _p);
      ctx.fillStyle = 'rgba(95,125,135,0.34)';
      ctx.strokeStyle = 'rgba(185,225,235,0.9)';
      ctx.lineWidth = 3 * z;
      ctx.beginPath();
      ctx.ellipse(_p.sx, _p.sy, safe.r * z, safe.r * 0.62 * z, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(225,245,245,0.48)'; ctx.lineWidth = 1.5 * z;
      ctx.beginPath(); ctx.arc(_p.sx, _p.sy, safe.r * 0.46 * z, 0, Math.PI * 2); ctx.stroke();
    }
    W.Bosses.eachPool(function(p) {
      W.Camera.worldToScreenInto(p.wx, p.wy, _p);
      var st = BOSS_ZONE_STYLE[p.kind] || BOSS_ZONE_STYLE.poison;
      ctx.fillStyle = st[0];
      ctx.strokeStyle = st[1];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(_p.sx, _p.sy, p.r * z, p.r * 0.55 * z, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      highContrastRing(_p.sx, _p.sy, p.r * z);
    });
    if (W.Bosses.eachPillar) W.Bosses.eachPillar(function(p) {
      W.Camera.worldToScreenInto(p.wx, p.wy, _p);
      var rr = p.r * z;
      if (p.delay > 0) {
        ctx.fillStyle = 'rgba(255,80,25,0.12)'; ctx.strokeStyle = 'rgba(255,150,55,0.95)';
        ctx.lineWidth = 2 * z; ctx.setLineDash([6*z,4*z]);
        ctx.beginPath(); ctx.arc(_p.sx, _p.sy, rr, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        highContrastRing(_p.sx, _p.sy, rr);
        drawCenteredFx(W.Art.get('fx_warning'), _p.sx, _p.sy, rr*2.45, 0.48+0.18*Math.sin(artT*9), artT*0.32);
      } else {
        ctx.fillStyle = 'rgba(255,105,20,0.52)';
        ctx.beginPath(); ctx.arc(_p.sx, _p.sy, rr * (0.82 + p.t * 0.4), 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,225,95,0.7)';
        ctx.beginPath(); ctx.arc(_p.sx, _p.sy, rr * 0.42, 0, Math.PI*2); ctx.fill();
      }
    });
    W.Bosses.eachProjectile(function(p) {
      W.Camera.worldToScreenInto(p.wx, p.wy, _p);
      var rr = 7 * z;
      var st = BOSS_SHOT_STYLE[p.kind] || BOSS_SHOT_STYLE.poison;
      ctx.fillStyle = st[0];
      ctx.beginPath(); ctx.arc(_p.sx, _p.sy, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = st[1]; ctx.lineWidth = 2; ctx.stroke();
    });
  }

  function drawCalamityAltar() {
    if (!W.Calamity || !W.Calamity.isUnlocked()) return;
    var a = W.Calamity.altarPos(), z = W.Camera.zoom;
    W.Camera.worldToScreenInto(a.wx, a.wy, _p);
    if (_p.sx < -120 || _p.sx > W.Camera.vw + 120 || _p.sy < -120 || _p.sy > W.Camera.vh + 120) return;
    var r = 34 * z, cs=W.Calamity.stats?W.Calamity.stats():null;
    if(cs&&cs.summoning){
      drawCenteredFx(W.Art.get('fx_warning'),_p.sx,_p.sy,132*z,0.58+0.2*Math.sin(artT*7),-artT*.22);
      ctx.strokeStyle='rgba(255,225,155,0.95)';ctx.lineWidth=5*z;ctx.beginPath();
      ctx.arc(_p.sx,_p.sy,45*z,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-cs.summonLeft/10));ctx.stroke();
    }
    ctx.fillStyle = W.Calamity.isSummoned() ? 'rgba(70,50,80,0.55)' : 'rgba(110,55,145,0.42)';
    ctx.strokeStyle = 'rgba(215,155,255,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(_p.sx, _p.sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var ang = i * Math.PI / 3 - Math.PI / 2;
      var x = _p.sx + Math.cos(ang) * r * 0.72, y = _p.sy + Math.sin(ang) * r * 0.72;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.font = 'bold ' + Math.round(12 * z) + 'px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.fillStyle = '#f0d8ff';
    var altarLabel=W.Calamity.isSummoned()?'災禍召喚中':(cs&&cs.summoning?'召喚 '+cs.summonName+' · '+Math.ceil(cs.summonLeft)+' 秒（再按取消）':(cs&&cs.ascensionUnlocked?'飛升祭壇 · 碎片 '+cs.divinityShards:'世界災禍祭壇'));
    ctx.fillText(altarLabel, _p.sx, _p.sy - 46 * z);
  }

  function drawDivineShield() {
    if (!W.DivineArms || !W.DivineArms.shieldActive()) return;
    W.Camera.worldToScreenInto(W.Player.wx, W.Player.wy, _p);
    var z = W.Camera.zoom, r = 36 * z;
    ctx.strokeStyle = 'rgba(195,125,255,' + (0.65 + 0.2 * Math.sin(artT * 7)) + ')';
    ctx.fillStyle = 'rgba(130,70,190,0.12)'; ctx.lineWidth = 4 * z;
    ctx.beginPath(); ctx.arc(_p.sx, _p.sy - 20 * z, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }


  function drawDivineWeaponFx() {
    if (!W.DivineArms) return;
    var z = W.Camera.zoom;
    if (W.DivineArms.eachBeam) W.DivineArms.eachBeam(function(b) {
      var p1 = {sx:0,sy:0}, p2 = {sx:0,sy:0};
      W.Camera.worldToScreenInto(b.x1,b.y1,p1); W.Camera.worldToScreenInto(b.x2,b.y2,p2);
      ctx.save(); ctx.globalAlpha = Math.min(1,b.t*7);
      ctx.strokeStyle=b.kind==='domain'?'rgba(255,215,80,0.98)':(b.kind==='wing'?'rgba(120,225,255,0.96)':'rgba(210,150,255,0.95)');
      ctx.lineWidth=(b.kind==='domain'?10:7)*z; ctx.beginPath(); ctx.moveTo(p1.sx,p1.sy); ctx.lineTo(p2.sx,p2.sy); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,245,1)'; ctx.lineWidth=2*z; ctx.beginPath(); ctx.moveTo(p1.sx,p1.sy); ctx.lineTo(p2.sx,p2.sy); ctx.stroke(); ctx.restore();
    });
    if (W.DivineArms.eachWave) W.DivineArms.eachWave(function(w) {
      W.Camera.worldToScreenInto(w.wx,w.wy,_p); ctx.save(); ctx.globalAlpha=Math.min(1,w.t*4);
      ctx.strokeStyle='rgba(255,220,120,0.95)'; ctx.lineWidth=5*z; ctx.beginPath(); ctx.arc(_p.sx,_p.sy,w.r*z,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle='rgba(220,145,255,0.8)'; ctx.lineWidth=2*z; ctx.beginPath(); ctx.arc(_p.sx,_p.sy,w.r*z*0.82,0,Math.PI*2); ctx.stroke(); ctx.restore();
    });
    drawAxeWingFx(z);
  }

  function drawAxeWingFx(z) {
    var axeOn = W.DivineArms.axeTornadoActive();
    var wingOn = W.DivineArms.wingActive();
    var domainOn = W.DivineArms.domainActive();
    W.Camera.worldToScreenInto(W.Player.wx,W.Player.wy,_p);
    var sx=_p.sx,sy=_p.sy,ang,x,y,img;

    if(W.DivineArms.has('axe')&&W.DivineArms.isEquipped('axe')){
      ang=W.DivineArms.axeAngle();
      x=sx+Math.cos(ang)*68*z;y=sy+Math.sin(ang)*34*z;
      img=W.Art.get(axeOn?'ui/divine_axe_on':'ui/divine_axe');
      ctx.save();ctx.globalAlpha=axeOn?0.95:0.82;
      if(img)drawArt(img,x,y+12*z,28,false);
      else{
        ctx.strokeStyle='#ffd66f';ctx.lineWidth=5*z;ctx.beginPath();ctx.moveTo(x-10*z,y+8*z);ctx.lineTo(x+10*z,y-8*z);ctx.stroke();
      }
      if(axeOn){
        ctx.strokeStyle='rgba(255,210,95,0.72)';ctx.lineWidth=5*z;ctx.beginPath();ctx.arc(sx,sy,70*z+Math.sin(artT*10)*8*z,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='rgba(210,145,255,0.58)';ctx.lineWidth=2*z;ctx.beginPath();ctx.arc(sx,sy,102*z+Math.cos(artT*8)*8*z,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }

    if(wingOn){
      /* 翅膀本體由裝備層常駐繪製；發動時只疊加光環。 */
      ctx.save();ctx.globalAlpha=0.58+Math.sin(artT*12)*0.12;
      ctx.strokeStyle='rgba(170,235,255,0.9)';ctx.lineWidth=4*z;
      ctx.beginPath();ctx.arc(sx,sy-12*z,42*z,Math.PI*0.12,Math.PI*0.88);ctx.stroke();
      ctx.restore();
    }

    if(domainOn){
      ctx.save();ctx.globalAlpha=0.72;ctx.strokeStyle='rgba(255,235,135,0.95)';ctx.lineWidth=4*z;
      ctx.beginPath();ctx.arc(sx,sy,120*z,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }

  function drawCalamityBattle() {
    if (!W.Calamity) return;
    var z = W.Camera.zoom, b = W.Calamity.boss ? W.Calamity.boss() : null;

    if (W.Calamity.eachVoid) W.Calamity.eachVoid(function(v) {
      W.Camera.worldToScreenInto(v.wx, v.wy, _p);
      var rr = v.r * z;
      ctx.fillStyle = 'rgba(35,12,55,0.32)';
      ctx.strokeStyle = 'rgba(160,80,215,0.8)'; ctx.lineWidth = 3 * z;
      ctx.beginPath(); ctx.arc(_p.sx, _p.sy, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(_p.sx, _p.sy, rr * (0.35 + 0.08 * Math.sin(artT * 8)), 0, Math.PI * 2); ctx.stroke();
    });

    if (W.Calamity.eachMeteor) W.Calamity.eachMeteor(function(m) {
      W.Camera.worldToScreenInto(m.wx, m.wy, _p);
      var rr = m.r * z;
      if (m.t > 0) {
        ctx.fillStyle = 'rgba(175,55,75,0.12)'; ctx.strokeStyle = 'rgba(255,105,105,0.9)';
        ctx.lineWidth = 2 * z; ctx.setLineDash([7*z,5*z]);
        ctx.beginPath(); ctx.arc(_p.sx, _p.sy, rr, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        highContrastRing(_p.sx, _p.sy, rr);
        drawCenteredFx(W.Art.get('fx_warning'), _p.sx, _p.sy, rr*2.35, 0.5+0.2*Math.sin(artT*10), -artT*0.3);
      } else {
        ctx.fillStyle = 'rgba(235,115,70,0.5)';
        ctx.beginPath(); ctx.arc(_p.sx, _p.sy, rr * (0.7 + m.blast), 0, Math.PI*2); ctx.fill();
      }
    });

    if (W.Calamity.eachBolt) W.Calamity.eachBolt(function(p) {
      W.Camera.worldToScreenInto(p.wx, p.wy, _p);
      ctx.fillStyle = '#d98aff'; ctx.strokeStyle = 'rgba(255,225,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(_p.sx, _p.sy, 6*z, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    });

    if (W.Calamity.eachEye) W.Calamity.eachEye(function(e) {
      W.Camera.worldToScreenInto(e.wx, e.wy, _p);
      ctx.fillStyle = '#3a2146'; ctx.strokeStyle = '#d48cff'; ctx.lineWidth = 3*z;
      ctx.beginPath(); ctx.ellipse(_p.sx, _p.sy, 18*z, 13*z, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f2dcff'; ctx.beginPath(); ctx.arc(_p.sx, _p.sy, 5*z, 0, Math.PI*2); ctx.fill();
    });


    if (W.Calamity.eachBone) W.Calamity.eachBone(function(v) {
      W.Camera.worldToScreenInto(v.wx, v.wy, _p);
      var rise = Math.max(0, Math.min(1, (0.85-v.t)/0.5));
      if(v.t>.35)drawCenteredFx(W.Art.get('fx_warning'),_p.sx,_p.sy,58*z,0.42+0.18*Math.sin(artT*11),artT*.35);
      ctx.fillStyle='rgba(225,215,190,0.9)';ctx.strokeStyle='rgba(90,65,55,0.95)';ctx.lineWidth=2*z;
      ctx.beginPath();ctx.moveTo(_p.sx,_p.sy-30*z*rise);ctx.lineTo(_p.sx-10*z,_p.sy+8*z);ctx.lineTo(_p.sx+10*z,_p.sy+8*z);ctx.closePath();ctx.fill();ctx.stroke();
    });
    if (W.Calamity.eachShock) W.Calamity.eachShock(function(v) {
      W.Camera.worldToScreenInto(v.wx, v.wy, _p);
      ctx.strokeStyle='rgba(210,195,165,0.78)';ctx.lineWidth=6*z;ctx.beginPath();ctx.arc(_p.sx,_p.sy,v.r*z,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='rgba(130,85,170,0.55)';ctx.lineWidth=2*z;ctx.beginPath();ctx.arc(_p.sx,_p.sy,v.r*z*.9,0,Math.PI*2);ctx.stroke();
    });
    if (!b || !b.alive) return;
    W.Camera.worldToScreenInto(b.wx, b.wy, _p);
    var sx=_p.sx, sy=_p.sy, pulse=1+0.04*Math.sin(artT*4), r=70*z*pulse;
    var charge=b.shotWind>0||b.skillWind>0||b.meteorWind>0;
    if(charge)drawCenteredFx(W.Art.get('fx_warning'),sx,sy+8*z,185*z,0.48+0.24*Math.sin(artT*17),artT*.35);
    ctx.globalAlpha = b.hurt > 0 ? 0.65 : 1;
    var cimg = b.art ? ((b.atkFx > 0 ? W.Art.get(b.art + '_atk') : null) || W.Art.get(b.art)) : null;
    if (cimg) {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath(); ctx.ellipse(sx, sy + 14 * z, r * 0.9, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      drawArt(cimg, sx, sy + 18 * z, 190, false);
    } else if (b.id === 'titan') {
      ctx.fillStyle='#3a332f';ctx.strokeStyle='#b7a78d';ctx.lineWidth=5*z;
      ctx.beginPath();ctx.arc(sx,sy-12*z,r*.66,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#211a20';ctx.beginPath();ctx.arc(sx-18*z,sy-20*z,7*z,0,Math.PI*2);ctx.arc(sx+18*z,sy-20*z,7*z,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#6f587d';ctx.lineWidth=10*z;ctx.beginPath();ctx.moveTo(sx-r*.65,sy+5*z);ctx.lineTo(sx-r*.95,sy+r*.55);ctx.moveTo(sx+r*.65,sy+5*z);ctx.lineTo(sx+r*.95,sy+r*.55);ctx.stroke();
      ctx.strokeStyle='#a9967d';ctx.lineWidth=8*z;for(var k=0;k<5;k++){ctx.beginPath();ctx.arc(sx,sy+8*z+k*8*z,r*.52-k*2*z,0.12,Math.PI-0.12);ctx.stroke();}
    } else {
      ctx.fillStyle = '#221b2d'; ctx.strokeStyle = '#a761d1'; ctx.lineWidth = 5*z;
      ctx.beginPath(); ctx.ellipse(sx, sy, r*1.2, r*0.65, -0.12, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c986ef';
      for (var i=0;i<9;i++) {var a=i*Math.PI*2/9+artT*0.12;ctx.beginPath();ctx.arc(sx+Math.cos(a)*r*.72,sy+Math.sin(a)*r*.35,5*z,0,Math.PI*2);ctx.fill();}
    }
    ctx.globalAlpha = 1;
    var bw=190*z,bh=12*z,ratio=Math.max(0,b.hp/b.maxHp);
    ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(sx-bw/2,sy-r*.9,bw,bh);
    ctx.fillStyle=b.id==='titan'?'#b59b75':'#b45de0';ctx.fillRect(sx-bw/2+2,sy-r*.9+2,(bw-4)*ratio,bh-4);
    ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=1;ctx.strokeRect(sx-bw/2,sy-r*.9,bw,bh);
    ctx.font='bold '+Math.round(13*z)+'px -apple-system, sans-serif';ctx.textAlign='center';ctx.fillStyle='#f4ddff';
    var cs2=W.Calamity.stats?W.Calamity.stats():null;
    ctx.fillText((cs2&&cs2.activeAscended?'飛升災禍 Lv.'+(cs2.ascensionCycle+1)+'・':'世界災禍・')+b.name+'  Phase '+b.phase,sx,sy-r*1.04);
  }

  function drawSkinAura() {
    if (!W.Skins || !W.Skins.fieldActive()) return;
    W.Camera.worldToScreenInto(W.Player.wx, W.Player.wy, _p);
    var z=W.Camera.zoom,p=W.Skins.fieldPct(),r=(48+70*(1-p))*z,k=W.Skins.fieldKind?W.Skins.fieldKind():'abyss';
    var rgb=k==='death'?'205,190,160':(k==='star'?'115,180,255':(k==='phoenix'?'255,112,35':'135,70,190'));
    ctx.strokeStyle='rgba('+rgb+','+(0.25+0.5*p)+')';ctx.lineWidth=4*z;
    ctx.beginPath();ctx.arc(_p.sx,_p.sy-16*z,r,0,Math.PI*2);ctx.stroke();
  }

  function drawCarryGhost() {
    if (!W.Game || !W.Game.carryGhost) return;
    var ty = W.Game.carryGhost(_cg);
    if (!ty) return;
    W.Camera.worldToScreenInto(_cg.wx, _cg.wy, _p);
    var z = W.Camera.zoom;
    var ok = W.Build.canPlace(_cg.wx, _cg.wy);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ok ? 'rgba(120,220,120,0.9)' : 'rgba(230,90,80,0.9)';
    ctx.beginPath();
    ctx.arc(_p.sx, _p.sy, 24 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? '#9f9' : '#f99';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(_p.sx, _p.sy, 26 * z, 0, Math.PI * 2);
    ctx.stroke();
    /* 用完務必清掉，否則整張畫面的線條都會變虛線 */
    ctx.setLineDash([]);
  }

  function sleepFx() { sleepT = 2.0; }

  /* 理智偏低時畫面四周收暗，越低越明顯 */
  function drawSanity() {
    if (!W.Stats.isLowSan()) return;
    var k = 1 - (W.Stats.sanPct() / W.CFG.SAN_LOW);
    if (k <= 0) return;
    var C = W.Camera;
    /* 漸層物件依「強度級距＋視窗尺寸」快取，避免每幀重建 */
    var step = Math.round(k * 12);
    var key = step + '_' + Math.round(C.vw) + '_' + Math.round(C.vh);
    if (key !== sanKey) {
      sanKey = key;
      sanGrad = ctx.createRadialGradient(C.vw / 2, C.vh / 2, C.vh * 0.22,
                                         C.vw / 2, C.vh / 2, C.vh * 0.62);
      sanGrad.addColorStop(0, 'rgba(20,0,25,0)');
      sanGrad.addColorStop(1, 'rgba(20,0,25,' + (0.72 * (step / 12)).toFixed(3) + ')');
    }
    ctx.fillStyle = sanGrad;
    ctx.fillRect(0, 0, C.vw, C.vh);
  }

  function drawSleep(dt) {
    if (sleepT <= 0) return;
    sleepT -= dt;
    var P = W.Player;
    W.Camera.worldToScreenInto(P.wx, P.wy, _p);
    var z = W.Camera.zoom;
    var k = 1 - sleepT / 2.0;

    ctx.fillStyle = 'rgba(10,10,30,' + (0.5 * Math.sin(Math.min(1, k * 2) * Math.PI)) + ')';
    ctx.fillRect(0, 0, W.Camera.vw, W.Camera.vh);

    ctx.globalAlpha = Math.min(1, sleepT);
    ctx.fillStyle = '#cfe0ff';
    ctx.font = 'bold ' + Math.round((14 + k * 10) * z) + 'px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Z', _p.sx + (14 + k * 22) * z, _p.sy - (60 + k * 40) * z);
    ctx.font = 'bold ' + Math.round((10 + k * 8) * z) + 'px -apple-system, sans-serif';
    ctx.fillText('z', _p.sx + (4 + k * 12) * z, _p.sy - (48 + k * 26) * z);
    ctx.globalAlpha = 1;
  }

  function loadSprite(url) {
    var want = url || W.CFG.SPRITE_URL;
    /* 同一張（含正在載入中的）就不重複請求，避免啟動時載兩次 */
    if (spriteUrl === want) return;

    var prevImg = sprite, prevUrl = spriteUrl, prevReady = spriteReady;
    spriteUrl = want;
    var img = new Image();
    img.onload = function() {
      sprite = img;
      spriteReady = true;
    };
    img.onerror = function() {
      /* 換裝失敗就留在原本的角色，不要變成沒有圖的圓圈 */
      sprite = prevImg;
      spriteUrl = prevUrl;
      spriteReady = prevReady;
      if (window.__wildsErr) window.__wildsErr('\u26A0 \u89d2\u8272\u5716\u8f09\u5165\u5931\u6557\uff1a' + want);
    };
    img.src = want;
  }

  function setSprite(url) { loadSprite(url); }

  function init(context) {
    ctx = context;
    loadSprite();
    W.Art.load();
  }

  function drawGrid() {
    var C = W.Camera, G = W.CFG.GRID;
    var l = C.viewLeft(), r = C.viewRight();
    var t = C.viewTop(),  b = C.viewBottom();
    var x, y, s;

    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (x = Math.floor(l / G) * G; x <= r; x += G) {
      s = (x - C.wx) * C.zoom + C.vw / 2;
      ctx.moveTo(s, 0); ctx.lineTo(s, C.vh);
    }
    for (y = Math.floor(t / G) * G; y <= b; y += G) {
      s = (y - C.wy) * C.zoom + C.vh / 2;
      ctx.moveTo(0, s); ctx.lineTo(C.vw, s);
    }
    ctx.stroke();
  }

  function drawChunks() {
    var C = W.Camera, K = W.CFG.CHUNK_SIZE, M = W.CFG.CHUNK_MARGIN;
    var c0 = Math.floor(C.viewLeft() / K) - M;
    var c1 = Math.floor(C.viewRight() / K) + M;
    var r0 = Math.floor(C.viewTop() / K) - M;
    var r1 = Math.floor(C.viewBottom() / K) + M;
    var cx, cy, cv, fx, fy, size;

    size = Math.ceil(K * C.zoom) + 1;

    for (cy = r0; cy <= r1; cy++) {
      for (cx = c0; cx <= c1; cx++) {
        W.Camera.worldToScreenInto(cx * K, cy * K, _p);
        fx = Math.floor(_p.sx);
        fy = Math.floor(_p.sy);
        cv = W.World.get(cx, cy);
        if (cv) {
          ctx.drawImage(cv, 0, 0, K, K, fx, fy, size, size);
        } else {
          W.World.request(cx, cy);
          ctx.fillStyle = '#2c3a22';
          ctx.fillRect(fx, fy, size, size);
        }
      }
    }
  }

  function drawChunkLines() {
    var C = W.Camera, K = W.CFG.CHUNK_SIZE;
    var l = C.viewLeft(), r = C.viewRight();
    var t = C.viewTop(),  b = C.viewBottom();
    var x, y, s;

    ctx.strokeStyle = 'rgba(140,200,120,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (x = Math.floor(l / K) * K; x <= r; x += K) {
      s = (x - C.wx) * C.zoom + C.vw / 2;
      ctx.moveTo(s, 0); ctx.lineTo(s, C.vh);
    }
    for (y = Math.floor(t / K) * K; y <= b; y += K) {
      s = (y - C.wy) * C.zoom + C.vh / 2;
      ctx.moveTo(0, s); ctx.lineTo(C.vw, s);
    }
    ctx.stroke();
  }

  function drawChunkLabels() {
    var C = W.Camera, K = W.CFG.CHUNK_SIZE;
    var l = C.viewLeft(), r = C.viewRight();
    var t = C.viewTop(),  b = C.viewBottom();
    var x, y;

    ctx.fillStyle = 'rgba(160,210,140,0.45)';
    ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (x = Math.floor(l / K) * K; x <= r; x += K) {
      for (y = Math.floor(t / K) * K; y <= b; y += K) {
        W.Camera.worldToScreenInto(x + 8, y + 6, _p);
        ctx.fillText(Math.floor(x / K) + ',' + Math.floor(y / K), _p.sx, _p.sy);
      }
    }
  }

  function drawWorldBorder() {
    var C = W.Camera, S = W.CFG.WORLD_SIZE;
    W.Camera.worldToScreenInto(0, 0, _p);
    ctx.strokeStyle = 'rgba(220,120,90,0.8)';
    ctx.lineWidth = 4;
    ctx.strokeRect(_p.sx, _p.sy, S * C.zoom, S * C.zoom);
  }

  function drawOneNode(nd, sx, sy, alive) {
    var ty = nd.type;
    var z = W.Camera.zoom;
    var img = W.Art.get(alive ? NODE_ART[ty] : NODE_ART_DEAD[ty]);

    if (img) {
      if (ty === 5) {
        ctx.fillStyle = 'rgba(190,140,255,' + (0.16 + 0.08 * Math.sin(artT * 3 + nd.wx)) + ')';
        ctx.beginPath();
        ctx.arc(sx, sy - 8 * z, 24 * z, 0, Math.PI * 2);
        ctx.fill();
      }
      shadow(sx + 1, sy + 3, 11 * z, 4.5 * z);
      drawArt(img, sx, sy + 4 * z, alive ? W.CFG.ART_NODE_H[ty] : W.CFG.ART_NODE_DEAD_H[ty], false);
      return;
    }

    if (!alive) return;

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 4, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (ty === 0) {
      ctx.fillStyle = '#5a3c22';
      ctx.fillRect(sx - 3, sy - 8, 6, 12);
      ctx.fillStyle = '#2f6b30';
      ctx.beginPath();
      ctx.arc(sx, sy - 16, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3d8a3c';
      ctx.beginPath();
      ctx.arc(sx - 4, sy - 20, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (ty === 1) {
      ctx.fillStyle = '#8a8a80';
      ctx.beginPath();
      ctx.arc(sx, sy - 4, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a5a59a';
      ctx.beginPath();
      ctx.arc(sx - 4, sy - 8, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (ty === 2) {
      ctx.fillStyle = '#487c33';
      ctx.beginPath();
      ctx.arc(sx, sy - 2, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (ty === 3) {
      ctx.fillStyle = '#3f7a34';
      ctx.beginPath();
      ctx.arc(sx, sy - 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8383f';
      ctx.fillRect(sx - 5, sy - 6, 3, 3);
      ctx.fillRect(sx + 2, sy - 1, 3, 3);
      ctx.fillRect(sx - 1, sy - 9, 3, 3);
    } else {
      ctx.fillStyle = '#6f6a60';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 9);
      ctx.lineTo(sx + 6, sy + 3);
      ctx.lineTo(sx - 6, sy + 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawNodes(before) {
    var C = W.Camera, K = W.CFG.CHUNK_SIZE;
    var c0 = Math.floor(C.viewLeft() / K);
    var c1 = Math.floor(C.viewRight() / K);
    var r0 = Math.floor(C.viewTop() / K);
    var r1 = Math.floor(C.viewBottom() / K);
    var now = Date.now();
    var py = W.Player.wy;
    var cx, cy, a, i, nd, alive;

    for (cy = r0; cy <= r1; cy++) {
      for (cx = c0; cx <= c1; cx++) {
        a = W.Res.nodesFor(cx, cy);
        for (i = 0; i < a.length; i++) {
          nd = a[i];
          if (before ? (nd.wy >= py) : (nd.wy < py)) continue;
          alive = W.Res.isAlive(nd, now);
          W.Camera.worldToScreenInto(nd.wx, nd.wy, _p);
          if (_p.sx < -40 || _p.sy < -60 || _p.sx > C.vw + 40 || _p.sy > C.vh + 40) continue;
          drawOneNode(nd, _p.sx, _p.sy, alive);
        }
      }
    }
  }

  function drawTarget(dt) {
    _pulse += dt * 3;
    var P = W.Player;
    var nd = W.Res.findTarget(P.wx, P.wy, P.faceX, P.faceY);
    if (!nd) return;
    W.Camera.worldToScreenInto(nd.wx, nd.wy, _p);
    var z = W.Camera.zoom;
    var k = 1 + Math.sin(_pulse) * 0.12;

    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(_p.sx, _p.sy + 4 * z, 26 * z * k, 12 * z * k, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,215,90,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(_p.sx, _p.sy + 4 * z, 26 * z * k, 12 * z * k, 0, 0, Math.PI * 2);
    ctx.stroke();

    var name = (W.Res.nameOf ? W.Res.nameOf(nd.type) : '');
    if (name) {
      ctx.font = 'bold ' + Math.round(13 * z) + 'px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(name, _p.sx, _p.sy - 52 * z);
      ctx.fillStyle = '#ffe89a';
      ctx.fillText(name, _p.sx, _p.sy - 52 * z);
    }
  }


  function drawOneMob(m, sx, sy) {
    var ty = m.type;
    var z = W.Camera.zoom;

    if (ty === 3) {
      var wob = 1 + 0.08 * Math.sin(artT * 6 + m.seed);
      ctx.fillStyle = 'rgba(10,6,18,0.82)';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 12 * z, 15 * z * wob, 20 * z * wob, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(30,12,40,0.5)';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 2 * z, 20 * z, 10 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.arc(sx - 5 * z, sy - 16 * z, 2.6 * z, 0, Math.PI * 2);
      ctx.arc(sx + 5 * z, sy - 16 * z, 2.6 * z, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    var moving = (m.vx * m.vx + m.vy * m.vy) > 0.02;
    var img = W.Art.get(moving && (Math.floor(artT * W.CFG.MOB_ANIM_FPS + m.seed) % 2 === 1)
      ? MOB_ART_MOVE[ty] : MOB_ART[ty]);

    if (img) {
      shadow(sx, sy + 4 * z, 11 * z, 4 * z);
      drawArt(img, sx, sy + 5 * z, W.CFG.ART_MOB_H[ty], m.vx < -0.05);
      if (m.hurt > 2.6) {
        ctx.fillStyle = 'rgba(230,80,60,0.35)';
        ctx.beginPath();
        ctx.arc(sx, sy - 8 * z, 15 * z, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    var body, head, r;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 5, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (ty === 0)      { body = '#9a6b3c'; head = '#7d5530'; r = 12; }
    else if (ty === 1) { body = '#cfc4b0'; head = '#b0a48f'; r = 8; }
    else               { body = '#5b5f66'; head = '#43474d'; r = 12; }

    if (m.hurt > 2.6) { body = '#e8735f'; }

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 3, r, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(sx + m.vx * r * 0.8, sy - 5 + m.vy * r * 0.5, r * 0.52, 0, Math.PI * 2);
    ctx.fill();

    if (ty === 2) {
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(sx + m.vx * r * 0.9 - 2, sy - 7 + m.vy * r * 0.5, 2, 2);
      ctx.fillRect(sx + m.vx * r * 0.9 + 1, sy - 7 + m.vy * r * 0.5, 2, 2);
    }
  }

  function drawMobs(before) {
    var C = W.Camera;
    var py = W.Player.wy;
    var i, m, n = W.Mobs.count();

    for (i = 0; i < n; i++) {
      m = W.Mobs.at(i);
      if (!m.alive) continue;
      if (before ? (m.wy >= py) : (m.wy < py)) continue;
      W.Camera.worldToScreenInto(m.wx, m.wy, _p);
      if (_p.sx < -40 || _p.sy < -40 || _p.sx > C.vw + 40 || _p.sy > C.vh + 40) continue;
      drawOneMob(m, _p.sx, _p.sy);
    }
  }

  function drawHurtFlash() {
    if (W.Settings && (!W.Settings.get('flashes') || W.Settings.get('reducedMotion'))) return;
    if (!W.Stats.isHurt()) return;
    ctx.fillStyle = 'rgba(200,50,40,0.22)';
    ctx.fillRect(0, 0, W.Camera.vw, W.Camera.vh);
  }

  function drawEventFlash(dt) {
    if (W.Settings && (!W.Settings.get('flashes') || W.Settings.get('reducedMotion'))) { flashT = 0; return; }
    if (flashT <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, flashT / flashMax);
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, W.Camera.vw, W.Camera.vh);
    ctx.restore();
    flashT -= dt;
    if (flashT < 0) flashT = 0;
  }

  function guidePill(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* 指針固定在玩家頭頂，方向使用世界座標差，因此目標在畫面外也能可靠指路。 */
  function drawGuideArrow() {
    if (!W.Guide || !W.Guide.current) return;
    var g = W.Guide.current();
    if (!g || !g.on) return;
    var P = W.Player;
    W.Camera.worldToScreenInto(P.wx, P.wy, _p);
    var dx = g.wx - P.wx, dy = g.wy - P.wy;
    var d = Math.sqrt(dx * dx + dy * dy);
    var ang = Math.atan2(dy, dx);
    var s = Math.max(0.84, Math.min(1.18, W.Camera.zoom));
    var cx = _p.sx, cy = _p.sy - 72 * s;
    var pulse = 1 + Math.sin(artT * 7) * 0.08;
    var color = g.arrived ? '#8ff08b' : (g.kind === 'altar' ? '#8fe7ff' : '#ffd65f');

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 5 * s;
    ctx.strokeStyle = 'rgba(25,20,12,.9)'; ctx.fillStyle = color; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.arc(cx, cy, 19 * s * pulse, 0, Math.PI * 2); ctx.stroke();

    if (g.arrived) {
      ctx.fillStyle = 'rgba(15,45,18,.88)'; ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = color;
      ctx.font = 'bold ' + Math.round(22 * s) + 'px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✓', cx, cy + 1);
    } else {
      ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(24 * s * pulse, 0);
      ctx.lineTo(-10 * s, -11 * s);
      ctx.lineTo(-5 * s, 0);
      ctx.lineTo(-10 * s, 11 * s);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    var label = g.label + ' · ' + (g.arrived ? '已抵達' : Math.round(d));
    ctx.save();
    ctx.font = 'bold ' + Math.round(11 * s) + 'px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var tw = Math.min(W.Camera.vw * 0.54, ctx.measureText(label).width + 16 * s);
    var th = 20 * s, tx = cx - tw / 2, ty = cy - 34 * s;
    guidePill(tx, ty, tw, th, 8 * s);
    ctx.fillStyle = 'rgba(9,14,8,.78)'; ctx.fill();
    ctx.strokeStyle = color; ctx.globalAlpha = 0.72; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff7d0';
    ctx.fillText(label, cx, ty + th / 2 + 0.5);
    ctx.restore();
  }

  function drawOneBuild(s, sx, sy, now) {
    var ty = s.type, f;
    var z = W.Camera.zoom;
    var aimg = null;
    if (ty === 0) aimg = W.Art.get('campfire');
    else if (ty === 1) aimg = W.Art.get('wall');
    else if (ty === 2) aimg = W.Art.get('bed');
    else if (ty === 3) aimg = W.Art.get('ui/furnace');
    else if (ty === 4) aimg = W.Art.get('workbench');
    else if (ty === 5) aimg = W.Art.get('crate');
    else if (ty === 6) aimg = W.Art.get('fence');
    else if (ty === 7) aimg = W.Art.get('rack');

    if (aimg) {
      shadow(sx, sy + 4 * z, 13 * z, 5 * z);
      drawArt(aimg, sx, sy + 6 * z, buildH(ty), false);
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 5, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (ty === 0) {
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx - 9, sy + 3); ctx.lineTo(sx + 9, sy - 3);
      ctx.moveTo(sx + 9, sy + 3); ctx.lineTo(sx - 9, sy - 3);
      ctx.stroke();
      f = 1 + 0.22 * Math.sin(now * 0.008 + s.wx);
      ctx.fillStyle = '#e8802f';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 11, 7 * f, 12 * f, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 9, 3.5 * f, 7 * f, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (ty === 1) {
      ctx.fillStyle = '#7a5330';
      ctx.fillRect(sx - 16, sy - 20, 32, 26);
      ctx.fillStyle = '#8e6339';
      ctx.fillRect(sx - 16, sy - 20, 32, 6);
      ctx.fillRect(sx - 16, sy - 8, 32, 6);
      ctx.strokeStyle = '#4b3320';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 16, sy - 20, 32, 26);
    } else {
      ctx.fillStyle = '#8d7f66';
      ctx.fillRect(sx - 14, sy - 8, 28, 14);
      ctx.fillStyle = '#c9bda4';
      ctx.fillRect(sx - 14, sy - 8, 12, 14);
      ctx.strokeStyle = '#5a5040';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 14, sy - 8, 28, 14);
    }
  }

  function buildH(ty) {
    if (ty === 0) return W.CFG.ART_FIRE_H;
    if (ty === 1) return W.CFG.ART_WALL_H;
    if (ty === 3) return W.CFG.ART_FURNACE_H;
    if (ty === 4) return W.CFG.ART_BENCH_H;
    if (ty === 5) return W.CFG.ART_STORE_H;
    if (ty === 6) return W.CFG.ART_FENCE_H;
    if (ty === 7) return W.CFG.ART_RACK_H;
    return W.CFG.ART_BED_H;
  }

  function drawBuilds(before) {
    var C = W.Camera;
    var py = W.Player.wy;
    var now = Date.now();
    var i, s, n = W.Build.count();

    for (i = 0; i < n; i++) {
      s = W.Build.at(i);
      if (before ? (s.wy >= py) : (s.wy < py)) continue;
      W.Camera.worldToScreenInto(s.wx, s.wy, _p);
      if (_p.sx < -50 || _p.sy < -60 || _p.sx > C.vw + 50 || _p.sy > C.vh + 50) continue;
      drawOneBuild(s, _p.sx, _p.sy, now);
    }
  }

  function drawPlaceGhost() {
    if (!W.Game || !W.Game.placeMode || !W.Game.placeMode()) return;
    var P = W.Player;
    var wx = P.wx + P.faceX * W.CFG.PLACE_DIST;
    var wy = P.wy + P.faceY * W.CFG.PLACE_DIST;
    var ok = W.Build.canPlace(wx, wy);
    W.Camera.worldToScreenInto(wx, wy, _p);
    ctx.strokeStyle = ok ? 'rgba(150,240,140,0.9)' : 'rgba(240,110,90,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(_p.sx - 16, _p.sy - 16, 32, 32);
  }

  /* 光暈貼圖只建立一次，之後每幀只做 drawImage，不在迴圈內配置物件 */
  function makeLight() {
    if (lightCv) return;
    var S = 256;
    lightCv = document.createElement('canvas');
    lightCv.width = S;
    lightCv.height = S;
    var c = lightCv.getContext('2d');
    var g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.72)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.28)');
    g.addColorStop(1,    'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
  }

  function ensureNightLayer(w, h) {
    if (nightCv && nightW === w && nightH === h) return;
    if (!nightCv) nightCv = document.createElement('canvas');
    nightCv.width = w;
    nightCv.height = h;
    nightW = w;
    nightH = h;
    nightCtx = nightCv.getContext('2d');
  }

  function punchLight(c, sx, sy, radius) {
    c.drawImage(lightCv, sx - radius, sy - radius, radius * 2, radius * 2);
  }

  function drawNight() {
    var dark = W.Time.darkness();
    if (dark < 0.02) return;

    var C = W.Camera;
    makeLight();
    ensureNightLayer(Math.ceil(C.vw), Math.ceil(C.vh));

    nightCtx.globalCompositeOperation = 'source-over';
    nightCtx.clearRect(0, 0, nightW, nightH);
    nightCtx.fillStyle = 'rgba(8,12,32,1)';
    nightCtx.fillRect(0, 0, nightW, nightH);

    nightCtx.globalCompositeOperation = 'destination-out';

    W.Camera.worldToScreenInto(W.Player.wx, W.Player.wy, _p);
    punchLight(nightCtx, _p.sx, _p.sy, W.CFG.LIGHT_PLAYER);

    var i, s, n = W.Build.count(), flick;

    /* 夜光蘑菇是小光源，玩家在夜裡遠遠就能看到 */
    var nowMs = Date.now();
    var mi;
    for (mi = 0; mi < W.Res.nearCount(); mi++) {
      s = W.Res.nearAt(mi);
      if (s.type !== 5) continue;
      if (!W.Res.isAlive(s, nowMs)) continue;
      W.Camera.worldToScreenInto(s.wx, s.wy, _p);
      punchLight(nightCtx, _p.sx, _p.sy, 70);
    }

    for (i = 0; i < n; i++) {
      s = W.Build.at(i);
      if (s.type !== W.Build.TYPE.FIRE && s.type !== W.Build.TYPE.FURNACE) continue;
      W.Camera.worldToScreenInto(s.wx, s.wy, _p);
      if (_p.sx < -300 || _p.sy < -300 || _p.sx > nightW + 300 || _p.sy > nightH + 300) continue;
      flick = 1 + 0.06 * Math.sin(Date.now() * 0.006 + s.wx);
      punchLight(nightCtx, _p.sx, _p.sy,
        ((s.type === W.Build.TYPE.FURNACE) ? W.CFG.LIGHT_FIRE * 0.55 : W.CFG.LIGHT_FIRE) * flick);
    }

    nightCtx.globalCompositeOperation = 'source-over';

    ctx.globalAlpha = dark;
    ctx.drawImage(nightCv, 0, 0, nightW, nightH);
    ctx.globalAlpha = 1;
  }

  function drawPlayer(dt) {
    var P = W.Player;
    W.Camera.worldToScreenInto(P.wx, P.wy, _p);
    var z = W.Camera.zoom;
    var r = W.CFG.PLAYER_RADIUS * z;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(_p.sx, _p.sy + r * 0.7, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!spriteReady) { drawPlayerFallback(_p.sx, _p.sy, r, P); return; }

    if (P.moving) { walkT += dt; } else { walkT = 0; }

    /* 揮擊瞬間朝面向方向前傾再彈回 */
    var lungeK = (slashT > 0) ? (slashT / 0.16) : 0;
    var lx = P.faceX * 7 * z * lungeK;
    var ly = P.faceY * 7 * z * lungeK;

    var row, flip = false;
    if (Math.abs(P.faceY) >= Math.abs(P.faceX)) {
      row = (P.faceY >= 0) ? 0 : 1;
    } else {
      row = 2;
      flip = (P.faceX < 0);
    }

    var col = P.moving ? (1 + (Math.floor(walkT * W.CFG.WALK_FPS) % 4)) : 0;

    var C = W.CFG.SPRITE_CELL;
    var h = W.CFG.SPRITE_H * z;
    var w = h;
    var dx = _p.sx + lx - w / 2;
    var dy = _p.sy + ly + r * 0.7 - h + (W.CFG.SPRITE_FOOT / C) * h;

    if (flip) {
      ctx.save();
      ctx.translate(_p.sx + lx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, col * C, row * C, C, C, -w / 2, dy, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(sprite, col * C, row * C, C, C, dx, dy, w, h);
    }
  }

  function drawRotatedEquipment(name, x, y, hWorld, angle, alpha) {
    var img = W.Art.get(name); if (!img) return false;
    var h = hWorld * W.Camera.zoom, w = h * (img.width / img.height);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
    return true;
  }

  /* 背部裝備先畫，再畫角色；神槍、神劍與神翼不再只是後台數值。 */
  function drawEquipmentBack() {
    if (!W.DivineArms || !W.Art) return;
    var P = W.Player, z = W.Camera.zoom, img, active;
    W.Camera.worldToScreenInto(P.wx, P.wy, _p);
    var sx = _p.sx, sy = _p.sy;

    if (W.DivineArms.has('wing') && W.DivineArms.isEquipped('wing')) {
      active = W.DivineArms.wingActive();
      img = W.Art.get(active ? 'ui/divine_wing_on' : 'ui/divine_wing') || W.Art.get('ui/divine_wing');
      ctx.save(); ctx.globalAlpha = active ? 0.9 : 0.5;
      if (img) drawArt(img, sx, sy + 23 * z, 68, false);
      ctx.restore();
    }
    if (W.DivineArms.has('gun') && W.DivineArms.isEquipped('gun')) {
      drawRotatedEquipment('ui/divine_gun', sx - 12*z, sy - 24*z, 38, -0.72, 0.72);
    }
    if (W.DivineArms.has('sword') && W.DivineArms.isEquipped('sword')) {
      drawRotatedEquipment('ui/divine_sword', sx + 12*z, sy - 25*z, 40, 0.72, 0.72);
    }
  }

  function drawBowInHand(x, y, angle, z) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.strokeStyle='#8a5b31'; ctx.lineWidth=3*z;
    ctx.beginPath(); ctx.arc(0, 0, 15*z, -1.05, 1.05); ctx.stroke();
    ctx.strokeStyle='#e8dfc7'; ctx.lineWidth=1*z; ctx.beginPath();
    ctx.moveTo(7.5*z,-13*z);ctx.lineTo(7.5*z,13*z);ctx.stroke();ctx.restore();
  }

  /* 主手與盾牌在角色前景層，會跟著朝向與揮擊移動。 */
  function drawEquipmentFront() {
    if (!W.Art) return;
    var P = W.Player, z = W.Camera.zoom, fx=P.faceX||0, fy=P.faceY||1;
    var len=Math.sqrt(fx*fx+fy*fy)||1;fx/=len;fy/=len;
    W.Camera.worldToScreenInto(P.wx,P.wy,_p);
    var sx=_p.sx,sy=_p.sy-13*z,px=-fy,py=fx;
    var swing=(slashT>0?Math.sin((slashT/0.16)*Math.PI)*0.9:0);
    var tool=W.Craft&&W.Craft.equipped?W.Craft.equipped():'';
    var hx=sx+fx*15*z+px*11*z,hy=sy+fy*10*z+py*7*z;
    var angle=Math.atan2(fy,fx)+Math.PI/2+swing;

    if(tool==='axe'||tool==='maxe'){
      ctx.save(); if(tool==='maxe'){ctx.shadowColor='rgba(150,225,255,.9)';ctx.shadowBlur=7*z;}
      drawRotatedEquipment('ui/axe',hx,hy,31,angle,0.96);ctx.restore();
    }else if(tool==='pick'||tool==='mpick'){
      ctx.save(); if(tool==='mpick'){ctx.shadowColor='rgba(150,225,255,.9)';ctx.shadowBlur=7*z;}
      drawRotatedEquipment('ui/pick',hx,hy,31,angle,0.96);ctx.restore();
    }else if(tool==='bow'){
      drawBowInHand(hx,hy,Math.atan2(fy,fx),z);
    }

    if(W.DivineArms&&W.DivineArms.has('shield')&&W.DivineArms.isEquipped('shield')){
      var shieldOn=W.DivineArms.shieldActive();
      var shx=sx+fx*10*z-px*13*z,shy=sy+fy*7*z-py*6*z;
      drawRotatedEquipment(shieldOn?'ui/divine_shield_on':'ui/divine_shield',shx,shy,31,0,shieldOn?1:0.8);
    }
  }

  function drawSlash(dt) {
    if (slashT <= 0) return;
    slashT -= dt;
    var P = W.Player;
    W.Camera.worldToScreenInto(P.wx, P.wy, _p);
    var z = W.Camera.zoom;
    var ang = Math.atan2(slashFy, slashFx);
    var k = slashT / 0.16;
    if (k < 0) k = 0;

    ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * k) + ')';
    ctx.lineWidth = 5 * z;
    ctx.beginPath();
    ctx.arc(_p.sx, _p.sy, 34 * z, ang - 0.9, ang + 0.9);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,215,90,' + (0.6 * k) + ')';
    ctx.lineWidth = 2 * z;
    ctx.beginPath();
    ctx.arc(_p.sx, _p.sy, 38 * z, ang - 0.7, ang + 0.7);
    ctx.stroke();
  }

  function drawPlayerFallback(sx, sy, r, P) {
    ctx.fillStyle = '#e8d9a8';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2f1c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + P.faceX * r * 1.5, sy + P.faceY * r * 1.5);
    ctx.stroke();
  }


  function draw(dt) {
    artT += dt;
    ctx.fillStyle = '#2c3a22';
    ctx.fillRect(0, 0, W.Camera.vw, W.Camera.vh);
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawChunks();
    if (W.CFG.DEBUG) {
      drawGrid();
      drawChunkLines();
      drawChunkLabels();
    }
    drawWorldBorder();
    drawCalamityAltar();
    drawCalamityBattle();
    drawTarget(dt);
    drawPlaceGhost();
    drawSites(true);
    drawBuilds(true);
    drawNodes(true);
    drawMobs(true);
    drawBossHazards();
    drawBosses();
    drawMates();
    W.Arrows.each(drawArrow);
    drawEquipmentBack();
    drawHonorTrail();
    drawPlayer(dt);
    drawEquipmentFront();
    drawHonorCrown();
    drawDivineShield();
    drawDivineWeaponFx();
    drawSkinAura();
    drawSlash(dt);
    drawFeedbackFx();
    drawCarryGhost();
    drawDmg(dt);
    drawMobs(false);
    drawNodes(false);
    drawBuilds(false);
    drawSites(false);
    drawNight();
    drawSleep(dt);
    drawGuideArrow();
    ctx.restore();
    drawSanity();
    drawHurtFlash();
    drawEventFlash(dt);
    W.Minimap.draw(ctx, W.Camera.vw);
  }

  return { init: init, draw: draw, slash: slash, flash: flash, dmgText: dmgText, sleepFx: sleepFx, setSprite: setSprite,
    impact:impact,travelFx:travelFx,dodgeFx:dodgeFx,phaseFx:phaseFx,shake:shake,stepFrame:stepFrame,slowMotion:slowMotion };
})();
