'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const T=require("../../卡片源码/运行时/talents.js"),G=require("../../卡片源码/运行时/gameplay.js"),I=require("../../卡片源码/运行时/identity.js");
const A=require("../../卡片源码/运行时/gameplay-actions.js"),H=require("../../卡片源码/运行时/experience-host.js"),S=require("../../卡片源码/运行时/story-summaries.js");
const E=require("../../卡片源码/数值引擎/src/engine.js");
const copy=structuredClone;
const initial=()=>T.initialize(I.initialSetup('street'),'street');
const stat=growth=>({other:{keep:true},terminal:{wallet:{yen:300,spent:0,earned:300},gameplay:{schema:1,inventory:{},equipment:{},blueprints:{},skills:{},resources:{},events:{},results:{},...(growth?{growth}:{}),unknown:{keep:true}}}});
function storyFixture(){
  const handlers=new Map(),injected=new Map(),timeouts=new Map();let n=0,extra=false,chatId='story';
  const variables={[I.KEY]:I.snapshot('street','',I.initialSetup('street')),[S.KEY]:S.create(0)};
  const context={characters:[{avatar:'fixture.png'}],characterId:0,chat:[{mes:'opening',variables:[{stat_data:stat()}]}],getCurrentChatId:()=>chatId,eventTypes:Object.fromEntries(['CHAT_CHANGED','GENERATION_AFTER_COMMANDS','GENERATION_ENDED','GENERATION_STOPPED'].map(x=>[x,x]))};
  const api={SillyTavern:{getContext:()=>context},getVariables:()=>variables,Mvu:{isDuringExtraAnalysis:()=>extra},
    eventOn:(id,fn)=>handlers.set(id,fn),eventRemoveListener:id=>handlers.delete(id),setTimeout:fn=>{timeouts.set(++n,fn);return n;},clearTimeout:id=>timeouts.delete(id),
    injectPrompts(rows){rows.forEach(p=>injected.set(p.id,p));return {uninject(){rows.forEach(p=>injected.delete(p.id));}};},
    updateVariablesWith:()=>{throw Error('This check must not write numeric state or metadata');}};
  const top={localStorage:{getItem:()=>JSON.stringify({autoEnabled:false,syncStory:false})},document:{body:{hasAttribute:()=>false}}};
  const service=H.create({api,top,identities:I,summaries:S,talents:T,numeric:E}).start();
  return {service,context,variables,injected,top,api,setExtra:v=>extra=v,changeChat:v=>chatId=v,
    emit:async(name,...args)=>handlers.get(name)?.(...args),prompt:()=>injected.get('cxx-character-growth-v1')?.content||''};
}

