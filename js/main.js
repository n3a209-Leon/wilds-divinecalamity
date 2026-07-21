window.W = window.W || {};

W.Game = (function() {
  var canvas = null, ctx = null;
  var last = 0;
  var fps = 0, fpsAcc = 0, fpsCount = 0;
  var elPos, elChunk, elFps;
  var hudTimer = 0;
  var frame = 0;
  var elToast, toastT = 0;
  var elHp, elFood, elStam, elSan, elTime, elMates, elDivine, elGuideTitle, elGuideHint;
  var elJournalTrackTitle, elJournalTrackText, elJournalTrackFill;
  var deadT = 0;
  var craftOpen = false;
  var travelOpen = false, equipOpen = false, journalOpen = false, rewardOpen = false;
  var updateReg = null, reloadOnController = false;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, W.Settings ? W.Settings.dprCap() : W.CFG.MAX_DPR);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W.Camera.setViewport(w, h);
  }

  function updateHUD(dt) {
    hudTimer += dt;
    if (hudTimer < 0.25) return;
    hudTimer = 0;
    elPos.textContent   = '座標 ' + Math.round(W.Player.wx) + ', ' + Math.round(W.Player.wy);
    elChunk.textContent = '區塊 ' + W.Player.chunkX() + ', ' + W.Player.chunkY() + '　' + W.World.NAMES[W.Player.terrain()];
    elFps.textContent   = Math.round(fps) + ' FPS';
    elHp.style.width   = (W.Stats.hpPct() * 100).toFixed(0) + '%';
    elFood.style.width = (W.Stats.foodPct() * 100).toFixed(0) + '%';
    elStam.style.width = (W.Stats.stamPct() * 100).toFixed(0) + '%';
    if (elSan) elSan.style.width = (W.Stats.sanPct() * 100).toFixed(0) + '%';
    if (elMates) {
      elMates.textContent = (W.Mates && W.Mates.recruitedCount() > 0)
        ? ('\uD83D\uDC65 \u5925\u4f34 ' + W.Mates.recruitedCount() + '/' + W.Mates.count()
           + (W.Mates.stats().hungry ? '\uff08\u9913\u4e86 ' + W.Mates.stats().hungry + '\uff09' : ''))
        : '';
    }
    if(elDivine&&W.DivineArms)updateDivineHud();
    if (W.Guide && elGuideTitle && elGuideHint) updateGuideHud();
    if (W.Journal && elJournalTrackText) updateJournalHud();
    if (W.Rewards) updateRewardBadge();
    elTime.textContent = '\u7b2c ' + W.Time.dayNo() + ' \u5929 ' + W.Time.clock() + ' \u00b7 ' + W.Time.phase();
  }

  var _guideSig = '';
  function updateGuideHud() {
    var g = W.Guide.current();
    if (!g || !g.on) return;
    var dist = g.arrived ? '已抵達' : ('距離 ' + Math.round(g.distance));
    var sig = g.kind + '|' + g.id + '|' + dist + '|' + g.hint;
    if (sig === _guideSig) return;
    _guideSig = sig;
    elGuideTitle.textContent = '🧭 ' + g.label + ' · ' + dist;
    elGuideHint.textContent = g.hint;
  }

  var _journalSig = '';
  function updateJournalHud() {
    var cur = W.Journal.current(), st = W.Journal.stats();
    var sig = st.completed + '|' + st.claimed + '|' + (cur ? cur.id + '|' + cur.value + '|' + cur.max + '|' + cur.text : 'all');
    if (sig === _journalSig) return;
    _journalSig = sig;
    if (!cur) {
      elJournalTrackTitle.textContent = '📜 冒險日誌 · 全部完成';
      elJournalTrackText.textContent = st.unclaimed ? ('還有 ' + st.unclaimed + ' 份獎勵可以領取') : '荒野傳奇已完整記錄';
      elJournalTrackFill.style.width = '100%';
      return;
    }
    elJournalTrackTitle.textContent = '📜 ' + cur.chapter;
    elJournalTrackText.textContent = cur.title + ' · ' + cur.text;
    elJournalTrackFill.style.width = Math.max(0, Math.min(100, cur.value / cur.max * 100)) + '%';
  }

  var _rewardSig = '';
  function updateRewardBadge() {
    var s=W.Rewards.stats(),n=s.unseen+s.journalUnclaimed,b=document.getElementById('reward-badge');
    if(!b)return;
    var sig=String(n);if(sig===_rewardSig)return;_rewardSig=sig;
    b.textContent=n>9?'9+':String(n);b.className=n>0?'on':'';
  }

  /* 神武 HUD：圖示 + 文字。只在狀態改變時重建 DOM，避免每次刷新都動 innerHTML。 */
  var _divineSig = '';
  var DIVINE_ICON = {
    shield: 'divine_shield', gun: 'divine_gun', sword: 'divine_sword',
    axe: 'divine_axe', wing: 'divine_wing'
  };
  function updateDivineHud() {
    var ds = W.DivineArms.stats();
    var sig = ds.owned + '|' + (ds.shield ? 1 : 0) + (ds.gun ? 1 : 0) + (ds.sword ? 1 : 0)
            + (ds.axe ? 1 : 0) + (ds.wing ? 1 : 0)
            + '|eq:' + (W.DivineArms.isEquipped('shield') ? 1 : 0) + (W.DivineArms.isEquipped('gun') ? 1 : 0)
            + (W.DivineArms.isEquipped('sword') ? 1 : 0) + (W.DivineArms.isEquipped('axe') ? 1 : 0)
            + (W.DivineArms.isEquipped('wing') ? 1 : 0)
            + '|' + (ds.active ? 1 : 0) + (ds.axeActive ? 1 : 0) + (ds.wingActive ? 1 : 0)
            + '|' + (ds.overdrive ? 1 : 0) + (ds.domain ? 1 : 0) + '|' + (ds.label || '');
    if (sig === _divineSig) return;
    _divineSig = sig;
    elDivine.className = 'hud-line divine-hud' + ((ds.overdrive || ds.axeActive || ds.wingActive || ds.domain) ? ' active' : '');
    if (!ds.owned) { elDivine.textContent = ''; return; }
    var html = '', k;
    for (k in DIVINE_ICON) {
      if (!DIVINE_ICON.hasOwnProperty(k) || !ds[k]) continue;
      var equipped = W.DivineArms.isEquipped(k);
      var on = (k === 'shield') ? ds.active
             : ((k === 'axe') ? (ds.axeActive || ds.domain)
             : ((k === 'wing') ? (ds.wingActive || ds.domain) : (ds.overdrive || ds.domain)));
      html += '<img class="dv-ico' + (equipped ? '' : ' off') + '" alt="" src="' + W.CFG.ART_DIR + 'ui/' + DIVINE_ICON[k]
            + (on ? '_on' : '') + '.png">';
    }
    html += '<span class="dv-txt">神武裝備 ' + (ds.equipped || 0) + '/' + ds.owned
          + (ds.label ? ' \u00b7 ' + ds.label : '') + '</span>';
    elDivine.innerHTML = html;
  }

  function showToast(msg) {
    elToast.textContent = msg;
    elToast.style.opacity = '1';
    toastT = W.CFG.TOAST_TIME;
  }

  function tickToast(dt) {
    if (toastT <= 0) return;
    toastT -= dt;
    if (toastT <= 0) { elToast.style.opacity = '0'; }
  }

  function craftIcon(r) {
    var map = { axe: 'ui/axe', pick: 'ui/pick', maxe: 'ui/axe', mpick: 'ui/pick',
                fire: 'ui/campfire', furnace: 'ui/furnace', metal: 'ui/metal',
                soup: 'ui/soup', cook: 'ui/cooked', arrow: 'ui/arrow',
                bench: 'workbench', store: 'crate', wall: 'wall', fence: 'fence',
                rack: 'rack', bed: 'bed', jerky: 'ui/jerky' };
    if (map[r.id]) return '<img class="itm-img" src="' + W.CFG.ART_DIR + map[r.id] + '.png" alt="">';
    return r.icon;
  }

  function renderCraft() {
    var el = document.getElementById('craft-list');
    var rs = W.Craft.list();
    var html = '', i, r, own, ok;

    for (i = 0; i < rs.length; i++) {
      r = rs[i];
      own = (r.kind === 'tool' && W.Craft.has(r.id));
      ok = W.Craft.canAfford(r) && !own;
      html += '<div class="craft-row' + (ok ? '' : ' no') + '">'
           +    '<div class="craft-icon">' + craftIcon(r) + '</div>'
           +    '<div class="craft-info">' + r.name
           +      '<div class="craft-cost">' + W.Craft.costText(r) + '</div>'
           +      '<div class="' + (own ? 'craft-owned' : 'craft-cost') + '">'
           +        (own ? '\u5df2\u64c1\u6709' : r.desc) + '</div>'
           +    '</div>'
           +    (own ? '' : '<button class="craft-go" data-id="' + r.id + '">\u5236\u4f5c</button>')
           +  '</div>';
    }
    el.innerHTML = html;
  }

  function openCraft() {
    craftOpen = true;
    renderCraft();
    document.getElementById('craft-panel').classList.add('open');
  }

  function closeCraft() {
    craftOpen = false;
    document.getElementById('craft-panel').classList.remove('open');
  }

  function onCraftClick(e) {
    var id = e.target && e.target.getAttribute ? e.target.getAttribute('data-id') : null;
    if (!id) return;
    var r = W.Craft.make(id);
    if (r === true) {
      if (W.Sfx) W.Sfx.place();
      showToast('\u5236\u4f5c\u5b8c\u6210');
      renderCraft();
    } else {
      showToast(r);
    }
  }

  var _charIdx = 0;

  function applyCharacterSprite() {
    var base=W.CFG.SPRITE_LIST[_charIdx];
    W.Render.setSprite(W.Skins&&W.Skins.spriteFor?W.Skins.spriteFor(_charIdx,base):base);
  }

  function loadCharPref() {
    var v = 0;
    try { v = parseInt(window.localStorage.getItem('wilds:char') || '0', 10); } catch (e) {}
    if (!(v >= 0 && v < W.CFG.SPRITE_LIST.length)) v = 0;
    _charIdx = v;
    applyCharacterSprite();
    charLabel();
  }

  function charLabel() {
    var b = document.getElementById('btn-char');
    if (!b) return;
    b.textContent = '\u89d2\u8272\uff1a' + W.CFG.SPRITE_NAMES[_charIdx];
  }

  function nextChar() {
    _charIdx = (_charIdx + 1) % W.CFG.SPRITE_LIST.length;
    applyCharacterSprite();
    try { window.localStorage.setItem('wilds:char', String(_charIdx)); } catch (e) {}
    charLabel();
    if(rewardOpen)renderRewards();
    showToast('\u5df2\u5207\u63db\u70ba\uff1a' + W.CFG.SPRITE_NAMES[_charIdx]);
  }

  function nearStore() {
    return W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.STORE, W.CFG.STORE_RANGE);
  }

  /* 物品圖示：有圖用圖，沒有的用 emoji 頂著，兩者尺寸一致 */
  function iconHtml(id) {
    var src = W.Inv.img(id);
    if (src) return '<img class="itm-img" src="' + src + '" alt="">';
    return '<span class="itm-emo">' + W.Inv.icon(id) + '</span>';
  }

  function renderStore() {
    var ids = W.Inv.ORDER, html = '', i, id, inBag, inBox;
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      inBag = W.Inv.count(id);
      inBox = W.Store.count(id);
      if (!inBag && !inBox) continue;
      html += '<div class="st-row">'
           +   iconHtml(id)
           +   '<span class="st-name">' + W.Inv.label(id) + '</span>'
           +   '<span>\u80cc ' + inBag + ' / \u7bb1 ' + inBox + '</span>'
           +   '<button class="st-btn" data-dep="' + id + '">\u5b58</button>'
           +   '<button class="st-btn" data-wd="' + id + '">\u53d6</button>'
           +  '</div>';
    }
    if (!html) html = '<div class="st-row">\u80cc\u5305\u8207\u7bb1\u5b50\u90fd\u662f\u7a7a\u7684</div>';
    document.getElementById('store-body').innerHTML = html;
    document.getElementById('store-head').textContent =
      '\u5132\u7269\u7bb1\uff08' + W.Store.total() + ' / ' + W.CFG.STORE_CAP +
      '\uff09\u3000\u80cc\u5305 ' + W.Inv.total() + ' / ' + W.Inv.cap();
  }

  function openStore() {
    renderStore();
    document.getElementById('store-panel').classList.add('open');
  }

  function onStoreClick(e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var dep = el.getAttribute('data-dep');
    var wd = el.getAttribute('data-wd');
    if (dep) {
      var n = W.Store.deposit(dep, W.Inv.count(dep));
      showToast(n ? ('\u5b58\u5165 ' + W.Inv.label(dep) + ' \u00d7' + n) : '\u7bb1\u5b50\u6eff\u4e86');
      renderStore();
    } else if (wd) {
      var m = W.Store.withdraw(wd, W.Store.count(wd));
      showToast(m ? ('\u53d6\u51fa ' + W.Inv.label(wd) + ' \u00d7' + m) : '\u80cc\u5305\u6eff\u4e86');
      renderStore();
    }
  }

  function bagHtml() {
    var ids = W.Inv.ORDER, html = '', i, id, n;
    html += '<div class="bag-head">\u80cc\u5305\uff08' + W.Inv.total() + ' / ' + W.Inv.cap() + '\uff09'
         + (W.Inv.isFull() ? ' <span style="color:#ff9a8a">\u5df2\u6eff</span>' : '') + '</div>';
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      n = W.Inv.count(id);
      if (!n) continue;
      html += '<div class="st-row">' + iconHtml(id)
           +   '<span class="st-name">' + W.Inv.label(id) + '</span>'
           +   '<span>\u00d7 ' + n + '</span>'
           +  '</div>';
    }
    if (ids.length && html.indexOf('st-row') < 0) {
      html += '<div class="st-row">\u80cc\u5305\u662f\u7a7a\u7684</div>';
    }
    return html;
  }

  function openBag() {
    document.getElementById('bag-body').innerHTML = bagHtml();
    document.getElementById('bag-panel').classList.add('open');
  }

  var TOOL_LOADOUT = [
    {id:'none', name:'徒手', icon:'✋', desc:'無工具加成'},
    {id:'axe', name:'石斧', art:'ui/axe', desc:'伐木＋2、攻擊＋7'},
    {id:'maxe', name:'金屬斧', art:'ui/axe', desc:'伐木＋4、攻擊＋14'},
    {id:'pick', name:'石鎬', art:'ui/pick', desc:'採石＋2'},
    {id:'mpick', name:'金屬鎬', art:'ui/pick', desc:'採石＋4'},
    {id:'bow', name:'木弓', icon:'🏹', desc:'消耗箭矢遠程射擊'}
  ];
  var DIVINE_LOADOUT = [
    {id:'shield', name:'神盾', art:'divine_shield'},
    {id:'gun', name:'神槍', art:'divine_gun'},
    {id:'sword', name:'神劍', art:'divine_sword'},
    {id:'axe', name:'神斧', art:'divine_axe'},
    {id:'wing', name:'神翼', art:'divine_wing'}
  ];

  function dataButton(e, attr) {
    var t = e.target;
    while (t && t !== document.body) {
      if (t.getAttribute && t.getAttribute(attr) !== null) return t;
      t = t.parentNode;
    }
    return null;
  }

  function renderTravel() {
    var el = document.getElementById('travel-list');
    var ps = W.Travel.list(), html = '', i, p, at;
    for (i = 0; i < ps.length; i++) {
      p = ps[i]; at = p.distance < 90;
      html += '<button class="travel-row" data-travel="' + p.id + '"' + (p.unlocked && !at ? '' : ' disabled') + '>'
        + '<span class="travel-icon">' + p.icon + '</span>'
        + '<span class="travel-copy"><span class="travel-name">' + p.name + '</span>'
        + '<span class="travel-status">' + (at ? '你目前就在這裡' : p.status) + '</span></span>'
        + '<span class="travel-dist">' + (p.unlocked ? Math.round(p.distance) : '🔒') + '</span></button>';
    }
    el.innerHTML = html;
  }

  function openTravel() {
    equipOpen = false; document.getElementById('equip-panel').classList.remove('open');
    journalOpen = false; document.getElementById('journal-panel').classList.remove('open');
    rewardOpen = false; document.getElementById('reward-panel').classList.remove('open');
    renderTravel(); travelOpen = true;
    document.getElementById('travel-panel').classList.add('open');
  }
  function closeTravel() { travelOpen = false; document.getElementById('travel-panel').classList.remove('open'); }

  function onTravelClick(e) {
    var b = dataButton(e, 'data-travel'); if (!b) return;
    var r = W.Travel.go(b.getAttribute('data-travel'));
    showToast(r.msg);
    if (r.ok) { if(W.Render&&W.Render.travelFx)W.Render.travelFx(W.Player.wx,W.Player.wy);closeTravel(); W.Save.save(); }
    else renderTravel();
  }

  function toolLabel(id) {
    var i; for (i = 0; i < TOOL_LOADOUT.length; i++) if (TOOL_LOADOUT[i].id === id) return TOOL_LOADOUT[i].name;
    return '徒手';
  }

  function renderEquipment() {
    var current = W.Craft.equipped ? W.Craft.equipped() : '';
    var html = '', i, d, owned, on, eqN = 0;
    for (i = 0; i < TOOL_LOADOUT.length; i++) {
      d = TOOL_LOADOUT[i]; owned = d.id === 'none' || W.Craft.has(d.id); on = (d.id === 'none' ? !current : current === d.id);
      html += '<button class="equip-card' + (on ? ' on' : '') + '" data-tool="' + d.id + '"' + (owned ? '' : ' disabled') + '>'
        + (d.art ? '<img alt="" src="' + W.CFG.ART_DIR + d.art + '.png">' : '<span class="equip-emoji">' + d.icon + '</span>')
        + '<span>' + d.name + '</span><span class="equip-state">' + (on ? '已裝備' : (owned ? d.desc : '尚未製作')) + '</span></button>';
    }
    document.getElementById('tool-grid').innerHTML = html;

    html = '';
    for (i = 0; i < DIVINE_LOADOUT.length; i++) {
      d = DIVINE_LOADOUT[i]; owned = W.DivineArms.has(d.id); on = owned && W.DivineArms.isEquipped(d.id); if (on) eqN++;
      html += '<button class="equip-card' + (on ? ' on' : '') + '" data-divine="' + d.id + '"' + (owned ? '' : ' disabled') + '>'
        + '<img alt="" src="' + W.CFG.ART_DIR + 'ui/' + d.art + (on ? '_on' : '') + '.png">'
        + '<span>' + d.name + '</span><span class="equip-state">' + (on ? '已裝備' : (owned ? '收進背包' : '尚未獲得')) + '</span></button>';
    }
    document.getElementById('divine-grid').innerHTML = html;
    var resonance = W.DivineArms.resonanceLabel ? W.DivineArms.resonanceLabel() : '';
    document.getElementById('equip-summary').textContent = '目前主手：' + toolLabel(current || 'none')
      + '　｜　神武：' + eqN + '/5 件已裝備' + (resonance ? '　｜　共鳴：' + resonance : '');
  }

  function openEquipment() {
    travelOpen = false; document.getElementById('travel-panel').classList.remove('open');
    journalOpen = false; document.getElementById('journal-panel').classList.remove('open');
    rewardOpen = false; document.getElementById('reward-panel').classList.remove('open');
    renderEquipment(); equipOpen = true;
    document.getElementById('equip-panel').classList.add('open');
  }
  function closeEquipment() { equipOpen = false; document.getElementById('equip-panel').classList.remove('open'); }

  function onEquipmentClick(e) {
    var b = dataButton(e, 'data-tool'), id, on;
    if (b) {
      id = b.getAttribute('data-tool');
      if (W.Craft.equip(id)) {
        showToast(id === 'none' ? '已收起主手工具' : '已裝備「' + toolLabel(id) + '」');
        renderEquipment(); W.Save.save();
      }
      return;
    }
    b = dataButton(e, 'data-divine'); if (!b) return;
    id = b.getAttribute('data-divine'); on = !W.DivineArms.isEquipped(id);
    if (W.DivineArms.setEquipped(id, on)) {
      showToast((on ? '已裝備「' : '已卸下「') + DIVINE_LOADOUT.filter(function(d){return d.id===id;})[0].name + '」');
      renderEquipment(); W.Save.save();
    }
  }

  function renderJournal() {
    var defs = W.Journal.list(), stats = W.Journal.stats(), html = '', chapter = '', i, d, s, pct, tag;
    document.getElementById('journal-summary').textContent = '已完成 ' + stats.completed + '/' + stats.total
      + '　｜　已領取 ' + stats.claimed + '/' + stats.total
      + (stats.unclaimed ? '　｜　待領獎勵 ' + stats.unclaimed : '');
    for (i = 0; i < defs.length; i++) {
      d = defs[i]; s = W.Journal.state(d.id);
      if (d.chapter !== chapter) {
        chapter = d.chapter;
        html += '<div class="journal-chapter">' + chapter + '</div>';
      }
      pct = Math.max(0, Math.min(100, s.value / s.max * 100));
      tag = s.claimed ? '已領取' : (s.completed ? '可領取' : (s.current ? '目前目標' : '未完成'));
      html += '<div class="journal-row' + (s.current ? ' current' : '') + (s.completed ? ' done' : '') + '">'
        + '<div class="journal-row-head"><span class="journal-check">' + (s.completed ? '✓' : '○') + '</span>'
        + '<span class="journal-title">' + d.title + '</span><span class="journal-tag">' + tag + '</span></div>'
        + '<div class="journal-desc">' + d.desc + '</div>'
        + '<div class="journal-progress"><span style="width:' + pct + '%"></span></div>'
        + '<div class="journal-meta">' + s.text + '<br><span class="journal-reward">獎勵：' + W.Journal.rewardText(d.id) + '</span></div>';
      if ((s.completed && !s.claimed) || (!s.completed && d.track)) {
        html += '<div class="journal-actions">'
          + (s.completed && !s.claimed ? '<button class="journal-action claim" data-journal-claim="' + d.id + '">領取獎勵</button>' : '')
          + (!s.completed && d.track ? '<button class="journal-action" data-journal-track="' + d.id + '">導航目標</button>' : '')
          + '</div>';
      }
      html += '</div>';
    }
    document.getElementById('journal-list').innerHTML = html;
  }

  function openJournal() {
    travelOpen = false; document.getElementById('travel-panel').classList.remove('open');
    equipOpen = false; document.getElementById('equip-panel').classList.remove('open');
    rewardOpen = false; document.getElementById('reward-panel').classList.remove('open');
    W.Journal.update(1);
    renderJournal(); journalOpen = true;
    document.getElementById('journal-panel').classList.add('open');
  }
  function closeJournal() { journalOpen = false; document.getElementById('journal-panel').classList.remove('open'); }

  function onJournalClick(e) {
    var b = dataButton(e, 'data-journal-claim'), r, id;
    if (b) {
      r = W.Journal.claim(b.getAttribute('data-journal-claim'));
      showToast(r.msg);
      if (r.ok) { _journalSig = ''; renderJournal(); updateJournalHud(); W.Save.save(); }
      return;
    }
    b = dataButton(e, 'data-journal-track'); if (!b) return;
    id = b.getAttribute('data-journal-track');
    if (W.Journal.track(id)) {
      closeJournal(); updateGuideHud();
      showToast('🧭 導航已切換，跟隨角色身上的箭頭前進');
    }
  }

  function renderRewards() {
    var s=W.Rewards.stats(),items=W.Rewards.list(),ranks=W.Rewards.ranks?W.Rewards.ranks():[],html='',rankHtml='',i,r,d,src;
    for(i=0;i<ranks.length;i++){r=ranks[i];rankHtml+='<div class="honor-rank'+(r.unlocked?' unlocked':'')+(r.current?' current':'')+'"><span>'+(r.unlocked?'✓':'🔒')+' '+r.name+'</span><small>'+r.at+' 榮譽 · '+r.reward+'</small></div>';}
    document.getElementById('reward-summary').innerHTML='<strong>'+s.rank+'</strong>　荒野榮譽 '+s.honor
      +(s.max?'　·　最高榮譽階級':'　·　距離下一階級 '+s.needed)
      +'<br>目前階級獎勵：'+s.rankReward+'<br>傳說 Skin '+s.skins+'/'+s.totalSkins+'　｜　神格碎片 '+s.shards
      +'<div class="honor-road">'+rankHtml+'</div>';
    var jl=document.getElementById('reward-journal-link');
    jl.textContent=s.journalUnclaimed?'📜 有 '+s.journalUnclaimed+' 份冒險日誌獎勵待領取':'📜 查看冒險日誌與主線獎勵';
    for(i=0;i<items.length;i++){
      r=items[i];d=r.def;src=d.sprites[_charIdx]||d.sprites[0];
      html+='<div class="skin-card'+(r.equipped?' equipped':'')+(r.owned?'':' locked')+'">'
        +(r.unseen?'<span class="skin-new">NEW</span>':'')
        +'<div class="skin-preview" style="background-image:url(\''+src+'\')"></div>'
        +'<div class="skin-info"><div class="skin-name">'+(r.owned?'':'🔒 ')+d.name+'</div>'
        +'<div class="skin-rarity">'+d.rarity+' · '+W.CFG.SPRITE_NAMES[_charIdx]+'專用外觀</div>'
        +'<div class="skin-ability">'+d.ability+(d.id==='phoenix'&&W.Skins.stats().phoenixUsed?'<br>🔥 本次涅槃已使用':'')+'</div><div class="skin-condition">解鎖：'+d.condition+'</div>'
        +'<button class="skin-action'+(r.equipped?' on':'')+'" data-skin="'+d.id+'"'+(r.owned?'':' disabled')+'>'
        +(r.equipped?'卸下 Skin':(r.owned?'裝備 Skin':'尚未解鎖'))+'</button></div></div>';
    }
    document.getElementById('reward-list').innerHTML=html;
  }

  function openRewards() {
    travelOpen=false;document.getElementById('travel-panel').classList.remove('open');
    equipOpen=false;document.getElementById('equip-panel').classList.remove('open');
    journalOpen=false;document.getElementById('journal-panel').classList.remove('open');
    var changed=W.Rewards.sync(true);if(changed)applyCharacterSprite();
    renderRewards();rewardOpen=true;document.getElementById('reward-panel').classList.add('open');
    changed=W.Rewards.markAllSeen()||changed;_rewardSig='';updateRewardBadge();if(changed)W.Save.save();
  }
  function closeRewards(){rewardOpen=false;document.getElementById('reward-panel').classList.remove('open');}

  function onRewardClick(e){
    var b=dataButton(e,'data-skin');if(!b)return;var id=b.getAttribute('data-skin');
    if(W.Skins.equippedId()===id)W.Skins.equip('');else W.Skins.equip(id);
    renderRewards();
  }

  var SETTING_ROWS = [
    {key:'shake',name:'鏡頭震動',desc:'受擊與重擊時的震動強度',choices:[[0,'關'],[0.5,'柔和'],[1,'完整']]},
    {key:'haptics',name:'手機震動',desc:'受擊與成功翻滾時的觸覺回饋',choices:[[false,'關'],[true,'開']]},
    {key:'flashes',name:'畫面閃光',desc:'首領降臨、神武與 Skin 的全畫面閃光',choices:[[false,'關'],[true,'開']]},
    {key:'reducedMotion',name:'減少動態效果',desc:'停用慢動作、命中停頓、震屏與全畫面閃光',choices:[[false,'關'],[true,'開']]},
    {key:'highContrast',name:'高對比警示',desc:'替首領技能與地面危險區加上黑白外框',choices:[[false,'關'],[true,'開']]},
    {key:'damageNumbers',name:'傷害數字',desc:'顯示敵人受到的浮動傷害值',choices:[[false,'關'],[true,'開']]},
    {key:'sfxVolume',name:'音效音量',desc:'調整合成音效，不影響裝置音量',choices:[[0,'靜音'],[0.5,'標準'],[1,'響亮']]},
    {key:'lowPower',name:'省電模式',desc:'DPR 限制為 1，減少疊加特效與手機發熱',choices:[[false,'關'],[true,'開']]}
  ];

  function settingValue(v) { return typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v); }
  function renderSettings() {
    var html='',i,j,row,cur,c;
    for(i=0;i<SETTING_ROWS.length;i++){
      row=SETTING_ROWS[i];cur=W.Settings.get(row.key);
      html+='<div class="setting-row"><div class="setting-copy"><div class="setting-name">'+row.name+'</div><div class="setting-desc">'+row.desc+'</div></div><div class="setting-control">';
      for(j=0;j<row.choices.length;j++){c=row.choices[j];html+='<button class="setting-choice'+(cur===c[0]?' on':'')+'" data-setting="'+row.key+'" data-value="'+settingValue(c[0])+'">'+c[1]+'</button>';}
      html+='</div></div>';
    }
    document.getElementById('settings-list').innerHTML=html;
  }
  function openSettings(){renderSettings();document.getElementById('settings-panel').classList.add('open');}
  function closeSettings(){document.getElementById('settings-panel').classList.remove('open');}
  function syncMuteButton(){
    var b=document.getElementById('btn-mute');if(!b||!W.Sfx)return;
    var silent=W.Sfx.isMuted()||Number(W.Settings.get('sfxVolume'))<=0;
    b.textContent=silent?'🔇':'🔊';b.setAttribute('aria-pressed',silent?'true':'false');
  }
  function onSettingsClick(e){
    var b=dataButton(e,'data-setting');if(!b)return;
    var key=b.getAttribute('data-setting'),raw=b.getAttribute('data-value');
    var val=raw==='true'?true:(raw==='false'?false:Number(raw));
    W.Settings.set(key,val);renderSettings();
    if(key==='lowPower')resize();
    if(key==='sfxVolume')syncMuteButton();
    showToast('設定已更新');
  }

  function summaryText(s){
    if(!s)return '無法讀取';
    return '儲存時間：'+(s.savedAt?new Date(s.savedAt).toLocaleString():'未知')+'\n'
      +'遊戲天數：第 '+s.day+' 天\n區域首領：'+s.regions+'/5\n全部首領：'+s.bosses+'\n'
      +'神武：'+s.divine+'/5\n傳說 Skin：'+s.skins+'/5\n冒險獎勵：'+s.journal+'\n'
      +'飛升輪迴：'+s.ascension+'　神格碎片：'+s.shards;
  }
  function closeCloudConflict(){document.getElementById('cloud-conflict-panel').classList.remove('open');}
  function openCloudConflict(){
    showToast('正在比較兩份存檔…');
    W.Save.save().then(function(){return W.Cloud.compare();}).then(function(r){
      if(!r||typeof r==='string'){cloudResult(r,'');return;}
      document.getElementById('conflict-local').textContent=summaryText(r.local);
      document.getElementById('conflict-remote').textContent=summaryText(r.remote);
      document.getElementById('cloud-conflict-panel').classList.add('open');
    });
  }

  function uiModalOpen(){
    var ids=['bag-panel','store-panel','craft-panel','travel-panel','equip-panel','journal-panel','reward-panel',
      'settings-panel','cloud-conflict-panel','diag-panel','goal-card','update-panel'];
    var i,el;
    for(i=0;i<ids.length;i++){el=document.getElementById(ids[i]);if(el&&el.classList&&el.classList.contains('open'))return true;}
    return false;
  }

  var _btnA = null, _btnRoll = null;
  var _btnMode = '';
  var _btnTimer = 0;
  var _bowCd = 0;
  var _nearMob = null;

  function doRoll(){
    if(uiModalOpen())return;
    var wx=W.Player.wx,wy=W.Player.wy,r=W.Player.roll();
    if(r===true){
      if(W.Render&&W.Render.dodgeFx)W.Render.dodgeFx(wx,wy,W.Player.rollX,W.Player.rollY);
      if(W.Sfx)W.Sfx.dodge();
      if(W.Settings)W.Settings.vibrate(18);
    }else if(r==='tired')showToast('體力不足，無法翻滾');
    else if(r==='dead')showToast('倒下時無法翻滾');
  }

  /* 一次迴圈同時得到最近距離與最近目標，不跑兩趟 */
  /* 弓箭的目標包含魔王：魔王物件有 alive / wx / wy，與生物相容 */
  function nearestTargetDist() {
    var P = W.Player;
    var d = nearestMobDist();
    var b = W.Bosses ? W.Bosses.nearest(P.wx, P.wy) : null;
    if (b) {
      var bd = Math.sqrt((b.wx - P.wx) * (b.wx - P.wx) + (b.wy - P.wy) * (b.wy - P.wy));
      if (bd < d) { d = bd; _nearMob = b; }
    }
    var c = W.Calamity && W.Calamity.nearest ? W.Calamity.nearest(P.wx, P.wy) : null;
    if (c) {
      var cd = Math.sqrt((c.wx - P.wx) * (c.wx - P.wx) + (c.wy - P.wy) * (c.wy - P.wy));
      if (cd < d) { d = cd; _nearMob = c; }
    }
    return d;
  }

  function nearestMobDist() {
    var P = W.Player, best = 1e9;
    var i, m, dx, dy, d2, n = W.Mobs.count();
    _nearMob = null;
    for (i = 0; i < n; i++) {
      m = W.Mobs.at(i);
      if (!m || !m.alive) continue;
      dx = m.wx - P.wx;
      dy = m.wy - P.wy;
      d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; _nearMob = m; }
    }
    return Math.sqrt(best);
  }

  function nearestMob() { return _nearMob; }

  function canBow(dist) {
    return W.Craft.equipped && W.Craft.equipped() === 'bow' && W.Inv.count('arrow') > 0 &&
           dist > W.CFG.ATTACK_RANGE && dist <= W.CFG.BOW_RANGE;
  }

  function updateActionBtn(dt) {
    if (!_btnA) return;
    _btnTimer += dt;
    if (_btnTimer < 0.2) return;
    _btnTimer = 0;
    _btnA.classList[W.Player.perfectReady&&W.Player.perfectReady()?'add':'remove']('perfect-ready');

    if(_btnRoll){
      var rcd=W.Player.rollCooldown?W.Player.rollCooldown():0,rc=document.getElementById('roll-cooldown');
      _btnRoll.classList[rcd>0?'add':'remove']('cooldown');
      if(rc)rc.textContent=rcd>0?rcd.toFixed(1):'';
    }

    var mode, icon;
    var P = W.Player;

    if (W.Calamity && W.Calamity.near(P.wx, P.wy)) {
      if (_btnMode !== 'calamity') {
        _btnMode = 'calamity';
        var cst=W.Calamity.stats?W.Calamity.stats():null;
        _btnA.textContent = cst&&cst.summoning?'✖️':'☄️';
        _btnA.style.opacity = '1';
        _btnA.style.transform = 'scale(1.12)';
      }
      return;
    }

    if (nearStore()) {
      if (_btnMode !== 'store') {
        _btnMode = 'store';
        _btnA.textContent = '\uD83D\uDDC3\uFE0F';
        _btnA.style.opacity = '1';
        _btnA.style.transform = 'scale(1.12)';
      }
      return;
    }

    if (W.Sites && W.Sites.chestAt(P.wx, P.wy)) {
      if (_btnMode !== 'loot') {
        _btnMode = 'loot';
        _btnA.textContent = '\uD83D\uDCE6';
        _btnA.style.opacity = '1';
        _btnA.style.transform = 'scale(1.12)';
      }
      return;
    }

    var nm = nearestTargetDist();
    if (nm <= W.CFG.ATTACK_RANGE) {
      mode = 'atk';
      icon = '\u2694\uFE0F';
    } else if (canBow(nm)) {
      mode = 'bow';
      icon = '\uD83C\uDFF9';
    } else if (W.Res.findTarget(P.wx, P.wy, P.faceX, P.faceY)) {
      mode = 'harvest';
      icon = '\uD83E\uDE93';
    } else {
      mode = 'none';
      icon = '\uD83D\uDC4A';
    }

    if (mode === _btnMode) return;
    _btnMode = mode;
    _btnA.textContent = icon;
    _btnA.style.opacity = (mode === 'none') ? '0.35' : '1';
    _btnA.style.transform = (mode === 'none') ? 'scale(1)' : 'scale(1.12)';
  }

  /* 自動存檔的輕提示：save.js 是紅線區不能動，因此在這裡自行計時 */
  var _asNote = 0;

  function noteAutosave(dt) {
    _asNote += dt;
    if (_asNote < W.CFG.AUTOSAVE_INTERVAL) return;
    _asNote = 0;
    showToast('\u25CB \u81ea\u52d5\u5b58\u6a94');
  }

  function doAction() {
    if (uiModalOpen()) return;
    if (W.Stats.isDead()) return;

    if (W.Calamity && W.Calamity.near(W.Player.wx, W.Player.wy)) {
      var ritual=W.Calamity.summon();
      if(ritual)_btnMode='';
      return;
    }

    if (nearStore()) { openStore(); return; }

    var chest = W.Sites ? W.Sites.chestAt(W.Player.wx, W.Player.wy) : null;
    if (chest) {
      var lt = W.Sites.loot(chest);
      if (lt) {
        if (W.Sfx) W.Sfx.kill();
        var msg = lt.name + '\uff1a';
        if (lt.metal)  msg += ' \u91d1\u5c6c\u00d7' + lt.metal;
        if (lt.flint)  msg += ' \u71e7\u77f3\u00d7' + lt.flint;
        if (lt.arrow)  msg += ' \u7bad\u00d7' + lt.arrow;
        if (lt.hide)   msg += ' \u6bdb\u76ae\u00d7' + lt.hide;
        if (lt.cooked) msg += ' \u70e4\u8089\u00d7' + lt.cooked;
        showToast(msg);
        W.Save.save();
      }
      return;
    }

    var nm = nearestTargetDist();
    if (canBow(nm)) {
      if (_bowCd <= 0) {
        var tgt = nearestMob();
        if (tgt && W.Arrows.fire(W.Player.wx, W.Player.wy, tgt)) {
          W.Inv.take('arrow', 1);
          _bowCd = W.CFG.BOW_CD;
          W.Player.faceX = (tgt.wx - W.Player.wx);
          W.Player.faceY = (tgt.wy - W.Player.wy);
          var fl = Math.sqrt(W.Player.faceX * W.Player.faceX + W.Player.faceY * W.Player.faceY) || 1;
          W.Player.faceX /= fl;
          W.Player.faceY /= fl;
          if (W.Sfx) W.Sfx.bow();
        }
      }
      return;
    }

    /* 揮空也要出弧光，這是手感的關鍵 */
    W.Render.slash(W.Player.faceX, W.Player.faceY);
    if (W.DivineArms && W.DivineArms.onPlayerAttack) W.DivineArms.onPlayerAttack();
    var a = W.Player.attack();
    var attackDmg=W.Player.lastAttackDamage?W.Player.lastAttackDamage():(W.CFG.ATTACK_DMG+W.Craft.attackBonus());
    if (!a && W.Bosses) {
      a = W.Bosses.hitAt(W.Player.wx + W.Player.faceX * 40,
                         W.Player.wy + W.Player.faceY * 40,
                         W.CFG.ATTACK_RANGE, attackDmg);
    }
    if (!a && W.Calamity && W.Calamity.hitAt) {
      a = W.Calamity.hitAt(W.Player.wx + W.Player.faceX * 40,
                           W.Player.wy + W.Player.faceY * 40,
                           W.CFG.ATTACK_RANGE, attackDmg);
    }
    if (a === 'tired') { showToast('\u9ad4\u529b\u4e0d\u8db3'); return; }
    if (a) {
      if(W.Render&&W.Render.impact)W.Render.impact(a.wx||W.Player.wx+W.Player.faceX*40,a.wy||W.Player.wy+W.Player.faceY*40,!!(a.killed||a.boss));
      W.Render.dmgText(W.Player.wx + W.Player.faceX * 40, W.Player.wy + W.Player.faceY * 40 - 14, '-' + a.dmg);
      if (W.Sfx) { if (a.killed) { W.Sfx.kill(); } else { W.Sfx.hit(); } }
      if (a.killed) checkWolfMilestone(a.type);
      showToast(a.killed
        ? (a.boss ? ('擊敗 ' + a.name + '！') : ('\u64ca\u5012 ' + a.name + '\uff01\uff0b\u751f\u8089\u3001\u6bdb\u76ae'))
        : (a.name + ' \u53d7\u5230 ' + a.dmg + ' \u9ede\u50b7\u5bb3'));
      return;
    }
    doHarvest();
  }

  function eat(id, foodAdd, hpDelta, sanDelta) {
    if (!W.Inv.take(id, 1)) { showToast('\u6c92\u6709' + W.Inv.label(id)); return; }
    W.Stats.eat(foodAdd, hpDelta);
    if (sanDelta) W.Stats.addSan(sanDelta);
    if (W.Sfx) W.Sfx.eat();
    showToast('\u5403\u4e86' + W.Inv.label(id) + '\uff0c\u98fd\u98df \uff0b' + foodAdd);
    document.getElementById('bag-body').innerHTML = bagHtml();
  }

  function doSleep() {
    if (!W.Build.nearType(W.Player.wx, W.Player.wy, W.Build.TYPE.BED, W.CFG.SLEEP_RANGE)) {
      showToast('\u9700\u8981\u5148\u653e\u4e0b\u7761\u888b\u4e26\u7ad9\u5728\u65c1\u908a');
      return;
    }
    if (!W.Time.isNight()) {
      showToast('\u73fe\u5728\u4e0d\u662f\u591c\u665a\uff0c\u7761\u4e0d\u8457');
      return;
    }
    if (W.Stats.food() < W.CFG.SLEEP_FOOD) {
      showToast('\u592a\u9913\u4e86\uff0c\u7761\u4e0d\u7740\uff08\u9700\u8981\u98fd\u98df ' + W.CFG.SLEEP_FOOD + '\uff09');
      return;
    }
    W.Stats.addSan(W.CFG.SAN_SLEEP);
    W.Render.sleepFx();
    if (W.Sfx) W.Sfx.sleep();
    W.Time.skipToDawn();
    W.Stats.eat(-W.CFG.SLEEP_FOOD, W.CFG.SLEEP_HEAL);
    W.Mobs.clearAll();
    W.Save.save();
    showToast('\u4e00\u89ba\u5230\u5929\u4eae\uff0c\u7b2c ' + W.Time.dayNo() + ' \u5929\u958b\u59cb');
  }

  function cloudLabel() {
    var b = document.getElementById('btn-cloud');
    if (!b) return;
    b.textContent = W.Cloud.isSignedIn() ? '\u96f2\u7aef\u767b\u51fa' : '\u96f2\u7aef\u767b\u5165';
  }

  function cloudResult(r, okMsg) {
    if (r === true) { showToast(okMsg); }
    else if (r === 'downloaded') { showToast('\u5df2\u5f9e\u96f2\u7aef\u53d6\u56de\u8f03\u65b0\u7684\u9032\u5ea6'); W.Camera.snapTo(W.Player.wx, W.Player.wy); }
    else if (r === 'in-sync') { showToast('\u96f2\u7aef\u8207\u672c\u6a5f\u5df2\u4e00\u81f4'); }
    else if (typeof r === 'string') { showToast(r); }
    cloudLabel();
  }

  function exportBackup(){
    W.Save.snapshot().then(function(data){
      if(!data){showToast('無法建立備份');return;}
      var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      var url=window.URL&&window.URL.createObjectURL?window.URL.createObjectURL(blob):'';
      if(!url){showToast('此瀏覽器不支援匯出');return;}
      var a=document.createElement('a'),stamp=new Date().toISOString().slice(0,10);
      a.href=url;a.download='WILDS-save-'+stamp+'.json';document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){window.URL.revokeObjectURL(url);},1000);
      showToast('本機存檔備份已匯出');
    });
  }

  function importBackup(file){
    if(!file)return;
    if(file.size>5*1024*1024){showToast('備份檔過大，已取消匯入');return;}
    var reader=new FileReader();
    reader.onload=function(){
      var data;
      try{data=JSON.parse(String(reader.result||''));}catch(e){showToast('備份格式無法解析');return;}
      if(!window.confirm('匯入後會覆蓋目前本機進度，確定繼續？'))return;
      W.Save.applyRemote(data).then(function(ok){
        if(!ok){showToast('備份驗證失敗，未變更目前進度');return;}
        W.Camera.snapTo(W.Player.wx,W.Player.wy);
        if(W.Bosses)W.Bosses.init();
        if(W.Guide)W.Guide.init();
        if(W.Rewards)W.Rewards.sync(true);
        applyCharacterSprite();_rewardSig='';
        var body=document.getElementById('diag-body');if(body)body.textContent=diagText();
        showToast('備份已驗證並匯入 ✓');
      });
    };
    reader.onerror=function(){showToast('讀取備份失敗');};
    reader.readAsText(file);
  }

  function openUpdatePanel(reg){
    updateReg=reg||updateReg;
    var p=document.getElementById('update-panel');if(p)p.classList.add('open');
  }

  function registerSafeUpdate(){
    if(!('serviceWorker' in navigator))return;
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(!reloadOnController)return;reloadOnController=false;window.location.reload();
    });
    navigator.serviceWorker.register('./sw.js').then(function(reg){
      updateReg=reg;
      if(reg.waiting&&navigator.serviceWorker.controller)openUpdatePanel(reg);
      reg.addEventListener('updatefound',function(){
        var worker=reg.installing;if(!worker)return;
        worker.addEventListener('statechange',function(){
          if(worker.state==='installed'&&navigator.serviceWorker.controller)openUpdatePanel(reg);
        });
      });
    })['catch'](function(){});
  }

  var _lastHp = -1;
  var _wasNight = false;

  function pollFeedback() {
    var hpNow = W.Stats.hp();
    if (_lastHp >= 0 && hpNow < _lastHp - 0.01 && W.Sfx) W.Sfx.hurt();
    _lastHp = hpNow;

    var nightNow = W.Time.isNight();
    if (nightNow && !_wasNight) {
      if (W.Sfx) W.Sfx.night();
      showToast('\uD83C\uDF19 \u5165\u591c\u4e86\u2026\u591c\u5149\u8611\u83c7\u958b\u59cb\u751f\u9577');
    }
    _wasNight = nightNow;
  }

  function checkDeath(dt) {
    if (!W.Stats.isDead()) { deadT = 0; return; }
    deadT += dt;
    if (deadT < 1.6) return;
    deadT = 0;
    W.Stats.revive();
    W.Player.goHome();
    W.Mobs.clearAll();
    W.Camera.snapTo(W.Player.wx, W.Player.wy);
    W.Save.save();
    showToast('\u4f60\u6607\u5929\u4e86\u2026\u2026\u65bc\u71df\u5730\u91cd\u65b0\u7747\u958b\u96d9\u773c');
  }

  var mileFirstWolf = false;
  var mileLastDay = 1;

  function checkMilestones() {
    var d = W.Time.dayNo();
    if (d > mileLastDay) {
      mileLastDay = d;
      showToast('\uD83C\uDF05 \u5b58\u6d3b\u7b2c ' + d + ' \u5929\uff01');
    }
  }

  function checkWolfMilestone(type) {
    if (mileFirstWolf) return;
    if (type !== W.Mobs.TYPE.WOLF) return;
    mileFirstWolf = true;
    showToast('\uD83C\uDFC6 \u9996\u6b21\u64ca\u5012\u91ce\u72fc\uff01');
  }

  function onArrowHit(hit, wx, wy) {
    if(W.Render&&W.Render.impact)W.Render.impact(wx,wy,!!(hit&&hit.killed));
    W.Render.dmgText(wx, wy - 10, '-' + hit.dmg);
    if (W.Sfx) { if (hit.killed) { W.Sfx.kill(); } else { W.Sfx.arrowHit(); } }
    if (hit.killed) {
      checkWolfMilestone(hit.type);
      showToast(hit.boss ? ('擊敗 ' + hit.name + '！') : ('\u64ca\u5012 ' + hit.name + '\uff01\uff0b\u751f\u8089\u3001\u6bdb\u76ae'));
    }
  }

  var _tap = { sx: 0, sy: 0 };
  var _tapW = { wx: 0, wy: 0 };
  var _cp = { wx: 0, wy: 0 };
  var _selStruct = null;
  var _carry = null;

  function findStructAt(wx, wy, r) {
    var best = -1, bd = r * r, k, s, dx, dy, d2;
    for (k = 0; k < W.Build.count(); k++) {
      s = W.Build.at(k);
      dx = s.wx - wx;
      dy = s.wy - wy;
      d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = k; }
    }
    return best;
  }

  function handleTap() {
    if (_carry) return;
    if (!W.Input.consumeTap(_tap)) return;
    W.Camera.screenToWorldInto(_tap.sx, _tap.sy, _tapW);
    var si = findStructAt(_tapW.wx, _tapW.wy, 46);
    if (si >= 0) openStructMenu(si);
  }

  function openStructMenu(i) {
    _selStruct = W.Build.at(i);
    document.getElementById('sm-name').textContent = W.Build.nameOf(_selStruct.type);
    document.getElementById('struct-menu').classList.add('open');
  }

  function closeStructMenu() {
    _selStruct = null;
    document.getElementById('struct-menu').classList.remove('open');
  }

  function costOfPlaced(type) {
    var rs = W.Craft.list(), k, r;
    for (k = 0; k < rs.length; k++) {
      r = rs[k];
      if (r.kind === 'place' && r.place === type) return r.cost;
    }
    return null;
  }

  function storeStruct() {
    if (!_selStruct) return;
    var cost = costOfPlaced(_selStruct.type), k;
    if (cost) {
      for (k in cost) {
        if (cost.hasOwnProperty(k)) W.Inv.add(k, cost[k]);
      }
    }
    W.Build.removeAt(_selStruct.wx, _selStruct.wy, 4);
    W.Build.updateNear(W.Player.wx, W.Player.wy);
    showToast(W.Build.nameOf(_selStruct.type) + ' \u5df2\u6536\u7d0d\uff0c\u6750\u6599\u9000\u56de\u80cc\u5305');
    closeStructMenu();
  }

  function beginMove() {
    if (!_selStruct) return;
    _carry = { type: _selStruct.type, owx: _selStruct.wx, owy: _selStruct.wy };
    W.Build.removeAt(_selStruct.wx, _selStruct.wy, 4);
    W.Build.updateNear(W.Player.wx, W.Player.wy);
    closeStructMenu();
    document.getElementById('place-bar').classList.add('open');
    showToast('\u8d70\u5230\u76ee\u6a19\u4f4d\u7f6e\u5f8c\u6309\u300c\u653e\u7f6e\u300d');
  }

  function carryPos(out) {
    out.wx = W.Player.wx + W.Player.faceX * W.CFG.PLACE_DIST;
    out.wy = W.Player.wy + W.Player.faceY * W.CFG.PLACE_DIST;
  }

  function placeCarry() {
    if (!_carry) return;
    carryPos(_cp);
    if (!W.Build.canPlace(_cp.wx, _cp.wy)) {
      showToast('\u9019\u88e1\u4e0d\u80fd\u653e\uff0c\u63db\u500b\u4f4d\u7f6e');
      return;
    }
    W.Build.add(_carry.type, _cp.wx, _cp.wy);
    W.Build.updateNear(W.Player.wx, W.Player.wy);
    if (W.Sfx) W.Sfx.place();
    showToast(W.Build.nameOf(_carry.type) + ' \u5df2\u653e\u7f6e');
    _carry = null;
    document.getElementById('place-bar').classList.remove('open');
  }

  function cancelCarry() {
    if (!_carry) return;
    W.Build.add(_carry.type, _carry.owx, _carry.owy);
    W.Build.updateNear(W.Player.wx, W.Player.wy);
    _carry = null;
    document.getElementById('place-bar').classList.remove('open');
  }

  function doHarvest() {
    var r = W.Player.harvest(Date.now());
    if (!r) { showToast('\u9644\u8fd1\u6c92\u6709\u53ef\u63a1\u96c6\u7684\u6771\u897f'); return; }
    if (W.Inv.isFull()) { showToast('\u80cc\u5305\u6eff\u4e86\uff0c\u56de\u5132\u7269\u7bb1\u5378\u8ca8'); }
    if (W.Sfx) W.Sfx.harvest();
    showToast(r.name + ' \uff0b' + W.Inv.label(r.item) + ' \u00d7' + r.n);
  }

  function loop(now) {
    var realDt = (now - last) / 1000;
    last = now;
    if (realDt > 0.1) realDt = 0.1;
    if (realDt <= 0) realDt = 0.016;
    var dt=W.Render&&W.Render.stepFrame?W.Render.stepFrame(realDt):realDt;
    var modal=uiModalOpen(),simDt=modal?0:dt;

    fpsAcc += 1 / realDt;
    fpsCount++;
    if (fpsCount >= 10) { fps = fpsAcc / fpsCount; fpsAcc = 0; fpsCount = 0; }

    frame++;
    if(W.Input.setLocked)W.Input.setLocked(modal);
    W.Input.update();
    if(simDt>0){
      W.Time.update(simDt);
      W.Player.update(simDt);
      W.Stats.update(simDt);
      W.Mobs.update(simDt);
      W.Arrows.update(simDt);
      if (W.Sites) W.Sites.updateNear(W.Player.wx, W.Player.wy);
      if (W.Bosses) W.Bosses.update(simDt);
      if (W.Mates) W.Mates.update(simDt);
      if (W.DivineArms) W.DivineArms.update(simDt);
      if (W.Calamity) W.Calamity.update(simDt);
      if (W.Guide) W.Guide.update(simDt);
      if (W.Travel) W.Travel.update(simDt);
      if (W.Journal) W.Journal.update(simDt);
      if (W.Skins) W.Skins.update(simDt);
      if (_bowCd > 0) _bowCd -= simDt;
      checkDeath(simDt);
      W.World.tick(frame);
      W.Minimap.tick(simDt);
    }
    tickToast(realDt);
    W.Save.tick(realDt);
    W.Cloud.tick(realDt);
    W.Camera.follow(W.Player.wx, W.Player.wy, simDt);
    W.Render.draw(realDt);
    updateHUD(realDt);
    updateActionBtn(realDt);
    noteAutosave(realDt);
    if(!modal){checkMilestones();pollFeedback();handleTap();}

    requestAnimationFrame(loop);
  }

  function diagText() {
    var st = W.World.stats();
    var rs = W.Res.stats();
    var sv = W.Save.info();
    var ms = W.Mobs.stats();
    var bs = W.Build.stats();
    var cl = W.Cloud.info();
    var ar = W.Art.stats();
    var ss = W.Sites ? W.Sites.stats() : { near: 0, looted: 0 };
    var mt = W.Mates ? W.Mates.stats() : { total: 0, recruited: 0, hungry: 0 };
    var bs2 = W.Bosses ? W.Bosses.stats() : { alive: 0, defeated: 0 };
    var rw = W.Rewards ? W.Rewards.stats() : { honor:0, rank:'', skins:0, totalSkins:0, unseen:0 };
    return [
      '=== WILDS 診斷 (Phase 19) ===',
      '',
      'FPS          : ' + Math.round(fps),
      'DPR          : ' + Math.min(window.devicePixelRatio || 1, W.Settings.dprCap()),
      '視窗         : ' + window.innerWidth + ' x ' + window.innerHeight,
      'Canvas       : ' + canvas.width + ' x ' + canvas.height,
      '',
      '玩家世界座標 : ' + W.Player.wx.toFixed(1) + ', ' + W.Player.wy.toFixed(1),
      '玩家區塊     : ' + W.Player.chunkX() + ', ' + W.Player.chunkY(),
      '攝影機座標   : ' + W.Camera.wx.toFixed(1) + ', ' + W.Camera.wy.toFixed(1),
      '',
      '輸入向量     : ' + W.Input.getX().toFixed(2) + ', ' + W.Input.getY().toFixed(2),
      '搖桿啟用     : ' + W.Input.isActive(),
      '翻滾狀態     : ' + W.Player.isRolling() + '（冷卻 ' + W.Player.rollCooldown().toFixed(2) + ' 秒）',
      '遊戲設定     : ' + JSON.stringify(W.Settings.stats()),
      '',
      '世界大小     : ' + W.CFG.WORLD_SIZE,
      '區塊大小     : ' + W.CFG.CHUNK_SIZE,
      '移動速度     : ' + W.CFG.PLAYER_SPEED + ' 單位/秒',
      '',
      '--- 地形 (Phase 2) ---',
      '種子         : ' + W.CFG.SEED,
      '腳下地形     : ' + W.World.NAMES[W.Player.terrain()],
      '遭阻擋         : ' + W.Player.blocked,
      '快取區塊     : ' + st.cached + ' / ' + W.CFG.CHUNK_CACHE_MAX,
      '待生成佇列   : ' + st.pending,
      '累計已生成   : ' + st.built,
      '',
      '',
      '--- \u8cc7\u6e90 (Phase 3) ---',
      '\u9130\u8fd1\u7bc0\u9ede     : ' + rs.near,
      '\u7bc0\u9ede\u5feb\u53d6     : ' + rs.chunks + ' \u5340\u584a',
      '\u5df2\u63a1\u96c6\u5f85\u9577 : ' + rs.taken,
      '\u80cc\u5305\u7e3d\u91cf     : ' + W.Inv.total(),
      '\u5c0f\u5730\u5716         : ' + (W.Minimap.isOn() ? '\u958b' : '\u95dc'),
      '',
      W.Inv.summary(),
      '--- \u5b58\u6a94 (Phase 4) ---',
      '\u5b58\u6a94\u53ef\u7528     : ' + sv.ok + '\uff08' + sv.reason + '\uff09',
      '\u5b58\u6a94\u7248\u672c     : v' + sv.version,
      '\u4e0a\u6b21\u5b58\u6a94     : ' + (sv.lastSaved ? new Date(sv.lastSaved).toLocaleString() : '\u5c1a\u672a\u5b58\u6a94'),
      '\u932f\u8aa4\u8a0a\u606f     : ' + (sv.lastError || '\u7121'),
      '備份復原     : ' + (sv.lastRecovery || '未使用；保留最近兩份'),
      '\u81ea\u52d5\u5b58\u6a94     : \u6bcf ' + W.CFG.AUTOSAVE_INTERVAL + ' \u79d2\uff0b\u5207\u51fa\u80cc\u666f\u6642',
      '',
      '--- \u751f\u5b58 (Phase 5) ---',
      '\u751f\u547d         : ' + W.Stats.hp().toFixed(0) + ' / 100',
      '\u98fd\u98df         : ' + W.Stats.food().toFixed(0) + ' / 100',
      '\u9ad4\u529b         : ' + W.Stats.stam().toFixed(0) + ' / 100',
      '\u6b7b\u4ea1\u72c0\u614b     : ' + W.Stats.isDead(),
      '\u71df\u5730\u5750\u6a19     : ' + Math.round(W.Player.homeWx) + ', ' + Math.round(W.Player.homeWy),
      '\u751f\u7269\u6578\u91cf     : ' + ms.alive + ' / ' + ms.cap + '\uff08\u72fc ' + ms.wolves + '\uff09',
      '\u751f\u7269\u4e0d\u5b58\u6a94 : \u96e2\u958b\u5f8c\u91cd\u65b0\u751f\u6210',
      '',
      '--- \u5408\u6210\u8207\u5efa\u9020 (Phase 6) ---',
      '\u77f3\u65a7         : ' + (W.Craft.has('axe') ? '\u5df2\u64c1\u6709' : '\u7121'),
      '\u77f3\u93ac         : ' + (W.Craft.has('pick') ? '\u5df2\u64c1\u6709' : '\u7121'),
      '\u5efa\u9020\u7269\u7e3d\u6578 : ' + bs.total + '\uff08\u71df\u706b ' + bs.fire + '\u3001\u6728\u7246 ' + bs.wall + '\u3001\u7761\u888b ' + bs.bed + '\u3001\u7194\u7210 ' + (bs.furnace || 0) + '\uff09',
      '\u7ad9\u5728\u71df\u706b\u65c1 : ' + (!!W.Build.nearType(W.Player.wx, W.Player.wy, 0, W.CFG.FIRE_RANGE)),
      '',
      '--- \u65e5\u591c (Phase 7) ---',
      '\u7b2c\u5e7e\u5929       : ' + W.Time.dayNo(),
      '\u6642\u9593         : ' + W.Time.clock() + '\uff08' + W.Time.phase() + '\uff09',
      '\u9ed1\u6697\u5ea6       : ' + W.Time.darkness().toFixed(2),
      '\u591c\u665a\u6a21\u5f0f     : ' + W.Time.isNight(),
      '\u4e00\u65e5\u9577\u5ea6     : ' + W.CFG.DAY_LENGTH + ' \u79d2',
      '',
      '\u7d20\u6750\u8f09\u5165     : ' + ar.loaded + ' / ' + ar.requested + ' \u5df2\u8acb\u6c42\uff08\u5168\u90e8 ' + ar.total + '\uff0c\u5931\u6557 ' + ar.failed + '\uff09',
      (ar.failed ? '\u7f3a\u5c11\u7d20\u6750     : ' + ar.names.join('\u3001') : '\u7d20\u6750\u5b8c\u6574     : \u2713'),
      '',
      '\u7406\u667a         : ' + W.Stats.san().toFixed(0) + ' / 100' + (W.Stats.isLowSan() ? '\uff08\u904e\u4f4e\uff01\u9670\u5f71\u51fa\u6c92\uff09' : ''),
      '\u80cc\u5305         : ' + W.Inv.total() + ' / ' + W.Inv.cap(),
      '\u5132\u7269\u7bb1     : ' + W.Store.total() + ' / ' + W.CFG.STORE_CAP,
      '\u9670\u5f71\u6578\u91cf     : ' + (ms.shadows || 0),
      '\u5925\u4f34         : ' + mt.recruited + ' / ' + mt.total + '\uff08\u9913 ' + mt.hungry + '\uff09',
      '\u9b54\u738b         : \u5b58\u6d3b ' + bs2.alive + '\u3001\u5df2\u64ca\u6557 ' + bs2.defeated,
      '荒野榮譽     : ' + rw.honor + '（' + rw.rank + '）',
      '傳說 Skin   : ' + rw.skins + ' / ' + rw.totalSkins + '（未讀 ' + rw.unseen + '）',
      '\u9130\u8fd1\u907a\u8de1     : ' + ss.near + '\uff08\u5df2\u641c\u5237 ' + ss.looted + ' \u5ea7\uff09',
      '',
      '--- \u96f2\u7aef (Phase 8) ---',
      '\u96f2\u7aef\u72c0\u614b     : ' + cl.reason,
      '\u5e33\u865f         : ' + (cl.email || cl.uid || '\u672a\u767b\u5165'),
      '\u5f85\u4e0a\u50b3       : ' + cl.dirty,
      '\u4e0a\u6b21\u4e0a\u50b3     : ' + (cl.lastUp ? new Date(cl.lastUp).toLocaleString() : '\u7121'),
      '\u4e0a\u6b21\u4e0b\u8f09     : ' + (cl.lastDown ? new Date(cl.lastDown).toLocaleString() : '\u7121'),
      '\u96f2\u7aef\u932f\u8aa4     : ' + (cl.lastError || '\u7121'),
      '\u96f2\u7aef\u9375\u503c     : users/{uid}/data/wilds:save',
      '\u81ea\u52d5\u4e0a\u50b3     : \u6bcf ' + W.CFG.CLOUD_INTERVAL + ' \u79d2\uff08\u6709\u8b8a\u52d5\u624d\u50b3\uff09',
      '',
      '=== \u5168\u90e8\u968e\u6bb5\u5b8c\u6210 ==='
    ].join('\n');
  }

  /* 綁定用的安全包裝：某個元素或模組不存在時只記一筆錯誤，
     不讓整個 init 中斷。手機端逐檔上傳很容易漏一支，
     漏一支就整個白畫面是不能接受的。 */
  /* 安全綁定：元素不存在時只記一筆警告，後面的按鈕照樣綁得上。
     手機端逐檔上傳難免出現「新 main.js 配舊 index.html」的混搭，
     少一顆按鈕不該讓整個遊戲起不來。 */
  function on(id, ev, fn) {
    var el = document.getElementById(id);
    if (!el) {
      if (window.__wildsErr) window.__wildsErr('\u26A0 \u627e\u4e0d\u5230\u5143\u7d20\uff1a#' + id);
      return null;
    }
    el.addEventListener(ev, fn);
    return el;
  }

  function safe(label, fn) {
    try {
      fn();
    } catch (e) {
      if (window.__wildsErr) window.__wildsErr('\u26A0 ' + label + '\uff1a' + (e && e.message ? e.message : e));
    }
  }

  /* 啟動前先點名，缺哪一支就直接說哪一支。
     少了核心模組會噴出一連串看不懂的 TypeError，
     不如一次講清楚要補傳什麼檔案。 */
  var REQUIRED = [
    ['CFG', 'config.js'], ['Settings', 'settings.js'], ['Rng', 'rng.js'], ['World', 'world.js'],
    ['Inv', 'inventory.js'], ['Res', 'resources.js'], ['Build', 'build.js'],
    ['Craft', 'craft.js'], ['Time', 'time.js'], ['Camera', 'camera.js'],
    ['Input', 'input.js'], ['Player', 'player.js'], ['Render', 'render.js'],
    ['Save', 'save.js'], ['Stats', 'stats.js'], ['Mobs', 'mobs.js'],
    ['Arrows', 'arrows.js'], ['Minimap', 'minimap.js'], ['Art', 'art.js'],
    ['Cloud', 'cloud.js'], ['Sfx', 'sfx.js'], ['Sites', 'sites.js'], ['Store', 'store.js'],
    ['Mates', 'companions.js'], ['DivineArms', 'divine-arms.js'],
    ['Bosses', 'bosses.js'], ['Calamity', 'calamity.js'], ['Guide', 'guide.js'], ['Travel', 'travel.js'],
    ['Journal', 'journal.js'], ['Skins', 'skins.js'], ['Rewards', 'rewards.js']
  ];

  function checkModules() {
    var miss = [], i;
    for (i = 0; i < REQUIRED.length; i++) {
      if (!W[REQUIRED[i][0]]) miss.push(REQUIRED[i][1]);
    }
    if (miss.length && window.__wildsErr) {
      window.__wildsErr('\u2717 \u7f3a\u5c11 ' + miss.length + ' \u652f\u6a21\u7d44\uff0c\u8acb\u4e0a\u50b3\u9019\u4e9b\u6a94\u6848\u5230 js/ \u8cc7\u6599\u593e\uff1a\n   ' + miss.join('\n   '));
    }
    return miss.length;
  }

  function init() {
    checkModules();
    try {
      initInner();
    } catch (e) {
      if (window.__wildsErr) {
        window.__wildsErr('\u2717 \u521d\u59cb\u5316\u4e2d\u65b7\uff1a' + (e && e.message ? e.message : e));
      }
      /* 即使初始化出錯，也要把畫面跑起來，至少能看見世界與錯誤訊息 */
      try {
        if (!canvas) canvas = document.getElementById('game');
        if (canvas && !ctx) { ctx = canvas.getContext('2d'); W.Render.init(ctx); }
        resize();
        W.Camera.snapTo(W.Player.wx, W.Player.wy);
        last = performance.now();
        requestAnimationFrame(loop);
      } catch (e2) {
        if (window.__wildsErr) window.__wildsErr('\u2717 \u7121\u6cd5\u555f\u52d5\uff1a' + (e2 && e2.message ? e2.message : e2));
      }
    }
  }

  function initInner() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    elPos   = document.getElementById('hud-pos');
    elChunk = document.getElementById('hud-chunk');
    elFps   = document.getElementById('hud-fps');
    elToast = document.getElementById('toast');
    _btnA   = document.getElementById('btn-a');
    _btnRoll = document.getElementById('btn-roll');
    elHp    = document.getElementById('bar-hp');
    elFood  = document.getElementById('bar-food');
    elStam  = document.getElementById('bar-stam');
    elSan   = document.getElementById('bar-san');
    elTime  = document.getElementById('hud-time');
    elMates = document.getElementById('hud-mates');
    elDivine = document.getElementById('hud-divine');
    elGuideTitle = document.getElementById('guide-title');
    elGuideHint = document.getElementById('guide-hint');
    elJournalTrackTitle = document.getElementById('journal-track-title');
    elJournalTrackText = document.getElementById('journal-track-text');
    elJournalTrackFill = document.getElementById('journal-track-fill');

    W.Settings.load();
    if(W.Sfx&&W.Sfx.setVolume)W.Sfx.setVolume(W.Settings.get('sfxVolume'));
    syncMuteButton();
    W.Render.init(ctx);
    loadCharPref();
    W.Input.init();
    resize();
    W.Camera.snapTo(W.Player.wx, W.Player.wy);

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function() {
      setTimeout(resize, 200);
    });

    on('btn-a', 'pointerdown', function(e) { e.preventDefault(); doAction(); });
    on('btn-roll', 'pointerdown', function(e) { e.preventDefault(); doRoll(); });
    window.addEventListener('keydown',function(e){
      if((e.key===' '||e.code==='Space')&&!e.repeat){e.preventDefault();doRoll();}
    });

    on('btn-guide', 'click', function() {
      if (!W.Guide) return;
      showToast(W.Guide.cycle());
      updateGuideHud();
    });
    on('btn-travel', 'click', openTravel);
    on('btn-equip', 'click', openEquipment);
    on('btn-skin', 'click', nextChar);
    on('btn-journal', 'click', openJournal);
    on('btn-rewards', 'click', openRewards);
    on('btn-settings', 'click', openSettings);
    on('travel-close', 'click', closeTravel);
    on('equip-close', 'click', closeEquipment);
    on('journal-close', 'click', closeJournal);
    on('reward-close', 'click', closeRewards);
    on('settings-close', 'click', closeSettings);
    on('settings-list', 'click', onSettingsClick);
    on('settings-reset', 'click', function(){W.Settings.reset();renderSettings();resize();syncMuteButton();showToast('已恢復預設設定');});
    on('conflict-close', 'click', closeCloudConflict);
    on('conflict-keep-local', 'click', function(){
      closeCloudConflict();W.Save.save().then(function(){return W.Cloud.upload();}).then(function(r){cloudResult(r,'已保留本機進度並上傳');});
    });
    on('conflict-use-cloud', 'click', function(){
      closeCloudConflict();W.Cloud.download(true).then(function(r){if(r===true)W.Camera.snapTo(W.Player.wx,W.Player.wy);cloudResult(r,'已使用雲端進度');});
    });
    on('travel-list', 'click', onTravelClick);
    on('tool-grid', 'click', onEquipmentClick);
    on('divine-grid', 'click', onEquipmentClick);
    on('journal-list', 'click', onJournalClick);
    on('reward-list', 'click', onRewardClick);
    on('reward-journal-link', 'click', function(){closeRewards();openJournal();});

    on('btn-eat-berry', 'click', function() {
      eat('berry', W.CFG.EAT_BERRY_FOOD, 0, 0);
    });

    on('btn-eat-meat', 'click', function() {
      eat('meat', W.CFG.EAT_MEAT_FOOD, W.CFG.EAT_MEAT_HP, W.CFG.SAN_RAW);
    });

    on('btn-b', 'pointerdown', function(e) {
      e.preventDefault();
      var on = W.Minimap.toggle();
      showToast('\u5c0f\u5730\u5716\uff1a' + (on ? '\u958b\u555f' : '\u95dc\u9589'));
    });

    on('btn-c', 'pointerdown', function(e) { e.preventDefault(); openBag(); });

    on('btn-d', 'pointerdown', function(e) { e.preventDefault(); openCraft(); });

    on('gc-close', 'click', function() {
      document.getElementById('goal-card').classList.remove('open');
      try { window.localStorage.setItem('wilds:goalSeen', '1'); } catch (e) {}
    });

    document.addEventListener('pointerdown', function globalBtnPop(e) {
      if (W.Sfx) W.Sfx.unlock();
      var t = e.target;
      while (t && t !== document.body) {
        if (t.tagName === 'BUTTON') {
          t.classList.remove('btn-pop');
          void t.offsetWidth;
          t.classList.add('btn-pop');
          if (W.Sfx) W.Sfx.tap();
          return;
        }
        t = t.parentNode;
      }
    }, true);

    on('sm-move', 'click', beginMove);
    on('sm-store', 'click', storeStruct);
    on('sm-cancel', 'click', closeStructMenu);
    on('pb-ok', 'click', placeCarry);
    on('pb-cancel', 'click', cancelCarry);

    safe('\u96f2\u7aef\u6309\u9215', function() {
    on('btn-sync', 'click', function() {
      if (!W.FIREBASE_CONFIG) {
        showToast('\u96f2\u7aef\u672a\u8a2d\u5b9a\uff08\u9700\u586b firebase-config\uff09');
        return;
      }
      if (W.Cloud.isSignedIn()) {
        if (!window.confirm('\u8981\u767b\u51fa Google \u5e33\u865f\u55ce\uff1f\u672c\u6a5f\u5b58\u6a94\u6703\u4fdd\u7559\u3002')) return;
        W.Cloud.signOut().then(function() { showToast('\u5df2\u767b\u51fa'); });
      } else {
        showToast('\u6b63\u5728\u767b\u5165 Google\u2026');
        W.Cloud.signIn().then(function(r) { cloudResult(r, '\u767b\u5165\u6210\u529f\uff0c\u9032\u5ea6\u5df2\u540c\u6b65'); });
      }
    });

    if (W.Cloud.setOnState) {
      W.Cloud.setOnState(function(signedIn) {
        var b = document.getElementById('btn-sync');
        if (!b) return;
        if (signedIn) { b.classList.add('on'); } else { b.classList.remove('on'); }
        cloudLabel();
      });
    }
    });

    on('btn-mute', 'click', function() {
      var m = !W.Sfx.isMuted();
      W.Sfx.setMuted(m);
      syncMuteButton();
    });

    on('craft-close', 'click', closeCraft);

    on('btn-sleep', 'click', doSleep);

    on('craft-list', 'click', onCraftClick);

    on('btn-eat-cooked', 'click', function() {
      eat('cooked', W.CFG.EAT_COOKED_FOOD, W.CFG.EAT_COOKED_HP, W.CFG.SAN_COOKED);
    });

    on('btn-eat-soup', 'click', function() {
      eat('soup', W.CFG.EAT_SOUP_FOOD, W.CFG.EAT_SOUP_HP, W.CFG.SAN_SOUP);
    });

    on('btn-eat-jerky', 'click', function() {
      eat('jerky', W.CFG.EAT_JERKY_FOOD, W.CFG.EAT_JERKY_HP, W.CFG.SAN_JERKY);
    });

    on('btn-char', 'click', nextChar);

    on('store-body', 'click', onStoreClick);

    on('st-all', 'click', function() {
      var n = W.Store.depositAll();
      showToast(n ? ('\u5b58\u5165 ' + n + ' \u4ef6') : '\u6c92\u6709\u53ef\u5b58\u7684\u6771\u897f');
      renderStore();
    });

    on('st-close', 'click', function() {
      document.getElementById('store-panel').classList.remove('open');
    });

    on('bag-close', 'click', function() {
      document.getElementById('bag-panel').classList.remove('open');
    });

    on('btn-cloud', 'click', function() {
      if (W.Cloud.isSignedIn()) {
        W.Cloud.signOut().then(function() {
          showToast('\u5df2\u767b\u51fa\u96f2\u7aef');
          cloudLabel();
        });
      } else {
        W.Cloud.signIn().then(function(r) { cloudResult(r, '\u767b\u5165\u6210\u529f'); });
      }
    });

    on('btn-up', 'click', function() {
      W.Save.save().then(function() { return W.Cloud.upload(); })
        .then(function(r) { cloudResult(r, '\u5df2\u4e0a\u50b3\u96f2\u7aef'); });
    });

    on('btn-down', 'click', function() {
      W.Cloud.download(false).then(function(r) {
        if (r === 'newer-local') {
          openCloudConflict();
          return;
        }
        if (r === true) { W.Camera.snapTo(W.Player.wx, W.Player.wy); }
        cloudResult(r, '\u5df2\u5f9e\u96f2\u7aef\u4e0b\u8f09');
      });
    });

    on('btn-save', 'click', function() {
      W.Save.save().then(function(r) {
        showToast(r ? '\u5df2\u5b58\u6a94 \u2713' : '\u5b58\u6a94\u5931\u6557');
      });
    });

    on('btn-load', 'click', function() {
      W.Save.load().then(function(r) {
        if (r) { W.Camera.snapTo(W.Player.wx, W.Player.wy); }
        showToast(r ? '\u5b58\u6a94\u5df2\u8b80\u53d6 \u2713' : '\u627e\u4e0d\u5230\u5b58\u6a94');
      });
    });

    on('btn-export','click',exportBackup);
    on('btn-import','click',function(){var f=document.getElementById('save-file-input');if(f)f.click();});
    on('save-file-input','change',function(){var f=this.files&&this.files[0];importBackup(f);this.value='';});
    on('btn-update-later','click',function(){document.getElementById('update-panel').classList.remove('open');});
    on('btn-update-now','click',function(){
      var b=this;b.disabled=true;b.textContent='正在保存…';
      W.Save.save().then(function(ok){
        if(!ok){b.disabled=false;b.textContent='存檔並立即更新';showToast('存檔失敗，暫不切換版本');return;}
        var worker=updateReg&&updateReg.waiting;
        if(!worker){b.disabled=false;b.textContent='存檔並立即更新';showToast('更新尚未準備完成');return;}
        reloadOnController=true;b.textContent='正在更新…';worker.postMessage({type:'SKIP_WAITING'});
      });
    });

    on('btn-wipe', 'click', function() {
      if (!window.confirm('\u78ba\u5b9a\u8981\u6e05\u9664\u5b58\u6a94\uff1f\u80cc\u5305\u8207\u63a1\u96c6\u7d00\u9304\u6703\u6b78\u96f6\uff0c\u6b64\u52d5\u4f5c\u7121\u6cd5\u5fa9\u539f\u3002')) return;
      W.Save.wipe().then(function() {
        showToast('\u5b58\u6a94\u5df2\u6e05\u9664');
      });
    });

    on('btn-diag', 'click', function() {
      document.getElementById('diag-body').textContent = diagText();
      document.getElementById('diag-panel').classList.add('open');
    });
    on('diag-close', 'click', function() {
      document.getElementById('diag-panel').classList.remove('open');
    });

    window.addEventListener('pagehide', function() { W.Save.save(); W.Cloud.upload(); });
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') { W.Save.save(); W.Cloud.upload(); }
    });

    registerSafeUpdate();

    safe('\u5925\u4f34\u521d\u59cb\u5316', function() {
      W.Mates.init();
      W.Bosses.init();
    });

    W.Game.onMateJoin = function(def) {
      showToast('\uD83C\uDF89 ' + def.name + ' \u52a0\u5165\u968a\u4f0d\uff01');
      if (W.Sfx) W.Sfx.kill();
    };
    W.Game.onMateHit = function(m, hit) {
      W.Render.dmgText(hit.wx || m.wx, (hit.wy || m.wy) - 10, '-' + hit.dmg);
    };
    W.Game.onBossDown = function(b) {
      showToast(b.def.reward
        ? ('🏆 擊敗 ' + b.def.name + (b.rewardUnlocked ? '！獲得神武' : '！神武已持有'))
        : ('🏆 擊敗 ' + b.def.name + '！牢籠開了'));
      if (W.Sfx) W.Sfx.kill();
      if(W.Rewards)W.Rewards.sync(false);
      W.Save.save();
    };
    W.Game.onBossHitPlayer = function() {
      if(W.Render&&W.Render.shake)W.Render.shake(7,0.22);
      if(W.Settings)W.Settings.vibrate(35);
      if (W.Sfx) W.Sfx.hurt();
    };
    W.Game.onPerfectDodge = function(info) {
      showToast('✨ 完美閃避！體力 +12，下一擊傷害 +18');
      if(W.Render){if(W.Render.slowMotion)W.Render.slowMotion(0.32,0.32);if(W.Render.dodgeFx)W.Render.dodgeFx(info.wx,info.wy,-W.Player.faceX,-W.Player.faceY);}
      if(W.Sfx&&W.Sfx.perfectDodge)W.Sfx.perfectDodge();
      if(W.Settings)W.Settings.vibrate([18,30,18]);
    };
    W.Game.onBossPhase = function(b,phase) {
      showToast('⚠️ '+b.def.name+' 進入第 '+phase+' 階段，攻擊加速！');
      if(W.Render&&W.Render.phaseFx)W.Render.phaseFx(b.wx,b.wy);
      if(W.Render&&W.Render.flash)W.Render.flash('rgba(135,70,180,0.25)',0.24);
      if(W.Sfx)W.Sfx.hurt();
    };

    W.Game.onDivineArmUnlock = function(def) {
      showToast('✨ 獲得「' + def.name + '」並自動裝備');
      if (W.Sfx) W.Sfx.kill();
      if(W.Rewards)W.Rewards.sync(false);
    };
    W.Game.onDivineHit = function(kind, hit, wx, wy) {
      if (hit && W.Render) { W.Render.dmgText(wx, wy - 14, '-' + hit.dmg);if(W.Render.impact)W.Render.impact(wx,wy,!!hit.killed); }
      if (W.Sfx) W.Sfx.hit();
    };
    W.Game.onSwordWave = function(seen, fromGun, boosted) {
      if(fromGun) showToast('⚡ 雷光蓄斬！神槍引爆劍氣');
      else if(boosted) showToast('🛡️ 守護劍域！光刃強化');
      if (W.Sfx) W.Sfx.hit();
    };
    W.Game.onDivineOverdrive = function(){
      showToast('🌟 三神共鳴：神域爆發 4 秒');
      W.Render.flash('rgba(205,170,255,0.28)');
      if(W.Sfx)W.Sfx.kill();
    };
    W.Game.onShieldBlock = function() {
      showToast('🛡️ 神盾抵擋了攻擊');
      if (W.Sfx) W.Sfx.hit();
    };
    W.Game.onAxeTornado = function(boosted) {
      showToast(boosted ? '⚔️ 光刃龍捲！神劍強化神斧' : '🪓 神斧怒氣爆發：旋風 4 秒');
      if (W.Sfx) W.Sfx.kill();
    };
    W.Game.onWingEvade = function(source, shieldRefreshed) {
      showToast(shieldRefreshed ? '🪽 神翼閃避致命傷害，神盾刷新' : '🪽 神翼閃避致命傷害');
      W.Render.flash('rgba(170,225,255,0.28)');
      if (W.Sfx) W.Sfx.hit();
    };
    W.Game.onDivineDomain = function() {
      showToast('⚡ 五神共鳴：神之領域');
      W.Render.flash('rgba(255,235,145,0.24)');
      if (W.Sfx) W.Sfx.kill();
    };
    W.Game.onCalamityGateOpen = function() {
      showToast('☄️ 世界災禍祭壇甦醒了');
    };
    W.Game.onCalamitySummonStart = function(r) {
      showToast('☄️ 正在召喚「'+r.name+'」：'+r.seconds+' 秒內不要離開，再按一次可取消');
      if(W.Render&&W.Render.flash)W.Render.flash('rgba(210,80,45,0.22)',0.3);
    };
    W.Game.onCalamitySummonCancel = function(reason) {
      showToast(reason||'召喚已取消');_btnMode='';
    };
    W.Game.onCalamitySummoned = function(b) {
      var cs=W.Calamity&&W.Calamity.stats?W.Calamity.stats():null;
      if(cs&&cs.activeAscended)showToast('🔥 飛升災禍 Lv.'+(cs.ascensionCycle+1)+'：'+b.name+' 強化降臨');
      else showToast(b&&b.id==='titan'?'⚠️ 骸骨泰坦降臨！躲避骨刺與震波':'⚠️ 萬眼巨鯤降臨！避開深淵與隕石');
      W.Render.flash('rgba(105,45,135,0.5)');
      if(W.Render&&W.Render.shake)W.Render.shake(11,0.5);
      if (W.Sfx) W.Sfx.hurt();
      W.Save.save();
    };
    W.Game.onCalamityDown = function(b) {
      showToast(b&&b.id==='titan'?'🏆 擊敗骸骨泰坦！兩大災禍已平息':'🏆 擊敗萬眼巨鯤！祭壇出現更強大的氣息');
      W.Render.flash('rgba(175,105,225,0.65)');
      if (W.Sfx) W.Sfx.kill();
      W.Save.save();
    };
    W.Game.onCalamityPhase = function(b,phase) {
      showToast('☄️ '+b.name+' 進入 Phase '+phase+'，新的災禍攻勢展開');
      if(W.Render&&W.Render.phaseFx)W.Render.phaseFx(b.wx,b.wy);
      if(W.Render&&W.Render.flash)W.Render.flash('rgba(155,70,215,0.32)',0.28);
      if(W.Sfx)W.Sfx.hurt();
    };
    W.Game.onAscensionReward = function(r) {
      showToast('💠 飛升輪迴 '+r.cycle+' 完成！神格碎片 +1（神武與 Skin 永久強化）');
      W.Render.flash('rgba(255,205,100,0.55)');
      if(W.Sfx)W.Sfx.kill();
      if(W.Rewards)W.Rewards.sync(false);
      W.Save.save();
    };
    W.Game.onSkinUnlock = function(def) {
      showToast('🌌 解鎖 Skin：「' + def.name + '」並自動裝備');
      applyCharacterSprite();_rewardSig='';
      if(rewardOpen)renderRewards();
      W.Save.save();
    };
    W.Game.onSkinEquip = function(def) {
      applyCharacterSprite();
      showToast(def?'已裝備 Skin：「'+def.name+'」':'已卸下 Skin，恢復原始造型');
      if(rewardOpen)renderRewards();
      W.Save.save();
    };
    W.Game.onSkinPulse = function(def) {
      var c=def&&def.id==='death'?'rgba(170,150,120,0.18)':(def&&def.id==='star'?'rgba(110,175,255,0.2)':'rgba(75,35,110,0.18)');
      W.Render.flash(c);
    };
    W.Game.onSkinPhoenix = function() {
      showToast('🔥 不死鳥涅槃！本次飛升輪迴的涅槃已使用');
      W.Render.flash('rgba(255,105,30,0.5)',0.45);
      if(W.Sfx)W.Sfx.kill();
      W.Save.save();
    };
    W.Game.onWaypointDiscovered = function(p) {
      showToast('🌀 解鎖快速移動：' + p.name);
      W.Save.save();
    };
    W.Game.onJournalUpdated = function(info) {
      _journalSig = '';
      showToast('📜 冒險日誌更新：完成「' + info.last.title + '」');
      if (journalOpen) renderJournal();
      W.Save.save();
    };

    safe('\u96f2\u7aef\u521d\u59cb\u5316', function() {
      W.Cloud.init();
      cloudLabel();
    });

    W.Save.open().then(function() {
      return W.Save.load();
    }).then(function(loaded) {
      if (!loaded) W.Player.spawn();
      W.Camera.snapTo(W.Player.wx, W.Player.wy);
      if (W.Bosses) W.Bosses.init();
      if (W.Guide) W.Guide.init();
      if (W.Travel) W.Travel.update(1);
      if (W.Journal) W.Journal.update(1);
      if (W.Rewards) W.Rewards.sync(true);
      applyCharacterSprite();_rewardSig='';
      var ov = W.Save.info().overflow || 0;
      if (ov > 0) {
        showToast('\u80cc\u5305\u8d85\u91cd\uff0c' + ov + ' \u4ef6\u5df2\u79fb\u5165\u5132\u7269\u7bb1\uff08\u84cb\u4e00\u500b\u5c31\u80fd\u53d6\u56de\uff09');
      }
      showToast(loaded ? '\u5df2\u8b80\u53d6\u5b58\u6a94' : '\u65b0\u7684\u65c5\u7a0b\u958b\u59cb');
      var seenGoal = false;
      try { seenGoal = window.localStorage.getItem('wilds:goalSeen') === '1'; } catch (e) {}
      var gc = document.getElementById('goal-card');
      if (!seenGoal && gc) { gc.classList.add('open'); }

      last = performance.now();
      requestAnimationFrame(loop);
    });
  }

  function onHurt() {
    if(W.Settings)W.Settings.vibrate(30);
    if(W.Render&&W.Render.shake)W.Render.shake(5,0.18);
    if (W.Stats.hpPct() < 0.3) showToast('\u751f\u547d\u5371\u96aa\uff01\u5feb\u9003\u6216\u9032\u98df');
  }

  return {
    init: init,
    onHurt: onHurt,
    onArrowHit: onArrowHit,
    placeMode: function() { return craftOpen; },
    carryGhost: function(out) {
      if (!_carry) return 0;
      carryPos(out);
      return _carry.type + 1;
    }
  };
})();

window.addEventListener('load', W.Game.init);
