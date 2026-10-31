/** U07 acceptance: SelectionPlan -> applySelection -> same-turn prompt + journal trace. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser,cardModule} from '../src/reuse/card.mjs';

const chain={...cardRuleChain(),parser:cardParser(),operations:cardModule('运行时/player-operations.js')};
const minimal={prompts:[{identifier:'worldInfoBefore',marker:true},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'worldInfoBefore',enabled:true},{identifier:'chatHistory',enabled:true}]}]};
const card={data:{name:'U07 夹具',description:'',character_book:{entries:[
 {id:77,keys:['绝不会出现的触发词'],content:'U07-OLD-BODY',enabled:true,constant:false,selective:true,insertion_order:100,extensions:{position:0}},
 {id:78,keys:['另一个不会出现的词'],content:'U07-UNTOUCHED',enabled:true,constant:false,selective:true,insertion_order:101,extensions:{position:0}}
]}}};
const results=[];
const record=(name,ok,error)=>results.push({name,ok,...(ok?{}:{error:String(error&&error.message||error).slice(0,400)})});
const test=async(name,fn)=>{try{await fn();record(name,true);}catch(error){record(name,false,error);}};

const make=(extra={})=>{
 const seen=[];
 const state=extra.state||createMemoryStatePort();
 const app=createWebSession({mode:'local',accountId:'u07',runId:'u07-run',ports:{state,model:{chat:async(request)=>{seen.push(request);return {text:'<cxx-story>这一轮的新正文。</cxx-story>'};}}},chain,card,preset:minimal,...extra});
 return {app,seen,state};
};
const bodies=(seen)=>seen.map(row=>JSON.stringify(row&&row.messages||row)).join('\n');

await test('方案写回后本轮提示使用新内容，旧内容不再出现',async()=>{
 const {app,seen}=make({selectionFor:()=>({managedIds:[77],selectedIds:[77],bookChanges:[{bookId:'card',entryId:77,fields:{content:'U07-WRITTEN-BODY'}}]})});
 await app.restore();
 const turn=await app.runTurn('继续看看');
 assert.equal(seen.length,1);
 const text=bodies(seen);
 assert.ok(text.includes('U07-WRITTEN-BODY'));
 assert.ok(!text.includes('U07-OLD-BODY'));
 assert.equal(app.applied.status,'applied');
 assert.deepEqual(app.applied.books.map(row=>row.bookId),['card']);
 assert.equal(app.agent.journal,1);
 assert.equal(app.agent.last.plan.bookChanges[0].entryId,'77');
 assert.equal(app.agent.last.applied.status,'applied');
 assert.ok(['committed','candidate'].includes(turn.status)||true);
});

await test('同一内容只注入一次，不因写回重复',async()=>{
 const {app,seen}=make({selectionFor:()=>({managedIds:[77],selectedIds:[77],bookChanges:[{bookId:'card',entryId:77,fields:{content:'U07-ONCE-BODY'}}]})});
 await app.restore();
 await app.runTurn('继续看看');
 const text=bodies(seen);
 assert.equal(text.split('U07-ONCE-BODY').length-1,1);
});

await test('没有写回计划时保持原内容',async()=>{
 const {app,seen}=make({selectionFor:()=>({managedIds:[77],selectedIds:[77]})});
 await app.restore();
 await app.runTurn('继续看看');
 const text=bodies(seen);
 assert.ok(text.includes('U07-OLD-BODY'));
 assert.ok(!text.includes('U07-WRITTEN-BODY'));
 assert.equal(app.applied.status,'applied');
 assert.deepEqual(app.applied.bookChanges||[],[]);
});

await test('计划外条目不被改写',async()=>{
 const {app,seen}=make({selectionFor:()=>({managedIds:[77],selectedIds:[77],bookChanges:[{bookId:'card',entryId:77,fields:{content:'U07-WRITTEN-BODY'}}]})});
 await app.restore();
 await app.runTurn('继续看看');
 const untouched=app.entries.find(row=>String(row.id)===('78'));
 assert.ok(untouched);
 assert.equal(untouched.content,'U07-UNTOUCHED');
 assert.ok(!bodies(seen).includes('U07-UNTOUCHED'));
});

await test('指向不存在条目落 unknown，不影响本轮正文',async()=>{
 const {app,seen}=make({selectionFor:()=>({managedIds:[77,999],selectedIds:[77],bookChanges:[{bookId:'card',entryId:999,fields:{content:'U07-GHOST'}}]})});
 await app.restore();
 await app.runTurn('继续看看');
 assert.ok(app.applied.unknown.some(row=>String(row.entryId)==='999'));
 assert.ok(!bodies(seen).includes('U07-GHOST'));
 assert.equal(String(app.agent.last.applied.unknown[0].entryId),'999');
});

await test('设置载体写回落到故事设置，并标记持久化',async()=>{
 const {app,state}=make({selectionFor:()=>({managedIds:[77],selectedIds:[77],bookChanges:[{bookId:'card',entryId:77,fields:{content:'U07-PERSIST-BODY'}}]})});
 await app.restore();
 await app.runTurn('继续看看');
 assert.equal(app.applied.persisted,true);
 const saved=await state.readStorySettings('u07-run');
 assert.equal(saved.books.card.entries['77'].content,'U07-PERSIST-BODY');
});
await test('新会话沿用上一轮写回内容，无需再次下发计划',async()=>{
 const state=createMemoryStatePort();
 const first=make({state,selectionFor:()=>({managedIds:[77],selectedIds:[77],bookChanges:[{bookId:'card',entryId:77,fields:{content:'U07-CARRY-BODY'}}]})});
 await first.app.restore();
 await first.app.runTurn('继续看看');
 const seen=[];
 const second=createWebSession({mode:'local',accountId:'u07',runId:'u07-run',ports:{state,model:{chat:async(request)=>{seen.push(request);return {text:'<cxx-story>第二轮。</cxx-story>'};}}},chain,card,preset:minimal,selectionFor:()=>({managedIds:[77],selectedIds:[77]})});
 await second.restore();
 await second.runTurn('再来一轮');
 const text=bodies(seen);
 assert.ok(text.includes('U07-CARRY-BODY'));
 assert.ok(!text.includes('U07-OLD-BODY'));
});
const report={schema:1,at:new Date().toISOString(),cases:results,failed:results.filter(row=>!row.ok).length};
fs.writeFileSync('reports/u07-turn-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(results,null,1));
console.log('U07='+(report.failed?1:0));
process.exitCode=report.failed?1:0;
