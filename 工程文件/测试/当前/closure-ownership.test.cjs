'use strict';
// Regression paths use maintained modules and existing fixture helpers.
{
 const {test}=require('node:test'),assert=require('node:assert/strict'),Sync=require('../../卡片源码/运行时/business-content-sync.js'),Core=require('../../卡片源码/运行时/core.js'),Content=require('../../卡片源码/运行时/content.js'),Host=require('../../卡片源码/运行时/host.js');
 test('content read failure preserves the accepted historical quest and healthy retry',async()=>{
  const quest={id:'q_pack',title:'已接旧任务',fixer:'委托人',district:'城北',brief:'旧版条款',goal:'交付',pay:100},state={instanceId:'case',initialContent:{quests:[]},registry:{format:1,packages:{pack:{version:'2',optional:true,activation:'compatible',content:{quests:[{...quest,brief:'新版条款'}]},history:{'1':{quests:[quest]}}}}},subscriptions:{},installed:{},baseline:{},conflicts:[]};let failReads=false,writes=0,snapshot={worldbook:{internalName:'book',entries:[]},registry:state.registry};
  const api={getLastMessageId:()=>0,getVariables:({type})=>{if(type!=='message')return {};if(failReads)throw Error('variable service interrupted');return {stat_data:{terminal:{quests:{q_pack:{state:'进行中',definitionRef:{packageId:'pack',version:'1',questId:'q_pack'}}},gameplay:{}}}};},getChatWorldbookName:()=> 'book'},host={readState:()=>structuredClone(state),setScope(){},getContext:()=>({characterKey:'case.png',chatId:'case'}),snapshot:async()=>structuredClone(snapshot),saveState:async()=>{}};
  const sync=Sync.create({api,Core,Content,Host,host,readSeed:()=>({characterIds:[]}),transaction:async(before,after)=>{writes++;snapshot=structuredClone(after);}});await sync();assert.match(snapshot.worldbook.entries[0].content,/旧版条款/);const before=structuredClone(snapshot);failReads=true;await assert.rejects(sync(),/variable service interrupted/);assert.equal(writes,1);assert.deepEqual(snapshot,before);failReads=false;await sync();assert.deepEqual(snapshot,before);
 });
}
{
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(__dirname,'../../..'),load=require(path.join(root,'工程文件/测试/lib/fixture-loader.cjs'));
const F=load('host.test.cjs',['finish']);
const Recovery=load('../更新/recovery-2127.test.cjs',['orphan','controller']);
test('whenIdle resolves the actual pending journal even when character pointer is missing',async t=>{
 const h=await Recovery.orphan(t),controller=Recovery.controller(h);t.after(()=>controller.stop());
 assert.equal(h.host.readState().journalName,undefined);assert.equal((await h.host.inspectInstall()).kind,'pending');
 await assert.rejects(h.host.assertPlayerWritable(h.host.getContext()),{code:'migration-pending-install'});
 await F.finish(t,controller.whenIdle());
 const inspection=await h.host.inspectInstall();console.log(JSON.stringify({case:'pointerless pending installation',afterIdle:inspection.kind,pointer:h.host.readState().journalName??null}));
 assert.equal(inspection.kind,'none');await h.host.assertPlayerWritable(h.host.getContext());
});
test('growth repair preview remains bound to its original actor through a control switch',async()=>{
 const Fixtures=require(path.join(root,'工程文件/测试/lib/tactical-fixtures.cjs'));
 const A=require(path.join(root,'工程文件/卡片源码/运行时/ensemble-state.js')),O=require(path.join(root,'工程文件/卡片源码/运行时/player-operations.js'));
 const R=require(path.join(root,'工程文件/卡片源码/运行时/growth-repair.js')),G=require(path.join(root,'工程文件/卡片源码/数值引擎/src/growth.js'));
 let stat=A.initialize({terminal:{gameplay:Fixtures.game(),wallet:{yen:0,earned:0,spent:0}}});
 stat.terminal.ensemble.actors.wb_6.gameplay.growth=structuredClone(stat.terminal.gameplay.growth);
 const ctx={characters:[{avatar:'audit.png'}],characterId:0,getCurrentChatId:()=> 'audit',chat:[{mes:'开场'},{mes:'你完成现场任务。'}]};
 const event={floor:1,id:'repair_audit',source:{kind:'story',id:'audit_fact'},category:'small',completed:true,reason:'已完成现场任务'};
 const top={CxxSource:{text:async()=>ctx.chat[1].mes},__cxx_utility__:{request:async()=>({events:[event]}),cancel(){}},__cxx_player__:{read:async()=>({stat:structuredClone(stat)}),commit:async request=>{const owner=request.actorId||A.registry(stat).control.actorId;stat=O.plan(stat,request,{actorBinding:A.binding(stat,owner)});return {stat:structuredClone(stat)};}}};
 const service=R.create({api:{SillyTavern:{getContext:()=>ctx},CxxNumericGrowth:G},top,runtime:{}}),preview=await service.inspect(1,1);
 stat=A.preview(stat,A.planControl(stat,'wb_6'));const before=structuredClone(stat);let error;try{await service.apply(preview.id);}catch(e){error=e;}
 console.log(JSON.stringify({case:'repair after actor switch',error:error?.message||null,playerXp:stat.terminal.gameplay.growth.xp,npcXp:A.read(stat,'wb_6').gameplay.growth.xp}));
 assert.ok(error,'A preview created for the original player must expire when control switches');assert.deepEqual(stat,before);
});
test('native profile applies the same player-only repair availability as the talent page',async()=>{
 const DOM=require(path.join(root,'工程文件/测试/lib/dom.cjs')),UI=require(path.join(root,'工程文件/卡片源码/运行时/player-ui.js')),Fixtures=require(path.join(root,'工程文件/测试/lib/tactical-fixtures.cjs'));
 const doc=DOM.document('<html><head></head><body></body></html>'),create=doc.createElement;
 const enhance=n=>{n.style={setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}};n.getRootNode=()=>doc;n.replaceChildren=(...xs)=>{for(const c of [...n.children||[]])c.remove();n.append(...xs);};n.insertBefore=(n,r)=>r.before(n);n.attachShadow=()=>n.shadowRoot=doc.createElement('div');n.getBoundingClientRect=()=>({width:1200,height:800});return n;};
 doc.querySelectorAll('*').forEach(enhance);doc.createElement=tag=>enhance(create(tag));
 const win={ResizeObserver:class{observe(){}disconnect(){}},MutationObserver:class{observe(){}disconnect(){}},addEventListener(){},removeEventListener(){},CxxWebTerminal:{attributeAssets:{}},matchMedia:()=>({matches:false})};win.parent=win;doc.defaultView=win;
 const previous=global.CxxTalentUI,options=[];global.CxxTalentUI={mount(value){options.push(value);return {element:doc.createElement('div'),destroy(){}};}};let entry;
 try{
  const game=Fixtures.game();entry=UI.mount({document:doc,parent:doc.body,native2x:true,read:async()=>({stat:{terminal:{gameplay:game}},actor:{id:'wb_6',name:'NPC',gameplay:game},expected:{characterKey:'audit',chatId:'audit'},floor:0,messages:[{swipe_id:0}]}),commit:async()=>{},draft(){}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(options.length,1);console.log(JSON.stringify({case:'NPC native profile repair availability',allowRepair:options[0].allowRepair??'default-true'}));assert.equal(options[0].allowRepair,false);
 }finally{entry?.destroy();global.CxxTalentUI=previous;}
});

}
{
'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test'),root=path.resolve(__dirname,'../../..');
const F=require(path.join(root,'工程文件/测试/lib/tactical-fixtures.cjs'));
const A=require(path.join(root,'工程文件/卡片源码/运行时/ensemble-state.js')),V=require(path.join(root,'工程文件/卡片源码/运行时/combat-view.js'));
test('a controlled NPC battle round reaches the existing native readout projection',()=>{
 let stat=A.initialize({terminal:{gameplay:F.game(),wallet:{yen:0,earned:0,spent:0}}});stat=A.preview(stat,A.planControl(stat,'wb_6'));
 const owner='wb_6',game=A.read(stat,owner).gameplay;
 stat=F.O.plan(stat,{action:'battle-start',actorId:owner,id:'audit_fight',mode:'cheat',draft:{...F.B.seed(game),enemies:[F.npc('enemy','对手')]}},{actorBinding:A.binding(stat,owner)});
 const pending={...F.B.prepare(A.read(stat,owner).gameplay,{id:'audit_round',roll:.2,source:{floor:1,swipe:0}}),actorId:owner};
 stat=F.O.plan(stat,{action:'battle-resolve',actorId:owner,pending,floor:1,swipe:0},{actorBinding:A.binding(stat,owner)});
 const chat=[{is_user:true,mes:'进行交锋'},{is_user:false,mes:'双方交火',swipe_id:0,variables:[{stat_data:stat}]}],rows=V.forFloor(chat,1);
 console.log(JSON.stringify({case:'NPC battle readout',owner,stored:A.read(stat,owner).gameplay.numeric.receipts.audit_round.round.id,projected:rows.length}));
 assert.deepEqual(rows,[pending.result]);
});

}
{
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'../../..'),source=file=>require(path.join(root,'工程文件/卡片源码',file));
test('browser talents context resolves its roster provider and prepares generation context',()=>{
 const ctx={CxxDataClone:source('共享/data-clone.js'),CxxGameplay:source('运行时/gameplay.js'),CxxNumericGrowth:source('数值引擎/src/growth.js'),CxxNumericMvu:source('数值引擎/adapters/mvu.js'),CxxNumericEngine:source('数值引擎/src/engine.js'),CxxTalentData:source('数值引擎/src/talent-data.js'),CxxGrowthRules:source('数值引擎/src/growth-rules.js'),CxxRoster:source('运行时/roster.js')};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'工程文件/卡片源码/运行时/talents.js'),'utf8'),ctx,{filename:'talents.js'});
 const game=require(path.join(root,'工程文件/测试/lib/tactical-fixtures.cjs')).game(),stat={terminal:{gameplay:game,wallet:{yen:0,earned:0,spent:0}}};
 const content=ctx.CxxTalents.context(stat);assert.match(content,/已保存角色成长/);assert.ok(content.includes(ctx.CxxRoster.protocol));
});

}
{
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');const root=path.resolve(__dirname,'../../..');
test('creator AI completion retains the active profile after its view was replaced',async()=>{
 const UI=require(path.join(root,'工程文件/卡片源码/运行时/creator-ui.js')),DOM=require(path.join(root,'工程文件/测试/lib/dom.cjs'));
 const doc=DOM.document('<html><head></head><body></body></html>'),create=doc.createElement;doc.createElement=tag=>{const n=create(tag);n.style={setProperty(){}};n.appendChild=child=>n.append(child);return n;};
 let resolve;const generated=new Promise(r=>resolve=r),win={generateRaw:()=>generated};win.parent=win;doc.defaultView=win;
 let draft={name:'旧姓名',history:'旧经历'};const view=UI.mount({document:doc,parent:doc.body,profile:draft,appearance:{groups:[['basic','基本'],['background','背景']],fields:[],describe:()=>'',colors:{}},onChange:({profile})=>{draft={...draft,...profile};}});
 const ai=[...doc.querySelectorAll('.creator-ai-button')].find(b=>b.closest('.creator-text-field').querySelector('[data-creator-field="history"]'));ai.onclick();
 view.destroy();draft={...draft,name:'新视图中输入的新姓名',history:'新视图中输入的新经历'};resolve('旧请求的AI经历');await new Promise(r=>setImmediate(r));
 console.log(JSON.stringify({case:'creator view replacement during pending AI',name:draft.name,history:draft.history}));
 assert.equal(draft.name,'新视图中输入的新姓名');assert.equal(draft.history,'新视图中输入的新经历');
});

}
{
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test'),root=path.resolve(__dirname,'../../..');
const F=require(path.join(root,'工程文件/测试/lib/tactical-fixtures.cjs')),T=require(path.join(root,'工程文件/卡片源码/运行时/tactical-engine.js'));
test('NPC firearm turn uses NPC loaded ammunition when the unarmed player owns none',()=>{
 let g=F.game(),i=0;const op=(action,extra={},scene)=>{g=T.operation(g,{action,id:'audit_'+(++i),expected:T.stamp(g),...extra},{scene});};
 op('tactical-initialize',{supplies:{light:0},programs:[],devices:{},magazines:{}});op('tactical-enable',{enabled:true});
 const scene={hostile:true,playerZone:'z',zones:[{id:'z',name:'现场',cover:0,known:true}],edges:[],actors:[{id:'enemy',name:'持枪敌人',template:'thug',rank:'regular',health:'healthy',side:'enemy',zone:'z',visible:true,equipment:[]}],nodes:[],source:{floor:1,hash:'audit'}};
 op('tactical-start',{seed:1,encounterId:'audit_fight'},scene);const npcBefore=g.tactical.encounter.actors.find(a=>a.id==='enemy').loaded;
 op('tactical-act',{intent:{kind:'wait'}});
 assert.equal(T.count(g,'supply','light'),0);assert.ok(g.tactical.encounter.actors.find(a=>a.id==='enemy').loaded<npcBefore);
});

}
{
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test'),root=path.resolve(__dirname,'../../..');
test('pause menu identity, level and wallet project the controlled NPC',async()=>{
 const DOM=require(path.join(root,'工程文件/测试/lib/dom.cjs')),UI=require(path.join(root,'工程文件/卡片源码/运行时/game-menu.js')),A=require(path.join(root,'工程文件/卡片源码/运行时/ensemble-state.js')),F=require(path.join(root,'工程文件/测试/lib/tactical-fixtures.cjs'));
 const doc=DOM.document('<html><head></head><body></body></html>'),create=doc.createElement;const enhance=n=>{n.style={values:{},getPropertyValue(k){return this.values[k]||'';},getPropertyPriority(){return'';},setProperty(k,v){this.values[k]=v;},removeProperty(k){delete this.values[k];}};n.replaceChildren=(...nodes)=>{for(const c of [...n.children||[]])c.remove();n.append(...nodes);};return n;};doc.querySelectorAll('*').forEach(enhance);doc.createElement=tag=>enhance(create(tag));doc.documentElement=doc.querySelector('html');
 let stat=A.initialize({terminal:{gameplay:F.game(),wallet:{yen:10,earned:0,spent:0}}});stat.terminal.ensemble.actors.wb_6.wallet.yen=999;stat=A.preview(stat,A.planControl(stat,'wb_6'));const actor=A.read(stat,'wb_6');
 const ctx={chat:[{mes:'正文',swipe_id:0,variables:[{stat_data:stat}]}],chatMetadata:{__cxx_story_profile:{name:'原玩家姓名'}},name1:'原玩家姓名'};
 const win={document:doc,SillyTavern:{getContext:()=>ctx},addEventListener(){},removeEventListener(){},__cxx_player__:{menuStatus:()=>({load:0})}};win.parent=win;doc.defaultView=win;
 const prior=global.CxxHubUI;let projected;global.CxxHubUI={mount:value=>{projected=value;return{select(){},updateStatus:value=>projected={...projected,...value},updateRecords(){},note:doc.createElement('p'),destroy(){},container:doc.createElement('div')};}};const menu=UI.create({win,store:{},context:()=>({chatId:'audit'})});
 try{await menu.open('hub');console.log(JSON.stringify({case:'pause menu after actor switch',actualName:projected.identity.name,actualYen:projected.yen,expectedName:actor.record.name,expectedYen:actor.wallet.yen}));assert.equal(projected.identity.name,actor.record.name);assert.equal(projected.yen,999);assert.deepEqual(projected.game,actor.gameplay);}finally{menu.destroy();global.CxxHubUI=prior;}
});

}

