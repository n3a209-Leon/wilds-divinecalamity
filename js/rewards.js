window.W = window.W || {};

/* 獎勵中心：把冒險日誌、災禍 Skin、飛升碎片整合成玩家可見的收藏進度。
   榮譽值由既有進度推導，不另造可遺失的貨幣；seen 只保存未讀提示。 */
W.Rewards=(function(){
  var seen={};
  var SKIN_IDS=['abyss','death','star','phoenix','end'];
  var RANKS=[
    {at:0,name:'荒野旅人',reward:'荒野稱號'},
    {at:60,name:'生存專家',reward:'旅人金色足跡'},
    {at:160,name:'首領獵人',reward:'獵王強化命中特效'},
    {at:320,name:'災禍終結者',reward:'紫晶快速移動法陣'},
    {at:600,name:'飛升傳說',reward:'飛升冠冕'}
  ];

  function sync(silent){
    if(!W.Skins||!W.Calamity)return false;
    var cs=W.Calamity.stats(),changed=false;
    if(cs.defeatedKun)changed=W.Skins.unlock('abyss',!!silent)||changed;
    if(cs.defeatedTitan)changed=W.Skins.unlock('death',!!silent)||changed;
    if(allRegions()&&W.DivineArms&&W.DivineArms.stats().owned>=5)changed=W.Skins.unlock('star',!!silent)||changed;
    if((cs.ascensionCycle||0)>=1)changed=W.Skins.unlock('phoenix',!!silent)||changed;
    if((cs.ascensionCycle||0)>=3)changed=W.Skins.unlock('end',!!silent)||changed;
    return changed;
  }
  function allRegions(){if(!W.Bosses||!W.Bosses.isDefeated)return false;var ids=['hydra','dragon','colossus','eagle','lava'];for(var i=0;i<ids.length;i++)if(!W.Bosses.isDefeated('region:'+ids[i]))return false;return true;}
  function skinState(id){var d=W.Skins.definition(id);return{id:id,def:d,owned:W.Skins.has(id),equipped:W.Skins.equippedId()===id,unseen:W.Skins.has(id)&&!seen[id]};}
  function list(){var out=[],i;for(i=0;i<SKIN_IDS.length;i++)out.push(skinState(SKIN_IDS[i]));return out;}
  function markSeen(id){if(SKIN_IDS.indexOf(id)<0||seen[id])return false;seen[id]=1;return true;}
  function markAllSeen(){var changed=false,i;for(i=0;i<SKIN_IDS.length;i++)if(W.Skins.has(SKIN_IDS[i]))changed=markSeen(SKIN_IDS[i])||changed;return changed;}
  function honor(){
    var js=W.Journal?W.Journal.stats():{claimed:0},bs=W.Bosses?W.Bosses.stats():{defeated:0};
    var ss=W.Skins?W.Skins.stats():{owned:0},cs=W.Calamity?W.Calamity.stats():{divinityShards:0};
    return js.claimed*10+(bs.defeated||0)*20+ss.owned*100+(cs.divinityShards||0)*50;
  }
  function rankInfo(){var h=honor(),cur=RANKS[0],next=null,i;for(i=0;i<RANKS.length;i++){if(h>=RANKS[i].at)cur=RANKS[i];else{next=RANKS[i];break;}}return{honor:h,name:cur.name,reward:cur.reward,next:next?next.at:cur.at,nextName:next?next.name:'',nextReward:next?next.reward:'',needed:next?next.at-h:0,max:!next};}
  function ranks(){var h=honor(),out=[],i,r;for(i=0;i<RANKS.length;i++){r=RANKS[i];out.push({at:r.at,name:r.name,reward:r.reward,unlocked:h>=r.at,current:h>=r.at&&(i===RANKS.length-1||h<RANKS[i+1].at)});}return out;}
  function visuals(){var h=honor();return{trail:h>=60,eliteHit:h>=160,travel:h>=320,crown:h>=600};}
  function stats(){
    var unseen=0,i;for(i=0;i<SKIN_IDS.length;i++)if(W.Skins.has(SKIN_IDS[i])&&!seen[SKIN_IDS[i]])unseen++;
    var ri=rankInfo(),js=W.Journal?W.Journal.stats():{unclaimed:0},cs=W.Calamity?W.Calamity.stats():{divinityShards:0};
    return{honor:ri.honor,rank:ri.name,rankReward:ri.reward,next:ri.next,nextName:ri.nextName,nextReward:ri.nextReward,needed:ri.needed,max:ri.max,unseen:unseen,
      skins:W.Skins?W.Skins.stats().owned:0,totalSkins:SKIN_IDS.length,journalUnclaimed:js.unclaimed||0,shards:cs.divinityShards||0};
  }
  function exportData(){var o={},i;for(i=0;i<SKIN_IDS.length;i++)if(seen[SKIN_IDS[i]])o[SKIN_IDS[i]]=1;return{seen:o};}
  function importData(o){seen={};if(!o||!o.seen)return;for(var i=0;i<SKIN_IDS.length;i++)if(o.seen[SKIN_IDS[i]])seen[SKIN_IDS[i]]=1;}
  function clear(){seen={};}
  return{sync:sync,list:list,skinState:skinState,markSeen:markSeen,markAllSeen:markAllSeen,ranks:ranks,visuals:visuals,
    stats:stats,exportData:exportData,importData:importData,clear:clear};
})();
