/**
 * 开场壳检查：LOADING 详情、加载锁滚动、主菜单公告与教程、无脚本错误。
 * 只加载 generated/opening-ui，不下载资源包，也不启动完整会话。
 * 运行：node 工程文件/网页独立版/tools/play-shell-check.mjs
 */
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname,join,normalize,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const HERE=dirname(fileURLToPath(import.meta.url));
const PROJECT=join(HERE,'..','..');
const UI=join(HERE,'..','generated','opening-ui');
const RECEIPT=join(PROJECT,'.cache','play-loading-20261027','checks','play-shell.json');
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>existsSync(p));
if(!EDGE){console.error('未找到系统 Edge，无法执行浏览器检查');process.exit(2);}
const T0=Date.now(),trace=(...args)=>console.log('['+((Date.now()-T0)/1000).toFixed(1)+'s]',...args);
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.mp4':'audio/mp4','.wav':'audio/wav'};
const server=createServer(async(request,response)=>{
  try{
    const pathname=new URL(request.url,'http://127.0.0.1').pathname;
    if(pathname==='/'||pathname==='/page.html'){
      response.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-store'});
      response.end('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><script type="module">import {mountWeb} from "./index.mjs";const opened=[];const page=await mountWeb({actions:{listStories:async()=>[],play:async()=>{},create:async()=>{},canCreate:()=>true,needsLogin:()=>false,openSettings:()=>{window.__openedSettings=(window.__openedSettings||0)+1;},leave:()=>{},login:()=>{},mountArchive:async()=>null,cancelCreation:()=>{}}});window.openingPage=page;window.__ready=true;</script></body></html>');
      return;
    }
    const relative=decodeURIComponent(pathname).replace(/^\/+/,'');
    const file=normalize(join(UI,relative));
    if(!file.startsWith(UI+sep)){response.writeHead(403);response.end('forbidden');return;}
    if(!existsSync(file)){response.writeHead(404);response.end('not found');return;}
    const ext=file.slice(file.lastIndexOf('.'));
    response.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':'no-store'});
    response.end(await readFile(file));
  }catch(error){response.writeHead(500);response.end(String(error?.message||error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const browser=await chromium.launch({executablePath:EDGE,headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',error=>errors.push('pageerror: '+error.message));
page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});
const checks=[];
const check=(name,ok,detail='')=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)console.error('FAIL',name,detail);};
try{
  await page.goto('http://127.0.0.1:'+port+'/page.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:20000});
  trace('mounted');
  await page.evaluate(()=>openingPage.progress({fraction:.42,text:'正在准备游戏资源',detail:'12 / 34 条规则'}));
  const boot=await page.evaluate(()=>({caption:document.querySelector('.cxx-boot-caption')?.textContent,detail:document.querySelector('.cxx-boot-detail')?.textContent,percent:document.querySelector('.cxx-boot-percent')?.textContent}));
  check('boot-detail',boot.caption==='正在准备游戏资源'&&boot.detail==='12 / 34 条规则'&&boot.percent==='42%',JSON.stringify(boot));
  const transition=page.evaluate(()=>openingPage.transition(async()=>{await new Promise(resolve=>setTimeout(resolve,450));}));
  await page.waitForTimeout(220);
  const loading=await page.evaluate(()=>({lock:document.querySelector('.cxx-game-menu')?.classList.contains('cxx-lock-scroll'),html:document.documentElement.classList.contains('cxx-loading-lock'),overflow:getComputedStyle(document.querySelector('.cxx-game-menu')).overflow,detail:document.querySelector('.fusion-load-detail')?.textContent,loads:document.querySelectorAll('.cxx-fusion-loading').length}));
  check('loading-lock',loading.lock&&loading.html&&loading.overflow==='hidden',JSON.stringify(loading));
  await page.evaluate(()=>openingPage.progress({fraction:.57,text:'正在下载资源包',detail:'640 / 1460 MB · 57%'}));
  await page.waitForTimeout(120);
  const detail=await page.evaluate(()=>document.querySelector('.fusion-load-detail')?.textContent||'');
  check('loading-detail',detail.includes('正在下载资源包')&&detail.includes('640 / 1460 MB')&&!detail.includes('57%'),detail);
  await transition;
  const unlocked=await page.evaluate(()=>({lock:document.querySelector('.cxx-game-menu')?.classList.contains('cxx-lock-scroll'),html:document.documentElement.classList.contains('cxx-loading-lock'),loading:!!document.querySelector('.cxx-fusion-loading')}));
  check('loading-unlock',!unlocked.lock&&!unlocked.html&&!unlocked.loading,JSON.stringify(unlocked));
  await page.evaluate(()=>openingPage.ready());
  await page.waitForTimeout(200);
  const notice=await page.evaluate(()=>({title:document.querySelector('.cxx-notice-title')?.textContent,hasStart:!!document.querySelector('.cxx-notice-actions .game-primary'),seen:localStorage.getItem('cxx2051:menu-notice:v1')}));
  check('notice',notice.title==='开始之前，先接上你的模型'&&notice.hasStart&&notice.seen===null,JSON.stringify(notice));
  await page.click('.cxx-notice-actions .game-primary');
  await page.waitForTimeout(80);
  const step2=await page.evaluate(()=>({title:document.querySelector('.cxx-notice-title')?.textContent,items:document.querySelectorAll('.cxx-notice-list li').length}));
  check('notice-tutorial',step2.title==='三步接上正文模型'&&step2.items===3,JSON.stringify(step2));
  await page.click('.cxx-notice-actions .game-primary');
  await page.waitForTimeout(120);
  const opened=await page.evaluate(()=>({opened:window.__openedSettings||0,notice:!!document.querySelector('.cxx-notice'),seen:localStorage.getItem('cxx2051:menu-notice:v1')}));
  check('notice-open-settings',opened.opened===1&&!opened.notice&&opened.seen==='1',JSON.stringify(opened));
  check('no-script-errors',errors.length===0,errors.join(' | '));
  await page.screenshot({path:join(PROJECT,'.cache','play-loading-20261027','checks','play-shell.png')});
  const failed=checks.filter(row=>!row.ok);
  await writeFile(RECEIPT,JSON.stringify({at:new Date().toISOString(),checks,failed:failed.length,errors},null,2)+'\n');
  console.log(JSON.stringify({checks:checks.length,failed:failed.length,receipt:RECEIPT}));
  if(failed.length)process.exitCode=1;
}catch(error){
  console.error('CHECK ERROR',error);
  await writeFile(RECEIPT,JSON.stringify({at:new Date().toISOString(),checks,failed:checks.filter(row=>!row.ok).length,errors,error:String(error?.stack||error)},null,2)+'\n');
  process.exitCode=1;
}finally{
  await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
