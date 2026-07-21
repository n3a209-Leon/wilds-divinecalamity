window.W = window.W || {};

/* 傳說 Skin：外觀、能力與兩名角色的動畫表綁在同一定義。
   每套 Skin 都有公主／黃豆專用版本，切換角色時不會套錯體型。 */
W.Skins=(function(){
  var LIST=[
    {id:'abyss',name:'深淵之神',rarity:'災禍傳說',condition:'擊敗萬眼巨鯤',
      ability:'每 12 秒釋放深淵脈衝，對周圍敵人造成傷害。',
      sprites:['assets/player_abyss.png','assets/player2_abyss.png'],
      cooldown:12,duration:2.8,radius:118,dmg:18},
    {id:'death',name:'死亡君王',rarity:'災禍傳說',condition:'擊敗骸骨泰坦',
      ability:'每 14 秒召喚四向靈魂骨刺，重創附近敵人。',
      sprites:['assets/player_death.png','assets/player2_death.png'],
      cooldown:14,duration:2.2,radius:145,dmg:26},
    {id:'star',name:'星神',rarity:'神武傳說',condition:'平定五個區域並集齊五件神武',
      ability:'每 20 秒展開星界 3 秒，使附近敵人移動速度降低 55%。',
      sprites:['assets/player_star.png','assets/player2_star.png'],
      cooldown:20,duration:3,radius:210,dmg:0},
    {id:'phoenix',name:'不死鳥',rarity:'飛升傳說',condition:'完成第一次飛升輪迴',
      ability:'每次飛升輪迴可涅槃一次：以 35% 生命復活並引爆淨化火焰。',
      sprites:['assets/player_phoenix.png','assets/player2_phoenix.png'],passive:true},
    {id:'end',name:'終焉',rarity:'終局神話',condition:'完成第三次飛升輪迴',
      ability:'神武冷卻縮短 10%，但夜間承受的敵人傷害提高 10%。',
      sprites:['assets/player_end.png','assets/player2_end.png'],passive:true}
  ];
  var DEFS={},owned={},equipped='',cd=0,fieldT=0,phoenixT=0,pulses=0,phoenixCycle=-1,i;
  for(i=0;i<LIST.length;i++)DEFS[LIST[i].id]=LIST[i];

  function unlock(id,silent){
    if(!DEFS[id]||owned[id])return false;
    owned[id]=1;if(!silent||!equipped)equipped=id;cd=1.5;
    if(!silent&&W.Game&&W.Game.onSkinUnlock)W.Game.onSkinUnlock(DEFS[id]);
    return true;
  }
  function equip(id){
    if(!id){
      if(!equipped)return false;
      equipped='';fieldT=0;phoenixT=0;
      if(W.Game&&W.Game.onSkinEquip)W.Game.onSkinEquip(null);
      return true;
    }
    if(!DEFS[id]||!owned[id]||equipped===id)return false;
    equipped=id;fieldT=0;phoenixT=0;cd=Math.min(cd,1.5);
    if(W.Game&&W.Game.onSkinEquip)W.Game.onSkinEquip(DEFS[id]);
    return true;
  }
  function update(dt){
    if(phoenixT>0)phoenixT=Math.max(0,phoenixT-dt);
    if(!equipped||!owned[equipped]){fieldT=0;return;}
    var d=DEFS[equipped];if(d.passive){fieldT=0;return;}
    if(fieldT>0){fieldT=Math.max(0,fieldT-dt);return;}
    cd-=dt;if(cd<=0){fieldT=d.duration;cd=d.cooldown;pulses++;pulse(d);if(W.Game&&W.Game.onSkinPulse)W.Game.onSkinPulse(d);}
  }
  function hitAll(x,y,r,dmg){if(W.Mobs&&W.Mobs.hitAt)W.Mobs.hitAt(x,y,r,dmg);if(W.Bosses&&W.Bosses.hitAt)W.Bosses.hitAt(x,y,r,dmg);if(W.Calamity&&W.Calamity.hitAt)W.Calamity.hitAt(x,y,r,dmg);}
  function pulse(d){var x=W.Player.wx,y=W.Player.wy,m=W.Calamity&&W.Calamity.powerMultiplier?W.Calamity.powerMultiplier():1,damage=Math.round(d.dmg*m);if(d.id==='star')return;if(d.id==='death'){var rr=72;for(var j=0;j<4;j++){var a=j*Math.PI/2;hitAll(x+Math.cos(a)*rr,y+Math.sin(a)*rr,52,damage);}}else hitAll(x,y,d.radius,damage);}
  function tryPhoenixRevive(){
    var cycle=currentCycle();
    if(equipped!=='phoenix'||!owned.phoenix||phoenixCycle===cycle)return 0;
    phoenixCycle=cycle;phoenixT=1.6;pulses++;
    var m=W.Calamity&&W.Calamity.powerMultiplier?W.Calamity.powerMultiplier():1;
    hitAll(W.Player.wx,W.Player.wy,165,Math.round(55*m));
    if(W.Game&&W.Game.onSkinPhoenix)W.Game.onSkinPhoenix();
    return .35;
  }
  function currentCycle(){var s=W.Calamity&&W.Calamity.stats?W.Calamity.stats():null;return s?Math.max(0,s.ascensionCycle||0):0;}
  function enemySpeedMultiplier(wx,wy){if(equipped!=='star'||fieldT<=0)return 1;var dx=wx-W.Player.wx,dy=wy-W.Player.wy;return(dx*dx+dy*dy<=DEFS.star.radius*DEFS.star.radius)?0.45:1;}
  function divineCooldownMultiplier(){return(equipped==='end'&&owned.end)?0.9:1;}
  function enemyDamageMultiplier(){return equipped==='end'&&owned.end&&W.Time&&W.Time.isNight&&W.Time.isNight()?1.1:1;}
  function copy(o){var r={},k;for(k in o)if(o.hasOwnProperty(k)&&o[k]&&DEFS[k])r[k]=1;return r;}
  function spriteFor(charIdx,base){var d=DEFS[equipped],idx=Math.max(0,Math.min(1,charIdx|0));return d&&owned[equipped]&&d.sprites[idx]?d.sprites[idx]:base;}
  function definition(id){return DEFS[id]||null;}
  function list(){return LIST;}
  function exportData(){return{owned:copy(owned),equipped:equipped,cd:cd,pulses:pulses,phoenixCycle:phoenixCycle,phoenixUsed:phoenixCycle===currentCycle()};}
  function importData(o){owned={};equipped='';cd=0;fieldT=0;phoenixT=0;pulses=0;phoenixCycle=-1;if(!o)return;owned=copy(o.owned||{});equipped=owned[o.equipped]&&DEFS[o.equipped]?o.equipped:'';if(typeof o.cd==='number'&&isFinite(o.cd))cd=Math.max(0,o.cd);if(typeof o.pulses==='number'&&isFinite(o.pulses))pulses=Math.max(0,Math.floor(o.pulses));if(typeof o.phoenixCycle==='number'&&isFinite(o.phoenixCycle))phoenixCycle=Math.floor(o.phoenixCycle);else if(o.phoenixUsed)phoenixCycle=currentCycle();}
  function clear(){owned={};equipped='';cd=0;fieldT=0;phoenixT=0;pulses=0;phoenixCycle=-1;}
  function stats(){var n=0,k;for(k in owned)if(owned[k])n++;return{owned:n,total:LIST.length,equipped:equipped,active:fieldT>0||phoenixT>0,pulses:pulses,phoenixUsed:phoenixCycle===currentCycle(),phoenixCycle:phoenixCycle};}
  return{update:update,unlock:unlock,equip:equip,has:function(id){return!!owned[id];},equippedId:function(){return equipped;},
    spriteFor:spriteFor,definition:definition,list:list,tryPhoenixRevive:tryPhoenixRevive,
    enemySpeedMultiplier:enemySpeedMultiplier,divineCooldownMultiplier:divineCooldownMultiplier,enemyDamageMultiplier:enemyDamageMultiplier,
    fieldActive:function(){return fieldT>0||phoenixT>0;},
    fieldPct:function(){return phoenixT>0?phoenixT/1.6:(fieldT>0&&equipped?fieldT/DEFS[equipped].duration:0);},fieldKind:function(){return phoenixT>0?'phoenix':equipped;},
    exportData:exportData,importData:importData,clear:clear,stats:stats};
})();
