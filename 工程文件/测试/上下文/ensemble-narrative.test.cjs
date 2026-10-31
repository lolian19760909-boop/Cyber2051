'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../卡片源码/运行时/ensemble-state.js'),S=require('../../卡片源码/运行时/context-source.js'),O=require('../../卡片源码/运行时/player-operations.js'),L=require('../../卡片源码/运行时/loadout.js'),I=require('../../卡片源码/运行时/identity.js'),B=require('../../卡片源码/运行时/battle.js');
const copy=structuredClone,load=require('../lib/fixture-loader.cjs');
function initial(){const identity={...I.snapshot('street','',I.initialSetup('street'),{weapon:'pistol'}),setupToken:'actor_test'};return A.initialize(O.plan({terminal:{wallet:{yen:400,earned:0,spent:0}}},{action:'initialize'},{identity,newChat:true}));}
const control=(s,id)=>A.preview(s,A.planControl(s,id));
function source(f){f.top.CxxContext={generationBinding:type=>S.generationBinding(f.context.chat,{type,current:{...A.registry(f.context.chat.findLast(m=>m.variables)?.variables[0].stat_data).control,evidence:'saved-control'}})};}

test('ordinary narrative and extra MVU use the selected actor and its exact paths without injecting the original origin',async()=>{
 const f=load('growth-story.test.cjs',['storyFixture']).storyFixture();try{f.top.CxxLoadout=L;f.variables[I.KEY].background='ORIGINAL_PLAYER_PRIVATE_ORIGIN';f.context.chat=[{mes:'现有场景',variables:[{stat_data:control(initial(),'wb_10')}]}];source(f);
  await f.emit('GENERATION_AFTER_COMMANDS','normal',{automatic_trigger:false});assert.match(f.prompt(),/丰川祥子/);assert.match(f.prompt(),/"level":5/);assert.match(f.prompt(),/从据点取得的手枪/);assert.doesNotMatch(f.prompt(),/numericInput/);
  const publicPrompt=f.injected.get('cxx-city-public-context-v1').content;assert.match(publicPrompt,/当前user/);assert.match(publicPrompt,/不得把此人作为另一位NPC自由代演/);assert.doesNotMatch(publicPrompt,/ORIGINAL_PLAYER_PRIVATE_ORIGIN/);
  f.setExtra(true);await f.emit('GENERATION_AFTER_COMMANDS','normal',{});assert.match(f.prompt(),/\/terminal\/ensemble\/actors\/wb_10\/gameplay\/numericInput/);assert.doesNotMatch(f.prompt(),/\/terminal\/gameplay\/numericInput/);assert.equal(A.read(f.context.chat[0].variables[0].stat_data,'wb_10').wallet.yen,12000);
 }finally{f.service.destroy();}
});

test('rewriting or continuing a former actor reply keeps that actor in the prompt and extra MVU after control switches',async()=>{
 for(const type of ['regenerate','swipe','continue']){const f=load('growth-story.test.cjs',['storyFixture']).storyFixture();try{const before=control(initial(),'wb_10'),after=control(before,'wb_6'),binding={...before.terminal.ensemble.control,evidence:'original-reply'};
   f.context.chat=S.plan([{mes:'前轮',variables:[{stat_data:before}]},{mes:'当时输入',is_user:true},{mes:'旧回复',variables:[{stat_data:after}]}],{resolveBinding:()=>binding}).chat;source(f);
   await f.emit('GENERATION_AFTER_COMMANDS',type,{automatic_trigger:false});assert.match(f.prompt(),/丰川祥子/);assert.doesNotMatch(f.prompt(),/千早爱音/);f.setExtra(true);await f.emit('GENERATION_AFTER_COMMANDS','normal',{});assert.match(f.prompt(),/\/actors\/wb_10\/gameplay\/numericInput/);assert.equal(f.context.chat.at(-1).variables[0].stat_data.terminal.ensemble.control.actorId,'wb_6');
  }finally{f.service.destroy();}}
});

test('battle host freezes the selected actor and saves its result even when the later UI shows another actor',async t=>{
 const priorLoadout=global.CxxLoadout;global.CxxLoadout=L;t.after(()=>{if(priorLoadout===undefined)delete global.CxxLoadout;else global.CxxLoadout=priorLoadout;});
 const f=load('../当前/battle-host.test.cjs',['fixture']).fixture();try{const state=control(initial(),'wb_10');state.terminal.ensemble.actors.wb_10.gameplay=B.operation(A.read(state,'wb_10').gameplay,{action:'battle-start',id:'sako_fight',mode:'cheat',draft:{...B.seed(A.read(state,'wb_10').gameplay),enemies:[B.actor({id:'enemy',template:'thug'})]}});Object.assign(f.stat,state);const before=copy(state),requests=[];
  f.top.__cxx_player__.commit=async request=>{requests.push(copy(request));const row=f.c.chat[request.floor],v=row.variables[row.swipe_id||0];v.stat_data=O.plan(v.stat_data,request,{actorBinding:A.binding(v.stat_data,request.actorId)});};
  f.service.prepare('normal',f.stat,false);await f.user();const floor=f.assistant();assert.equal(f.service.pendingFor({floor,swipe:0}).actorId,'wb_10');await f.emit('MESSAGE_RECEIVED',floor,'normal');const live=f.c.chat[floor].variables[0].stat_data;live.terminal.ensemble.control={actorId:'wb_6',viewpointActorId:'wb_6',revision:2};await f.service.finish();const after=f.c.chat[floor].variables[0].stat_data;
  assert.equal(requests[0].actorId,'wb_10');assert.equal(A.read(after,'wb_10').gameplay.numeric.combat.round,1);assert.deepEqual(A.read(after,'wb_6'),A.read(before,'wb_6'));assert.deepEqual(after.terminal.gameplay,before.terminal.gameplay);assert.deepEqual(after.terminal.wallet,before.terminal.wallet);assert.equal(await f.service.finish(),false);
 }finally{f.service.destroy();}
});

test('a frozen battle cannot be submitted to another actor with identical combat values',()=>{let state=control(initial(),'wb_10');const game=A.read(state,'wb_10').gameplay;state.terminal.ensemble.actors.wb_10.gameplay=B.operation(game,{action:'battle-start',id:'owner_fight',mode:'cheat',draft:{...B.seed(game),enemies:[B.actor({id:'enemy',template:'thug'})]}});state.terminal.ensemble.actors.wb_6.gameplay=copy(state.terminal.ensemble.actors.wb_10.gameplay);const ticket={...B.prepare(A.read(state,'wb_10').gameplay,{id:'owner_round',roll:0}),actorId:'wb_10'};assert.throws(()=>O.plan(state,{action:'battle-resolve',actorId:'wb_6',pending:ticket},{actorBinding:A.binding(state,'wb_6')}),/另一人物/);});
