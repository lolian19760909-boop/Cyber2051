import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\\/g,'/').replace(/\/$/,'');
const web=root+'/工程文件/网页独立版';
const importFile=p=>import(pathToFileURL(p).href);
const workerPath=web+'/src/assets/cache-worker.mjs',workerSource=fs.readFileSync(workerPath,'utf8');
const callbacks=new Map(),cacheData=new Map(),networkRequests=[];
const swRoot='https://audit.invalid/play/';
const cache={async match(value){return cacheData.get(typeof value==='string'?value:value.url)?.clone();},async put(value,response){cacheData.set(typeof value==='string'?value:value.url,response.clone());},async delete(value){return cacheData.delete(typeof value==='string'?value:value.url);},async keys(){return [...cacheData.keys()].map(url=>({url}));}};
const workerSelf={location:{href:swRoot+'resource-worker.js'},addEventListener:(name,fn)=>callbacks.set(name,fn),skipWaiting(){},clients:{claim:async()=>{}}};
const context=vm.createContext({self:workerSelf,caches:{open:async()=>cache},crypto:webcrypto,URL,Request,Response,AbortController,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,console,navigator:{storage:{persist:async()=>true,estimate:async()=>({quota:100000,usage:0})}},fetch:async request=>{networkRequests.push(String(request?.url||request));return new Response('network');}});
vm.runInContext(workerSource,context,{filename:workerPath});
const bytes=new TextEncoder().encode('synthetic official media');
const entryId=createHash('sha256').update(bytes).digest('hex'),layerId='1'.repeat(64),packId='2'.repeat(64);
const entry={id:entryId,file:entryId+'.png',bytes:bytes.length,mime:'image/png',aliases:['assets/shared.png']};
await cache.put(swRoot+'__cxx_media__/blob/'+entryId,new Response(bytes,{headers:{'content-type':'image/png'}}));
await cache.put(swRoot+'__cxx_media__/complete/'+layerId,Response.json({entries:[entryId]}));
const baseA=swRoot+'releases/'+'a'.repeat(20)+'/',baseB=swRoot+'releases/'+'b'.repeat(20)+'/';
const config=baseUrl=>({schema:2,version:'3.1.0',id:packId,quality:'original',baseUrl,layers:[{key:'png',id:layerId,entries:[entry],bytes:bytes.length}],pool:[layerId]});
function prepare(base){let promise;const messages=[];callbacks.get('message')({data:{type:'prepare',config:config(base)},ports:[{postMessage:m=>messages.push(m)}],waitUntil:p=>promise=p});return {messages,done:promise};}
const a=prepare(baseA),b=prepare(baseB);await Promise.all([a.done,b.done]);
assert.equal(a.messages.at(-1).stage,'done');assert.equal(b.messages.at(-1).stage,'done');
async function media(base){let response;callbacks.get('fetch')({request:new Request(base+'assets/shared.png'),respondWith:p=>response=p});return await (await response).text();}
const readA=await media(baseA),readB=await media(baseB);
assert.equal(readA,'synthetic official media');assert.equal(readB,'synthetic official media');assert.equal(networkRequests.length,0);assert.equal([...cacheData.keys()].filter(x=>x.includes('/config/')).length,2);
const workerResult={source:workerPath,sourceSha:createHash('sha256').update(workerSource).digest('hex'),prepareA:a.messages,prepareB:b.messages,configCacheKeys:[...cacheData.keys()].filter(x=>x.includes('/config/')),readA,readB,networkRequests,expectedNetworkRequests:0,scope:'Exact maintained worker in Node vm; synthetic Cache API/events; not browser ServiceWorker lifecycle evidence'};

vm.runInContext('configs.clear()',context);assert.equal(await media(baseA),'synthetic official media');assert.equal(await media(baseB),'synthetic official media');
const c=prepare(baseB);await c.done;assert.equal(c.messages.at(-1).stage,'done');assert.equal(await media(baseB),'synthetic official media');assert.equal(networkRequests.length,0);console.log(JSON.stringify({passed:3,total:3,scope:'Exact Worker in VM synthetic CacheAPI, cross-release parallel + later reuse; not browser lifecycle'}));
