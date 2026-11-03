'use strict';
// Run separately from the Node suite: this regression needs two real browser realms.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source=fs.readFileSync(path.join(process.env.CXX_SAVE_SOURCE_ROOT||path.resolve(__dirname,'../../卡片源码'),'运行时/chat-save-guard.js'),'utf8');
const moduleSource=`export let isChatSaving=false;export let conditionalCalls=0,directCalls=0;let forbidden=false;
 export function hold(){isChatSaving=true;}export function release(){isChatSaving=false;}export function forbidConditional(){forbidden=true;}
 export function cancelDebouncedChatSave(){}
 export async function saveChat(){directCalls++;const c=parent===window?window.ctx:parent.ctx;await fetch('/api/chats/save',{method:'POST',body:JSON.stringify({avatar_url:'card.png',file_name:'story',chat:[{chat_metadata:c.chatMetadata},...c.chat]})});}
 export async function saveChatConditional(){conditionalCalls++;if(forbidden)throw Error('repair used conditional saver');if(isChatSaving)return;isChatSaving=true;try{await saveChat();}finally{isChatSaving=false;}}`;
let disk=[{chat_metadata:{integrity:'one'}},{mes:'old',swipes:['old','branch'],foreign:{keep:7}}],writes=0;
const html=`<script type="module">import * as native from '/script.js';window.native=native;window.ctx={chat:${JSON.stringify(disk.slice(1))},chatMetadata:{integrity:'one'},getCurrentChatId:()=> 'story',getRequestHeaders:()=>({'Content-Type':'application/json'}),saveChat:native.saveChatConditional};window.SillyTavern={getContext:()=>ctx};document.body.append(Object.assign(document.createElement('iframe'),{src:'/frame'}));</script>`;
const frame=`<script src="/guard.js"></script><script>window.service=CxxChatSaveGuard.acquire({win:parent,api:{getCurrentCharacterId:()=> 'card.png',SillyTavern:parent.SillyTavern}});service.guard.ready().then(()=>window.ready=true);</script>`;
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/script.js'||url.pathname==='/guard.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(url.pathname==='/script.js'?moduleSource:source);return;}
 if(url.pathname.startsWith('/api/')){let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);res.setHeader('Content-Type','application/json');if(url.pathname.endsWith('/export'))res.end(JSON.stringify({result:disk.map(JSON.stringify).join('\n')}));else if(url.pathname.endsWith('/save')){disk=body.chat;writes++;res.end('{"ok":true}');}else{res.statusCode=404;res.end('{}');}return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(url.pathname==='/frame'?frame:html);
 }catch(e){res.statusCode=500;res.end(e.message);}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.ready);
 await page.evaluate(()=>{native.hold();const f=document.querySelector('iframe').contentWindow;window.ran=false;window.job=f.service.run({characterKey:'card.png',chatId:'story'},async()=>{ran=true;ctx.chat[0].mes='card final';await ctx.saveChat();});});
 await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>ran),false,'card save must wait for the host module even when called from a card iframe');
 await page.evaluate(async()=>{native.release();await job;});assert.equal(disk[1].mes,'card final');assert.equal(writes,1);
 await page.evaluate(()=>{native.forbidConditional();ctx.chat[0].mes='latest';ctx.chat[0].swipes[1]='latest branch';});
 await page.waitForFunction(()=>native.directCalls>=2);await page.evaluate(()=>document.querySelector('iframe').contentWindow.service.whenIdle());
 assert.equal(disk[1].mes,'latest');assert.equal(disk[1].swipes[1],'latest branch');assert.deepEqual(disk[1].foreign,{keep:7});assert.equal(writes,2);
 const state=await page.evaluate(()=>{const f=document.querySelector('iframe').contentWindow,status=f.service.status();f.service.release();return {conditionalCalls:native.conditionalCalls,directCalls:native.directCalls,error:status.error,scriptCount:document.querySelectorAll('script[type="module"]').length};});
 assert.equal(state.conditionalCalls,1);assert.equal(state.error,null);assert.equal(state.scriptCount,1);assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,checks:['iframe save waits for host busy state','reconciliation uses host direct save','all branches and unknown fields retained','temporary host script removed'],writes,...state}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
