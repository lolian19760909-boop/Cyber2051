import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createWebSession} from '../src/app/session.mjs';
import {assemblePrompt,expandMacros,createVarStore,presetOrder,presetControls,transformText,samplingFromPreset,injectAtDepth} from '../src/app/prompt.mjs';
import {activateWorldInfo} from '../src/app/worldinfo.mjs';
import {parseReply} from '../src/app/parse.mjs';
import {sourceRows,validSource} from '../src/context/sources.mjs';
import {selectTimeline} from '../src/context/service.mjs';
import {estimateTokens,measureMessages} from '../src/context/tokens.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser,cardModule} from '../src/reuse/card.mjs';
const chain={...cardRuleChain(),parser:cardParser(),operations:cardModule('运行时/player-operations.js')};
const card=JSON.parse(fs.readFileSync(new URL('../generated/card.json',import.meta.url),'utf8'));
const presets=JSON.parse(fs.readFileSync(new URL('../generated/presets.json',import.meta.url),'utf8'));
const minimal={new_chat_prompt:'',prompts:[{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'chatHistory',enabled:true}]}]};
const results=[],metrics=[];
async function test(name,fn){try{await fn();results.push({name,ok:true});}catch(error){results.push({name,ok:false,error:error.stack});}}
const create=(extra={})=>createWebSession({mode:'local',accountId:'p3b',ports:{state:createMemoryStatePort(),model:{chat:async()=>({text:'<cxx-story>保存正文</cxx-story>'})}},chain,card,preset:minimal,...extra});
const stateBlock=messages=>JSON.parse(/<status_current_variable>([\s\S]*?)<\/status_current_variable>/.exec(messages.map(row=>row.content).join('\n'))[1]);

