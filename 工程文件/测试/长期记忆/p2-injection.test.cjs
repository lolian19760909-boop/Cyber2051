'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Host=require('../../卡片源码/运行时/experience-host.js'),{chapter,quest}=require('../../工具/构建/长期记忆/p2.cjs'),plot=require('../../卡片源码/长期记忆/plot.js').create({chapter,quest});
test('main and extra MVU share current-stage context; reroll reads the previous floor; stop/change cleans injections',async t=>{
 const handlers={},prompts=new Map(),cache=new Map();let extra=false,mode='main',scope='A',enabled=true;
 // Current chapter records carry status as well as stage; terminal chapters must not be injected again.
 const a={terminal:{quests:{q_chip_night:{state:'已接取',chapter:{stage:1,status:'active'}}}}},b={terminal:{quests:{q_chip_night:{state:'进行中',chapter:{stage:2,status:'active'}}}}};
 const ctx={characters:[{avatar:'test.png'}],characterId:0,saveMetadata:async()=>{},getCurrentChatId:()=>scope,chat:[{mes:'开场',variables:[{stat_data:a}]},{mes:'当前正文',swipe_id:0,variables:[{stat_data:b},{stat_data:a}]}],eventTypes:Object.fromEntries(['CHAT_CHANGED','GENERATION_AFTER_COMMANDS','GENERATION_ENDED','GENERATION_STOPPED'].map(x=>[x,x]))};
 const api={Mvu:{isDuringExtraAnalysis:()=>extra},SillyTavern:{getContext:()=>ctx},getVariables:()=>({}),updateVariablesWith:async()=>{},eventOn:(n,f)=>handlers[n]=f,eventRemoveListener:n=>delete handlers[n],injectPrompts:ps=>{for(const p of ps)prompts.set(p.id,p.content);return {uninject(){for(const p of ps)prompts.delete(p.id);}};}};
 const top={CxxPlot:{...plot,enabled:()=>enabled},CxxVariableMode:{ready:async()=>{},read:()=>({mode})},document:{body:{hasAttribute:()=>false}},localStorage:{getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)}};
 const service=Host.create({api,top,summaries:require('../../卡片源码/运行时/story-summaries.js'),news:require('../../卡片源码/运行时/news.js'),parser:require('../../卡片源码/Gal/parser.js'),identities:require('../../卡片源码/运行时/identity.js'),fetcher:()=>{throw Error('unexpected extra model call');}}).start();t.after(()=>service.destroy());await service.tick();
 const generate=async(type='normal',options={automatic_trigger:false})=>{await handlers.GENERATION_AFTER_COMMANDS(type,options,false);return prompts.get('cxx-chip-night-v1');};
 let p=await generate();assert(p.includes(chapter.stages[1].content));assert(!p.includes(chapter.stages[0].content));assert(p.includes('【剧情事实检测'));mode='extra';p=await generate();assert(!p.includes('【剧情事实检测'));extra=true;p=await generate('quiet',{});assert(p.includes('【剧情事实检测'));assert(p.includes(chapter.stages[1].content));
 extra=false;p=await generate('regenerate');assert(p.includes(chapter.stages[0].content));extra=true;p=await generate('quiet',{});assert(p.includes(chapter.stages[0].content));await handlers.GENERATION_STOPPED();assert.equal(prompts.size,0);
 extra=false;enabled=false;await generate();assert.equal(prompts.size,0);enabled=true;await generate();scope='B';ctx.chat=[{mes:'新故事',variables:[{stat_data:{terminal:{quests:{}}}}]}];await handlers.CHAT_CHANGED();assert.equal(prompts.size,0);
});
