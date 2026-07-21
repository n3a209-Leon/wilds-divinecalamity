/* Phase 19 行為驗證：夥伴三幀素材、透明間隔、平滑跟隨、轉向與獨立攻擊。 */
const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const {loadProject}=require('./check-load');
const root=path.resolve(__dirname,'..');
const loaded=loadProject(root,true);
let bad=0;
function check(ok,msg){console.log((ok?'✅ ':'❌ ')+msg);if(!ok)bad++;}
if(loaded.failures.length){check(false,'Phase 19 測試前置載入');process.exitCode=1;return;}
const W=loaded.context.W;

function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:(pb<=pc?b:c);}
function readRgba(file){
  const b=fs.readFileSync(file);let p=8,w=0,h=0,bit=0,color=0,id=[];
  while(p<b.length){const n=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),d=b.subarray(p+8,p+8+n);p+=12+n;
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bit=d[8];color=d[9];}
    if(t==='IDAT')id.push(d);if(t==='IEND')break;
  }
  if(bit!==8||color!==6)throw new Error('需要 8-bit RGBA PNG');
  const raw=zlib.inflateSync(Buffer.concat(id)),stride=w*4,out=Buffer.alloc(stride*h);let q=0;
  for(let y=0;y<h;y++){const f=raw[q++],base=y*stride,prev=base-stride;
    for(let x=0;x<stride;x++){const left=x>=4?out[base+x-4]:0,up=y?out[prev+x]:0,ul=(y&&x>=4)?out[prev+x-4]:0;
      let pred=0;if(f===1)pred=left;else if(f===2)pred=up;else if(f===3)pred=Math.floor((left+up)/2);else if(f===4)pred=paeth(left,up,ul);
      out[base+x]=(raw[q++]+pred)&255;
    }
  }
  return {w,h,pixels:out};
}

for(const id of ['knight','archer','cat','sprite']){
  const img=readRgba(path.join(root,'assets','mate_'+id+'_sheet.png'));
  let visible=0,green=0,gutters=true;
  for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){
    const i=(y*img.w+x)*4,r=img.pixels[i],g=img.pixels[i+1],bl=img.pixels[i+2],a=img.pixels[i+3];
    if(a>12){visible++;if(g>r+45&&g>bl+45&&g>110)green++;}
    if((x===191||x===192||x===383||x===384)&&a!==0)gutters=false;
  }
  const corners=[3,img.w*4-1,(img.h-1)*img.w*4+3,img.w*img.h*4-1].every(i=>img.pixels[i]===0);
  check(img.w===576&&img.h===192&&corners&&gutters&&visible>8000&&green<80,'mate_'+id+'_sheet：三幀尺寸、透明角落／間隔與去綠邊有效');
}

const old={count:W.Mobs.count,at:W.Mobs.at,hitAt:W.Mobs.hitAt};
W.Player.wx=1000;W.Player.wy=1000;W.Player.faceX=1;W.Player.faceY=0;
W.Mates.importData({knight:1,archer:1,cat:1,sprite:1});
W.Mobs.count=()=>0;W.Mobs.at=()=>null;
const mate=W.Mates.at(0);mate.wx=1220;mate.wy=1120;mate.eatT=999;mate.atkT=999;
const beforeX=mate.wx,beforeAnim=mate.animT;W.Mates.update(0.1);
check(mate.wx!==beforeX&&Math.abs(mate.vx)>0&&mate.animT>beforeAnim&&typeof mate.bob==='number','夥伴以加速度移動並持續更新自然動畫狀態');
check(Math.abs(mate.wx-beforeX)<W.CFG.PLAYER_SPEED*0.1,'夥伴不會在一般距離瞬移或硬切位置');

let hits=0;const foe={alive:true,wx:mate.wx+45,wy:mate.wy,type:0};
W.Mobs.count=()=>1;W.Mobs.at=()=>foe;W.Mobs.hitAt=(x,y,r,dmg)=>{hits++;return {wx:foe.wx,wy:foe.wy,dmg,name:'測試目標',killed:false};};
mate.atkT=0;mate.actionT=0;W.Mates.update(0.02);
check(hits>0&&mate.actionT>0&&mate.hitWx===foe.wx,'夥伴會主動瞄準範圍內目標並切入攻擊幀');
W.Mobs.count=old.count;W.Mobs.at=old.at;W.Mobs.hitAt=old.hitAt;

const art=fs.readFileSync(path.join(root,'js/art.js'),'utf8');
const render=fs.readFileSync(path.join(root,'js/render.js'),'utf8');
const mates=fs.readFileSync(path.join(root,'js/companions.js'),'utf8');
check(/mate_knight_sheet/.test(art)&&/drawArtFrame/.test(render)&&/frameNo=m\.actionT>0\?2/.test(render),'四名夥伴三幀素材已接入渲染並具有攻擊幀優先權');
check(/arrive steering/.test(mates)&&/Player\.faceY \* side/.test(mates)&&/nearestTarget/.test(mates),'旋轉陣形、平滑跟隨與目標搜尋程式完整');

console.log(bad?'\n=== Phase 19 行為驗證失敗：'+bad+' 項 ===':'\n=== Phase 19 行為驗證全部通過 ===');
process.exitCode=bad?1:0;
