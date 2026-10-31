import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {createMemoryService} from '../src/memory/service.mjs';
import {buildMemorySources,checkMemorySource} from '../src/memory/source.mjs';
import {createBM25} from '../src/memory/bm25.mjs';
const require=createRequire(import.meta.url),parser=require('../../卡片源码/Gal/parser.js'),knowledge=require('../../卡片源码/长期记忆/knowledge.js'),bundle=require('../../卡片源码/长期记忆/package.cjs').data();
const contract={schema:1,tableVersion:bundle.tableVersion,tables:Object.values(bundle.template).filter(t=>t.uid).map(t=>({id:t.uid,name:t.name,headers:t.content[0],instruction:t.sourceData.note})),recallPrompt:bundle.recall.plotTasks[0].promptGroup[0].content,advancePrompt:bundle.combined.plotTasks.find(t=>t.id==='cxx_memory_advance').promptGroup[0].content};
const identity={accountId:'test-player',runId:'memory-test',branchId:'main',mode:'local'},state={terminal:{wallet:{yen:1000},quests:{q1:{state:'进行中'}},ensemble:{actors:{player:{actorId:'player',name:'玩家'},wb_4:{actorId:'wb_4',name:'高松灯'},wb_5:{actorId:'wb_5',name:'千早爱音'}},control:{actorId:'player',viewpointActorId:'player',revision:0}}}},checks=[];
const publicQuote='高松灯与玩家在诊所交付了写有红线的纸袋。',promiseQuote='玩家明确听见高松灯说今晚在车站见面。',privateQuote='我仍然怀疑那个委托人，先不告诉其他人。';
const opening='<cxx-story>故事开始于东京都的街边诊所，玩家先等待约定的人。</cxx-story>';
const story='<cxx-story>'+publicQuote+promiseQuote+'<cxx-say speaker="高松灯" kind="thought">'+privateQuote+'</cxx-say></cxx-story>';
function output(){return {records:[
 {table:'纪要表',quote:publicQuote,cells:{编码索引:'AM0001',时间跨度:'当天下午',概览:'与高松灯交付纸袋',纪要:'玩家与高松灯在诊所交付了红线纸袋，双方约定晚间再见。',重要对话:''}},
 {table:'人物经历',quote:publicQuote,cells:{人物:'高松灯',共同经历:'玩家与高松灯交付纸袋。',关系事实:'进行过一次合作。',知情范围:'player、wb_4',关联纪要:'AM0001'}},
 {table:'承诺与未结事项',quote:promiseQuote,cells:{事项编号:'P0001',参与者:'player、wb_4',事项与条件:'今晚在车站见面',状态:'未结',知情范围:'player、wb_4',关联纪要:'AM0001'}},
 {table:'事件记录',quote:publicQuote,cells:{事件编号:'EV_1',类别:'已发生',内容:'双方交付红线纸袋。',参与人物:['player','wb_4'],关联纪要:'AM0001'}},
 {table:'事件记录',quote:privateQuote,cells:{事件编号:'EV_2',类别:'心声',内容:'高松灯私下怀疑委托人。',参与人物:['wb_4'],关联纪要:''}},
 {table:'人物认知',quote:publicQuote,cells:{认知编号:'KN_1',人物编号:'player',事件编号:'EV_1',认知类型:'亲历',所知内容:'高松灯与我在诊所交付了红线纸袋。',获知途径:'亲自参与',告知者:'',取代认知:''}},
 {table:'人物认知',quote:privateQuote,cells:{认知编号:'KN_2',人物编号:'wb_4',事件编号:'EV_2',认知类型:'怀疑',所知内容:privateQuote,获知途径:'本人心声',告知者:'',取代认知:''}},
 {table:'关系变化',quote:publicQuote,cells:{变化编号:'RL_1',起点人物:'player',指向人物:'wb_4',关系描述:'承认有过一次合作，但委托人身份尚未说清。',标签:['合作'],未解问题:'委托人身份',事件编号:'EV_1',取代变化:''}}
 ]};}
