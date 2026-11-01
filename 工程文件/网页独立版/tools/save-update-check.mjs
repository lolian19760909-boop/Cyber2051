/** 存档热更检查（issue #28）：版本对比/更新计划单元断言 + applySaveUpdate 会话级行为
 *  （备份快照、版本戳推进、receipt 幂等重放、不污染历史时间线）。无网络、无Key、无真实供应商调用。 */
import assert from 'node:assert/strict';
import {compareVersions,versionPrefix,updatePlan,needsSaveUpdate} from '../src/app/migration.mjs';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';

const checks=[],check=async(name,fn)=>{await fn();checks.push(name);};
const card={data:{name:'C',first_mes:'FIRST',character_version:'3.0.0',extensions:{depth_prompt:{prompt:'DEPTH'}},character_book:{entries:[]}}};
const preset={prompts:[{identifier:'main',role:'system',content:'SYS-MAIN'},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'main',enabled:true},{identifier:'chatHistory',enabled:true}]}],new_chat_prompt:''};

await check('版本对比与更新计划边界',async()=>{
 assert.equal(compareVersions('2.3.33','3.0.0'),-1);
 assert.equal(compareVersions('3.0.0','3.0.0'),0);
 assert.equal(compareVersions('3.0.1','3.0.0'),1);
 assert.equal(versionPrefix('3.0.0+bf87a49dc1aa'),'3.0.0');
 assert.deepEqual(updatePlan({from:'2.3.33+old',to:'3.0.0+new'}).highlights.length>0,true,'2.3.33→3.0.0 有登记的更新说明');
 assert.equal(updatePlan({from:'3.0.0+a',to:'3.0.0+b'}),null,'同版不更新');
 assert.equal(updatePlan({from:'3.0.1',to:'3.0.0'}),null,'更高存档不降级');
 assert.equal(updatePlan({from:'3.0.0',to:'3.1.0'}),null,'未登记的路径不弹窗');
 assert.equal(updatePlan({from:'2.3.33',to:'3.0.1'})?.to,'3.0.1','累计说明覆盖到目标版本');
 assert.equal(needsSaveUpdate('2.3.33','3.0.0'),true);
 assert.equal(needsSaveUpdate('3.0.0','3.0.0'),false);
});

await check('applySaveUpdate：备份、版本戳、幂等与时间线不受影响',async()=>{
 const port=createMemoryStatePort({accountId:'save-update-check'});
 const sent=[];
 const sessionOf=contentVersion=>createWebSession({mode:'local',accountId:'save-update-check',runId:'save-update-check',
  ports:{state:port,model:{async chat(payload){sent.push(payload);return {text:'<cxx-story>合成正文。</cxx-story>',complete:true};}}},
  chain:{...cardRuleChain(),parser:cardParser()},card,preset,profile:{name:'U'},contentVersion,
  model:{adapter:'chat:deepseek',model:'deepseek-flash'}});
 const oldSession=sessionOf('2.3.33+old');
 await port.commit({...oldSession.identity,nodeId:'opening',operationId:'create',parentNodeId:null,expectedRevision:0,stateAfter:oldSession.rules.emptyRoot(),contentVersion:'2.3.33+old',profile:{name:'U'},message:{role:'assistant',kind:'opening',raw:'开场场景',display:[],input:null},receipt:{kind:'creation',creationId:'c1'},createdAt:new Date().toISOString()});
 await oldSession.restore();
 oldSession.dispose();
 // 旧版本号在此处可读；换新会话打开后执行热更。
 const updated=sessionOf('3.0.0+new');
 try{
  await updated.restore();
  const before=updated.transcript.length;
  const result=await updated.applySaveUpdate({to:'3.0.0+new'});
  assert.equal(result.status,'committed');
  assert.equal((await port.readRun('save-update-check')).contentVersion,'3.0.0+new','run 版本戳推进');
  const backups=await port.listRecords('backups','save-update-check');
  assert.equal(backups.length,1,'迁移前自动备份一份');
  assert.equal(backups[0].snapshot.run.runId,'save-update-check');
  assert.equal(backups[0].snapshot.run.contentVersion,'2.3.33+old','备份保留旧版本内容');
  assert.equal(updated.transcript.length,before,'program 节点不进历史时间线');
  assert.ok(updated.narrativeNode?.message?.raw==='开场场景','阅读视图不受影响');
  const replay=await updated.applySaveUpdate({to:'3.0.0+new'});
  assert.equal(replay.status,'replayed','重复热更按 receipt 重放');
  assert.equal((await port.listRecords('backups','save-update-check')).length,1,'重放不重复备份');
 }finally{updated.dispose();}
});

console.log(JSON.stringify({ok:true,checks:checks.length,names:checks,scope:'Real session engine with memory port; no player save, no network, no supplier call'}));
