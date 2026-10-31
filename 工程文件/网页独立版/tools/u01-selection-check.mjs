/** U01 acceptance: selection layer, worldbook placement, protected entries, retry reuse. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {activateWorldInfo} from '../src/app/worldinfo.mjs';
import {assemblePrompt,createVarStore} from '../src/app/prompt.mjs';
import {normalizePlan,selectionSets,createSelectionAgent} from '../src/context/agent.mjs';
import {createTurnCoordinator} from '../src/app/turn.mjs';

const results=[];
const record=(name,ok,error)=>results.push({name,ok,...(ok?{}:{error:String(error&&error.message||error).slice(0,300)})});
const check=(name,fn)=>{try{fn();record(name,true);}catch(error){record(name,false,error);}};
const acheck=async(name,fn)=>{try{await fn();record(name,true);}catch(error){record(name,false,error);}};

const entry=(id,fields={})=>({id,keys:[],secondary_keys:[],content:'',enabled:true,constant:false,selective:true,insertion_order:100,extensions:{position:0,...(fields.extensions||{})},...fields});
const entries=[
  entry(1,{comment:'常驻规则',constant:true,content:'R-ALWAYS'}),
  entry(2,{comment:'触发条目',keys:['火星'],content:'E-TRIGGER'}),
  entry(3,{comment:'被选条目',keys:['不会命中甲'],content:'E-SELECTED'}),
  entry(4,{comment:'深度条目',keys:['不会命中乙'],content:'E-DEPTH',extensions:{position:4,depth:2,role:0}}),
  entry(5,{comment:'保护条目',keys:['不会命中丙'],content:'P-'+'长'.repeat(400)}),
];
const call=(selection,budgetChars=100000,scan='火星',extra={})=>activateWorldInfo({entries,scan,history:[{role:'user',content:scan}],budgetChars,budgetTokens:Infinity,countTokens:text=>text.length,context:{},generationType:'normal',selection,...extra});
const idsOf=info=>info.used.map(row=>row.id).sort((a,b)=>a-b);

check('未给方案时按原触发工作',()=>{
  const info=call(null);
  assert.deepEqual(idsOf(info),[1,2]);
  assert.equal(info.selection.managed,0);
});
check('方案内条目无需触发即可入选，方案外条目仍按原触发',()=>{
  const plan=normalizePlan({managedIds:[3,4],selectedIds:[3],requiredIds:[4]});
  const info=call(plan);
  assert.deepEqual(idsOf(info),[1,2,3,4]);
  assert.equal(info.selection.used,2);
});
check('方案内未选未保护的条目退出',()=>{
  const plan=normalizePlan({managedIds:[3,5],selectedIds:[3]});
  assert.deepEqual(idsOf(call(plan)),[1,2,3]);
});
check('removedIds 主动退出覆盖触发',()=>{
  const plan=normalizePlan({managedIds:[2],removedIds:[2]});
  assert.deepEqual(idsOf(call(plan)),[1]);
});
check('保护条目不被预算挤掉，普通条目照旧被挤掉',()=>{
  const plan=normalizePlan({managedIds:[5],requiredIds:[5]});
  const info=call(plan,50);
  assert.deepEqual(idsOf(info),[1,2,5]);
  assert.ok(info.dropped.every(row=>row.id!==5));
});
check('placements 覆盖原位置：before／after／depth 三种都正确装配',()=>{
  const plan=normalizePlan({managedIds:[3,4],selectedIds:[3,4],placements:[{entryId:3,position:0},{entryId:4,position:4,depth:2,role:0}]});
  const info=call(plan);
  assert.ok(info.before.includes('E-SELECTED'));
  assert.ok(!info.after.includes('E-SELECTED'));
  assert.equal(info.injections.length,1);
  assert.equal(info.injections[0].depth,2);
  assert.equal(info.injections[0].role,'system');
  assert.ok(info.injections[0].content.includes('E-DEPTH'));
});
check('同一资料换位置改的是装配槽位，不拼成一条 system',()=>{
  const mk=(place)=>call(normalizePlan({managedIds:[3],selectedIds:[3],placements:[place]}));
  const before=mk({entryId:3,position:0}),after=mk({entryId:3,position:1}),deep=mk({entryId:3,position:4,depth:1,role:0});
  assert.ok(before.before.includes('E-SELECTED')&&!before.after.includes('E-SELECTED'));
  assert.ok(after.after.includes('E-SELECTED')&&!after.before.includes('E-SELECTED'));
  const preset={prompts:[{identifier:'main',content:'SYS'},{identifier:'worldInfoBefore',marker:true},{identifier:'chatHistory',marker:true},{identifier:'worldInfoAfter',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'main',enabled:true},{identifier:'worldInfoBefore',enabled:true},{identifier:'chatHistory',enabled:true},{identifier:'worldInfoAfter',enabled:true}]}]};
  const build=info=>assemblePrompt({preset,supplies:{worldInfoBefore:info.before,worldInfoAfter:info.after},expandedSupplies:['worldInfoBefore','worldInfoAfter'],history:[{role:'user',content:'打招呼'}],injections:info.injections,vars:createVarStore(),toggles:{}});
  const slotBefore=build(before).messages,b=s=>s.filter(m=>m.content.includes('E-SELECTED'));
  assert.equal(b(slotBefore).length,1);
  assert.ok(b(slotBefore)[0].content.includes('E-SELECTED')&&!b(slotBefore)[0].content.includes('E-DEPTH'));
  const deepMsgs=build(deep).messages,injected=deepMsgs.filter(m=>m.injected===true&&m.content.includes('E-SELECTED'));
  assert.equal(injected.length,1);
  assert.ok(!deepMsgs.at(-1).injected,'深度注入没有落在历史之外');
});
check('同一方案重复准备结果一致（纯计算、不依赖随机）',()=>{
  const plan=normalizePlan({managedIds:[3],selectedIds:[3]});
  assert.deepEqual(call(plan),call(plan));
});
check('方案 id 归一：只留受管范围、去重、保护与选中互斥',()=>{
  const missing=[];const plan=normalizePlan({managedIds:[3,3,'4'],selectedIds:[3,4],requiredIds:[4],removedIds:[9]},{missing});
  assert.deepEqual(plan.managedIds,['3','4']);
  assert.deepEqual(plan.selectedIds,['3']);
  assert.deepEqual(plan.requiredIds,['4']);
  assert.deepEqual(plan.removedIds,[]);
  assert.equal(missing.length,1);
});
await acheck('选择代理无方案时交回空计划并标记待选',async()=>{
  const plan=await createSelectionAgent({}).prepare({request:{attemptId:'a1'}});
  assert.equal(plan.managedIds.length,0);
  assert.equal(plan.inputRef,'a1');
  assert.ok(plan.calls.some(row=>row.stage==='catalog'&&row.purpose==='selection-pending'));
});
await acheck('选择代理接受注入方案并沿用本轮 attemptId',async()=>{
  const plan=await createSelectionAgent({planFor:()=>({managedIds:[3],selectedIds:[3]})}).prepare({request:{attemptId:'a2'}});
  assert.deepEqual(plan.managedIds,['3']);
  assert.equal(plan.inputRef,'a2');
  assert.equal(plan.calls.length,0);
});
const drafts=[];
const ports={state:{readHead:async()=>({revision:0,headNodeId:null}),readNodeState:async()=>null,readState:async()=>({data:null}),putRecords:async(name,runId,rows)=>{if(name==='drafts')drafts.push(...rows);}},model:{chat:async()=>({text:''})}};
const coordinator=createTurnCoordinator({ports,rules:{emptyRoot:()=>({})},identity:{accountId:'a',runId:'r',branchId:'b'}});
const plan=normalizePlan({managedIds:[3],selectedIds:[3],inputRef:'attempt-1'});
const begun=await coordinator.begin({inputText:'走',selection:plan});
check('协调器快照带本轮选择摘要',()=>{
  assert.equal(begun.selection.managed,1);
  assert.equal(begun.selection.selected,1);
});
check('草稿内含选择方案原文，重试可复用同一次准备结果',()=>{
  const draft=drafts.at(-1);
  assert.ok(draft&&draft.selection,'草稿缺方案');
  assert.deepEqual(draft.selection.managedIds,['3']);
  assert.equal(draft.selection.inputRef,'attempt-1');
});
check('selectionSets 提供的集合类型可直接驱动世界书',()=>{
  const sets=selectionSets(normalizePlan({managedIds:[3],selectedIds:[3]}));
  assert.ok(sets.managed.has('3')&&sets.selected.has('3'));
  assert.equal(sets.required.size,0);
});
const report={schema:1,at:new Date().toISOString(),cases:results,failed:results.filter(row=>!row.ok).length};
fs.writeFileSync('reports/u01-selection-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(results.map(row=>({name:row.name,ok:row.ok,error:row.error})),null,1));
console.log('U01='+(report.failed?1:0));
process.exitCode=report.failed?1:0;
