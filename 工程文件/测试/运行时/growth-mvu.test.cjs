'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const z=require('../../独立制卡器/node_modules/zod');
const T=require("../../卡片源码/运行时/talents.js"),G=require("../../卡片源码/运行时/gameplay.js"),I=require("../../卡片源码/运行时/identity.js");
const Schema=require("../../卡片源码/MVU/schema.js"),Guard=require("../../卡片源码/MVU/variables.js");
const Policy=require("../../卡片源码/MVU/variable-policy.js"),{executor}=require("../MVU/mvu-fixture.cjs");
const copy=structuredClone,schema=Schema.build(z,{talents:T});
const add=(path,value)=>({op:'add',path,value}),replace=(path,value)=>({op:'replace',path,value});
const events=value=>add('/terminal/gameplay/numericInput',value);
const identity=()=>I.snapshot('street','',I.initialSetup('street'));
function fixture({growth=false,custom=false,parent=true}={}){
  const handlers=new Map(),chosen=custom?I.snapshot('custom','夹具背景',{...I.initialSetup('custom'),level:999,perkPoints:888,attributes:{body:99,reflexes:99,intelligence:99,technical:99,cool:99}}):identity();
  const stat={高松灯:{好感度:100},terminal:{wallet:{yen:500,earned:500,spent:0},quests:{old:{state:'历史保留'}},...(parent?{gameplay:{schema:1,...Object.fromEntries(G.TABLES.map(k=>[k,{}])),...(growth?{growth:T.initialize(chosen.growthSetup,chosen.id)}:{}),extension:{keep:true}}}:{})},unknown:{keep:1}};
  const c={chat:[{mes:'开场'},{is_user:true,mes:'进行已确认的行动'}]},api={SillyTavern:{getContext:()=>c},eventOn(n,f){if(!handlers.has(n))handlers.set(n,new Set());handlers.get(n).add(f);},eventRemoveListener:(n,f)=>handlers.get(n)?.delete(f)};
  let intercept=null;
  const emit=async(n,...args)=>{for(const f of handlers.get(n)||[])await f(...args);await intercept?.(n,...args);},mvu=executor(emit);api.Mvu={parseMessage:mvu.run,events:{COMMAND_PARSED:Guard.events.parsed,VARIABLE_UPDATE_ENDED:Guard.events.ended}};
  const data={stat_data:stat,keep:{metadata:1},schema:copy(mvu.schema(copy(stat)))};
  data.schema.properties.terminal.extensible=true;data.schema.properties.terminal.recursiveExtensible=true;
  function extensible(node){if(!node||node.type!=='object')return;node.extensible=true;node.recursiveExtensible=true;for(const child of Object.values(node.properties||{}))extensible(child);}
  extensible(data.schema.properties.terminal.properties.gameplay);data.schema.strictSet=true;data.schema.strictTemplate=false;
  const policy={growthIdentity:chosen,mapIndex:{central:['plaza']}};
  const service=Guard.create({api,win:{},runtime:{key:()=> 'fixture'},schema,greetings:[],policy:()=>policy});
  return {data,policy,service,context:c,setIntercept:fn=>intercept=fn,run:async patches=>{const next=copy(data);await mvu.run('<UpdateVariable><JSONPatch>'+JSON.stringify(patches)+'</JSONPatch></UpdateVariable>',next);return copy(next);}};
}
test('MVU executor saves confirmed initial growth while preserving other values and metadata',async()=>{
  const f=fixture();try{
    const s=T.initialize(f.policy.growthIdentity.growthSetup,'street'),next=await f.run([add('/terminal/gameplay/growth',s)]);
    assert.deepEqual(next.stat_data.terminal.gameplay.growth,s);assert.equal(f.service.state().lastError,'');assert.deepEqual(next.stat_data.terminal.wallet,f.data.stat_data.terminal.wallet);assert.deepEqual(next.keep,f.data.keep);
    Object.assign(f.data,copy(next));assert.deepEqual(await f.run([replace('/terminal/gameplay/growth',{...s,perkPoints:999})]),f.data);
    const reward=G.growth.planReward(s,T.rules,{id:'after_init',source:{kind:'story',id:'saved_start'},perkPoints:1}).state;
    const later=await f.run([events([{id:'after_init',kind:'reward',source:{kind:'story',id:'saved_start'},perkPoints:1}])]);
    assert.deepEqual(later.stat_data.terminal.gameplay.growth,reward,'new growth inherits the actual MVU extensible schema');
  }finally{f.service.destroy();}
});
test('MVU creates a missing empty gameplay parent without granting assets',async()=>{
  const f=fixture({parent:false});try{
    const s=T.initialize(f.policy.growthIdentity.growthSetup,'street'),container={schema:1,...Object.fromEntries(G.TABLES.map(k=>[k,{}])),growth:s};
    const next=await f.run([add('/terminal/gameplay',container)]);assert.deepEqual(next.stat_data.terminal.gameplay,container);
    container.inventory.free={quantity:1};assert.deepEqual(await f.run([add('/terminal/gameplay',container)]),f.data);
  }finally{f.service.destroy();}
});
test('MVU saves XP levels plus direct awards atomically and rejects repeat IDs or forged receipts',async()=>{
  const f=fixture({growth:true});try{
    const old=f.data.stat_data.terminal.gameplay.growth,earned=G.growth.planReward(old,T.rules,{id:'lesson_1',source:{kind:'training',id:'practice_1'},xp:4000,attributePoints:2,perkPoints:3}).state;
    const patches=[events([{id:'lesson_1',kind:'reward',source:{kind:'training',id:'practice_1'},xp:4000,attributePoints:2,perkPoints:3}])];
    const next=await f.run(patches);assert.deepEqual(next.stat_data.terminal.gameplay.growth,earned);assert.equal(f.service.state().lastError,'');
    assert.deepEqual(await f.run([replace('/terminal/gameplay/growth/xp',4000)]),f.data,'model-computed totals roll back');
    const forged=copy(earned);forged.rewards.lesson_1.earned.perkPoints++;forged.perkPoints++;
    assert.deepEqual(await f.run([replace('/terminal/gameplay/growth',forged)]),f.data,'balanced-looking forged receipt still rolls back');
    Object.assign(f.data,copy(next));const repeated=await f.run(patches);assert.deepEqual(repeated.stat_data,f.data.stat_data,'duplicate event cannot award twice');assert.deepEqual(repeated.delta_data,{});assert.equal(f.service.state().lastError,'');
  }finally{f.service.destroy();}
});
test('MVU accepts a matching allocation and action result together; partial batches roll back',async()=>{
  const f=fixture({growth:true});try{
    const old=f.data.stat_data.terminal.gameplay.growth,draft=T.edit(old,T.build(old),{kind:'attribute',id:'body',delta:1});
    const plan=T.plan(f.data.stat_data,{growthIdentity:f.policy.growthIdentity},{action:'talent-allocate',build:draft}),ticket={id:'act_fixture',requestHash:'fixturehash',plan};f.policy.growthAction=ticket;
    const result={requestHash:ticket.requestHash,status:'success',reason:'本次点数保存'},patches=[replace('/terminal/gameplay/growth',plan.changes[0].after),add('/terminal/gameplay/results/'+ticket.id,result)];
    const next=await f.run(patches);assert.equal(f.service.state().lastError,'');assert.equal(G.verify(ticket,next.stat_data).status,'success');
    assert.deepEqual(await f.run(patches.slice(0,1)),f.data);assert.deepEqual(await f.run(patches.slice(1)),f.data);
    assert.throws(()=>schema.program(f.data.stat_data,next.stat_data),/正文MVU/);
    f.policy.growthAction=null;assert.deepEqual(await f.run(patches.slice(0,1)),f.data,'story cannot spend player points without a confirmed action');
  }finally{f.service.destroy();}
});
test('custom high starts and old invalid growth remain intact for unrelated valid changes',async()=>{
  const f=fixture({custom:true});try{
    const s=T.initialize(f.policy.growthIdentity.growthSetup,'custom'),next=await f.run([add('/terminal/gameplay/growth',s)]);assert.equal(next.stat_data.terminal.gameplay.growth.level,999);assert.equal(next.stat_data.terminal.gameplay.growth.perkPoints,888);
    f.data.stat_data=copy(next.stat_data);f.data.stat_data.terminal.gameplay.growth.perkPoints='旧异常';
    const separate=await f.run([replace('/terminal/wallet/yen',505),replace('/terminal/wallet/earned',505)]);assert.equal(separate.stat_data.terminal.wallet.yen,505);assert.equal(separate.stat_data.terminal.gameplay.growth.perkPoints,'旧异常');
  }finally{f.service.destroy();}
});
test('growth does not open quest rewards, shop fields, or allocation prerequisites',async()=>{
  const f=fixture({growth:true});try{
    const old=f.data.stat_data.terminal.gameplay.growth,quest=G.growth.planReward(old,T.rules,{id:'quest_1',source:{kind:'quest',id:'mission_1'},xp:1000}).state;
    for(const patches of [[replace('/terminal/gameplay/growth',quest)],[add('/terminal/gameplay/inventory/free',{quantity:1})],[replace('/terminal/quests/old/state','完成')]])assert.deepEqual(await f.run(patches),f.data);
    const bad=copy(old);bad.perks.Body_Left_Milestone_2=1;assert.deepEqual(await f.run([replace('/terminal/gameplay/growth',bad)]),f.data);
  }finally{f.service.destroy();}
});
test('variable policy binds only the current chat and current player growth request',()=>{
  const context={characterKey:'fixture.png',chatId:'story'},ticket={id:'act_test',context,plan:{request:{action:'talent-allocate'}}};
  const vars={__cxx_identity:identity(),__cxx_gameplay_actions:{records:{act_test:{id:'act_test',status:'submitted',ticket}}}},chat=[{is_user:true,mes:'[东京都2051正文行动 act_test]'}];
  const win={Cxx233Updater:{readSeed:()=>({registry:{},mapIndex:{}}),host:{getContext:()=>context,readState:()=>({registry:{}})}}};
  const policy=Policy.create({api:{getVariables:()=>vars,SillyTavern:{getContext:()=>({chat})}},win});
  assert.equal(policy().growthAction,ticket);chat[0].mes='下一轮普通行动';assert.equal(policy().growthAction,undefined);chat[0].mes='[东京都2051正文行动 act_test]';ticket.context={...context,chatId:'old'};assert.equal(policy().growthAction,undefined);
});

