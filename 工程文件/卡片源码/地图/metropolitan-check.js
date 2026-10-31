(()=>{
 'use strict';
 const $=id=>document.getElementById(id),manifest=JSON.parse($('benchmark-manifest').textContent);
 const stage=$('benchmark-stage'),result=$('benchmark-result'),progress=$('benchmark-progress'),automatic=$('benchmark-auto');
 const buttons={start:$('benchmark-start'),next:$('benchmark-next'),stop:$('benchmark-stop'),interactions:$('benchmark-interactions')};
 const variants=manifest.variants,identities=new Map(),orders=[['baseline','central','western'],['western','baseline','central'],['central','western','baseline']];
 const makePlan=()=>[...variants.map(v=>({variant:v.id,round:0,warmup:true})),...orders.flatMap((order,i)=>order.map(variant=>({variant,round:i+1,warmup:false})))];
 const round=n=>Math.round(n*100)/100,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const summary=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return {n:v.length,p50:v.length?round(v[Math.ceil(v.length*.5)-1]):null,p95:v.length?round(v[Math.ceil(v.length*.95)-1]):null,max:v.length?round(v.at(-1)):null};};
 let plan=[],records=[],interactionRecords=[],frame=null,running=false,cancelled=false,backgrounded=false,cursor=0,startedAt=null;
 let phase='',runStart=0,deadline=0,ticker=0,networkAbort=null,autoTimer=0,jobKind=null;
 function guard(){if(cancelled)throw Error('用户停止当前项');if(backgrounded||document.hidden)throw Error('测试页曾转入后台，本项作废；请前台重跑');if(performance.now()>deadline)throw Error('单项达到55秒截止；已保留完成的检查');}
 async function until(predicate,label){phase=label;while(true){guard();if(predicate())return;await delay(16);}}
 async function twoFrames(child){for(let i=0;i<2;i++){let done=false;child.requestAnimationFrame(()=>{done=true;});await until(()=>done,phase);}}
 function dispose(){if(frame){frame.contentWindow?.TOKYO_ATLAS_BENCHMARK?.stop?.();frame.remove();frame=null;}}
 function stopAutomatic(){automatic.checked=false;clearTimeout(autoTimer);autoTimer=0;}
 function controls(){buttons.start.disabled=running;buttons.next.disabled=running||cursor>=plan.length;buttons.stop.disabled=!running;buttons.interactions.disabled=running;}
 function updateProgress(){progress.textContent=running?`${jobKind==='interactions'?'入口检查':`${cursor+1} / ${plan.length}`} · ${phase} · ${Math.floor((performance.now()-runStart)/1000)} 秒`:`${cursor} / ${plan.length} 个性能项完成；入口检查 ${interactionRecords.filter(r=>r.status==='passed').length} / 2 图通过。`;}
 function output(){
  const measured=records.filter(r=>!r.warmup&&r.status==='passed'),comparisons={};
  for(const v of variants){const runs=measured.filter(r=>r.variant===v.id);comparisons[v.id]={completedRuns:runs.length,pairedDrawMs:summary(runs.flatMap(r=>r.scenes.filter(s=>s.pairable).flatMap(s=>s.drawMs))),allSceneDrawMs:summary(runs.flatMap(r=>r.scenes.flatMap(s=>s.drawMs))),readyMs:summary(runs.map(r=>r.readyMs)),idleDrawDeltas:runs.map(r=>r.idle?.drawDelta??null),byScene:Object.fromEntries(v.scenes.map(s=>[s.id,summary(runs.flatMap(r=>r.scenes.filter(x=>x.id===s.id).flatMap(x=>x.drawMs)))]))};}
  const pairedRounds=orders.map((_,i)=>{const base=measured.find(r=>r.variant==='baseline'&&r.round===i+1),central=measured.find(r=>r.variant==='central'&&r.round===i+1);return {round:i+1,baselineP95:base?.pairedDrawMs.p95??null,centralP95:central?.pairedDrawMs.p95??null,deltaMs:base&&central?round(central.pairedDrawMs.p95-base.pairedDrawMs.p95):null};});
  result.textContent=JSON.stringify({schema:'tokyo-metropolitan-check-v1',status:running?'running':!plan.length?'not-started':cursor<plan.length?'partial':records.some(r=>r.status!=='passed')?'finished-with-failures':'complete',startedAt,viewport:{width:1280,height:720,scale:1,devicePixelRatio:window.devicePixelRatio||1},progress:{completed:cursor,total:plan.length},harness:manifest.harness,sourceIdentities:Object.fromEntries(identities),expectedSources:variants.map(({id,url,source})=>({id,url,...source})),plan,comparisons,pairedRounds,records,interactionRecords,
   definitions:{paired:'冻结 M7 与完整中心的前六个旧中心场景，同坐标、倍率和五个镜头；西部不作M7相对比较。',drawMs:'renderer记录的单次Canvas绘制与标签更新耗时；不是整帧FPS或INP。',readyMs:'iframe插入至文档complete、视图接口可用及首次Canvas绘制；不含fetch。',idle:'所有镜头稳定后观察至少一秒，drawDelta必须为0。',warmup:'各版本首轮只预热，后续三轮交错统计；不清浏览器或系统缓存。',interactions:'每图只跑一次目录按钮＋详情聚焦按钮；校验选中ID、详情标题、有限相机值和实际绘制。不代表鼠标命中、键盘可达性或手机版验收。',source:'加载HTML须匹配构建指纹，同一轮不可换源码。脚本SHA为构建时提取的内联源码。',failures:'失败、停止和后台项保留证据且不计入通过统计；source变化需重建检查页，再开始新测试。'},
   boundary:'独立浏览器检查页；不读写剧情或宿主设置，不证明真实SillyTavern、真手机性能或美术通过。'},null,2);
 }
 const probe=`<script>(()=>{const state=window.TOKYO_ATLAS_BENCHMARK={longTasks:[],errors:[],supported:false,stop:()=>{}};addEventListener('error',e=>state.errors.push({kind:'error',message:String(e.message||e.target?.src||'资源加载失败').slice(0,500),filename:e.filename||e.target?.src||null,lineno:e.lineno??null,colno:e.colno??null,stack:e.error?.stack?String(e.error.stack).slice(0,5000):null}),true);addEventListener('unhandledrejection',e=>state.errors.push({kind:'unhandledrejection',message:String(e.reason?.message||e.reason).slice(0,500),filename:e.reason?.fileName||null,lineno:e.reason?.lineNumber??null,colno:e.reason?.columnNumber??null,stack:e.reason?.stack?String(e.reason.stack).slice(0,5000):null}));if('PerformanceObserver' in window&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){try{const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())state.longTasks.push({startTime:e.startTime,duration:e.duration});});observer.observe({type:'longtask',buffered:true});state.supported=true;state.stop=()=>observer.disconnect();}catch{}}})();<\/script>`;
 async function digest(text){if(!crypto.subtle)throw Error('需要localhost或HTTPS的Web Crypto接口以核对源码SHA');const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
 async function load(variant,record){
  phase='读取 '+variant.label;const start=performance.now();networkAbort=new AbortController();const timeout=setTimeout(()=>networkAbort?.abort(),Math.max(1,deadline-start));let html;
  try{const response=await fetch(variant.url,{cache:'no-store',signal:networkAbort.signal});if(!response.ok)throw Error('无法读取 '+variant.url+'：HTTP '+response.status);html=await response.text();}finally{clearTimeout(timeout);networkAbort=null;}
  record.fetchMs=round(performance.now()-start);record.htmlSha256=await digest(html);guard();
  if(record.htmlSha256!==variant.source.htmlSha256)throw Error('预览已变化，请重跑 build-metropolitan-check.mjs 后刷新检查页');
  if(identities.has(variant.id)&&identities.get(variant.id)!==record.htmlSha256)throw Error('测试途中源码已变化，请重新开始');
  identities.set(variant.id,record.htmlSha256);dispose();frame=document.createElement('iframe');frame.title=variant.label+'浏览器检查';frame.width='1280';frame.height='720';
  const base=new URL(variant.url,location.href).href.replaceAll('&','&amp;').replaceAll('"','&quot;');
  frame.srcdoc=html.replace(/<head\b[^>]*>/i,match=>match+'<base href="'+base+'">'+probe);
  const mounted=performance.now();stage.append(frame);
  await until(()=>frame?.contentDocument?.readyState==='complete'&&frame.contentWindow.TOKYO_ATLAS_VIEW&&Number(frame.contentDocument.getElementById('map-canvas')?.dataset.drawCount)>0,'等待 '+variant.label+' 首次绘制');
  record.readyMs=round(performance.now()-mounted);const child=frame.contentWindow;child.document.documentElement.dataset.motion='off';await twoFrames(child);guard();
  if(child.innerWidth!==1280||child.innerHeight!==720)throw Error('iframe实际画幅不是1280×720');
  const data=child.TOKYO_ATLAS;record.mapId=data.mapId||'tokyo-central (legacy)';record.mapVersion=data.mapVersion??'M7 legacy';
  record.viewport={width:child.innerWidth,height:child.innerHeight,devicePixelRatio:child.devicePixelRatio};return child;
 }
 function collectProbe(record){const probe=frame?.contentWindow?.TOKYO_ATLAS_BENCHMARK;if(!probe)return;record.childErrors=probe.errors.slice();record.longTasks=probe.supported?{...summary(probe.longTasks.map(t=>t.duration)),totalMs:round(probe.longTasks.reduce((n,t)=>n+t.duration,0)),entries:probe.longTasks.slice()}:null;}
 const cleanState=base=>({...base,state:{...base.state,region:null,node:null,selection:null,type:'all',poi:true,tram:true,route:null},query:''});
 function finiteCamera(camera){return ['x','y','z'].every(k=>Number.isFinite(camera[k]))&&camera.z>0;}
 async function runScene(child,scene,record){
  const api=child.TOKYO_ATLAS_VIEW,canvas=child.document.getElementById('map-canvas'),base=cleanState(api.read());
  const offsets=[[0,0,1],[18,0,.97],[-18,8,1.03],[0,-14,1.01],[0,14,.99]];
  for(const [i,[dx,dy,dz]] of offsets.entries()){
   guard();phase=scene.name+' · 镜头 '+(i+1)+'/5';const before=Number(canvas.dataset.drawCount),camera={x:scene.at[0]+dx/scene.z,y:scene.at[1]+dy/scene.z,z:scene.z*dz,mode:scene.mode};
   api.restore({...base,camera,viewName:scene.name});await until(()=>Number(canvas.dataset.drawCount)>before,phase);await twoFrames(child);guard();
   const actual=api.read().camera,after=Number(canvas.dataset.drawCount),samples=JSON.parse(canvas.dataset.drawSamples||'[]'),delta=after-before;
   if(!finiteCamera(actual)||['x','y','z'].some(k=>Math.abs(actual[k]-camera[k])>.001)||actual.mode!==camera.mode)throw Error(scene.id+' 镜头未恢复到指定值');
   if(delta<1||delta>samples.length)throw Error(scene.id+' 绘制样本缺失或环形记录溢出');
   const values=samples.slice(-delta).map(s=>s.ms);if(!values.every(Number.isFinite))throw Error(scene.id+' 绘制耗时不是有效数值');
   record.drawMs.push(...values);record.steps.push({before,after,camera:actual,drawMs:values});
  }
  record.drawSummary=summary(record.drawMs);record.dom={nodes:child.document.querySelectorAll('*').length,labelButtons:child.document.querySelectorAll('#map-labels button').length,overviewBytes:canvas.dataset.overviewBytes===undefined?null:Number(canvas.dataset.overviewBytes)};
 }
 async function idleCheck(child,record){
  phase='静止一秒检查';await twoFrames(child);const canvas=child.document.getElementById('map-canvas'),start=performance.now(),before=Number(canvas.dataset.drawCount);
  while(performance.now()-start<1000){guard();await delay(25);}guard();record.idle={durationMs:round(performance.now()-start),before,after:Number(canvas.dataset.drawCount),drawDelta:Number(canvas.dataset.drawCount)-before};
  if(record.idle.drawDelta!==0)throw Error('静止一秒仍发生 '+record.idle.drawDelta+' 次绘制');
 }
 async function runInteractions(child,variant,record){
  const doc=child.document,api=child.TOKYO_ATLAS_VIEW,base=cleanState(api.read()),canvas=doc.getElementById('map-canvas');
  record.coverage=variant.interactionCoverage;
  for(const [i,target] of variant.targets.entries()){
   guard();phase=`${variant.label}入口 ${i+1}/${variant.targets.length} · ${target.name}`;
   const entry={...target,status:'running'};record.checks.push(entry);
   try{
    api.restore(base);const selector=`#${target.kind==='node'?'node-list':'region-list'} [data-${target.kind}="${CSS.escape(target.id)}"]`,button=doc.querySelector(selector);
    if(!button||button.disabled)throw Error('缺少可用目录按钮 '+target.id);
    const toggle=doc.getElementById('index-toggle');if(toggle?.getAttribute('aria-expanded')!=='true')toggle?.click();
    button.scrollIntoView({block:'nearest'});const before=Number(canvas.dataset.drawCount);button.click();
    await until(()=>Number(canvas.dataset.drawCount)>before,phase);await twoFrames(child);
    let selected=api.read().state.selection;const detail=doc.getElementById('detail'),focus=doc.getElementById('detail-focus');
    if(selected?.kind!==target.kind||selected.id!==target.id||detail.hidden||doc.querySelector('#detail-body h1')?.textContent!==target.name)throw Error('目录选择或详情标题不匹配');
    if(/\b(undefined|null)\b/.test(doc.getElementById('detail-kicker').textContent))throw Error('详情分类存在缺失值');
    if(!focus||focus.hidden||focus.disabled||!focus.getClientRects().length)throw Error('详情聚焦按钮不可用');
    const focusBefore=Number(canvas.dataset.drawCount);focus.click();await until(()=>Number(canvas.dataset.drawCount)>focusBefore,phase);await twoFrames(child);guard();
    const view=api.read();selected=view.state.selection;
    if(selected?.kind!==target.kind||selected.id!==target.id||!finiteCamera(view.camera))throw Error('详情聚焦未保留选中项或相机无效');
    entry.status='passed';entry.camera=view.camera;entry.drawDelta=Number(canvas.dataset.drawCount)-before;
   }catch(error){entry.status='failed';entry.error=String(error.message||error);throw error;}
  }
 }
 async function runItem(item,kind){
  running=true;cancelled=false;backgrounded=false;jobKind=kind;runStart=performance.now();deadline=runStart+55000;controls();ticker=setInterval(updateProgress,500);
  const variant=variants.find(v=>v.id===item.variant),record={...item,url:variant.url,status:'running',...(kind==='interactions'?{checks:[]}:{scenes:[]})};
  (kind==='interactions'?interactionRecords:records).push(record);output();
  try{
   guard();const child=await load(variant,record);
   if(kind==='interactions')await runInteractions(child,variant,record);
   else for(const scene of variant.scenes){const s={id:scene.id,name:scene.name,pairable:scene.pairable,drawMs:[],steps:[]};record.scenes.push(s);await runScene(child,scene,s);}
   await idleCheck(child,record);collectProbe(record);if(record.childErrors.length)throw Error('子地图报告运行错误，详见childErrors');
   if(kind!=='interactions'){record.pairedDrawMs=summary(record.scenes.filter(s=>s.pairable).flatMap(s=>s.drawMs));record.allSceneDrawMs=summary(record.scenes.flatMap(s=>s.drawMs));}
   record.status='passed';
  }catch(error){record.status=cancelled?'stopped':'failed';record.error=String(error.message||error);}
  finally{collectProbe(record);record.elapsedMs=round(performance.now()-runStart);clearInterval(ticker);dispose();running=false;if(kind!=='interactions')cursor++;if(record.status!=='passed'||document.hidden)stopAutomatic();controls();updateProgress();output();}
  return record;
 }
 async function runNext(){
  if(running||cursor>=plan.length)return;clearTimeout(autoTimer);autoTimer=0;const record=await runItem(plan[cursor],'performance');
  if(record.status==='passed'&&automatic.checked&&cursor<plan.length)autoTimer=setTimeout(()=>{autoTimer=0;if(document.hidden){stopAutomatic();return;}if(automatic.checked)runNext();},150);
 }
 buttons.start.addEventListener('click',()=>{if(running)return;clearTimeout(autoTimer);autoTimer=0;dispose();plan=makePlan();records=[];interactionRecords=[];identities.clear();cursor=0;startedAt=new Date().toISOString();runNext();});
 buttons.next.addEventListener('click',runNext);
 buttons.interactions.addEventListener('click',async()=>{if(running)return;stopAutomatic();interactionRecords=[];for(const variant of ['central','western']){const r=await runItem({variant},'interactions');if(r.status!=='passed')break;}});
 buttons.stop.addEventListener('click',()=>{cancelled=true;stopAutomatic();networkAbort?.abort();phase='停止中';updateProgress();});
 automatic.addEventListener('change',()=>{if(!automatic.checked){clearTimeout(autoTimer);autoTimer=0;}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(running)backgrounded=true;stopAutomatic();networkAbort?.abort();}});
 window.addEventListener('pagehide',()=>{cancelled=true;stopAutomatic();networkAbort?.abort();clearInterval(ticker);dispose();},{once:true});
 controls();output();
})();