{
'use strict';
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test'),root=path.resolve(__dirname,'../../..');
const load=require(path.join(root,'工程文件/测试/lib/fixture-loader.cjs')),F=load('../长期记忆/p3.test.cjs',['fixture']),M=require(path.join(root,'工程文件/卡片源码/长期记忆/material.js'));
test('portable memory restoration preserves a current unrelated table with the same sheet key',async()=>{
 const f=F.fixture(),before={name:'自定义账本',content:[['row_id','项目','余额'],[1,'玩家的自定义数据',777]],extra:{keep:true}};f.tables().sheet_summary=structuredClone(before);
 const source={story:['card.png','story-a'],floor:0,swipe:0,quote:'玩家当面答应阿杨接下采购六套护甲的委托。'};
 const table=f.schema().sheet_summary;table.content.push([1,'AM0001','2051','旧记忆','原故事经历<cxx-source>'+JSON.stringify(source)+'</cxx-source>','']);f.vars()[M.KEY].portable={tables:{sheet_summary:table}};
 await f.service().history.restore();
 console.log(JSON.stringify({case:'portable memory table key collision',tableNames:Object.values(f.tables()).map(t=>t.name),nativeWrites:f.calls.filter(c=>c.kind==='persist').length}));
 assert.ok(Object.values(f.tables()).some(t=>t.name===before.name),'Existing unrelated native table must survive restoration');assert.deepEqual(Object.values(f.tables()).find(t=>t.name===before.name),before);assert.ok(Object.values(f.tables()).some(t=>t.name==='纪要表'));f.service().destroy();
});

}

