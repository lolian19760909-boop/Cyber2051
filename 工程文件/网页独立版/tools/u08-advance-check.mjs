import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {createMemoryService} from '../src/memory/service.mjs';
import {readPlotPack,buildCapsule,CAPSULE_FIELDS,PLOT_FIELDS} from '../src/memory/advance.mjs';
const require=createRequire(import.meta.url),parser=require('../../卡片源码/Gal/parser.js'),knowledge=require('../../卡片源码/长期记忆/knowledge.js'),bundle=require('../../卡片源码/长期记忆/package.cjs').data();
const contract={schema:1,tableVersion:bundle.tableVersion,tables:Object.values(bundle.template).filter(t=>t.uid).map(t=>({id:t.uid,name:t.name,headers:t.content[0],instruction:t.sourceData.note})),recallPrompt:bundle.recall.plotTasks[0].promptGroup[0].content,advancePrompt:bundle.combined.plotTasks.find(t=>t.id==='cxx_memory_advance').promptGroup[0].content};
const identity={accountId:'u08-player',runId:'u08-advance',branchId:'main',mode:'local'};
const state={terminal:{wallet:{yen:1000},quests:{q1:{state:'进行中'}},ensemble:{actors:{player:{actorId:'player',name:'玩家'},wb_4:{actorId:'wb_4',name:'高松灯'}},control:{actorId:'player',viewpointActorId:'player',revision:0}}}};
const opening='<cxx-story>故事开始于东京都的街边诊所。</cxx-story>';
const DIRECTION='<cxx_memory_direction>委托人仍未出现，先让玩家在诊所等到傍晚。</cxx_memory_direction>';
const pack=(fields={})=>Object.entries(fields).map(([key,value])=>'<'+key+'>'+value+'</'+key+'>').join('\n');
const FULL={player_input:'我走进诊所',recall_detail:'上周交付纸袋',recall:'纸袋已交付',time_state:'第三天 · 傍晚',scene_state:'街边诊所 · 候诊区',runtime_state:'灯亮着，无其他客人',time_recall:'上周同一天交付纸袋',situation_assessment:'委托人可疑',butterfly_delta:'诊所提前关门',chapter_baseline:'第一章 · 委托人未到',progression_guidance:'等委托人开口'};
const replyOf=fields=>'<cxx-story>玩家在诊所等了一会儿。</cxx-story>\n'+pack(fields);
const checks=[];const check=async(name,run)=>{await run();checks.push(name);console.log('PASS '+name);};
function fixture({write}){
 const base=createMemoryStatePort({accountId:identity.accountId});let port=write?write(base):base,calls=[];
 const requestPurpose=async(purpose,messages)=>{calls.push({purpose,messages});const system=String(messages?.[0]?.content||'');
  if(purpose==='advance'&&system.includes('标签修复器'))throw Error('当前推进合同没有付费标签修补前置');
  if(purpose==='advance')return {text:DIRECTION,usage:{input_tokens:120,output_tokens:24}};
  if(purpose==='archive')return {text:JSON.stringify({records:[{table:'纪要表',quote:'玩家在诊所交付了写有红线的纸袋给高松灯。',cells:{编码索引:'AM0001',时间跨度:'当天下午',概览:'交付纸袋',纪要:'玩家在诊所交付了写有红线的纸袋给高松灯。',重要对话:''}}]})};
  return {text:'{}'};};
 const open=()=>createMemoryService({statePort:port,identity:()=>({...identity}),parser,knowledge,contract,requestPurpose,versions:()=>({contentVersion:'fixed',promptVersion:'fixed'}),lockManager:null});
 return {base,port,get calls(){return calls;},open,
  async commit({id='reply',raw,parent='opening',branch='main',fork=false}={}){const head=await port.readHead(identity.runId);return port.commit({...identity,branchId:branch,nodeId:id,operationId:'op-'+id,parentNodeId:parent,expectedRevision:head.revision,fork,beforeState:parent?await port.readNodeState(identity.runId,parent):{},stateAfter:structuredClone(state),message:{kind:'body',role:'assistant',raw,input:{text:'我走进诊所'},attemptId:'attempt-'+id,binding:{viewpointActorId:'player'}},profile:{name:'玩家'}});}};
}
async function opened(options={}){
 const f=fixture(options);await f.port.commit({...identity,nodeId:'opening',operationId:'op-opening',parentNodeId:null,expectedRevision:0,stateAfter:structuredClone(state),beforeState:{},message:{kind:'opening',role:'assistant',raw:opening,input:null},profile:{name:'玩家'}});
 const service=f.open();await service.restore();await service.configure({enabled:true,advanceModel:true});
 return {f,service};
}
const userOf=call=>JSON.parse(call.messages[1].content),advanceCalls=calls=>calls.filter(call=>call.purpose==='advance'&&!String(call.messages?.[0]?.content||'').includes('标签修复器'));

