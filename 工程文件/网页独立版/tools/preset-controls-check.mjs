import assert from 'node:assert/strict';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {createWebSession} from '../src/app/session.mjs';

const chain={...cardRuleChain(),parser:cardParser()},accountId='preset-controls',state=createMemoryStatePort({accountId}),checks=[];
const preset=name=>({name,openai_max_context:32768,openai_max_tokens:1024,temperature:name==='A'?.7:1.1,prompts:[
 {identifier:'main',name:'主提示',role:'system',content:name+'_MAIN'},
 {identifier:'shared',name:'共用编号',role:'system',content:name+'_SHARED'},
 {identifier:'unused',name:'未编排条目',role:'system',content:name+'_UNUSED'},
 {identifier:'chatHistory',name:'对话',marker:true}
],prompt_order:[{character_id:100001,order:[{identifier:'main',enabled:true},{identifier:'shared',enabled:true},{identifier:'chatHistory',enabled:true}]}]});
const A=preset('A'),B=preset('B'),options={mode:'local',accountId,runId:'controls',ports:{state,model:{chat:async()=>{throw Error('本检查不调用模型');}}},chain,card:{data:{name:'设置回归',character_book:{entries:[]}}},preset:A,presetId:'A'};
const text=session=>session.buildPrompt('查看设置').prompt.messages.map(row=>row.content).join('\n');
let session=createWebSession(options);await session.restore();
assert.ok(text(session).includes('A_SHARED'));
session.setPromptOptions({promptToggles:{shared:false}});
assert.ok(!text(session).includes('A_SHARED'));
await session.saveContentPreferences();session.dispose();
session=createWebSession(options);await session.restore();
assert.equal(session.presetControls.find(row=>row.identifier==='shared').enabled,false);
assert.ok(!text(session).includes('A_SHARED'));checks.push('同一预设的关闭状态保存后恢复，实际提示同步关闭');
session.setPreset({...A},{id:'A'});
assert.equal(session.presetControls.find(row=>row.identifier==='shared').enabled,false);
checks.push('同一预设刷新内容时保留玩家开关');
session.setPreset(B,{id:'B'});
assert.equal(session.presetControls.find(row=>row.identifier==='shared').enabled,true,'旧预设开关不得覆盖新预设默认值');
assert.ok(text(session).includes('B_SHARED'));
assert.ok(!text(session).includes('A_SHARED'));
checks.push('切换预设采用新默认值，共用编号按新内容实际发送');
assert.ok(!session.presetControls.some(row=>row.identifier==='unused'),'未编排条目应通过预设编辑管理，不显示无效开关');
session.setPromptOptions({promptToggles:{unused:true}});
assert.ok(!text(session).includes('B_UNUSED'));
checks.push('开关列表对应预设执行顺序，未编排条目保持编辑器管理');
session.setPromptOptions({promptToggles:{shared:false}});await session.saveContentPreferences();session.dispose();
session=createWebSession(options);await session.restore();
assert.equal(session.presetId,'B');assert.equal(session.presetControls.find(row=>row.identifier==='shared').enabled,false);assert.ok(!text(session).includes('B_SHARED'));
checks.push('切换后新的玩家开关与预设一起保存并恢复');
await session.savePreset(B,{id:'B'});
assert.equal(session.presetControls.find(row=>row.identifier==='shared').enabled,true);assert.ok(text(session).includes('B_SHARED'));
checks.push('显式保存预设后沿既有语义采用该预设默认开关');session.dispose();
console.log(JSON.stringify({ok:true,checks,scope:'实际会话、规则链及提示装配；内存设置端口，无模型请求'},null,2));
