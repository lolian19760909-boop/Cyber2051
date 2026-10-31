/**
 * 分层资源检查：标准档（公共+WebP）与 原画档（公共+PNG）能独立安装、复用、回收和删除。
 * 运行：node 工程文件/网页独立版/tools/pack-layer-check.mjs
 * 真实 Service Worker + Cache Storage 夹具；每步都有超时，避免再次出现静默卡死。
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

const HERE=dirname(fileURLToPath(import.meta.url)),PROJECT=join(HERE,'..','..'),WORKER=join(HERE,'..','src','assets','cache-worker.mjs'),RECEIPT=join(PROJECT,'.cache','play-loading-20261027','checks','pack-layer.json');
const require=createRequire(import.meta.url),{writePack}=require(join(PROJECT,'工具','lib','resource-pack.cjs'));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>existsSync(p));
if(!EDGE){console.error('未找到系统 Edge，无法执行浏览器检查');process.exit(2);}
const CACHE='cxx2051-official-media-v1',sha=data=>createHash('sha256').update(data).digest('hex'),T0=Date.now();
const trace=(...args)=>console.log('['+String(Date.now()-T0).padStart(6)+'ms]',...args);
const withTimeout=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Object.assign(new Error('超时 '+ms+'ms：'+label),{timeout:true})),ms))]);
const evaluate=(tab,fn,arg,label,ms=90000)=>withTimeout(tab.evaluate(fn,arg),ms,label);
const dir=await mkdtemp(join(tmpdir(),'cxx-pack-layer-'));

async function makeLayer(key,count,size,mime,aliasPrefix=''){
 const fixtures=new Map(),rows=[];
 for(let i=0;i<count;i+=1){const data=randomBytes(size),id=sha(data),file=id+'.'+mime.split('/')[1];fixtures.set(id,{id,mime,bytes:data.length,data});rows.push({id,mime,bytes:data.length,file,aliases:aliasPrefix?['assets/'+key+'-'+i+'.png','assets-webp/'+key+'-'+i+'.webp']:[]});}
 rows.sort((a,b)=>a.id.localeCompare(b.id,'en'));const id=sha(Buffer.from(JSON.stringify(rows))),manifest={schema:1,version:'9.9.9',id,entries:rows},file=join(dir,key+'.zip'),receipt=await writePack(file,{manifest,files:fixtures}),zip=await readFile(file);
 return{key,layer:{key,id,version:'9.9.9',bytes:receipt.bytes,sha256:sha(zip),resourceBytes:rows.reduce((n,e)=>n+e.bytes,0),download:'/resources/9.9.9/'+id+'/'+key+'.zip',name:key+'.zip',entries:rows},zip};
}
const common=await makeLayer('common',5,36*1024,'image/png'),webp=await makeLayer('webp',4,28*1024,'image/webp','webp'),png=await makeLayer('png',4,42*1024,'image/png','png');
const layers={common:common.layer,webp:webp.layer,png:png.layer},allEntries=[...new Map([...common.layer.entries,...webp.layer.entries,...png.layer.entries].map(e=>[e.id,e])).values()];
const pack=(keys)=>{const list=keys.map(k=>layers[k]);return{id:sha(Buffer.from(JSON.stringify(list.map(layer=>layer.id)))),layers:keys,bytes:list.reduce((n,l)=>n+l.bytes,0),resourceBytes:list.reduce((n,l)=>n+l.resourceBytes,0)};};
const catalog={schema:2,version:'9.9.9',layers,packs:{standard:pack(['common','webp']),original:pack(['common','png'])},entries:allEntries};
const config=(quality)=>{const packRow=catalog.packs[quality],active=packRow.layers.map(key=>layers[key]);return{schema:2,version:catalog.version,id:packRow.id,quality,layers:active,pool:Object.values(layers).map(layer=>layer.id),entries:[...new Map(active.flatMap(layer=>layer.entries).map(e=>[e.id,e])).values()],resourceBytes:packRow.resourceBytes,baseUrl:null};};
const workerSource=await readFile(WORKER,'utf8');
const pageScript=[
 'window.__report={events:[],error:null,done:false};window.__trace=[];',
 'const CACHE_NAME='+JSON.stringify(CACHE)+',mark=step=>window.__trace.push(step+"@"+Math.round(performance.now()));',
 'window.runPrepare=input=>new Promise(async resolve=>{window.__report={events:[],error:null,done:false};window.__trace=[];try{mark("register");const registration=await navigator.serviceWorker.register("/resource-worker.js",{scope:"/"});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller){mark("controller");await new Promise(r=>navigator.serviceWorker.addEventListener("controllerchange",r,{once:true}));}const config={...input,baseUrl:new URL("/",location.href).href};const channel=new MessageChannel();channel.port1.onmessage=({data})=>{mark("msg:"+data.stage);if(data.stage==="done"){window.__report.done=true;resolve(window.__report);}else if(data.stage==="error"){window.__report.error={message:data.message,retryable:Boolean(data.retryable)};resolve(window.__report);}else window.__report.events.push(data);};mark("postMessage");registration.active.postMessage({type:"prepare",config},[channel.port2]);}catch(error){mark("threw");window.__report.error={message:String((error&&error.message)||error),crash:true};resolve(window.__report);}});',
 'window.cacheState=async()=>{const cache=await caches.open(CACHE_NAME),out={blob:[],complete:[],progress:[],config:0};for(const request of await cache.keys()){const path=new URL(request.url).pathname,at=path.indexOf("__cxx_media__/");if(at<0)continue;const parts=path.slice(at+14).split("/"),kind=parts[0],id=decodeURIComponent(parts.slice(1).join("/"));if(kind==="blob")out.blob.push(id);else if(kind==="complete")out.complete.push(id);else if(kind==="progress")out.progress.push(id);else out.config+=1;}return out;};',
 'window.removeLayer=(id,entries)=>new Promise((resolve,reject)=>{const channel=new MessageChannel();channel.port1.onmessage=({data})=>{if(data.stage==="removed")resolve(data);else if(data.stage==="error")reject(Error(data.message));};navigator.serviceWorker.ready.then(registration=>registration.active.postMessage({type:"remove-layer",id,entries},[channel.port2]));});'
].join('\n');
const pageHtml='<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>pack layer</title><body><script>'+pageScript+'</scr'+'ipt>';
const state={requests:[]};
const send=(res,status,body,type)=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body);};
const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/page.html')return send(res,200,pageHtml,'text/html; charset=utf-8');if(url.pathname==='/resource-worker.js')return send(res,200,workerSource,'text/javascript; charset=utf-8');if(url.pathname==='/stats')return send(res,200,JSON.stringify(state.requests),'application/json');const active=Object.values(layers).find(layer=>layer.download===url.pathname);if(!active)return send(res,404,'missing','text/plain');const source=[common,webp,png].find(row=>row.layer.key===active.key).zip,range=/bytes=(\d+)-(\d*)/.exec(String(req.headers.range||'')),start=range?Number(range[1]):0,end=range&&range[2]?Number(range[2]):source.length-1,body=source.subarray(start,end+1);state.requests.push({key:active.key,start});res.writeHead(range?206:200,{'content-type':'application/zip','accept-ranges':'bytes','content-length':String(body.length),...(range?{'content-range':'bytes '+start+'-'+end+'/'+source.length}:{})});res.end(body);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,stats=async()=>(await fetch(base+'/stats')).json();
const results=[];const check=(name,ok,detail)=>{results.push({name,ok:Boolean(ok),detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' — '+detail:''));};
const browser=await chromium.launch({headless:true,executablePath:EDGE});let tab=null,errors=[];
try{
 const context=await browser.newContext();tab=await context.newPage();tab.on('console',message=>{if(message.type()==='error')errors.push(message.text());});tab.on('pageerror',error=>errors.push('pageerror: '+String(error&&error.message||error)));await tab.goto(base+'/page.html');trace('页面已载入');
 const standard=config('standard');
 const first=await evaluate(tab,config=>window.runPrepare(config),standard,'standard');const firstStats=await stats();trace('标准档结果',JSON.stringify({done:first.done,error:first.error,requests:firstStats}));
 check('L1 标准档完成且只下载公共+WebP',first.done===true&&!first.error&&firstStats.length>0&&firstStats.every(row=>row.key==='common'||row.key==='webp'),JSON.stringify(firstStats));
 const firstState=await evaluate(tab,()=>window.cacheState(),null,'standard state');
 check('L2 标准档完成标记与文件只含公共+WebP',firstState.complete.includes(common.layer.id)&&firstState.complete.includes(webp.layer.id)&&!firstState.complete.includes(png.layer.id)&&firstState.blob.length===common.layer.entries.length+webp.layer.entries.length,JSON.stringify({blob:firstState.blob.length,complete:firstState.complete.length}));
 const layerEvents=first.events.filter(event=>event.stage==='layer');
 check('L3 分层进度带层序号与名称',layerEvents.length===2&&layerEvents[0].layerIndex===1&&layerEvents[0].layerCount===2&&layerEvents[1].layerIndex===2&&layerEvents.some(event=>event.layerLabel==='标准画质'),JSON.stringify(layerEvents));
 const beforeOriginal=(await stats()).length;const original=config('original');const second=await evaluate(tab,config=>window.runPrepare(config),original,'original');const secondStats=(await stats()).slice(beforeOriginal);trace('原画档结果',JSON.stringify({done:second.done,error:second.error,requests:secondStats}));
 check('L4 切原画只补 PNG 层并保留 WebP 层',second.done===true&&!second.error&&secondStats.length===1&&secondStats[0].key==='png'&&secondStats[0].start===0,JSON.stringify(secondStats));
 const secondState=await evaluate(tab,()=>window.cacheState(),null,'original state');
 check('L5 原画安装后公共/PNG/WebP 均保留',secondState.complete.includes(common.layer.id)&&secondState.complete.includes(webp.layer.id)&&secondState.complete.includes(png.layer.id)&&secondState.blob.length===common.layer.entries.length+webp.layer.entries.length+png.layer.entries.length,JSON.stringify({blob:secondState.blob.length,complete:secondState.complete.length}));
 const removed=await evaluate(tab,([id,entries])=>window.removeLayer(id,entries),[webp.layer.id,webp.layer.entries],'remove webp');
 const removedState=await evaluate(tab,()=>window.cacheState(),null,'removed state');
 check('L6 删除标准档只删 WebP 层',removed.stage==='removed'&&!removedState.complete.includes(webp.layer.id)&&removedState.complete.includes(common.layer.id)&&removedState.complete.includes(png.layer.id)&&removedState.blob.length===common.layer.entries.length+png.layer.entries.length,JSON.stringify({blob:removedState.blob.length,complete:removedState.complete.length}));
 const beforeRestore=(await stats()).length;const restored=await evaluate(tab,config=>window.runPrepare(config),standard,'restore standard');const restoreStats=(await stats()).slice(beforeRestore),restoreState=await evaluate(tab,()=>window.cacheState(),null,'restore state');
 check('L7 删掉 WebP 后再切标准只补 WebP 层',restored.done===true&&!restored.error&&restoreStats.length===1&&restoreStats[0].key==='webp'&&restoreState.complete.includes(webp.layer.id)&&restoreState.blob.length===common.layer.entries.length+webp.layer.entries.length+png.layer.entries.length,JSON.stringify(restoreStats));
 check('L8 页面无脚本错误',errors.length===0,errors.slice(0,2).join(' | ')||'none');
}catch(error){trace('检查中断：'+(error&&error.stack||error));results.push({name:'检查未能跑完',ok:false,detail:String(error&&error.message||error)});if(tab){try{const dump=await evaluate(tab,()=>({trace:window.__trace,report:window.__report}),null,'dump',10000);trace('页面轨迹：'+JSON.stringify(dump).slice(0,1200));}catch(inner){trace('页面轨迹不可读：'+String(inner&&inner.message||inner));}}}
finally{try{await withTimeout(browser.close(),20000,'browser.close');}catch{trace('关闭浏览器超时');}await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
await mkdir(dirname(RECEIPT),{recursive:true});await writeFile(RECEIPT,JSON.stringify({at:new Date().toISOString(),layers:{common:{id:common.layer.id,entries:common.layer.entries.length,bytes:common.zip.length},webp:{id:webp.layer.id,entries:webp.layer.entries.length,bytes:webp.zip.length},png:{id:png.layer.id,entries:png.layer.entries.length,bytes:png.zip.length}},results},null,2));
const failedCount=results.filter(row=>!row.ok).length;console.log('\n'+(results.length-failedCount)+'/'+results.length+' 通过（'+EDGE.split('/').pop()+'）');if(failedCount)process.exitCode=1;
