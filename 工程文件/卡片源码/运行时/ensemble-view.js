/* Read projections only. This module never initializes or writes game state. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const api=factory(local?require('./ensemble-state.js'):root.CxxEnsembleState,local?require('../数值引擎/src/engine.js'):root.CxxNumericEngine,local?require('./loadout.js'):root.CxxLoadout);if(local)module.exports=api;else root.CxxEnsembleView=api;})(globalThis,function(A,E,L){
  'use strict';
  const copy=v=>(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone(v);
  const roster=()=>typeof module==='object'&&module.exports?require('./roster.js'):globalThis.CxxRoster;
  const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
  const fields={body:'体质',reflexes:'反应',intelligence:'智力',technical:'技术',cool:'镇定'};
  function selected(snapshot,actorId){
    const stat=snapshot.stat||{},registry=A.registry(stat),id=actorId||registry?.control.actorId||'player';
    const value=registry?A.read(stat,id):id==='player'?{record:{name:snapshot.storyProfile?.name||'玩家'},gameplay:stat.terminal?.gameplay,wallet:stat.terminal?.wallet}:null;
    if(!value)throw Error('该人物尚未登记。');
    return {...snapshot,actor:{id,name:id==='player'?snapshot.storyProfile?.name||value.record.name:value.record.name,binding:registry?A.binding(stat,id):null,gameplay:value.gameplay,wallet:value.wallet,profile:id==='player'?snapshot.storyProfile||{}:{name:value.record.name},worldbookUid:value.record.worldbookUid}};
  }
  function row(snapshot,actorId){
    const s=selected(snapshot,actorId),a=s.actor,g=a.gameplay||{},registry=A.registry(snapshot.stat),v=g.numeric?.vitals;
    let maxima=null,error='';try{if(g.growth&&g.numeric){E.growth.read(g.growth);E.checkNumeric(g.numeric,E.rules);maxima=E.maximums(g.growth.perks,E.rules,L.effects(g),g.growth);}}catch(e){error=e.message;}
    const equipment=[];try{for(const item of L.list(g))equipment.push({slot:item.slot,name:item.definition.name,tier:item.definition.tier,category:item.definition.category,description:L.playerDescription(item.definition),effects:L.describe(item.definition),active:L.activeSlots(g).includes(item.slot),current:g.loadout?.activeWeapon===item.slot,instanceId:item.record.instanceId});}catch(e){error||=e.message;}
    const inventory=[];try{for(const [id,item]of Object.entries(g.inventory||{})){if(id==='$meta'||!item)continue;const d=L.get(g,id,item.definitionRef);inventory.push({id,name:d?.name||id,quantity:number(item.quantity),category:d?.category||'',tier:d?.tier??null});}}catch(e){error||=e.message;}
    const quests=Object.entries(snapshot.stat?.terminal?.quests||{}).filter(([id,r])=>id!=='$meta'&&r&&r.state!=='已发布'&&(r.ownerActorId===undefined?'player':r.ownerActorId)===actorId).map(([id,r])=>({id,title:r.title||'',state:r.state,objective:r.objective||'',agreedYen:number(r.agreedYen),paidYen:number(r.paidYen),refundedYen:number(r.refundedYen),settled:r.settled===true,deadlineAt:r.deadlineAt||'',rank:r.rank||'',definitionRef:copy(r.definitionRef)}));
    let detail=null,progress=null;try{detail=roster()?.project(snapshot.stat,actorId);progress=roster()?.progress(g);}catch(e){error||=e.message;}const knownWallet=actorId==='player'||roster()?.profiles.get(actorId)?.roster?.walletKnown!==false||snapshot.stat?.terminal?.roster?.walletObserved?.includes(actorId);
    return {controllable:registry?.actors?.[actorId]?.controllable!==false,san:detail?.san??null,state:detail?.state||'未记录',physical:detail?.physical!==false,present:detail?.present===true,power:detail?.power??null,progress,loreEquipment:detail?.loreEquipment||[],actorId,name:a.name,controlled:(registry?.control.actorId||'player')===actorId,worldbookUid:a.worldbookUid,status:error?'invalid':g.growth&&g.numeric?'ready':'uninitialized',error,
      level:number(g.growth?.level),xp:number(g.growth?.xp),attributePoints:number(g.growth?.attributePoints),perkPoints:number(g.growth?.perkPoints),attributes:Object.entries(fields).map(([id,name])=>({id,name,value:number(g.growth?.attributes?.[id])})),
      vitals:Object.fromEntries(['hp','stamina','ram'].map(id=>[id,{value:id==='hp'&&detail?.physical===false?null:number(v?.[id]),max:id==='hp'&&detail?.physical===false?null:number(maxima?.[id])}])),wallet:Object.fromEntries(['yen','earned','spent'].map(id=>[id,knownWallet?number(a.wallet?.[id]):null])),
      perks:Object.entries(g.growth?.perks||{}).filter(([id])=>id!=='$meta').map(([id,rank])=>{let name;try{name=E.growth.node(id).name;}catch{name='未登记专长';}return {id,rank:copy(rank),name};}),
      equipment,inventory,quests,location:copy(g.location??null),effects:copy(g.numeric?.effects??[]),source:actorId==='player'?{kind:'existing-player'}:copy(registry.actors[actorId].sourceRef),binding:a.binding};
  }
  function project(snapshot,{mode='player',query=''}={}){
    if(!['player','author'].includes(mode))throw Error('人物查看方式无效。');
    const data=A.registry(snapshot.stat),controlledActorId=data?.control.actorId||'player',viewpointActorId=data?.control.viewpointActorId||'player';
    // Numeric visibility was explicitly approved for the whole roster.
    const ids=Object.keys(data?.actors||{player:null}).filter(id=>id!=='$meta').sort((a,b)=>Number(b===controlledActorId)-Number(a===controlledActorId)||Number(snapshot.stat?.terminal?.roster?.present?.includes(b))-Number(snapshot.stat?.terminal?.roster?.present?.includes(a)));
    const rows=ids.map(id=>row(snapshot,id)).filter(r=>!query||r.name.toLocaleLowerCase().includes(String(query).trim().toLocaleLowerCase()));
    return {mode,registered:!!data,controlledActorId,viewpointActorId,controlName:selected(snapshot,controlledActorId).actor.name,rows,source:{floor:snapshot.floor,swipe:snapshot.messages?.[snapshot.floor]?.swipe_id??0}};
  }
  return {selected,row,project,fields};
});
