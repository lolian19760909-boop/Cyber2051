import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMemoryStatePort } from '../src/store/memory.mjs';
import { createWebSession } from '../src/app/session.mjs';
import { cardRuleChain, cardParser } from '../src/reuse/card.mjs';
import { createDirectModelPort } from '../src/models/port.mjs';
const chain={...cardRuleChain(),parser:cardParser()};
const preset={prompts:[{identifier:'chatHistory',marker:true}],prompt_order:[{order:[{identifier:'chatHistory',enabled:true}]}]};
const sourceCard=JSON.parse(fs.readFileSync(new URL('../generated/card.json',import.meta.url),'utf8'));
const card={data:{name:'审查回归',character_book:{entries:sourceCard.data.character_book.entries.filter(row=>Number(row.id)===1)}}};
const records=[];
async function test(name,fn){try{await fn();records.push({name,ok:true});}catch(error){records.push({name,ok:false,error:error.stack});}}
function session(state,model,extra={}){return createWebSession({mode:'local',accountId:'r2-test',ports:{state,model},chain,preset,card,...extra});}
const body=value=>'<cxx-story>TRACE_REPLY_'+value+'</cxx-story><UpdateVariable>'+JSON.stringify([{op:'replace',path:'/terminal/wallet/yen',value},{op:'replace',path:'/terminal/wallet/earned',value}])+'</UpdateVariable>';
const before=payload=>JSON.parse(/<status_current_variable>([\s\S]*?)<\/status_current_variable>/.exec(payload.body.messages.map(row=>row.content).join('\n'))[1]);
await test('刷新后下一请求含先前输入、回复和已提交状态',async()=>{
 const state=createMemoryStatePort(),calls=[];
 const model={chat:async payload=>{calls.push(payload);return{text:body((before(payload).terminal?.wallet?.yen||0)+100)};}};
 const first=session(state,model);assert.equal((await first.runTurn('TRACE_INPUT_ONE')).status,'committed');
 const reopened=session(state,model);assert.equal((await reopened.runTurn('TRACE_INPUT_TWO')).status,'committed');
 assert.ok(JSON.stringify(calls[1]).includes('TRACE_INPUT_ONE'));assert.ok(JSON.stringify(calls[1]).includes('TRACE_REPLY_100'));
 assert.equal(before(calls[1]).terminal.wallet.yen,100);
});
await test('重抽共享父状态、原路线可切回，检查点开新路线',async()=>{
 const state=createMemoryStatePort(),calls=[];
 const model={chat:async payload=>{calls.push(payload);return{text:body((before(payload).terminal?.wallet?.yen||0)+100)};}};
 const app=session(state,model);await app.runTurn('ONE');
 const first=await state.readHead(app.identity.runId),point=await app.createCheckpoint('第一轮');
 await app.runTurn('TWO');const original=await state.readHead(app.identity.runId);
 await app.regenerate();const reroll=await state.readHead(app.identity.runId),node=await state.readNode(app.identity.runId,reroll.headNodeId);
 assert.notEqual(reroll.branchId,original.branchId);assert.equal(node.parentId,first.headNodeId);assert.equal(before(calls[2]).terminal.wallet.yen,100);assert.equal(app.currentState.terminal.wallet.yen,200);
 await app.selectBranch(original.branchId);assert.equal((await state.readHead(app.identity.runId)).headNodeId,original.headNodeId);
 await app.restoreCheckpoint(point.checkpointId);assert.equal(app.currentState.terminal.wallet.yen,100);assert.notEqual(app.identity.branchId,original.branchId);
});
await test('畸形与空正文拒绝，合法无状态改变允许',async()=>{
 for(const text of ['<cxx-story>坏提议</cxx-story><UpdateVariable>{BAD}</UpdateVariable>','']){
  const state=createMemoryStatePort(),app=session(state,{chat:async()=>({text})});
  assert.equal((await app.runTurn('TEST')).status,'failed');assert.equal((await state.readHead(app.identity.runId)).revision,0);
 }
 const state=createMemoryStatePort(),app=session(state,{chat:async()=>({text:'<cxx-story>合法无结算</cxx-story>'})});
 assert.equal((await app.runTurn('TEST')).status,'committed');
});
await test('忽略 AbortSignal 的迟到上游仍不能提交；同时发起第二轮被拒',async()=>{
 const state=createMemoryStatePort();let release;
 const wait=new Promise(resolve=>{release=resolve;});
 const app=session(state,{chat:async()=>{await wait;return{text:body(100)};}});
 const controller=new AbortController(),pending=app.runTurn('ONE',{signal:controller.signal});
 await assert.rejects(app.runTurn('TWO'),error=>error.code==='turn_busy');
 controller.abort();release();
 assert.equal((await pending).status,'interrupted');assert.equal((await state.readHead(app.identity.runId)).revision,0);
});
await test('保存失败重试保留 operationId，模型只调用一次',async()=>{
 const state=createMemoryStatePort(),commit=state.commit;let failures=1,calls=0;
 state.commit=async operation=>{if(failures--)throw new Error('测试写盘失败');return commit(operation);};
 const app=session(state,{chat:async()=>{calls++;return{text:body(100)};}});
 const result=await app.runTurn('ONE');assert.equal(result.status,'failed');const id=app.coordinator.snapshot().operationId;
 const retry=await app.retryCommit();assert.equal(retry.status,'committed');assert.equal(retry.operationId,id);assert.equal(calls,1);
});
await test('33 回合跨快照恢复历史状态，非快照节点只保存增量',async()=>{
 const state=createMemoryStatePort(),app=session(state,{chat:async payload=>({text:body((before(payload).terminal?.wallet?.yen||0)+100)})});
 let early;
 for(let i=0;i<33;i++){assert.equal((await app.runTurn('TURN_'+i)).status,'committed');if(i===1)early=await state.readHead(app.identity.runId);}
 const nodes=await state.readLineage(app.identity.runId);
 assert.equal(nodes.filter(node=>node.snapshot!==undefined).length,2);assert.equal((await state.readNodeState(app.identity.runId,early.headNodeId)).terminal.wallet.yen,200);
});
await test('真实传输解码保留半截流并标记未完整',async()=>{
 const state=createMemoryStatePort(),model=createDirectModelPort({fetchImpl:async()=>new Response('data: '+JSON.stringify({choices:[{delta:{content:'<cxx-story>完整正文但流被截断</cxx-story>'}}]})+'\n\n',{headers:{'content-type':'text/event-stream'}})});
 const app=session(state,model,{model:{baseUrl:'https://fixture.test/v1',adapter:'openai-chat'}});
 assert.equal((await app.runTurn('TEST')).status,'committed');
 const head=await state.readHead(app.identity.runId),node=await state.readNode(app.identity.runId,head.headNodeId);
 assert.equal(head.revision,1);assert.equal(node.message.complete,false);assert.equal(node.message.completion,'stream_closed');assert.ok(node.message.raw.includes('完整正文但流被截断'));
});
await test('身份不匹配的创建与现有存档读取被拒',async()=>{
 const state=createMemoryStatePort({accountId:'alice'});
 await assert.rejects(state.commit({runId:'x',branchId:'main',operationId:'x',nodeId:'x',accountId:'bob',expectedRevision:0,stateAfter:{}}),error=>error.code==='account_mismatch');
});
const report={at:new Date().toISOString(),scope:'真实共享核心＋合成模型＋内存状态；非真实模型或浏览器验收',passed:records.filter(row=>row.ok).length,total:records.length,records};
fs.writeFileSync(new URL('../reports/r2-core-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
for(const record of records)console.log((record.ok?'PASS ':'FAIL ')+record.name+(record.error?'\n'+record.error:''));
if(report.passed!==report.total)process.exitCode=1;
