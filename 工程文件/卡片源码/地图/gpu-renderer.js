/* Retained, fixed-projection atlas renderer. All art is compiled from the maintained Canvas scene. */
(()=>{
 'use strict';
 const assets=window.CXX_ATLAS_GPU_ASSETS;if(!assets)return;
 const budget=64*1024*1024,cache=new Map(),pending=new Map(),sentPools=new Set();let worker,url,sequence=0,bytes=0,gpuBytes=0,workerBytes=0,peakBytes=0,owner=null,canvas,gl,program,vao,index,failed=false,epoch=0;
 const stats={backend:'webgl2',phase:'preparing',draws:0,drawCalls:0,instances:0,uploads:0,evictions:0,loadedAt:performance.timeOrigin+performance.now()};
 function phase(value,usable=false){if(stats.phase===value&&stats.usable===usable)return;stats.phase=value;stats.usable=usable;window.dispatchEvent(new CustomEvent('atlas-render-status',{detail:{phase:value,backend:stats.backend,usable,error:stats.error}}));}
 const vertex=`#version 300 es
 precision highp float;
 layout(location=0) in float corner;
 layout(location=1) in vec4 points01;
 layout(location=2) in vec4 points23;
 layout(location=3) in vec4 offsets01;
 layout(location=4) in vec4 offsets23;
 layout(location=5) in float layer;
 layout(location=6) in vec4 color;
 layout(location=7) in float route;
 uniform mat3 transform;
 uniform vec2 viewport;
 uniform vec2 layers;
 uniform vec2 transit;
 uniform float backgroundPass;
 uniform vec3 backgroundA;
 uniform vec3 backgroundB;
 out vec4 ink;
 void main(){
  if(backgroundPass>.5){vec2 uv=corner<.5?vec2(0.,0.):corner<1.5?vec2(1.,0.):corner<2.5?vec2(1.,1.):vec2(0.,1.);gl_Position=vec4(uv.x*2.-1.,1.-uv.y*2.,.999,1.);float t=dot(uv*viewport,viewport)/dot(viewport,viewport);ink=vec4(mix(backgroundA,backgroundB,t),1.);return;}
  vec2 p=corner<.5?points01.xy:corner<1.5?points01.zw:corner<2.5?points23.xy:points23.zw;
  vec2 o=corner<.5?offsets01.xy:corner<1.5?offsets01.zw:corner<2.5?offsets23.xy:offsets23.zw;
  vec2 screen=(transform*vec3(p,1.)).xy+o;
  gl_Position=vec4(screen.x/viewport.x*2.-1.,1.-screen.y/viewport.y*2.,1.-2.*(layers.x+layer*layers.y),1.);
  ink=color;if(route!=0.){if(transit.x<.5)ink.a=0.;else if(transit.y>0.&&route>0.&&abs(route-transit.y)>.5)ink.a*=.24;}
 }`;
 const fragment=`#version 300 es
 precision mediump float;in vec4 ink;out vec4 outputColor;
 void main(){if(ink.a<=0.)discard;outputColor=ink;}`;
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 function init(target){
  if(gl)return true;if(failed)return false;
  canvas=document.createElement('canvas');canvas.id='map-gpu-canvas';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';target.style.position='relative';target.style.zIndex='1';target.before(canvas);
  try{gl=canvas.getContext('webgl2',{alpha:false,antialias:true,depth:true,stencil:false,preserveDrawingBuffer:false,powerPreference:'default'});if(!gl)throw Error('WebGL2 unavailable');
   program=gl.createProgram();const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   gl.useProgram(program);vao=gl.createVertexArray();gl.bindVertexArray(vao);const corners=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,corners);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,1,2,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,1,gl.FLOAT,false,4,0);gl._atlasCorners=corners;
   index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),gl.STATIC_DRAW);
   gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(e.target!==canvas)return;failed=true;stats.backend='canvas2d-context-lost';canvas.hidden=true;phase('fallback');owner?.redraw();});
   canvas.addEventListener('webglcontextrestored',()=>{disposeGPU();failed=false;owner?.redraw();});
   return true;
  }catch(e){console.warn('[2051 atlas] Canvas compatibility renderer:',e.message);failed=true;stats.backend='canvas2d';phase('fallback');canvas?.remove();gl=null;return false;}
 }
 function cached(key){const entry=cache.get(key);if(entry){cache.delete(key);cache.set(key,entry);}return entry;}
 function decode(key){
  if(cache.has(key))return Promise.resolve(cached(key));
  if(pending.has(key))return pending.get(key).promise;
  if(!assets.views[key])return Promise.reject(Error('Missing map mesh '+key));
  if(!worker){const source=window.CXX_ATLAS_WORKER_SOURCE;
   url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);url=null;
   worker.onmessage=({data})=>{const task=pending.get(data.key);if(!task)return;if(data.needPool){sentPools.delete(data.needPool);post(data.key);return;}pending.delete(data.key);if(data.error){task.reject(Error(data.error));return;}const entry={data:data.data,buffer:null,count:data.data.byteLength/76,bytes:data.data.byteLength};cache.set(data.key,entry);bytes+=entry.bytes;workerBytes=data.workerBytes||0;peakBytes=Math.max(peakBytes,bytes+gpuBytes+workerBytes);task.resolve(entry);trim();};
   worker.onerror=e=>{for(const task of pending.values())task.reject(Error(e.message||'Map worker failed'));pending.clear();worker?.terminate();worker=null;sentPools.clear();workerBytes=0;};
  }
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});pending.set(key,{promise,resolve,reject});post(key);return promise;
 }
 async function post(key){
  const task=pending.get(key),generation=epoch,view=assets.views[key];if(!task)return;
  try{
   let payload,order=view;
   if(assets.bundles){const bundle=assets.bundles[view.pool],buffer=await window.CXX_ATLAS_RESOURCE_READ(bundle.file);if(generation!==epoch||pending.get(key)!==task||!worker)return;
    payload=sentPools.has(view.pool)?undefined:buffer.slice(0,bundle.poolBytes);order={...view,data:buffer.slice(view.offset,view.offset+view.bytes)};
   }else payload=sentPools.has(view.pool)?undefined:assets.pools[view.pool];
   sentPools.add(view.pool);const transfers=assets.bundles?[order.data,...payload?[payload]:[]]:[];worker.postMessage({key,view:order,payload},transfers);
  }catch(e){if(pending.get(key)===task){pending.delete(key);task.reject(e);}}
 }
 function trim(){for(const [key,item]of cache){if(bytes+gpuBytes<=budget)break;if(owner?.keys.includes(key)||owner?.displayedKeys.includes(key))continue;if(item.buffer){gl?.deleteBuffer(item.buffer);gpuBytes-=item.bytes;}bytes-=item.bytes;cache.delete(key);stats.evictions++;}}
 function upload(item){if(!item.buffer){item.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);gl.bufferData(gl.ARRAY_BUFFER,item.data,gl.STATIC_DRAW);gpuBytes+=item.bytes;stats.uploads++;peakBytes=Math.max(peakBytes,bytes+gpuBytes+workerBytes);}else gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);const stride=76;for(const [slot,size,offset]of [[1,4,0],[2,4,16],[3,4,32],[4,4,48],[5,1,64],[6,4,68],[7,1,72]]){gl.enableVertexAttribArray(slot);gl.vertexAttribPointer(slot,size,slot===6?gl.UNSIGNED_BYTE:gl.FLOAT,slot===6,stride,offset);gl.vertexAttribDivisor(slot,1);}}
 function matrix(camera,width,height,ground){const a=camera.mode==='depth'?.26:0,c=Math.cos(a),s=Math.sin(a),k=camera.mode==='depth'?.75:1,z=camera.z,e=width/2-(c*camera.x-s*camera.y)*z,f=height/2-(s*camera.x+c*camera.y)*k*z;return ground?[c*z,s*k*z,0,-s*z,c*k*z,0,e,f,1]:[z,0,0,0,z,0,e,f,1];}
 function mount({target,id,redraw}){
  const token=++sequence;owner={token,keys:[],displayedKeys:[],redraw};if(!init(target)){target.dataset.renderer=stats.backend;return {draw:()=>false,dispose(){if(owner?.token===token)owner=null;}};}target.before(canvas);canvas.hidden=false;
  let wanted='',ready=null,readyShape='',readySignature='',request=0,stopped=false,error='';
  function draw({camera,width,height,dpr,localRegion=-1,tram=true,route=0,background=['#080d11','#04080d']}){
   if(stopped||failed||owner?.token!==token)return false;
   if(!gl&&!init(target))return false;
   const lod=camera.z<=.95?.7:3,mode=camera.mode==='depth'?'depth':camera.mode==='auto'&&localRegion>=0?'auto':'flat',region=mode==='auto'?localRegion:-1;
   const keys=[`${id}-ground-flat--1-${lod}`,`${id}-scene-${mode}-${region}-${lod}`,...tram?[`${id}-transit-flat--1-${lod}`]:[]];
   if(keys.some(k=>!assets.views[k])){wanted='';ready=null;owner.keys=[];owner.displayedKeys=[];request++;target.dataset.renderer='canvas2d-uncompiled-view';canvas.hidden=true;phase('fallback');return false;}
   const signature=keys.join('|'),shape=[mode,region,tram].join('|');
   if(signature!==wanted){
    wanted=signature;owner.keys=keys;error='';stats.error='';stats.requestedView=signature;
    // A zoom change can keep drawing the previous LOD with the current camera.
    // Projection/region changes cannot reuse that scene. Pin both sets until swap.
    if(readyShape!==shape){ready=null;owner.displayedKeys=[];}
    const currentRequest=++request,requestEpoch=epoch;
    const accept=items=>{ready=items;readyShape=shape;readySignature=signature;owner.displayedKeys=keys;trim();};
    if(keys.every(key=>cache.has(key)))accept(keys.map(cached));
    else{
     phase(ready?'refining':'decoding',Boolean(ready));
     const current=()=>!stopped&&owner?.token===token&&request===currentRequest&&requestEpoch===epoch;
     Promise.all(keys.map(decode)).then(items=>{if(current()){const usable=Boolean(ready);accept(items);phase(usable?'refining':'uploading',usable);redraw();}}).catch(e=>{if(current()){ready=null;owner.displayedKeys=[];error=e.message;stats.error=error;target.dataset.renderer=e.atlasResource?'webgl2-resource-failed':'canvas2d-decode-failed';canvas.hidden=true;phase(e.atlasResource?'failed':'fallback');redraw();}});
    }
   }
   if(!ready){if(!error)target.dataset.renderer='webgl2-loading';return !error||stats.phase==='failed';}
   canvas.hidden=false;const w=Math.round(width*dpr),h=Math.round(height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(.016,.031,.05,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindVertexArray(vao);gl.uniform2f(gl.getUniformLocation(program,'viewport'),width,height);gl.uniform2f(gl.getUniformLocation(program,'transit'),tram?1:0,route);stats.drawCalls=0;stats.instances=0;
   upload(ready[0]);const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);gl.uniform3fv(gl.getUniformLocation(program,'backgroundA'),rgb(background[0]));gl.uniform3fv(gl.getUniformLocation(program,'backgroundB'),rgb(background[1]));gl.uniform1f(gl.getUniformLocation(program,'backgroundPass'),1);gl.drawElementsInstanced(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0,1);gl.uniform1f(gl.getUniformLocation(program,'backgroundPass'),0);stats.drawCalls++;
   // Preserve painter transparency within a layer; the fixed projection's baked order uses depth testing.
   for(const i of [0,2,1]){if(!ready[i])continue;upload(ready[i]);gl.uniformMatrix3fv(gl.getUniformLocation(program,'transform'),false,new Float32Array(matrix(camera,width,height,i!==1)));gl.uniform2f(gl.getUniformLocation(program,'layers'),i===0?.01:i===2?.32:.48,i===0?.3:i===2?.14:.51);gl.drawElementsInstanced(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0,ready[i].count);stats.drawCalls++;stats.instances+=ready[i].count;}
   if(!stats.draws)stats.firstReadyAt=performance.timeOrigin+performance.now();stats.draws++;stats.displayedView=readySignature;trim();target.dataset.renderer='webgl2';stats.backend='webgl2';phase(readySignature===wanted?'ready':'refining',true);return true;
  }
  return {draw,dispose(){stopped=true;if(owner?.token===token){owner=null;canvas.hidden=true;}trim();}};
 }
 function disposeGPU(){for(const item of cache.values()){gl?.deleteBuffer(item.buffer);item.buffer=null;}if(gl){gl.deleteBuffer(index);gl.deleteBuffer(gl._atlasCorners);gl.deleteVertexArray(vao);gl.deleteProgram(program);}gpuBytes=0;canvas?.remove();canvas=null;gl=null;}
 function destroy(){epoch++;owner=null;for(const p of pending.values())p.reject(Error('Map closed'));pending.clear();worker?.terminate();worker=null;sentPools.clear();workerBytes=0;if(url)URL.revokeObjectURL(url);url=null;const context=gl;disposeGPU();context?.getExtension('WEBGL_lose_context')?.loseContext();cache.clear();bytes=0;}
 window.CxxAtlasGPU={mount,destroy,read:()=>({...stats,bytes,gpuBytes,workerBytes,totalBytes:bytes+gpuBytes+workerBytes,peakBytes,budget:budget+32*1024*1024,cached:cache.size,pending:pending.size,workers:worker?1:0})};
 window.addEventListener('pagehide',destroy,{once:true});
})();
