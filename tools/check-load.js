/* Layer 2：模擬瀏覽器，依 index.html 的真實 script 順序逐檔載入。
   用來抓 node --check 看不到的載入順序、未定義模組與白畫面問題。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function canvasContext() {
  const gradient = { addColorStop() {} };
  const base = {
    canvas: { width: 800, height: 600 },
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getImageData: () => ({ data: new Uint8ClampedArray(4) })
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return function() {};
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}

function element() {
  const base = {
    style: {}, dataset: {}, width: 800, height: 600,
    textContent: '', innerHTML: '', value: '', tagName: 'DIV',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    getContext: () => canvasContext(),
    getBoundingClientRect: () => ({ left:0, top:0, right:100, bottom:100, width:100, height:100 }),
    addEventListener(){}, removeEventListener(){}, appendChild(){}, removeChild(){},
    setAttribute(){}, getAttribute(){ return null; }, querySelector(){ return element(); }, querySelectorAll(){ return []; }
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'string' && /^(on|add|set|append|remove|insert|focus|click|clone)/.test(prop)) return function(){ return element(); };
      return undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}

function makeContext() {
  const store = {};
  const localStorage = {
    getItem: k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k,v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
  const doc = {
    getElementById: () => element(), querySelector: () => element(), querySelectorAll: () => [],
    createElement: () => element(), createElementNS: () => element(),
    addEventListener(){}, removeEventListener(){}, body: element(), head: element(), documentElement: element(),
    visibilityState: 'visible', hidden: false, fonts: { ready: Promise.resolve() }
  };
  const firebase = new Proxy(function(){ return firebase; }, { get: () => firebase, apply: () => firebase });
  const s = {
    window:null, self:null, globalThis:null, document:doc, localStorage, console,
    Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, WeakMap, Symbol, Promise,
    Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Int32Array, Uint32Array, ArrayBuffer,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    setTimeout:()=>0, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
    requestAnimationFrame:()=>0, cancelAnimationFrame(){}, performance:{now:()=>0},
    AudioContext:function(){return element();}, webkitAudioContext:function(){return element();},
    Image:function(){return element();}, firebase, indexedDB:{open:()=>({})},
    navigator:{userAgent:'node',onLine:true,serviceWorker:{register:()=>Promise.resolve(),ready:Promise.resolve()},vibrate(){}},
    location:{href:'http://localhost/',hostname:'localhost',protocol:'http:',reload(){}},
    innerWidth:390, innerHeight:844, devicePixelRatio:2,
    alert(){}, confirm:()=>true, prompt:()=>'',
    fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
    atob:x=>x, btoa:x=>x, addEventListener(){}, removeEventListener(){},
    matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
    URL, URLSearchParams, Blob:global.Blob, crypto:global.crypto
  };
  s.window=s; s.self=s; s.globalThis=s;
  vm.createContext(s);
  return s;
}

function scriptOrder(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return [...html.matchAll(/<script\s+src="(js\/[^"]+\.js)"/g)].map(m => m[1]);
}

function loadProject(root, quiet) {
  root = root || path.resolve(__dirname, '..');
  const context = makeContext();
  const order = scriptOrder(root);
  const failures = [];
  for (const rel of order) {
    try {
      vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, {filename:rel});
      if (!quiet) console.log('✅ ' + rel);
    } catch (error) {
      failures.push({rel, error});
      if (!quiet) console.log('❌ ' + rel + '  →  ' + error.constructor.name + ': ' + error.message);
    }
  }
  return {context, order, failures};
}

if (require.main === module) {
  const r = loadProject(path.resolve(__dirname, '..'), false);
  console.log(r.failures.length ? '\n=== 有載入期崩潰 ===' : '\n=== 全部模組載入成功，無載入期崩潰 ===');
  process.exitCode = r.failures.length ? 1 : 0;
}

module.exports = { makeContext, scriptOrder, loadProject };
