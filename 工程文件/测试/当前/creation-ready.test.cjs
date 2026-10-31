'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../lib/fixture-loader.cjs')('../当前/save.test.cjs',['fixture']),Library=require('../../卡片源码/运行时/story-library.js'),I=require('../../卡片源码/运行时/identity.js'),T=require('../../卡片源码/运行时/talents.js'),Core=require('../../卡片源码/运行时/core.js');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('new story seeds real card greetings without copying old player state',()=>{
 const card=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../交付/基线/2.3.0-整理前.json'))),route={kind:'route',stage:'creating',creationId:'new',slot:1,openingDraft:{profile:{name:'未提交人物'}}};
 const rows=Library.openingRows({json_data:JSON.stringify(card)},{name1:'当前玩家',name2:'当前卡'},route);
 assert.equal(rows.length,2);assert.equal(rows[1].mes,card.data.first_mes);assert.deepEqual(rows[1].swipes,[card.data.first_mes,...card.data.alternate_greetings]);assert.equal(rows[1].swipe_id,0);assert.equal(rows[1].swipe_info.length,rows[1].swipes.length);assert.equal(rows[1].variables,undefined);assert.equal(rows[0].chat_metadata.variables,undefined);assert.deepEqual(rows[0].chat_metadata[Library.KEY],route);
 assert.throws(()=>Library.openingRows({data:{first_mes:''}}, {},route),{code:'creation-greeting-missing'});
});
test('custom weapon and selected talents survive delayed first greeting and verified save',async()=>{
 const f=fixture('custom');try{
  const growth=T.initialize({...I.initialSetup('custom'),attributes:{body:4,reflexes:3,intelligence:3,technical:3,cool:3},perkPoints:10},'custom');let build=T.build(growth);build=T.edit(growth,build,{kind:'perk',id:'Body_Central_Milestone_1',delta:1});
  const choice=I.snapshot('custom','自定义人物背景',T.allocate(growth,build),{items:[{template:'pistol',tier:2,name:'自定义电磁手枪',description:'人物制作的武器',quantity:1,status:'equipped'}]});
  f.c.chat=[];const work=f.player.completeOpening({value:choice,swipe:3});await delay(20);assert.equal(f.stats().writes,0);f.c.chat=[f.row];await work;await f.player.waitForSaved();
  const saved=f.row.variables[3].stat_data.terminal.gameplay;assert.equal(f.row.swipe_id,3);assert.equal(saved.growth.perks.Body_Central_Milestone_1,1);assert(Object.values(saved.itemDefinitions||{}).some(x=>x.name==='自定义电磁手枪'));assert.deepEqual(f.row.variables[3].stat_data.terminal.unknown,{keep:true});assert.deepEqual(f.disk()[1].variables[3],f.row.variables[3]);
 }finally{f.player.stop();}
});
test('ordinary origins also wait for the first greeting instead of reading undefined',async()=>{
 const f=fixture('street');try{f.c.chat=[];const work=f.player.completeOpening({value:f.choice,swipe:2});await delay(20);assert.equal(f.stats().writes,0);f.c.chat=[f.row];await work;await f.player.waitForSaved();assert.equal(f.row.swipe_id,2);assert(f.row.variables[2].stat_data.terminal.gameplay.growth);}finally{f.player.stop();}
});
test('missing greeting times out with a recoverable code and no state writes',async()=>{
 const f=fixture('custom',{openingReadyTimeout:30});try{f.c.chat=[];await assert.rejects(f.player.completeOpening({value:f.choice}),{code:'opening-message-pending'});assert.equal(f.stats().writes,0);assert.deepEqual(f.c.chat,[]);assert.equal(f.c.chatMetadata.variables.__cxx_identity,undefined);}finally{f.player.stop();}
});
test('chat switch during greeting wait stops old creation without writing into the new chat',async()=>{
 const f=fixture('custom');try{f.c.chat=[];const work=f.player.completeOpening({value:f.choice});await delay(20);f.switchChat();f.c.chat=[f.row];await assert.rejects(work,{code:'context-changed'});assert.equal(f.stats().writes,0);}finally{f.player.stop();}
});
test('resuming a header-only owned story ensures its opening before saving the same draft',async()=>{
 const K=Library.KEY,draft={creationId:'same',profile:{name:'保留人物'}},header={chat_metadata:{[K]:{kind:'route',stage:'creating',creationId:'same',slot:1},unknown:{keep:true}}};let rows=[structuredClone(header)],ensures=0;
 const adapter={current:async()=>({chatId:'same-chat',rows:structuredClone(rows)}),ensureOpening:async(id,cid)=>{assert.equal(id,'same-chat');assert.equal(cid,'same');ensures++;rows.push({mes:'<OpeningForm/>',swipe_id:0});},tagCurrent:async m=>{assert.equal(rows.length,2);rows[0].chat_metadata[K]=structuredClone(m);}};
 const store=Library.createStore({adapter,hash:v=>Core.sha256(v),uuid:()=> 'new-id'});await store.saveOpeningDraft(draft,'same-chat');assert.equal(ensures,1);assert.deepEqual(rows[0].chat_metadata.unknown,{keep:true});assert.deepEqual(rows[0].chat_metadata[K].openingDraft,draft);await store.saveOpeningDraft(draft,'same-chat');assert.equal(ensures,1);
});
test('native adapter repairs a header-only failed creation, preserves metadata, and reads back one greeting',async()=>{
 const K=Library.KEY,card=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../交付/基线/2.3.0-整理前.json'))),draft={creationId:'same',profile:{name:'恢复人物'}},db={rows:[{user_name:'旧名字',chat_metadata:{[K]:{kind:'route',stage:'creating',creationId:'same',slot:2,openingDraft:{profile:{name:'原草稿'}}},variables:{external:{keep:1}},unknown:{keep:true}}}]};
 const c={name1:'当前玩家',name2:card.data.name,characterId:0,characters:[{avatar:'card.png'}],chat:[],chatMetadata:structuredClone(db.rows[0].chat_metadata),getCurrentChatId:()=> 'same-chat',getRequestHeaders:()=>({}),async saveChat(){db.rows=[{...db.rows[0],chat_metadata:structuredClone(c.chatMetadata)},...structuredClone(c.chat)];},async openCharacterChat(){c.chat=structuredClone(db.rows.slice(1));c.chatMetadata=structuredClone(db.rows[0].chat_metadata);}};
 const requests=[],originalFetch=global.fetch,originalParent=global.parent;global.parent=global;global.fetch=async(url,options)=>{requests.push({url,bytes:Buffer.byteLength(options.body)});const body=JSON.parse(options.body);if(url==='/api/chats/save'){db.rows=structuredClone(body.chat);return {ok:true,json:async()=>({ok:true})};}if(url==='/api/chats/export')return {ok:true,json:async()=>({result:db.rows.map(JSON.stringify).join('\n')})};throw Error('unexpected endpoint '+url);};
 const context={characterKey:'card.png',chatId:'same-chat',cardId:'card'},host={getContext:()=>context,assertContext(e){assert.equal(e.chatId,context.chatId);},assertPlayerWritable:async()=>{},withChatSave:async(e,fn)=>fn(),readState:()=>({instanceId:'instance'}),startChatSaveGuard:()=>({navigate:async({target,work})=>{assert.deepEqual(target,{characterKey:context.characterKey,chatId:context.chatId});return work();}})};
 const service=Library.create({api:{SillyTavern:{getContext:()=>c},getCharData:()=>card},top:{fetch:global.fetch},host,backup:{},Core,crypto:{uuid:()=> 'unused'}});
 try{await service.store.saveOpeningDraft(draft,'same-chat');assert.equal(c.chat.length,1);assert.equal(c.chat[0].mes,card.data.first_mes);assert.equal(c.chat[0].swipe_id,0);assert.equal(c.chat[0].swipes.length,card.data.alternate_greetings.length+1);assert.deepEqual(db.rows[0].chat_metadata.variables,{external:{keep:1}});assert.deepEqual(db.rows[0].chat_metadata.unknown,{keep:true});assert.deepEqual(db.rows[0].chat_metadata[K].openingDraft,draft);assert.equal(requests.filter(r=>r.url==='/api/chats/save').length,1);await service.store.saveOpeningDraft(draft,'same-chat');assert.equal(requests.filter(r=>r.url==='/api/chats/save').length,1);}finally{service.destroy();global.fetch=originalFetch;global.parent=originalParent;}
});
