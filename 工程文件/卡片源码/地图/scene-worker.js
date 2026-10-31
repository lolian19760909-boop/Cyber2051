/* One worker per open map document. Data only: no story state or host APIs. */
(()=>{
 'use strict';
 const pools=new Map(),loading=new Map(),limit=32*1024*1024;let bytes=0,peak=0;
 async function inflate(data){const input=typeof data==='string'?Uint8Array.from(atob(data),c=>c.charCodeAt(0)):data;return new Response(new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();}
 async function pool(id,payload){
  if(pools.has(id)){const result=pools.get(id);pools.delete(id);pools.set(id,result);return result;}
  if(loading.has(id))return loading.get(id);if(!payload)return null;
  const promise=inflate(payload).then(packed=>{const source=new Uint8Array(packed),header=new DataView(packed),n=header.getUint32(0,true),paletteCount=header.getUint32(4,true);let at=8+paletteCount*4;const buffer=new ArrayBuffer(4+n*56),positions=new Int32Array(buffer,4,n*8),offsets=new Int16Array(buffer,4+n*32,n*8),colors=new Uint8Array(buffer,4+n*48,n*4),routes=new Int32Array(buffer,4+n*52,n);let x=0,y=0;
   const uint=()=>{let v=0,shift=0,b;do{b=source[at++];v|=(b&127)<<shift;shift+=7;}while(b&128);return v>>>0;},sint=()=>{const v=uint();return(v>>>1)^-(v&1);};
   for(let i=0;i<n;i++){const tag=source[at++],color=uint();routes[i]=uint()-1;x+=sint();y+=sint();positions[i]=x;positions[n+i]=y;const vertices=tag===2?2:tag===0?3:4;for(let j=1;j<vertices;j++){positions[j*2*n+i]=x+sint();positions[(j*2+1)*n+i]=y+sint();}if(tag===0){positions[6*n+i]=positions[4*n+i];positions[7*n+i]=positions[5*n+i];}else if(tag===2){positions[4*n+i]=positions[2*n+i];positions[5*n+i]=positions[3*n+i];positions[6*n+i]=x;positions[7*n+i]=y;const nx=sint(),ny=sint();for(let j=0;j<4;j++){offsets[j*2*n+i]=j<2?nx:-nx;offsets[(j*2+1)*n+i]=j<2?ny:-ny;}}else if(tag===3)for(let j=0;j<8;j++)offsets[j*n+i]=sint();for(let j=0;j<4;j++)colors[j*n+i]=source[8+color*4+j];}
   const data={buffer,n,positions,offsets,colors,routes,byteLength:buffer.byteLength};pools.set(id,data);bytes+=data.byteLength;peak=Math.max(peak,bytes);loading.delete(id);for(const [key,value]of pools){if(bytes<=limit)break;if(key===id)continue;pools.delete(key);bytes-=value.byteLength;}return data;}).catch(e=>{loading.delete(id);throw e;});loading.set(id,promise);return promise;
 }
 self.onmessage=async({data:{key,view,payload}})=>{
  try{const geometry=await pool(view.pool,payload);if(!geometry){postMessage({key,needPool:view.pool});return;}const packed=new Uint8Array(await inflate(view.data)),order=new Uint32Array(view.count);let at=0,previous=0;
   for(let i=0;i<order.length;i++){let v=0,shift=0,b;do{if(at>=packed.length||shift>28)throw Error('Invalid map order');b=packed[at++];v|=(b&127)<<shift;shift+=7;}while(b&128);previous+=(v>>>1)^-(v&1);if(previous<0||previous>=geometry.n)throw Error('Invalid map geometry index');order[i]=previous;}if(at!==packed.length)throw Error('Map order length mismatch');
   const data=new ArrayBuffer(order.length*76),numbers=new Float32Array(data),colors=new Uint8Array(data),{n,positions,offsets,routes}=geometry;
   for(let i=0;i<order.length;i++){const from=order[i],to=i*19;for(let j=0;j<8;j++)numbers[to+j]=positions[j*n+from]/100;for(let j=0;j<8;j++)numbers[to+8+j]=offsets[j*n+from]/1000;numbers[to+16]=(i+1)/(order.length+1);for(let j=0;j<4;j++)colors[i*76+68+j]=geometry.colors[j*n+from];numbers[to+18]=routes[from];}
   postMessage({key,data,workerBytes:bytes,workerPeakBytes:peak},[data]);
  }catch(e){postMessage({key,error:e.message});}
 };
})();
