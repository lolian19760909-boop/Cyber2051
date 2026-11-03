/** Read-only source audit cases. Every storage mutation stays inside these in-memory hosts. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'../../..');
const mod=file=>import(pathToFileURL(path.join(root,file)).href);
const {createTavernStatePort,nativeFingerprint,projectTavernRows}=await mod('工程文件/网页独立版/src/store/tavern.mjs');
const {parseReply}=await mod('工程文件/网页独立版/src/app/parse.mjs');
const {createTurnCoordinator}=await mod('工程文件/网页独立版/src/app/turn.mjs');
const {createMemoryStatePort}=await mod('工程文件/网页独立版/src/store/memory.mjs');
const {nativeSettlement}=await mod('工程文件/网页独立版/src/store/native-receipt.mjs');
const {reconcileNative}=await mod('工程文件/网页独立版/src/store/native-source.mjs');
const require=createRequire(path.join(root,'package.json'));
const parser=require(path.join(root,'工程文件/卡片源码/Gal/parser.js'));
const results={};

{
 const {loadTokenizer}=await mod('工程文件/网页独立版/src/models/tokenizers.mjs');
 let loads=0,first=true;
 const loadAsset=async url=>{loads++;if(first){first=false;throw Error('single wasm read failure');}return fs.promises.readFile(url);};
 const attempts=[];for(let i=0;i<2;i++)try{const encode=await loadTokenizer('gpt-4o',{loadAsset});attempts.push({attempt:i+1,loads,encoded:encode('你好').length});}catch(error){attempts.push({attempt:i+1,loads,error:error.message});}
 results.tokenizerRetry={attempts,recovered:Number.isInteger(attempts[1].encoded)};
}

{
 const {createMemoryService}=await mod('工程文件/网页独立版/src/memory/service.mjs');
 const {buildMemorySources}=await mod('工程文件/网页独立版/src/memory/source.mjs');
 const identity={mode:'local',accountId:'a',runId:'r',branchId:'b'},port=createMemoryStatePort({accountId:'a'}),raw='<cxx-story>这是一段已经提交的完整剧情正文，里面记录着当天发生的事件。</cxx-story>';
 await port.commit({...identity,operationId:'op',nodeId:'n',expectedRevision:0,parentNodeId:null,beforeState:{},stateAfter:{terminal:{}},message:{raw,binding:{viewpointActorId:'player'}}});
 const sources=await buildMemorySources({nodes:await port.readLineage('r'),identity,parser}),source={...sources[0].source,quote:sources[0].plain.slice(0,16)};
 await port.putRecords('tasks','r',[{taskId:'t',kind:'memory-archive',status:'pending',source,sourceNodeId:'n'}]);
 let reads=0;const list=port.listRecords;port.listRecords=async(...args)=>{if(args[0]==='memories'&&++reads===2)throw Object.assign(Error('temporary storage read failure'),{code:'transient_read'});return list(...args);};
 let modelCalls=0;const service=createMemoryService({statePort:port,parser,identity,requestPurpose:async()=>{modelCalls++;throw Error('model boundary reached');}});
 let initialError=null;try{await service.processTasks({force:true});}catch(error){initialError=error.code||error.message;}
 const first=(await port.listTasks('r',null))[0];try{await service.retryTask('t');}catch{}
 const retry=(await port.listTasks('r',null))[0];results.memoryTransientRead={firstStatus:first.status,initialError,recordedError:first.error,retryStatus:retry.status,reads,modelCalls,retryable:first.status!=='obsolete'&&modelCalls>0};service.destroy();
}

{
 const {installOrRepair,TEMPLATE_VERSION}=await mod('工程文件/网页独立版/src/context/templates.mjs');
 const stored={templateVersion:TEMPLATE_VERSION,skillPrompt:'读取目录，返回条目编号列表。保留作者格式。',segmentRules:'按主题拆段。',mergeRules:'合并同义条目。',manualPatch:'保留手工更改。'};
 const official={skillPrompt:'官方提示：uid 必须原样回填',segmentRules:'官方拆段',mergeRules:'官方合并',manualPatch:'官方补丁'},next=installOrRepair({stored,official});
 results.templateCustomization={action:next.action,signature:next.signature,authorTextRetained:stored.skillPrompt===next.prompt.skillPrompt};
}

// The host acknowledges an already-persisted write with an error, then one fresh read fails.
// Native bridge index.mjs updates its baselines before awaiting cxx2051_web_committed listeners.
// This host models that post-persistence error and the following transient host-read failure.
{
 let reads=0,writes=0,failRead=false;
 const row={is_user:false,is_system:false,mes:'body',variables:[{stat_data:{terminal:{wallet:{balance:10}}}}]};
 const document={schema:1,baseRows:[row],nodes:[{runId:'r',nodeId:'n',parentId:null,branchId:'b',snapshot:{terminal:{wallet:{balance:10}}},native:true,nativeFloor:0,message:{raw:'body'}}],receipts:[],branches:[{runId:'r',branchId:'b',headNodeId:'n'}],checkpoints:[],records:{},run:{runId:'r',accountId:'a',revision:1,headNodeId:'n',branchId:'b'},storySettings:{version:'old'}};
 let disk={rows:[row],metadata:{cxx2051_web:structuredClone(document)}};
 const host={assertScope(){},async read(){reads++;if(failRead){failRead=false;throw Error('read unavailable');}return structuredClone(disk);},async write({rows,document}){writes++;disk={rows:structuredClone(rows),metadata:{cxx2051_web:structuredClone(document)}};if(writes===1)throw Error('post-persistence notification failed');}};
 const port=await createTavernStatePort({host,runId:'r',accountId:'a',parse:()=>({display:{}}),deferReconcile:true});
 try{await port.writeStorySettings('r',{version:'new'});}catch{}
 const afterFirstWrite=disk.metadata.cxx2051_web.storySettings.version;
 failRead=true;try{await port.readHead('r');}catch{}
 await port.putRecords('drafts','r',[{id:'draft'}]);
 results.staleRead={afterFirstWrite,reads,writes,finalDiskSettings:disk.metadata.cxx2051_web.storySettings,retained:disk.metadata.cxx2051_web.storySettings.version==='new'};
 await port.close();
}

// Real parser and turn coordinator; settlement is a spy so this case isolates parser ownership.
{
 const raw='<cxx-story>正文继续。</cxx-story><ztl>{broken}</ztl><UpdateVariable><JSONPatch>[{"op":"replace","path":"/terminal/wallet/yen","value":20}]</JSONPatch></UpdateVariable>';
 const parsed=parseReply(raw,{parser});
 let received;
 const state=createMemoryStatePort({accountId:'a'}),rules={emptyRoot:()=>({terminal:{wallet:{yen:10}}}),settle({before,patches}){received=patches;return {state:before,patches,ignored:[]};}};
 const turn=createTurnCoordinator({ports:{state,model:{chat:async()=>({text:raw})}},rules,identity:{mode:'local',accountId:'a',runId:'r',branchId:'b'},parser});
 await turn.begin({inputText:'继续'});await turn.generate({});await turn.validate();
 results.sceneDiagnostic={decodedPatchCount:parsed.protocol.patches.length,protocolIssues:parsed.protocol.issues,status:turn.status,patchesPassedToSettlement:received,preserved:received.length===1};
 const before={terminal:{wallet:{yen:10}}},old={is_user:false,is_system:false,mes:'旧正文',variables:[{stat_data:before}]};
 const document={schema:1,baseRows:[old],nodes:[{runId:'r',nodeId:'n',parentId:null,branchId:'b',snapshot:before,native:true,nativeFloor:0,message:{raw:'旧正文'}}],receipts:[],branches:[{runId:'r',branchId:'b',headNodeId:'n'}],checkpoints:[],records:{},run:{runId:'r',accountId:'a',revision:1,headNodeId:'n',branchId:'b'}};
 let reconcileResult;
 try{const next=await reconcileNative({document,actual:[{...old,mes:raw}],projected:[old],projectRows:()=>[old],parse:raw=>parseReply(raw,{parser}),rules:{emptyRoot:()=>before,settle:({before,patches})=>({state:before,patches})},fingerprint:nativeFingerprint,accountId:'a',runId:'r'});reconcileResult=next?'accepted':'unchanged';}catch(e){reconcileResult=e.code||e.message;}
 results.nativeSceneDiagnostic={status:reconcileResult,accepted:reconcileResult==='accepted'};
}

// Reuse the existing fixture through the shared fixture loader.
// The fixture provides real MVU/schema/applier/numeric modules and an in-memory native save host.
{
 const {fixture}=require(path.join(root,'工程文件/测试/lib/fixture-loader.cjs'))('../当前/native-state-persistence.test.cjs',['fixture']);
 {
  const f=fixture({projection:false}),service=f.create(),before=service.localState();service.destroy();
  const {cardRuleChain}=await mod('工程文件/网页独立版/src/reuse/card.mjs'),{createRulesEngine}=await mod('工程文件/网页独立版/src/rules/engine.mjs');
  const patches=[{op:'add',path:'/terminal/gameplay/numericInput',value:[{id:'player_scratch',kind:'resource',resource:'hp',amount:-2,reason:'主角擦伤'}]},{op:'add',path:'/terminal/ensemble/actors/wb_8/gameplay/numericInput',value:[{id:'taki_scratch',kind:'resource',resource:'hp',amount:-3,reason:'立希擦伤'}]}];
  const raw='<cxx-story>主角与立希分别擦伤，处理后继续赶路。</cxx-story><ztl>{broken}</ztl><UpdateVariable><JSONPatch>'+JSON.stringify(patches)+'</JSONPatch></UpdateVariable>';
  const rules=createRulesEngine({chain:cardRuleChain(),policy:ctx=>({numericOptions:{rawStory:ctx.raw,storyText:'主角与立希分别擦伤，处理后继续赶路。',source:{floor:1,swipe:0,messageId:ctx.nodeId}}})});
  const turn=createTurnCoordinator({ports:{state:createMemoryStatePort({accountId:'a'}),model:{chat:async()=>({text:raw})}},rules,identity:{mode:'local',accountId:'a',runId:'r',branchId:'b'},parser});
  await turn.begin({inputText:'继续',beforeState:before});await turn.generate({});await turn.validate();
  const after=turn.context.proposal?.state;
  results.sceneNumeric={status:turn.status,error:turn.lastError,playerBefore:before.terminal.gameplay.numeric.vitals.hp,playerAfter:after?.terminal.gameplay.numeric.vitals.hp,npcBefore:before.terminal.ensemble.actors.wb_8.gameplay.numeric.vitals.hp,npcAfter:after?.terminal.ensemble.actors.wb_8.gameplay.numeric.vitals.hp};
 }
 {
  const f=fixture({projection:false}),service=f.create(),before=service.localState(),old=structuredClone(f.c.chat[0]);
  try{
   const raw='<cxx-story>原生正文已完成，变量JSON出现语法问题。</cxx-story><UpdateVariable><JSONPatch>[broken]</JSONPatch></UpdateVariable>',floor=f.append(0);f.c.chat[floor].mes=raw;await f.c.saveChat();
   const settled=await service.settle(floor),actual=f.disk(),document={schema:1,baseRows:[old],nodes:[{runId:'r',nodeId:'n',parentId:null,branchId:'b',snapshot:before,native:true,nativeFloor:0,message:{raw:old.mes}}],receipts:[],branches:[{runId:'r',branchId:'b',headNodeId:'n'}],checkpoints:[],records:{},run:{runId:'r',accountId:'a',revision:1,headNodeId:'n',branchId:'b'}};let reconnect;
   try{const next=await reconcileNative({document,actual,projected:[old],projectRows:next=>projectTavernRows(next,{}),parse:raw=>parseReply(raw,{parser}),rules:{},fingerprint:nativeFingerprint,nativeScope:JSON.stringify(['native.png','story']),accountId:'a',runId:'r'});reconnect=next?'accepted':'unchanged';}catch(e){reconnect=e.code||e.message;}
   results.nativeBadVariable={settlement:settled.status,rawSaved:settled.rawSaved,hasFullOwnReceipt:!!actual[floor].variables[0].__cxx_native_commit,receiptPatches:actual[floor].variables[0].__cxx_native_commit?.patches,reconnect,parentKept:JSON.stringify(actual[floor].variables[0].stat_data)===JSON.stringify(before)};
  }finally{service.destroy();}
 }
 results.nativeSkipped=[];
 const variants=[
  ['no-variable-block','<cxx-story>雨停了，你在店里等候。</cxx-story>'],
  ['empty-array','<cxx-story>雨停了，你在店里等候。</cxx-story><UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>'],
  ['display-block-only','<ztl>{"date":"2051-01-01","time":"12:00","location":{"name":"店内"},"characters":[]}</ztl>'],
 ];
 for(const [variant,raw] of variants){
  const f=fixture({projection:false}),service=f.create();
  try{
   const before=structuredClone(service.localState()),floor=f.append(0);f.c.chat[floor].mes=raw;
   await f.c.saveChat();
   const result=await service.settle(floor),saved=f.disk()[floor];let reconnect;
   try{nativeSettlement(saved,{scope:JSON.stringify(['native.png','story']),floor,raw,fingerprint:nativeFingerprint,before});reconnect='accepted';}catch(e){reconnect=e.code;}
   results.nativeSkipped.push({variant,status:result.status,ownReceipt:!!saved.variables[0].__cxx_native_commit,reconnect,fullStateEqual:JSON.stringify(saved.variables[0].stat_data)===JSON.stringify(before),counts:f.counts()});
  }finally{service.destroy();}
 }
 {
  const f=fixture({projection:false});f.c.chat.splice(0,f.c.chat.length,{mes:'<cxx-story>空开局只留原文。</cxx-story>',swipe_id:0,variables:[{}]});const service=f.create();
  try{await f.c.saveChat();const result=await service.settle(0);results.emptyOpening={status:result.status,ownReceipt:!!f.disk()[0].variables[0].__cxx_native_commit};}finally{service.destroy();}
 }
}

// The compatibility path uses the real pinned MVU executor through the maintained feedback fixture.
{
 const {fixture}=require(path.join(root,'工程文件/测试/lib/fixture-loader.cjs'))('../当前/variable-feedback.test.cjs',['fixture']);
 results.compatibilityMvu=[];
 for(const [variant,block] of [['no-variable-block',''],['empty-array','<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>'],['bad-json','<UpdateVariable><JSONPatch>[broken]</JSONPatch></UpdateVariable>']]){
  const f=fixture(block),c=f.api.SillyTavern.getContext(),before=structuredClone(f.data.stat_data);c.chatMetadata={cxx2051_web:{schema:1,run:{runId:'r'}}};let saves=0,disk;c.saveChat=async()=>{saves++;disk=structuredClone(c.chat);};
  try{await f.run();const saved=disk?.at(-1)?.variables?.[0];results.compatibilityMvu.push({variant,saves,phase:f.guard.state().receipt?.phase,ownReceipt:!!saved?.__cxx_native_commit,captured:f.guard.captureNativeState({floor:1}).ok,parentKept:JSON.stringify(saved?.stat_data)===JSON.stringify(before),savedMatchesExecutor:JSON.stringify(saved?.stat_data)===JSON.stringify(f.data.stat_data),patchCount:saved?.__cxx_native_commit?.patches?.length,error:f.guard.state().lastError});}finally{f.guard.destroy();}
 }
}

console.log(JSON.stringify(results,null,2));
{
 assert.equal(results.tokenizerRetry.recovered,true,'failed tiktoken initialization must retry when the asset becomes readable');
 assert.equal(results.memoryTransientRead.retryable,true,'temporary storage reads must retain archive task retry');
 assert.equal(results.templateCustomization.authorTextRetained,true,'custom author phrasing must retain its text');
 assert.equal(results.staleRead.retained,true,'failed refresh must keep stale until successful adoption');
 assert.equal(results.sceneDiagnostic.preserved,true,'scene diagnostics must retain independent variable patches');
 assert.equal(results.nativeSceneDiagnostic.accepted,true,'scene diagnostic must retain the native edited story');
 assert.equal(results.sceneNumeric.playerAfter,results.sceneNumeric.playerBefore-2,'bad scene keeps readable player resource changes');
 assert.equal(results.sceneNumeric.npcAfter,results.sceneNumeric.npcBefore-3,'bad scene keeps readable NPC resource changes');
 assert.equal(results.nativeBadVariable.reconnect,'accepted','native bad variable JSON with a saved full zero-delta receipt must reconnect');
 assert.equal(results.nativeBadVariable.parentKept,true,'bad variable JSON keeps full native parent state');
 assert.equal(results.emptyOpening.ownReceipt,false,'an empty opening must keep its original absence of full state');
 for(const row of results.compatibilityMvu){assert.equal(row.ownReceipt,true,row.variant+' compatibility MVU needs a full-floor receipt');if(row.variant!=='empty-array')assert.equal(row.parentKept,true,row.variant+' compatibility MVU keeps full parent state');else assert.equal(row.savedMatchesExecutor,true,'empty-array compatibility MVU persists its actual executor result');}
 for(const row of results.nativeSkipped){assert.equal(row.ownReceipt,true,row.variant+' needs its own full-floor receipt');assert.equal(row.reconnect,'accepted',row.variant+' must reconnect');assert.equal(row.fullStateEqual,true,row.variant+' must inherit the complete unchanged parent');}
}
