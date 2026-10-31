'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../../卡片源码/运行时/context-source.js'),sample=require('../宿主样本/TT2.3.0/context-dispatcher.json');
test('pinned TT dispatcher invokes maintained bridge, mutates original rows and honors abort(true)',async()=>{
 const {createBridge}=await import('../../配套扩展/cxx-context-bridge/bridge.mjs'),events=new Map(),names=['GENERATION_AFTER_COMMANDS','MESSAGE_SENT','MESSAGE_RECEIVED','GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED','WORLDINFO_ENTRIES_LOADED','CHAT_COMPLETION_PROMPT_READY'];
 const ctx={characters:[{avatar:'tt.png'}],characterId:0,getCurrentChatId:()=> 'story',eventTypes:Object.fromEntries(names.map(n=>[n,n])),eventSource:{on:(n,f)=>events.set(n,f),removeListener:n=>events.delete(n)},setExtensionPrompt(){},stopGeneration(){}};
 const bridge=createBridge({context:()=>ctx});let fail=false;bridge.connect({scope:{character:'tt.png',chat:'story'},before:({rows})=>{if(fail)throw Error('invalid source');return {rows:rows.slice(1)};}});
 const c={console,manifests:{bridge:{loading_order:999,generate_interceptor:'handler'}},sortManifestsByOrder:(a,b)=>a.loading_order-b.loading_order,handler:bridge.intercept};vm.createContext(c);vm.runInContext(sample.code.replace('export ','')+'\nglobalThis.run=runGenerationInterceptors;',c);
 await events.get('GENERATION_AFTER_COMMANDS')('normal',{},false);const rows=[{mes:'old'},{mes:'recent'}];assert.equal(await c.run(rows,4096,'normal'),false);assert.deepEqual(rows,[{mes:'recent'}]);
 fail=true;await events.get('GENERATION_AFTER_COMMANDS')('normal',{},false);assert.equal(await c.run(rows,4096,'normal'),true);assert.deepEqual(rows,[{mes:'recent'}]);bridge.destroy();assert.equal(events.size,0);
});
test('TT cold swipes retain provenance and unknown fields while loading unannotated alternatives',async()=>{
 const original={swipes:['old','selected'],swipe_info:[{extra:{old:7}},{extra:{current:9}}]},code=fs.readFileSync(path.join(__dirname,'../宿主样本/TT2.3.0/cold-swipes.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
 const c={console,invoke:async(name)=>{if(name==='open_cold_swipe_record')return 3;throw Error(name);},createReadableFileStreamService:()=>({createChatByteStream:()=>[structuredClone(original)]}),jsonlStreamToPayload:async rows=>rows};vm.createContext(c);vm.runInContext(code+'\nglobalThis.hydrate=hydrateMessageSwipes;',c);
 const input=[{name:'actor',mes:'selected',swipe_id:1,swipes:[null,'selected'],swipe_info:[null,{extra:{current:9}}],extra:{current:9},tt_swipe_cold:{sourceId:7,record:1},variables:[{unknown:3},{unknown:4}]}];
 const p=S.plan(input),before=await S.snapshot(p.chat,{character:'tt.png',chat:'story'});assert.equal(p.chat[0].swipes[0],null);assert.equal(p.chat[0].swipe_info[0],null);
 p.chat[0].swipes[0]='edited without loaded metadata';const partial=S.plan(p.chat);assert.equal(partial.chat[0].swipe_info[0],null);assert.equal(partial.chat[0].swipes[0],'edited without loaded metadata');
 await c.hydrate(p.chat[0]);const hydrated=S.plan(p.chat),after=await S.snapshot(hydrated.chat,{character:'tt.png',chat:'story'});assert.deepEqual(before,after);assert.equal(hydrated.chat[0].swipe_info[0].extra.old,7);assert.equal(hydrated.chat[0].variables[0].unknown,3);assert(hydrated.chat[0].swipe_info[0].extra.cxx_context.variantId);assert.equal(hydrated.chat[0].tt_swipe_cold,undefined);
});
