'use strict';
const Flow=require('../../卡片源码/运行时/opening-flow.js'),I=require('../../卡片源码/运行时/identity.js'),L=require('../../卡片源码/运行时/loadout.js'),H=require('../../卡片源码/运行时/player-host.js'),O=require('../../卡片源码/运行时/player-operations.js'),P=require('../../卡片源码/MVU/preferences.js');
const copy=structuredClone;
function fixture({storage=new Map(),key='A',existing=null,preferences,withCommit,onSend=()=>{}}={}){
 let id=key,delay=null,fail=false,sends=[],mutations=0,saves=0,reads=0;
 const initial={stat_data:{terminal:{wallet:{yen:500},unknown:{keep:1}},人物:{好感度:100}},unknown:{keep:2}};
 const row={mes:'<OpeningForm/>',swipe_id:0,swipes:Array.from({length:26},(_,i)=>i?'<OpeningPage id="'+i+'"/>':'<OpeningForm/>'),variables:Array.from({length:26},()=>copy(initial))};
 const ctx={chat:[row],characters:[{avatar:'fixture.png'}],characterId:0,getCurrentChatId:()=>id,chatMetadata:{variables:{external:{keep:3},...(preferences===undefined?{}:{__cxx_ui_preferences:copy(preferences)}),...(existing?{__cxx_identity:existing}:{})}},async saveChat(){saves++;const snapshot=copy([{chat_metadata:ctx.chatMetadata},...ctx.chat]);if(delay)await delay.promise;if(!fail)disk=snapshot;}};
 let disk=copy([{chat_metadata:ctx.chatMetadata},...ctx.chat]);
 const api={SillyTavern:{getContext:()=>ctx},getVariables:()=>copy(ctx.chatMetadata.variables),builtin:{duringGenerating:()=>false},async updateVariablesWith(fn){ctx.chatMetadata.variables=fn(copy(ctx.chatMetadata.variables));mutations++;},async setChatMessages([{swipe_id,swipes_data,swipes}]){if(swipes)row.swipes=swipes;row.swipe_id=swipe_id;row.mes=row.swipes[swipe_id];row.variables=swipes_data;mutations++;}};
 const read=H.createReader({api,readDisk:async()=>{reads++;return copy(disk);}});
 global.Cxx236VariableGuard={validateProgram:(a,b,o)=>O.validate(a,b,o.engineOperation)};
 const player=H.create({api,host:{assertPlayerWritable:async()=>{}},read,operations:O,identities:I,ui:{},saveTimeout:100});
 const flow=Flow.create({key,identity:I,loadout:L,storage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},readIdentity:()=>ctx.chatMetadata.variables.__cxx_identity,readPreferences:()=>preferences===undefined?{level:'medium',device:'desktop',gal:false}:P.read(ctx.chatMetadata.variables),readOpening:id=>require('../../卡片源码/开场/groups.json').beginnings.find(x=>x.id===id)?.text,prepare:()=>player.prepareOpening(),withCommit,submit:o=>player.completeOpening(o),verify:()=>player.waitForSaved({timeout:2000}),send:async command=>{onSend();sends.push(command);}});
 return {flow,player,row,ctx,storage,disk:()=>copy(disk),stats:()=>({mutations,saves,reads,sends}),delay(d){delay=d;},fail(v){fail=v;},switch(){id='B';flow.destroy();},read};
}
function ready(f,origin='street',scenario=2){f.flow.chooseOrigin(origin);if(origin==='custom')f.flow.patch({custom:'自定义背景',growth:{...I.initialSetup('custom'),level:30,attributes:{body:40,reflexes:20,intelligence:30,technical:25,cool:35}}});f.flow.next();f.flow.next();f.flow.next();f.flow.patch({loadout:origin==='custom'?{items:[]}:{weapon:'pistol'}});f.flow.next();f.flow.selectScenario(scenario);}
module.exports={fixture,ready};
