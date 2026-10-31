'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../卡片源码/运行时/ensemble-state.js'),O=require('../../卡片源码/运行时/player-operations.js'),T=require('../../卡片源码/运行时/tactical-engine.js'),H=require('../../卡片源码/运行时/tactical-host.js'),L=require('../../卡片源码/运行时/loadout.js');
const copy=structuredClone,load=require('../lib/fixture-loader.cjs'),pause=()=>new Promise(r=>setImmediate(r));
function fixture(t){
 const {initial,control}=load('../上下文/ensemble-narrative.test.cjs',['initial','control']),stat=control(initial(),'wb_10'),events=new Map(),requests=[];
 const c={characters:[{avatar:'tactical-fixture.png'}],characterId:0,getCurrentChatId:()=> 'tactical-fixture',chat:[{mes:'合成现场',swipe_id:0,variables:[{stat_data:stat}]}],chatMetadata:{variables:{}},eventTypes:{MESSAGE_SENT:'MESSAGE_SENT'},saveChat:async()=>{}};
 const api={SillyTavern:{getContext:()=>c},getVariables:()=>copy(c.chatMetadata.variables),updateVariablesWith:async fn=>{c.chatMetadata.variables=fn(copy(c.chatMetadata.variables));},eventOn(n,fn){events.set(n,fn);},eventRemoveListener:n=>events.delete(n)};
 const current=()=>c.chat.findLast(m=>m.variables)?.variables[0].stat_data;
 const top={CxxCrypto:require('../../卡片源码/运行时/crypto-compat.js'),__cxx_player__:{waitForSaved:async()=>{},saveState:()=>({}),commit:async request=>{requests.push(copy(request));const row=c.chat.findLast(m=>m.variables);row.variables[0].stat_data=O.plan(current(),request,{actorBinding:A.binding(current(),request.actorId)});}}};
 const service=H.create({api,top,T}).start();t.after(()=>service.destroy());return {c,api,top,service,requests,current,switch:id=>{const row=c.chat.findLast(m=>m.variables);row.variables[0].stat_data=control(current(),id);},emit:async(n,...args)=>events.get(n)?.(...args)};
}
test('tactical operations and waiting saves remain bound to their selected actor',async t=>{
 const f=fixture(t),before=copy(f.current());await f.service.operation('tactical-initialize',{supplies:{light:5},magazines:{weapon_1:2}});assert.equal(f.requests[0].actorId,'wb_10');assert.equal(A.read(f.current(),'wb_10').gameplay.inventory.tac_supply_light.quantity,5);for(const id of ['player','wb_6'])assert.deepEqual(A.read(f.current(),id),A.read(before,id));
 let release;f.top.__cxx_player__.waitForSaved=()=>new Promise(r=>release=r);const pending=f.service.operation('tactical-enable',{enabled:true});await pause();f.switch('wb_6');release();await assert.rejects(pending,/扮演人物已经切换/);assert.equal(f.requests.length,1);
});
test('an intent response received after a control switch cannot become the new actor action',async t=>{
 const f=fixture(t);let release;f.top.__cxx_utility__={request:()=>new Promise(r=>release=r)};const pending=f.service.parseIntent('观察');await pause();f.switch('wb_6');release({intent:{kind:'observe'}});await assert.rejects(pending,/战况已变化/);assert.equal(f.service.read().intent,null);assert.equal(f.requests.length,0);
});
test('native user insertion anchors the saved tactical result to the assistant floor and rerolls retain its actor',async t=>{
 const f=fixture(t),pair=load('../当前/tactical-narrative.test.cjs',['pair']).pair();pair.after.tactical.encounter.source={floor:0,hash:L.hash(JSON.stringify([[false,false,0,'合成现场']]))};assert(pair.after.tactical.encounter.narrativePending);f.current().terminal.ensemble.actors.wb_10.gameplay=copy(pair.after);
 f.top.CxxContext={generationBinding:type=>({actorId:['regenerate','continue','swipe'].includes(type)?'wb_10':A.registry(f.current()).control.actorId})};
 const prompt=await f.service.prepare('normal');assert.match(prompt,/战术结算事实/);f.c.chat.push({is_user:true,mes:'请描写已结算节点',swipe_id:0});await f.emit('MESSAGE_SENT',1);f.c.chat.push({is_user:false,mes:'合成回复',swipe_id:0,variables:[{stat_data:copy(f.current())}]});
 const base=f.service.narrativeBase();assert.equal(base?.actorId,'wb_10');assert.equal(base.source.floor,2);assert.equal(base.game.inventory.tac_supply_light.quantity,28);await f.service.operation('tactical-enable',{enabled:false,handoff:true});f.switch('wb_6');
 for(const type of ['regenerate','swipe','continue']){assert.equal(await f.service.prepare(type),prompt);assert.equal(f.service.narrativeBase().actorId,'wb_10');}
 assert.equal(A.registry(f.current()).control.actorId,'wb_6');f.c.chat[1].mes='改写前文';assert.equal(f.service.narrativeBase(),null);
});