async function fixture({model=async()=>({text:JSON.stringify(output())}),wrap}={}){
 const base=createMemoryStatePort({accountId:identity.accountId});let port=wrap?wrap(base):base,calls=0;
 const requestPurpose=async(...args)=>{calls++;return model(...args);};
 const open=()=>createMemoryService({statePort:port,identity:()=>({...identity}),parser,knowledge,contract,requestPurpose,versions:()=>({contentVersion:'fixed',promptVersion:'fixed'}),lockManager:null});
 await port.commit({...identity,nodeId:'opening',operationId:'op-opening',parentNodeId:null,expectedRevision:0,stateAfter:structuredClone(state),beforeState:{},message:{kind:'opening',role:'assistant',raw:opening,input:null},profile:{name:'玩家'}});
 let service=open();await service.restore();
 async function commit({id='reply',raw=story,parent='opening',branch='main',fork=false,tasks:scheduled}={}){const head=await port.readHead(identity.runId);const value=await port.commit({...identity,branchId:branch,nodeId:id,operationId:'op-'+id,parentNodeId:parent,expectedRevision:head.revision,fork,beforeState:parent?await port.readNodeState(identity.runId,parent):{},stateAfter:structuredClone(state),message:{role:'assistant',raw,input:{text:'去诊所交付纸袋'},attemptId:'attempt-'+id},tasks:scheduled||[]});assert.equal(value.status,'committed');return value;}
 async function scheduled({id='reply',raw=story,parent='opening',branch='main'}={}){return service.tasksForCommit({nodeId:id,operationId:'op-'+id,parentNodeId:parent,branchId:branch,raw,inputText:'去诊所交付纸袋',attemptId:'attempt-'+id});}
 return {base,port,get service(){return service;},set service(value){service=value;},open,commit,scheduled,get calls(){return calls;}};
}
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
await check('默认不开额外模型任务；手记来源、常驻、屏蔽与预算可控',async()=>{
 const f=await fixture();assert.deepEqual(await f.service.tasksForCommit({}),[]);await f.service.configure({enabled:true});const note=await f.service.addNote('我怀疑委托人隐瞒了车站会面地点。',{sourceType:'推测',scope:'run'});let recalled=await f.service.recall({query:'委托人会面'});assert.match(recalled.text,/推测/);assert.equal(f.calls,0);
 await f.service.setMode(note.id,'permanent');await assert.rejects(()=>f.service.recall({query:'别处',budgetTokens:2}),{code:'memory_resident_budget'});await f.service.setMode(note.id,'excluded');recalled=await f.service.recall({query:'委托人'});assert.equal(recalled.selected.length,0);await f.service.editNote(note.id,'改为今晚在诊所联系接应人。');assert.match((await f.service.list()).notes[0].text,/诊所/);await f.service.removeNote(note.id);assert.equal((await f.service.list()).notes.length,0);
});
await check('六表实际落盘、同任务不重复请求，记忆不改正式任务或钱包',async()=>{
 const f=await fixture();await f.service.configure({enabled:true,auto:true});const tasks=await f.scheduled();assert.equal(tasks.length,1);await f.commit({tasks});const before=await f.port.readHead(identity.runId);await f.service.afterCommit();await f.service.processTasks();assert.equal(f.calls,1);const data=await f.service.list();for(const name of Object.keys(data.tables))assert.ok(data.tables[name].length,name);assert.equal((await f.port.readHead(identity.runId)).revision,before.revision);assert.deepEqual((await f.port.readNodeState(identity.runId,'reply')),state);
 const recalled=await f.service.recall({query:'诊所 红线纸袋 合作'});assert.match(recalled.text,/纸袋/);assert.doesNotMatch(recalled.text,/仍然怀疑/);assert.ok(recalled.selected.every(r=>!r.source||!Object.hasOwn(r.source,'quote')));assert.equal(f.calls,1);
 const author=await f.service.narrative({actorId:'wb_4',mode:'author'});assert.equal(author.knowledge[0].text,privateQuote);assert.equal(author.relations.length,0);await assert.rejects(()=>f.service.narrative({actorId:'wb_4',mode:'player'}),{code:'viewpoint_mismatch'});
 assert.equal(f.service.projectHistory(story,{actorId:'wb_5',nodeId:'reply'}),'');assert.match(f.service.projectHistory(story,{actorId:'wb_4',nodeId:'reply'}),/本人心声/);assert.doesNotMatch(f.service.projectHistory(story,{actorId:'player',nodeId:'reply'}),/仍然怀疑/);
 const preview=await f.service.previewHistory({fromNodeId:'reply',toNodeId:'reply'});await f.service.beginHistory(preview);await f.service.runHistory();assert.equal(f.calls,1,'补建同一已归档来源不再次收费');
});
await check('非祖先分支、正文编辑及心声性质改变均使来源失效；共同祖先保持',async()=>{
 const f=await fixture();await f.service.configure({enabled:true,auto:true});await f.commit({tasks:await f.scheduled()});await f.service.afterCommit();const note=await f.service.addNote('这条手记只属于交付纸袋后的路线。');
 const nodes=await f.port.readLineage(identity.runId),sourceRows=await buildMemorySources({nodes,identity,parser}),firstSource={...sourceRows[0].source,quote:'故事开始于东京都的街边诊所'};
 await f.commit({id:'fork',raw:'<cxx-story>玩家决定离开诊所，另找一家安静的咖啡店。</cxx-story>',parent:'opening',branch:'other',fork:true});await f.service.restore();const data=await f.service.list({includeInvalid:true});assert.ok(data.rows.filter(r=>r.kind==='table').every(r=>!r.valid));assert.equal(data.notes.find(r=>r.id===note.id).valid,false);assert.equal((await f.service.recall({query:'红线纸袋'})).selected.length,0);
 const current=await f.port.readLineage(identity.runId),currentSources=await buildMemorySources({nodes:current,identity,parser});assert.equal(checkMemorySource(firstSource,currentSources).valid,true);
 const edit=structuredClone(nodes);edit[0].message.raw='<cxx-story>这个开场的经历已经被手工修改，地点也不再是诊所。</cxx-story>';const editSources=await buildMemorySources({nodes:edit,identity,parser});assert.equal(checkMemorySource({...sourceRows[1].source,quote:publicQuote},editSources).valid,false);
 const privateChanged=structuredClone(nodes);privateChanged[1].message.raw=story.replace('kind="thought"','kind="speech"');assert.equal(checkMemorySource({...sourceRows[1].source,quote:publicQuote},await buildMemorySources({nodes:privateChanged,identity,parser})).valid,false);
});
await check('归档途中来源切换时丢弃迟到结果，不落失效行',async()=>{
 let release,started;const ready=new Promise(r=>started=r),reply=new Promise(r=>release=r),f=await fixture({model:async()=>{started();await reply;return {text:JSON.stringify(output())};}});await f.service.configure({enabled:true,auto:true});await f.commit({tasks:await f.scheduled()});const processing=f.service.processTasks();await ready;
 await f.commit({id:'fork',raw:'<cxx-story>玩家没有交付纸袋，而是先回到公寓休息。</cxx-story>',parent:'opening',branch:'other',fork:true});release();await processing;assert.equal((await f.service.list({includeInvalid:true})).rows.length,0);assert.equal((await f.port.listTasks(identity.runId,null))[0].status,'obsolete');assert.equal(f.calls,1);
});
await check('保存失败保留 prepared；重开后只重试保存，不重复调用模型',async()=>{
 let failWrite=true;const f=await fixture({wrap:base=>new Proxy(base,{get(target,key){if(key==='putRecords')return async(name,run,rows)=>{if(failWrite&&name==='memories'&&rows.some(r=>r.kind==='table')){failWrite=false;throw Error('synthetic disk full');}return target.putRecords(name,run,rows);};return target[key];}}),model:async()=>({text:JSON.stringify(output()),model:{model:'synthetic',credential:'NEVER_PERSIST_KEY',apiKey:'NEVER_PERSIST_KEY'},usage:{total_tokens:123,secret:'NEVER_PERSIST_KEY'}})});await f.service.configure({enabled:true,auto:true});const tasks=await f.scheduled();await f.commit({tasks});await assert.rejects(()=>f.service.processTasks(),/disk full/);assert.equal(f.calls,1);assert.equal((await f.port.listTasks(identity.runId,null))[0].status,'prepared');
 f.service.destroy();f.service=f.open();await f.service.restore();await f.service.retrySave(tasks[0].taskId);assert.equal(f.calls,1);assert.equal((await f.port.listTasks(identity.runId,null))[0].status,'done');assert.equal((await f.service.list()).rows.filter(r=>r.kind==='table').length,8);assert.ok(!JSON.stringify(await f.port.listTasks(identity.runId,null)).includes('NEVER_PERSIST_KEY'));
});
await check('取消不接受忽略 AbortSignal 的迟到填表；显式续作才再次请求',async()=>{
 let release,started;const ready=new Promise(r=>started=r),reply=new Promise(r=>release=r);let first=true;const f=await fixture({model:async()=>{if(first){first=false;started();await reply;}return {text:JSON.stringify(output())};}});await f.service.configure({enabled:true,auto:true});const tasks=await f.scheduled();await f.commit({tasks});const work=f.service.processTasks();await ready;f.service.pause();release();await work;assert.equal((await f.service.list()).rows.length,0);assert.equal((await f.port.listTasks(identity.runId,null))[0].status,'paused');await f.service.retryTask(tasks[0].taskId);assert.equal(f.calls,2);assert.equal((await f.service.list()).rows.length,8);
});
await check('历史补建逐块持久化，暂停及重开续作不重付完成块，分块配置被冻结',async()=>{
 let pauseService,pauseOnce=true,calls=[];const f=await fixture({model:async(_purpose,messages)=>{const input=JSON.parse(messages[1].content);calls.push([input.source.nodeId,input.chunk]);return {text:'{"records":[]}'};},wrap:base=>new Proxy(base,{get(target,key){if(key==='putRecords')return async(name,run,rows)=>{const value=await target.putRecords(name,run,rows);if(pauseOnce&&name==='tasks'&&rows.some(r=>r.sourceNodeId==='long'&&r.nextChunk===1&&r.status==='pending')){pauseOnce=false;pauseService.pause();}return value;};return target[key];}})});pauseService=f.service;await f.service.configure({enabled:true,splitChars:1000});const long='<cxx-story>'+('这是已经发生的诊所日常记录，所有人各自继续手头工作。'.repeat(120))+'</cxx-story>';await f.commit({id:'long',raw:long});await f.service.restore();const preview=await f.service.previewHistory({fromNodeId:'long',toNodeId:'long',splitChars:1000});assert.ok(preview.totalChunks>=3);await f.service.beginHistory(preview);await f.service.runHistory();assert.equal(calls.length,1);assert.equal((await f.port.listTasks(identity.runId,null))[0].nextChunk,1);
 f.service.destroy();f.service=f.open();await f.service.restore();await f.service.configure({splitChars:2000});await f.service.resumeHistory();assert.equal(calls.filter(([,chunk])=>chunk===1).length,1);assert.equal(calls.length,preview.totalChunks);assert.equal(f.service.status().history.status,'done');
});
await check('私密心声不能填成公开事实或其他人物认知；不存在编号与错误关系拒绝',async()=>{
 for(const transform of [value=>{value.records[4].cells.类别='已发生';},value=>{value.records[6].cells.人物编号='player';},value=>{value.records[7].cells.起点人物='wb_5';},value=>{value.records[5].cells.事件编号='EV_missing';}]){const proposal=output();transform(proposal);const f=await fixture({model:async()=>({text:JSON.stringify(proposal)})});await f.service.configure({enabled:true,auto:true});await f.commit({tasks:await f.scheduled()});await assert.rejects(()=>f.service.processTasks(),{code:'memory_archive_invalid'});assert.equal((await f.service.list()).rows.length,0);}
});
await check('可选召回与推进按用途调用；无效编号拒绝，准备永不归档',async()=>{
 const purposes=[];let invalid=true;const f=await fixture({model:async(purpose,messages)=>{purposes.push(String(messages?.[0]?.content||'').includes('标签修复器')?purpose+'/repair':purpose);if(purpose==='recall'){const candidates=JSON.parse(messages[1].content).candidates;return {text:JSON.stringify({ids:[invalid?'missing':candidates[0].id]})};}return {text:'<cxx_memory_direction>可以邀请对方说明车站约定，玩家仍可拒绝。</cxx_memory_direction>'};}});await f.service.configure({enabled:true,recallModel:true,advanceModel:true});await f.service.addNote('诊所里的接应人仍然等待车站会面。',{sourceType:'推测',scope:'run'});await assert.rejects(()=>f.service.recall({query:'诊所 车站'}),{code:'memory_recall_invalid'});invalid=false;const recalled=await f.service.recall({query:'诊所 车站'}),advance=await f.service.prepareAdvance({query:'问问对方',recall:recalled});assert.match(advance.text,/尚未发生/);assert.deepEqual(purposes,['recall','recall','advance/repair','advance']);assert.equal((await f.service.list()).rows.filter(r=>r.kind==='table').length,0);
});
await check('中文 BM25 命中实体，按相关性与稳定编号排序，无向量或额外请求',async()=>{const index=createBM25([{id:'b',text:'玩家在诊所交付红线纸袋'},{id:'a',text:'咖啡店的雨天'},{id:'c',text:'诊所纸袋'}]);assert.deepEqual(index.query('诊所 纸袋').map(r=>r.id),['c','b']);assert.equal(index.query('火星陨石').length,0);});
const receipt={at:new Date().toISOString(),scope:'真实维护源 parser/knowledge/六表合同；受控 State/模型结果；非真实模型或实体设备验收',checks,tableVersion:contract.tableVersion,sourceFiles:['卡片源码/长期记忆/package.cjs','卡片源码/长期记忆/knowledge.js','卡片源码/长期记忆/recall.md','卡片源码/长期记忆/advance.md','卡片源码/Gal/parser.js'],tests:checks.length};
fs.mkdirSync(new URL('../reports/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../reports/p3c-check.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
