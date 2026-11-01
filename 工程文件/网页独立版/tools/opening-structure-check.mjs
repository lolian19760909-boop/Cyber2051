/** 开局请求结构检查（issue #23）：command 开场派发时指令先行、状态转储随指令走 user、预置场景行不入历史，预设连续 system 合并为单一块；direct 开场与旧存档保持原结构。无网络、无Key、无真实供应商调用。 */
import assert from 'node:assert/strict';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';
import {sourceRows} from '../src/context/sources.mjs';

const SCENE='SCENE-RAW-预置场景文本',INSTRUCTION='已确认的开场指令',DUMP='<status_current_variable>\n{"terminal":{"wallet":{"yen":100}}}\n</status_current_variable>\n上面是已保存的当前状态。';
const dumpEntry={id:1,keys:[],comment:'mvu变量列表',enabled:true,constant:true,selective:true,position:'after_char',insertion_order:9901,content:DUMP,extensions:{position:4,depth:0,role:0,probability:100,useProbability:true}};
const card={data:{name:'C',first_mes:'FIRST',character_version:'V1',extensions:{depth_prompt:{prompt:'DEPTH'}},character_book:{entries:[dumpEntry]}}};
const preset={
 squash_system_messages:true,
 prompts:[
  {identifier:'main',role:'system',content:'SYS-MAIN'},
  {identifier:'aux',role:'system',content:'SYS-AUX'},
  {identifier:'chatHistory',marker:true},
  {identifier:'postA',role:'system',content:'POST-A'},
  {identifier:'postB',role:'system',content:'POST-B'},
  {identifier:'mystQ',role:'user',content:'神秘问'},
  {identifier:'mystA',role:'assistant',content:'神秘答'},
  {identifier:'tail',role:'user',content:'尾部指令'}
 ],
 prompt_order:[{character_id:100001,order:[
  {identifier:'main',enabled:true},{identifier:'aux',enabled:true},{identifier:'chatHistory',enabled:true},
  {identifier:'postA',enabled:true},{identifier:'postB',enabled:true},
  {identifier:'mystQ',enabled:true},{identifier:'mystA',enabled:true},{identifier:'tail',enabled:true}
 ]}],
 new_chat_prompt:''
};
const checks=[],check=async(name,fn)=>{await fn();checks.push(name);};

await check('sourceRows：command 开场不派生场景行，普通节点仍成对',async()=>{
 const who={accountId:'a',runId:'r'};
 const prebuilt=await sourceRows({nodes:[{nodeId:'n1',parentId:null,branchId:'main',message:{kind:'opening',raw:SCENE,input:null,openingCommand:true,openingAction:INSTRUCTION}}],identity:who,projectText:(text,role)=>({text})});
 assert.equal(prebuilt.length,0);
 const flaggedNormal=await sourceRows({nodes:[{nodeId:'n1',parentId:null,branchId:'main',message:{kind:'opening',raw:SCENE,input:null,openingAction:INSTRUCTION}}],identity:who,projectText:(text,role)=>({text})});
 assert.deepEqual(flaggedNormal.map(row=>row.role),['assistant']);
 const paired=await sourceRows({nodes:[{nodeId:'n2',parentId:'n1',branchId:'main',message:{kind:'assistant',raw:'正文',input:{text:INSTRUCTION}}}],identity:who,projectText:(text,role)=>({text})});
 assert.deepEqual(paired.map(row=>row.role),['user','assistant']);
});

async function dispatchScenario(openingMessage){
 const sent=[];
 const port=createMemoryStatePort({accountId:'opening-structure-check'});
 const app=createWebSession({mode:'local',accountId:'opening-structure-check',runId:'opening-structure-check',
  ports:{state:port,model:{async chat(payload){sent.push(payload);return {text:'<cxx-story>合成正文。</cxx-story>',complete:true};}}},
  chain:{...cardRuleChain(),parser:cardParser()},card,preset,profile:{name:'U'},
  model:{adapter:'chat:deepseek',model:'deepseek-flash'}});
 await port.commit({...app.identity,nodeId:'opening',operationId:'create',parentNodeId:null,expectedRevision:0,stateAfter:app.rules.emptyRoot(),profile:{name:'U'},message:openingMessage,receipt:{kind:'creation',creationId:'c1'},createdAt:new Date().toISOString()});
 await app.restore();
 try{
  const first=await app.runTurn(INSTRUCTION);
  assert.equal(first.status,'committed');
  const second=await app.runTurn('玩家行动');
  assert.equal(second.status,'committed');
 }finally{app.dispose();}
 return sent.map(call=>call.body.messages.map(row=>({role:row.role,content:String(row.content)})));
}

await check('command 开场派发：指令先行、转储随指令走 user、场景行缺席、system 合一',async()=>{
 const [dispatch,second]=await dispatchScenario({role:'assistant',kind:'opening',raw:SCENE,display:[],input:null,openingCommand:true,openingAction:INSTRUCTION});
 assert.deepEqual(dispatch.map(row=>row.role),['system','user','user','system','user','assistant','user']);
 assert.equal(dispatch[0].content,'SYS-MAIN\nSYS-AUX');
 assert.equal(dispatch[1].content,INSTRUCTION);
 assert.ok(dispatch[2].content.includes('<status_current_variable>'));
 assert.equal(dispatch[3].content,'POST-A\nPOST-B');
 assert.equal(dispatch[4].content,'神秘问');
 assert.equal(dispatch[6].content,'尾部指令');
 assert.ok(!dispatch.some(row=>row.content.includes(SCENE)));
 // 第二轮：历史=[指令,第一轮正文]，转储回到世界书条目配置的 system。
 assert.ok(second.some(row=>row.role==='assistant'&&row.content.includes('合成正文')));
 const dumpSecond=second.find(row=>row.content.includes('<status_current_variable>'));
 assert.equal(dumpSecond.role,'system');
 assert.ok(!second.some(row=>row.content.includes(SCENE)));
});

await check('direct 开场与旧存档（无标记）保留场景行、转储维持 system',async()=>{
 for(const message of [
  {role:'assistant',kind:'opening',raw:SCENE,display:[],input:null,openingAction:'请顺着上面的开场继续'},
  {role:'assistant',kind:'opening',raw:SCENE,display:[],input:null,openingCommand:false,openingAction:INSTRUCTION}
 ]){
  const [dispatch]=await dispatchScenario(message);
  assert.ok(dispatch.some(row=>row.role==='assistant'&&row.content.includes(SCENE)),message.openingCommand===false?'旧存档':'direct');
  const instructionRow=dispatch.find(row=>row.content===INSTRUCTION);
  assert.ok(instructionRow,'指令行存在');
  const dumpRow=dispatch.find(row=>row.content.includes('<status_current_variable>'));
  assert.equal(dumpRow.role,'system');
  assert.ok(dispatch.indexOf(dumpRow)>dispatch.indexOf(instructionRow));
 }
});

console.log(JSON.stringify({ok:true,checks:checks.length,names:checks,scope:'Real session engine with synthetic card/preset/state; no player save, no network, no supplier call'}));