await check('十一字段齐全：不补标签，胶囊按原配额带六字段进正式推进',async()=>{
 const {f,service}=await opened();await f.commit({raw:replyOf(FULL)});await service.restore();
 const result=await service.prepareAdvance({query:'我走进诊所，四处看看',facts:{tables:[{name:'纪要表',rows:2}],rows:2,chapter:'第一章'}});
 assert.equal(result.repair.status,'not-required');assert.equal(result.repair.repaired,false);assert.deepEqual(result.pack.missing,[]);assert.equal(advanceCalls(f.calls).length,1,'齐全时只发一次正式推进');
 const user=userOf(advanceCalls(f.calls)[0]);assert.match(user.capsule,/\[本轮玩家原文\] 我走进诊所/);for(const field of ['scene_state','runtime_state','chapter_baseline','progression_guidance','recall','situation_assessment'])assert.match(user.capsule,new RegExp(field));assert.equal(user.pack.missing.length,0);assert.equal(result.capsule.chars>0,true);assert.deepEqual(service.advance.missing,[]);assert.ok(service.advance.usage.input_tokens===120);
});

await check('缺一字段：保留缺失信息，只调用维护源规定的一次推进',async()=>{
 const {f,service}=await opened();const missing={...FULL};delete missing.scene_state;await f.commit({raw:replyOf(missing)});await service.restore();
 const result=await service.prepareAdvance({query:'我在门口等'});
 assert.equal(result.repair.status,'not-required');assert.equal(result.repair.repaired,false);assert.equal(result.repair.missing.includes('scene_state'),true);
 assert.equal(f.calls.length,1,'只发一次正式推进');assert.equal(advanceCalls(f.calls).length,1);assert.doesNotMatch(userOf(advanceCalls(f.calls)[0]).capsule,/上一轮scene_state/);assert.deepEqual(result.pack.missing,['scene_state']);
});

await check('正文只有示例标签：围栏里的 scene_state 不计，胶囊不引用示例文本',async()=>{
 const {f,service}=await opened();const only={runtime_state:'灯亮着，无其他客人'};await f.commit({raw:'<cxx-story>玩家看了看四周。</cxx-story>\n\u0060\u0060\u0060\n<scene_state>示例地点</scene_state>\n\u0060\u0060\u0060\n'+pack(only)});await service.restore();
 const result=await service.prepareAdvance({query:'我看看四周'});
 const user=userOf(advanceCalls(f.calls)[0]);assert.doesNotMatch(user.capsule,/示例地点/);assert.equal(result.repair.repaired,false);assert.equal(Object.hasOwn(result.pack.fields,'scene_state'),false);assert.equal(f.calls.length,1);
});

