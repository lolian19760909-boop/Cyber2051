/** 酒馆式宽容检查：带协议瑕疵（孤立结束标签）的正文照常保存，瑕疵降级为警告、补丁不落库（变量
 *  本回合不结算）；同一正文无瑕疵时补丁正常结算。无网络、无Key、无真实供应商调用。 */
import assert from 'node:assert/strict';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';

const card={data:{name:'C',first_mes:'FIRST',character_version:'V1',extensions:{depth_prompt:{prompt:'DEPTH'}},character_book:{entries:[]}}};
const preset={prompts:[{identifier:'main',role:'system',content:'SYS-MAIN'},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'main',enabled:true},{identifier:'chatHistory',enabled:true}]}],new_chat_prompt:''};
const PATCH='<UpdateVariable><JSONPatch>[{"op":"replace","path":"/terminal/wallet/yen","value":1200},{"op":"replace","path":"/terminal/wallet/earned","value":1200}]</JSONPatch></UpdateVariable>';
const checks=[],check=async(name,fn)=>{await fn();checks.push(name);};

async function scenario(raw){
 const port=createMemoryStatePort({accountId:'tavern-parity-check'});
 const app=createWebSession({mode:'local',accountId:'tavern-parity-check',runId:'tavern-parity-check',
  ports:{state:port,model:{async chat(){return {text:raw,complete:true};}}},
  chain:{...cardRuleChain(),parser:cardParser()},card,preset,profile:{name:'U'},
  model:{adapter:'chat:deepseek',model:'deepseek-flash'}});
 await port.commit({...app.identity,nodeId:'opening',operationId:'create',parentNodeId:null,expectedRevision:0,stateAfter:app.rules.emptyRoot(),contentVersion:'3.0.0+check',message:{role:'assistant',kind:'opening',raw:'开场',display:[],input:null},createdAt:new Date().toISOString()});
 await app.restore();
 try{
  const result=await app.runTurn('玩家行动');
  const receipts=(await port.listRecords('receipts','tavern-parity-check')).filter(row=>Array.isArray(row.receipt?.patches));
  const patches=receipts.length?receipts.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0].receipt.patches:null;
  return {result,floor:app.nodes.at(-1),patches};
 }finally{app.dispose();}
}

await check('孤立结束标签：正文保存、警告可见、补丁不落库',async()=>{
 const {result,floor,patches}=await scenario('<cxx-story>通道里的灯管忽明忽暗。</cxx-story></cxx-story>'+PATCH);
 assert.equal(result.status,'committed',JSON.stringify(result.error));
 assert.ok(floor.message.raw.includes('通道里的灯管'),'原文完整保留');
 assert.ok((result.parameterWarnings||[]).some(row=>row.includes('协议警告')&&row.includes('孤立结束标签')),'协议瑕疵作为警告可见');
 assert.deepEqual(patches,[],'有瑕疵时补丁不落库');
});

await check('同一正文无瑕疵：补丁正常结算、无协议警告',async()=>{
 const {result,floor,patches}=await scenario('<cxx-story>通道里的灯管忽明忽暗。</cxx-story>'+PATCH);
 assert.equal(result.status,'committed',JSON.stringify(result.error));
 assert.ok(floor.message.raw.includes('通道里的灯管'),'原文完整保留');
 assert.ok((patches||[]).length>0,'无瑕疵时补丁正常落库');
 assert.ok(!(result.parameterWarnings||[]).some(row=>row.includes('协议警告')),'无协议警告');
});

console.log(JSON.stringify({ok:true,checks:checks.length,names:checks,scope:'Real session engine; no player save, no network, no supplier call'}));
