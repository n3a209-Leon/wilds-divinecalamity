window.W = window.W || {};

/* 世界災禍主線：依序挑戰萬眼巨鯤與骸骨泰坦。
   Day 20 + 任一神武開啟祭壇；擊敗巨鯤後，同一祭壇可召喚第二災禍。 */
W.Calamity = (function() {
  var altar = { wx: W.CFG.START_WX - 760, wy: W.CFG.START_WY + 260 };
  var unlocked=false, announced=false, activeId='', defeated={ kun:false, titan:false };
  var summoning=false, summonT=0, summonId='', SUMMON_TIME=10;
  var ascensionCycle=0, divinityShards=0, replayNext='kun', activeAscended=false;
  var bosses={
    kun:{id:'kun',art:'cal_kun',atkFx:0,name:'萬眼巨鯤',alive:false,wx:0,wy:0,hp:1800,maxHp:1800,baseHp:1800,phase:1,lastPhase:1,hurt:0,shotT:0,skillT:0,meteorT:0,shotWind:0,skillWind:0,meteorWind:0,contactT:0,boss:true,calamity:true},
    titan:{id:'titan',art:'cal_titan',atkFx:0,name:'骸骨泰坦',alive:false,wx:0,wy:0,hp:2500,maxHp:2500,baseHp:2500,phase:1,lastPhase:1,hurt:0,shotT:0,skillT:0,meteorT:0,shotWind:0,skillWind:0,meteorWind:0,contactT:0,boss:true,calamity:true}
  };
  var bolts=[], meteors=[], eyes=[], bones=[], shocks=[];
  var i;
  for(i=0;i<56;i++)bolts.push({on:false,wx:0,wy:0,vx:0,vy:0,t:0,dmg:0,kind:'void'});
  for(i=0;i<16;i++)meteors.push({on:false,wx:0,wy:0,t:0,blast:0,hit:false,r:46,kind:'meteor'});
  for(i=0;i<8;i++)eyes.push({on:false,alive:false,wx:0,wy:0,hp:30,atkT:0,ang:0});
  for(i=0;i<24;i++)bones.push({on:false,wx:0,wy:0,t:0,r:24,hit:false});
  for(i=0;i<8;i++)shocks.push({on:false,wx:0,wy:0,t:0,r:20,maxR:180,hit:false});
  var voidField={on:false,wx:0,wy:0,t:0,tick:0,r:150};

  function current(){return activeId?bosses[activeId]:null;}
  function nextId(){if(!defeated.kun)return 'kun';if(!defeated.titan)return 'titan';return replayNext;}
  function update(dt){
    /* 開災禍門檻：集齊 5 件神武即可開啟；若一直沒集齊，Day 8 保底強制開，避免卡關。
       這把「等時鐘」改成「湊神武」——玩家有明確的追逐目標。 */
    var arms=(W.DivineArms&&W.DivineArms.stats().owned)||0;
    var ready=arms>=5||(W.Time.dayNo()>=8&&arms>0);
    if(ready&&!unlocked){unlocked=true;if(!announced&&W.Game&&W.Game.onCalamityGateOpen){announced=true;W.Game.onCalamityGateOpen(altar);}}
    if(summoning){
      summonT-=dt;
      if(W.Stats.isDead()||distance(W.Player.wx,W.Player.wy)>116){cancelSummon('離開祭壇，召喚已中止');}
      else if(summonT<=0)finishSummon();
    }
    updateHazards(dt);var b=current();if(!b||!b.alive)return;
    if(activeId==='kun')updateKun(b,dt);else updateTitan(b,dt);
    checkPhase(b);
  }
  function phaseOf(b){return b.hp<=b.maxHp*.28?3:(b.hp<=b.maxHp*.62?2:1);}
  function checkPhase(b){if(b.phase===b.lastPhase)return;var old=b.lastPhase;b.lastPhase=b.phase;if(b.phase>old&&W.Game&&W.Game.onCalamityPhase)W.Game.onCalamityPhase(b,b.phase);}
  function attackReady(b,timer,wind,duration,dt){if(b[timer]>0){b[wind]=0;return false;}if(b[wind]<=0){b[wind]=duration;return false;}b[wind]-=dt;return b[wind]<=0;}
  function updateKun(b,dt){
    var dx=W.Player.wx-b.wx,dy=W.Player.wy-b.wy,d=Math.sqrt(dx*dx+dy*dy)||1;b.phase=phaseOf(b);tickBoss(b,dt);
    if(d>240){b.wx+=dx/d*(38+b.phase*5)*dt;b.wy+=dy/d*(38+b.phase*5)*dt;}else if(d<145){b.wx-=dx/d*30*dt;b.wy-=dy/d*30*dt;}
    if(attackReady(b,'shotT','shotWind',.58,dt)){b.atkFx=0.55;eyeVolley(b,b.phase===1?7:(b.phase===2?11:15),250+b.phase*35);b.shotT=b.phase===3?1.15:(b.phase===2?1.7:2.25);}
    if(b.phase>=2&&attackReady(b,'skillT','skillWind',.76,dt)){spawnVoid(W.Player.wx,W.Player.wy,b.phase===3?185:155);spawnEye(b.wx+90,b.wy+20);b.skillT=b.phase===3?6.2:8.5;}
    if(attackReady(b,'meteorT','meteorWind',.82,dt)){meteorRain(b,b.phase===1?3:(b.phase===2?5:8));b.meteorT=b.phase===3?4.2:(b.phase===2?5.5:7.5);}
    if(d<90&&b.contactT<=0){b.contactT=1.1;damagePlayer(22+b.phase*5,'kun-contact',b.wx,b.wy);}
  }
  function updateTitan(b,dt){
    var dx=W.Player.wx-b.wx,dy=W.Player.wy-b.wy,d=Math.sqrt(dx*dx+dy*dy)||1;b.phase=phaseOf(b);tickBoss(b,dt);
    if(d>165){b.wx+=dx/d*(48+b.phase*8)*dt;b.wy+=dy/d*(48+b.phase*8)*dt;}
    if(attackReady(b,'shotT','shotWind',.58,dt)){b.atkFx=0.55;boneFan(b,b.phase===1?5:(b.phase===2?8:12));b.shotT=b.phase===3?1.25:(b.phase===2?1.8:2.5);}
    if(attackReady(b,'skillT','skillWind',.76,dt)){boneCage(W.Player.wx,W.Player.wy,b.phase===3?10:7);b.skillT=b.phase===3?4.8:(b.phase===2?6.2:7.5);}
    if(attackReady(b,'meteorT','meteorWind',.82,dt)){spawnShock(b.wx,b.wy,b.phase===3?235:(b.phase===2?200:170));b.meteorT=b.phase===3?4.0:(b.phase===2?5.3:6.8);}
    if(d<105&&b.contactT<=0){b.contactT=.95;damagePlayer(28+b.phase*6,'titan-smash',b.wx,b.wy);}
  }
  function tickBoss(b,dt){b.hurt=Math.max(0,b.hurt-dt);b.atkFx=Math.max(0,(b.atkFx||0)-dt);b.shotT-=dt;b.skillT-=dt;b.meteorT-=dt;b.contactT-=dt;}
  function eyeVolley(b,count,speed){var base=Math.atan2(W.Player.wy-b.wy,W.Player.wx-b.wx),a,j;for(j=0;j<count;j++){a=base+(j-(count-1)/2)*.115;spawnBolt(b.wx,b.wy-35,Math.cos(a)*speed,Math.sin(a)*speed,9+b.phase*2,'void');}if(b.phase===3)for(j=0;j<8;j++){a=j*Math.PI/4;spawnBolt(b.wx,b.wy,Math.cos(a)*220,Math.sin(a)*220,10,'void');}}
  function boneFan(b,count){var base=Math.atan2(W.Player.wy-b.wy,W.Player.wx-b.wx),a,j;for(j=0;j<count;j++){a=base+(j-(count-1)/2)*.16;spawnBolt(b.wx,b.wy-25,Math.cos(a)*(220+b.phase*25),Math.sin(a)*(220+b.phase*25),11+b.phase*2,'bone');}}
  function spawnBolt(x,y,vx,vy,dmg,kind){for(var j=0;j<bolts.length;j++)if(!bolts[j].on){var p=bolts[j];p.on=true;p.wx=x;p.wy=y;p.vx=vx;p.vy=vy;p.dmg=dmg;p.t=3;p.kind=kind;return;}}
  function spawnVoid(x,y,r){voidField.on=true;voidField.wx=x;voidField.wy=y;voidField.t=4.8;voidField.tick=0;voidField.r=r;}
  function meteorRain(b,count){for(var j=0;j<count;j++){var a=j*2.399+b.hp*.001,r=40+(j%3)*52;spawnMeteor(W.Player.wx+Math.cos(a)*r,W.Player.wy+Math.sin(a)*r,b.phase===3?56:46);}}
  function spawnMeteor(x,y,r){for(var j=0;j<meteors.length;j++)if(!meteors[j].on){var m=meteors[j];m.on=true;m.wx=x;m.wy=y;m.t=1.15;m.blast=.35;m.hit=false;m.r=r;return;}}
  function spawnEye(x,y){for(var j=0;j<eyes.length;j++)if(!eyes[j].on){var e=eyes[j];e.on=true;e.alive=true;e.wx=x;e.wy=y;e.hp=30;e.atkT=.8;e.ang=j;return;}}
  function boneCage(x,y,count){for(var j=0;j<count;j++){var a=j*Math.PI*2/count,r=58+(j%2)*14;spawnBone(x+Math.cos(a)*r,y+Math.sin(a)*r);}}
  function spawnBone(x,y){for(var j=0;j<bones.length;j++)if(!bones[j].on){var p=bones[j];p.on=true;p.wx=x;p.wy=y;p.t=.85;p.hit=false;p.r=25;return;}}
  function spawnShock(x,y,maxR){for(var j=0;j<shocks.length;j++)if(!shocks[j].on){var s=shocks[j];s.on=true;s.wx=x;s.wy=y;s.t=1.15;s.r=18;s.maxR=maxR;s.hit=false;return;}}
  function updateHazards(dt){
    var j,p,dx,dy,d,e;
    for(j=0;j<bolts.length;j++){p=bolts[j];if(!p.on)continue;p.t-=dt;if(p.t<=0){p.on=false;continue;}p.wx+=p.vx*dt;p.wy+=p.vy*dt;dx=W.Player.wx-p.wx;dy=W.Player.wy-p.wy;if(dx*dx+dy*dy<25*25){p.on=false;damagePlayer(p.dmg,p.kind==='bone'?'bone-bolt':'kun-eye-ray',p.wx,p.wy);}}
    if(voidField.on){voidField.t-=dt;voidField.tick-=dt;if(voidField.t<=0)voidField.on=false;else{dx=voidField.wx-W.Player.wx;dy=voidField.wy-W.Player.wy;d=Math.sqrt(dx*dx+dy*dy)||1;if(d<voidField.r*1.55){var pull=(1-d/(voidField.r*1.55))*115;W.Player.wx+=dx/d*pull*dt;W.Player.wy+=dy/d*pull*dt;}if(d<voidField.r&&voidField.tick<=0){voidField.tick=.65;damagePlayer(9,'abyss-void',voidField.wx,voidField.wy);}}}
    for(j=0;j<meteors.length;j++){p=meteors[j];if(!p.on)continue;if(p.t>0){p.t-=dt;continue;}p.blast-=dt;if(!p.hit){p.hit=true;dx=W.Player.wx-p.wx;dy=W.Player.wy-p.wy;if(dx*dx+dy*dy<p.r*p.r)damagePlayer(28,'kun-meteor',p.wx,p.wy);}if(p.blast<=0)p.on=false;}
    for(j=0;j<eyes.length;j++){e=eyes[j];if(!e.on||!e.alive)continue;e.ang+=dt*1.5;e.atkT-=dt;dx=W.Player.wx-e.wx;dy=W.Player.wy-e.wy;d=Math.sqrt(dx*dx+dy*dy)||1;e.wx+=dx/d*42*dt;e.wy+=dy/d*42*dt;if(e.atkT<=0){e.atkT=1.8;spawnBolt(e.wx,e.wy,dx/d*270,dy/d*270,8,'void');}if(d<34){e.alive=false;e.on=false;damagePlayer(12,'abyss-eye',e.wx,e.wy);}}
    for(j=0;j<bones.length;j++){p=bones[j];if(!p.on)continue;p.t-=dt;if(p.t<=.35&&!p.hit){p.hit=true;dx=W.Player.wx-p.wx;dy=W.Player.wy-p.wy;if(dx*dx+dy*dy<p.r*p.r)damagePlayer(24,'bone-spike',p.wx,p.wy);}if(p.t<=0)p.on=false;}
    for(j=0;j<shocks.length;j++){p=shocks[j];if(!p.on)continue;p.t-=dt;p.r+=(p.maxR-p.r)*Math.min(1,dt*5);dx=W.Player.wx-p.wx;dy=W.Player.wy-p.wy;d=Math.sqrt(dx*dx+dy*dy);if(!p.hit&&Math.abs(d-p.r)<24){p.hit=true;damagePlayer(30,'titan-shockwave',p.wx,p.wy);}if(p.t<=0)p.on=false;}
  }
  function damagePlayer(amount,source,sourceWx,sourceWy){if(activeAscended)amount=Math.round(amount*(1.18+Math.min(ascensionCycle,8)*0.06));if(W.Stats.damage(amount,source,sourceWx,sourceWy)&&W.Game&&W.Game.onBossHitPlayer)W.Game.onBossHitPlayer();}
  function canSummon(){return unlocked&&!activeId&&!summoning&&!!nextId();}
  function distance(wx,wy){var dx=altar.wx-wx,dy=altar.wy-wy;return Math.sqrt(dx*dx+dy*dy);}
  function near(wx,wy){return (canSummon()||summoning)&&distance(wx,wy)<=(summoning?116:82);}
  /* 第一次按下開始十秒召喚；儀式中再次按下可主動取消。 */
  function summon(){
    if(summoning){cancelSummon('召喚已取消');return 'cancelled';}
    var id=nextId();if(!canSummon()||!id)return false;
    summoning=true;summonT=SUMMON_TIME;summonId=id;
    if(W.Game&&W.Game.onCalamitySummonStart)W.Game.onCalamitySummonStart({id:id,name:bosses[id].name,seconds:SUMMON_TIME});
    return 'started';
  }
  function cancelSummon(reason){
    if(!summoning)return false;
    var id=summonId;summoning=false;summonT=0;summonId='';
    if(W.Game&&W.Game.onCalamitySummonCancel)W.Game.onCalamitySummonCancel(reason||'召喚已取消',id);
    return true;
  }
  function finishSummon(){
    var id=summonId||nextId();summoning=false;summonT=0;summonId='';
    if(!id||activeId)return false;
    clearHazards();activeId=id;activeAscended=defeated.kun&&defeated.titan;var b=bosses[id];var tier=activeAscended?ascensionCycle+1:0;b.maxHp=Math.round(b.baseHp*(activeAscended?(1.35+tier*0.22):1));b.alive=true;b.hp=b.maxHp;b.phase=1;b.lastPhase=1;b.wx=altar.wx;b.wy=altar.wy-230;b.shotT=1.2;b.skillT=4;b.meteorT=2.5;b.shotWind=b.skillWind=b.meteorWind=0;b.atkFx=0;b.ascended=activeAscended;b.tier=tier;if(W.Game&&W.Game.onCalamitySummoned)W.Game.onCalamitySummoned(b);return true;
  }
  var result={name:'',dmg:0,killed:false,wx:0,wy:0,type:-1,boss:true,calamity:true};
  function hitAt(wx,wy,r,dmg){var b=current(),dx,dy,j,e;if(b&&b.alive){dx=b.wx-wx;dy=b.wy-wy;if(dx*dx+dy*dy<(r+(b.id==='titan'?72:78))*(r+(b.id==='titan'?72:78))){b.hp-=dmg;b.hurt=.16;result.name=b.name;result.dmg=dmg;result.killed=false;result.wx=b.wx;result.wy=b.wy;if(b.hp<=0){b.hp=0;b.alive=false;var wasAscended=!!activeAscended;if(!wasAscended){defeated[b.id]=true;if(W.Skins)W.Skins.unlock(b.id==='kun'?'abyss':'death');}else{ascensionCycle++;divinityShards++;replayNext=b.id==='kun'?'titan':'kun';if(W.Game&&W.Game.onAscensionReward)W.Game.onAscensionReward({cycle:ascensionCycle,shards:divinityShards,next:replayNext,boss:b});}clearHazards();activeId='';activeAscended=false;if(W.Game&&W.Game.onCalamityDown)W.Game.onCalamityDown(b);result.killed=true;}return result;}}
    for(j=0;j<eyes.length;j++){e=eyes[j];if(!e.on||!e.alive)continue;dx=e.wx-wx;dy=e.wy-wy;if(dx*dx+dy*dy<(r+20)*(r+20)){e.hp-=dmg;result.name='深淵眼球';result.dmg=dmg;result.killed=e.hp<=0;result.wx=e.wx;result.wy=e.wy;if(e.hp<=0){e.alive=false;e.on=false;}return result;}}return null;}
  function nearest(wx,wy){var b=current();if(b&&b.alive)return b;for(var j=0;j<eyes.length;j++)if(eyes[j].on&&eyes[j].alive)return eyes[j];return null;}
  function each(arr,fn){for(var j=0;j<arr.length;j++)if(arr[j].on)fn(arr[j]);}
  function clearHazards(){for(var j=0;j<bolts.length;j++)bolts[j].on=false;for(j=0;j<meteors.length;j++)meteors[j].on=false;for(j=0;j<eyes.length;j++){eyes[j].on=false;eyes[j].alive=false;}for(j=0;j<bones.length;j++)bones[j].on=false;for(j=0;j<shocks.length;j++)shocks[j].on=false;voidField.on=false;}
  function exportData(){var b=current();return{unlocked:unlocked,announced:announced,activeId:activeId,activeAscended:!!activeAscended,defeated:{kun:!!defeated.kun,titan:!!defeated.titan},ascensionCycle:ascensionCycle,divinityShards:divinityShards,replayNext:replayNext,hp:b&&b.alive?b.hp:0,maxHp:b&&b.alive?b.maxHp:0,wx:b?b.wx:0,wy:b?b.wy:0};}
  function importData(o){clear();if(!o)return;unlocked=!!o.unlocked;announced=!!o.announced;if(o.defeated&&typeof o.defeated==='object'){defeated.kun=!!o.defeated.kun;defeated.titan=!!o.defeated.titan;}else if(o.defeated===true){defeated.kun=true;}ascensionCycle=Math.max(0,Math.floor(Number(o.ascensionCycle)||0));divinityShards=Math.max(0,Math.floor(Number(o.divinityShards)||0));replayNext=o.replayNext==='titan'?'titan':'kun';activeAscended=!!o.activeAscended;activeId=o.activeId&&bosses[o.activeId]&&(!defeated[o.activeId]||activeAscended)?o.activeId:'';if(!activeId&&o.kunAlive&&!defeated.kun)activeId='kun';if(activeId){var b=bosses[activeId];b.alive=true;b.maxHp=typeof o.maxHp==='number'&&o.maxHp>0?o.maxHp:Math.round(b.baseHp*(activeAscended?(1.35+(ascensionCycle+1)*0.22):1));b.hp=typeof o.hp==='number'?Math.max(1,o.hp):(typeof o.kunHp==='number'?Math.max(1,o.kunHp):b.maxHp);b.phase=phaseOf(b);b.lastPhase=b.phase;b.shotWind=b.skillWind=b.meteorWind=0;b.wx=isFinite(o.wx)?o.wx:(isFinite(o.kunWx)?o.kunWx:altar.wx);b.wy=isFinite(o.wy)?o.wy:(isFinite(o.kunWy)?o.kunWy:altar.wy-230);}}
  function clear(){unlocked=false;announced=false;activeId='';summoning=false;summonT=0;summonId='';defeated={kun:false,titan:false};ascensionCycle=0;divinityShards=0;replayNext='kun';activeAscended=false;bosses.kun.alive=false;bosses.titan.alive=false;bosses.kun.shotWind=bosses.kun.skillWind=bosses.kun.meteorWind=0;bosses.titan.shotWind=bosses.titan.skillWind=bosses.titan.meteorWind=0;bosses.kun.maxHp=bosses.kun.baseHp;bosses.titan.maxHp=bosses.titan.baseHp;clearHazards();}
  function stats(){var b=current(),sid=summonId||nextId();return{unlocked:unlocked,summoned:!!activeId,summoning:summoning,summonLeft:summoning?Math.max(0,summonT):0,summonId:sid,summonName:sid&&bosses[sid]?bosses[sid].name:'',defeated:defeated.kun&&defeated.titan,defeatedKun:defeated.kun,defeatedTitan:defeated.titan,next:nextId(),ascensionUnlocked:defeated.kun&&defeated.titan,ascensionCycle:ascensionCycle,divinityShards:divinityShards,activeAscended:activeAscended,alive:!!(b&&b.alive),hp:b?b.hp:0,maxHp:b?b.maxHp:0,phase:b?b.phase:0,near:near(W.Player.wx,W.Player.wy)};}
  return {update:update,canSummon:canSummon,near:near,summon:summon,cancelSummon:cancelSummon,altarPos:function(){return altar;},isUnlocked:function(){return unlocked;},isSummoned:function(){return!!activeId;},isDefeated:function(){return defeated.kun&&defeated.titan;},powerMultiplier:function(){return 1+Math.min(divinityShards,10)*0.06;},boss:current,hitAt:hitAt,nearest:nearest,eachBolt:function(fn){each(bolts,fn);},eachMeteor:function(fn){each(meteors,fn);},eachEye:function(fn){for(var j=0;j<eyes.length;j++)if(eyes[j].on&&eyes[j].alive)fn(eyes[j]);},eachVoid:function(fn){if(voidField.on)fn(voidField);},eachBone:function(fn){each(bones,fn);},eachShock:function(fn){each(shocks,fn);},exportData:exportData,importData:importData,clear:clear,stats:stats};
})();