test('numeric bridge leaves encounter transitions to the player and saves narrative resources with wallet atomically',async()=>{
  const f=fixture({growth:true});try{
    const input=[{id:'fight_begin',kind:'encounter',encounterId:'fight_1',active:true,playerTags:['gun'],enemies:[{id:'guard_1',template:'guard',district:'corporate',tags:['armored']}]},
      {id:'wound_1',kind:'resource',target:'player',resource:'hp',amount:-12.5,reason:'正文受伤'},
      {id:'hit_1',kind:'resource',target:'guard_1',resource:'hp',amount:-8.25,reason:'守卫受伤'}];
    assert.deepEqual((await f.run([events(input),replace('/terminal/wallet/yen',450),replace('/terminal/wallet/spent',50)])).stat_data,f.data.stat_data);assert.match(f.service.state().lastError,/玩家面板/);
    const next=await f.run([events([input[1]]),replace('/terminal/wallet/yen',450),replace('/terminal/wallet/spent',50)]);
    assert.equal(f.service.state().lastError,'');assert.equal(next.stat_data.terminal.gameplay.numeric.vitals.hp,87.5);
    assert.equal(next.stat_data.terminal.wallet.spent,50);assert.equal(next.stat_data.terminal.gameplay.numericInput,undefined);assert.deepEqual(next.stat_data.unknown,f.data.stat_data.unknown);
    Object.assign(f.data,copy(next));const retry=await f.run([events([input[1]])]);assert.deepEqual(retry.stat_data,next.stat_data);assert.equal(f.service.state().lastError,'');
    const stop=await f.run([events([{id:'fight_end',kind:'encounter',encounterId:'fight_1',active:false}])]);assert.deepEqual(stop.stat_data,f.data.stat_data);assert.match(f.service.state().lastError,/玩家面板/);
  }finally{f.service.destroy();}
});