{
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),root=path.resolve(__dirname,'../../..');
test('preset skin stops writing the host stylesheet after its helper frame is closed',()=>{
 const callbacks=new Map(),observers=[],nodes=new Map(),timers=new Map();let serial=0;
 const parent={addEventListener(){},removeEventListener(){},innerWidth:1280,innerHeight:800};const doc={head:{},readyState:'complete',defaultView:parent,getElementById:id=>nodes.get(id)||null};parent.document=doc;
 const frame={parent,addEventListener:(type,fn)=>callbacks.set(type,fn),removeEventListener:(type,fn)=>{if(callbacks.get(type)===fn)callbacks.delete(type);}};
 class Observer{constructor(fn){this.fn=fn;this.active=false;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}
 const context={window:frame,document:doc,MutationObserver:Observer,setTimeout:(fn)=>{const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'工程文件/卡片源码/预设/皮肤-2051.js'),'utf8'),context);
 callbacks.get('pagehide')?.();const original='#izumi-floating-window-v1-panel{color:#000;background:#fff}',style={textContent:original};nodes.set('izumi-floating-window-v1-style',style);for(const o of observers)if(o.active)o.fn([]);
 console.log(JSON.stringify({case:'preset skin after pagehide',activeObservers:observers.filter(o=>o.active).length,pendingTimers:timers.size,oldScriptRewroteNewStyle:style.textContent!==original}));assert.equal(style.textContent,original,'Closed helper must leave subsequently created styles to their current owner');
});

}
