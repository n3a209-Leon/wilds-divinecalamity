/* Phase 25：全野獸顯示契約、新增生態行為與透明素材。 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {loadProject} = require('./check-load');
const root = path.resolve(__dirname, '..');
const loaded = loadProject(root, true);
if (loaded.failures.length) process.exit(1);
const W = loaded.context.W;
let failures = 0;
function check(ok,msg){console.log((ok?'✅ ':'❌ ')+msg);if(!ok)failures++;}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:(pb<=pc?b:c);}
function readRgba(file){
  const b=fs.readFileSync(file);let p=8,w=0,h=0,id=[];
  while(p<b.length){const n=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),d=b.subarray(p+8,p+8+n);p+=12+n;
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);}if(t==='IDAT')id.push(d);if(t==='IEND')break;}
  const raw=zlib.inflateSync(Buffer.concat(id)),stride=w*4,out=Buffer.alloc(stride*h);let q=0;
  for(let y=0;y<h;y++){const f=raw[q++],base=y*stride,prev=base-stride;for(let x=0;x<stride;x++){
    const left=x>=4?out[base+x-4]:0,up=y?out[prev+x]:0,ul=(y&&x>=4)?out[prev+x-4]:0;
    const pred=f===1?left:(f===2?up:(f===3?Math.floor((left+up)/2):(f===4?paeth(left,up,ul):0)));
    out[base+x]=(raw[q++]+pred)&255;}}
  return {w,h,pixels:out};
}

const types = ['DEER','RABBIT','WOLF','SHADOW','BOAR','BEAR','CROW','FOX','GOAT','BADGER'];
const idle = ['deer','rabbit','wolf',null,'boar','bear','crow','fox','goat','badger'];
const move = ['deer_walk','rabbit_hop','wolf_run',null,'boar_run','bear_walk','crow_fly','fox_run','goat_charge','badger_run'];
check(types.every((k,i)=>W.Mobs.TYPE[k]===i), '十種生物 TYPE 索引連續且與素材表一致');
check(W.CFG.ART_MOB_H.length===types.length && W.CFG.ART_MOB_H.every((h,i)=>i===3?h===0:(Number.isFinite(h)&&h>0)),
  '每種實體野獸都有有效顯示高度；陰影保留向量繪製');

const artSrc=fs.readFileSync(path.join(root,'js','art.js'),'utf8');
const renderSrc=fs.readFileSync(path.join(root,'js','render.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const assets=idle.concat(move).filter(Boolean);
let pngOk=true, missing=[];
for(const name of assets){
  const rel='assets/'+name+'.png', file=path.join(root,rel);
  if(!fs.existsSync(file)){missing.push(rel);pngOk=false;continue;}
  const b=fs.readFileSync(file), w=b.readUInt32BE(16), h=b.readUInt32BE(20);
  if(b.toString('ascii',1,4)!=='PNG'||w<16||h<16||(b[25]!==4&&b[25]!==6))pngOk=false;
  if(!artSrc.includes("'"+name+"'")||!sw.includes("'./"+rel+"'"))pngOk=false;
}
check(pngOk&&!missing.length, '九種野獸共十八張待機／移動 PNG 均存在、可解碼、含透明通道並納入載入與離線快取');
let matteOk=true;
for(const name of ['fox','fox_run','goat','goat_charge','badger','badger_run']){
  const img=readRgba(path.join(root,'assets',name+'.png'));let visible=0,green=0;
  for(let i=0;i<img.pixels.length;i+=4){const r=img.pixels[i],g=img.pixels[i+1],b=img.pixels[i+2],a=img.pixels[i+3];
    if(a>12){visible++;if(g>r+45&&g>b+45&&g>110)green++;}}
  const corners=[3,img.w*4-1,(img.h-1)*img.w*4+3,img.w*img.h*4-1].every(i=>img.pixels[i]===0);
  if(!corners||visible<900||green>16)matteOk=false;
}
check(matteOk,'六張新野獸素材透明角落、主體覆蓋與去綠邊有效');
check(/var MOB_ART\s*=\s*\[[^\n]*'fox'[^\n]*'goat'[^\n]*'badger'/.test(renderSrc)&&
  /var MOB_ART_MOVE\s*=\s*\[[^\n]*'fox_run'[^\n]*'goat_charge'[^\n]*'badger_run'/.test(renderSrc)&&
  /!isFinite\(hWorld\)/.test(renderSrc),
  '繪圖索引已接上新野獸，且高度遺漏時仍有安全備援');

W.World.isSolidAt=()=>false;
W.Mobs.clearAll();
for(let i=0;i<types.length;i++){
  check(W.Mobs.spawnChallenge('phase25-'+i,500+i*30,500,i,false), '物件池可生成 '+types[i]);
}
for(let i=0;i<types.length;i++){
  const m=W.Mobs.at(i);
  check(m&&m.alive&&m.type===i&&m.hp>0&&W.Mobs.radius(i)>0&&W.Mobs.nameOf(i), types[i]+' 具有生命、碰撞半徑與名稱');
}

W.Player.wx=500;W.Player.wy=500;
W.Time.isNight=()=>true;W.Time.dayNo=()=>5;
const hits=[];
W.Stats.isDead=()=>false;W.Stats.isLowSan=()=>false;
W.Stats.damage=(n,key)=>{hits.push({n,key});return true;};
W.Build.nearType=()=>null;
W.Skins=null;W.Game={onHurt(){}};

W.Mobs.clearAll();
W.Mobs.spawnChallenge('fox-behavior',620,500,W.Mobs.TYPE.FOX,false);
const fox=W.Mobs.at(0);W.Mobs.update(.4);
check(fox.alive&&fox.threatT>0&&(Math.abs(fox.vx)+Math.abs(fox.vy)>0),'狐狸夜間會迂迴逼近，而非套用狼的直線追擊');

W.Mobs.clearAll();
W.Mobs.spawnChallenge('goat-behavior',630,500,W.Mobs.TYPE.GOAT,false);
const goat=W.Mobs.at(0);W.Mobs.update(.4);
check(goat.windupT>0&&goat.chargeT===0,'山羊衝撞前先進入可視預警');
W.Mobs.update(.45);
check(goat.windupT===0&&goat.chargeT>0,'山羊預警結束後才鎖定方向衝刺');

W.Mobs.clearAll();
W.Mobs.spawnChallenge('badger-behavior',650,500,W.Mobs.TYPE.BADGER,false);
const badger=W.Mobs.at(0);badger.aggroT=0;W.Mobs.hitAt(650,500,20,1);
check(badger.aggroT>=6.9,'巨獾平時中立，受擊後會進入較長追擊狀態');

const travelSrc=fs.readFileSync(path.join(root,'js','travel.js'),'utf8');
const matesSrc=fs.readFileSync(path.join(root,'js','companions.js'),'utf8');
const bondSrc=fs.readFileSync(path.join(root,'js','bondmate.js'),'utf8');
check(/Mobs\.isHostile/.test(travelSrc)&&/Mobs\.isHostile/.test(matesSrc)&&/Mobs\.isHostile/.test(bondSrc),
  '快速移動與所有夥伴共用威脅判斷，不會把和平野獸當敵人');

W.Mobs.clearAll();W.Mobs.spawnChallenge('crow-loot',620,500,W.Mobs.TYPE.CROW,false);
let lootHit=W.Mobs.hitAt(620,500,20,99);
check(lootHit&&lootHit.killed&&lootHit.loot==='', '烏鴉不會再顯示不存在的生肉／毛皮掉落');
W.Mobs.clearAll();W.Mobs.spawnChallenge('goat-loot',620,500,W.Mobs.TYPE.GOAT,false);
lootHit=W.Mobs.hitAt(620,500,20,99);
check(lootHit&&lootHit.loot==='生肉×3、毛皮×2', '新野獸擊殺提示會顯示實際掉落數量');

console.log(failures?'\n=== Phase 25 野獸生態驗證失敗：'+failures+' 項 ===':'\n=== Phase 25 野獸生態驗證全部通過 ===');
process.exitCode=failures?1:0;
