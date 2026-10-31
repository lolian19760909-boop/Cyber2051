/** Opening through the actual DeepSeek decoder, session, parser and state port. */
import assert from 'node:assert/strict';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {createDirectModelPort} from '../src/models/port.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';
import {pendingOpening} from '../src/app/opening.mjs';
const chain={...cardRuleChain(),parser:cardParser()},card={data:{name:'开局回归',character_book:{entries:[]}}},preset={prompts:[{identifier:'chatHistory',marker:true}],prompt_order:[{order:[{identifier:'chatHistory',enabled:true}]}]};
let raw='<think>这段只有思考，没有正文。</think>',calls=0;
const port=createMemoryStatePort({accountId:'opening-response'}),model=createDirectModelPort({fetchImpl:async()=>{calls++;return new Response('data: '+JSON.stringify({choices:[{delta:{content:raw},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});}});
const session=createWebSession({mode:'local',accountId:'opening-response',runId:'opening-response',ports:{state:port,model},chain,card,preset,model:{adapter:'chat:deepseek',model:'deepseek-chat',baseUrl:'https://api.deepseek.com'}});
await port.commit({accountId:'opening-response',runId:session.identity.runId,branchId:'main',nodeId:'opening',operationId:'create-opening',parentNodeId:null,expectedRevision:0,stateAfter:session.rules.emptyRoot(),message:{kind:'opening',raw:'作者开场',openingAction:'开始故事'}});
await session.restore();assert.equal((await pendingOpening({nodes:session.nodes})).text,'开始故事');
const first=await session.runTurn('开始故事');assert.equal(first.error?.code,'empty_response');
const failed=(await port.listRecords('drafts',session.identity.runId)).find(row=>row.operationId===first.operationId);
assert.equal(failed.raw,raw,'failed opening retains the original reply');
assert.equal(failed.phase,'failed','failed opening persists its actual phase');
assert.equal(failed.error?.code,'empty_response','failed opening records the cause alongside raw');
assert.equal((await pendingOpening({nodes:session.nodes})).text,'开始故事','failed reply does not finish opening');
raw='<think>已完成规划。</think>\n<cxx-story>东京的雨还没有停。\n\n祥子：「终于来了。」</cxx-story>';
const retry=await session.runTurn('开始故事');assert.equal(retry.status,'committed',JSON.stringify(retry.error));assert.equal(session.nodes.at(-1).message.raw,raw);assert.equal(calls,2);
assert.equal(await pendingOpening({nodes:session.nodes}),null,'saved first body is the opening completion authority');
console.log('PASS DeepSeek 流→开局判空候选原文与错误保存→重试正常正文解析提交（合成回复，非作者失败原文）');

async function createOpening(name,model){
 const port=createMemoryStatePort({accountId:name}),session=createWebSession({mode:'local',accountId:name,runId:name,ports:{state:port,model},chain,card,preset});
 await port.commit({accountId:name,runId:name,branchId:'main',nodeId:'opening',operationId:'create-opening',parentNodeId:null,expectedRevision:0,stateAfter:session.rules.emptyRoot(),message:{kind:'opening',raw:'作者开场',openingAction:'开始故事'}});await session.restore();return {port,session};
}
{
 let enter,release,calls=0;const entered=new Promise(resolve=>enter=resolve),waiting=new Promise(resolve=>release=resolve);
 const {port,session}=await createOpening('opening-cancel',{chat:async(_payload,{onDelta})=>{calls++;if(calls===1){onDelta('尚未完成的回复');enter();await waiting;return {text:'尚未完成的回复'};}return {text:'取消后重新开始的正式正文。'};}});
 const first=session.runTurn('开始故事');await entered;session.cancel();release();assert.equal((await first).status,'interrupted');assert.equal((await port.readLineage(session.identity.runId)).length,1);assert.ok(await pendingOpening({nodes:session.nodes}));
 assert.equal((await session.runTurn('开始故事')).status,'committed');assert.equal(calls,2);assert.equal(await pendingOpening({nodes:session.nodes}),null);
 console.log('PASS 取消不写成正式开场，之后可重新生成并保存');
}
{
 let calls=0,failed=false;const {port,session}=await createOpening('opening-save',{chat:async()=>{calls++;return {text:'已生成但首次写入失败的正文。'};}}),commit=port.commit;
 port.commit=async operation=>{if(!failed){failed=true;throw Error('合成保存失败');}return commit(operation);};
 const first=await session.runTurn('开始故事');assert.equal(first.error.stage,'commit');const operationId=first.operationId,nodeId=first.nodeId,candidate=(await port.listRecords('drafts',session.identity.runId)).find(row=>row.id===operationId);
 assert.equal(candidate.raw,'已生成但首次写入失败的正文。');assert.equal(candidate.phase,'failed');assert.equal(candidate.error.stage,'commit');
 const saved=await session.retryCommit();assert.equal(saved.status,'committed');assert.equal(saved.operationId,operationId);assert.equal(saved.nodeId,nodeId);assert.equal(calls,1);assert.equal(await pendingOpening({nodes:session.nodes}),null);
 console.log('PASS 保存重试复用原候选、原操作和节点，不再次调用模型');
}
