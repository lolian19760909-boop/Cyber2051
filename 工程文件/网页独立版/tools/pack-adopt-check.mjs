/**
 * 旧版单包缓存 adoption 检查：3.0.0 的 blob 与分层 common/png 共用 id 时，应逐条核对后 0 网络接管。
 * 运行：node 工程文件/网页独立版/tools/pack-adopt-check.mjs
 */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const HERE=dirname(fileURLToPath(import.meta.url)),PROJECT=join(HERE,'..','..'),WORKER=join(HERE,'..','src','assets','cache-worker.mjs'),RECEIPT=join(PROJECT,'.cache','play-loading-20261027','checks','pack-adopt.json');
const require=createRequire(import.meta.url),{writePack}=require(join(PROJECT,'工具','lib','resource-pack.cjs'));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>existsSync(p));
if(!EDGE){console.error('未找到系统 Edge，无法执行浏览器检查');process.exit(2);}
const CACHE='cxx2051-official-media-v1',sha=data=>createHash('sha256').update(data).digest('hex'),T0=Date.now();
const trace=(...args)=>console.log('['+String(Date.now()-T0).padStart(6)+'ms]',...args);
const withTimeout=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Object.assign(new Error('超时 '+ms+'ms：'+label),{timeout:true})),ms))]);
const evaluate=(tab,fn,arg,label,ms=90000)=>withTimeout(tab.evaluate(fn,arg),ms,label);
const dir=await mkdtemp(join(tmpdir(),'cxx-pack-adopt-'));

