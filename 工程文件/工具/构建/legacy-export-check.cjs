'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto,createHash}=require('node:crypto');
const Build=require('./legacy-export-tool.cjs'),{extract}=require('../lib/script-modules.cjs'),{inlineSource}=require('../lib/inline-source.cjs');
const copy=value=>JSON.parse(JSON.stringify(value)),sha=value=>createHash('sha256').update(value).digest('hex');
const oldFile=process.env.CXX_LEGACY_CARD||'C:/Users/lolian/Downloads/2051_V1.2.0.png';
const out=path.join(Build.root,'.cache/legacy1x');fs.mkdirSync(out,{recursive:true});
function readPNG(file){
  const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset),data=bytes.subarray(offset+8,offset+8+length);
    if(bytes.toString('ascii',offset+4,offset+8)==='tEXt'&&data.subarray(0,6).toString()==='chara\0')return JSON.parse(Buffer.from(data.subarray(6).toString(),'base64').toString('utf8'));
    offset+=length+12;}
  throw Error('Missing character metadata');
}
const oldCard=readPNG(oldFile),built=Build.make(),target=JSON.parse(fs.readFileSync(built.targetFile,'utf8'));
const names=['CxxSha256','CxxCrypto','CxxPhoneCore','CxxUpdateCore','CxxUpdateBackup','CxxLegacyExport'];
const modules=extract(built.script.content,names).map(value=>value.source).join('\n;\n');
const targetUpdater=target.data.extensions.tavern_helper.scripts.find(script=>script.id==='cf33c692-7a41-444d-b8b7-6a70163e0104'),seed=targetUpdater.data.__cxx_update_seed;
const exactBackupSource=extract(targetUpdater.content,['CxxUpdateBackup'])[0].source;
function oldVariables(number){return {stat_data:Object.fromEntries(oldCard.data.character_book.entries.find(entry=>entry.id===15).content.matchAll(/([^\n:]+):\n  好感度: (\d+)/g).map(([_,name])=>[name,{好感度:number}])),initialized_lorebooks:{'旧世界书':[15]},display_data:{keep:true},delta_data:{},unknown:{keep:'旧变量'}};}
function fixture(version='1.2.0'){
  const state={card:copy(oldCard),chatId:'original-legacy-chat',characterKey:'old2051.png',busy:false,saves:0,requests:[],
    messages:[{mes:'旧故事正文',name:'旧角色',is_user:false,swipes:['旧故事正文','未选中的另一条回复'],swipe_id:0,variables:[oldVariables(755),oldVariables(123)],swipe_info:[{extra:{keep:1}},{extra:{keep:2}}],foreignMessage:'保留'},
      {mes:'旧玩家的回复',name:'玩家',is_user:true,variables:[oldVariables(761)],foreignMessage:{keep:true}}],metadata:{integrity:'old-integrity',world_info:'旧故事世界书',variables:{playerNotes:'旧聊天笔记'},foreignMetadata:{keep:true}}};
  state.card.data.character_version=version;
  const header=()=>({user_name:'玩家',character_name:'旧角色',foreignHeader:{keep:true},chat_metadata:copy(state.metadata)});
  const context={get chat(){return state.messages;},get chatMetadata(){return state.metadata;},getCurrentChatId:()=>state.chatId,getRequestHeaders:()=>({'Content-Type':'application/json'}),saveChat:async()=>{state.saves++;},groupId:null};
  const api={SillyTavern:{getContext:()=>context},getCurrentCharacterId:()=>state.characterKey,getCharData:()=>state.card,builtin:{duringGenerating:()=>state.busy},
    getTavernVersion:()=> '1.19.0',getTavernHelperVersion:()=> '4.11.3',
    getChatMessages:()=>state.messages.map((message,index)=>({message_id:index,swipe_id:message.swipe_id??0,swipes:message.swipes||[message.mes],swipes_data:(message.swipes||[message.mes]).map((_,swipe)=>message.variables?.[swipe]||{})}))};
  const fetch=async(url,request)=>{
    state.requests.push({url,body:JSON.parse(request.body)});assert.ok(url.endsWith('/api/chats/export'));
    const rows=[header(),...copy(state.messages)];state.changeDisk?.(rows);await state.onRead?.();
    return {ok:true,json:async()=>({result:rows.map(JSON.stringify).join('\n')})};
  };
  const realm=vm.createContext({crypto:webcrypto,TextEncoder,ArrayBuffer,Uint8Array,Blob,URL,fetch,setTimeout,clearTimeout,parent:{location:{origin:'http://legacy.local'}}});vm.runInContext(modules,realm);
  const tool=realm.CxxLegacyExport.create({api,wait:async()=>{await state.onWait?.();}});
  return {state,api,realm,tool,header};
}
async function documentOf(file){return JSON.parse(await (await fetch(file.url)).text());}
function importer(realm){
  let state={instanceId:'target-211-instance',registry:copy(seed.registry||{packages:{}})};
  const ctx={cardId:'cyber2051',characterKey:'target211.png',chatId:'target-title'},copies=new Map();
  const messages=[{mes:'新版标题页',variables:[{stat_data:{}}]}],metadata={integrity:'target-integrity'};
  const header={user_name:'玩家',character_name:target.data.name,chat_metadata:metadata};
  const host={getContext:()=>copy(ctx),assertContext:expected=>assert.deepEqual(copy(expected),ctx),readState:()=>copy(state),saveState:async value=>{state=copy(value);},withLock:async work=>work(),ready:async()=>{}};
  const adapters={snapshot:()=>({messages:copy(messages),metadata:copy(metadata),updateState:copy(state),versions:{}}),
    readCurrent:async()=>({header:copy(header),jsonl:[header,...messages].map(JSON.stringify).join('\n')}),
    initializationBooks:async()=>[target.data.character_book.name],copyExists:async(_,id)=>copies.has(id),
    writeCopy:async(_,id,rows)=>copies.set(id,copy(rows)),readCopy:async(_,id)=>copy(copies.get(id)||[])};
  const exactBackup=vm.runInNewContext(exactBackupSource+'\n;CxxUpdateBackup;',{CxxCrypto:realm.CxxCrypto,CxxPhoneCore:realm.CxxPhoneCore,crypto:webcrypto,TextEncoder});
  const backup=exactBackup.create({api:{},host,core:realm.CxxUpdateCore,seed:copy(seed),adapters,wait:async()=>{}});
  return {backup,copies,messages,metadata};
}
async function main(){
  const report={scope:'Provided 1.2.0 PNG and same-structure simulated 1.0.0; patched export backup module and exact unchanged delivered 2.2.11 importer. Controlled host and isolated browser, not player ST/TT.',oldPNG:sha(fs.readFileSync(oldFile)),targetCard:built.targetSha256,checks:[],browser:null};
  const check=async(name,work)=>{await work();report.checks.push(name);};
  await check('Transport retains 2.2.11 modules with only the maintained backup fix applied',async()=>{
    const actual=target.data.extensions.tavern_helper.scripts.find(script=>script.id=== 'cf33c692-7a41-444d-b8b7-6a70163e0104');
    const originals=extract(actual.content,names.slice(0,-1));for(const original of originals){const expected=original.name==='CxxUpdateBackup'?extract(inlineSource(fs.readFileSync(path.join(Build.root,'卡片源码/运行时/backup.js'),'utf8')),['CxxUpdateBackup'])[0].source:original.source;assert.equal(extract(built.script.content,[original.name])[0].source,expected);}
    assert.equal(originals.length,5);
  });
  await check('ST Date metadata exports without false branch mismatch and imports into unchanged 2.2.11',async()=>{
    const h=fixture(),date=new Date('2026-10-15T03:04:05.000Z');h.state.messages[0].swipe_info[0].gen_started=date;h.state.messages[0].swipe_info[1].gen_finished=date;
    const before=copy(h.state.messages),file=await h.tool.exportMigration(),doc=await documentOf(file);
    assert.deepEqual(doc.payload.messages,before);assert.equal(h.state.messages[0].swipe_info[0].gen_started,date);
    const to=importer(h.realm),preview=await to.backup.previewMigration(doc),result=await to.backup.importMigration(doc,{preview,confirm:'migrate-copy'});
    assert.equal(result.status,'complete');assert.equal(to.copies.get(result.chatId)[1].swipe_info[1].gen_finished,date.toISOString());file.revoke();
  });
  for(const version of ['1.2.0','1.0.0'])await check(version+' exports and imports into exact 2.2.11 with all branches and unknown fields',async()=>{
    const h=fixture(version),before=copy({card:h.state.card,messages:h.state.messages,metadata:h.state.metadata}),file=await h.tool.exportMigration(),doc=await documentOf(file);
    assert.equal(doc.source.baseVersion,version);assert.equal(doc.source.contract,seed.migration.contract);
    assert.deepEqual(doc.payload.messages,before.messages);assert.deepEqual(doc.payload.header,h.header());assert.deepEqual(doc.payload.archive,{packages:{},legacyQuests:[]});
    const targetHost=importer(h.realm),preview=await targetHost.backup.previewMigration(doc);
    assert.equal(preview.target.baseVersion,'2.2.11');
    const result=await targetHost.backup.importMigration(doc,{preview,confirm:'migrate-copy'});assert.equal(result.status,'complete');
    const rows=targetHost.copies.get(result.chatId);assert.deepEqual(rows[0].foreignHeader,before.metadata.foreignHeader||{keep:true});
    for(let i=0;i<before.messages.length;i++){
      assert.equal(rows[i+1].mes,before.messages[i].mes);assert.deepEqual(rows[i+1].swipes,before.messages[i].swipes);
      for(const [index,old]of Object.entries(before.messages[i].variables)){
        const variables=rows[i+1].variables[index];assert.deepEqual(variables.stat_data,old.stat_data);assert.deepEqual(variables.unknown,old.unknown);
        assert.ok(Object.hasOwn(variables.initialized_lorebooks,target.data.character_book.name));
      }
    }
    assert.equal(rows[0].chat_metadata.__cxx_story_v1.stage,'playing');assert.equal(rows[0].chat_metadata.variables.playerNotes,'旧聊天笔记');
    assert.deepEqual({card:h.state.card,messages:h.state.messages,metadata:h.state.metadata},before);
    assert.equal(h.state.saves,1);assert.equal(h.state.requests.length,1);assert.equal(targetHost.messages[0].mes,'新版标题页');
    fs.writeFileSync(path.join(out,'fixture-'+version+'-migration.json'),JSON.stringify(doc,null,2));file.revoke();
  });
  await check('2.2.11 keeps affinity retired after importing the legacy save',async()=>{
    const Schema=require('../../卡片源码/MVU/schema.js'),local=extract(inlineSource(fs.readFileSync(path.join(Build.root,'卡片源码/MVU/schema.js'),'utf8')),['Cxx236Schema'])[0];
    const actual=target.data.extensions.tavern_helper.scripts.flatMap(script=>extract(script.content,['Cxx236Schema']));assert.equal(actual.length,1);assert.equal(actual[0].source,local.source);
    const guard=Schema.build(require('D:/SillyTavern/node_modules/zod'));
    const h=fixture(),file=await h.tool.exportMigration(),doc=await documentOf(file),to=importer(h.realm),preview=await to.backup.previewMigration(doc);
    const imported=await to.backup.importMigration(doc,{preview,confirm:'migrate-copy'}),rows=to.copies.get(imported.chatId);
    for(const row of rows.slice(1))for(const variables of Object.values(row.variables||{})){
      const before=copy(variables.stat_data),transaction=guard.prepare([{op:'replace',path:'/丰川祥子/好感度',value:999}],variables.stat_data);
      assert.deepEqual(transaction.patches,[]);assert.equal(transaction.ignored.length,1);assert.deepEqual(variables.stat_data,before);
    }
    const retired=target.data.character_book.entries.find(entry=>entry.id===2);assert.equal(retired.enabled,false);assert.equal(retired.content,'');
    for(const id of [0,1,4,6,7,8,9,10,11,12,13,14,15,40])assert.doesNotMatch(target.data.character_book.entries.find(entry=>entry.id===id).content,/好感度/);
    file.revoke();
  });
  await check('Concurrent prepare joins one export; changes after prepare invalidate download',async()=>{
    const h=fixture(),first=h.tool.exportMigration(),second=h.tool.exportMigration();assert.equal(first,second);const file=await first;
    h.state.messages[0].variables[0].stat_data['丰川祥子'].好感度++;assert.throws(file.assertCurrent,{code:'migration-export-stale'});file.revoke();assert.equal(h.state.requests.length,1);
  });
  await check('Switching chat during export stops the operation',async()=>{
    const h=fixture();h.state.onRead=()=>{h.state.chatId='another-chat';};await assert.rejects(h.tool.exportMigration(),{code:'context-changed'});
  });
  await check('Generation, group chats and missing MVU progress are rejected',async()=>{
    for(const kind of ['busy','group','mvu']){const h=fixture();if(kind==='busy')h.state.busy=true;if(kind==='group')h.api.SillyTavern.getContext().groupId='group';if(kind==='mvu')for(const message of h.state.messages)message.variables=[];
      await assert.rejects(h.tool.exportMigration(),{code:kind==='mvu'?'legacy-mvu-missing':'host-busy'});assert.equal(h.state.requests.length,0);}
  });
  await check('Other cards and 2.x cards are rejected; no old updater is required',async()=>{
    for(const kind of ['other','new']){const h=fixture();if(kind==='other')h.state.card.data.name='其他卡';else h.state.card.data.character_version='2.2.11';await assert.rejects(h.tool.exportMigration(),{code:'legacy-source'});}
    assert.equal(oldCard.data.extensions.tavern_helper.scripts.length,1);
  });
  await check('Incomplete alternate branches and mismatched persisted variables stop export',async()=>{
    for(const kind of ['cold','branch','variable']){const h=fixture();h.state.changeDisk=rows=>{if(kind==='cold')rows[1].tt_swipe_cold=true;if(kind==='branch')rows[1].swipes.pop();if(kind==='variable')rows[1].variables[0].stat_data['丰川祥子'].好感度=0;};
      await assert.rejects(h.tool.exportMigration(),{code:kind==='variable'?'backup-chat-not-persisted':'backup-branches-incomplete'});}
  });
  await check('Tampered migration file fails exact target checksum validation',async()=>{
    const h=fixture(),file=await h.tool.exportMigration(),doc=await documentOf(file);doc.payload.messages[0].mes='changed';await assert.rejects(importer(h.realm).backup.previewMigration(doc),{code:'migration-hash-mismatch'});file.revoke();
  });
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
  if(process.argv.includes('--browser')){
    const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    const h=fixture(),errors=[];h.state.messages[0].swipe_info[0].gen_started=new Date('2026-10-15T03:04:05.000Z');
    try{
      const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body style="background:#111"></body>'}));await page.goto('http://legacy.local');
      await page.evaluate(({card,messages,metadata})=>{
        window.fixture={card,messages,metadata,chatId:'old-chat',requests:0,saves:0};window.events={};
        const c={get chat(){return fixture.messages;},get chatMetadata(){return fixture.metadata;},getCurrentChatId:()=>fixture.chatId,getRequestHeaders:()=>({'Content-Type':'application/json'}),saveChat:async()=>{fixture.saves++;}};
        window.SillyTavern={getContext:()=>c};window.getCharData=()=>fixture.card;window.getCurrentCharacterId=()=> 'old.png';window.builtin={duringGenerating:()=>false};window.getTavernVersion=()=> '1.19.0';window.getTavernHelperVersion=()=> '4.11.3';
        window.getChatMessages=()=>fixture.messages.map((m,i)=>({message_id:i,swipe_id:m.swipe_id??0,swipes:m.swipes||[m.mes],swipes_data:(m.swipes||[m.mes]).map((_,j)=>m.variables?.[j]||{})}));
        window.fetch=async()=>{fixture.requests++;return {ok:true,json:async()=>({result:[{user_name:'玩家',foreignHeader:'keep',chat_metadata:fixture.metadata},...fixture.messages].map(JSON.stringify).join('\n')})};};
        window.getButtonEvent=name=>name;window.eventOn=(name,handler)=>events[name]=handler;window.eventRemoveListener=name=>delete events[name];
      },{card:h.state.card,messages:h.state.messages,metadata:h.state.metadata});
      await page.addScriptTag({content:built.script.content});assert.equal(await page.evaluate(()=>fixture.requests),0);
      await page.evaluate(()=>events['1.x旧版存档导出']());const panel=page.locator('dialog'),prepare=panel.getByRole('button',{name:'准备续玩存档',exact:true}),download=panel.getByRole('button',{name:'下载存档',exact:true});
      for(const [width,height]of [[390,844],[844,390],[1440,900]]){await page.setViewportSize({width,height});assert.ok(await panel.evaluate(node=>node.scrollWidth<=node.clientWidth+1));await page.screenshot({path:path.join(out,'panel-'+width+'.png')});}
      await page.setViewportSize({width:390,height:844});await prepare.click();assert.equal(await download.isEnabled(),false);assert.equal(await panel.getByRole('button',{name:'关闭',exact:true}).isEnabled(),true);
      await download.waitFor({state:'visible'});await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(node=>node.textContent==='下载存档').disabled);
      const waiting=page.waitForEvent('download');await download.click();const downloaded=await waiting;await downloaded.saveAs(path.join(out,'browser-migration.json'));
      const doc=JSON.parse(fs.readFileSync(path.join(out,'browser-migration.json'),'utf8'));await importer(h.realm).backup.previewMigration(doc);assert.deepEqual(doc.payload.messages,copy(h.state.messages));
      await page.evaluate(()=>fixture.messages[0].mes='changed');await download.click();assert.equal(await download.isEnabled(),false);
      await panel.getByRole('button',{name:'关闭',exact:true}).click();await page.evaluate(()=>events['1.x旧版存档导出']());assert.equal(await page.locator('dialog').count(),1);
      await page.evaluate(()=>dispatchEvent(new Event('pagehide')));assert.equal(await page.locator('dialog').count(),0);assert.equal(await page.evaluate(()=>Object.keys(events).length),0);
      assert.deepEqual(errors,[]);report.browser={viewports:['390x844','844x390','1440x900'],download:'browser-migration.json',requests:await page.evaluate(()=>fixture.requests),errors,checks:['actual bundle opens only on button','actual Blob download accepted by exact target','responsive dialog','stale download rejected','close/reopen and teardown']};
    }finally{await browser.close();}
  }
  assert.equal(sha(fs.readFileSync(built.targetFile)),built.targetSha256);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
