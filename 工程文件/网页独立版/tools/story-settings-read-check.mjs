import assert from 'node:assert/strict';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';
const chain={...cardRuleChain(),parser:cardParser()},preset={name:'初始预设',prompts:[{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'chatHistory',enabled:true}]}]},card={data:{name:'设置读取回归',character_book:{entries:[]}}},checks=[],failures=[],observations=[];
async function setup(name){
 const accountId='settings-read',runId=name,port=createMemoryStatePort({accountId});let modelCalls=0,writes=0;
 const input={mode:'local',accountId,runId,ports:{state:port,model:{chat:async()=>{modelCalls++;throw Error('读取检查不调用模型');}}},chain,card,preset,presetId:'base'},seed=createWebSession(input);
 await port.commit({...seed.identity,nodeId:'opening',operationId:'opening',parentNodeId:null,expectedRevision:0,stateAfter:seed.rules.emptyRoot(),message:{kind:'opening',raw:'开场'}});
 await seed.restore();await seed.saveWorldbook({bookId:'private-book',name:'本故事资料',entries:[{id:7,content:'KEEP_STORY_SETTING',keys:[],constant:true,enabled:true}]});seed.setPreset({...preset,name:'保存的预设'},{id:'kept'});await seed.saveContentPreferences();seed.dispose();
 const originalRead=port.readStorySettings.bind(port),originalWrite=port.writeStorySettings.bind(port),saved=await originalRead(runId);saved.future={keep:{value:17}};await originalWrite(runId,saved);
 port.writeStorySettings=async(...args)=>{writes++;return originalWrite(...args);};return {port,input,originalRead,originalWrite,saved,read:()=>originalRead(runId),counts:()=>({writes,modelCalls})};
}
async function test(name,fn){try{await fn();checks.push(name);}catch(e){failures.push({name,error:e.message});}}
await test('短暂读取失败可重试，保存的书与预设保持',async()=>{
 const f=await setup('transient');let reads=0;f.port.readStorySettings=async(...args)=>{if(++reads===1)throw Object.assign(Error('IDB abort'),{name:'AbortError'});return f.originalRead(...args);};const app=createWebSession(f.input);
 try{let caught=false;try{await app.restore();}catch(e){caught=e.name==='AbortError';}await app.restore();await app.saveContentPreferences();const saved=await f.read();observations.push({name:'transient',caught,reads,hasBook:!!saved.books?.['private-book'],preset:saved.contentPreset?.id,...f.counts()});assert.equal(caught,true);assert.ok(saved.books?.['private-book']);assert.equal(saved.contentPreset.id,'kept');assert.deepEqual(saved.future,f.saved.future);assert.equal(f.counts().modelCalls,0);assert.ok((await app.readContent()).books.some(b=>b.bookId==='private-book'));}finally{app.dispose();}
});
await test('持续读取失败时保存停止，既有设置保持',async()=>{
 const f=await setup('persistent');f.port.readStorySettings=async()=>{throw Object.assign(Error('IDB abort'),{name:'AbortError'});};const app=createWebSession(f.input);
 try{let restoreRejected=false,saveRejected=false;try{await app.restore();}catch{restoreRejected=true;}try{await app.saveContentPreferences();}catch{saveRejected=true;}const saved=await f.read();observations.push({name:'persistent',restoreRejected,saveRejected,hasBook:!!saved.books?.['private-book'],...f.counts()});assert.equal(restoreRejected,true);assert.equal(saveRejected,true);assert.equal(f.counts().writes,0);assert.deepEqual(saved,f.saved);assert.equal(f.counts().modelCalls,0);}finally{app.dispose();}
});
await test('真正空设置正常采用默认值并可保存',async()=>{
 const f=await setup('empty');await f.originalWrite(f.input.runId,null);const app=createWebSession(f.input);try{await app.restore();await app.saveContentPreferences();assert.equal((await f.read()).contentPreset.id,'base');assert.equal(f.counts().modelCalls,0);}finally{app.dispose();}
});
await test('接管配置读取失败时停止回合，原配置保留并可重试',async()=>{
 const f=await setup('agent'),seed=createWebSession(f.input);await seed.restore();await seed.setAgentMode('takeover');await seed.takeOverBook('private-book');seed.dispose();const read=f.port.readStoryAgent.bind(f.port),write=f.port.writeStoryAgent.bind(f.port),saved=await read(f.input.runId);let reads=0,writes=0;
 f.port.readStoryAgent=async(...args)=>{if(++reads===1)throw Object.assign(Error('agent IDB abort'),{name:'AbortError'});return read(...args);};f.port.writeStoryAgent=async(...args)=>{writes++;return write(...args);};const app=createWebSession(f.input);
 try{let caught=false;try{await app.runTurn('继续游玩');}catch(e){caught=e.name==='AbortError';}const after=await read(f.input.runId);observations.push({name:'agent',caught,writes,modelCalls:f.counts().modelCalls,mode:after.mode,books:after.books.length});assert.equal(caught,true);assert.equal(writes,0);assert.equal(f.counts().modelCalls,0);assert.deepEqual(after,saved);await app.restore();assert.equal(app.agent.mode,'takeover');assert.ok(app.agent.books.includes('private-book'));}finally{app.dispose();}
});
console.log(JSON.stringify({ok:!failures.length,checks,failures,observations,scope:'实际会话与配置读写接口，隔离内存端口故障；供应商请求0'},null,2));if(failures.length)process.exitCode=1;
