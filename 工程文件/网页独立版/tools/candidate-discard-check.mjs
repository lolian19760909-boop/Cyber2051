import assert from 'node:assert/strict';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser,cardModule} from '../src/reuse/card.mjs';
const E=cardModule('数值引擎/src/engine.js'),R=cardModule('运行时/roster.js'),g=E.loadout.base();g.growth=E.growth.initialize({level:1,xp:0,attributes:{body:4,reflexes:4,intelligence:4,technical:4,cool:4},attributePoints:0,perkPoints:0},'candidate');g.numeric=E.initialNumeric(g);
const before=R.initialize({future:{keep:true},terminal:{wallet:{yen:100,earned:100,spent:0},gameplay:g}}),base=createMemoryStatePort({accountId:'candidate-check'});let failNext=true,requests=0;
const state={...base,async commit(operation){if(operation.operationId!=='seed'&&failNext){failNext=false;throw Error('合成写入失败');}return base.commit(operation);}};
const card={data:{name:'候选检查',character_version:'3.0.0',extensions:{},character_book:{entries:[]}}},preset={prompts:[{identifier:'main',role:'system',content:'继续剧情'},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'main',enabled:true},{identifier:'chatHistory',enabled:true}]}]};
const session=createWebSession({mode:'local',accountId:'candidate-check',runId:'candidate-run',ports:{state,model:{async chat(){requests++;return {text:'<cxx-story>第'+requests+'份保留的完整回复。</cxx-story>',complete:true};}}},chain:{...cardRuleChain(),parser:cardParser()},card,preset,profile:{name:'验证者'},model:{adapter:'openai-chat',model:'fixture'}});
const checks=[];
try{
 await base.commit({...session.identity,nodeId:'opening',operationId:'seed',parentNodeId:null,expectedRevision:0,stateAfter:before,message:{kind:'opening',raw:'<cxx-story>开场。</cxx-story>'}});await session.restore();
 const failed=await session.runTurn('继续');assert.equal(failed.status,'failed');assert.equal(failed.error.stage,'commit');const record=(await base.listRecords('drafts',session.identity.runId)).find(row=>row.operationId===failed.operationId);assert(record.raw.includes('完整回复'));checks.push('写入失败保留原回复与操作编号');
 await assert.rejects(()=>session.discardCandidate({...record,accountId:'another'}),error=>error.code==='account_mismatch');assert.equal((await base.readRecord('drafts',session.identity.runId,record.id)).discarded,undefined);checks.push('其他故事的候选保持其归属');
 const head=await base.readHead(session.identity.runId),discarded=await session.discardCandidate(record);assert.equal(discarded.status,'discarded');assert.equal(discarded.clearedCurrent,true);assert.deepEqual(await base.readHead(session.identity.runId),head);assert.equal((await base.readLineage(session.identity.runId)).length,1);assert.equal(session.coordinator.status,'idle');assert((await base.readRecord('drafts',session.identity.runId,record.id)).discarded);checks.push('丢弃只结束候选，已保存楼层与修订号一致');
 assert.equal((await session.runTurn('继续下一轮')).status,'committed');assert.equal(requests,2);assert(session.nodes.at(-1).message.raw.includes('第2份'));assert.deepEqual(session.currentState.future,{keep:true});checks.push('丢弃后下一回合可保存');
 failNext=true;const next=await session.runTurn('再来一轮'),operationId=next.operationId;assert.equal(next.status,'failed');assert.equal((await session.retryCommit()).status,'committed');assert.equal(requests,3);assert.equal(session.nodes.at(-1).operationId,operationId);checks.push('重试复用原候选和操作编号，正文模型调用次数保持一致');
 await assert.rejects(()=>session.discardCandidate({...record,id:operationId,operationId}),error=>error.code==='candidate_saved');assert.equal((await base.readLineage(session.identity.runId)).length,3);checks.push('已保存的回复保留正式楼层');
}finally{session.dispose();}
console.log(JSON.stringify({ok:true,checks,requests,scope:'Actual session/rules/MemoryStatePort; one-shot synthetic persistence failures, 0 provider requests'},null,2));
