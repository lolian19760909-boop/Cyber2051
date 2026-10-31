(()=>{
 'use strict';
 const $=id=>document.getElementById(id),stage=$('benchmark-stage'),result=$('benchmark-result'),progress=$('benchmark-progress'),automatic=$('benchmark-auto');
 const buttons={start:$('benchmark-start'),next:$('benchmark-next'),stop:$('benchmark-stop')};
 const variants=[{id:'baseline',label:'冻结 M7',url:'历史/M8-首批实施前-M7/preview.html'},{id:'candidate',label:'中心候选',url:'central-preview.html'},
  {id:'11000',label:'合成 11000',url:'验收截图/M8-capacity-11000.html'},{id:'15000',label:'合成 15000',url:'验收截图/M8-capacity-15000.html'}];
 const orders=[['baseline','candidate','11000','15000'],['candidate','baseline','15000','11000'],['baseline','candidate','11000','15000']];
 const identities=new Map();
 const makePlan=()=>[...variants.map(v=>({variant:v.id,round:0,warmup:true})),...orders.flatMap((order,i)=>order.map(variant=>({variant,round:i+1,warmup:false})))];
 let plan=[],records=[],frame=null,running=false,cancelled=false,startedAt=null,cursor=0,phase='',runStart=0,deadline=0,ticker=0,networkAbort=null,autoTimer=0;
 const round=n=>Math.round(n*100)/100,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const summary=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return {n:v.length,p50:v.length?round(v[Math.ceil(v.length*.5)-1]):null,p95:v.length?round(v[Math.ceil(v.length*.95)-1]):null,max:v.length?round(v.at(-1)):null};};
 function guard(){if(cancelled)throw new Error('用户停止当前项');if(document.hidden)throw new Error('测试页转入后台，本项作废；请前台重跑');if(performance.now()>deadline)throw new Error('单项达到55秒截止；已保留完成的场景');}
 async function until(predicate,label){while(true){guard();if(predicate())return;await delay(16);phase=label;}}
 async function twoFrames(child){for(let i=0;i<2;i++){let done=false;child.requestAnimationFrame(()=>{done=true;});await until(()=>done,'等待绘制后的动画帧');}}
 function dispose(){if(frame){frame.contentWindow?.TOKYO_ATLAS_BENCHMARK?.stop?.();frame.remove();frame=null;}}
 function stopAutomatic(){automatic.checked=false;clearTimeout(autoTimer);autoTimer=0;}
 function updateProgress(){progress.textContent=running?`${cursor+1} / ${plan.length} · ${phase} · ${Math.floor((performance.now()-runStart)/1000)} 秒`:`${cursor} / ${plan.length} 项完成${cursor===plan.length&&plan.length?'，全部结束':'，可运行下一项'}`;}
 function output(){
  const measured=records.filter(r=>!r.warmup&&r.status==='passed'),comparisons={};
  for(const v of variants){const runs=measured.filter(r=>r.variant===v.id);comparisons[v.id]={completedRuns:runs.length,pairedDrawMs:summary(runs.flatMap(r=>r.scenes.filter(s=>s.pairable).flatMap(s=>s.drawMs))),allSceneDrawMs:summary(runs.flatMap(r=>r.scenes.flatMap(s=>s.drawMs))),readyMs:summary(runs.map(r=>r.readyMs)),idleDrawDeltas:runs.map(r=>r.idle?.drawDelta??null)};}
  const pairedRounds=orders.map((_,i)=>{const get=id=>measured.find(r=>r.variant===id&&r.round===i+1),base=get('baseline'),candidate=get('candidate');return {round:i+1,baselineP95:base?.pairedDrawMs.p95??null,candidateP95:candidate?.pairedDrawMs.p95??null,deltaMs:base&&candidate?round(candidate.pairedDrawMs.p95-base.pairedDrawMs.p95):null};});
  result.textContent=JSON.stringify({schema:'tokyo-atlas-capacity-v1',status:running?'running':cursor===plan.length&&plan.length?'complete':'ready',startedAt,viewport:{width:1280,height:720,scale:1},progress:{completed:cursor,total:plan.length},sourceIdentities:Object.fromEntries(identities),plan,comparisons,pairedRounds,records,
   definitions:{paired:'前六个旧中心同坐标场景；东/北样带仅作扩展诊断。',readyMs:'iframe插入至文档complete、公开视图接口可用且首个绘制计数出现；不含fetch。',drawMs:'renderer记录的单次Canvas+标签更新耗时，不是整帧FPS或交互INP。',overviewBytes:'renderer DOM测量；旧版没有该字段时为null，另给源码公式估算，不是总内存。',longTasks:'子页PerformanceObserver longtask事件；浏览器不支持则为null。',warmup:'每个版本第一次整轮预热排除；后续三轮计入，不清系统/浏览器缓存。',errors:'失败和提前停止保留记录，不混入通过统计。'},
   boundary:'浏览器容量实验；合成楼不进入地图内容。测试不证明真实酒馆、真手机性能或美术合理性。'},null,2);
 }
 function controls(){buttons.start.disabled=running;buttons.next.disabled=running||cursor>=plan.length;buttons.stop.disabled=!running;}
 const probe=`<script>(()=>{const state=window.TOKYO_ATLAS_BENCHMARK={longTasks:[],errors:[],supported:false,stop:()=>{}};addEventListener('error',e=>state.errors.push(String(e.message).slice(0,300)));addEventListener('unhandledrejection',e=>state.errors.push(String(e.reason).slice(0,300)));if('PerformanceObserver' in window&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){try{const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())state.longTasks.push({startTime:e.startTime,duration:e.duration});});observer.observe({type:'longtask',buffered:true});state.supported=true;state.stop=()=>observer.disconnect();}catch{}}})();<\/script>`;
 async function digest(text){if(!crypto.subtle)return null;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
 async function load(variant,record){
  phase='读取 '+variant.label;const start=performance.now();networkAbort=new AbortController();const timeout=setTimeout(()=>networkAbort?.abort(),Math.max(1,deadline-start));let html;
  try{const response=await fetch(variant.url,{cache:'no-store',signal:networkAbort.signal});if(!response.ok)throw new Error('无法读取 '+variant.url+'：HTTP '+response.status);html=await response.text();}
  finally{clearTimeout(timeout);networkAbort=null;}
  record.fetchMs=round(performance.now()-start);record.htmlSha256=await digest(html);guard();
  if(identities.has(variant.id)&&identities.get(variant.id)!==record.htmlSha256)throw new Error('同轮测试中源码已变化，请冻结预览后重新开始');
  identities.set(variant.id,record.htmlSha256);
  dispose();frame=document.createElement('iframe');frame.title=variant.label+'容量测试';frame.width='1280';frame.height='720';
  frame.srcdoc=html.replace('<head>','<head><base href="'+new URL(variant.url,location.href).href.replaceAll('&','&amp;').replaceAll('"','&quot;')+'">'+probe);
  const mounted=performance.now();stage.append(frame);
  await until(()=>frame?.contentDocument?.readyState==='complete'&&frame.contentWindow.TOKYO_ATLAS_VIEW&&Number(frame.contentDocument.getElementById('map-canvas')?.dataset.drawCount)>0,'等待地图首次绘制');
  record.readyMs=round(performance.now()-mounted);const child=frame.contentWindow;child.document.documentElement.dataset.motion='off';await twoFrames(child);
  const data=child.TOKYO_ATLAS;record.mapId=data.mapId||'tokyo-central (legacy)';record.mapVersion=data.mapVersion??'M7 legacy';record.synthetic=data.capacityFixture||null;
  if(record.synthetic&&identities.get('candidate')&&record.synthetic.sourceIdentity.previewSha256!==identities.get('candidate'))throw new Error('合成页来自旧中心预览，请重新运行 build-capacity-fixtures.mjs --write');
  return child;
 }
 function scenes(data){const harbor=data.portSites.find(s=>s.id==='west-terminal').at,under=data.regions.find(r=>r.id==='underpool').at;return [
  {id:'overview-flat',name:'旧中心平面总览',at:[1828,1424],z:.32,mode:'flat',pairable:true},
  {id:'company-depth',name:'公司广场立体',at:data.plaza,z:2.4,mode:'depth',pairable:true},
  {id:'harbor-depth',name:'湾西港立体',at:harbor,z:1.8,mode:'depth',pairable:true},
  {id:'underpool-depth',name:'暗池密集近景',at:under,z:2.2,mode:'depth',pairable:true},
  {id:'underpool-pan',name:'暗池平移缩放',at:[under[0]+90,under[1]+55],z:1.65,mode:'depth',pairable:true},
  {id:'overview-zoom',name:'旧中心概览缩放',at:[1828,1424],z:.67,mode:'auto',pairable:true},
  {id:'east-sample',name:'东样带诊断',at:[3540,1150],z:1.6,mode:'depth',pairable:false},
  {id:'north-sample',name:'北样带诊断',at:[1880,-115],z:1.6,mode:'depth',pairable:false}];}
 function domMetrics(child){
  const doc=child.document,canvas=doc.getElementById('map-canvas'),map=doc.getElementById('map').getBoundingClientRect(),labels=[...doc.querySelectorAll('#map-labels button')];
  const visible=labels.filter(el=>{if(el.hidden||!el.getClientRects().length)return false;const r=el.getBoundingClientRect();return r.right>map.left&&r.left<map.right&&r.bottom>map.top&&r.top<map.bottom;});
  const data=child.TOKYO_ATLAS,fixture=data.capacityFixture,range=fixture?.ranges;let visibleSynthetic=null;
  if(range&&child.TOKYO_ATLAS_DEBUG?.project){const b=[...data.buildings.slice(...range.buildings),...data.cityDetail.micro.slice(...range.micro).map(m=>m.b)];visibleSynthetic=b.reduce((n,b)=>{const p=child.TOKYO_ATLAS_DEBUG.project(b);return n+Number(p[0]>=0&&p[0]<=map.width&&p[1]>=0&&p[1]<=map.height);},0);}
  const scale=Math.min(.6,1450/Math.max(data.world.width,data.world.height));
  return {domNodes:doc.querySelectorAll('*').length,labelButtons:labels.length,visibleLabels:visible.length,visibleSyntheticCenters:visibleSynthetic,overviewBytes:canvas.dataset.overviewBytes===undefined?null:Number(canvas.dataset.overviewBytes),overviewEstimateBytes:Math.ceil(data.world.width*scale)*Math.ceil(data.world.height*scale)*4};
 }
 async function runScene(child,scene){
  const api=child.TOKYO_ATLAS_VIEW,canvas=child.document.getElementById('map-canvas'),base=api.read(),record={id:scene.id,name:scene.name,pairable:scene.pairable,drawMs:[],steps:[],childStart:child.performance.now()};
  for(let i=0;i<8;i++){
   guard();phase=scene.name+' · 镜头 '+(i+1)+'/8';
   const before=Number(canvas.dataset.drawCount),x=scene.at[0]+(i%4-1.5)*14/scene.z,y=scene.at[1]+(Math.floor(i/4)-.5)*18/scene.z,z=scene.z*(.94+i*.018);
   api.restore({...base,camera:{x,y,z,mode:scene.mode},state:{...base.state,region:null,node:null,selection:null,type:'all',poi:true,tram:true,route:null},query:'',viewName:scene.name});
   await until(()=>Number(canvas.dataset.drawCount)>before,'等待 '+scene.name+' 绘制');await twoFrames(child);
   const after=Number(canvas.dataset.drawCount),samples=JSON.parse(canvas.dataset.drawSamples||'[]'),delta=after-before,last=samples.slice(-Math.min(delta,samples.length)).map(s=>s.ms);
   record.drawMs.push(...last);record.steps.push({before,after,camera:api.read().camera,drawMs:last});
  }
  record.childEnd=child.performance.now();record.drawSummary=summary(record.drawMs);record.dom=domMetrics(child);return record;
 }
 async function runNext(){
  if(running||cursor>=plan.length)return;clearTimeout(autoTimer);autoTimer=0;running=true;cancelled=false;runStart=performance.now();deadline=runStart+55000;controls();ticker=setInterval(updateProgress,1000);
  const item=plan[cursor],variant=variants.find(v=>v.id===item.variant),record={...item,url:variant.url,status:'running',scenes:[]};records.push(record);output();
  try{
   const child=await load(variant,record);for(const scene of scenes(child.TOKYO_ATLAS))record.scenes.push(await runScene(child,scene));
   phase='静止一秒检查';const canvas=child.document.getElementById('map-canvas'),start=performance.now(),before=Number(canvas.dataset.drawCount);await delay(1000);guard();
   record.idle={durationMs:round(performance.now()-start),before,after:Number(canvas.dataset.drawCount),drawDelta:Number(canvas.dataset.drawCount)-before};
   const probe=child.TOKYO_ATLAS_BENCHMARK;record.longTasks=probe.supported?{...summary(probe.longTasks.map(t=>t.duration)),totalMs:round(probe.longTasks.reduce((n,t)=>n+t.duration,0)),entries:probe.longTasks}:null;
   record.childErrors=probe.errors.slice();if(record.childErrors.length)throw new Error('子地图报告运行错误，详见childErrors');
   record.pairedDrawMs=summary(record.scenes.filter(s=>s.pairable).flatMap(s=>s.drawMs));record.allSceneDrawMs=summary(record.scenes.flatMap(s=>s.drawMs));record.status='passed';
  }catch(error){record.status=cancelled?'stopped':'failed';record.error=String(error.message||error);}
  finally{
   record.elapsedMs=round(performance.now()-runStart);running=false;cursor++;clearInterval(ticker);dispose();
   if(record.status!=='passed'||document.hidden)stopAutomatic();controls();updateProgress();output();
   if(automatic.checked&&cursor<plan.length)autoTimer=setTimeout(()=>{autoTimer=0;if(document.hidden){stopAutomatic();return;}if(automatic.checked)runNext();},150);
  }
 }
 buttons.start.addEventListener('click',()=>{if(running)return;clearTimeout(autoTimer);autoTimer=0;dispose();plan=makePlan();records=[];identities.clear();cursor=0;startedAt=new Date().toISOString();runNext();});
 buttons.next.addEventListener('click',runNext);buttons.stop.addEventListener('click',()=>{cancelled=true;stopAutomatic();networkAbort?.abort();phase='停止中';updateProgress();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAutomatic();});
 window.addEventListener('pagehide',()=>{cancelled=true;stopAutomatic();networkAbort?.abort();clearInterval(ticker);dispose();},{once:true});
})();
