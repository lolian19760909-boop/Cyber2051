import assert from 'node:assert/strict';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';

const chain={...cardRuleChain(),parser:cardParser()},preset={prompts:[{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'chatHistory',enabled:true}]}]},card={runtimePolicy:{},data:{name:'字段接收回归',character_book:{entries:[]}}};
const checks=[],failures=[],observations=[];
async function scenario(name,patches,{expected=125,warning=false,body}={}){
 const accountId='patch-reception',runId=name,port=createMemoryStatePort({accountId});
 let text='<cxx-story>店员交付收据，你继续向街角走去。</cxx-story><UpdateVariable>'+(body??JSON.stringify(patches))+'</UpdateVariable>';
 const app=createWebSession({mode:'local',accountId,runId,ports:{state:port,model:{chat:async()=>({text})}},chain,card,preset});
 const before=app.rules.emptyRoot();before.terminal.wallet={yen:100,earned:100,spent:0};before.future={keep:7};
 await port.commit({...app.identity,nodeId:'opening',operationId:'opening',parentNodeId:null,expectedRevision:0,stateAfter:before,message:{kind:'opening',raw:'开场'}});await app.restore();
 try{
  const decoded=chain.parser.variableUpdates(text),result=await app.runTurn('继续行动'),saved=await port.readState(runId,'main');
  observations.push({name,status:result.status,issues:decoded.issues,yen:app.currentState.terminal.wallet.yen,diskYen:saved.data.terminal.wallet.yen,warnings:result.parameterWarnings});
  assert.equal(result.status,'committed',JSON.stringify(result.error));assert.equal(app.nodes.at(-1).message.raw,text);assert.equal(app.currentState.terminal.wallet.yen,expected,'可读字段应继续结算');assert.equal(saved.data.terminal.wallet.yen,expected);assert.deepEqual(app.currentState.future,{keep:7});assert.equal({}.polluted,undefined);
  if(warning)assert.ok(result.parameterWarnings.length,'不可读字段应由接收层说明处理结果');
  text='<cxx-story>你收好收据，走过街角。</cxx-story>';assert.equal((await app.runTurn('下一轮')).status,'committed');
  checks.push(name);
 }catch(error){failures.push({name,message:error.message});}finally{app.dispose();}
}
const good={op:'replace',path:'/terminal/wallet/yen',value:125};
await scenario('额外说明字段', [{...good,comment:'模型记账说明'}]);
await scenario('未知操作与正常字段', [{op:'remove',path:'/terminal/wallet/earned'},good],{warning:true});
await scenario('危险路径与正常字段', [{op:'add',path:'/__proto__/polluted',value:true},good],{warning:true});
await scenario('空项与正常字段', [null,good],{warning:true});
await scenario('缺值与正常字段', [{op:'replace',path:'/terminal/wallet/spent'},good],{warning:true});
await scenario('非字符串路径与正常字段', [{op:'add',path:['/terminal/rosterInput/-'],value:{}},good],{warning:true});
await scenario('未知状态字段与正常字段', [{op:'replace',path:'/unknown',value:1},good],{warning:true});
await scenario('语法不完整保留原状态与正文', [],{expected:100,warning:true,body:'[{"op":'});
await scenario('非数组保留原状态与正文', [],{expected:100,warning:true,body:'{"op":"replace"}'});
console.log(JSON.stringify({ok:!failures.length,checks,failures,observations,providerRequests:0},null,2));if(failures.length)process.exitCode=1;
