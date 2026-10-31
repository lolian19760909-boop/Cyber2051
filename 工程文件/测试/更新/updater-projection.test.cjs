'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../lib/fixture-loader.cjs')('host.test.cjs',['fakeBackend','finish']);
const Host=require('../../卡片源码/运行时/host.js'),Core=require('../../卡片源码/运行时/core.js'),C=require('../../卡片源码/运行时/character-comparison.js');
const copy=structuredClone;
function displayIndexFixture(t,config={}){
 const h=F.fakeBackend(t,config),s=h.state,raw=s.rawBooks.get(s.binding);
 raw.entries['1'].extensions={privateProjection:{retained:true}};
 raw.entries['2']={...copy(raw.entries['1']),uid:2,comment:'第二条',content:'另一段正文',displayIndex:1};
 s.raw.character_book=copy(C.embeddedBook(s.binding,raw.entries));
 raw.entries['1'].displayIndex=3;raw.entries['2'].displayIndex=2;
 s.disk=copy(s.raw);s.disk.character_book=C.embeddedBook(s.binding,raw.entries);
 return {...h,raw,refresh:()=>F.finish(t,h.host.withLock(async()=>true),1000)};
}
test('ordinary ST displayIndex renumbering refreshes only proven book cache without an updater journal',async t=>{
 const f=displayIndexFixture(t),live=f.api.getCharData('current'),data=live.data,disk=copy(f.state.disk),books=copy([...f.state.rawBooks]);
 live.json_data=JSON.stringify({spec:'chara_card_v2',spec_version:'2.0',data:copy(data)});
 const original=JSON.parse(live.json_data);
 assert.equal(f.state.raw.extensions.tavern_helper.variables[Host.NAMESPACE].updaterUpgrade,undefined);
 assert.equal(f.raw.extensions,undefined);
 await f.refresh();
 assert.equal(f.api.getCharData('current'),live);assert.equal(live.data,data);assert.deepEqual(data,disk);
 assert.deepEqual(JSON.parse(live.json_data),{...original,data:{...original.data,character_book:disk.character_book}});
 assert.deepEqual(f.state.disk,disk);assert.deepEqual([...f.state.rawBooks],books);assert.equal(f.state.pending,null);
 assert(!f.state.events.some(e=>e==='character-cache-refreshed'||e==='state-helper-returned'||e.startsWith('worldbook-persisted')));
});
const displayIndexMutations={
 'local content':f=>{f.state.raw.character_book.entries[0].content='unsaved content';},
 'disk content even when raw agrees':f=>{f.raw.entries['1'].content='new disk content';f.state.disk.character_book=C.embeddedBook(f.state.binding,f.raw.entries);},
 'unknown local extension':f=>{f.state.raw.character_book.entries[0].extensions.playerMemo='keep';},
 'unknown disk extension even when raw agrees':f=>{f.raw.entries['1'].extensions.privateProjection.retained=false;f.state.disk.character_book=C.embeddedBook(f.state.binding,f.raw.entries);},
 'embedded array order':f=>{f.state.disk.character_book.entries.reverse();},
 'raw projection disagrees with disk':f=>{f.raw.entries['1'].displayIndex=8;},
 'non-book player field':f=>{f.state.raw.description='unsaved player text';},
};
for(const[name,mutate]of Object.entries(displayIndexMutations))test('displayIndex-only refresh rejects '+name,async t=>{
 const f=displayIndexFixture(t);mutate(f);const cache=copy(f.state.raw),disk=copy(f.state.disk);
 await assert.rejects(f.refresh(),{code:'stale-character-cache'});assert.deepEqual(f.state.raw,cache);assert.deepEqual(f.state.disk,disk);
 assert(!f.state.events.includes('character-cache-refreshed'));
});
for(const kind of ['local','disk','raw','json','binding'])test('displayIndex-only refresh preserves late '+kind+' edits',async t=>{
 let f,reads=0,changed=false;
 f=displayIndexFixture(t,{afterFetch(endpoint,body,s){
  if(endpoint!=='/api/worldinfo/get'||body.name!==s.binding)return;
  reads++;if(reads!==(['disk','raw'].includes(kind)?1:2))return;changed=true;
  if(kind==='local')s.raw.character_book.entries[0].content='late local body';
  if(kind==='disk')s.disk.description='late disk body';
  if(kind==='raw')f.raw.entries['1'].displayIndex=20;
  if(kind==='json'){const live=f.api.getCharData('current'),outer=JSON.parse(live.json_data);outer.data.description='late JSON body';live.json_data=JSON.stringify(outer);}
  if(kind==='binding')s.binding='other-world';
 }});
 if(kind==='json')f.api.getCharData('current').json_data=JSON.stringify({spec:'chara_card_v2',data:copy(f.state.raw)});
 await assert.rejects(f.refresh(),{code:'stale-character-cache'});assert.equal(changed,true);
 assert(!f.state.events.includes('character-cache-refreshed'));
 if(kind==='local')assert.equal(f.state.raw.character_book.entries[0].content,'late local body');
 if(kind==='disk')assert.equal(f.state.disk.description,'late disk body');
 if(kind==='raw')assert.equal(f.raw.entries['1'].displayIndex,20);
 if(kind==='json')assert.equal(JSON.parse(f.api.getCharData('current').json_data).data.description,'late JSON body');
 if(kind==='binding')assert.equal(f.state.binding,'other-world');
});
async function fixture(t,config={}){
 const h=F.fakeBackend(t,config),s=h.state,name=s.binding,expected=h.host.getContext(),route='route-owned';
 const get=h.api.SillyTavern.getContext;h.api.SillyTavern.getContext=()=>({...get(),chatMetadata:{__cxx_story_v1:{routeId:route}}});
 const old=copy(s.raw.extensions.tavern_helper.scripts[0]);old.id=Host.SCRIPT_ID;old.content='original updater';
 const other={...copy(old),id:'private-script',name:'private',content:'keep private',data:{retained:{zero:0}}},trees=[old,other],target={...copy(old),content:'updated updater'};
 const state=s.raw.extensions.tavern_helper.variables[Host.NAMESPACE];state.installed['cyber2051.base-content']={version:'2.3.13'};
 const record={id:'upgrade-owned',name:'cxx-updater-backup-owned',status:'awaiting-reload',sessionId:'old-iframe',context:copy(expected),sourceHash:await Core.sha256(old.content),targetHash:await Core.sha256(target.content)};state.updaterUpgrade=copy(record);
 const raw=s.rawBooks.get(name),before=Object.values(raw.entries).map(Host.rawEntryRuntime),entry=Host.normalizeEntry({...copy(before[0]),uid:2,name:'[mvu_plot][mvu_update]更新任务·测试',content:'任务正文',extra:{__cxx_official_content:{instanceId:state.instanceId,routeId:route,owner:'cyber2051.base-content',id:'quest.fixture',version:'2.3.13'}}});
 const oldBook=C.embeddedBook(name,raw.entries);raw.entries['2']=Host.mergeRawEntry(null,null,entry,1);
 const after=Object.values(raw.entries).map(Host.rawEntryRuntime);
 const journal={format:1,id:'sync-owned',status:'committed',context:copy(expected),stages:['worldbook'],attempted:['worldbook'],completed:['worldbook'],before:{worldbook:{internalName:name,entries:copy(before)}},after:{worldbook:{internalName:name,entries:copy(after)}},installed:{scope:'character'}};
 const release={format:1,id:'release-owned',status:'awaiting-verification',context:copy(expected),completed:['scripts'],installed:{scope:'character'},after:{scripts:{trees:copy(trees)}}};
 raw.extensions={__cxx_update_journals:{[state.instanceId]:{active:{format:1,instanceId:state.instanceId,journal},release:{format:1,instanceId:state.instanceId,journal:release}}}};
 s.rawBooks.set(record.name,{entries:{},extensions:{__cxx_updater_upgrade:{format:1,record:{...copy(record),status:'prepared'},script:copy(old)}}});
 s.raw.extensions.tavern_helper.scripts=[target,other];s.raw.character_book=copy(oldBook);s.disk=copy(s.raw);s.disk.character_book=C.embeddedBook(name,raw.entries);
 return {...h,raw,record,journal,release,oldBook,route,refresh:()=>F.finish(t,h.host.withLock(async()=>true),1000)};
}
test('fresh iframe recovers only the exact committed quest projection after old updater self-save',async t=>{
 const f=await fixture(t),before=copy(f.state.disk),books=copy([...f.state.rawBooks]),messages=copy(f.state.messageFloors);
 await f.refresh();assert.deepEqual(f.state.raw,f.state.disk);assert.deepEqual(f.state.disk,before);assert.deepEqual([...f.state.rawBooks],books);assert.deepEqual(f.state.messageFloors,messages);
 assert.equal(f.state.events.filter(e=>e==='character-cache-refreshed').length,0,'no asynchronous whole-character refresh');assert(!f.state.events.some(e=>e.startsWith('worldbook-persisted')||e==='state-helper-returned'));
});
test('upgrader confirmation uses the same proof and unchanged cards need no refresh',async t=>{
 const f=await fixture(t);await F.finish(t,f.host.confirmUpdaterWrite(f.host.getContext()));assert.deepEqual(f.state.raw,f.state.disk);
 f.state.events.length=0;await f.refresh();assert(!f.state.events.includes('character-cache-refreshed'));
});
const mutations={
 'missing upgrade record':f=>{delete f.state.raw.extensions.tavern_helper.variables[Host.NAMESPACE].updaterUpgrade;delete f.state.disk.extensions.tavern_helper.variables[Host.NAMESPACE].updaterUpgrade;},
 'another character backup':f=>{f.state.rawBooks.get(f.record.name).extensions.__cxx_updater_upgrade.record.context.characterKey='other.png';},
 'another chat backup':f=>{f.state.rawBooks.get(f.record.name).extensions.__cxx_updater_upgrade.record.context.chatId='other-chat';},
 'another instance journal':f=>{f.raw.extensions.__cxx_update_journals['test-instance'].active.instanceId='other';},
 'unfinished content journal':f=>{f.journal.status='prepared';},
 'another route task':f=>{f.raw.entries['2'].extra.__cxx_official_content.routeId='other-route';f.journal.after.worldbook.entries[1].extra.__cxx_official_content.routeId='other-route';},
 'unmanaged added entry':f=>{delete f.raw.entries['2'].extra.__cxx_official_content;delete f.journal.after.worldbook.entries[1].extra.__cxx_official_content;},
 'missing owner and version':f=>{for(const e of[f.raw.entries['2'],f.journal.after.worldbook.entries[1]]){delete e.extra.__cxx_official_content.owner;delete e.extra.__cxx_official_content.version;}},
 'non-quest content':f=>{for(const e of[f.raw.entries['2'],f.journal.after.worldbook.entries[1]])e.extra.__cxx_official_content.id='gameplay.other';},
 'wrong target hash':f=>{for(const d of[f.state.raw,f.state.disk])d.extensions.tavern_helper.scripts[0].content='different target';},
 'changed updater buttons':f=>{for(const d of[f.state.raw,f.state.disk])d.extensions.tavern_helper.scripts[0].button.buttons.push({name:'manual',visible:true});},
 'changed unrelated script':f=>{for(const d of[f.state.raw,f.state.disk])d.extensions.tavern_helper.scripts[1].content='manual script';},
 'local story text':f=>{f.state.raw.description='unsaved player change';},
 'disk story text':f=>{f.state.disk.description='other writer';},
 'unknown local field':f=>{f.state.raw.extensions.privateLocal={keep:true};},
 'unknown disk field':f=>{f.state.disk.extensions.privateDisk={keep:true};},
 'local embedded edit':f=>{f.state.raw.character_book.entries[0].content='unsaved local world';},
 'disk embedded edit':f=>{f.state.disk.character_book.entries[0].content='unknown disk world';},
 'unknown embedded field':f=>{f.state.raw.character_book.entries[0].extensions.privateLocal=true;},
 'modified original world entry':f=>{f.raw.entries['1'].content='changed old entry';f.journal.after.worldbook.entries[0].content='changed old entry';f.state.disk.character_book=C.embeddedBook(f.state.binding,f.raw.entries);},
 'deleted original world entry':f=>{delete f.raw.entries['1'];f.journal.after.worldbook.entries.shift();f.state.disk.character_book=C.embeddedBook(f.state.binding,f.raw.entries);},
 'raw entry differs from committed journal':f=>{f.raw.entries['2'].content='changed after commit';f.state.disk.character_book=C.embeddedBook(f.state.binding,f.raw.entries);},
 'raw projection differs from disk':f=>{f.raw.entries['2'].extensions={unknownAdded:true};},
};
for(const[name,mutate]of Object.entries(mutations))test('self-updater projection rejects '+name,async t=>{
 const f=await fixture(t);mutate(f);const cache=copy(f.state.raw),disk=copy(f.state.disk);
 await assert.rejects(f.refresh(),{code:'stale-character-cache'});assert(!f.state.events.includes('character-cache-refreshed'));assert.deepEqual(f.state.raw,cache);assert.deepEqual(f.state.disk,disk);
});
for(const kind of ['local','disk','raw','context'])test('proof rejects '+kind+' changing during asynchronous reads',async t=>{
 let f,changed=false;f=await fixture(t,{afterFetch(endpoint,body,s){if(changed||endpoint!=='/api/worldinfo/get'||body.name!=='cxx-updater-backup-owned')return;changed=true;if(kind==='local')s.raw.description='late local';if(kind==='disk')s.disk.description='late disk';if(kind==='raw')f.raw.entries['2'].content='late world';if(kind==='context')s.chatId='other-chat';}});
 await assert.rejects(f.refresh(),{code:kind==='context'?'context-changed':'stale-character-cache'});assert.equal(changed,true);assert(!f.state.events.includes('character-cache-refreshed'));
});
for(const kind of ['local','book','json','route','binding'])test('final read window preserves a late '+kind+' change before synchronous cache projection',async t=>{
 let f,reads=0,changed=false;f=await fixture(t,{afterFetch(endpoint,body,s){if(endpoint!=='/api/worldinfo/get'||body.name!==s.binding||++reads!==2)return;changed=true;if(kind==='local')s.raw.description='late unsaved description';if(kind==='book')s.raw.character_book.entries[0].content='late unsaved book';if(kind==='json'){const live=f.api.getCharData('current'),v=JSON.parse(live.json_data);v.data.description='late unsaved JSON';live.json_data=JSON.stringify(v);}if(kind==='route'){const get=f.api.SillyTavern.getContext;f.api.SillyTavern.getContext=()=>({...get(),chatMetadata:{__cxx_story_v1:{routeId:'late-route'}}});}if(kind==='binding')s.binding='other-world';}});
 if(kind==='json')f.api.getCharData('current').json_data=JSON.stringify({spec:'chara_card_v2',data:copy(f.state.raw)});
 const disk=copy(f.state.disk);await assert.rejects(f.refresh(),{code:'stale-character-cache'});assert.equal(changed,true);assert.deepEqual(f.state.disk,disk);assert(!f.state.events.includes('character-cache-refreshed'));if(kind==='local')assert.equal(f.state.raw.description,'late unsaved description');if(kind==='book')assert.equal(f.state.raw.character_book.entries[0].content,'late unsaved book');if(kind==='json')assert.equal(JSON.parse(f.api.getCharData('current').json_data).data.description,'late unsaved JSON');
});
test('atomic projection keeps live object identity and mirrors embedded JSON without changing other data',async t=>{
 const f=await fixture(t),live=f.api.getCharData('current'),data=live.data;live.json_data=JSON.stringify({spec:'chara_card_v2',spec_version:'2.0',data:copy(data)});const original=JSON.parse(live.json_data);
 await f.refresh();assert.equal(f.api.getCharData('current'),live);assert.equal(live.data,data);const updated=JSON.parse(live.json_data);assert.deepEqual(updated,{...original,data:{...original.data,character_book:f.state.disk.character_book}});assert.deepEqual(live.data,f.state.disk);assert(!f.state.events.includes('character-cache-refreshed'));
});