test('numeric bridge combines first confirmed initialization and events with or without gameplay parent',async()=>{
  for(const parent of [false,true]){
    const f=fixture({parent});try{
      const growth=T.initialize(f.policy.growthIdentity.growthSetup,'street'),value=parent?growth:{schema:1,...Object.fromEntries(G.TABLES.map(k=>[k,{}])),growth};
      const next=await f.run([add(parent?'/terminal/gameplay/growth':'/terminal/gameplay',value),events([{id:'first_award',kind:'reward',source:{kind:'story',id:'opening_action'},xp:1000},{id:'first_wound',kind:'resource',resource:'hp',amount:-4,reason:'擦伤'}])]);
      assert.equal(f.service.state().lastError,'');assert.equal(next.stat_data.terminal.gameplay.growth.level,2);assert.equal(next.stat_data.terminal.gameplay.numeric.vitals.hp,101);assert.equal(next.stat_data.terminal.gameplay.numericInput,undefined);
    }finally{f.service.destroy();}
  }
});

test('numeric bridge rejects changed event receipts, direct totals and invalid batches without partial wallet writes',async()=>{
  const f=fixture({growth:true});try{
    const wound={id:'same_wound',kind:'resource',resource:'hp',amount:-10,reason:'正文受伤'};
    Object.assign(f.data,await f.run([events([wound])]));
    for(const patch of [events([{...wound,amount:-20}]),replace('/terminal/gameplay/numeric/vitals/hp',1),events([{id:'bad_award',kind:'reward',source:{kind:'quest',id:'invalid'},xp:-100}])]){
      const next=await f.run([replace('/terminal/wallet/yen',490),replace('/terminal/wallet/spent',10),patch]);assert.deepEqual(next.stat_data,f.data.stat_data);assert.ok(f.service.state().lastError);
    }
  }finally{f.service.destroy();}
});

