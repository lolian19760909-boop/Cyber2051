const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../../..');
const file=process.argv[2]||require('../../工具/构建/当前/build.cjs').output;
const bytes=fs.readFileSync(file),card=JSON.parse(bytes),id=Date.now(),avatar='first-save-'+id+'.png';
const out=process.env.CXX_EVIDENCE||path.join(root,'工程文件/.cache/first-open-save');fs.mkdirSync(out,{recursive:true});
const report={hash:crypto.createHash('sha256').update(bytes).digest('hex'),avatar,errors:[],console:[],timeline:[],toasts:[],paid:0};
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)??'undefined').digest('hex').slice(0,16);
function diff(a,b,p='',out=[]){if(JSON.stringify(a)===JSON.stringify(b))return out;if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],p+'.'+k,out);}else out.push({path:p,aType:typeof a,bType:typeof b,aLength:JSON.stringify(a)?.length,bLength:JSON.stringify(b)?.length,aHash:hash(a),bHash:hash(b)});return out;}
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge',proxy:{server:'socks5://127.0.0.1:7897',bypass:'127.0.0.1,localhost'}}),context=await browser.newContext({viewport:{width:1280,height:900}}),p=await context.newPage();p.setDefaultTimeout(35000);
const started=Date.now();p.on('pageerror',e=>report.errors.push(e.stack));p.on('console',m=>{if(['error','warning'].includes(m.type()))report.console.push({t:Date.now()-started,type:m.type(),text:m.text().slice(0,1600)});});
p.on('requestfailed',r=>{if(r.url().includes('/api/chats/'))report.timeline.push({t:Date.now()-started,url:new URL(r.url()).pathname,failed:r.failure()});});
p.on('response',r=>{if(/\/api\/(chats\/(get|save|export)|characters\/import)/.test(r.url())||r.status()>=400)report.timeline.push({t:Date.now()-started,url:r.status()>=400?r.url():new URL(r.url()).pathname,status:r.status()});});
await p.route('**/api/backends/**',r=>{report.paid++;return r.abort();});
try{await p.goto('http://127.0.0.1:6948');await p.waitForFunction(()=>window.SillyTavern&&window.TavernHelper&&!document.querySelector('#preloader'));
await p.evaluate(()=>{window.__saveToasts=[];const error=toastr.error;toastr.error=function(...a){__saveToasts.push(a.slice(0,2));return error.apply(this,a);};});
const token=(await(await p.request.get('http://127.0.0.1:6948/csrf-token')).json()).token;
const imported=await p.request.post('http://127.0.0.1:6948/api/characters/import',{headers:{'X-CSRF-Token':token},multipart:{file_type:'json',preserved_name:avatar,avatar:{name:'first-save.json',mimeType:'application/json',buffer:bytes}}});assert(imported.ok());report.import=await imported.json();
void p.evaluate(async({avatar,book,name})=>{const c=SillyTavern.getContext(),w=await import('/scripts/world-info.js');await w.saveWorldInfo(name,w.convertCharacterBook(book),true);await c.getCharacters();await c.selectCharacterById(c.characters.findIndex(x=>x.avatar===avatar));},{avatar,book:card.data.character_book,name:card.data.extensions.world}).catch(e=>report.errors.push(e.stack));
const end=Date.now()+90000;let readyAt=0;while(Date.now()<end){await p.waitForTimeout(250);await p.evaluate(()=>{document.querySelector('.cxx-announcement button')?.click();for(const d of [...document.querySelectorAll('dialog[open],.popup')].reverse())if(/World\/Lorebook|[Ww]orld [Ii]nfo|世界书|already exists|内置正则|嵌入式脚本|bundled regex/.test(d.innerText))d.querySelector('.popup-button-ok')?.click();});if(await p.evaluate(a=>window.__cxx_chat_save_guard_v1?.status()?.scope?.characterKey===a&&!!window.__cxx_player__,avatar)){readyAt||=Date.now();if(Date.now()-readyAt>10000)break;}}
report.toasts=await p.evaluate(()=>__saveToasts);report.status=await p.evaluate(()=>window.__cxx_chat_save_guard_v1?.status());
const loaded=await p.evaluate(()=>{const c=SillyTavern.getContext();return {messages:c.chat,metadata:c.chatMetadata,chatId:c.getCurrentChatId(),note:c.extensionSettings.note};});
const response=await p.request.post('http://127.0.0.1:6948/api/chats/export',{headers:{'X-CSRF-Token':token},data:{avatar_url:avatar,is_group:false,file:loaded.chatId+'.jsonl',format:'jsonl',exportfilename:'check.jsonl'}});const data=await response.json();
if(data.result){const rows=data.result.split(/\r?\n/).filter(Boolean).map(JSON.parse);report.diff=diff({messages:rows.slice(1),metadata:rows[0].chat_metadata},{messages:loaded.messages,metadata:loaded.metadata});report.diskMessages=rows.length-1;report.liveMessages=loaded.messages.length;report.note=loaded.note;}
{
 assert(report.status,'Save guard did not start');assert.equal(report.status.error,null);assert.equal(report.toasts.length,0);assert.deepEqual(report.diff,[]);report.checks=['fresh import and first selection without save errors'];
 assert(loaded.messages.some(m=>m.is_ejs_processed?.some(Boolean)),'Prompt Template must render the imported card in this test');report.templateRendered=true;
 await p.evaluate(async()=>{await __cxx_launcher__.open('home');});await p.locator('.cxx-game-menu').waitFor();await p.waitForFunction(()=>!document.querySelector('.cxx-game-menu .cxx-boot')||!!document.querySelector('.cxx-game-menu .cxx-boot button'));
 const skip=p.getByRole('button',{name:'先进入菜单',exact:true});if(await skip.isVisible())await skip.click();
 await p.evaluate(()=>__cxx_launcher__.open('slots'));await p.getByRole('button',{name:/^档位 \d+ · 空$/}).first().click();await p.getByRole('button',{name:/^在档位 \d+ 创建人物$/}).click();
 const opening=p.locator('.cxx-opening-flow:visible');await opening.waitFor();for(let i=0;i<3;i++)await opening.locator('.opening-next').click();await opening.locator('.loadout-tile').first().click();await opening.locator('.opening-next').click();await opening.getByRole('button',{name:'街头小子 · 临时缺一人',exact:false}).click();await opening.locator('.opening-next').click();await opening.locator('.opening-next').click();
 await p.waitForFunction(()=>!__cxx_launcher__.active()||Cxx236OpeningHost.state()?.status==='error');assert.equal(await p.evaluate(()=>Cxx236OpeningHost.state()?.error||''),'');await p.waitForFunction(()=>!__cxx_launcher__.active());report.checks.push('six-step story creation completed on the first submit');
 report.creationToasts=await p.evaluate(()=>__saveToasts);assert.equal(report.creationToasts.length,0);
 async function saveMarker(page,value){return page.evaluate(async value=>{const c=SillyTavern.getContext(),g=__cxx_chat_save_guard_v1;c.chatMetadata.save_guard_acceptance=value;await g.run(g.status().scope,()=>c.saveChat());return {chat:c.getCurrentChatId(),state:g.status()};},value);}
 const saved=await saveMarker(p,'first');report.story=saved.chat;
 async function diskMarker(){const r=await p.request.post('http://127.0.0.1:6948/api/chats/export',{headers:{'X-CSRF-Token':token},data:{avatar_url:avatar,is_group:false,file:saved.chat+'.jsonl',format:'jsonl',exportfilename:'check.jsonl'}});return JSON.parse((await r.json()).result.split('\n')[0]).chat_metadata.save_guard_acceptance;}
 assert.equal(await diskMarker(),'first');assert.equal(await diskMarker(),'first');report.checks.push('save read back twice');
 async function select(page){await page.goto('http://127.0.0.1:6948');await page.waitForFunction(()=>window.SillyTavern&&window.TavernHelper&&!document.querySelector('#preloader'));await page.evaluate(async avatar=>{const c=SillyTavern.getContext();await c.getCharacters();await c.selectCharacterById(c.characters.findIndex(x=>x.avatar===avatar));},avatar);await page.waitForFunction(()=>!!window.__cxx_chat_save_guard_v1&&!!window.__cxx_player__);await page.evaluate(()=>__cxx_chat_save_guard_v1.guard.ready());}
 await select(p);assert.equal(await p.evaluate(()=>SillyTavern.getContext().chatMetadata.save_guard_acceptance),'first');await saveMarker(p,'reopened');assert.equal(await diskMarker(),'reopened');report.checks.push('browser reload retains the story and supports another save');
 const b=await p.context().newPage();await b.route('**/api/backends/**',r=>r.abort());await select(b);
 await saveMarker(p,'newer-window');const stale=await saveMarker(b,'stale-window').then(()=>null,e=>e.message);assert.match(stale,/另一个窗口更新/);assert.equal(await diskMarker(),'newer-window');await b.close();report.checks.push('second stale tab rejected without replacing the latest saved story');
 report.pass=true;
}
await p.screenshot({path:path.join(out,'host.png')});
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync(path.join(out,'host.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}})().catch(e=>{console.error(e);process.exitCode=1;});