async function addOwnedGameplay(f){
 const Loadout=require('../../卡片源码/运行时/loadout.js'),Gameplay=require('../../卡片源码/运行时/gameplay.js');
 const state=f.state.raw.extensions.tavern_helper.variables[Host.NAMESPACE],gameplay=Loadout.initial('street',{});
 f.state.messageFloors[0].stat_data.terminal.gameplay=gameplay;
 const chat=[{swipe_id:1}],get=f.api.SillyTavern.getContext;f.api.SillyTavern.getContext=()=>({...get(),chat});f.chat=chat;
 let uid=3;
 for(const wanted of Gameplay.promptEntries(state.registry,{},gameplay)){
  const entry=Host.normalizeEntry({...wanted.entry,uid:uid++});entry.name='[mvu_plot][mvu_update]'+entry.name;
  const baseline=(await Core.fingerprints({worldbook:{internalName:'content',entries:[entry]}})).worldbook.entries.records['number:'+entry.uid];
  entry.extra={...entry.extra,__cxx_official_content:{instanceId:state.instanceId,routeId:f.route,owner:wanted.owner,id:wanted.id,version:wanted.version,baseline}};
  f.raw.entries[entry.uid]=Host.mergeRawEntry(null,null,entry,entry.uid);
  f.journal.after.worldbook.entries.push(copy(entry));
 }
 f.state.disk.character_book=C.embeddedBook(f.state.binding,f.raw.entries);
 return f;
}
test('first content sync proves exact owned equipment additions alongside tasks without an installed provider package',async t=>{
 const f=await addOwnedGameplay(await fixture(t)),disk=copy(f.state.disk),books=copy([...f.state.rawBooks]),messages=copy(f.state.messageFloors);
 assert.equal(f.state.raw.extensions.tavern_helper.variables[Host.NAMESPACE].installed.cxx_loadout,undefined);
 await f.refresh();assert.deepEqual(f.state.raw,disk);assert.deepEqual(f.state.disk,disk);assert.deepEqual([...f.state.rawBooks],books);assert.deepEqual(f.state.messageFloors,messages);
});
const gameplayMutations={
 'missing actual owned references':f=>{f.state.messageFloors[0].stat_data.terminal.gameplay={};},
 'definition changed since sync':f=>{f.state.messageFloors[0].stat_data.terminal.gameplay.itemDefinitions.optics_t1.name='changed definition';},
 'forged matching-prefix entry':f=>{f.raw.entries[3].content='unrelated content';f.journal.after.worldbook.entries[2].content='unrelated content';},
 'wrong baseline fingerprint':f=>{f.raw.entries[3].extra.__cxx_official_content.baseline.hash='0'.repeat(64);f.journal.after.worldbook.entries[2].extra.__cxx_official_content.baseline.hash='0'.repeat(64);},
 'unknown generated field':f=>{f.raw.entries[3].extra.futureUnknown=true;f.journal.after.worldbook.entries[2].extra.futureUnknown=true;},
 'different provider version':f=>{f.raw.entries[3].extra.__cxx_official_content.version='9.0.0';f.journal.after.worldbook.entries[2].extra.__cxx_official_content.version='9.0.0';},
 'another route equipment':f=>{f.raw.entries[3].extra.__cxx_official_content.routeId='other';f.journal.after.worldbook.entries[2].extra.__cxx_official_content.routeId='other';},
};
for(const[name,mutate]of Object.entries(gameplayMutations))test('owned equipment projection rejects '+name,async t=>{
 const f=await addOwnedGameplay(await fixture(t));mutate(f);f.state.disk.character_book=C.embeddedBook(f.state.binding,f.raw.entries);const local=copy(f.state.raw),disk=copy(f.state.disk);
 await assert.rejects(f.refresh(),{code:'stale-character-cache'});assert.deepEqual(f.state.raw,local);assert.deepEqual(f.state.disk,disk);
});
for(const kind of ['variables','branch','pins','migration'])test('owned equipment proof rejects late '+kind+' change at final read window',async t=>{
 let f,reads=0,changed=false;f=await fixture(t,{afterFetch(endpoint,body,s){if(endpoint!=='/api/worldinfo/get'||body.name!==s.binding||++reads!==2)return;changed=true;if(kind==='variables')s.messageFloors[0].stat_data.terminal.gameplay={};if(kind==='branch')f.chat[0].swipe_id=2;if(kind==='pins')s.chatVariables.__cxx_content_pins={other:'1.0.0'};if(kind==='migration')s.chatVariables.__cxx_migration={format:1,archive:{packages:{}}};}});await addOwnedGameplay(f);
 const local=copy(f.state.raw),disk=copy(f.state.disk);await assert.rejects(f.refresh(),{code:'stale-character-cache'});assert.equal(changed,true);assert.deepEqual(f.state.raw,local);assert.deepEqual(f.state.disk,disk);
});