async function makeLayer(key,count,size,mime,aliasPrefix=''){
 const fixtures=new Map(),rows=[];
 for(let i=0;i<count;i+=1){const data=randomBytes(size),id=sha(data),file=id+'.'+mime.split('/')[1];fixtures.set(id,{id,mime,bytes:data.length,data});rows.push({id,mime,bytes:data.length,file,aliases:aliasPrefix?['assets/'+key+'-'+i+'.png','assets-webp/'+key+'-'+i+'.webp']:[]});}
 rows.sort((a,b)=>a.id.localeCompare(b.id,'en'));const id=sha(Buffer.from(JSON.stringify(rows))),manifest={schema:1,version:'9.9.9',id,entries:rows},file=join(dir,key+'.zip'),receipt=await writePack(file,{manifest,files:fixtures}),zip=await readFile(file);
 return{key,fixtures,layer:{key,id,version:'9.9.9',bytes:receipt.bytes,sha256:sha(zip),resourceBytes:rows.reduce((n,e)=>n+e.bytes,0),download:'/resources/9.9.9/'+id+'/'+key+'.zip',name:key+'.zip',entries:rows},zip};
}
const common=await makeLayer('common',5,36*1024,'image/png'),webp=await makeLayer('webp',4,28*1024,'image/webp','webp'),png=await makeLayer('png',4,42*1024,'image/png','png');
const layers={common:common.layer,webp:webp.layer,png:png.layer},allEntries=[...new Map([...common.layer.entries,...webp.layer.entries,...png.layer.entries].map(e=>[e.id,e])).values()];
const pack=keys=>{const list=keys.map(k=>layers[k]);return{id:sha(Buffer.from(JSON.stringify(list.map(layer=>layer.id)))),layers:keys,bytes:list.reduce((n,l)=>n+l.bytes,0),resourceBytes:list.reduce((n,l)=>n+l.resourceBytes,0)};};
const catalog={schema:2,version:'9.9.9',layers,packs:{standard:pack(['common','webp']),original:pack(['common','png'])},entries:allEntries};
const config=quality=>{const packRow=catalog.packs[quality],active=packRow.layers.map(key=>layers[key]);return{schema:2,version:catalog.version,id:packRow.id,quality,layers:active,pool:Object.values(layers).map(layer=>layer.id),entries:[...new Map(active.flatMap(layer=>layer.entries).map(e=>[e.id,e])).values()],resourceBytes:packRow.resourceBytes,baseUrl:null};};
const workerSource=await readFile(WORKER,'utf8');
const pageScript=[
 'window.__report={events:[],error:null,done:false};window.__trace=[];',
 'const CACHE_NAME='+JSON.stringify(CACHE)+',LEGACY_ID="'+ 'a'.repeat(64) +'",mark=step=>window.__trace.push(step+"@"+Math.round(performance.now()));',
 'window.runPrepare=input=>new Promise(async resolve=>{window.__report={events:[],error:null,done:false};window.__trace=[];try{mark("register");const registration=await navigator.serviceWorker.register("/resource-worker.js",{scope:"/"});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller){mark("controller");await new Promise(r=>navigator.serviceWorker.addEventListener("controllerchange",r,{once:true}));}const config={...input,baseUrl:new URL("/",location.href).href};const channel=new MessageChannel();channel.port1.onmessage=({data})=>{mark("msg:"+data.stage);if(data.stage==="done"){window.__report.done=true;resolve(window.__report);}else if(data.stage==="error"){window.__report.error={message:data.message,retryable:Boolean(data.retryable)};resolve(window.__report);}else window.__report.events.push(data);};mark("postMessage");registration.active.postMessage({type:"prepare",config},[channel.port2]);}catch(error){mark("threw");window.__report.error={message:String((error&&error.message)||error),crash:true};resolve(window.__report);}});',
 'window.cacheState=async()=>{const cache=await caches.open(CACHE_NAME),out={blob:[],complete:[],progress:[],config:0};for(const request of await cache.keys()){const path=new URL(request.url).pathname,at=path.indexOf("__cxx_media__/");if(at<0)continue;const parts=path.slice(at+14).split("/"),kind=parts[0],id=decodeURIComponent(parts.slice(1).join("/"));if(kind==="blob")out.blob.push(id);else if(kind==="complete")out.complete.push(id);else if(kind==="progress")out.progress.push(id);else out.config+=1;}return out;};',
 'window.seed=async rows=>{const cache=await caches.open(CACHE_NAME);await cache.delete(new URL("__cxx_media__/complete/"+LEGACY_ID,location.origin+"/"));for(const row of rows){const bytes=Uint8Array.from(atob(row.data),c=>c.charCodeAt(0));await cache.put(new URL("__cxx_media__/blob/"+row.id,location.origin+"/"),new Response(bytes,{headers:{"content-type":row.mime,"content-length":String(row.bytes)}}));}await cache.put(new URL("__cxx_media__/complete/"+LEGACY_ID,location.origin+"/"),Response.json({version:"3.0.0",entries:rows.map(row=>row.id)}));};',
 'window.clearCache=()=>caches.delete(CACHE_NAME);'
].join('\n');
const pageHtml='<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>pack adopt</title><body><script>'+pageScript+'</scr'+'ipt>';
const state={requests:[],failLayer:null};
const send=(res,status,body,type)=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body);};
const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/page.html')return send(res,200,pageHtml,'text/html; charset=utf-8');if(url.pathname==='/resource-worker.js')return send(res,200,workerSource,'text/javascript; charset=utf-8');if(url.pathname==='/stats')return send(res,200,JSON.stringify(state.requests),'application/json');const active=Object.values(layers).find(layer=>layer.download===url.pathname);if(!active)return send(res,404,'missing','text/plain');const source=[common,webp,png].find(row=>row.layer.key===active.key).zip;state.requests.push({key:active.key,start:0});res.writeHead(200,{'content-type':'application/zip','content-length':String(source.length)});res.end(state.failLayer===active.key?source.subarray(0,65536):source);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,stats=async()=>(await fetch(base+'/stats')).json();
const results=[];const check=(name,ok,detail)=>{results.push({name,ok:Boolean(ok),detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' — '+detail:''));};
const seedRows=(rows)=>rows.map(entry=>{const fixture=[common,webp,png].flatMap(row=>[...row.fixtures.values()]).find(item=>item.id===entry.id);return{id:entry.id,mime:entry.mime,bytes:entry.bytes,data:fixture.data.toString('base64')};});
const browser=await chromium.launch({headless:true,executablePath:EDGE});let tab=null,errors=[];
try{
 const context=await browser.newContext();tab=await context.newPage();tab.on('console',message=>{if(message.type()==='error')errors.push(message.text());});tab.on('pageerror',error=>errors.push('pageerror: '+String(error&&error.message||error)));await tab.goto(base+'/page.html');trace('页面已载入');
 const legacyRows=seedRows([...common.layer.entries,...png.layer.entries]);
 await evaluate(tab,rows=>window.seed(rows),legacyRows,'seed legacy');
 const before=(await stats()).length,original=config('original'),first=await evaluate(tab,config=>window.runPrepare(config),original,'original adopt'),firstStats=(await stats()).slice(before),firstState=await evaluate(tab,()=>window.cacheState(),null,'adopt state');
 trace('接管结果',JSON.stringify({done:first.done,error:first.error,requests:firstStats,complete:firstState.complete,blob:firstState.blob.length}));
 check('A1 旧版 common+PNG 全部接管且 0 网络',first.done===true&&!first.error&&firstStats.length===0&&firstState.complete.includes(common.layer.id)&&firstState.complete.includes(png.layer.id)&&!firstState.complete.includes(webp.layer.id),JSON.stringify({requests:firstStats,complete:firstState.complete}));
 check('A2 接管进度与 1460 项同形',first.events.some(event=>event.stage==='adopt'&&event.layerKey==='common'&&event.total===common.layer.entries.length)&&first.events.some(event=>event.stage==='adopt'&&event.layerKey==='png'&&event.total===png.layer.entries.length),JSON.stringify(first.events.filter(event=>event.stage==='adopt')));
 check('A3 旧版完成标记被回收',!firstState.complete.includes('a'.repeat(64))&&firstState.blob.length===common.layer.entries.length+png.layer.entries.length,JSON.stringify({blob:firstState.blob.length,complete:firstState.complete}));
 const beforeStd=(await stats()).length,standard=config('standard'),second=await evaluate(tab,config=>window.runPrepare(config),standard,'standard after adopt'),secondStats=(await stats()).slice(beforeStd),secondState=await evaluate(tab,()=>window.cacheState(),null,'standard state');
 check('A4 接管原画后切标准只补 WebP 并保留 PNG',second.done===true&&!second.error&&secondStats.length===1&&secondStats[0].key==='webp'&&secondState.complete.includes(common.layer.id)&&secondState.complete.includes(webp.layer.id)&&secondState.complete.includes(png.layer.id),JSON.stringify(secondStats));
 await evaluate(tab,()=>window.clearCache(),null,'clear cache');
 const partialRows=seedRows([...common.layer.entries,...png.layer.entries.slice(0,3)]);
 await evaluate(tab,rows=>window.seed(rows),partialRows,'seed partial');
 const beforePartial=(await stats()).length,third=await evaluate(tab,config=>window.runPrepare(config),original,'partial original'),thirdStats=(await stats()).slice(beforePartial),thirdState=await evaluate(tab,()=>window.cacheState(),null,'partial state');
 check('A5 缺 1 个文件不接管，回退下载并补齐',third.done===true&&!third.error&&thirdStats.length===1&&thirdStats[0].key==='png'&&thirdState.complete.includes(common.layer.id)&&thirdState.complete.includes(png.layer.id)&&thirdState.blob.length===common.layer.entries.length+png.layer.entries.length,JSON.stringify({requests:thirdStats,blob:thirdState.blob.length}));
 await evaluate(tab,()=>window.clearCache(),null,'clear before failed upgrade');
 await evaluate(tab,rows=>window.seed(rows),legacyRows,'seed full legacy before standard upgrade');
 const oldProgress={manifestId:'b'.repeat(64),offset:4096,at:'2026-10-27T00:00:00.000Z'};
 await evaluate(tab,async progress=>{const cache=await caches.open('cxx2051-official-media-v1');await cache.put(new URL('__cxx_media__/complete/'+'a'.repeat(64),location.origin+'/'),Response.json({version:'3.0.0',at:'2026-10-27T00:00:00.000Z'}));await cache.put(new URL('__cxx_media__/progress/'+progress.manifestId,location.origin+'/'),Response.json(progress));},oldProgress,'seed v2 marker without entries and old checkpoint');
 state.failLayer='webp';
 const failed=await evaluate(tab,input=>window.runPrepare(input),standard,'interrupted standard upgrade');
 const failedState=await evaluate(tab,()=>window.cacheState(),null,'failed upgrade state');
 const preserved=await evaluate(tab,async({rows,progress})=>{const cache=await caches.open('cxx2051-official-media-v1'),saved=await cache.match(new URL('__cxx_media__/progress/'+progress.manifestId,location.origin+'/'));let same=0;for(const row of rows){const blob=await cache.match(new URL('__cxx_media__/blob/'+row.id,location.origin+'/'));if(!blob)continue;const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash===row.id)same++;}return{same,progress:saved?await saved.json():null};},{rows:legacyRows,progress:oldProgress},'verify retained legacy bytes');
 check('A6 新层断流失败保留旧完成标记、检查点和全部原资源',!!failed.error&&!failedState.complete.includes(webp.layer.id)&&failedState.complete.includes('a'.repeat(64))&&preserved.same===legacyRows.length&&JSON.stringify(preserved.progress)===JSON.stringify(oldProgress),JSON.stringify({error:failed.error,retained:preserved.same,expected:legacyRows.length,legacyComplete:failedState.complete.includes('a'.repeat(64)),checkpoint:preserved.progress}));
 await tab.reload();
 const beforeLegacy=(await stats()).length,legacy={id:'a'.repeat(64),version:'3.0.0',bytes:common.zip.length+png.zip.length,entries:[...common.layer.entries,...png.layer.entries],download:'/legacy.zip'};
 const legacyReady=await evaluate(tab,input=>window.runPrepare(input),legacy,'reload and prepare legacy resources');
 check('A7 刷新后旧资源配置仍免下载就绪',legacyReady.done&&!legacyReady.error&&(await stats()).length===beforeLegacy,JSON.stringify({done:legacyReady.done,error:legacyReady.error}));
 state.failLayer=null;
 const recovered=await evaluate(tab,input=>window.runPrepare(input),standard,'complete standard upgrade');
 const recoveredState=await evaluate(tab,()=>window.cacheState(),null,'completed upgrade state');
 check('A8 新层成功后再回收旧标记和旧检查点',recovered.done&&!recovered.error&&recoveredState.complete.includes(common.layer.id)&&recoveredState.complete.includes(webp.layer.id)&&!recoveredState.complete.includes('a'.repeat(64))&&!recoveredState.progress.includes(oldProgress.manifestId),JSON.stringify({complete:recoveredState.complete,progress:recoveredState.progress}));
 check('A9 页面无脚本错误',errors.length===0,errors.slice(0,2).join(' | ')||'none');
}catch(error){trace('检查中断：'+(error&&error.stack||error));results.push({name:'检查未能跑完',ok:false,detail:String(error&&error.message||error)});if(tab){try{const dump=await evaluate(tab,()=>({trace:window.__trace,report:window.__report}),null,'dump',10000);trace('页面轨迹：'+JSON.stringify(dump).slice(0,1200));}catch(inner){trace('页面轨迹不可读：'+String(inner&&inner.message||inner));}}}
finally{try{await withTimeout(browser.close(),20000,'browser.close');}catch{trace('关闭浏览器超时');}await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
await mkdir(dirname(RECEIPT),{recursive:true});await writeFile(RECEIPT,JSON.stringify({at:new Date().toISOString(),layers:{common:{id:common.layer.id,entries:common.layer.entries.length,bytes:common.zip.length},webp:{id:webp.layer.id,entries:webp.layer.entries.length,bytes:webp.zip.length},png:{id:png.layer.id,entries:png.layer.entries.length,bytes:png.zip.length}},results},null,2));
const failedCount=results.filter(row=>!row.ok).length;console.log('\n'+(results.length-failedCount)+'/'+results.length+' 通过（'+EDGE.split('/').pop()+'）');if(failedCount)process.exitCode=1;
