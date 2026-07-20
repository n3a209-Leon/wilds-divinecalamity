window.W = window.W || {};

/* 圖片素材管理。
   任何一張圖載入失敗都只是該項目退回原本的向量畫法，遊戲不會開天窗。
   所有 Image 物件在啟動時一次建立完畢，繪製迴圈內不新建任何物件。 */
W.Art = (function() {

  var NAMES = [
    'tree', 'tree_cut', 'rock', 'rock_mined',
    'grass', 'grass_cut', 'berry', 'berry_empty',
    'deer', 'deer_walk', 'rabbit', 'rabbit_hop', 'wolf', 'wolf_run',
    'boar', 'boar_run', 'bear', 'bear_walk', 'crow', 'crow_fly',
    'campfire', 'bed', 'workbench',
    'wall', 'chest', 'chest_open', 'ruin', 'cave', 'crate', 'fence', 'rack',
    'campfire_out', 'cage', 'cage_broken',
    'mate_knight', 'mate_knight_walk', 'mate_archer', 'mate_archer_walk',
    'mate_cat', 'mate_cat_walk', 'mate_sprite', 'mate_sprite_walk',
    'boss_troll', 'boss_troll_atk', 'boss_shade', 'boss_shade_atk',
    'boss_hydra', 'boss_hydra_atk', 'boss_dragon', 'boss_dragon_atk',
    'boss_colossus', 'boss_colossus_atk', 'boss_eagle', 'boss_eagle_atk',
    'boss_lava', 'boss_lava_atk',
    'cal_kun', 'cal_kun_atk', 'cal_titan', 'cal_titan_atk',
    'ui/mushroom', 'ui/furnace', 'ui/flint', 'ui/meat', 'ui/cooked',
    'ui/hide', 'ui/arrow', 'ui/metal', 'ui/soup', 'ui/jerky',
    'ui/wood', 'ui/stone', 'ui/fiber', 'ui/berry', 'ui/axe', 'ui/pick',
    'ui/stones', 'ui/planks', 'ui/sack', 'ui/basket', 'ui/shovel',
    'ui/campfire', 'ui/workbench',
    'ui/divine_shield', 'ui/divine_shield_on',
    'ui/divine_gun', 'ui/divine_gun_on',
    'ui/divine_sword', 'ui/divine_sword_on',
    'ui/divine_axe', 'ui/divine_axe_on',
    'ui/divine_wing', 'ui/divine_wing_on'
  ];

  var imgs = {};
  var ready = {};
  var loaded = 0;
  var failed = 0;
  var failedNames = [];
  var started = false;

  function load() {
    if (started) return;
    started = true;
    var i, n;
    for (i = 0; i < NAMES.length; i++) {
      n = NAMES[i];
      ready[n] = false;
      imgs[n] = mk(n);
    }
  }

  function mk(name) {
    var im = new Image();
    im.onload = function() { ready[name] = true; loaded++; };
    im.onerror = function() {
      ready[name] = false;
      failed++;
      failedNames.push(name);
    };
    im.src = W.CFG.ART_DIR + name + '.png';
    return im;
  }

  function get(name) {
    if (!name) return null;
    return ready[name] ? imgs[name] : null;
  }

  function stats() {
    return { total: NAMES.length, loaded: loaded, failed: failed, names: failedNames };
  }

  return { load: load, get: get, stats: stats };
})();
