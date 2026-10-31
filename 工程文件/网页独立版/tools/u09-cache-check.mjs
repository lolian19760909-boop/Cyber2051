/** U09 acceptance: 目录/决策缓存、依赖失效、429 退避与耗时账本。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser,cardModule} from '../src/reuse/card.mjs';

const chain={...cardRuleChain(),parser:cardParser(),operations:cardModule('运行时/player-operations.js')};
const minimal={prompts:[{identifier:'worldInfoBefore',marker:true},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'worldInfoBefore',enabled:true},{identifier:'chatHistory',enabled:true}]}]};
const card={data:{name:'U09 夹具',description:'',character_book:{entries:[{id:11,keys:['诊所'],content:'U09-诊所',enabled:true,constant:false,selective:true,insertion_order:100,extensions:{position:0}},{id:12,keys:['委托人'],content:'U09-委托人',enabled:true,constant:false,selective:true,insertion_order:101,extensions:{position:0}}]}}};
const items=()=>[{uid:'11',entryId:'11',title:'诊所地图',category:'generic',hash:'h11',segments:['甲','乙']},{uid:'12',entryId:'12',title:'委托人',category:'generic',hash:'h12',segments:['甲']},{uid:'13',entryId:'13',title:'义体名录',category:'generic',hash:'h13',segments:['甲']}];
const results=[];const test=async(name,fn)=>{try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:String(error?.message||error).slice(0,400)});console.log('FAIL '+name+' :: '+String(error?.message||error).slice(0,400));}};

function fixture({rateLimitSelection=0,rateLimitBody=0,catalogGroups=null,catalogPick=null}={}){
 const port=createMemoryStatePort({accountId:'u09'}),calls=[],groups={selection:0,body:0};
 let leftSelection=rateLimitSelection,leftBody=rateLimitBody;
 const catalog={sourceHash:'src-u09',indexHash:'idx-u09',items:items(),...(catalogGroups?{groups:catalogGroups}:{})};
 const chat=async payload=>{
  const messages=payload?.body?.messages||payload?.messages||[],joined=messages.map(row=>String(row?.content||'')).join('\n'),selection=joined.includes('目录挑选助手');
  if(selection){groups.selection+=1;if(leftSelection>0){leftSelection-=1;throw Object.assign(new Error('429 限流'),{code:'rate_limited',status:429});}}
  else{groups.body+=1;if(leftBody>0){leftBody-=1;throw Object.assign(new Error('429 限流'),{code:'rate_limited',status:429});}}
  calls.push({selection,payload});
  if(selection){const row=JSON.parse(String(messages[1]?.content||'{}'));const all=(row.items||[]).map(item=>String(item.uid));const uids=row.stage==='catalog'?(catalogPick?catalogPick(all):all):(row.items||[]).filter(item=>/诊所|委托人/.test(String(item.title||''))).map(item=>String(item.uid));return {text:JSON.stringify({uids,reason:'现场提到诊所与委托人'}),usage:{input_tokens:100,output_tokens:20}};}
  return {text:'<cxx-story>正文</cxx-story>',usage:{input_tokens:2000,output_tokens:300}};
 };
 const makeSession=()=>createWebSession({mode:'local',accountId:'u09',runId:'u09-run',ports:{state:port,model:{chat}},chain,card,preset:minimal,catalog,promptOptions:{selection:{strategy:'destiny'}}});
 const selectionCalls=()=>calls.filter(call=>call.selection).length;
 return {port,catalog,makeSession,selectionCalls,groups,get calls(){return calls;}};
}

await test('同输入同 revision 命中上轮决策，不再调用模型',async()=>{
 const f=fixture(),app=f.makeSession();await app.restore();
 const first=await app.prepareSelection({inputText:'我走进诊所'});
 assert.equal(app.selection.last.mode,'full');
 const used=f.selectionCalls();assert.ok(used>=2,'首轮全量至少走目录与条目两批');
 const second=await app.prepareSelection({inputText:'我走进诊所'});
 assert.equal(app.selection.last.mode,'reuse','同签名直接复用');
 assert.equal(f.selectionCalls(),used,'复用不再发请求');
 assert.deepEqual(second.selectedIds,first.selectedIds);
 assert.equal(app.selection.last.mode,'reuse');
});

await test('条目正文变化使缓存按依赖失效',async()=>{
 const f=fixture(),app=f.makeSession();await app.restore();
 const first=await app.prepareSelection({inputText:'我走进诊所'});const used=f.selectionCalls();
 f.catalog.items[1].hash='h12-changed';
 const next=await app.prepareSelection({inputText:'我走进诊所',facts:{facts:[{sourceIds:['13']}],capsule:''}});
 assert.equal(app.selection.last.mode,'merge','条目 hash 变了就不该复用，走合并');
 assert.ok(next.selectedIds.includes('13'),'新事实补查进来的条目要选上');
 for(const uid of first.selectedIds)assert.ok(next.selectedIds.includes(uid),'上一轮选中的条目按合并保留');
 assert.equal(f.selectionCalls(),used,'合并补查不额外问模型');
});

await test('策略设置 revision 变化使缓存失效',async()=>{
 const f=fixture(),app=f.makeSession();await app.restore();
 await app.prepareSelection({inputText:'我走进诊所'});const used=f.selectionCalls();
 app.setPromptOptions({selection:{strategy:'destiny',revision:2}});
 await app.prepareSelection({inputText:'我走进诊所'});
 assert.equal(app.selection.last.mode,'merge','策略版本变了不能复用');
 assert.equal(f.selectionCalls(),used,'合并路径不整批重问');
});

await test('换人物使缓存按依赖失效',async()=>{
 const f=fixture(),app=f.makeSession();await app.restore();
 const first=await app.prepareSelection({inputText:'我走进诊所'});const used=f.selectionCalls();
 await app.prepareSelection({inputText:'我走进诊所',actorId:'wb_4'});
 assert.equal(app.selection.last.mode,'merge','换视点人物不能沿用上一个人物的决策');
 assert.equal(f.selectionCalls(),used,'合并路径只补事实，不整批重问');
 assert.ok(first.selectedIds.length>=1);
});

await test('两段选择：先粗选目录，再只对选中目录里的条目细判',async()=>{
 const rows=[{id:'g-clinic',kind:'book',label:'诊所与街区',itemUids:['11','12']},{id:'g-body',kind:'category',label:'义体名录',itemUids:['13']}];
 const f=fixture({catalogGroups:rows,catalogPick:all=>all.slice(0,1)}),app=f.makeSession();await app.restore();
 const plan=await app.prepareSelection({inputText:'我走进诊所，看看义体名录'});
 assert.equal(f.selectionCalls(),2,'一个目录批加一个条目批就够');
 const first=JSON.parse(String(f.calls[0].payload.body.messages[1].content));
 assert.deepEqual(first.items.map(row=>row.uid),['g-clinic','g-body'],'目录阶段只送目录，不送 204 条正文');
 assert.ok(first.items.every(row=>row.count>=1&&Array.isArray(row.sample)),'目录行带条目数与样例行');
 const second=JSON.parse(String(f.calls[1].payload.body.messages[1].content));
 assert.deepEqual(second.items.map(row=>row.uid),['11','12'],'条目阶段只细判选中目录里的条目');
 assert.deepEqual(plan.selectedIds.sort(),['11','12']);
 assert.ok(!plan.selectedIds.includes('13'),'没选中的义体目录不进入条目细判');
});

await test('长条目分段记录进方案，供后续只重做受影响段',async()=>{
 const f=fixture(),app=f.makeSession();await app.restore();
 const plan=await app.prepareSelection({inputText:'我走进诊所'});
 assert.ok(plan.selectedIds.includes('11'),'诊所地图被选中');
 assert.ok(plan.pages?.some(row=>String(row.uid)==='11'&&row.segments===2),'两段条目要记分页');
});

await test('目录请求 429 后退避重发，本轮仍能继续',async()=>{
 const f=fixture({rateLimitSelection:1}),app=f.makeSession();await app.restore();
 const plan=await app.prepareSelection({inputText:'我走进诊所'});
 assert.ok(plan.selectedIds.length>=1,'退避后照常出方案');
 const timing=app.selection.timings.selection;
 assert.equal(timing.retries,1);
 assert.ok(timing.ms>=800,'至少等过一档退避');
 assert.equal(timing.usage.input_tokens,timing.calls*100,'usage 按真实响应累计');
 assert.equal(timing.calls,2);
});

await test('正文 429 不自动重发',async()=>{
 const f=fixture({rateLimitBody:1}),app=f.makeSession();await app.restore();
 await assert.rejects(()=>app.generatePurpose('body',{messages:[{role:'user',content:'继续'}]}),/429|限流/);
 assert.equal(f.groups.body,1,'正文只发一次，不进入自动重发');
});

await test('缓存命中与完整路径结果等价，并报告调用次数与 usage',async()=>{
 const f=fixture(),app=f.makeSession();await app.restore();
 const full=await app.prepareSelection({inputText:'我走进诊所'});
 const fullCalls=f.selectionCalls();
 const reuse=await app.prepareSelection({inputText:'我走进诊所'});
 assert.deepEqual(reuse.selectedIds,full.selectedIds);
 assert.deepEqual(reuse.managedIds,full.managedIds);
 assert.equal(f.selectionCalls(),fullCalls);
 const view=app.selection;
 assert.equal(reuse.calls[0].stage,'reuse','复用只记一条 reuse 证据');
 assert.equal(view.last.calls,0,'复用轮不发模型请求');
 assert.equal(view.last.selected,full.selectedIds.length);
 assert.equal(view.timings.selection.calls,fullCalls,'调用次数按真实请求累计');
 assert.equal(view.timings.selection.usage.output_tokens,fullCalls*20,'usage 来自真实响应');
});

await test('决策写入本故事 Agent 记录，重开故事仍能复用',async()=>{
 const f=fixture(),app=f.makeSession();await app.restore();
 const first=await app.prepareSelection({inputText:'我走进诊所'});
 assert.equal(await app.saveAgent(),true,'决策应落到故事存档');
 const reopened=f.makeSession();await reopened.restore();
 const plan=await reopened.prepareSelection({inputText:'我走进诊所'});
 assert.equal(reopened.selection.last.mode,'reuse','重开故事读到上一轮决策');
 assert.deepEqual(plan.selectedIds,first.selectedIds);
 assert.ok(reopened.selection.decisions>=1);
});

const report={schema:1,at:new Date().toISOString(),cases:results,failed:results.filter(row=>!row.ok).length};
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/u09-cache-check.json',JSON.stringify(report,null,2));
console.log('U09='+(report.failed?1:0));
process.exitCode=report.failed?1:0;
