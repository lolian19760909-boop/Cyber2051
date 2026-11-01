/** 热更存档兼容检查（issue #26）：2.3.33 旧档在 3.0.0 新卡下恢复与续玩。
 *  场景A（未编辑世界书的档）：新卡内容照常流入，提示用新文本与新增条目，版本戳共存。
 *  场景B（玩家编辑过世界书的档）：整本快照按档钉住保护玩家手改，开关保留，续玩不损坏。
 *  今后每次热更的标准门槛。无网络、无Key、无真实供应商调用。 */
import assert from 'node:assert/strict';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';
import {installedGameSetup} from '../src/gameplay/game-setup-catalog.mjs';

const chain=cardRuleChain(),setup=installedGameSetup(chain),binding=setup.bind(setup.draft());
const entry=(id,content,comment)=>({id,keys:[],comment,enabled:true,constant:true,selective:true,position:'after_char',insertion_order:9900+id,content,extensions:{position:4,depth:0,role:0,probability:100,useProbability:true}});
const oldCard={data:{name:'东京都2051 V2.3.33',first_mes:'FIRST',character_version:'2.3.33',extensions:{depth_prompt:{prompt:'DEPTH'}},character_book:{entries:[entry(1,'<status_current_variable>旧状态文本</status_current_variable>','mvu变量列表'),entry(2,'玩法条目旧文本','玩法')]}}};
const newCard={data:{name:'东京都2051 V3.0.0',first_mes:'FIRST',character_version:'3.0.0',extensions:{depth_prompt:{prompt:'DEPTH'}},character_book:{entries:[entry(1,'<status_current_variable>新状态文本</status_current_variable>','mvu变量列表'),entry(2,'玩法条目旧文本','玩法'),entry(3,'本次热更新增条目','新增')]}}};
const preset={prompts:[{identifier:'main',role:'system',content:'SYS-MAIN'},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'main',enabled:true},{identifier:'chatHistory',enabled:true}]}],new_chat_prompt:''};
const INSTRUCTION='已确认的开场指令';
const checks=[],check=async(name,fn)=>{await fn();checks.push(name);};

async function seedStory(port,{runId,withBookEdit}){
 const sent=[];
 const sessionOf=(card,contentVersion)=>createWebSession({mode:'local',accountId:runId,runId,
  ports:{state:port,model:{async chat(payload){sent.push(payload);return {text:'<cxx-story>合成正文。</cxx-story>',complete:true};}}},
  chain:{...chain,parser:cardParser()},card,preset,profile:{name:'U'},contentVersion,gameSetup:setup,
  model:{adapter:'chat:deepseek',model:'deepseek-flash'}});
 const old=sessionOf(oldCard,'2.3.33+old');
 await port.commit({...old.identity,runId,nodeId:'opening',operationId:'create',parentNodeId:null,expectedRevision:0,stateAfter:old.rules.emptyRoot(),profile:{name:'U'},message:{role:'assistant',kind:'opening',raw:'开场场景文本',display:[],input:null,openingCommand:true,openingAction:INSTRUCTION,gameSetup:structuredClone(binding)},receipt:{kind:'creation',creationId:'c1'},createdAt:new Date().toISOString()});
 await old.restore();
 assert.equal((await old.runTurn(INSTRUCTION)).status,'committed');
 if(withBookEdit){const book=(await old.readContent()).books[0];book.entries.find(row=>row.id===2).enabled=false;await old.saveWorldbook(book);}
 old.dispose();
 return {sent,sessionOf};
}

async function resumeWith(sessionOf,port,{runId,sent}){
 const updated=sessionOf(newCard,'3.0.0+new');
 try{
  await updated.restore();
  assert.equal(updated.gameSetupBinding.baseVersion,'3.0.0');
  assert.equal(setup.compatibility(updated.gameSetupBinding).status,'compatible');
  assert.equal((await port.readRun(runId)).contentVersion,'2.3.33+old','恢复后未续玩前版本戳仍是旧版');
  assert.equal((await updated.runTurn('玩家行动')).status,'committed');
  assert.equal((await port.readRun(runId)).contentVersion,'3.0.0+new','新提交把存档推进到新版本号');
  return {updated,content:await updated.readContent(),prompt:sent.at(-1).body.messages.map(row=>row.content).join('\n')};
 }finally{updated.dispose();}
}

await check('场景A 未编辑世界书：新卡文本与新增条目流入，提示随之更新',async()=>{
 const port=createMemoryStatePort({accountId:'update-compat-a'});
 const runId='update-compat-a',{sent,sessionOf}=await seedStory(port,{runId,withBookEdit:false});
 const {content,prompt}=await resumeWith(sessionOf,port,{runId,sent});
 const cardBook=content.books[0];
 assert.equal(cardBook.entries.find(row=>row.id===1).content.includes('新状态文本'),true,'世界书新文本流入');
 assert.ok(cardBook.entries.some(row=>row.id===3),'热更新增条目可见');
 assert.ok(prompt.includes('新状态文本'),'提示用新文本');
 assert.ok(!prompt.includes('旧状态文本'),'旧文本不再出现');
 assert.ok(prompt.includes('本次热更新增条目'),'新增条目进提示');
});

await check('场景B 玩家编辑过世界书：整本快照按档保留，手改与开关不被热更覆盖',async()=>{
 const port=createMemoryStatePort({accountId:'update-compat-b'});
 const runId='update-compat-b',{sent,sessionOf}=await seedStory(port,{runId,withBookEdit:true});
 const {content,prompt}=await resumeWith(sessionOf,port,{runId,sent});
 const cardBook=content.books[0];
 assert.equal(cardBook.entries.find(row=>row.id===1).content.includes('旧状态文本'),true,'玩家快照文本保持');
 assert.equal(cardBook.entries.find(row=>row.id===2).enabled,false,'玩家条目开关保留');
 assert.ok(!cardBook.entries.some(row=>row.id===3),'新条目不混入玩家快照');
 assert.ok(prompt.includes('旧状态文本'),'提示仍用玩家快照');
 assert.ok(!prompt.includes('玩法条目旧文本'),'玩家关闭的条目不进提示');
});

console.log(JSON.stringify({ok:true,checks:checks.length,names:checks,scope:'Real session engine with old/new card fixtures on persistent runs; no player save, no network, no supplier call'}));
