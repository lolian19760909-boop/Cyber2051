/** U01 acceptance at session level: TurnInput -> SelectionPlan -> prompt assembly. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser,cardModule} from '../src/reuse/card.mjs';
import {buildKnowledgeIndex} from '../src/context/knowledge.mjs';

const chain={...cardRuleChain(),parser:cardParser(),operations:cardModule('运行时/player-operations.js')};
const minimal={prompts:[{identifier:'worldInfoBefore',marker:true},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'worldInfoBefore',enabled:true},{identifier:'chatHistory',enabled:true}]}]};
const card={data:{name:'U01 夹具',description:'',character_book:{entries:[{id:77,keys:['绝不会出现的触发词'],content:'U01-MANAGED-BODY',enabled:true,constant:false,selective:true,insertion_order:100,extensions:{position:0}}]}}};
const catalog=buildKnowledgeIndex([{bookId:'card',name:'U01',entries:card.data.character_book.entries}]);
const results=[];
const record=(name,ok,error)=>results.push({name,ok,...(ok?{}:{error:String(error&&error.message||error).slice(0,300)})});
const test=async(name,fn)=>{try{await fn();record(name,true);}catch(error){record(name,false,error);}};

const make=(extra={})=>createWebSession({mode:'local',accountId:'u01',runId:'u01-run',ports:{state:createMemoryStatePort(),model:{chat:async()=>({text:'<cxx-story>正文</cxx-story>'})}},chain,card,preset:minimal,catalog,...extra});

await test('会话把 TurnInput 变成 SelectionPlan，方案条目无需触发即可入手',async()=>{
 const app=make({selectionFor:()=>({managedIds:[77],selectedIds:[77]})});await app.restore();app.setAgentMode('takeover');await app.takeOverBook('card');
 const plan=await app.prepareSelection({inputText:'没有命中任何关键词'});
 assert.deepEqual(plan.managedIds,['77']);
 assert.ok(plan.selectedIds.includes('77'));
 assert.equal(plan.schema,1);
 const built=app.buildPrompt('没有命中任何关键词',{selection:plan});
 assert.ok(built.prompt.messages.map(row=>row.content).join('\n').includes('U01-MANAGED-BODY'));
 assert.equal(built.report.selection.used,1);
});
await test('关闭接管时保持原世界书触发行为，选择器零调用',async()=>{
 const app=make();await app.restore();
 const plan=await app.prepareSelection({inputText:'没有命中任何关键词'});
 assert.equal(plan.managedIds.length,0);
 assert.equal(app.agent.mode,'off');
 assert.deepEqual(plan.selectedIds,[]);
 assert.deepEqual(plan.calls,[]);
 const built=app.buildPrompt('没有命中任何关键词');
 assert.ok(!built.prompt.messages.map(row=>row.content).join('\n').includes('U01-MANAGED-BODY'));
 assert.equal(built.report.selection.used,0);
});
await test('方案越界编号在已接管目录边界过滤，有效条目仍入提示',async()=>{
 const app=make({selectionFor:()=>({managedIds:[77,999],selectedIds:[77,999]})});await app.restore();app.setAgentMode('takeover');await app.takeOverBook('card');
 const plan=await app.prepareSelection({inputText:'x'});
 const built=app.buildPrompt('x',{selection:plan});
 assert.deepEqual(plan.managedIds,['77']);
 assert.deepEqual(plan.selectedIds,['77']);
 assert.deepEqual(built.report.selection.missing,[]);
 assert.equal(built.report.selection.used,1);
 assert.ok(built.prompt.messages.map(row=>row.content).join('\n').includes('U01-MANAGED-BODY'));
});

const report={schema:1,at:new Date().toISOString(),cases:results,failed:results.filter(row=>!row.ok).length};
fs.writeFileSync('reports/u01-session-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(results,null,1));
console.log('U01S='+(report.failed?1:0));
process.exitCode=report.failed?1:0;
