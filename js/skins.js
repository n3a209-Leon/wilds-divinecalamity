window.W = window.W || {};
/* 災禍 Skin：深淵之神造成範圍脈衝；死亡君王召喚四向骨刺。 */
W.Skins=(function(){
  var DEFS={abyss:{id:'abyss',name:'深淵之神',cooldown:12,duration:2.8,radius:118,dmg:18},death:{id:'death',name:'死亡君王',cooldown:14,duration:2.2,radius:145,dmg:26}};
  var owned={},equipped='',cd=0,fieldT=0,pulses=0;
  function unlock(id){if(!DEFS[id]||owned[id])return false;owned[id]=1;equipped=id;cd=1.5;if(W.Game&&W.Game.onSkinUnlock)W.Game.onSkinUnlock(DEFS[id]);return true;}
  function update(dt){if(!equipped||!owned[equipped]){fieldT=0;return;}if(fieldT>0){fieldT=Math.max(0,fieldT-dt);return;}cd-=dt;if(cd<=0){var d=DEFS[equipped];fieldT=d.duration;cd=d.cooldown;pulses++;pulse(d);if(W.Game&&W.Game.onSkinPulse)W.Game.onSkinPulse(d);}}
  function hitAll(x,y,r,dmg){if(W.Mobs&&W.Mobs.hitAt)W.Mobs.hitAt(x,y,r,dmg);if(W.Bosses&&W.Bosses.hitAt)W.Bosses.hitAt(x,y,r,dmg);if(W.Calamity&&W.Calamity.hitAt)W.Calamity.hitAt(x,y,r,dmg);}
  function pulse(d){var x=W.Player.wx,y=W.Player.wy,m=W.Calamity&&W.Calamity.powerMultiplier?W.Calamity.powerMultiplier():1,damage=Math.round(d.dmg*m);if(d.id==='death'){var rr=72;for(var i=0;i<4;i++){var a=i*Math.PI/2;hitAll(x+Math.cos(a)*rr,y+Math.sin(a)*rr,52,damage);}}else hitAll(x,y,d.radius,damage);}
  function copy(o){var r={},k;for(k in o)if(o.hasOwnProperty(k)&&o[k])r[k]=1;return r;}
  function exportData(){return{owned:copy(owned),equipped:equipped,cd:cd,pulses:pulses};}
  function importData(o){owned={};equipped='';cd=0;fieldT=0;pulses=0;if(!o)return;owned=copy(o.owned||{});equipped=owned[o.equipped]?o.equipped:'';if(typeof o.cd==='number'&&isFinite(o.cd))cd=Math.max(0,o.cd);if(typeof o.pulses==='number'&&isFinite(o.pulses))pulses=Math.max(0,Math.floor(o.pulses));}
  function clear(){owned={};equipped='';cd=0;fieldT=0;pulses=0;}
  function stats(){var n=0,k;for(k in owned)if(owned[k])n++;return{owned:n,equipped:equipped,active:fieldT>0,pulses:pulses};}
  return{update:update,unlock:unlock,has:function(id){return!!owned[id];},equippedId:function(){return equipped;},fieldActive:function(){return fieldT>0;},fieldPct:function(){return fieldT>0&&equipped?fieldT/DEFS[equipped].duration:0;},fieldKind:function(){return equipped;},exportData:exportData,importData:importData,clear:clear,stats:stats};
})();
