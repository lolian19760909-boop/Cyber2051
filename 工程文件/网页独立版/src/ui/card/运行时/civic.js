/* Derived from 卡片源码/运行时/civic.js; source SHA256 5970f6d8a0b65019cf580c9ef43b1216984bd315e5e815f04ccabbd2cc8fc68d. Rebuild with tools/p3a-adapt-views.mjs. */
/* Bridge city/police facts into the card's existing numeric and quest transaction. */
(function(root,factory){const local=typeof module==='object'&&module.exports;
 const api=factory(local?require('./police.js'):root.CxxPolice,local?require('./city.js'):root.CxxCity,root);
 if(local)module.exports=api;else {root.CxxCivic=api;if(root)root.CxxCivic=api;}
})(globalThis,function(P,City,root){
 'use strict';
 const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),get=(v,path)=>path.reduce((a,k)=>a?.[k],v);
 const local=typeof module==='object'&&module.exports;
 const A=()=>local?require('./ensemble-state.js'):root.CxxEnsembleState||root?.CxxEnsembleState;
 const L=()=>local?require('./loadout.js'):root.CxxLoadout||root?.CxxLoadout;
 const pointer=p=>'/'+p.join('/'),paths=['/terminal/policeInput','/terminal/cityInput'];
 function prepare(before,patches,policy){
  const values=paths.map(path=>{const rows=patches.filter(p=>p.path===path);if(rows.length>1||rows.length&&!Array.isArray(rows[0].value))throw Error('警方与地点输入各使用一份事件数组。');return rows[0]?.value||[];});
  const [policeEvents,cityEvents]=values,options=policy.numericOptions||{};
  if(!policeEvents.length&&!cityEvents.length&&!before.terminal?.police&&!patches.some(p=>paths.includes(p.path)))return null;
  const now=P.clock(options.rawStory),source=options.source,story=String(options.storyText||'').replace(/\s+/g,' ').trim();
  if((policeEvents.length||cityEvents.length)&&!source)throw Error('地点或警情更新缺少当前正文来源。');
  const quote=value=>{const normalized=String(value||'').replace(/\s+/g,' ').trim();if(normalized.length<8||normalized.length>400||!story.includes(normalized))throw Error('地点或警情事件引文不在本轮有效正文中。');};
  const result=patches.filter(p=>!paths.includes(p.path)),changes=[],custody={};
  const selected=actorId=>A().selected(before,actorId),input=(actorId)=>pointer([...selected(actorId).paths.gameplay,'numericInput']);
  const inventory=(actorId,key,slot=false)=>{
   const game=selected(actorId).gameplay||{},existing=result.find(p=>p.path===input(actorId)),base=existing?L().applyEvents(game,existing.value):game;
   const record=slot?base.equipment?.[key]:base.inventory?.[key];if(!record)return null;
   const itemId=slot?record.itemId:key,definition=L().get(base,itemId,record.definitionRef);if(!definition)return null;
   return {record,definition,installed:L().list(base).some(x=>x.record.itemId===itemId&&x.definition.category==='cyberware')};
  };
  function responsible(actorId,event,state){
   if(actorId==='player'||before.terminal?.ensemble?.actors?.[actorId])return selected(actorId);
   const name=state.targets?.[actorId]?.name||(event.event==='report'&&event.actorName);
   if(!/^npc_[a-zA-Z0-9_-]+$/.test(actorId)||typeof name!=='string'||!name.trim()||name.length>80)throw Error('现场NPC使用npc_稳定编号并在首次report写明actorName；已登记人物沿用原actorId。');
   return {actorId,external:true,record:{name}};
  }
  const calculated=P.calculate(before,policeEvents,{now,source,quote,actor:responsible,inventory});
  const setPatch=(path,value)=>{const old=get(before,path),p=pointer(path),index=result.findIndex(row=>row.path===p),patch={op:old===undefined?'add':'replace',path:p,value:copy(value)};if(index>=0)result[index]=patch;else result.push(patch);};
  if(!same(before.terminal?.police,calculated.state)&&(policeEvents.length||before.terminal?.police)){
   changes.push({path:['terminal','police'],after:calculated.state});setPatch(['terminal','police'],calculated.state);
  }
  if(cityEvents.length){const city=City.evaluate(before,cityEvents,{source,quote});changes.push({path:['terminal','city'],after:city});setPatch(['terminal','city'],city);}
  for(const op of calculated.operations){
   const person=selected(op.actorId),game=person.gameplay||{};
   if(op.kind==='pay'){
    const wallet=copy(person.wallet||{});for(const p of result.filter(p=>p.path.startsWith(pointer(person.paths.wallet)+'/')))wallet[p.path.split('/').at(-1)]=Number(p.value);
    if(['yen','earned','spent'].some(key=>!Number.isSafeInteger(wallet[key])||wallet[key]<0)||wallet.yen<op.amount)throw Error('实际付款超过该人物钱包余额。');
    setPatch([...person.paths.wallet,'yen'],wallet.yen-op.amount);setPatch([...person.paths.wallet,'spent'],wallet.spent+op.amount);
   }else if(op.kind==='item'){
    const path=input(op.actorId);let patch=result.find(p=>p.path===path);if(!patch){patch={op:'add',path,value:[]};result.push(patch);}else patch.value=copy(patch.value);
    patch.value.push(op.event);
   }else{
    const state=custody[op.actorId]||=copy(game.loadout?.policeRestrictions||{});
    if(op.kind==='restrict')state[op.detentionId]={slots:copy(op.slots),source:copy(op.source)};else delete state[op.detentionId];
    const path=input(op.actorId);if(!result.some(p=>p.path===path))result.push({op:'add',path,value:[]});
   }
  }
  return {patches:result,changes,custody};
 }
 // A quest correction must also revert same-batch civic/item changes, never half a transaction.
 function linkCorrection(before,patches,policy){
  if(!policy.civicTransaction||!policy.questTransaction)return patches;
  const p=patches.find(p=>p.path==='/terminal/questJournal'),key=policy.numericOptions?.factBatch,receipt=p?.value?.receipts?.[key];if(!receipt)return patches;
  const paths=patches.filter(row=>row!==p).map(row=>row.path.slice(1).split('/'));
  const roots=paths.filter((path,i)=>!paths.some((other,j)=>i!==j&&other.length<path.length&&other.every((part,k)=>path[k]===part)));
  const final=copy(before);for(const row of patches.filter(row=>row!==p)){const parts=row.path.slice(1).split('/');let at=final;for(const k of parts.slice(0,-1))at=at[k];at[parts.at(-1)]=copy(row.value);}
  receipt.changes=[...new Map(roots.map(path=>[pointer(path),path])).values()].map(parts=>({parts,missing:get(before,parts)===undefined,before:get(before,parts)===undefined?null:copy(get(before,parts)),after:copy(get(final,parts))}));
  receipt.civic=true;return patches;
 }
 function extendSchema(schema){const p=schema?.properties?.terminal?.properties;if(!p)return;for(const key of ['police','city'])p[key]={...(p[key]||{}),type:'object',extensible:true,recursiveExtensible:true,required:false};}
 function plan(stat,request,options={}){const actor=A().selected(stat);if(options.actorBinding)A().assertBinding(stat,options.actorBinding);
  if(request.action==='police-correct'){const c=P.read(stat).cases[request.caseId];if(!c||c.actorId!==actor.actorId)throw Error('请切回本案人物再核对识别。');return P.correct(stat,request);}
  return City.plan(stat,request,options);
 }
 return {prepare,linkCorrection,extendSchema,plan};
});
