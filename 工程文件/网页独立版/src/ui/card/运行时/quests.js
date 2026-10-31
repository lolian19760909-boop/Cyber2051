/* Derived from 卡片源码/运行时/quests.js; source SHA256 858895631a9914b56a0d4c463f569c717cb5e93c625dc8b46ab4bf7c254b6c27. Rebuild with tools/p3a-adapt-views.mjs. */
/* Journal rules. Definitions are read from the installed/pinned content registry.
   Browsing never creates records; UI operations never award money or items. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else {root.CxxQuests=api;if(root)root.CxxQuests=api;}})(globalThis,function(root){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const copy=v=>structuredClone(v),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),own=(v,k)=>Object.hasOwn(v||{},k);
 const states=['已发布','已接取','进行中','暂离','搁置','完成','失败','已放弃','已错过','已过期'];
 const active=['已接取','进行中','暂离','搁置'],closed=['完成','失败','已放弃','已错过','已过期'];
 const leaves=['state','rank','objective','knownFacts','agreedYen','paidYen','refundedYen','settled','deadlineAt','chapter'];
 const chapter=()=>typeof module==='object'&&module.exports?require('./chapter.js'):root.CxxChapter||root?.CxxChapter;
 const chapterId='q_chip_night',legacyStarted=stat=>['objective','knownFacts','rank','acceptedFloor','startedFloor','paidYen','refundedYen','settled'].some(k=>Boolean(record(stat,'q_heist')[k]))||record(stat,'q_heist').state!=='已发布';
 const idPattern=/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/;
 const record=(stat,id)=>stat?.terminal?.quests?.[id]||{state:'已发布'};
 const journal=stat=>stat?.terminal?.questJournal||{schema:1,revision:0,tracked:'',receipts:{}};
 const actors=()=>typeof module==='object'&&module.exports?require('./ensemble-state.js'):root.CxxEnsembleState||root?.CxxEnsembleState;
 function actor(stat,actorId){
  const A=actors();if(A)return A.selected(stat,actorId);
  if(stat?.terminal?.ensemble!==undefined||actorId&&actorId!=='player')throw Error('人物状态服务尚未就绪。');
  return {actorId:'player',record:{name:'玩家'},gameplay:stat?.terminal?.gameplay,wallet:stat?.terminal?.wallet,paths:{wallet:['terminal','wallet']},binding:null};
 }
 // Missing ownership on an existing record always means the original player.
 function owner(stat,id){const value=record(stat,id).ownerActorId,actorId=value===undefined?'player':value;if(typeof actorId!=='string'||!idPattern.test(actorId))throw Error('委托接单人编号无效。');return actor(stat,actorId);}
 const walletPath=path=>/^\/terminal\/(?:ensemble\/actors\/[a-zA-Z][a-zA-Z0-9_-]{0,79}\/)?wallet\/(?:yen|earned|spent)$/.test(path);
 const occupies=(q,r)=>active.includes(r.state)||(r.state==='完成'&&q?.releaseOn==='payment'&&!r.settled);
 function extendSchema(schema){const p=schema?.properties?.terminal?.properties;if(!p)return;for(const key of ['quests','questJournal']){p[key]={...(p[key]||{}),type:'object',extensible:true,recursiveExtensible:true,required:false};if(key==='quests')for(const r of Object.values(p[key].properties||{}))if(r?.type==='object'){r.extensible=true;r.recursiveExtensible=true;}}}
 function lock(stat,q,definitions=[]){
  if(!q)return '这份旧记录的内容定义未加载；记录仍然保留。';
  if(definitions.some(item=>item.route==='author-20261018')){
   const M=typeof module==='object'&&module.exports?require('../剧情/line-model.js'):root.CxxPlot||root?.CxxPlot;
   if(!M?.mainRoute)return '剧情内容服务正在载入，请稍后重试。';
   const legacy=M.mainRoute(stat)==='legacy';
   if(q.route==='author-20261018'&&legacy)return '此故事继续旧盗芯路线，原进度保留。';
   if(['q_chip_night','q_heist'].includes(q.id)&&!legacy)return '这是旧版盗芯八段章节，新故事不从这里开始：请在委托列表接取主线一「盗芯之前」，它会把三线13节点依次展开。';
  }
  if(q.id===chapterId&&legacyStarted(stat))return '这份存档已有旧版盗芯任务，请从原记录继续。新故事可选择新版章节。';
  if(q.id==='q_heist'&&record(stat,q.id).state==='已发布'&&definitions.some(q=>q.id===chapterId))return '新版盗芯之夜已放入主线日志，从那里展开故事。';
  if(q.hidden===true&&!record(stat,q.id).discovered)return '尚未发现这份委托。';
  if((q.prerequisites||[]).some(id=>record(stat,id).state!=='完成'))return q.unlock&&q.unlock!=='无'?q.unlock:'尚未完成前置委托。';
  if(q.id==='q_heist'&&Object.entries(stat.terminal?.quests||{}).filter(([id,r])=>id!=='q_heist'&&r.state==='完成').length<2)return '完成2单任意委托';
  if(q.track==='commission'&&!q.storyLine){const busy=Object.entries(stat?.terminal?.quests||{}).find(([id,r])=>id!==q.id&&active.includes(r.state)&&definitions.find(d=>d.id===id)?.track==='commission'&&!definitions.find(d=>d.id===id)?.storyLine);if(busy)return '当前还有进行中的委托：'+busy[0]+'。完成或暂离之后再接下一条。';}
  for(const other of definitions){if(other.id===q.id||!occupies(other,record(stat,other.id)))continue;if(!q.storyLine&&!other.storyLine&&q.track==='main'&&other.track==='main')return '先完成或放弃当前主线，再接取新的主线。';if(q.conflicts?.includes(other.id)||other.conflicts?.includes(q.id))return '与当前已接取的委托互斥。';}
  const req=q.requirements||{},g=actor(stat).gameplay;
  if(req.level&&Number(g?.growth?.level||0)<req.level)return '要求等级 '+req.level+'。';
  if(req.identities?.length&&!req.identities.includes(g?.origin?.identityId))return '当前身份不满足该委托的公开要求。';
  return '';
 }
 function available(stat,q,action,definitions=[]){
  const r=record(stat,q?.id),phase=r.state||'已发布';
  if(action==='track')return q||r.id?'':'没有可追踪的记录。';
  if(phase!=='已发布'&&owner(stat,q?.id).actorId!==actor(stat).actorId)return '这份委托由'+owner(stat,q?.id).record.name+'接取，请切回该人物处理。';
  const reason=lock(stat,q,definitions);if(action==='accept'&&reason)return reason;
  if(!q)return '内容定义未加载，暂不可推进旧记录。';
  if(action==='accept')return q.storyLine&&phase==='已放弃'?'这条剧情线已经放弃。':phase==='已发布'||phase==='已放弃'&&r.startedFloor===undefined||['失败','已放弃'].includes(phase)&&q.retry===true?'':'这份委托不能重新接取。';
  if(action==='start')return phase!=='已接取'?'请先接取委托。':q.startMode==='narrative'?'从正文中的实际行动开始执行。':'';
  if(action==='pause')return phase!=='进行中'?'当前委托不在执行中。':q.pauseAllowed===false?'当前阶段不能安全暂离，请在剧情中处理现场。':'';
  if(action==='resume')return ['暂离','搁置'].includes(phase)?'':'当前委托没有暂离。';
  if(action==='abandon')return active.includes(phase)?'':'当前委托不能放弃。';
  return '不支持的委托操作。';
 }
 function plan(stat,request,{questDefinitions=[],questSource,questCalibration,actorBinding}={}){
  if(!stat?.terminal)throw Error('当前剧情变量尚未就绪。');
  if(!idPattern.test(request.id||''))throw Error('委托操作编号无效。');
  const current=actor(stat);if(actorBinding){actors().assertBinding(stat,actorBinding);if(actorBinding.actorId!==current.actorId)throw Error('请从当前扮演人物处理委托。');}
  if(request.actorId&&request.actorId!==current.actorId||request.actorBinding&&!equal(request.actorBinding,current.binding))throw Error('委托操作的人物已变化，请重新打开日志。');
  const j=journal(stat);if(j.schema!==1)throw Error('委托日志版本较新，请使用对应版本角色卡。');const previous=j.receipts?.[request.id],key=JSON.stringify([request.action,request.questId,request.receiptId||'']);
  if(previous){if(previous.key!==key||previous.actorId&&previous.actorId!==current.actorId)throw Error('操作编号已用于另一项操作。');return copy(stat);}
  if(request.expectedRevision!==(j.revision||0))throw Error('委托记录已变化，请检查当前进度后重试。');
  const next=copy(stat),t=next.terminal;t.quests=t.quests||{};const out=t.questJournal={...copy(j),schema:1,revision:(j.revision||0)+1,receipts:{...j.receipts}};
  const action=request.action.replace(/^quest-/,''),q=questDefinitions.find(q=>q.id===request.questId),r=record(stat,request.questId);
  if(action==='calibrate'){
   if(!questCalibration||questCalibration.id!==request.id||!Array.isArray(questCalibration.entries)||!questCalibration.entries.length)throw Error('历史差异尚未确认。');
   const allowed=['id','schema','state','objective','knownFacts','acceptedFloor','startedFloor','chapter','plot'];
   for(const entry of questCalibration.entries){const before=t.quests[entry.id]||null;if(!equal(before,entry.before)||entry.blocked)throw Error('剧情进度已变化，请重新核对历史差异。');
    if(!idPattern.test(entry.id)||!entry.after||Object.keys({...before,...entry.after}).some(k=>!allowed.includes(k)&&!equal(before?.[k],entry.after[k])))throw Error('历史校准只能调整剧情进度，不能修改款项或未知记录。');
    t.quests[entry.id]=copy(entry.after);
   }
  }else if(action==='correct'){
   const receipt=j.receipts?.[request.receiptId];
   if(!receipt||receipt.kind!=='narrative'||receipt.reverted||receipt.revision!==j.revision)throw Error('此后已有进度或操作，不能直接撤销这次识别。请使用对应存档点核对。');
   for(const change of receipt.changes){let target=next;for(const k of change.parts.slice(0,-1))target=target?.[k];const last=change.parts.at(-1);if(!target||!equal(target[last],change.after))throw Error('关联记录已变化，不能单独撤销旧识别。');if(change.missing)delete target[last];else target[last]=copy(change.before);}
   out.receipts[request.receiptId]={...receipt,reverted:true};
  }else{
   if(!idPattern.test(request.questId||''))throw Error('委托编号无效。');
   const known=q||t.quests[request.questId]&&{id:request.questId};
   if(!q&&action!=='track')throw Error('内容定义未加载，暂不可推进旧记录。');
   const reason=available(stat,known,action,questDefinitions);if(reason)throw Error(reason);
   if(action==='track')out.tracked=j.tracked===request.questId?'':request.questId;
   else {
    const fresh=t.quests[request.questId]={...copy(r),id:request.questId};
    if(action==='accept')Object.assign(fresh,{schema:1,state:'已接取',rank:'',acceptedFloor:questSource?.floor||0,objective:fresh.objective||q.goal||'',knownFacts:fresh.knownFacts||'',agreedYen:fresh.agreedYen??Number(q.pay||0),paidYen:fresh.paidYen??0,refundedYen:fresh.refundedYen??0,settled:fresh.settled||false,deadlineAt:fresh.deadlineAt||'',...(q.definitionRef?{definitionRef:copy(q.definitionRef)}:{})});
    if(action==='accept')fresh.ownerActorId=r.state==='已发布'?current.actorId:owner(stat,request.questId).actorId;
    if(action==='accept'&&q.id===chapterId&&!fresh.chapter)fresh.chapter=chapter().initial();
    if(action==='start'){fresh.state='进行中';fresh.startedFloor=questSource?.floor||0;}
    if(['pause','resume','abandon'].includes(action)&&r.state!=='已接取'&&fresh.startedFloor===undefined)fresh.startedFloor=questSource?.floor||0;
    if(action==='pause')fresh.state='暂离';if(action==='resume')fresh.state='进行中';if(action==='abandon')fresh.state='已放弃';
   }
  }
  out.receipts[request.id]={kind:'player',key,action,actorId:current.actorId,questId:request.questId||'',source:copy(questSource||{}),revision:out.revision};
  if(action==='calibrate')out.receipts[request.id].calibrationIds=questCalibration.entries.map(e=>e.id);
  return next;
 }
 function prepare(before,patches,policy){
  const proposed=patches.filter(p=>p.path.startsWith('/terminal/quests/'));
  const openings=policy.plot?.openings?.(before,policy.numericOptions?.source)||{};
  for(const [id,value]of Object.entries(openings))if(!own(before.terminal?.quests,id))value.ownerActorId=actor(before).actorId;
  if(!proposed.length&&!Object.keys(openings).length)return null;
  patches=patches.map(p=>(walletPath(p.path)||/^\/terminal\/quests\/[^/]+\/(?:agreedYen|paidYen|refundedYen)$/.test(p.path))&&typeof p.value==='string'&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(p.value.trim())?{...p,value:Number(p.value)}:p);
  const key=policy.numericOptions?.factBatch,source=policy.numericOptions?.source;
  if(!key||!source)throw Error('委托更新缺少本轮正文来源。');
  const old=journal(before);if(old.schema!==1)throw Error('委托日志版本较新，请使用对应版本角色卡。');const seen=old.receipts?.[key];
  // Retrying this exact story branch cannot pay or advance it twice.
  if(seen)return {patches:patches.filter(p=>!p.path.startsWith('/terminal/quests/')&&!walletPath(p.path)),changes:[]};
  if(new Set(patches.map(p=>p.path)).size!==patches.length)throw Error('一批委托更新不能重复修改同一字段。');
  const plotRecords=new Set(Object.keys(openings)),plot=policy.plot;
  if(plot){
   for(const p of proposed){const parts=p.path.split('/'),id=parts[3],leaf=parts[4];if(!plot.owns(id))continue;
    if(leaf!=='events'&&['state','objective','knownFacts','chapter','plot','line'].includes(leaf)||parts.length!==5)throw Error('当前剧情的状态与阶段由事实事件生成。');
    if(leaf==='events')plotRecords.add(id);
   }
   const working={...before,terminal:{...before.terminal,quests:{...before.terminal?.quests,...openings}}},eventIds=new Set(proposed.filter(p=>p.path.endsWith('/events')).map(p=>p.path.split('/')[3]));
   patches=patches.filter(p=>!eventIds.has(p.path.split('/')[3])||p.path.endsWith('/events')||!p.path.startsWith('/terminal/quests/')).map(p=>{const parts=p.path.split('/'),id=parts[3];if(parts[4]!=='events')return p;if(!plotRecords.has(id))throw Error('该委托尚未开放事实检测。');
    const definitions=[...new Set([...Object.keys(before.terminal?.quests||{}),...plot.definitions.map(q=>q.id)])].map(id=>policy.questDefinition(id,record(before,id))).filter(Boolean);
    const value=plot.advance(working,id,p.value,{Q:{record,journal,plan},source,storyText:policy.numericOptions.storyText,questDefinitions:definitions});
    if(!own(before.terminal?.quests,id)&&value.ownerActorId===undefined)value.ownerActorId=actor(before).actorId;
    for(const change of proposed.filter(x=>x!==p&&x.path.startsWith('/terminal/quests/'+id+'/'))){const leaf=change.path.split('/')[4],amount=typeof change.value==='number'?change.value:typeof change.value==='string'&&/^\d+$/.test(change.value.trim())?Number(change.value):NaN;if(['agreedYen','paidYen','refundedYen'].includes(leaf)){if(!Number.isSafeInteger(amount)||amount<0||leaf!=='agreedYen'&&(value[leaf]===undefined||amount<value[leaf]))throw Error('委托款项必须是有效且不倒退的累计金额。');value[leaf]=amount;}else if(leaf==='settled'&&typeof change.value==='boolean'||['rank','deadlineAt'].includes(leaf)&&typeof change.value==='string'&&change.value.length<=100)value[leaf]=change.value;else throw Error('事件同批只能附带合法的委托款项、评级与期限。');}
    working.terminal.quests[id]=value;
    return {op:own(before.terminal?.quests,id)?'replace':'add',path:'/terminal/quests/'+id,value};
   });
   for(const [id,value]of Object.entries(openings))if(!eventIds.has(id))patches.push({op:own(before.terminal?.quests,id)?'replace':'add',path:'/terminal/quests/'+id,value});
  }
  const chapterPath='/terminal/quests/'+chapterId+'/',eventPatch=patches.find(p=>p.path===chapterPath+'chapter');
  if(eventPatch){
   const r=record(before,chapterId);if(!['已接取','进行中'].includes(r.state)||!policy.questDefinition?.(chapterId,r))throw Error('请先从日志展开盗芯之夜，暂停的章节需先继续。');
   const C=chapter(),c=C.advance(r,eventPatch.value,{source,storyText:policy.numericOptions.storyText});
   if(patches.some(p=>['state','objective','knownFacts'].some(k=>p.path===chapterPath+k)))throw Error('章节事件会同步目标与状态，请只提交chapter事件及实际款项。');
   patches=patches.map(p=>p===eventPatch?{...p,op:r.chapter?'replace':'add',value:c}:p);
   for(const [field,value]of Object.entries({state:c.status==='complete'?'完成':c.status==='closed'?'已放弃':'进行中',objective:C.objective({chapter:c}),knownFacts:c.knownFacts}))if(!equal(r[field],value))patches.push({op:own(r,field)?'replace':'add',path:chapterPath+field,value});
  }else if(patches.some(p=>p.path.startsWith(chapterPath)&&['state','objective','knownFacts'].includes(p.path.slice(chapterPath.length))))throw Error('盗芯章节的阶段与进展通过chapter事件登记。');
  const next=copy(before),changes=[],ids=new Set();
  const newQuestTable=plotRecords.size>0&&before.terminal?.quests===undefined;if(newQuestTable)next.terminal.quests={};
  for(const p of patches.filter(p=>p.path.startsWith('/terminal/quests/')||walletPath(p.path))){
   const parts=p.path.slice(1).split('/');let target=next;for(const k of parts.slice(0,-1))target=target?.[k];if(!target)throw Error('委托记录不存在，请先接单。');
   if(parts[1]==='quests'){
    const id=parts[2],r=record(before,id),q=policy.questDefinition?.(id,r);ids.add(id);
    if(!(parts.length===3&&plotRecords.has(id))&&(parts.length!==4||!idPattern.test(id)||!leaves.includes(parts[3])||!q||r.state==='已发布'))throw Error('只更新已接取、已登记委托的公开进展。');
    if(parts[3]==='chapter'&&(id!==chapterId||!eventPatch))throw Error('该委托没有章节事件定义。');
    if(parts[3]==='state'&&p.value!==r.state){const allowed=r.state==='已接取'?['进行中','完成','失败','已放弃','已过期']:['进行中','暂离','搁置'].includes(r.state)?['进行中','暂离','完成','失败','已放弃','已过期']:[];if(!allowed.includes(p.value))throw Error('不能由正文接单、重新发布或重开已结束的委托。');}
    if(['paidYen','refundedYen'].includes(parts[3])&&(r[parts[3]]===undefined||p.value<r[parts[3]]))throw Error('旧账未核实或累计款项倒退；请核对原存档，不能补发历史收入。');
   }
   const leaf=parts.at(-1);changes.push({parts,missing:!own(target,leaf),before:own(target,leaf)?copy(target[leaf]):null,after:copy(p.value)});target[leaf]=copy(p.value);
  }
  const generated=[];
  for(const id of ids){const a=record(before,id),b=record(next,id);if(!plotRecords.has(id)&&a.startedFloor===undefined&&(['进行中','完成','失败'].includes(b.state)&&b.state!==a.state||id===chapterId&&eventPatch)){const parts=['terminal','quests',id,'startedFloor'];b.startedFloor=source.floor;generated.push({op:'add',path:'/'+parts.join('/'),value:source.floor});changes.push({parts,missing:true,before:null,after:source.floor});}}
  const payments=new Map();
  for(const id of ids){const a=record(before,id),b=record(next,id),recipient=owner(next,id),sum=payments.get(recipient.actorId)||{income:0,refund:0};sum.income+=(b.paidYen||0)-(a.paidYen||0);sum.refund+=(b.refundedYen||0)-(a.refundedYen||0);payments.set(recipient.actorId,sum);if(b.rank&&b.state!=='完成'&&b.rank!==a.rank)throw Error('完成之前不能写入完成评级。');if(b.settled===true&&a.settled!==true&&(!Number.isSafeInteger(b.paidYen)||!Number.isSafeInteger(b.agreedYen)||b.paidYen<b.agreedYen))throw Error('实际收款尚未达到当前约定，不能标记结清。');}
  for(const [actorId,{income,refund}]of payments){const a=actor(before,actorId).wallet||{},b=actor(next,actorId).wallet||{};
   if(income>0&&(!Number.isSafeInteger(Number(a.earned))||!Number.isSafeInteger(Number(b.earned))||Number(b.earned)-Number(a.earned)<income)||refund>0&&(!Number.isSafeInteger(Number(a.spent))||!Number.isSafeInteger(Number(b.spent))||Number(b.spent)-Number(a.spent)<refund))throw Error('实际收款／退款与接单人的钱包必须在同一批保存。');
  }
  if(newQuestTable){patches=patches.filter(p=>!p.path.startsWith('/terminal/quests/'));const value=copy(next.terminal.quests);patches.push({op:'add',path:'/terminal/quests',value});for(let i=changes.length-1;i>=0;i--)if(changes[i].parts[1]==='quests')changes.splice(i,1);changes.push({parts:['terminal','quests'],missing:true,before:null,after:value});}
  const value={...copy(old),schema:1,revision:(old.revision||0)+1,receipts:{...old.receipts,[key]:{kind:'narrative',actorId:actor(before).actorId,source:copy(source),revision:(old.revision||0)+1,questIds:[...ids],changes}}};
  const meta={op:before.terminal.questJournal?'replace':'add',path:'/terminal/questJournal',value};
  return {patches:[...patches,...generated,meta],changes:[...patches.filter(p=>newQuestTable&&p.path==='/terminal/quests'||plotRecords.has(p.path.split('/')[3])&&p.path.split('/').length===4).map(p=>({path:p.path.slice(1).split('/'),after:p.value})),...generated.map(p=>({path:p.path.slice(1).split('/'),after:p.value})),{path:['terminal','questJournal'],after:value}]};
 }
 function correction(stat){const j=journal(stat);return Object.entries(j.receipts||{}).find(([,v])=>v.kind==='narrative'&&!v.reverted&&v.revision===j.revision)||null;}
 return {states,active,closed,leaves,record,journal,actor,owner,occupies,lock,available,plan,prepare,correction,extendSchema};
});
