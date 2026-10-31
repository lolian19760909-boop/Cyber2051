(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./operations.js'):root.CxxOperations);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxQuestHost=api;})(globalThis,function(Operations){
 'use strict';
 const component='cyber2051.quest-actions';
 function create({context:ctx,scope,read,top,commit,saveTimeout}){
  const views=new Map();let confirmed=null,viewId=0;
  const operations=Operations.create({scope,slowMs:saveTimeout,timeoutMs:saveTimeout,report:event=>top.CxxDiagnostics?.report(event)});
  function live236(){const s=(typeof globalThis!=='undefined'&&globalThis.Cxx236State)||(typeof window!=='undefined'&&window.parent&&window.parent.Cxx236State);if(!s||typeof s.stat!=='function')return null;try{const v=s.stat();return v&&v.terminal?v:null;}catch(e){return null;}}
  function context(){const c=ctx();let floor=c.chat.length-1;while(floor>=0&&!c.chat[floor].variables?.[c.chat[floor].swipe_id||0]?.stat_data)floor--;if(floor<0&&live236())floor=c.chat.length-1;return {character:c.characters?.[c.characterId]?.avatar,chat:c.getCurrentChatId(),floor,branch:c.chat[floor]?.swipe_id||0};}
  function source(){const c=ctx(),snapshot=read.local(),floor=snapshot.floor,Q=typeof module==='object'&&module.exports?require('./quests.js'):top.CxxQuests,current=Q.actor(snapshot.stat);return {floor,swipe:c.chat[floor]?.swipe_id||0,actorId:current.actorId,...(current.binding?{actorBinding:current.binding}:{}),questContext:JSON.stringify([c.characters?.[c.characterId]?.avatar,c.getCurrentChatId(),c.chat.map(m=>[m.is_user===true,m.is_system===true,m.swipe_id||0,m.mes]),current.binding])};}
  function authorize(request,snapshot){
   if(request.questContext&&request.questContext!==source().questContext)throw Error('委托来源已变化，请从当前回复分支重新操作。');
   const guard=top.Cxx236VariableGuard;if(!guard?.questDefinition)throw Error('委托内容服务尚未就绪。');
   const result={questDefinitions:[...new Set([request.questId,...Object.keys(snapshot.stat.terminal?.quests||{})])].filter(Boolean).map(id=>guard.questDefinition(id,snapshot.stat.terminal?.quests?.[id]||{})).filter(Boolean),questSource:{floor:snapshot.floor,swipe:ctx().chat[snapshot.floor].swipe_id||0}};
   if(request.action==='quest-calibrate')result.questCalibration=top.CxxLongMemory?.history?.authorize(request);
   return result;
  }
  function submit(request){
   const input={};for(const key of ['action','id','questId','expectedRevision','receiptId','floor','swipe','actorId'])if(request[key]!==undefined)input[key]=request[key];
   return operations.run('quest','委托操作',async operation=>{
    let phase='reading';const owner=scope(),origin=context();
    const trace={...operation,context:{...origin,component,operation:operation.id,requestId:request.id},stage(name,data){phase=name;if(name==='confirmed'){confirmed={owner,origin,revision:data.revision,operation,seen:new Set()};top.CxxDiagnostics?.resolve?.(row=>row.context.component===component&&row.context.requestId===request.id&&row.context.classification==='commit-unconfirmed');}operation.stage(name,data);}};
    try{trace.stage('reading');return await commit(request,trace);}catch(error){error.diagnosticKind=error.diagnosticKind||(error.code==='context-changed'||/分支|来源已变化|目标楼层/.test(error.message)?'source-expired':['applying','applied','persisting','confirming','unconfirmed'].includes(phase)?'commit-unconfirmed':'rule-rejected');throw error;}
   },{component,context:context(),input,requestId:request.id,request:JSON.stringify(request)});
  }
  function registerView(){
   const id=++viewId;views.set(id,{owner:scope(),revision:null});
   return {observed(snapshot){
    if(!views.has(id))return;const value={owner:scope(),revision:snapshot.revision,source:snapshot.source};views.set(id,value);
    if(confirmed&&confirmed.owner===scope()&&snapshot.source.chatId===confirmed.origin.chat&&snapshot.source.floor===confirmed.origin.floor&&(snapshot.source.swipe??snapshot.source.swipeId??0)===confirmed.origin.branch&&snapshot.revision>=confirmed.revision&&!confirmed.seen.has(id)){confirmed.seen.add(id);top.CxxDiagnostics?.resolve?.(row=>row.context.operation===confirmed.operation.id&&row.context.classification==='view-not-refreshed');confirmed.operation.event('view-refreshed',{revision:snapshot.revision});}
   },destroy(){views.delete(id);confirmed?.seen.delete(id);}};
  }
  function status(){const origin=context(),op=operations.read(),active=[...views.entries()].filter(([,v])=>v.owner===scope()),same=confirmed?.owner===scope()&&confirmed.origin.floor===origin.floor&&confirmed.origin.branch===origin.branch,pending=same?active.filter(([id])=>!confirmed.seen.has(id)).length:0;return {component,operation:op?.context?.character===origin.character&&op.context.chat===origin.chat?op:null,activeViews:active.length,pendingViews:pending,confirmedRevision:same?confirmed.revision:null,classification:pending?'view-not-refreshed':null};}
  return {source,context,authorize,commit:submit,read:()=>read.local(),registerView,status,subscribe:operations.subscribe,destroy(){views.clear();confirmed=null;operations.destroy();}};
 }
 return {create,component};
});
