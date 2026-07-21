window.W = window.W || {};

/* 冒險日誌：以既有遊戲狀態判定任務完成，完成與領獎分開保存。
   舊玩家可補登已完成章節，但獎勵仍需親自打開日誌領取。 */
W.Journal = (function() {
  var completed = {}, claimed = {};
  var tickT = 0;
  var claimResult = { ok:false, msg:'', id:'' };

  var DEFS = [
    {id:'gather', chapter:'第一章・荒野求生', title:'收集基本物資', desc:'取得 5 木材與 3 石頭。', reward:{berry:5}},
    {id:'axe', chapter:'第一章・荒野求生', title:'製作第一把斧頭', desc:'製作石斧，或持有更高級的金屬斧。', reward:{cooked:2}},
    {id:'campfire', chapter:'第一章・荒野求生', title:'點亮第一座營火', desc:'建造營火，準備度過危險的夜晚。', reward:{fiber:5,berry:3}},
    {id:'bed', chapter:'第一章・荒野求生', title:'建立自己的營地', desc:'放置睡袋，設定重生與快速移動營地。', reward:{hide:2,arrow:6}},
    {id:'mate', chapter:'第二章・夥伴與首領', title:'讓夥伴加入隊伍', desc:'救出並招募至少一位夥伴。', reward:{cooked:3,arrow:8}},
    {id:'regional_one', chapter:'第二章・夥伴與首領', title:'平定第一個區域', desc:'找到並擊敗任一位區域首領。', reward:{metal:2,jerky:2}, track:'auto'},
    {id:'regional_all', chapter:'第二章・夥伴與首領', title:'五大區域平定', desc:'擊敗九頭蛇、聖龍、巨像、天鷹與熔岩魔神。', reward:{metal:5,jerky:4}, track:'auto'},
    {id:'divine_three', chapter:'第三章・神武覺醒', title:'三神武共鳴', desc:'取得任意三件神武，解鎖更強的組合能力。', reward:{arrow:12,soup:2}},
    {id:'altar', chapter:'第三章・神武覺醒', title:'喚醒世界祭壇', desc:'到達第 20 天，並持有至少一件神武。', reward:{jerky:3,soup:2}, track:'altar'},
    {id:'kun', chapter:'第四章・世界災禍', title:'擊敗萬眼巨鯤', desc:'在祭壇召喚並擊敗第一位世界災禍。', reward:{metal:6,soup:3}, track:'altar'},
    {id:'titan', chapter:'第四章・世界災禍', title:'擊敗骸骨泰坦', desc:'再次使用祭壇，終結第二位世界災禍。', reward:{metal:8,jerky:5,soup:3}, track:'altar'},
    {id:'ascension', chapter:'第五章・飛升輪迴', title:'完成第一次飛升', desc:'再次挑戰強化災禍，完成一輪飛升。', reward:{metal:10,jerky:8,soup:5}, track:'altar'}
  ];

  function regionalCount() {
    if (!W.Bosses || !W.Bosses.isDefeated) return 0;
    var ids=['hydra','dragon','colossus','eagle','lava'], n=0, i;
    for(i=0;i<ids.length;i++) if(W.Bosses.isDefeated('region:'+ids[i])) n++;
    return n;
  }

  function numbers(id) {
    var v=0,max=1,text='',bs,cs,ds;
    if(id==='gather'){
      var wood=W.Inv.count('wood'),stone=W.Inv.count('stone');v=Math.min(5,wood)+Math.min(3,stone);max=8;text='木材 '+Math.min(wood,5)+'/5・石頭 '+Math.min(stone,3)+'/3';
    }else if(id==='axe'){
      v=(W.Craft.has('axe')||W.Craft.has('maxe'))?1:0;text=v?'已製作':'尚未製作';
    }else if(id==='campfire'){
      bs=W.Build.stats();v=bs.fire>0?1:0;text=v?'營火已點亮':'尚未建造營火';
    }else if(id==='bed'){
      bs=W.Build.stats();v=bs.bed>0?1:0;text=v?'營地已建立':'尚未放置睡袋';
    }else if(id==='mate'){
      v=Math.min(1,W.Mates.recruitedCount());text='夥伴 '+v+'/1';
    }else if(id==='regional_one'){
      v=Math.min(1,regionalCount());text='區域首領 '+v+'/1';
    }else if(id==='regional_all'){
      v=regionalCount();max=5;text='區域首領 '+v+'/5';
    }else if(id==='divine_three'){
      ds=W.DivineArms.stats();v=Math.min(3,ds.owned);max=3;text='神武 '+v+'/3';
    }else if(id==='altar'){
      ds=W.DivineArms.stats();var day=Math.min(20,W.Time.dayNo()),arm=ds.owned>0?1:0;v=day+arm;max=21;text='天數 '+day+'/20・神武 '+arm+'/1';
    }else if(id==='kun'){
      cs=W.Calamity.stats();v=cs.defeatedKun?1:0;text=v?'巨鯤已擊敗':'尚未擊敗萬眼巨鯤';
    }else if(id==='titan'){
      cs=W.Calamity.stats();v=cs.defeatedTitan?1:0;text=v?'泰坦已擊敗':'尚未擊敗骸骨泰坦';
    }else if(id==='ascension'){
      cs=W.Calamity.stats();v=Math.min(1,cs.ascensionCycle||0);text='飛升輪迴 '+(cs.ascensionCycle||0)+'/1';
    }
    return {value:v,max:max,text:text};
  }

  function byId(id) { var i;for(i=0;i<DEFS.length;i++)if(DEFS[i].id===id)return DEFS[i];return null; }
  function isDoneNow(id){var p=numbers(id);return p.value>=p.max;}

  function update(dt) {
    tickT-=dt;if(tickT>0)return;tickT=0.45;
    var i,d,newN=0,last=null;
    for(i=0;i<DEFS.length;i++){
      d=DEFS[i];if(completed[d.id]||!isDoneNow(d.id))continue;
      completed[d.id]=1;newN++;last=d;
    }
    if(newN&&W.Game&&W.Game.onJournalUpdated)W.Game.onJournalUpdated({count:newN,last:last,completed:completedCount()});
  }

  function current() {
    var i,d,p;
    for(i=0;i<DEFS.length;i++){
      d=DEFS[i];if(completed[d.id])continue;p=numbers(d.id);
      return {id:d.id,chapter:d.chapter,title:d.title,desc:d.desc,track:d.track||'',value:p.value,max:p.max,text:p.text};
    }
    return null;
  }

  function state(id) {
    var d=byId(id),p=d?numbers(id):{value:0,max:1,text:''},cur=current();
    return {id:id,completed:!!completed[id],claimed:!!claimed[id],current:!!(cur&&cur.id===id),value:p.value,max:p.max,text:p.text};
  }

  function rewardText(id) {
    var d=byId(id),out=[],k;if(!d)return'';
    for(k in d.reward)if(d.reward.hasOwnProperty(k))out.push(W.Inv.label(k)+' ×'+d.reward[k]);
    return out.join('、');
  }

  function claim(id) {
    claimResult.ok=false;claimResult.id=id;
    var d=byId(id),k,total=0,room;
    if(!d){claimResult.msg='找不到這項任務';return claimResult;}
    if(!completed[id]){claimResult.msg='任務尚未完成';return claimResult;}
    if(claimed[id]){claimResult.msg='獎勵已經領取';return claimResult;}
    for(k in d.reward)if(d.reward.hasOwnProperty(k))total+=d.reward[k];
    room=(W.Inv.cap()-W.Inv.total())+(W.Store.stats().cap-W.Store.total());
    if(room<total){claimResult.msg='背包與倉庫空間不足，請先整理';return claimResult;}
    for(k in d.reward)if(d.reward.hasOwnProperty(k)){
      var got=W.Inv.add(k,d.reward[k]),left=d.reward[k]-got;
      if(left>0&&W.Store.grant)W.Store.grant(k,left);
    }
    claimed[id]=1;claimResult.ok=true;claimResult.msg='領取任務獎勵：'+rewardText(id);return claimResult;
  }

  function track(id) {
    var d=byId(id);if(!d||!d.track||!W.Guide)return false;
    if(d.track==='altar'&&W.Guide.select)return W.Guide.select('altar');
    W.Guide.init();return true;
  }

  function completedCount(){var n=0,i;for(i=0;i<DEFS.length;i++)if(completed[DEFS[i].id])n++;return n;}
  function claimedCount(){var n=0,i;for(i=0;i<DEFS.length;i++)if(claimed[DEFS[i].id])n++;return n;}
  function list(){return DEFS;}

  function exportData(){return{completed:copyFlags(completed),claimed:copyFlags(claimed)};}
  function importData(o){completed={};claimed={};if(!o)return;completed=validFlags(o.completed);claimed=validFlags(o.claimed);}
  function validFlags(o){var r={},i,id;if(!o)return r;for(i=0;i<DEFS.length;i++){id=DEFS[i].id;if(o[id])r[id]=1;}return r;}
  function copyFlags(o){var r={},k;for(k in o)if(o.hasOwnProperty(k)&&o[k])r[k]=1;return r;}
  function clear(){completed={};claimed={};tickT=0;}
  function stats(){return{total:DEFS.length,completed:completedCount(),claimed:claimedCount(),unclaimed:completedCount()-claimedCount()};}

  return {update:update,current:current,list:list,state:state,rewardText:rewardText,claim:claim,track:track,
    exportData:exportData,importData:importData,clear:clear,stats:stats};
})();
