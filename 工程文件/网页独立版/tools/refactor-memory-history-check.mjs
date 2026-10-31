/** Regressions from the native-engine audit; all models and stores are isolated fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {createTavernStatePort} from '../src/store/tavern.mjs';
import {createMemoryService} from '../src/memory/service.mjs';
import {sourceRows} from '../src/context/sources.mjs';
import {visibleStory} from '../src/context/projection.mjs';
import {helperToCanonical,worldbookSources,patchNativeBook} from '../tavern-extension/worldbook.mjs';
import {nativeBook} from '../src/app/content-settings.mjs';
const require=createRequire(import.meta.url),parser=require('../../卡片源码/Gal/parser.js');
const checks=[],check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
const binding={actorId:'player',viewpointActorId:'player'},state={terminal:{ensemble:{actors:{player:{actorId:'player',name:'旅人'},wb_4:{actorId:'wb_4',name:'高松灯'}},control:{...binding,revision:0}}}};
async function memoryFixture({raw='<cxx-story>'+('钥匙藏在口袋里，约定尚未履行。'.repeat(40))+'</cxx-story>',reply}={}){
  const identity={accountId:'audit-owner',runId:'audit-run',branchId:'main',mode:'local'},port=createMemoryStatePort({accountId:identity.accountId});let calls=0;
  await port.commit({...identity,nodeId:'n1',operationId:'op1',parentNodeId:null,expectedRevision:0,beforeState:{},stateAfter:state,message:{raw,input:{text:'等候'},attemptId:'a1',binding}});
  const service=createMemoryService({statePort:port,identity,parser,lockManager:null,requestPurpose:async(purpose,messages)=>{calls++;return reply?reply(purpose,messages,calls):{text:JSON.stringify({summary:'记'.repeat(200),overview:'仍待履约',records:[]})};}});
  await service.restore({profile:{name:'旅人'}});return {identity,port,service,get calls(){return calls;}};
}

await check('本人心声的玩家别名与卡内一致，其他人物心声仍不进入本轮历史',async()=>{
  for(const speaker of ['{{user}}','user','玩家','旅人']){
    const raw='<cxx-story>路灯亮了。<cxx-say speaker="'+speaker+'" kind="thought">我把钥匙藏在口袋里。</cxx-say><cxx-say speaker="高松灯" kind="thought">她记得另一条暗号。</cxx-say></cxx-story>',f=await memoryFixture({raw});
    assert.match(visibleStory(raw,{parser,name:'旅人'}).text,/钥匙藏在口袋/);
    const projected=f.service.projectHistory(raw,{actorId:'player',nodeId:'n1'});assert.match(projected,/钥匙藏在口袋/);assert.doesNotMatch(projected,/另一条暗号/);assert.equal(f.calls,0);
  }
});

await check('首次ST接入保留连续用户消息顺序，原生全局宏变量仍由宿主持有',async()=>{
  const rows=[{is_user:false,mes:'开场',extra:{cxx_context:{binding}}},{is_user:true,mes:'钥匙在桌上'},{is_user:true,mes:'我向门口走去'},{is_user:false,mes:'门口有脚步声',extra:{cxx_context:{binding}},variables:[{stat_data:state}]}];
  let globals={remember:'native-global'};const host={nativeScope:'fixture',read:async()=>({rows,metadata:{}}),assertScope(){},readMacroGlobals:()=>structuredClone(globals),writeMacroGlobals:value=>(globals=structuredClone(value)),captureNativeState:async({floor,swipe,fingerprint})=>({ok:true,complete:true,scope:'fixture',floor,swipe,fingerprint,root:state})};
  const port=await createTavernStatePort({host,accountId:'audit',runId:'audit',parse:text=>({display:{paragraphs:[{text}]}})}),nodes=await port.readLineage(),projected=await sourceRows({nodes,identity:{accountId:'audit',runId:'audit'}});
  assert.deepEqual(projected.map(row=>row.native.content),['开场','钥匙在桌上','我向门口走去','门口有脚步声']);assert.equal(nodes.at(-1).message.input.text,'钥匙在桌上\n\n我向门口走去');
  assert.deepEqual(await port.readMacroGlobals(),globals);await port.writeMacroGlobals({remember:'updated'});assert.equal(globals.remember,'updated');
  const legacyNodes=structuredClone(nodes);legacyNodes.at(-1).message.input={text:'我向门口走去'};const legacy={rows,metadata:{cxx2051_web:{schema:1,baseRows:rows,nodes:legacyNodes,records:{},run:{accountId:'audit',runId:'audit',headNodeId:nodes.at(-1).nodeId}}}},untouched=JSON.stringify(legacy);
  const restored=await createTavernStatePort({host:{...host,read:async()=>structuredClone(legacy)},accountId:'audit',runId:'audit',parse:text=>({display:{paragraphs:[{text}]}}),deferReconcile:true});
  assert.deepEqual((await sourceRows({nodes:await restored.readLineage(),identity:{accountId:'audit',runId:'audit'}})).map(row=>row.native.content),projected.map(row=>row.native.content));assert.equal(JSON.stringify(legacy),untouched);
});

await check('单个已有纪要可按更小目标再整理，不被错误直返挡住',async()=>{
  const f=await memoryFixture({reply:(_p,_m,n)=>({text:JSON.stringify({summary:'记'.repeat(n===1?200:50),records:[]})})});
  await f.service.compactHistory({maxInputTokens:1024,targetTokens:256});const result=await f.service.compactHistory({maxInputTokens:1024,targetTokens:64});
  assert.equal(f.calls,2);assert.equal(result.calls,1);assert.equal(result.coverage.gaps.length,0);assert.equal(result.saved.length,1);assert.equal(result.coverage.rows.find(row=>result.saved.includes(row.id)).text.length,50);
});

await check('屏蔽和校订纪要后重新整理创建新结果，原控制和原记录保留',async()=>{
  const f=await memoryFixture(),first=await f.service.compactHistory({maxInputTokens:1024,targetTokens:256}),oldId=first.saved[0];await f.service.setMode(oldId,'excluded');
  const second=await f.service.compactHistory({maxInputTokens:1024,targetTokens:256});assert.equal(second.calls,1);assert.equal(f.calls,2);assert.equal(second.coverage.gaps.length,0);assert.notEqual(second.saved[0],oldId);
  await f.service.correct(second.saved[0],'玩家校订纪要：约定仍未履行。');const third=await f.service.compactHistory({maxInputTokens:1024,targetTokens:256});assert.equal(third.calls,1);assert.equal(f.calls,3);assert.notEqual(third.saved[0],second.saved[0]);
  const records=await f.port.listRecords('memories',f.identity.runId);assert.ok(records.some(row=>row.id===oldId));assert.equal(records.find(row=>row.id==='memory-control:'+oldId).mode,'excluded');assert.match(records.find(row=>row.id==='memory-control:'+second.saved[0]).correction,/玩家校订/);
});

await check('推进默认不请求，开启后无标签普通正文也只请求一次正式推进',async()=>{
  const f=await memoryFixture({raw:'<cxx-story>旅人来到车站。</cxx-story>',reply:(_purpose,messages)=>{assert.doesNotMatch(messages[0].content,/标签修复器/);return {text:'<cxx_memory_direction>查看入口的告示。</cxx_memory_direction>'};}});
  assert.equal((await f.service.prepareAdvance({query:'查看告示'})).text,'');assert.equal(f.calls,0);await f.service.configure({enabled:true,advanceModel:true});const result=await f.service.prepareAdvance({query:'查看告示'});assert.equal(f.calls,1);assert.match(result.text,/尚未发生/);assert.equal(result.repair.status,'not-required');
});

await check('ST空正文只生成一次，详细返回中的思考和工具签名完整保留',async()=>{
  const source=fs.readFileSync(new URL('../tavern-extension/index.mjs',import.meta.url),'utf8'),start=source.indexOf('  async function generate({payload,signal,onDelta,onReasoning,onUsage,onProgress})'),end=source.indexOf(' const tokenCounter=',start),body=source.slice(start,end).trim();
  for(const reply of ['',{content:'',reasoning:'原生思考',reasoning_signature:'signature',tool_calls:[{id:'call1',type:'function',function:{name:'test',arguments:'{}'},thought_signature:'tool-signature'}]}]){
    let calls=0;const nativeGenerate=async()=>{calls++;return typeof reply==='string'?{text:reply}:{text:reply.content,reasoning:reply.reasoning,signature:reply.reasoning_signature,toolCalls:reply.tool_calls,toolSignatures:{call1:'tool-signature'}};};
    const box={nativeGenerate,crypto:webcrypto,DOMException,Error,Object,Array,Promise,Boolean,String,assertScope(){},waitForReady:async()=>{},cardGeneration(){},generationPhase:'idle',lastGenerate:null};vm.createContext(box);
    const result=await vm.runInContext('('+body+')',box)({payload:{body:{messages:[{role:'user',content:'合成请求'}]}},signal:new AbortController().signal});assert.equal(calls,1);assert.equal(result.text,'');if(reply){assert.equal(result.reasoning,'原生思考');assert.equal(result.signature,'signature');assert.equal(result.toolSignatures.call1,'tool-signature');}
  }
});

await check('Helper嵌套条目完整转换，原生保存只patch指定字段且保留未知数据',async()=>{
  const nested={uid:17,name:'触发条目',enabled:false,strategy:{type:'selective',keys:[/车站/iu],keys_secondary:{logic:'not_all',keys:['诊所']},scan_depth:7},position:{type:'outlet',role:'assistant',depth:3,order:41},content:'正文',probability:37,recursion:{prevent_incoming:true,prevent_outgoing:true,delay_until:2},effect:{sticky:3,cooldown:4,delay:5},outletName:'slot',triggers:['continue'],matchPersonaDescription:true,group:'g',groupWeight:61,extra:{owned:'keep'}};
  const row=helperToCanonical(nested);assert.equal(row.constant,false);assert.equal(row.enabled,false);assert.deepEqual(row.keys,['/车站/iu']);assert.equal(row.extensions.position,7);assert.equal(row.extensions.role,2);assert.equal(row.extensions.scan_depth,7);assert.equal(row.extensions.selectiveLogic,1);assert.equal(row.extensions.delay_until_recursion,2);assert.equal(row.extensions.outletName,'slot');assert.deepEqual(row.extra,{owned:'keep'});
  const raw={futureBook:{keep:true},entries:{17:{uid:17,content:'before',disable:false,constant:false,selective:false,position:7,depth:8,useProbability:false,probability:23,key:['车站'],keysecondary:['诊所'],futureEntry:{keep:true},extra:{other:[1,2]}},81:{uid:81,content:'untouched'}}};
  const result=patchNativeBook(raw,[{entryId:'17',content:'after',config:{enabled:false,depth:2}}]);assert.deepEqual(result,{...raw,entries:{...raw.entries,17:{...raw.entries[17],content:'after',disable:true,depth:2}}});assert.equal(raw.entries[17].content,'before');
  assert.deepEqual(worldbookSources({global:['shared','g'],chat:'shared',persona:'p',character:['shared','p','c']}).map(book=>[book.name,book.source]),[['shared','global'],['g','global'],['p','persona'],['c','character']]);
});

await check('实际宿主桥保留来源与扫描设置，保存后从后台重新读取而非误认缓存成功',async()=>{
  const source=fs.readFileSync(new URL('../tavern-extension/index.mjs',import.meta.url),'utf8'),start=source.indexOf(' const nativeWorldInfo='),end=source.indexOf(' const media=',start),body=source.slice(start,end).replace("()=>import('/scripts/world-info.js')",'async()=>nativeWorldInfoModule').replace("import('/scripts/utils.js')",'Promise.resolve(nativeUtils)');
  const disk=new Map(['g','p','c'].map(name=>[name,{futureBook:name,entries:{7:{uid:7,content:name,constant:true,key:[],keysecondary:[],unknown:{keep:true}}}}])),cache=new Map(),settings={world_info_depth:7,world_info_recursive:true};let rejectSave=false,writes=0;
  const nativeWorldInfoModule={worldInfoCache:cache,getWorldInfoSettings:()=>settings,async loadWorldInfo(name){if(!cache.has(name))cache.set(name,structuredClone(disk.get(name)));return structuredClone(cache.get(name));},async saveWorldInfo(name,value,immediately){assert.equal(immediately,true);writes++;cache.set(name,value);if(!rejectSave)disk.set(name,structuredClone(value));}};
  const hostContext={powerUserSettings:{persona_description_lorebook:'p'},characterId:3,characters:{3:{name:'显示名',avatar:'副本-角色.png'}},tagMap:{'副本-角色.png':['tag-a']}};
  const box={nativeWorldInfoModule,nativeUtils:{getCharaFilename:id=>{assert.equal(id,3);return '副本-角色';}},nativeBook,worldbookSources,patchNativeBook,clone:structuredClone,assertScope:()=>hostContext,context:()=>hostContext,helper:{getGlobalWorldbookNames:()=>['g'],getChatWorldbookName:()=>null,getCharWorldbookNames:()=>({primary:'c',additional:['g','p']})},error:(code,message)=>Object.assign(new Error(message),{code})};vm.createContext(box);
  const bridge=vm.runInContext('(function(){'+body+';return {worldbook,worldInfoSettings};})()',box),books=await bridge.worldbook.hostBooks();assert.deepEqual(Array.from(books,book=>[book.bookId,book.source]),[['g','global'],['p','persona'],['c','character']]);assert.equal(books[0].scanningSettings.world_info_depth,7);assert.equal(books[0].scanningSettings.characterId,3);assert.equal(books[0].scanningSettings.characterFilename,'副本-角色');assert.deepEqual(books[0].scanningSettings.characterTags,['tag-a']);
  await bridge.worldbook.apply({bookId:'c',patches:[{entryId:'7',content:'changed'}]});assert.equal(disk.get('c').entries[7].content,'changed');assert.deepEqual(disk.get('c').entries[7].unknown,{keep:true});
  rejectSave=true;await assert.rejects(()=>bridge.worldbook.apply({bookId:'c',patches:[{entryId:'7',content:'not-saved'}]}),{code:'worldbook_readback_mismatch'});assert.equal((await bridge.worldbook.read({bookId:'c'})).entries[0].content,'changed');assert.equal(writes,2);
});

const receipt={at:new Date().toISOString(),passed:checks.length,total:checks.length,realModelCalls:0,scope:'Actual memory/history modules and extracted native bridge functions; isolated fixtures, no player data or live host writes',checks};
fs.writeFileSync(new URL('../reports/refactor-memory-history-check.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
