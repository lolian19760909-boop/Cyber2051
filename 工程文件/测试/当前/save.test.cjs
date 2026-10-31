'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const H=require('../../卡片源码/运行时/player-host.js'),O=require('../../卡片源码/运行时/player-operations.js'),I=require('../../卡片源码/运行时/identity.js'),Core=require('../../卡片源码/运行时/core.js'),{extract}=require('../../工具/lib/script-modules.cjs'),input=path.resolve(__dirname,'../../交付/基线/2.3.0-整理前.json');
const card=JSON.parse(fs.readFileSync(input)),updater=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cf33c692-7a41-444d-b8b7-6a70163e0104');
const actualLock=extract(updater.content,['CxxUpdateHost'])[0].source;
const delay=ms=>new Promise(r=>setTimeout(r,ms)),copy=structuredClone,evidence=[];
function deferred(){let resolve,reject;return {promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve:v=>resolve(v),reject:e=>reject(e)};}
function indexedDBFixture(record=()=>null){
 return {open(){const request={};queueMicrotask(()=>{request.result={transaction(){const tx={objectStore(){return {get(){const r={};queueMicrotask(()=>{r.result=record();r.onsuccess();queueMicrotask(()=>tx.oncomplete());});return r;}};}};return tx;},close(){}};request.onsuccess();});return request;}};
}
function installer(api,{source=actualLock,record=()=>null}={}){
 let now=0,fetches=[],requests=[];const clock=class extends Date{static now(){return now;}};
  const sandbox=vm.createContext({module:{exports:{}},structuredClone,Date:clock,console,URL,crypto:global.crypto,require:createRequire(require.resolve('../../卡片源码/运行时/host.js'))});
 vm.runInContext(source,sandbox);
 const h=sandbox.module.exports.create({api,core:Core,hostOrigin:'http://localhost',indexedDB:indexedDBFixture(record),locks:{request:async(key,options,fn)=>fn({})},fetch:(url,options)=>{fetches.push({url,signal:!!options.signal});const d=deferred();requests.push(d);return d.promise;}});
 now=3000;return {host:h,fetches,requests};
}
function fixture(origin='street',options={}){
 let chatId='chat-a',events=new Map(),writes=0,saves=0,reads=0,delaySave=null,failSave=false,activeSaves=0,maxActive=0;
 const choice=I.snapshot(origin,origin==='custom'?'自定义开局检查':'',I.initialSetup(origin),origin==='custom'?{items:[]}:{weapon:'pistol'});
 const initial={stat_data:{人物:{好感度:100},terminal:{wallet:{yen:500},unknown:{keep:true}}},unknown:{retained:1}};
 const row={mes:'<OpeningPage id="24"/>',swipe_id:24,swipes:Array.from({length:25},(_,i)=>'<OpeningPage id="'+i+'"/>'),variables:Array.from({length:25},()=>copy(initial))};
 const c={characters:[{avatar:'test.png',name:'测试卡'}],characterId:0,chat:[row],chatMetadata:{variables:{external:{keep:1}}},unshallowCharacter:async()=>{},getCurrentChatId:()=>chatId,getRequestHeaders:()=>({}),async saveChat(){saves++;activeSaves++;maxActive=Math.max(maxActive,activeSaves);const atStart=copy([{chat_metadata:c.chatMetadata},...c.chat]);try{if(delaySave)await delaySave();if(failSave)return;disk=atStart;}finally{activeSaves--;}}};
 let disk=copy([{chat_metadata:c.chatMetadata},...c.chat]);
 const api={SillyTavern:{getContext:()=>c},getCurrentCharacterId:()=>c.characters[c.characterId].avatar,builtin:{duringGenerating:()=>false},getVariables:({type}={})=>copy(type==='character'?(options.character||{}):c.chatMetadata.variables),tavern_events:{CHAT_CHANGED:'changed',CHARACTER_MESSAGE_RENDERED:'rendered',MESSAGE_SWIPED:'swiped'},eventOn(n,f){if(!events.has(n))events.set(n,new Set());events.get(n).add(f);},eventRemoveListener:(n,f)=>events.get(n)?.delete(f),
  async updateVariablesWith(fn,{type,message_id}){if(type==='chat')c.chatMetadata.variables=fn(copy(c.chatMetadata.variables));else{const m=c.chat[message_id];m.variables[m.swipe_id]=fn(copy(m.variables[m.swipe_id]));}writes++;},
  async setChatMessages([{swipe_id,swipes_data}],opts){assert.equal(opts?.refresh,'affected');row.swipe_id=swipe_id;row.mes=row.swipes[swipe_id];if(swipes_data)row.variables=copy(swipes_data);writes++;for(const fn of events.get('rendered')||[])await fn();}};
 const lock=installer(api,{source:fs.readFileSync(path.resolve(__dirname,'../../卡片源码/运行时/host.js'),'utf8'),record:()=>options.record|| (options.pending?{status:'active'}:null)});
 const read=H.createReader({api,hostWindow:{fetch:async(url,opts)=>{assert.equal(url,'/api/chats/get');assert.equal(JSON.parse(opts.body).file_name,chatId);reads++;return {ok:true,text:async()=>JSON.stringify(disk)};}}});
 global.Cxx236VariableGuard={validateProgram:(a,b,o)=>O.validate(a,b,o.engineOperation)};
 const player=H.create({api,host:lock.host,read,waitForInstall:options.waitForInstall,operations:O,identities:I,ui:{},saveTimeout:options.timeout||10000,openingReadyTimeout:options.openingReadyTimeout||10000});
 return {choice,c,row,api,read,player,lock,initial,stats:()=>({writes,saves,reads,maxActive}),disk:()=>copy(disk),setDisk:v=>disk=copy(v),delaySave:fn=>delaySave=fn,failSave:v=>failSave=v,switchChat:()=>{chatId='chat-b';for(const fn of events.get('changed')||[])fn();},emit:n=>{for(const fn of events.get(n)||[])fn();}};
}
test('frozen 2.1.4 installer hangs before business work; independent 2.1.5 saves continue',async()=>{
 const f=fixture(),old=installer(f.api);let entered=false;const stuck=old.host.withLock(()=>{entered=true;});await delay(0);
 assert.equal(entered,false);assert.match(old.fetches[0].url,/characters\/get$/);assert.equal(old.fetches[0].signal,false);
 await assert.rejects(old.host.withLock(()=>{}),e=>e.code==='update-already-running');
 // Also hold the unchanged real lock in the updated installer, not a Boolean mock.
 const current=f.lock.host.withLock(()=>{throw Error('must not reach');});await delay(0);
 const t=performance.now();await f.player.completeOpening({value:f.choice});assert.equal(f.row.swipe_id,1);const ms=performance.now()-t;
 assert.ok(ms<200,ms);await f.player.waitForSaved();assert.equal(f.row.variables[1].stat_data.terminal.gameplay.inventory.pistol_t1.quantity,1);
 assert.equal(f.lock.fetches.length,1,'player made no full-card requests');
 evidence.push({case:'actual delivered installer held',localMs:ms,baselineLock:old.fetches[0],updatedLock:f.lock.fetches[0],stats:f.stats()});
 const cleanup=Promise.allSettled([stuck,current]);old.requests[0].reject(Error('test release'));f.lock.requests[0].reject(Error('test release'));await cleanup;
});
test('three preset origins and custom initialize locally, repeated clicks/render share the submission',async t=>{
 for(const origin of ['street','corpo','student','custom'])await t.test(origin,async()=>{
  const f=fixture(origin);f.player.start();await f.player.prepareOpening();const one=f.player.completeOpening({value:f.choice}),two=f.player.completeOpening({value:f.choice});assert.equal(one,two);await one;
  for(let i=0;i<20;i++)f.emit('rendered');await f.player.waitForSaved();assert.deepEqual(f.row.variables[1].unknown,{retained:1});assert.equal(f.row.variables[1].stat_data.terminal.wallet.yen,500);assert.equal(f.stats().saves,1);
  const before=copy(f.row.variables);await f.player.completeOpening({resume:true});assert.deepEqual(f.row.variables,before);assert.equal(f.stats().writes,2,'one metadata + one message mutation');f.player.stop();
 });
});
test('five-second save does not block menu or scenario; only latest branch is read back',async()=>{
 const f=fixture();let first=true;f.delaySave(async()=>{if(first){first=false;await delay(5000);}});const t=performance.now();await f.player.completeOpening({value:f.choice});const menuMs=performance.now()-t;
 await delay(1);assert.equal(f.player.saveState().status,'saving');const t2=performance.now();await f.player.completeOpening({swipe:2});const scenarioMs=performance.now()-t2;
 assert.equal(f.row.swipe_id,2);assert.ok(menuMs<200&&scenarioMs<200);assert.throws(()=>f.player.assertOpeningSaved(),/正在保存/);
 await f.player.waitForSaved();assert.equal(f.stats().maxActive,1);assert.equal(f.stats().reads,1);assert.equal(f.row.variables[2].stat_data.terminal.gameplay.inventory.pistol_t1.quantity,1);
 evidence.push({case:'five-second disk latency',menuMs,scenarioMs,totalMs:performance.now()-t,stats:f.stats()});
});
test('failure, swallowed host error, retry and timeout preserve configuration without parallel saves',async()=>{
 const f=fixture('custom',{timeout:30});f.failSave(true);await f.player.completeOpening({value:f.choice});await assert.rejects(f.player.waitForSaved(),/尚未读回/);
 assert.equal(f.player.saveState().status,'error');assert.throws(()=>f.player.assertOpeningSaved(),/保存失败/);const token=f.c.chatMetadata.variables.__cxx_identity.setupToken,before=copy(f.row.variables);
 f.failSave(false);await f.player.retrySave();assert.equal(f.c.chatMetadata.variables.__cxx_identity.setupToken,token);assert.deepEqual(f.row.variables,before);
 const d=deferred();f.delaySave(()=>d.promise);await f.player.completeOpening({swipe:3});await assert.rejects(f.player.waitForSaved({timeout:35}),e=>e.code==='player-save-timeout');
 assert.equal(f.player.saveState().status,'timeout');const count=f.stats().saves,one=f.player.retrySave(),two=f.player.retrySave();assert.equal(one,two);assert.equal(f.stats().saves,count);d.resolve();await one;assert.equal(f.stats().maxActive,1);
});
test('reload verifies saved branch with no writes; existing growth/unknown fields and resource loss survive',async()=>{
 const f=fixture();await f.player.completeOpening({value:f.choice});await f.player.waitForSaved();await f.player.commit({action:'unequip',slot:'weapon_1'});
 f.row.variables[1].stat_data.terminal.gameplay.numeric.vitals.hp=1;await f.c.saveChat();const before=f.stats(),all=copy(f.row.variables[1]);
 const p=H.create({api:f.api,host:f.lock.host,read:f.read,operations:O,identities:I,ui:{}});p.start();await p.waitForSaved();assert.equal(f.stats().writes,before.writes);assert.equal(f.stats().saves,before.saves);assert.deepEqual(f.row.variables[1],all);
 await p.completeOpening({swipe:10});assert.equal(f.row.variables[10].stat_data.terminal.gameplay.numeric.vitals.hp,1);assert.deepEqual(f.row.variables[10].stat_data.terminal.gameplay.equipment,all.stat_data.terminal.gameplay.equipment);
 await p.waitForSaved();p.stop();
});
test('authored scenario state and unknown fields stay outside the player merge on current branches',async()=>{
 const f=fixture();for(const target of [10,11]){
  const stat=f.row.variables[target].stat_data;
  stat.人物={姓名:'剧情人物',好感度:73,unknown:{keep:[1,2]}};
  stat.terminal.quests={authored_quest:{state:'进行中',objective:'保留作者开场目标'}};
  stat.terminal.unknown={target};const before=copy(stat);
  await f.player.completeOpening(target===10?{value:f.choice,swipe:target}:{swipe:target});
  const after=copy(f.row.variables[target].stat_data);delete after.terminal.gameplay;
  // 建档时 NPC 名册会写入固定种子的 terminal.roster/ensemble，这是初始化内容而非玩家合并泄漏。
  assert.equal(after.terminal?.roster?.seedVersion,'2051-npc-1');delete after.terminal.roster;delete after.terminal.ensemble;assert.deepEqual(after,before);
 }await f.player.waitForSaved();f.player.stop();
});
test('chat switch invalidates late save callback; active installation recovery still blocks writes',async()=>{
 const f=fixture(),d=deferred();f.delaySave(()=>d.promise);await f.player.completeOpening({value:f.choice});const waiting=f.player.waitForSaved();await delay(0);f.switchChat();d.resolve();await assert.rejects(waiting,/聊天已切换/);assert.equal(f.stats().reads,0);
 const locked=fixture('street',{pending:true});await assert.rejects(locked.player.completeOpening({value:locked.choice}),/未完成的安装/);assert.equal(locked.stats().writes,0);
});
test('queued equipment writes stay on requested branch and differing opening choices serialize',async()=>{
 const f=fixture();await f.player.completeOpening({value:f.choice});await f.player.waitForSaved();f.row.variables[2]=copy(f.row.variables[1]);
 const d=deferred(),writable=f.lock.host.assertPlayerWritable;f.lock.host.assertPlayerWritable=async expected=>{await d.promise;return writable(expected);};
 const count=f.stats().writes,commit=f.player.commit({action:'unequip',slot:'weapon_1'});await delay(0);f.row.swipe_id=2;f.row.mes=f.row.swipes[2];d.resolve();await assert.rejects(commit,/回复分支已变化/);assert.equal(f.stats().writes,count);
 f.lock.host.assertPlayerWritable=writable;await Promise.all([f.player.completeOpening({swipe:3}),f.player.completeOpening({swipe:4})]);assert.equal(f.row.swipe_id,4);await f.player.waitForSaved();
});
test('core startup proceeds under ordinary sync lock but preserves install-recovery wait',async()=>{
 const f=fixture(),pending=f.lock.host.withLock(()=>{});await delay(0);let booted=false,waited=false;
 const updater={host:f.lock.host,whenIdle:async()=>{waited=true;}};
 await (async()=>{try{await updater.host.assertPlayerWritable(updater.host.getContext());}catch(e){if(e.code!=='migration-pending-install')throw e;await updater.whenIdle();}booted=true;})();assert.equal(booted,true);assert.equal(waited,false);
 const cleanup=Promise.allSettled([pending]);f.lock.requests[0].reject(Error('test release'));await cleanup;
 const locked=fixture('street',{pending:true});await (async()=>{try{await locked.lock.host.assertPlayerWritable(locked.lock.host.getContext());}catch(e){if(e.code!=='migration-pending-install')throw e;await updater.whenIdle();}})();assert.equal(waited,true);
});
test('reload resumes a saved identity left on branch 24 with the original setup token',async()=>{
 const f=fixture('custom');f.c.chatMetadata.variables.__cxx_identity={...f.choice,setupToken:'saved_before_interruption'};await f.c.saveChat();f.player.start();await f.player.waitForSaved();assert.equal(f.row.swipe_id,1);assert.equal(f.row.variables[1].stat_data.terminal.gameplay.loadoutStart.token,'saved_before_interruption');assert.equal(f.c.chatMetadata.variables.__cxx_identity.background,f.choice.background);f.player.stop();
});
test.after(()=>{const dir=path.resolve(__dirname,'../../.cache/checks'),file=path.join(dir,'save-checks.json');fs.mkdirSync(dir,{recursive:true});const previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).evidence:[];const combined=[...previous.filter(x=>!evidence.some(e=>e.case===x.case)),...evidence];fs.writeFileSync(file,JSON.stringify({evidence:combined,realHosts:false},null,2)+'\n');});
test('real Core journal classifies chat-worldbook-only work, foreign instance, and true installations',async()=>{
 const context={cardId:'cyber2051',characterKey:'test.png',chatId:'chat-a',busy:false},before={worldbook:{entries:[]},scripts:{trees:[]},regex:{scripts:[]},registry:{format:1,packages:{}}};let journal;
 await Core.execute({before,after:{...copy(before),worldbook:{entries:[{uid:1}]}},expectedContext:context,installed:{scope:'chat'},host:{getContext:()=>context,snapshot:async()=>copy(before),writeStage:async()=>{}},storage:{get:async()=>journal,claim:async(k,j)=>{journal=copy(j);return true;},set:async(k,j)=>{journal=copy(j);return true;}}});
 const record={status:'active',instanceId:'instance-a',journalName:'pending-a',journal},options={record,character:{__cxx_update_state:{instanceId:'instance-a',journalName:'pending-a'}}},f=fixture('street',options);
 assert.equal((await f.lock.host.assertPlayerWritable(f.lock.host.getContext())).kind,'chat-content');await f.player.completeOpening({value:f.choice});await f.player.waitForSaved();assert.equal(f.row.swipe_id,1);
 record.journal.after.scripts.trees.push({id:'actual-install'});await assert.rejects(f.lock.host.assertPlayerWritable(f.lock.host.getContext()),e=>e.code==='migration-pending-install');record.journal.after.scripts.trees=[];
 record.journal.installed.scope='character';await assert.rejects(f.lock.host.assertPlayerWritable(f.lock.host.getContext()),e=>e.code==='migration-pending-install');
 options.character.__cxx_update_state={instanceId:'different-instance'};assert.equal((await f.lock.host.assertPlayerWritable(f.lock.host.getContext())).kind,'other-instance');assert.equal(record.status,'active');
 evidence.push({case:'real Core journal scopes',passed:['worldbook-only allowed','actual component change blocked','character install blocked','foreign instance preserved']});
});
test('shared chat save queue serializes metadata and player disk writes',async()=>{
 const f=fixture(),d=deferred(),steps=[];const a=f.lock.host.withChatSave(f.lock.host.getContext(),async()=>{steps.push('metadata-start');await d.promise;steps.push('metadata-end');});await delay(0);
 const b=f.lock.host.withChatSave(f.lock.host.getContext(),async()=>steps.push('player'));await delay(0);assert.deepEqual(steps,['metadata-start']);d.resolve();await Promise.all([a,b]);assert.deepEqual(steps,['metadata-start','metadata-end','player']);
});
module.exports={fixture};