await check('prepared 保存失败后沿 prepared 重存，不重复调用模型',async()=>{
 let failed=false;const f=fixture({write:base=>new Proxy(base,{get(target,key){if(key==='putRecords')return async(name,run,rows)=>{if(!failed&&name==='memories'&&rows.some(row=>row.kind==='table')){failed=true;throw Error('synthetic disk full');}return target.putRecords(name,run,rows);};return target[key];}})});
 await f.port.commit({...identity,nodeId:'opening',operationId:'op-opening',parentNodeId:null,expectedRevision:0,stateAfter:structuredClone(state),beforeState:{},message:{kind:'opening',role:'assistant',raw:opening,input:null},profile:{name:'玩家'}});
 const service=f.open();await service.restore();await service.configure({enabled:true,auto:true});
 const tableReply='<cxx-story>玩家在诊所交付了写有红线的纸袋给高松灯。</cxx-story>';
 const head=await f.port.readHead(identity.runId);
 await f.port.commit({...identity,nodeId:'reply',operationId:'op-reply',parentNodeId:'opening',expectedRevision:head.revision,beforeState:await f.port.readNodeState(identity.runId,'opening'),stateAfter:structuredClone(state),message:{kind:'body',role:'assistant',raw:tableReply,input:{text:'交付纸袋'},attemptId:'attempt-reply',binding:{viewpointActorId:'player'}},profile:{name:'玩家'}});
 await service.restore();
 const tasks=await service.tasksForCommit({nodeId:'reply',operationId:'op-reply',parentNodeId:'opening',raw:tableReply,inputText:'交付纸袋',attemptId:'attempt-reply'});
 assert.equal(tasks.length,1);await f.port.putRecords('tasks',identity.runId,tasks);await service.restore();
 await assert.rejects(()=>service.processTasks({force:true}),/disk full/);
 const archived=f.calls.filter(call=>call.purpose==='archive').length;
 assert.ok(archived>=1,'归档请求已发出');const retried=await service.retrySave(tasks[0].taskId);
 assert.equal(retried.status,'done');assert.equal(f.calls.length,archived,'重存不再调用模型');
});

await check('改旧楼后归档来源失效：任务标 obsolete，不出新记忆',async()=>{
 const {f,service}=await opened();await f.commit({raw:replyOf(FULL)});await service.configure({enabled:true,auto:true});await service.restore();
 const tasks=await service.tasksForCommit({nodeId:'reply',operationId:'op-reply',parentNodeId:'opening',raw:replyOf(FULL),inputText:'我走进诊所',attemptId:'attempt-reply'});
 assert.equal(tasks.length,1);await f.port.putRecords('tasks',identity.runId,tasks);
 await service.restore();await f.commit({id:'fork',raw:'<cxx-story>玩家没有进诊所，而是直接回家。</cxx-story>',parent:'opening',branch:'other',fork:true});
 await service.restore();const done=await service.processTasks({force:true,taskIds:[tasks[0].taskId]});
 const rows=await f.port.listTasks(identity.runId,null);assert.equal(rows.find(row=>row.taskId===tasks[0].taskId).status,'obsolete');
 assert.equal((await service.list({includeInvalid:true})).rows.filter(row=>row.kind==='table').length,0);assert.equal(advanceCalls(f.calls).length,0);
});

await check('长档：胶囊只取最后一轮推进包，章节与承诺随之更新',async()=>{
 const {f,service}=await opened();for(const [id,parent,chapter] of [['r1','opening','第一章 · 委托人未到'],['r2','r1','第二章 · 纸袋交付'],['r3','r2','第三章 · 车站会面']]){await f.commit({id,parent,raw:replyOf({...FULL,chapter_baseline:chapter,scene_state:chapter+' · 现场'})});}
 await service.restore();const result=await service.prepareAdvance({query:'我看看车站时钟'});
 const user=userOf(advanceCalls(f.calls)[0]);assert.match(user.capsule,/第三章 · 车站会面/);assert.doesNotMatch(user.capsule,/第一章 · 委托人未到/);
 assert.equal(result.repair.status,'not-required');
});
const receipt={schema:1,at:new Date().toISOString(),checks,count:checks.length,fields:PLOT_FIELDS.length,capsuleFields:CAPSULE_FIELDS,quotas:{capsule:6000,playerInput:1700,dbRoute:720,tail:520}};
await (await import('node:fs/promises')).writeFile(new URL('../reports/u08-advance-check.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log('U08 ADVANCE OK '+checks.length);