await test('原生源先用同一完整规则归并，失败可重试且同会话不重复归并',async()=>{
 const state=createMemoryStatePort(),order=[];let syncs=0;const readHead=state.readHead;state.readHead=async(...args)=>{order.push('head');return readHead(...args);};let app;
 state.syncNativeSource=async rules=>{order.push('sync');assert.equal(rules,app.rules);if(++syncs===1)throw Error('合成原生归并失败');};app=create({ports:{state,model:{chat:async()=>{throw Error('不应生成');}}}});
 await assert.rejects(app.restore(),/合成原生归并失败/);assert.deepEqual(order,['sync']);await app.restore();assert.deepEqual(order.slice(0,3),['sync','sync','head']);await app.restore();assert.equal(syncs,2);
});
await test('两套正式预设实际启用顺序、全部标记与完整状态装配',async()=>{
 for(const [index,entry] of presets.entries()){
  const controls=presetControls(entry.preset),active=presetOrder(entry.preset).filter(row=>row.enabled!==false);assert.equal(active.length,index===0?63:34);
  assert.ok(controls.length>active.length);assert.equal(presetOrder(entry.preset),entry.preset.prompt_order.find(row=>row.character_id===100001).order);
  const app=create({preset:entry.preset,presetId:entry.id,profile:{name:'P3B_PERSONA',appearance:'青发',portrait:{src:'data:image/secret-portrait'},secretUnknown:'DO_NOT_SERIALIZE'}});await app.restore();
  const {prompt,report}=app.buildPrompt('P3B_CURRENT_ACTION');const joined=prompt.messages.map(row=>row.content).join('\n');
  assert.ok(joined.includes('P3B_CURRENT_ACTION'));assert.ok(joined.includes('P3B_PERSONA'));assert.ok(!joined.includes('secret-portrait'));assert.ok(!joined.includes('DO_NOT_SERIALIZE'));
  assert.ok(!/\{\{(?:get_message_variable|setvar|getvar|random|user|char)\b/i.test(joined));assert.deepEqual(stateBlock(prompt.messages).terminal,app.currentState.terminal);assert.ok(!joined.includes('【当前路线已提交状态】'));
  assert.equal(prompt.messages.filter(row=>row.content.includes('<status_current_variable>')).length,1);assert.deepEqual(report.warnings,[]);assert.equal(report.estimate,true);
  const params=samplingFromPreset(entry.preset);assert.equal(params.temperature,entry.preset.temperature);assert.equal(params.max_tokens,entry.preset.openai_max_tokens);assert.equal(params.top_k,entry.preset.top_k||0);
  metrics.push({preset:entry.id,active:active.length,used:prompt.used.length,messages:prompt.messages.length,inputTokens:report.inputTokens,estimate:true});
 }
});
await test('宏嵌套与变量顺序；展开的玩家字段不二次执行；未知宏原样保留、EJS明确拒绝',async()=>{
 const vars=createVarStore();assert.equal(expandMacros('{{setvar::a::{{user}}}}{{getvar::a}}',{vars,fields:{userName:'固定姓名'}}).text,'固定姓名');
 const inserted='{{setvar::injected::YES}}';assert.equal(expandMacros('{{user}}',{vars,fields:{userName:inserted}}).text,inserted);assert.equal(vars.get('injected'),'');
 assert.throws(()=>expandMacros('<%= process.env.KEY %>'),error=>error.code==='unsupported_template');
 let calls=0,lastRequest;const unknown=structuredClone(minimal);unknown.prompts.unshift({identifier:'unsupported',content:'{{future_unknown::x}}'});unknown.prompt_order[0].order.unshift({identifier:'unsupported',enabled:true});
 const app=create({preset:unknown,ports:{state:createMemoryStatePort(),model:{chat:async request=>{calls++;lastRequest=request;return {text:'<cxx-story>正常</cxx-story>'};}}}});
 assert.equal((await app.runTurn('先检查')).status,'committed');assert.equal(calls,1);assert.ok(lastRequest.body.messages.some(row=>row.content.includes('{{future_unknown::x}}')),'未知宏按原生规则保留到请求');
 const ejs=structuredClone(unknown);ejs.prompts[0].content='<%= process.env.KEY %>';app.setPreset(ejs);assert.equal((await app.runTurn('明确不支持EJS')).status,'failed');assert.equal(calls,1,'EJS边界错误不触发模型请求');
 app.setPreset(minimal);assert.equal((await app.runTurn('修正后可继续')).status,'committed');assert.equal(calls,2);
 app.setPromptOptions({promptToggles:{chatHistory:false}});assert.equal((await app.runTurn('禁用历史')).status,'committed');assert.equal(calls,3);assert.ok(!lastRequest.body.messages.some(row=>row.content.includes('禁用历史')),'禁用历史标记按原生规则不装入本轮输入');
});
await test('世界书原位置、倒序预算优先级、次关键词逻辑和中文whole-word符合固定ST源码',async()=>{
 const entry=(id,order,content,extra={})=>({id,enabled:true,constant:true,insertion_order:order,content,extensions:{position:0},...extra});
 const info=activateWorldInfo({entries:[entry(1,5,'FIRST'),entry(2,10,'SECOND'),entry(3,20,'DEPTH',{extensions:{position:4,depth:0}})],budgetChars:100});assert.equal(info.before,'FIRST\nSECOND');assert.equal(info.injections[0].content,'DEPTH');
 assert.deepEqual(activateWorldInfo({entries:[entry(1,5,'LOW'),entry(2,10,'HIGH')],budgetChars:4}).used.map(row=>row.id),[],'原生累计包含换行，首次超预算后不继续装后续普通条目');
 assert.deepEqual(activateWorldInfo({entries:[entry(1,5,'LOW'),entry(2,10,'HIGH')],budgetChars:6}).used.map(row=>row.id),[2],'高优先条目含换行可放入、后条超额时保留已选高优先条目');
 const match=entry(4,1,'命中',{constant:false,keys:['公司'],secondary_keys:['枪','警'],selective:true,extensions:{position:0,match_whole_words:true,selectiveLogic:2}});
 assert.equal(activateWorldInfo({entries:[match],scan:'进入公司总部'}).used.length,1);assert.equal(activateWorldInfo({entries:[match],scan:'公司总部有警'}).used.length,0);
 assert.equal(activateWorldInfo({entries:[{...match,extensions:{...match.extensions,scan_depth:0}}],scan:'公司',history:[{content:'公司'}]}).used.length,0);
 const injected=assemblePrompt({preset:minimal,history:[{role:'user',content:'CURRENT'}],injections:info.injections});assert.deepEqual(injected.messages.map(row=>row.content),['CURRENT','DEPTH']);
});
await test('深度注入与固定ST1.19真实函数逐消息对照',async()=>{
 const url=new URL('../../.cache/debug223/host/app/public/scripts/openai.js',import.meta.url),source=fs.readFileSync(url,'utf8'),start=source.indexOf('async function populationInjectionPrompts('),finish=source.indexOf('\n}',start)+2;assert.ok(start>=0&&finish>start);
 const native=vm.runInNewContext('('+source.slice(start,finish)+')',{extension_prompt_roles:{SYSTEM:0,USER:1,ASSISTANT:2},extension_prompt_types:{IN_CHAT:1},getExtensionPromptMaxDepth:()=>8,getExtensionPrompt:async()=>''});
 const history=[{role:'user',content:'u1'},{role:'assistant',content:'a1'},{role:'user',content:'u2'}],injections=[{role:'system',content:'D0S',depth:0,order:100},{role:'assistant',content:'D0A',depth:0,order:100},{role:'user',content:'D1U',depth:1,order:200},{role:'system',content:'D1S',depth:1,order:10},{role:'system',content:'D8',depth:8,order:100}];
 const expected=await native(injections.map(row=>({...row,injection_depth:row.depth,injection_order:row.order})),structuredClone(history).reverse());assert.deepEqual(injectAtDepth(history,injections),JSON.parse(JSON.stringify(expected)));metrics.push({nativeComparison:'ST1.19 populationInjectionPrompts',sourceSha256:createHash('sha256').update(source).digest('hex'),cases:injections.length});
});
await test('正则分层与深度、原生$0/捕获组、容器HTML不执行',async()=>{
 const preset={extensions:{regex_scripts:[{findRegex:'/word (\\w+)/g',replaceString:'$0 / $1 / {{match}}',placement:[2],promptOnly:true,markdownOnly:false,minDepth:1,maxDepth:2}]}};
 assert.equal(transformText('word one',{preset,depth:1}),'word one / one / word one');assert.equal(transformText('word one',{preset,depth:0}),'word one');assert.equal(transformText('word one',{preset,depth:1,stage:'display'}),'word one');
 preset.extensions.regex_scripts=[{findRegex:'/x/g',replaceString:'<script>bad()</script>',placement:[2],markdownOnly:true}];assert.equal(transformText('x',{preset,stage:'display'}),'x');
});
await test('喵思考别名隔离假状态，正式两预设按原合同移除／折叠',async()=>{
 const raw='<think_nya~><UpdateVariable>[{"op":"replace","path":"/terminal/wallet/yen","value":999}]</UpdateVariable><ztl>{BAD}</ztl>内部思考</think_nya~><cxx-story>正式正文</cxx-story><UpdateVariable>[{"op":"replace","path":"/terminal/wallet/yen","value":100}]</UpdateVariable>';
 const parsed=parseReply(raw,{parser:chain.parser});assert.equal(parsed.raw,raw);assert.equal(parsed.protocol.patches.length,1);assert.equal(parsed.protocol.patches[0].value,100);assert.deepEqual(parsed.protocol.issues,[]);
 for(const entry of presets){const app=create({preset:entry.preset,presetId:entry.id}),shown=app.projectParsed(parsed);assert.ok(shown.display.paragraphs.every(row=>!row.text.includes('内部思考')));assert.equal(shown.display.auxiliary.some(row=>row.kind==='thinking'),entry.id==='reborn');}
});
await test('程序提交复用原计划及validateProgram，幂等、媒体、正文恢复和模型历史',async()=>{
 const base=create().rules.emptyRoot(),I=cardModule('运行时/identity.js'),choice=I.snapshot('street','',I.initialSetup('street')),initialized=chain.operations.plan(base,{action:'initialize'},{identity:choice,actorBinding:chain.actors.selected(base).binding});
 const state=createMemoryStatePort(),app=create({card:{data:{name:'程序规则回归',character_book:{entries:[]}}},initialState:initialized,ports:{state,model:{chat:async()=>({text:'<cxx-story>保存正文</cxx-story>'})}}});await app.runTurn('首轮');const narrative=app.narrativeNode.nodeId;
 const op={action:'actor-switch',actorId:'player'},saved=await app.commitAction(op,{operationId:'program-fixed',engineOperation:'actor-switch',media:[{mediaId:'p3b-media',src:'data:image/webp;base64,VEVTVA=='}]});assert.equal(saved.status,'committed');assert.equal(app.narrativeNode.nodeId,narrative);assert.equal(app.nodes.at(-1).message.kind,'program');
 assert.ok((await state.listRecords('media',app.identity.runId)).some(row=>row.mediaId==='p3b-media'));const revision=(await app.coordinator.context.revision)||0;assert.equal((await app.commitProgram(op,{operationId:'program-fixed'})).status,'replayed');assert.equal(app.nodes.length,2);assert.ok(app.transcript.every(row=>row.role!=='system'));
 await assert.rejects(app.commitAction(op,{plan:state=>{const altered=structuredClone(state);altered.terminal.wallet.yen=99;return altered;}}));
 assert.equal(app.nodes.length,2);assert.ok(revision>=0);
});
await test('持久候选重分析只校验原文、不重发正文；保存回执恢复',async()=>{
 const state=createMemoryStatePort();let calls=0,once=true;const commit=state.commit;state.commit=async operation=>{if(once){once=false;throw Error('合成保存失败');}return commit(operation);};
 const options={ports:{state,model:{chat:async()=>{calls++;return {text:'<cxx-story>唯一生成</cxx-story>'};}}}};const first=create(options);assert.equal((await first.runTurn('唯一输入')).status,'failed');const draft=(await state.listRecords('drafts',first.identity.runId))[0];
 const reopened=create(options);assert.equal((await reopened.reprocessCandidate(draft)).status,'committed');assert.equal(calls,1);assert.equal((await reopened.recoverCandidate(draft)).status,'committed');assert.equal(calls,1);
});
await test('回合准备票据随候选保存，重分析复用票据并与正文同事务结算',async()=>{
 const state=createMemoryStatePort();let prepared=0,generated=0,failed=true;const original=state.commit;state.commit=async operation=>{if(failed){failed=false;throw Error('合成提交失败');}return original(operation);};
 const options={card:{data:{name:'冻结票据回归',character_book:{entries:[]}}},ports:{state,model:{chat:async payload=>{generated++;assert.equal(payload.body.messages.map(row=>row.content).join('\n').split('FIXED_PREPARATION_TICKET').length-1,1);return {text:'<cxx-story>一次正文，一次结算</cxx-story>'};}}}};
 function attach(app){app.registerTurnParticipant('controlled-fixture',{prepare({nodeId,parentNodeId,actorBinding}){prepared++;return {schema:1,nodeId,parentNodeId,actorBinding,prompt:'FIXED_PREPARATION_TICKET'};},finalize({before,preparedContext}){assert.equal(preparedContext.schema,1);const settled=app.rules.settle({before,patches:[{op:'replace',path:'/terminal/wallet/yen',value:125},{op:'replace',path:'/terminal/wallet/earned',value:125}]});return {...settled,receipt:{ticketNodeId:preparedContext.nodeId}};}});return app;}
 const first=attach(create(options));assert.equal((await first.runTurn('冻结后生成')).status,'failed');const draft=(await state.listRecords('drafts',first.identity.runId))[0];assert.equal(draft.preparedContext['controlled-fixture'].nodeId,draft.nodeId);
 const recovered=attach(create(options));assert.equal((await recovered.reprocessCandidate(draft)).status,'committed');assert.equal(recovered.currentState.terminal.wallet.yen,125);assert.equal(prepared,1);assert.equal(generated,1);assert.equal((await state.readLineage(recovered.identity.runId)).length,1);
});
await test('来源SHA256与完整祖先、分支／版本／人物隔离，程序节点不造正文',async()=>{
 const identity={accountId:'a',runId:'r'},versions={contentVersion:'v1'},nodes=[{nodeId:'n1',parentId:null,operationId:'o1',branchId:'b',message:{raw:'正文一',input:{text:'行动一'},attemptId:'a1'}},{nodeId:'p1',parentId:'n1',operationId:'op',branchId:'b',changes:[{path:'/x',value:1}],message:{kind:'program'}},{nodeId:'n2',parentId:'p1',operationId:'o2',branchId:'b',message:{raw:'正文二',input:{text:'行动二'},attemptId:'a2'}}];
 const original=await sourceRows({nodes,identity,versions});assert.equal(original.length,4);assert.equal((await sourceRows({nodes,identity,versions,actorId:'npc'})).length,0);assert.equal((await sourceRows({nodes:nodes.map(node=>({...node,native:true})),identity,versions,actorId:'player'})).length,0);
 const changed=structuredClone(nodes);changed[0].message.raw='前文被编辑';assert.equal(validSource(original[2].ref,await sourceRows({nodes:changed,identity,versions})),false);assert.equal(validSource(original[0].ref,await sourceRows({nodes,identity,versions:{contentVersion:'v2'}})),false);
});
await test('数据库连续覆盖缺口保留原文、近期保留、不重复注入召回、超限付费前失败',async()=>{
 const rows=Array.from({length:10},(_,i)=>({ref:{nodeId:'n'+i},native:{role:'assistant',content:'原文'+i},pending:false}));
 const coverage={rows:[{id:'t0',nodeIds:['n0','n1'],fromNodeId:'n0',toNodeId:'n1',text:'最早纪要',recordIds:['M1']},{id:'t1',nodeIds:['n3','n4'],fromNodeId:'n3',toNodeId:'n4',text:'越过缺口的纪要',recordIds:['M2']}]};const selected=selectTimeline(rows,coverage,{recentTurns:3});assert.deepEqual(selected.coveredNodeIds,['n0','n1']);assert.equal(selected.rows.length,8);assert.ok(!selected.prompt.includes('越过缺口'));assert.deepEqual(selected.gaps,['n2','n3','n4','n5','n6']);
 let calls=0;const app=create({ports:{state:createMemoryStatePort(),model:{chat:async()=>{calls++;return {text:'<cxx-story>正文</cxx-story>'};}}},promptOptions:{contextSize:512,outputTokens:128}});assert.equal((await app.runTurn('预算不足')).status,'failed');assert.equal(calls,0);assert.equal((await app.coordinator.context).beforeState.terminal.wallet.yen,0);
});
await test('50／500／2000轮统一纪要体量与覆盖：无隐式模型调用，缺口绝不删原文',async()=>{
 for(const count of [50,500,2000]){
  const rows=Array.from({length:count},(_,i)=>({ref:{nodeId:'long-'+i},native:{role:'assistant',content:'轮次'+i+'；'+('已发生的行走与对话，保留明确的否定、计划与条件。'.repeat(20))},pending:false}));
  const old=count-6,records=[];for(let i=0;i<old;i+=50){const ids=rows.slice(i,Math.min(i+50,old)).map(row=>row.ref.nodeId);records.push({id:'timeline-'+i,nodeIds:ids,fromNodeId:ids[0],toNodeId:ids.at(-1),text:'该阶段已发生的行动、原有否定、条件与未结事项。'+i,recordIds:['M'+i]});}
  const start=performance.now(),complete=selectTimeline(rows,{rows:records},{recentTurns:6}),missing=selectTimeline(rows,{rows:records.filter(row=>row.id!=='timeline-0')},{recentTurns:6}),tokens=measureMessages(complete.rows)+estimateTokens(complete.prompt);
  assert.equal(complete.coveredNodeIds.length,old);assert.equal(complete.rows.length,6);assert.equal(missing.rows.length,count);assert.equal(complete.calls,0);assert.ok(tokens<measureMessages(rows.map(row=>row.native))/3);
  metrics.push({turns:count,fullRawEstimatedTokens:measureMessages(rows.map(row=>row.native)),unifiedEstimatedTokens:tokens,coveredTurns:complete.coveredNodeIds.length,recentTurns:complete.rows.length,missingPrefixRetainedTurns:missing.rows.length,implicitModelCalls:complete.calls,selectorMs:Math.round(performance.now()-start)});
 }
});
const report={at:new Date().toISOString(),scope:'真实维护源／正式预设／规则链／解析器／会话，合成模型与覆盖记录；非真实模型长档验收',passed:results.filter(row=>row.ok).length,total:results.length,results,metrics};
fs.writeFileSync(new URL('../reports/p3b-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');for(const row of results)console.log((row.ok?'PASS ':'FAIL ')+row.name+(row.error?'\n'+row.error:''));console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
