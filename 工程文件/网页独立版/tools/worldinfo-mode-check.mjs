/** Native worldbook activation must survive off/observe modes at the real session call site. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';
import {buildKnowledgeIndex} from '../src/context/knowledge.mjs';
import {readBooks,applySelection} from '../src/platform/worldbook.mjs';
import {emptyAgentState,setMode,recordTakeover,takeoverRecord} from '../src/context/agent-state.mjs';
const entries=[
 {id:1,comment:'蓝灯规则',content:'BLUE_ALWAYS_REQUIRED',constant:true,enabled:true,keys:[],insertion_order:100,extensions:{position:0}},
 {id:2,comment:'未命中绿灯',content:'GREEN_WITHOUT_KEY_MUST_NOT_APPEAR',constant:false,enabled:true,keys:['月球'],insertion_order:90,extensions:{position:0}},
 {id:3,comment:'已命中绿灯',content:'GREEN_KEY_MATCH_REQUIRED',constant:false,enabled:true,keys:['查看'],insertion_order:80,extensions:{position:0}},
 {id:4,comment:'停用条目',content:'DISABLED_MUST_NOT_APPEAR',constant:true,enabled:false,keys:[],insertion_order:70,extensions:{position:0}},
];
const card={data:{name:'Native Fixture',description:'',personality:'',scenario:'',mes_example:'',character_book:{entries}}};
const identifiers=['worldInfoBefore','worldInfoAfter','chatHistory'];
const preset={prompts:identifiers.map(identifier=>({identifier,marker:true,role:'system'})),prompt_order:[{character_id:100001,order:identifiers.map(identifier=>({identifier,enabled:true}))}],openai_max_context:128000,openai_max_tokens:128};
const catalog=buildKnowledgeIndex([{bookId:'card',name:'fixture',entries}]);
const chain={...cardRuleChain(),parser:cardParser()},checks=[];
async function run({mode='off',takeover=false,pick=['card:2']}={}){
 const accountId='native-mode-'+mode+'-'+takeover,calls=[];
 const state=createMemoryStatePort({accountId});
 const session=createWebSession({mode:'local',accountId,runId:accountId,ports:{state,model:{async chat(payload){calls.push(payload);if(payload.body.max_tokens===640)return {text:JSON.stringify({uids:pick,reason:'Deterministic selector answer for activation testing'}),complete:true};throw Object.assign(new Error('Stop after capturing the real prepared body'),{code:'fixture_capture'});}}},chain,card,preset,presetId:'fixture',catalog,random:()=>.5,model:{adapter:'deepseek',model:'synthetic-no-network'}});
 try{await session.restore();session.setAgentMode(mode);if(takeover)await session.takeOverBook('card');await session.runTurn('查看周围');const body=calls.find(row=>row.body.max_tokens===128);assert(body,'The real session must reach the body request');return {takeoverBaseline:takeover?await state.readStoryAgent(accountId):null,mode,auxiliaryCalls:calls.filter(row=>row.body.max_tokens===640).length,body:body.body.messages.map(row=>row.content).join('\n'),selected:session.plan,report:session.promptReport};}finally{session.dispose();}
}
async function check(name,fn){try{const detail=await fn();checks.push({name,ok:true,detail});}catch(error){checks.push({name,ok:false,error:error.message});}}
await check('off keeps blue, matches green keywords, excludes disabled, and sends no selector request',async()=>{const result=await run();assert.equal(result.auxiliaryCalls,0,'关闭接管时仍请求目录选择器');assert(result.body.includes('BLUE_ALWAYS_REQUIRED'),'蓝灯被未选中规则排除');assert(result.body.includes('GREEN_KEY_MATCH_REQUIRED'),'关键词命中的绿灯丢失');assert(!result.body.includes('GREEN_WITHOUT_KEY_MUST_NOT_APPEAR'),'未命中绿灯被强制加入');assert(!result.body.includes('DISABLED_MUST_NOT_APPEAR'));return {auxiliaryCalls:result.auxiliaryCalls};});
await check('observe records suggestions while body retains native blue/green activation',async()=>{const result=await run({mode:'observe'});assert(result.auxiliaryCalls>0,'观察模式应记录选择');assert(result.body.includes('BLUE_ALWAYS_REQUIRED'),'观察模式丢失蓝灯');assert(result.body.includes('GREEN_KEY_MATCH_REQUIRED'),'观察模式改变关键词装配');assert(!result.body.includes('GREEN_WITHOUT_KEY_MUST_NOT_APPEAR'),'观察结果直接改变正文提示');assert(!result.body.includes('DISABLED_MUST_NOT_APPEAR'));return {auxiliaryCalls:result.auxiliaryCalls};});
await check('takeover with no confirmed book retains native activation and makes no selector request',async()=>{const result=await run({mode:'takeover'});assert.equal(result.auxiliaryCalls,0,'未接管任何书却控制全部目录');assert(result.body.includes('BLUE_ALWAYS_REQUIRED'));assert(result.body.includes('GREEN_KEY_MATCH_REQUIRED'));assert(!result.body.includes('GREEN_WITHOUT_KEY_MUST_NOT_APPEAR'));return {auxiliaryCalls:result.auxiliaryCalls};});
await check('explicit book takeover can select green without deleting blue or enabling disabled entries',async()=>{const result=await run({mode:'takeover',takeover:true});assert(result.auxiliaryCalls>0);assert.equal(Object.keys(result.takeoverBaseline.books.card.entries).length,entries.length,'确认接管时丢失原条目基线');assert(result.body.includes('BLUE_ALWAYS_REQUIRED'),'显式接管不应把蓝灯交给目录模型决定');assert(result.body.includes('GREEN_WITHOUT_KEY_MUST_NOT_APPEAR'),'已确认接管书的选择应生效');assert(!result.body.includes('DISABLED_MUST_NOT_APPEAR'));return {auxiliaryCalls:result.auxiliaryCalls};});
await check('worldbook write owner keeps off and observe read-only even with a proposed content patch',async()=>{
 const books=readBooks({cards:[{bookId:'card',entries}]}),plan={managedIds:['2'],bookChanges:[{bookId:'card',entryId:'2',fields:{content:'UNAUTHORIZED_OBSERVER_WRITE'}}]};
 for(const mode of ['off','observe']){const state=setMode(recordTakeover(emptyAgentState(),takeoverRecord(books.books[0])),mode),result=await applySelection({books,plan,state});assert.deepEqual(result.settingsPatch.books,{},mode+' 写回了只应观察的建议');assert.equal(result.books.length,0);}
 return {modes:['off','observe'],writes:0};
});
await check('worldbook write owner requires the exact book to have a takeover baseline',async()=>{
 const books=readBooks({cards:[{bookId:'card',entries}]}),state=setMode(emptyAgentState(),'takeover'),plan={managedIds:['2'],bookChanges:[{bookId:'card',entryId:'2',fields:{enabled:false}}]},result=await applySelection({books,plan,state});assert.deepEqual(result.settingsPatch.books,{},'没有确认接管的书被写入');assert.equal(result.books.length,0);return {writes:0};
});
await check('native default scans the last two messages, not insertion-depth default four',async()=>{
 const session=createWebSession({mode:'local',accountId:'scan-depth',ports:{state:createMemoryStatePort({accountId:'scan-depth'}),model:{}},chain,card,preset});
 try{const result=session.buildPrompt('查看周围',{historyOverride:[{role:'assistant',content:'月球'},{role:'user',content:'旧输入'},{role:'assistant',content:'最近的场景'}]});assert(!result.prompt.messages.some(row=>row.content.includes('GREEN_WITHOUT_KEY_MUST_NOT_APPEAR')),'第三条以前的消息进入了默认扫描窗口');return {used:result.info.used.map(row=>row.id)};}finally{session.dispose();}
});
await check('release restores agent changes, retains manual fields, and survives session reload',async()=>{
 const accountId='native-restore',state=createMemoryStatePort({accountId});
 const options={mode:'local',accountId,runId:accountId,ports:{state,model:{async chat(){throw Object.assign(new Error('Captured before network'),{code:'fixture_capture'});}}},chain,card,preset,catalog,selectionFor:()=>({managedIds:['card:2','card:3'],selectedIds:['card:2','card:3'],bookChanges:[{bookId:'card',entryId:'2',fields:{content:'AGENT_TWO',position:1,order:13}},{bookId:'card',entryId:'3',fields:{content:'AGENT_THREE',order:14}}]})};
 let session=createWebSession(options);
 try{
  await session.restore();session.setAgentMode('takeover');await session.takeOverBook('card');await session.runTurn('查看周围');
  const book=(await session.readContent()).books.find(row=>row.bookId==='card');
  assert.equal(book.entries.find(row=>row.id===2).content,'AGENT_TWO');
  book.entries.find(row=>row.id===2).content='PLAYER_EDIT';book.entries.find(row=>row.id===2).insertion_order=77;
  await session.saveWorldbook(book);session.dispose();session=createWebSession(options);await session.restore();
  await session.releaseBook('card');
  const restored=(await session.readContent()).books.find(row=>row.bookId==='card');
  assert.equal(restored.entries.find(row=>row.id===2).content,'PLAYER_EDIT','恢复覆盖了玩家手改正文');
  assert.equal(restored.entries.find(row=>row.id===2).insertion_order,77,'恢复覆盖了玩家手改顺序');
  assert.equal(restored.entries.find(row=>row.id===2).extensions.position,0,'取消接管没有恢复原插入位置');
  assert.equal(restored.entries.find(row=>row.id===3).content,entries[2].content,'取消接管没有恢复模型改写正文');
  assert.equal(restored.entries.find(row=>row.id===3).insertion_order,80);
  assert.deepEqual(session.agent.books,[]);session.dispose();session=createWebSession(options);await session.restore();
  assert.deepEqual(session.agent.books,[]);assert.equal((await session.readContent()).books[0].entries.find(row=>row.id===3).content,entries[2].content);
  return {manualContentPreserved:true,manualOrderPreserved:true,agentPositionAndContentRestored:true,reload:true};
 }finally{session.dispose();}
});
await check('failed host restore retains its takeover baseline and reports the write failure',async()=>{
 const accountId='native-restore-failure',state=createMemoryStatePort({accountId});let hostEntries=structuredClone(entries),fail=false;
 const host={canWrite:true,async apply({patches}){if(fail)throw Object.assign(new Error('Host unavailable'),{code:'host_write_failed'});for(const patch of patches){const row=hostEntries.find(entry=>String(entry.id)===String(patch.entryId));if(patch.content!==undefined)row.content=patch.content;}}};
 const session=createWebSession({mode:'local',accountId,runId:accountId,ports:{state,model:{},worldbook:host,worldbookBooks:async()=>[{bookId:'host',entries:hostEntries}]},chain,card,preset});
 try{await session.restore();await session.takeOverBook('host');hostEntries[1].content='AGENT_HOST_EDIT';fail=true;
  await assert.rejects(()=>session.releaseBook('host'),error=>error.code==='host_write_failed');
  assert(session.agent.books.includes('host'),'恢复失败却删除了原配置基线');
  return {failureVisible:true,baselineRetained:true};
 }finally{session.dispose();}
});
const report={at:new Date().toISOString(),checks,passed:checks.every(row=>row.ok),realProviderRequests:0,scope:'Real createWebSession/runTurn/prompt path, real native rule chain and in-memory persistence; only provider answers are synthetic. Proves worldbook mode behavior, not DeepSeek output.'};
fs.writeFileSync(new URL('../reports/worldinfo-mode-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
