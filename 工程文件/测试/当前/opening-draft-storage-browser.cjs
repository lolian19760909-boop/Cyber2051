const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),src=process.env.CXX_DRAFT_SOURCE_ROOT||path.join(root,'卡片源码'),out=process.env.CXX_EVIDENCE||path.join(root,'.cache/checks/opening-draft-storage');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage(),report={};
try{
 await page.route('http://draft-storage.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><body>Draft storage verification</body></html>'}));await page.goto('http://draft-storage.test/');
 for(const file of ['共享/data-clone.js','运行时/opening-flow.js','运行时/appearance.js','运行时/creator-ui.js'])await page.addScriptTag({content:fs.readFileSync(path.join(src,file),'utf8')});
 const store=path.join(src,'共享/opening-draft-storage.js');if(fs.existsSync(store))await page.addScriptTag({content:fs.readFileSync(store,'utf8')});
 report.full=await page.evaluate(async()=>{
  const fill='x'.repeat(65536);let count=0;try{while(count<200)localStorage.setItem('foreign-'+count++,fill);}catch{}
  let remaining='y'.repeat(32768);while(remaining.length){try{localStorage.setItem('foreign-tail-'+remaining.length,remaining);}catch{}remaining=remaining.slice(0,Math.floor(remaining.length/2));}
  const before=Object.keys(localStorage).filter(k=>k.startsWith('foreign')).map(k=>[k,localStorage.getItem(k)]),storage=window.CxxOpeningDraftStorage?await CxxOpeningDraftStorage.open(window):localStorage;
  const scope={instanceId:'quota-repro',slot:1},key='draft:card.png:slot:1',options={key,scope,identity:{valid:()=>false},readIdentity:()=>null,readPreferences:()=>({}),readProfile:()=>({schema:1,name:'保留的姓名',appearance:'保留的外貌'}),storage,prepare:async()=>{},submit:async()=>{},verify:async()=>{}};
  const f=CxxOpeningFlow.create(options);let error;try{f.patch({custom:'保留的自定义背景'});f.next();await f.persisted?.();await storage.flush?.();}catch(e){error={message:e.message,code:e.code};}
  const state=f.state();f.destroy();const fresh=window.CxxOpeningDraftStorage?await CxxOpeningDraftStorage.open(window):localStorage;const reloaded=CxxOpeningFlow.create({...options,storage:fresh,creationId:state.draft.creationId});
  return {error,step:state.draft.step,reloaded:reloaded.state().draft,foreignPreserved:before.every(([k,v])=>localStorage.getItem(k)===v),localStorageCharacters:before.reduce((n,[k,v])=>n+k.length+v.length,0)};
 });
 report.deleted=await page.evaluate(()=>{const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};const f=CxxOpeningFlow.create({key:'delete',storage,identity:{valid:()=>false},readIdentity:()=>null,readPreferences:()=>({}),readProfile:()=>({schema:1,name:'头像测试',portrait:{schema:1,kind:'asset',id:'old'},portraitUpload:{src:'data:image/webp;base64,'+'A'.repeat(200000)},unknown:{keep:true}})});const mounted=CxxCreatorUI.mount({document,parent:document.body,profile:f.state().draft.profile,onChange:value=>f.patch(value)});const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='使用当前头像');button.click();const p=f.state().draft.profile;mounted.destroy();return {removed:!p.portrait&&!p.portraitUpload,serialized:JSON.stringify(p).length,unknown:p.unknown};});
 const migration=await browser.newPage();await migration.route('http://draft-migrate.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><body>Legacy draft migration</body></html>'}));await migration.goto('http://draft-migrate.test/');
 if(fs.existsSync(store))await migration.addScriptTag({content:fs.readFileSync(store,'utf8')});
 report.migrated=await migration.evaluate(async()=>{const values=[['cxx-opening-draft:old-card',JSON.stringify({schema:1,profile:{name:'旧草稿',portraitUpload:{src:'A'.repeat(200000)}},unknown:{keep:1}})],['cxx-story-creation:v2:["owner","instance"]',JSON.stringify({creationId:'original-creation',rows:[{chat_metadata:{untouched:true}}]})]];for(const [key,value]of values)localStorage.setItem(key,value);localStorage.setItem('foreign-setting','keep');const a=window.CxxOpeningDraftStorage?await CxxOpeningDraftStorage.open(window):localStorage;await a.flush?.();const exact=values.every(([key,value])=>a.getItem(key)===value),legacyRemoved=values.every(([key])=>localStorage.getItem(key)===null);await a.close?.();const fresh=window.CxxOpeningDraftStorage?await CxxOpeningDraftStorage.open(window):localStorage;return {exact,legacyRemoved,reloaded:values.every(([key,value])=>fresh.getItem(key)===value),foreign:localStorage.getItem('foreign-setting')};});
 await migration.close();
 if(fs.existsSync(store)){
  report.initializationFailure={};
  for(const stage of ['readonly','readwrite']){
   const failed=await browser.newPage();await failed.route('http://draft-failure-'+stage+'.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><body>Draft initialization failure</body></html>'}));await failed.goto('http://draft-failure-'+stage+'.test/');await failed.addScriptTag({content:fs.readFileSync(store,'utf8')});
   report.initializationFailure[stage]=await failed.evaluate(async stage=>{
    const key='cxx-opening-draft:retained',value=JSON.stringify({schema:1,custom:'保留迁移前的原输入'});localStorage.setItem(key,value);
    const transaction=IDBDatabase.prototype.transaction,close=IDBDatabase.prototype.close;let fail=true,closed=0,error;
    IDBDatabase.prototype.close=function(){closed++;return close.call(this);};
    IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(fail&&args[1]===stage){fail=false;queueMicrotask(()=>tx.abort());}return tx;};
    try{
     try{await CxxOpeningDraftStorage.open(window);}catch(cause){error={name:cause.name,code:cause.code,message:cause.message};}
     const afterFailure={closed,legacyPreserved:localStorage.getItem(key)===value,error};IDBDatabase.prototype.transaction=transaction;
     const recovered=await CxxOpeningDraftStorage.open(window),retryRestored=recovered.getItem(key)===value,retryRemovedLegacy=localStorage.getItem(key)===null;await recovered.close();
     return {...afterFailure,retryRestored,retryRemovedLegacy};
    }finally{IDBDatabase.prototype.transaction=transaction;IDBDatabase.prototype.close=close;}
   },stage);await failed.close();
  }
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({full:{...report.full,reloaded:{step:report.full.reloaded.step,custom:report.full.reloaded.custom}},deleted:report.deleted}));
 assert(!report.full.error,'full localStorage must not prevent a draft save: '+report.full.error?.message);assert.equal(report.full.step,'profile');assert.equal(report.full.reloaded.custom,'保留的自定义背景');assert(report.full.foreignPreserved);assert(report.deleted.removed);assert(report.deleted.serialized<300);assert.deepEqual(report.deleted.unknown,{keep:true});assert(report.migrated.exact);assert(report.migrated.legacyRemoved);assert(report.migrated.reloaded);assert.equal(report.migrated.foreign,'keep');
 for(const [stage,result]of Object.entries(report.initializationFailure||{})){assert(result.error,stage+' must exercise an actual failed transaction');assert.equal(result.closed,1,stage+' initialization failure closes its opened connection');assert(result.legacyPreserved);assert(result.retryRestored);assert(result.retryRemovedLegacy);}
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
