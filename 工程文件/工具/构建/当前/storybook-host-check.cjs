'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const input=JSON.parse(fs.readFileSync(process.argv[2])),root=path.resolve(__dirname,'../../..'),out=path.join(root,'.cache/storybook228'),origin=process.env.CXX_TEST_ORIGIN||'http://127.0.0.1:6948';
(async()=>{
 const report={input:input.input,host:input.host,errors:[]},browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});let page;
 try{
  page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>report.errors.push(e.message));await page.route('**/api/backends/**',r=>r.abort());await page.goto(origin);await page.waitForFunction(()=>window.TavernHelper&&window.SillyTavern&&!document.querySelector('#preloader'));
  const avatar=input.import.body.file_name+'.png';await page.evaluate(async({avatar,chat})=>{let c=SillyTavern.getContext();if(c.characters[c.characterId]?.avatar!==avatar)await c.selectCharacterById(c.characters.findIndex(x=>x.avatar===avatar));c=SillyTavern.getContext();if(c.getCurrentChatId()!==chat)await c.openCharacterChat(chat);},{avatar,chat:input.saved.chat});
  await page.waitForFunction(()=>window.Cxx233Updater&&window.CxxStoryProfile&&window.CxxVariableMode?.read().ready);await page.waitForTimeout(3000);
  report.profile=await page.evaluate(async()=>{
   const c=SillyTavern.getContext(),P=CxxStoryProfile,names=TavernHelper.getWorldbookNames(),book=TavernHelper.getChatWorldbookName('current'),original=structuredClone(c.chatMetadata[P.KEY]);
   const saved=await P.bind(window,{...original,name:'世界书复用检查',additional:'只属于本故事的手写资料'},{api:TavernHelper});
   return {book,after:saved.binding.worldbook,added:TavernHelper.getWorldbookNames().filter(n=>!names.includes(n)),text:(await TavernHelper.getWorldbook(book)).find(e=>e.extra?.__cxx_story_profile)?.content};
  });assert.equal(report.profile.book,report.profile.after);assert.deepEqual(report.profile.added,[]);assert(report.profile.text.includes('只属于本故事的手写资料'));assert(!report.profile.text.includes('默认 User 验证文字'));
  report.content=await page.evaluate(async()=>{
   const u=Cxx233Updater,h=u.host,c=SillyTavern.getContext(),names=TavernHelper.getWorldbookNames(),book=TavernHelper.getChatWorldbookName('current');
   const run=async work=>{for(let i=0;i<5;i++){try{return await h.withLock(work);}catch(e){if(!['update-already-running','generation-busy'].includes(e.code)||i===4)throw e;await new Promise(r=>setTimeout(r,2500));}}};
   const values=[];
   for(const text of ['玩法资料初次同步','玩法资料修改后同步']){
    await run(async()=>{await u.recover();await u.initialize();await u.initializeChat();const state=h.readState();state.registry.packages.__storybook_test={version:'1',content:{worldbook:[{uid:5,name:'世界书复用检查',content:text}],quests:[],gallery:[]}};await h.saveState(state);await u.syncChat();});
    values.push({book:TavernHelper.getChatWorldbookName('current'),text:(await TavernHelper.getWorldbook(book)).find(e=>e.extra?.__cxx_official_content?.owner==='__storybook_test')?.content});
   }
   await run(()=>u.syncChat());
   const state=h.readState(),primary=TavernHelper.getCharWorldbookNames('current').primary,raw=await fetch('/api/worldinfo/get',{method:'POST',headers:c.getRequestHeaders(),body:JSON.stringify({name:primary})}).then(r=>r.json());
   return {values,added:TavernHelper.getWorldbookNames().filter(n=>!names.includes(n)),primary,primaryCount:Object.keys(raw.entries).length,journalOnPrimary:!!raw.extensions?.__cxx_update_journals?.[state.instanceId],pending:!!state.journalName,book,storyProfileCount:(await TavernHelper.getWorldbook(book)).filter(e=>e.extra?.__cxx_story_profile).length};
  });assert.deepEqual(report.content.added,[]);assert(report.content.values.every(v=>v.book===report.profile.book));assert.equal(report.content.values[1].text,'玩法资料修改后同步');assert.equal(report.content.pending,false);assert.equal(report.content.primaryCount,99);assert(report.content.journalOnPrimary);assert.equal(report.content.storyProfileCount,1);
  await page.reload();await page.waitForFunction(()=>window.TavernHelper&&window.SillyTavern&&!document.querySelector('#preloader'));await page.evaluate(async({avatar,chat})=>{let c=SillyTavern.getContext();if(c.characters[c.characterId]?.avatar!==avatar)await c.selectCharacterById(c.characters.findIndex(x=>x.avatar===avatar));c=SillyTavern.getContext();if(c.getCurrentChatId()!==chat)await c.openCharacterChat(chat);},{avatar,chat:input.saved.chat});await page.waitForFunction(()=>window.CxxVariableMode?.read().ready&&window.Cxx233Updater&&window.CxxStoryProfile);await page.waitForTimeout(2000);
  report.reloaded=await page.evaluate(async()=>{const name=TavernHelper.getChatWorldbookName('current'),rows=await TavernHelper.getWorldbook(name);return {name,profile:rows.find(e=>e.extra?.__cxx_story_profile)?.content,content:rows.find(e=>e.extra?.__cxx_official_content?.owner==='__storybook_test')?.content};});
  assert.equal(report.reloaded.name,report.profile.book);assert.equal(report.reloaded.profile,report.profile.text);assert.equal(report.reloaded.content,'玩法资料修改后同步');assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.stack;if(page)report.state=await page.evaluate(()=>({status:window.Cxx233Updater?.getStatus(),context:window.Cxx233Updater?.host.getContext(),state:window.Cxx233Updater?.host.readState()})).catch(()=>null);throw e;}finally{await browser.close();fs.writeFileSync(path.join(out,'reuse-host.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