test('numeric bridge confirms allocation despite unrelated wallet changes and preserves action idempotency',async()=>{
  const f=fixture({growth:true});try{
    const base=f.data.stat_data.terminal.gameplay.growth,build=T.edit(base,T.build(base),{kind:'attribute',id:'body',delta:1});
    const ticket={id:'act_wallet',requestHash:'wallet_hash',plan:T.plan(f.data.stat_data,{growthIdentity:f.policy.growthIdentity},{action:'talent-allocate',build})};f.policy.growthAction=ticket;
    const next=await f.run([replace('/terminal/wallet/yen',475),replace('/terminal/wallet/spent',25),replace('/terminal/gameplay/growth',ticket.plan.changes[0].after),add('/terminal/gameplay/results/'+ticket.id,{requestHash:ticket.requestHash,status:'success'})]);
    assert.equal(f.service.state().lastError,'');assert.equal(G.verify(ticket,next.stat_data).status,'success');
    Object.assign(f.data,copy(next));const repeated=await f.run([replace('/terminal/gameplay/growth',ticket.plan.changes[0].after),replace('/terminal/gameplay/results/'+ticket.id,next.stat_data.terminal.gameplay.results[ticket.id])]);
    assert.equal(f.service.state().lastError,'');assert.deepEqual(repeated.stat_data,next.stat_data);
  }finally{f.service.destroy();}
});

test('numeric bridge blocks a reply-branch switch during the actual MVU executor transaction',async()=>{
  const f=fixture({growth:true});try{
    f.setIntercept(name=>{if(name===Guard.events.parsed)f.context.chat[0].swipe_id=1;});
    await assert.rejects(f.run([events([{id:'branch_reward',kind:'reward',source:{kind:'story',id:'scene'},xp:1000}])]),/旧变量回调/);
    assert.equal(f.data.stat_data.terminal.gameplay.growth.xp,0);
  }finally{f.service.destroy();}
});
