var CACHE_VERSION = 'wilds-v33';

/* CORE：缺一不可；其餘素材逐筆快取，單一檔案 404 不會導致整個 Service Worker 安裝失敗。 */
var CORE = [
  './index.html',
  './style.css',
  './manifest.json',
  './js/arrows.js',
  './js/art.js',
  './js/bosses.js',
  './js/build.js',
  './js/calamity.js',
  './js/camera.js',
  './js/cloud.js',
  './js/companions.js',
  './js/config.js',
  './js/craft.js',
  './js/divine-arms.js',
  './js/firebase-config.js',
  './js/input.js',
  './js/inventory.js',
  './js/main.js',
  './js/minimap.js',
  './js/mobs.js',
  './js/player.js',
  './js/render.js',
  './js/resources.js',
  './js/rng.js',
  './js/save.js',
  './js/sfx.js',
  './js/sites.js',
  './js/skins.js',
  './js/stats.js',
  './js/store.js',
  './js/time.js',
  './js/world.js'
];

var ASSETS = [
  './assets/apple-touch-icon.png',
  './assets/bear.png',
  './assets/bear_walk.png',
  './assets/bed.png',
  './assets/berry.png',
  './assets/berry_empty.png',
  './assets/boar.png',
  './assets/boar_run.png',
  './assets/boss_colossus.png',
  './assets/boss_colossus_atk.png',
  './assets/boss_dragon.png',
  './assets/boss_dragon_atk.png',
  './assets/boss_eagle.png',
  './assets/boss_eagle_atk.png',
  './assets/boss_hydra.png',
  './assets/boss_hydra_atk.png',
  './assets/boss_lava.png',
  './assets/boss_lava_atk.png',
  './assets/boss_shade.png',
  './assets/boss_shade_atk.png',
  './assets/boss_troll.png',
  './assets/boss_troll_atk.png',
  './assets/cage.png',
  './assets/cage_broken.png',
  './assets/cal_kun.png',
  './assets/cal_kun_atk.png',
  './assets/cal_titan.png',
  './assets/cal_titan_atk.png',
  './assets/campfire.png',
  './assets/campfire_out.png',
  './assets/cave.png',
  './assets/chest.png',
  './assets/chest_open.png',
  './assets/crate.png',
  './assets/crow.png',
  './assets/crow_fly.png',
  './assets/deer.png',
  './assets/deer_walk.png',
  './assets/fence.png',
  './assets/grass.png',
  './assets/grass_cut.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/mate_archer.png',
  './assets/mate_archer_walk.png',
  './assets/mate_cat.png',
  './assets/mate_cat_walk.png',
  './assets/mate_knight.png',
  './assets/mate_knight_walk.png',
  './assets/mate_sprite.png',
  './assets/mate_sprite_walk.png',
  './assets/player.png',
  './assets/player2.png',
  './assets/rabbit.png',
  './assets/rabbit_hop.png',
  './assets/rack.png',
  './assets/rock.png',
  './assets/rock_mined.png',
  './assets/ruin.png',
  './assets/tree.png',
  './assets/tree_cut.png',
  './assets/ui/arrow.png',
  './assets/ui/axe.png',
  './assets/ui/basket.png',
  './assets/ui/berry.png',
  './assets/ui/campfire.png',
  './assets/ui/cooked.png',
  './assets/ui/divine_axe.png',
  './assets/ui/divine_axe_on.png',
  './assets/ui/divine_gun.png',
  './assets/ui/divine_gun_on.png',
  './assets/ui/divine_shield.png',
  './assets/ui/divine_shield_on.png',
  './assets/ui/divine_sword.png',
  './assets/ui/divine_sword_on.png',
  './assets/ui/divine_wing.png',
  './assets/ui/divine_wing_on.png',
  './assets/ui/fiber.png',
  './assets/ui/flint.png',
  './assets/ui/furnace.png',
  './assets/ui/hide.png',
  './assets/ui/jerky.png',
  './assets/ui/meat.png',
  './assets/ui/metal.png',
  './assets/ui/mushroom.png',
  './assets/ui/pick.png',
  './assets/ui/planks.png',
  './assets/ui/sack.png',
  './assets/ui/shovel.png',
  './assets/ui/soup.png',
  './assets/ui/stone.png',
  './assets/ui/stones.png',
  './assets/ui/wood.png',
  './assets/ui/workbench.png',
  './assets/wall.png',
  './assets/wolf.png',
  './assets/wolf_run.png',
  './assets/workbench.png'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(c) {
      return c.addAll(CORE).then(function() {
        /* 素材逐筆加，失敗就跳過，不拖垮安裝。 */
        return Promise.all(ASSETS.map(function(u) {
          return c.add(u)['catch'](function() { return null; });
        }));
      });
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

/* 靈魂：圖片/JS/CSS 快取優先（手機上開局快很多），
   HTML 與其他請求網路優先，離線時回退快取。 */
function isStatic(url) {
  return /\.(png|jpg|jpeg|webp|svg|css|js|json)$/i.test(url.pathname);
}

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  if (isStatic(url) && url.pathname.indexOf('/index.html') === -1) {
    e.respondWith(
      caches.match(req).then(function(hit) {
        if (hit) return hit;
        return fetch(req).then(function(res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE_VERSION).then(function(c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  e.respondWith(
    fetch(req).then(function(res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function(c) { c.put(req, copy); });
      }
      return res;
    })['catch'](function() { return caches.match(req); })
  );
});
