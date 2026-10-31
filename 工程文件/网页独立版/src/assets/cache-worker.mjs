/** Official media only. Stories, credentials and model requests never enter this cache.
 *  v3：分层资源（公共 / WebP 标准画质 / PNG 原画质）。每层独立 ZIP、独立完成标记和检查点；
 *  安装新画质时保留已完成的另一层，玩家可在设置里删除不再需要的标准档。
 *  资源包仍是全 stored 无 data descriptor 的 ZIP，因此每个本地头起点可由已读字节数精确恢复。 */
const CACHE='cxx2051-official-media-v1',root=new URL('./',self.location.href),configs=new Map(),flights=new Map(),RETRY_DELAYS=[1000,2500,5000,10000],MAX_ENTRY=64*1024*1024,INSTALL_SHARE=0.75;
const key=(kind,id)=>new URL('__cxx_media__/'+kind+'/'+id,root).href;
const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join('');
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{const done=()=>{signal?.removeEventListener('abort',cancel);resolve();},timer=setTimeout(done,ms),cancel=()=>{clearTimeout(timer);reject(signal.reason);};signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();});
const checkCancelled=signal=>{if(signal?.aborted)throw signal.reason;};
const incomplete=()=>mediaError('资源包下载不完整',{retryable:true});
function mediaError(message,{retryable=false}={}){const error=new Error(message);error.retryable=retryable;return error;}
function retryable(error){if(error?.name==='AbortError')return false;if(error?.retryable)return true;const message=String(error?.message||'');return error instanceof TypeError||/network|fetch|连接|断|aborted|incomplete/i.test(message);}
function layersOf(config){return Array.isArray(config.layers)&&config.layers.length?config.layers:[config];}
const layerName=layer=>({common:'公共资源',webp:'标准画质',png:'原画质'}[layer.key]||layer.key||'资源');
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
function register(config){const lookup=new Map();for(const entry of config.entries||layersOf(config).flatMap(layer=>layer.entries||[]))for(const alias of entry.aliases||[])if(!/^(?:https?:|data:|blob:|#)/.test(alias))lookup.set(new URL(alias,config.baseUrl).href,entry);const result={...config,lookup};configs.set(config.baseUrl,result);return result;}
async function configuration(baseUrl){if(configs.has(baseUrl))return configs.get(baseUrl);const saved=await(await caches.open(CACHE)).match(key('config',encodeURIComponent(baseUrl)));return saved?register(await saved.json()):null;}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),match=url.pathname.match(/^(.*\/releases\/[a-f0-9]{20}\/)(?:assets\/|assets-webp\/|opening-ui\/assets\/|site\/assets\/)/);
 if(event.request.method!=='GET'||url.origin!==root.origin||!match)return;
 event.respondWith((async()=>{
  const config=await configuration(url.origin+match[1]),entry=config?.lookup.get(url.origin+url.pathname);if(!entry)return fetch(event.request);
  const cache=await caches.open(CACHE),cached=await cache.match(key('blob',entry.id));if(cached)return cached;
  // Standard-quality PNG aliases must repair from the actual WebP resource.
  const alias=entry.aliases.find(value=>entry.mime==='image/webp'?value.startsWith('assets-webp/'):/^(?:assets|opening-ui\/assets|site\/assets)\//.test(value));
  const response=await fetch(alias?new URL(alias,config.baseUrl):event.request);if(!response.ok)return response;
  const bytes=await response.arrayBuffer();if(bytes.byteLength!==entry.bytes||await digest(bytes)!==entry.id)throw mediaError('资源内容校验失败，请重新下载该资源');
  const restored=new Response(bytes,{headers:{'content-type':entry.mime,'content-length':String(entry.bytes)}});try{await cache.put(key('blob',entry.id),restored.clone());}catch(error){console.warn('资源已显示，但本机缓存保存失败：'+error.message);}return restored;
 })());
});
async function readCheckpoint(cache,id){try{const saved=await cache.match(key('progress',id));return saved?await saved.json():null;}catch{return null;}}
async function writeCheckpoint(cache,id,value){await cache.put(key('progress',id),Response.json(value));}
async function clearCheckpoint(cache,id){try{await cache.delete(key('progress',id));}catch{}}
/** 已完成的层会把自身文件 id 写进完成标记；reclaim 先读这些标记，安装另一画质时不会误删它。 */
async function completedEntries(cache,pool){
 const keep=new Set(),marks=new Set();
 for(const request of await cache.keys()){
  const path=new URL(request.url).pathname,mark='__cxx_media__/',at=path.indexOf(mark);if(at<0)continue;
  const [kind,...rest]=path.slice(at+mark.length).split('/'),id=rest.join('/');if(kind!=='complete'||!id)continue;
  if(pool&&!pool.includes(id))continue;
  try{const data=await(await cache.match(request)).json();for(const entryId of data.entries||[])keep.add(entryId);marks.add(id);}catch{}
 }
 return{keep,marks};
}
/** 旧版单包（3.0.0）与分层包共用同一套 blob 键：文件 id 就是内容 SHA-256。
 *  安装分层时先逐条核对旧缓存，全部存在且校验通过才写完成标记，避免让老玩家重下 1.46 GiB。 */
async function hasBlobs(cache){
 for(const request of await cache.keys())if(new URL(request.url).pathname.includes('__cxx_media__/blob/'))return true;
 return false;
}
async function adoptLayer(cache,layer,progress,context,signal,verified=new Set()){
 const entries=layer.entries||[],total=entries.length;if(!total)return false;
 let first=null;for(const entry of entries){checkCancelled(signal);first=await cache.match(key('blob',entry.id));if(first)break;}
 if(!first)return false;
 let checked=0;
 const report=()=>progress({stage:'adopt',checked,loaded:checked,total,label:layerName(layer),layerKey:layer.key,layerLabel:layerName(layer),layerIndex:context.index+1,layerCount:context.count,layerFraction:total?checked/total:1,fraction:(context.base+(total?checked/total:1)*Number(layer.bytes||0))/context.total});
 for(const entry of entries){
  checkCancelled(signal);
  const cached=await cache.match(key('blob',entry.id));
  if(!cached)return false;
  const length=cached.headers.get('content-length'),bytes=await cached.arrayBuffer();
  if((length!==null&&Number(length)!==Number(entry.bytes))||bytes.byteLength!==Number(entry.bytes)||await digest(bytes)!==entry.id){await cache.delete(key('blob',entry.id));await clearCheckpoint(cache,layer.id);return false;}
  verified.add(entry.id);
  checked++;if(checked%32===0)report();
 }
 report();
 await cache.put(key('complete',layer.id),Response.json({version:layer.version,key:layer.key,at:new Date().toISOString(),entries:entries.map(entry=>entry.id),adopted:true}));
 return true;
}
async function reclaim(cache,config){
 const layers=layersOf(config),pool=Array.isArray(config.pool)?config.pool:[config.id],{keep,marks}=await completedEntries(cache,pool);
 for(const layer of layers){for(const entry of layer.entries||[])keep.add(entry.id);marks.add(layer.id);}
 marks.add(config.id);
 let removed=0;
 for(const request of await cache.keys()){
  const path=new URL(request.url).pathname,mark='__cxx_media__/',at=path.indexOf(mark);if(at<0)continue;
  const [kind,...rest]=path.slice(at+mark.length).split('/'),id=rest.join('/');
  if(!id||kind==='config')continue;
  if(kind==='blob'?keep.has(id):(kind==='progress'||kind==='complete')&&marks.has(id))continue;
  await cache.delete(request);removed++;
 }
 return removed;
}
async function* zipEntries(response,total,start,progress,cache,id,signal){
 const reader=response.body.getReader(),decoder=new TextDecoder();let chunk=null,cursor=0,consumed=start,streamed=start,reportedAt=-Infinity;
 const cancel=()=>{void reader.cancel(signal.reason).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 function report(force){const now=performance.now();if(!force&&now-reportedAt<100)return;reportedAt=now;progress({stage:'download',fraction:Math.min(INSTALL_SHARE,INSTALL_SHARE*streamed/total),loaded:streamed,total});}
 async function fill(){checkCancelled(signal);if(chunk&&cursor<chunk.length)return true;const value=await reader.read();checkCancelled(signal);if(value.done)return false;chunk=value.value;cursor=0;streamed+=chunk.length;if(streamed>total)throw mediaError('资源包长度超出清单');report(false);return true;}
 async function take(size){const bytes=new Uint8Array(size);let offset=0;while(offset<size){if(!await fill())throw incomplete();const count=Math.min(size-offset,chunk.length-cursor);bytes.set(chunk.subarray(cursor,cursor+count),offset);cursor+=count;consumed+=count;offset+=count;}return bytes;}
 let first=true;
 try{while(true){const magic=new DataView((await take(4)).buffer).getUint32(0,true),atFirst=first;first=false;
  if(magic===0x02014b50){
   // 中央目录：读到末尾即可收工。必须真正消费 chunk（fill 只在 chunk 读空时才继续读流），
   // 否则 fill 会一直返回 true，微任务死循环把页面事件循环一起卡死。
   while(await fill())cursor=chunk.length;
   if(streamed!==total)throw mediaError('资源包长度与清单不符');report(true);return;
  }
  if(magic!==0x04034b50){
   if(atFirst&&start>0){await clearCheckpoint(cache,id);throw mediaError('资源包续传位置不符',{retryable:true});}
   throw mediaError('资源包目录损坏');
  }
  const view=new DataView((await take(26)).buffer);if(view.getUint16(2,true)&9||view.getUint16(4,true)!==0)throw mediaError('资源包格式不符');
  const size=view.getUint32(14,true),raw=view.getUint32(18,true),names=view.getUint16(22,true),extra=view.getUint16(24,true);
  if(size!==raw||size>MAX_ENTRY)throw mediaError('资源文件大小不符');
  const name=decoder.decode(await take(names));await take(extra);const bytes=await take(size);
  yield{name,bytes,offset:consumed};}
 }finally{signal?.removeEventListener('abort',cancel);try{await reader.cancel();}catch{}try{reader.releaseLock();}catch{}}
}
async function openStream(config,offset,signal){
 const response=await fetch(config.download,{...(offset?{headers:{Range:'bytes='+offset+'-'}}:{}),cache:'no-store',signal});
 if(response.status===416)return{response,start:offset,empty:true};
 if(response.status!==206&&!response.ok)throw mediaError('资源包下载失败（'+response.status+'）',{retryable:response.status===429||response.status>=500});
 const resumed=response.status===206,start=resumed?offset:0;
 if(resumed){const range=/bytes\s+(\d+)-/i.exec(response.headers.get('content-range')||'');if(!range||Number(range[1])!==offset)throw mediaError('资源包续传位置不符',{retryable:true});}
 return{response,start};
}
/** 一次下载尝试。已经落盘的条目直接跳过，检查点之后的字节才重新请求。 */
async function streamOnce({cache,config,expected,checkpoint,progress,notify,controller,verified}){
 const signal=controller?.signal;
 const resume=checkpoint&&checkpoint.manifestId===config.id&&Number(checkpoint.offset)>0?Number(checkpoint.offset):0;
 const stream=await openStream(config,resume,signal),{response,start}=stream;
 if(stream.empty)return{manifestId:config.id,entries:expected.size};
 // 检查点记下断点前已保存的条目数，续传后的保存计数从这里接着数。
 const before=start>0?Math.min(expected.size,Number(checkpoint.saved)||0):0;
 const seen=new Set();let header=start>0&&checkpoint?.manifestId===config.id,stored=0,lastOffset=start,manifest=null;
 const pending=[];let pendingBytes=0,writeError=null,downloaded=start,committed=start;
 const fraction=()=>Math.min(0.99,(INSTALL_SHARE*downloaded+0.24*committed)/config.bytes);
 const flush=async()=>{await Promise.all(pending.splice(0));pendingBytes=0;if(writeError)throw writeError;};
 try{for await(const part of zipEntries(response,config.bytes,start,value=>{downloaded=value.loaded;progress({...value,fraction:fraction()});},cache,config.id,signal)){
  checkCancelled(signal);
  lastOffset=part.offset;
  if(!header){
   if(part.name!=='manifest.json'||part.bytes.length>4*1024*1024)throw mediaError('资源清单缺失');
   manifest=JSON.parse(new TextDecoder().decode(part.bytes));
   if(manifest.id!==config.id||await digest(new TextEncoder().encode(JSON.stringify(manifest.entries)))!==config.id)throw mediaError('资源清单与当前版本不符');
   header=true;await writeCheckpoint(cache,config.id,{manifestId:config.id,offset:lastOffset,saved:before,at:new Date().toISOString()});continue;
  }
  const entry=expected.get(part.name);if(!entry||seen.has(entry.id)||entry.bytes!==part.bytes.length)throw mediaError('资源文件与清单不符');
  seen.add(entry.id);
  let valid=verified?.has(entry.id);if(!valid){const cached=await cache.match(key('blob',entry.id));if(cached){const bytes=await cached.arrayBuffer();valid=bytes.byteLength===entry.bytes&&await digest(bytes)===entry.id;}}
  if(!valid){if(await digest(part.bytes)!==entry.id)throw mediaError('资源内容校验失败：'+part.name);pendingBytes+=part.bytes.length;pending.push(cache.put(key('blob',entry.id),new Response(part.bytes,{headers:{'content-type':entry.mime,'content-length':String(entry.bytes)}})).then(()=>{stored++;},error=>{writeError=error;controller?.abort(error);}));}
  if(seen.size%16===0||pendingBytes>=8*1024*1024){await flush();checkCancelled(signal);committed=lastOffset;await writeCheckpoint(cache,config.id,{manifestId:config.id,offset:lastOffset,saved:before+seen.size,at:new Date().toISOString()});notify({stage:'install',fraction:fraction(),loaded:before+seen.size,total:expected.size});}
 }
 await flush();
 if(!header&&start===0)throw mediaError('资源清单缺失');
 await writeCheckpoint(cache,config.id,{manifestId:config.id,offset:lastOffset,saved:before+seen.size,at:new Date().toISOString()});
 return{manifestId:config.id,entries:start?undefined:seen.size,stored};
 }finally{await flush();}
}
async function layerDone(cache,layer){return Boolean(await cache.match(key('complete',layer.id)));}
async function installLayer(layer,progress,context,controller,verified){
 const signal=controller?.signal;
 const cache=await caches.open(CACHE),expected=new Map((layer.entries||[]).map(row=>[row.file,row])),total=expected.size;
 const report=value=>{const local=Number(value.fraction);progress({...value,label:layerName(layer),layerKey:layer.key,layerLabel:layerName(layer),layerIndex:context.index+1,layerCount:context.count,layerFraction:local,fraction:(context.base+(Number.isFinite(local)?local:0)*layer.bytes)/context.total});};
 let checkpoint=await readCheckpoint(cache,layer.id),attempt=0,reported=0;
 for(;;){
  try{
   checkCancelled(signal);
   const result=await streamOnce({cache,config:layer,expected,checkpoint,progress:value=>{reported=value.loaded;report(value);},notify:report,controller,verified});
   if(result.entries!==undefined&&result.entries!==total)throw mediaError('资源包缺少文件');
   report({stage:'install',fraction:0.99,loaded:total,total});
   let missing=0;for(const entry of layer.entries)if(!await cache.match(key('blob',entry.id)))missing++;
   if(missing){await clearCheckpoint(cache,layer.id);throw mediaError('资源文件缺失 '+missing+' 项',{retryable:true});}
   checkCancelled(signal);await cache.put(key('complete',layer.id),Response.json({version:layer.version,key:layer.key,at:new Date().toISOString(),entries:layer.entries.map(entry=>entry.id)}));
   await clearCheckpoint(cache,layer.id);
   report({stage:'ready',fraction:1,loaded:total,total});
   return;
  }catch(error){
   checkCancelled(signal);
   const transient=retryable(error)&&attempt<RETRY_DELAYS.length&&!error?.final;
   if(!transient)throw error;
   const delay=RETRY_DELAYS[attempt++];
   report({stage:'retry',attempt,delay,fraction:Math.min(INSTALL_SHARE,INSTALL_SHARE*(reported||0)/Math.max(1,layer.bytes)),message:error.message});
   await sleep(delay,signal);
   checkpoint=await readCheckpoint(cache,layer.id);
  }
 }
}
async function install(config,progress,controller){
 const signal=controller?.signal,verified=new Set();let highWater=0;const emit=progress;progress=value=>{if(Number.isFinite(value.fraction)){const ceiling=value.stage==='ready'&&!value.layerKey?1:0.99;highWater=Math.max(highWater,Math.min(ceiling,value.fraction));value={...value,fraction:highWater};}emit(value);};
 const cache=await caches.open(CACHE),layers=layersOf(config);
 
 
 if((await Promise.all(layers.map(layer=>layerDone(cache,layer)))).every(Boolean)){
  checkCancelled(signal);
  if(!await cache.match(key('complete',config.id))){await cache.put(key('complete',config.id),Response.json({version:config.version,at:new Date().toISOString(),layers:layers.map(layer=>layer.key)}));try{await reclaim(cache,config);}catch{}}
  progress({stage:'ready',fraction:1,version:config.version,cached:true,layers:layers.map(layer=>layer.key)});return;
 }
 const total=layers.reduce((n,layer)=>n+Number(layer.bytes||0),0)||1,knownBlobs=await hasBlobs(cache),missing=[];let base=0;
 for(let index=0;index<layers.length;index++){
  const layer=layers[index];
  if(await layerDone(cache,layer)){base+=Number(layer.bytes||0);continue;}
  checkCancelled(signal);
  if(knownBlobs&&await adoptLayer(cache,layer,progress,{base,total,index,count:layers.length},signal,verified)){base+=Number(layer.bytes||0);continue;}
  missing.push(layer);
 }
 if(navigator.storage?.persist)void navigator.storage.persist().catch(()=>{});
 const wanted=missing.reduce((n,layer)=>n+(Number(layer.resourceBytes)||Number(layer.bytes)||0),0);
 try{const quota=await navigator.storage.estimate();if(quota.quota&&quota.quota-quota.usage<wanted*0.5)throw mediaError('本机浏览器空间不足，请至少腾出 '+(wanted/1073741824).toFixed(1)+' GB 后重试');}catch(error){if(error?.message?.includes('空间不足'))throw error;}
 let installBase=layers.filter(layer=>!missing.includes(layer)).reduce((sum,layer)=>sum+Number(layer.bytes||0),0);
 for(let index=0;index<layers.length;index++){
  const layer=layers[index];
  if(!missing.includes(layer))continue;
  progress({stage:'layer',layerKey:layer.key,layerLabel:layerName(layer),layerIndex:index+1,layerCount:layers.length,fraction:installBase/total});
  await installLayer(layer,progress,{base:installBase,total,index,count:layers.length},controller,verified);
  installBase+=Number(layer.bytes||0);
 }
 checkCancelled(signal);await cache.put(key('complete',config.id),Response.json({version:config.version,at:new Date().toISOString(),layers:layers.map(layer=>layer.key)}));
 // Keep the previous installation usable until every selected layer has finished.
 try{await reclaim(cache,config);}catch{}
 progress({stage:'ready',fraction:1,version:config.version,cached:false,adopted:missing.length===0,layers:layers.map(layer=>layer.key)});
}
async function removeLayer(message,port){
 const id=String(message.id||''),cache=await caches.open(CACHE);if(!/^[a-f0-9]{64}$/.test(id))throw Error('资源层无效');
 for(const entry of message.entries||[])await cache.delete(key('blob',entry.id));
 await cache.delete(key('complete',id));await cache.delete(key('progress',id));
 port?.postMessage({stage:'removed',id});
}
self.addEventListener('message',event=>{const type=event.data?.type,port=event.ports[0];
 if(type==='cancel-prepare'){const flight=flights.get(event.data.id);if(flight){flight.cancelVersion=(flight.cancelVersion||0)+1;flight.controller.abort(Object.assign(Error('资源下载已暂停'),{name:'AbortError'}));}return;}
 if(type==='remove-layer'){event.waitUntil(removeLayer(event.data,port).catch(error=>port?.postMessage({stage:'error',message:error.message})));return;}
 if(type!=='prepare')return;const config=event.data.config;
 event.waitUntil((async()=>{try{if(new URL(config.baseUrl).origin!==root.origin||!/^[a-f0-9]{64}$/.test(config.id))throw Error('资源版本无效');if(Array.isArray(config.layers)&&config.layers.some(layer=>!/^[a-f0-9]{64}$/.test(layer.id)))throw Error('资源层无效');const prior=configs.get(config.baseUrl),registration=prior?.id===config.id&&prior?.quality===config.quality?Promise.resolve():caches.open(CACHE).then(cache=>cache.put(key('config',encodeURIComponent(config.baseUrl)),Response.json(config))).then(()=>register(config));let flight=flights.get(config.id);
  // 暂停后旧任务仍在收尾（等待落盘、读缓存）；接到它上面会把“已暂停”交给新的请求。等它退出后另起一个。
  while(flight?.controller.signal.aborted){const waiting=flight,version=waiting.cancelVersion||0;await waiting.promise.catch(()=>{});if((waiting.cancelVersion||0)!==version)throw waiting.controller.signal.reason;flight=flights.get(config.id);}
  if(!flight){const created={listeners:new Set(),controller:new AbortController(),last:null};flights.set(config.id,created);created.promise=registration.then(()=>install(config,value=>{created.last=value;for(const fn of created.listeners)fn(value);},created.controller)).finally(()=>{if(flights.get(config.id)===created)flights.delete(config.id);});flight=created;}
  const notify=value=>port.postMessage(value);flight.listeners.add(notify);if(flight.last)notify(flight.last);try{await Promise.all([flight.promise,registration]);}finally{flight.listeners.delete(notify);}port.postMessage({stage:'done'});}catch(error){port.postMessage({stage:'error',message:error.message,name:error.name,retryable:retryable(error)});}})());
});
