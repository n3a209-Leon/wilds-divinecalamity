window.W = window.W || {};

/* 五件神武可同時裝備。所有即時特效使用固定物件池；舊版三神武能力與共鳴保持相容。 */
W.DivineArms = (function() {
  var DEFS = {
    shield: { id:'shield', name:'星界神盾', cooldown:8, duration:2.2 },
    gun: { id:'gun', name:'星界神槍', cooldown:2.0, damage:34, range:720 },
    sword: { id:'sword', name:'星界神劍', every:3, damage:42, range:150 },
    axe: { id:'axe', name:'星界神斧', damage:18, range:68, rageMax:10, tornadoDamage:27, tornadoRange:145 },
    wing: { id:'wing', name:'星界神翼', cooldown:15, duration:1.1, speed:1.3, dash:104 }
  };

  var owned = {}, equipped = {};
  var shieldCd=0, shieldT=0, blocked=0;
  var gunCd=0, swordCount=0, gunShots=0, swordWaves=0;
  var gunCharge=0, overdriveCd=18, overdriveT=0, overdrives=0;
  var axeAngle=0, axeHitT=0, axeRage=0, tornadoT=0, tornadoTick=0, axeHits=0, tornadoes=0;
  var wingCd=0, wingT=0, wingBoostT=0, wingEvades=0;
  var domainCd=6, domainT=0, domainStrikes=0;
  var beams=[], waves=[], i;
  for(i=0;i<12;i++) beams.push({on:false,x1:0,y1:0,x2:0,y2:0,t:0,kind:'gun'});
  for(i=0;i<8;i++) waves.push({on:false,wx:0,wy:0,r:0,max:0,t:0,kind:'sword'});

  function unlock(id) {
    if(!DEFS[id] || owned[id]) return false;
    owned[id]=1; equipped[id]=1;
    if(id==='shield'){shieldCd=0;shieldT=DEFS.shield.duration;}
    if(id==='gun') gunCd=0.15;
    if(id==='axe'){axeHitT=0;axeRage=0;}
    if(id==='wing') wingCd=0;
    if(W.Game&&W.Game.onDivineArmUnlock) W.Game.onDivineArmUnlock(DEFS[id]);
    return true;
  }

  function setEquipped(id,on){
    if(!owned[id]||!DEFS[id]) return false;
    equipped[id]=on?1:0;
    return true;
  }

  function active(id){return !!(owned[id]&&equipped[id]);}
  function allThree(){return active('shield')&&active('gun')&&active('sword');}
  function allFive(){return allThree()&&active('axe')&&active('wing');}
  function resonanceCount(){
    var n=0;
    if(active('shield')&&active('gun'))n++;
    if(active('gun')&&active('sword'))n++;
    if(active('shield')&&active('sword'))n++;
    if(active('sword')&&active('axe'))n++;
    if(active('wing')&&active('gun'))n++;
    if(active('shield')&&active('wing'))n++;
    return n;
  }

  function update(dt){
    var cm=W.Skins&&W.Skins.divineCooldownMultiplier?W.Skins.divineCooldownMultiplier():1;
    var cdt=dt/(cm>0?cm:1);
    updateFx(dt);
    updateWing(dt,cdt);
    updateAxe(dt,cdt);

    if(allThree()){
      if(overdriveT>0){overdriveT-=dt;if(overdriveT<0)overdriveT=0;}
      else {
        overdriveCd-=cdt;
        if(overdriveCd<=0){
          overdriveCd=18;overdriveT=4;overdrives++;shieldT=Math.max(shieldT,4);
          if(W.Game&&W.Game.onDivineOverdrive)W.Game.onDivineOverdrive();
        }
      }
    }else{overdriveT=0;overdriveCd=18;}

    if(allFive()){
      domainCd-=cdt;
      if(domainCd<=0){domainCd=6;castDomainStrike();}
    }else{domainCd=6;domainT=0;}

    updateShield(dt,cdt);
    if(active('gun')){
      gunCd-=cdt;
      if(gunCd<=0){
        gunCd=overdriveT>0?0.8:(wingBoostT>0?1.2:DEFS.gun.cooldown);
        fireGun();
      }
    }
  }

  function updateShield(dt,cdt){
    if(!active('shield')){shieldT=0;return;}
    if(shieldT>0){shieldT-=dt;if(shieldT<0)shieldT=0;return;}
    shieldCd-=cdt;
    if(shieldCd<=0){
      shieldT=DEFS.shield.duration;shieldCd=DEFS.shield.cooldown;
      if(W.Game&&W.Game.onShieldReady)W.Game.onShieldReady();
    }
  }

  function updateWing(dt,cdt){
    if(!active('wing')){wingT=0;wingBoostT=0;return;}
    if(wingCd>0){wingCd-=cdt;if(wingCd<0)wingCd=0;}
    if(wingT>0){wingT-=dt;if(wingT<0)wingT=0;}
    if(wingBoostT>0){wingBoostT-=dt;if(wingBoostT<0)wingBoostT=0;}
  }

  function updateAxe(dt,cdt){
    if(!active('axe')){tornadoT=0;return;}
    axeAngle=(axeAngle+dt*(tornadoT>0?7.5:3.2))%(Math.PI*2);
    if(tornadoT>0){
      tornadoT-=dt;tornadoTick-=dt;
      if(tornadoTick<=0){tornadoTick=0.28;tornadoStrike();}
      if(tornadoT<0)tornadoT=0;
      return;
    }
    axeHitT-=cdt;
    if(axeHitT<=0){
      axeHitT=0.3;
      var x=W.Player.wx+Math.cos(axeAngle)*DEFS.axe.range;
      var y=W.Player.wy+Math.sin(axeAngle)*DEFS.axe.range;
      var hit=hitWorld(x,y,34,Math.round(DEFS.axe.damage*powerMult()));
      if(hit){
        axeHits++;axeRage++;
        if(W.Game&&W.Game.onDivineHit)W.Game.onDivineHit('axe',hit,x,y);
        if(axeRage>=DEFS.axe.rageMax)startTornado();
      }
    }
  }

  function startTornado(){
    axeRage=0;tornadoT=4;tornadoTick=0;tornadoes++;
    if(W.Game&&W.Game.onAxeTornado)W.Game.onAxeTornado(active('sword'));
  }

  function tornadoStrike(){
    var boosted=active('sword');
    var damage=Math.round(DEFS.axe.tornadoDamage*powerMult()*(boosted?1.4:1));
    var range=DEFS.axe.tornadoRange+(boosted?25:0);
    var hit=hitWorld(W.Player.wx,W.Player.wy,range,damage);
    if(hit&&W.Game&&W.Game.onDivineHit)W.Game.onDivineHit(boosted?'axe_sword':'axe',hit,hit.wx||W.Player.wx,hit.wy||W.Player.wy);
  }

  function collectTargets(limit,range){
    var list=[],seen=[],max=range||DEFS.gun.range;
    function add(o){
      if(!o||!o.alive||seen.indexOf(o)>=0)return;
      var dx=o.wx-W.Player.wx,dy=o.wy-W.Player.wy,d2=dx*dx+dy*dy;
      if(d2<=max*max){seen.push(o);list.push({o:o,d2:d2});}
    }
    if(W.Mobs){for(var j=0;j<W.Mobs.count();j++)add(W.Mobs.at(j));}
    if(W.Bosses&&W.Bosses.nearest)add(W.Bosses.nearest(W.Player.wx,W.Player.wy));
    if(W.Calamity&&W.Calamity.nearest)add(W.Calamity.nearest(W.Player.wx,W.Player.wy));
    else if(W.Calamity&&W.Calamity.boss)add(W.Calamity.boss());
    list.sort(function(a,b){return a.d2-b.d2;});
    var out=[];for(var i=0;i<list.length&&i<limit;i++)out.push(list[i].o);return out;
  }

  function nearestTarget(){
    var list=collectTargets(1,DEFS.gun.range);
    return list.length?list[0]:null;
  }

  function hitWorld(wx,wy,r,dmg){
    var hit=W.Mobs&&W.Mobs.hitAt(wx,wy,r,dmg);
    if(!hit&&W.Bosses)hit=W.Bosses.hitAt(wx,wy,r,dmg);
    if(!hit&&W.Calamity&&W.Calamity.hitAt)hit=W.Calamity.hitAt(wx,wy,r,dmg);
    return hit;
  }

  function powerMult(){return W.Calamity&&W.Calamity.powerMultiplier?W.Calamity.powerMultiplier():1;}

  function fireGun(){
    var split=active('shield'), targets=collectTargets(split?3:1); if(!targets.length)return;
    for(var i=0;i<targets.length;i++){
      var boost=wingBoostT>0?1.25:1;
      var t=targets[i],dmg=Math.round(DEFS.gun.damage*powerMult()*boost*(i===0?1:0.6));
      var hit=hitWorld(t.wx,t.wy,30,dmg),b=freeBeam();
      if(b){b.on=true;b.kind=wingBoostT>0?'wing':'gun';b.x1=W.Player.wx;b.y1=W.Player.wy-16;b.x2=t.wx;b.y2=t.wy;b.t=0.18;}
      if(hit&&W.Game&&W.Game.onDivineHit)W.Game.onDivineHit(i===0?'gun':'gun_split',hit,t.wx,t.wy);
    }
    gunShots++;gunCharge++;
    if(active('sword')&&gunCharge>=5){gunCharge=0;castSwordWave(true);}
  }

  function onPlayerAttack(){
    if(!active('sword'))return;
    swordCount++;
    if(swordCount<DEFS.sword.every)return;
    swordCount=0;castSwordWave();
  }

  function castSwordWave(fromGun){
    var shieldBoost=active('shield')&&shieldT>0;
    var range=DEFS.sword.range+(shieldBoost?35:0),damage=Math.round(DEFS.sword.damage*powerMult()*(shieldBoost?1.5:1));
    var w=freeWave();if(w){w.on=true;w.kind='sword';w.wx=W.Player.wx;w.wy=W.Player.wy;w.r=24;w.max=range;w.t=0.34;}
    var step=36,a,hit,seen=0;
    for(a=0;a<Math.PI*2;a+=Math.PI/8){
      hit=hitWorld(W.Player.wx+Math.cos(a)*step,W.Player.wy+Math.sin(a)*step,58,damage);
      if(hit){seen++;if(W.Game&&W.Game.onDivineHit)W.Game.onDivineHit('sword',hit,W.Player.wx+Math.cos(a)*step,W.Player.wy+Math.sin(a)*step);}
    }
    swordWaves++;
    if(W.Game&&W.Game.onSwordWave)W.Game.onSwordWave(seen,!!fromGun,shieldBoost);
  }

  function castDomainStrike(){
    var targets=collectTargets(3,900);if(!targets.length)return;
    domainT=0.45;domainStrikes++;
    for(var j=0;j<targets.length;j++){
      var t=targets[j],hit=hitWorld(t.wx,t.wy,36,Math.round(58*powerMult())),b=freeBeam();
      if(b){b.on=true;b.kind='domain';b.x1=t.wx;b.y1=t.wy-190;b.x2=t.wx;b.y2=t.wy;b.t=0.28;}
      if(hit&&W.Game&&W.Game.onDivineHit)W.Game.onDivineHit('domain',hit,t.wx,t.wy);
    }
    if(W.Game&&W.Game.onDivineDomain)W.Game.onDivineDomain(targets.length);
  }

  function triggerWingEvade(source){
    wingCd=DEFS.wing.cooldown;wingT=DEFS.wing.duration;wingBoostT=active('gun')?3:DEFS.wing.duration;wingEvades++;
    var fx=-(W.Player.faceX||0),fy=-(W.Player.faceY||0),len=Math.sqrt(fx*fx+fy*fy)||1;
    fx/=len;fy/=len;
    var step,nx,ny;
    for(step=DEFS.wing.dash;step>=16;step-=16){
      nx=W.Player.wx+fx*step;ny=W.Player.wy+fy*step;
      if(nx<16||ny<16||nx>W.CFG.WORLD_SIZE-16||ny>W.CFG.WORLD_SIZE-16)continue;
      if(typeof canStand==='function'&&canStand(nx,ny)){W.Player.wx=nx;W.Player.wy=ny;break;}
      if(typeof canStand!=='function'&&(!W.World||!W.World.isSolidAt||!W.World.isSolidAt(nx,ny))){W.Player.wx=nx;W.Player.wy=ny;break;}
    }
    if(active('shield')){shieldT=Math.max(shieldT,DEFS.shield.duration);shieldCd=DEFS.shield.cooldown;}
    if(W.Game&&W.Game.onWingEvade)W.Game.onWingEvade(source||'attack',active('shield'));
  }

  function freeBeam(){for(var j=0;j<beams.length;j++)if(!beams[j].on)return beams[j];return beams[0];}
  function freeWave(){for(var j=0;j<waves.length;j++)if(!waves[j].on)return waves[j];return waves[0];}
  function updateFx(dt){
    var j;
    if(domainT>0){domainT-=dt;if(domainT<0)domainT=0;}
    for(j=0;j<beams.length;j++)if(beams[j].on){beams[j].t-=dt;if(beams[j].t<=0)beams[j].on=false;}
    for(j=0;j<waves.length;j++)if(waves[j].on){waves[j].t-=dt;waves[j].r+=(waves[j].max-waves[j].r)*Math.min(1,dt*13);if(waves[j].t<=0)waves[j].on=false;}
  }
  function eachBeam(fn){for(var j=0;j<beams.length;j++)if(beams[j].on)fn(beams[j]);}
  function eachWave(fn){for(var j=0;j<waves.length;j++)if(waves[j].on)fn(waves[j]);}

  function absorbDamage(amount,source){
    if(shieldT>0&&active('shield')){
      shieldT=0;shieldCd=DEFS.shield.cooldown;blocked++;
      if(W.Game&&W.Game.onShieldBlock)W.Game.onShieldBlock(amount,source||'attack');
      return 0;
    }
    if(wingT>0&&active('wing'))return 0;
    if(active('wing')&&wingCd<=0&&W.Stats&&amount>=W.Stats.hp()){
      triggerWingEvade(source);return 0;
    }
    return amount;
  }

  function has(id){return!!owned[id];}
  function isEquipped(id){return!!equipped[id];}
  function shieldActive(){return active('shield')&&shieldT>0;}
  function shieldPct(){if(!owned.shield)return 0;if(shieldT>0)return 1;return Math.max(0,1-shieldCd/DEFS.shield.cooldown);}
  function wingActive(){return active('wing')&&wingT>0;}
  function wingReady(){return active('wing')&&wingCd<=0;}
  function wingPct(){if(!owned.wing)return 0;if(wingT>0||wingCd<=0)return 1;return Math.max(0,1-wingCd/DEFS.wing.cooldown);}
  function speedMultiplier(){return active('wing')?DEFS.wing.speed:1;}
  function axeTornadoActive(){return tornadoT>0;}
  function axeRagePct(){return owned.axe?Math.max(0,Math.min(1,axeRage/DEFS.axe.rageMax)):0;}
  function overdriveActive(){return overdriveT>0;}
  function overdrivePct(){return overdriveT>0?1:Math.max(0,1-overdriveCd/18);}
  function domainActive(){return domainT>0;}
  function resonanceLabel(){
    var a=[];
    if(active('shield')&&active('gun'))a.push('折射雷射');
    if(active('gun')&&active('sword'))a.push('雷光蓄斬');
    if(active('shield')&&active('sword'))a.push('守護劍域');
    if(active('sword')&&active('axe'))a.push('光刃龍捲');
    if(active('wing')&&active('gun'))a.push('追蹤雷射');
    if(active('shield')&&active('wing'))a.push('守護閃避');
    if(allFive())a.push(domainT>0?'神之領域':'五神共鳴');
    else if(allThree())a.push(overdriveT>0?'神域爆發':'三神共鳴');
    return a.join(' · ');
  }

  function exportData(){
    return{
      owned:copy(owned),equipped:copy(equipped),shieldCd:shieldCd,blocked:blocked,
      gunCd:gunCd,swordCount:swordCount,gunShots:gunShots,swordWaves:swordWaves,
      gunCharge:gunCharge,overdriveCd:overdriveCd,overdrives:overdrives,
      axeAngle:axeAngle,axeHitT:axeHitT,axeRage:axeRage,axeHits:axeHits,tornadoes:tornadoes,
      wingCd:wingCd,wingEvades:wingEvades,domainCd:domainCd,domainStrikes:domainStrikes
    };
  }

  function importData(o){
    clear();if(!o)return;
    owned=copy(o.owned||{});equipped=copy(o.equipped||{});
    shieldCd=num(o.shieldCd);gunCd=num(o.gunCd);swordCount=int(o.swordCount);blocked=int(o.blocked);
    gunShots=int(o.gunShots);swordWaves=int(o.swordWaves);gunCharge=int(o.gunCharge)%5;
    overdriveCd=num(o.overdriveCd)||18;overdrives=int(o.overdrives);
    axeAngle=num(o.axeAngle)%(Math.PI*2);axeHitT=num(o.axeHitT);axeRage=Math.min(DEFS.axe.rageMax-1,int(o.axeRage));
    axeHits=int(o.axeHits);tornadoes=int(o.tornadoes);
    wingCd=Math.min(DEFS.wing.cooldown,num(o.wingCd));wingEvades=int(o.wingEvades);
    domainCd=num(o.domainCd)||6;domainStrikes=int(o.domainStrikes);
  }

  function num(v){return typeof v==='number'&&isFinite(v)?Math.max(0,v):0;}
  function int(v){return Math.max(0,Math.floor(num(v)));}
  function copy(o){var r={},k;for(k in o)if(o.hasOwnProperty(k)&&o[k]&&DEFS[k])r[k]=1;return r;}
  function clear(){
    owned={};equipped={};
    shieldCd=shieldT=blocked=gunCd=swordCount=gunShots=swordWaves=gunCharge=overdriveT=overdrives=0;overdriveCd=18;
    axeAngle=axeHitT=axeRage=tornadoT=tornadoTick=axeHits=tornadoes=0;
    wingCd=wingT=wingBoostT=wingEvades=0;domainCd=6;domainT=domainStrikes=0;
    for(i=0;i<beams.length;i++)beams[i].on=false;
    for(i=0;i<waves.length;i++)waves[i].on=false;
  }

  function stats(){
    var n=0,e=0,k;for(k in owned)if(owned.hasOwnProperty(k)&&owned[k]){n++;if(equipped[k])e++;}
    return{
      owned:n,equipped:e,shield:!!owned.shield,gun:!!owned.gun,sword:!!owned.sword,axe:!!owned.axe,wing:!!owned.wing,
      active:shieldActive(),axeActive:axeTornadoActive(),wingActive:wingActive(),wingReady:wingReady(),domain:domainActive(),
      blocked:blocked,gunShots:gunShots,swordWaves:swordWaves,axeHits:axeHits,tornadoes:tornadoes,wingEvades:wingEvades,
      domainStrikes:domainStrikes,resonances:resonanceCount(),overdrive:overdriveActive(),overdrives:overdrives,label:resonanceLabel()
    };
  }

  return{
    update:update,unlock:unlock,setEquipped:setEquipped,has:has,isEquipped:isEquipped,
    absorbDamage:absorbDamage,shieldActive:shieldActive,shieldPct:shieldPct,
    wingActive:wingActive,wingReady:wingReady,wingPct:wingPct,speedMultiplier:speedMultiplier,
    axeTornadoActive:axeTornadoActive,axeRagePct:axeRagePct,axeAngle:function(){return axeAngle;},
    onPlayerAttack:onPlayerAttack,eachBeam:eachBeam,eachWave:eachWave,
    exportData:exportData,importData:importData,clear:clear,stats:stats,
    resonanceCount:resonanceCount,resonanceLabel:resonanceLabel,
    overdriveActive:overdriveActive,overdrivePct:overdrivePct,domainActive:domainActive
  };
})();