for(const mode of ['swipe','regenerate'])test(mode+' excludes discarded awards in main prompt and extra MVU',async()=>{
  const f=storyFixture();try{
    const base=initial(),discarded=G.growth.planReward(base,T.rules,{id:'old_reward',source:{kind:'story',id:'old_scene'},xp:1000}).state;
    f.context.chat=[{is_user:false,mes:'起点',variables:[{stat_data:stat(base)}]},{is_user:true,mes:'进行行动'},{is_user:false,mes:'被重写的结局',variables:[{stat_data:stat(discarded)}]}];
    await f.emit('GENERATION_AFTER_COMMANDS',mode,{automatic_trigger:false},false);
    assert.match(f.prompt(),/"xp":0/);assert.doesNotMatch(f.prompt(),/"xp":1000/);
    await f.emit('GENERATION_ENDED');f.context.chat[2]={is_user:false,mes:'新结局',swipe_id:1,variables:[{stat_data:stat(discarded)},{stat_data:stat(discarded)}]};
    f.setExtra(true);await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);
    assert.match(f.prompt(),/"xp":0/);assert.doesNotMatch(f.prompt(),/"xp":1000/);
  }finally{f.service.destroy();}
});
test('unrelated helper calls, chat change and unload remove growth injections',async()=>{
  const f=storyFixture();try{
    await f.emit('GENERATION_AFTER_COMMANDS','normal',{automatic_trigger:false});assert.ok(f.injected.size);
    await f.emit('GENERATION_AFTER_COMMANDS','normal',{});assert.equal(f.injected.size,0);
    await f.emit('GENERATION_AFTER_COMMANDS','normal',{automatic_trigger:false});f.changeChat('other');await f.emit('CHAT_CHANGED');assert.equal(f.injected.size,0);
    f.context.chat=[{mes:'新的聊天',variables:[{stat_data:stat(initial())}]}];await f.emit('GENERATION_AFTER_COMMANDS','continue',{automatic_trigger:false});assert.match(f.prompt(),/已保存角色成长/);
    f.service.destroy();assert.equal(f.injected.size,0);
  }finally{f.service.destroy();}
});
test('invalid saved growth is preserved and does not restart from identity',async()=>{
  const f=storyFixture();try{
    const broken=initial();broken.perkPoints+=50;f.context.chat[0].variables=[{stat_data:stat(broken)}];
    await f.emit('GENERATION_AFTER_COMMANDS','normal',{automatic_trigger:false});assert.match(f.prompt(),/成长记录待核对/);assert.doesNotMatch(f.prompt(),/首次成长保存/);assert.equal(broken.perkPoints,50);
  }finally{f.service.destroy();}
});
test('a pruned reroll baseline never reinitializes growth from the opening',async()=>{
  const f=storyFixture();try{
    f.context.chat=[{mes:'已清理变量的旧楼层'},{is_user:true,mes:'再试一次'},{mes:'待重写',variables:[{stat_data:stat(initial())}]}];
    await f.emit('GENERATION_AFTER_COMMANDS','swipe',{automatic_trigger:false});assert.match(f.prompt(),/重写前的成长快照已清理/);assert.doesNotMatch(f.prompt(),/首次成长保存/);
    f.setExtra(true);await f.emit('GENERATION_AFTER_COMMANDS','normal',{});assert.match(f.prompt(),/重写前的成长快照已清理/);
  }finally{f.service.destroy();}
});
function actionFixture(growth){
  const f={context:{characterKey:'fixture.png',chatId:'fixture'},stat:stat(growth),records:{},messages:[],sent:0,recordWrites:0};
  f.messages.push({is_user:false,mes:'已有剧情',variables:[{stat_data:copy(f.stat)}]});
  const host={read:async()=>copy({...f,catalog:{growthIdentity:I.snapshot('street','',I.initialSetup('street'))},sendReady:true}),lock:async fn=>fn(),getRecord:async id=>copy(f.records[id]),
    putRecord:async r=>{f.recordWrites++;f.records[r.id]=copy(r);},send:async text=>{assert.ok(Object.keys(f.records).length);f.sent++;f.messages.push({is_user:true,mes:text});}};
  // Nonserializable test helpers are intentionally not exposed in the read snapshot.
  host.read=async()=>({context:copy(f.context),stat:copy(f.stat),records:copy(f.records),messages:copy(f.messages),catalog:{growthIdentity:I.snapshot('street','',I.initialSetup('street'))},sendReady:true});
  f.restart=()=>A.create({gameplay:{...G,plan:T.plan,prompt:T.prompt},host,hash:async v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'),uuid:crypto.randomUUID,allowGameplay:r=>['talent-allocate','growth-initialize'].includes(r.action)});
  f.client=f.restart();f.reply=(t,{receipt=true,partial=false}={})=>{
    let after=copy(f.stat);for(const change of t.plan.changes){let p=after;for(const key of change.path.slice(0,-1))p=p[key]||(p[key]={});p[change.path.at(-1)]=copy(change.after);}
    if(receipt)after.terminal.gameplay.results[t.id]={requestHash:t.requestHash,status:'success',reason:'夹具模拟MVU已保存'};
    if(partial)after.terminal.gameplay.growth.perkPoints++;
    f.stat=after;f.messages.push({is_user:false,mes:'确认此次成长',variables:[{stat_data:copy(after)}]});
  };return f;
}
test('initialization and talent allocation confirm only after matching saved MVU, then survive reload',async()=>{
  const f=actionFixture();const before=copy(f.stat),t=await f.client.prepare({action:'growth-initialize'});
  assert.equal((await f.client.confirm(t,'cancel')).status,'cancelled');assert.equal(f.recordWrites,0);
  assert.equal((await f.client.confirm(t,'confirm')).status,'submitted');assert.deepEqual(f.stat,before);assert.equal(f.sent,1);
  f.client=f.restart();assert.equal((await f.client.confirm(t,'confirm')).status,'unconfirmed');assert.equal(f.sent,1);
  f.reply(t);assert.equal((await f.client.inspect(t.id)).status,'success');assert.ok(f.records[t.id].confirmed.stateHash);
  const base=f.stat.terminal.gameplay.growth;
  const rewarded=G.growth.planReward(base,T.rules,{id:'story_1',source:{kind:'story',id:'achievement'},xp:1000,perkPoints:1}).state;
  f.stat.terminal.gameplay.growth=rewarded;f.messages.push({is_user:false,mes:'达成成果',variables:[{stat_data:copy(f.stat)}]});
  const draft=T.edit(rewarded,T.build(rewarded),{kind:'perk',id:'Body_Central_Milestone_1',delta:1});
  const allocation=await f.client.prepare({action:'talent-allocate',build:draft});await f.client.confirm(allocation,'confirm');f.reply(allocation);
  assert.equal((await f.client.inspect(allocation.id)).status,'success');assert.equal(T.read(f.stat.terminal.gameplay.growth).perks.Body_Central_Milestone_1,1);
  assert.deepEqual(f.stat.terminal.wallet,before.terminal.wallet);assert.deepEqual(f.stat.other,before.other);
  f.client=f.restart();assert.equal((await f.client.inspect(allocation.id)).status,'success');assert.equal(f.sent,2);
  await assert.rejects(f.client.prepare({action:'buy',id:'shop'}),{code:'feature-pending'});
});
test('partial/missing receipt and changed branches cannot become successful allocations',async()=>{
  for(const mode of ['partial','missing','branch']){
    const f=actionFixture(),t=await f.client.prepare({action:'growth-initialize'});await f.client.confirm(t,'confirm');f.reply(t,{partial:mode==='partial',receipt:mode!=='missing'});
    if(mode==='branch')f.messages[0].swipe_id=1;
    assert.equal((await f.client.inspect(t.id)).status,'unconfirmed',mode);
    await assert.rejects(f.client.prepare({action:'growth-initialize'}),{code:'action-unconfirmed'});assert.equal(f.sent,1);
  }
});

test('combat prompt reads the saved branch without inventing a round result',async()=>{
  const f=storyFixture();try{
    const B=require('../../卡片源码/运行时/battle.js'),base=stat(initial());base.terminal.gameplay.numeric=E.initialNumeric(base.terminal.gameplay);const fight=B.operation(base.terminal.gameplay,{action:'battle-start',mode:'cheat',id:'battle',draft:{...B.seed(base.terminal.gameplay),enemies:[B.actor({id:'thug_1',template:'thug'})]}});
    const active=copy(base);active.terminal.gameplay=fight;
    const stopped=copy(active);stopped.terminal.gameplay=B.operation(fight,{action:'battle-close',battleId:'battle',reason:'recovery',expected:JSON.stringify(fight.numeric.combat)});
    f.context.chat=[{mes:'分支',swipe_id:0,variables:[{stat_data:active},{stat_data:stopped}]}];
    await f.emit('GENERATION_AFTER_COMMANDS','normal',{automatic_trigger:false});const hint=f.prompt().split('\n').find(x=>x.startsWith('【逐轮战斗】'));assert.ok(hint);assert.doesNotMatch(hint,/%/);assert.doesNotMatch(f.prompt(),/numericInput/);
    await f.emit('GENERATION_AFTER_COMMANDS','normal',{automatic_trigger:false});assert.ok(f.prompt().includes(hint));
    f.context.chat[0].swipe_id=1;await f.emit('GENERATION_AFTER_COMMANDS','normal',{automatic_trigger:false});assert.doesNotMatch(f.prompt(),/【逐轮战斗】/);
    f.setExtra(true);await f.emit('GENERATION_AFTER_COMMANDS','normal',{});assert.match(f.prompt(),/numericInput/);assert.doesNotMatch(f.prompt(),/【逐轮战斗】/);
  }finally{f.service.destroy();}
});

test('combat prompt does not invent odds for an unregistered opponent',async()=>{
  const f=storyFixture();try{
    const active=stat(initial());active.terminal.gameplay.numeric=E.initialNumeric(active.terminal.gameplay);Object.assign(active.terminal.gameplay.numeric.combat,{active:true,id:'unknown_battle',enemies:[{id:'unknown_1',profileId:'unknown_profile'}]});
    f.context.chat=[{mes:'情报不足',variables:[{stat_data:active}]}];await f.emit('GENERATION_AFTER_COMMANDS','normal',{automatic_trigger:false});const hint=f.prompt().split('\n').find(x=>x.startsWith('【战斗控制】'));assert.ok(hint);assert.doesNotMatch(hint,/%/);assert.equal(active.terminal.gameplay.numeric.combat.enemies[0].profileId,'unknown_profile');
  }finally{f.service.destroy();}
});
