/* Public, immutable atlas files. This store never contains chat or player data. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CxxAtlasResourcesFactory=factory();})(globalThis,function(){
 'use strict';
 const constants=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
 async function digest(buffer,subtle=globalThis.crypto?.subtle){
  if(subtle)return Array.from(new Uint8Array(await subtle.digest('SHA-256',buffer)),n=>n.toString(16).padStart(2,'0')).join('');
  // HTTP LAN hosts may lack SubtleCrypto. Bounded asynchronous SHA-256 avoids
  // either skipping integrity checks or blocking reading on a multi-MB buffer.
  const source=new Uint8Array(buffer),length=source.length,padded=new Uint8Array(Math.ceil((length+9)/64)*64),view=new DataView(padded.buffer),w=new Uint32Array(64),h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  padded.set(source);padded[length]=128;view.setUint32(padded.length-8,Math.floor(length/0x20000000));view.setUint32(padded.length-4,length*8);
  const rotate=(n,b)=>(n>>>b)|(n<<(32-b));
  for(let at=0;at<padded.length;at+=64){
   for(let i=0;i<16;i++)w[i]=view.getUint32(at+i*4);
   for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-16]+(rotate(b,17)^rotate(b,19)^(b>>>10))+w[i-7];}
   let [a,b,c,d,e,f,g,j]=h;
   for(let i=0;i<64;i++){const t1=(j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+constants[i]+w[i])>>>0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
   [a,b,c,d,e,f,g,j].forEach((v,i)=>{h[i]+=v;});
   if(at&&at%65536===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return Array.from(h,n=>n.toString(16).padStart(8,'0')).join('');
 }
 function create({window:win,baseURL,manifest,memoryBudget=12*1024*1024,diskBudget=64*1024*1024}){
  const memory=new Map(),sessions=new Set(),stats={downloads:0,downloadBytes:0,memoryHits:0,diskHits:0,evictions:0};let memoryBytes=0,dbPromise,db,dead=false;
  const abort=()=>new DOMException('地图载入已取消','AbortError');
  function validate(ref){if(!ref||!/^([a-f0-9]{64})\.(json|gz|bin)$/.test(ref.path||'')||ref.path.split('.')[0]!==ref.sha256||!Number.isSafeInteger(ref.bytes)||ref.bytes<1||ref.bytes>12*1024*1024)throw Error('地图资源清单无效');return ref;}
  function database(){
   if(dead)return Promise.resolve(null);if(dbPromise)return dbPromise;
   dbPromise=new Promise(resolve=>{let done=false;const finish=value=>{if(done){value?.close();return;}done=true;clearTimeout(timer);db=value;resolve(value);};const timer=setTimeout(()=>finish(null),1500);
    try{const request=win.indexedDB.open('cxx-atlas-resources-v1',1);request.onupgradeneeded=()=>{request.result.createObjectStore('files');request.result.createObjectStore('meta',{keyPath:'key'});};request.onsuccess=()=>{if(dead){request.result.close();finish(null);}else{request.result.onversionchange=()=>{request.result.close();db=null;dbPromise=undefined;};finish(request.result);}};request.onerror=request.onblocked=()=>finish(null);}catch{finish(null);}
   });return dbPromise;
  }
  async function diskGet(key){const store=await database();if(!store)return null;return new Promise(resolve=>{try{const tx=store.transaction('files'),req=tx.objectStore('files').get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);tx.onabort=()=>resolve(null);}catch{resolve(null);}});}
  async function diskPut(key,buffer){if(buffer.byteLength>diskBudget)return;const store=await database();if(!store||dead)return;await new Promise(resolve=>{try{const tx=store.transaction(['files','meta'],'readwrite'),files=tx.objectStore('files'),meta=tx.objectStore('meta');files.put(buffer,key);meta.put({key,bytes:buffer.byteLength,used:Date.now()});const req=meta.getAll();req.onsuccess=()=>{let total=req.result.reduce((n,r)=>n+r.bytes,0);for(const r of req.result.sort((a,b)=>a.used-b.used)){if(total<=diskBudget)break;if(r.key===key)continue;files.delete(r.key);meta.delete(r.key);total-=r.bytes;stats.evictions++;}};tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}catch{resolve();}});}
  function remember(key,buffer){if(memory.has(key)){memoryBytes-=memory.get(key).byteLength;memory.delete(key);}memory.set(key,buffer);memoryBytes+=buffer.byteLength;for(const [id,data]of memory){if(memoryBytes<=memoryBudget)break;memory.delete(id);memoryBytes-=data.byteLength;}}
  function open(onProgress=()=>{}){
   if(dead)throw abort();const controller=new AbortController(),pending=new Map();let closed=false;
   const check=()=>{if(closed||dead||controller.signal.aborted)throw abort();};
   async function fetchFile(ref){
    check();const request=new AbortController(),cancel=()=>request.abort();controller.signal.addEventListener('abort',cancel,{once:true});let timeout=false;const timer=setTimeout(()=>{timeout=true;request.abort();},45000);
    try{const response=await win.fetch(new URL(ref.path,baseURL),{mode:'cors',credentials:'omit',redirect:'error',signal:request.signal});if(!response.ok)throw Error('地图下载失败（HTTP '+response.status+'）');
     const data=new Uint8Array(ref.bytes);let at=0;const reader=response.body.getReader();
     try{while(true){check();const chunk=await reader.read();if(chunk.done)break;if(at+chunk.value.length>data.length)throw Error('地图资源大小不符');data.set(chunk.value,at);at+=chunk.value.length;onProgress({phase:'downloading',loaded:at,total:ref.bytes});}}catch(e){await reader.cancel().catch(()=>{});throw e;}
     if(at!==ref.bytes)throw Error('地图资源下载不完整');stats.downloads++;stats.downloadBytes+=at;return data.buffer;
    }catch(e){if(timeout)throw Error('地图下载超时，请重试');if(e.name==='TypeError')throw Error('暂时无法连接城市资源，请检查网络');throw e;}finally{clearTimeout(timer);controller.signal.removeEventListener('abort',cancel);}
   }
   function read(raw){
    let ref;try{check();ref=validate(raw);}catch(e){return Promise.reject(e);}const key=ref.sha256;
    if(pending.has(key))return pending.get(key);
    const promise=(async()=>{
     if(memory.has(key)){const data=memory.get(key);if(data.byteLength===ref.bytes){memory.delete(key);memory.set(key,data);stats.memoryHits++;return data;}}
     let buffer=await diskGet(key);check();if(buffer&&(buffer.byteLength!==ref.bytes||await digest(buffer,win.crypto?.subtle)!==key))buffer=null;
     if(buffer){stats.diskHits++;}else{buffer=await fetchFile(ref);check();if(await digest(buffer,win.crypto?.subtle)!==key)throw Error('地图资源校验失败，请重试');}
     check();remember(key,buffer);await diskPut(key,buffer);check();return buffer;
    })().catch(e=>{if(e.name!=='AbortError')e.atlasResource=true;throw e;}).finally(()=>pending.delete(key));pending.set(key,promise);return promise;
   }
   async function text(ref){const raw=await read(ref);check();const value=ref.path.endsWith('.gz')?await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(raw);check();if(value.length>16*1024*1024)throw Error('地图文档过大');return value;}
   async function document(id){const index=JSON.parse(await text(manifest));if(index.schema!==1||!index.documents?.[id])throw Error('此版本缺少地图资源');const record=index.documents[id];const [html,shared]=await Promise.all([text(record.page),text(index.shared)]);check();const marker='/*CXX_ATLAS_SHARED_RUNTIME*/';if(html.split(marker).length!==2)throw Error('地图资源版本不匹配');return html.replace(marker,()=>shared);}
   const session={read,document,abort(){if(closed)return;closed=true;controller.abort();pending.clear();sessions.delete(session);}};sessions.add(session);return session;
  }
  function destroy(){if(dead)return;dead=true;for(const session of sessions)session.abort();memory.clear();memoryBytes=0;db?.close();db=null;}
  return {open,destroy,read:()=>({...stats,memoryBytes,memoryBudget,diskBudget,sessions:sessions.size})};
 }
 return {create,digest};
});
