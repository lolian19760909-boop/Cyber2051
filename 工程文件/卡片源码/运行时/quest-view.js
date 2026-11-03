/* Read-only quest projection shared by the terminal and Rolecard Studio.
   No host access, writes, settlement or animation state belongs here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxQuestView=api;})(globalThis,function(){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const copy=value=>structuredClone(value);
 const record=(stat,id)=>stat?.terminal?.quests?.[id]||{state:'已发布'};
 function definitionsOf(stat,definitions){
  const all=new Map(definitions.map(q=>[q.id,q]));
  for(const [id,r]of Object.entries(stat?.terminal?.quests||{}))if(r.definition?.source==='story')all.set(id,{...r.definition,id});
  return [...all.values()];
 }
 function project(stat={},definitions=[],source={}){
  const all=definitions.map(q=>record(stat,q.id).definition?.source==='story'?{...record(stat,q.id).definition,id:q.id}:q),hasChapter=all.some(q=>q.id==='q_chip_night');
  const rows=all.filter(q=>(!q.hidden||record(stat,q.id).discovered)&&!(hasChapter&&q.id==='q_heist'&&record(stat,q.id).state==='已发布')).map(copy);
  for(const [id,r]of Object.entries(stat.terminal?.quests||{}))if(id!=='$meta'&&!all.some(q=>q.id===id)&&!rows.some(q=>q.id===id))rows.push(r.definition?.source==='story'?{...copy(r.definition),id}:{id,title:r.title||'旧委托 · '+id,brief:'此记录的内容包未加载。进度原样保留；加载原内容包后可继续。',legacy:true});
  const journal=stat.terminal?.questJournal||{},trackedId=journal.tracked||'';
  const items=rows.map(definition=>{
   const r=copy(record(stat,definition.id));
   return {id:definition.id,title:definition.title,state:r.state,objective:r.objective||definition.goal||'请先恢复原内容定义。',
    kind:definition.track==='main'?'主线':'委托',tracked:definition.id===trackedId,legacy:!!definition.legacy,definition,record:r};
  });
  const identity={};for(const key of ['chatId','characterId','messageId','floor','swipeId','swipe'])if(source[key]!==undefined)identity[key]=source[key];
  return {version:1,revision:journal.revision||0,source:identity,trackedId,tracked:items.find(q=>q.tracked)||null,items};
 }
 function display(projection,field,empty='尚未选择追踪任务'){
  if(!['title','state','objective','kind','id'].includes(field))throw Error('未知任务展示字段：'+field);
  if(!projection.tracked)return projection.trackedId?'追踪记录暂不可见':empty;
  return String(projection.tracked[field]??'未提供');
 }
 function map(stat,definitions=[]){
  const all=definitionsOf(stat,definitions),hasChapter=all.some(q=>q.id==='q_chip_night'),completed=all.filter(q=>q.id!=='q_heist'&&record(stat,q.id).state==='完成').length;
  return all.map(q=>{
   const state=stat?.terminal?record(stat,q.id).state||'已发布':'未就绪';
   const locked=q.id==='q_heist'&&(state==='已发布'&&hasChapter||completed<2)||(q.prerequisites||[]).some(id=>record(stat,id).state!=='完成');
   return {...copy(q),state,locked,visible:state!=='已发布'||!locked};
  });
 }
 return {project,display,map};
});
