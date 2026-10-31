(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxUnifiedUpdate=value;})(globalThis,function(){
 'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v)),fail=(code,message)=>{throw Object.assign(Error(message),{code});};
 const versionAtLeast=(Core,value,minimum)=>{if(!minimum)return true;try{return Core.compareVersions(String(value||'0.0.0').split('+')[0],minimum)>=0;}catch{return false;}};
 function flatten(nodes){return (nodes||[]).flatMap(n=>[n,...(n.type==='folder'?flatten(n.scripts):[])]);}
 async function inventory({Core,before,after,version,currentVersion,plugins=[]}){
  const rows=[];
  for(const [kind,a,b,key,label]of [['worldbook',before.worldbook?.entries,after.worldbook?.entries,'uid','世界书'],['regex',before.regex?.scripts,after.regex?.scripts,'id','正则'],['script',flatten(before.scripts?.trees),flatten(after.scripts?.trees),'id','脚本／文件夹']]){
   const old=new Map((a||[]).map(v=>[String(v[key]),v])),next=new Map((b||[]).map(v=>[String(v[key]),v]));
   for(const id of new Set([...old.keys(),...next.keys()])){const x=old.get(id),y=next.get(id),aHash=x?await Core.sha256(x):null,bHash=y?await Core.sha256(y):null;rows.push({kind,id,name:y?.name||y?.script_name||x?.name||x?.script_name||id,label,currentVersion:x?currentVersion:'未安装',targetVersion:y?version:'移除',currentHash:aHash,targetHash:bHash,action:aHash===bHash?'keep':!x?'add':!y?'remove':'replace'});}
  }
  for(const id of new Set([...Object.keys(before.registry?.packages||{}),...Object.keys(after.registry?.packages||{})])){const x=before.registry?.packages?.[id],y=after.registry?.packages?.[id],aHash=x?await Core.sha256(x):null,bHash=y?await Core.sha256(y):null;rows.push({kind:'package',id,name:id,label:'内容包',currentVersion:x?.version||'未安装',targetVersion:y?.version||'移除',currentHash:aHash,targetHash:bHash,action:aHash===bHash?'keep':!x?'add':!y?'remove':'replace'});}
  for(const p of plugins)rows.push({kind:'plugin',id:p.id,name:p.name,label:'插件',currentVersion:p.runtimeVersion||p.version||'未知',downloadedVersion:p.installedVersion||'',targetVersion:p.targetVersion||'',action:p.kind==='missing'?'add':p.kind==='outdated'?'replace':p.kind==='reload'?'reload':'keep',state:p.kind});
  return rows;
 }
 function create({Core,scope,currentVersion,preview,install,installed,plugins,resources=()=>null,upgradeUpdater,updaterHash,documentTimeOrigin,fetch:fetcher,storage,cache,change=()=>{},reload=()=>{},wait=ms=>new Promise(r=>setTimeout(r,ms))}){
  let alive=true,preparing=null,running=null,local=null,view={phase:'idle',status:'尚未检查',inventory:[],target:null,error:null};
  const key=()=> 'cyber2051:unified-update:'+JSON.stringify(scope()),same=(a,b)=>Core.canonical(a)===Core.canonical(b);
  function readReceipt(){try{return JSON.parse(storage?.getItem(key())||'null');}catch{return null;}}
  function record(value){if(!storage)fail('update-storage','当前环境无法保存更新续接记录。');storage.setItem(key(),JSON.stringify(value));}
  function emit(phase,status,extra={}){view={...view,phase,status,...extra};change(read());}
  const read=()=>({...copy(view),busy:!!(preparing||running),receipt:readReceipt()});
  async function download(item){
   const url=new URL(item.url);if(url.origin!=='https://cyber2051.top'||url.pathname!=='/updates/v3/packages/cyber2051.core/'+item.version+'.json'||url.search||url.hash)fail('invalid-url','完整更新包地址不属于官方发行目录。');
   const valid=async text=>{const n=new TextEncoder().encode(text).length;if(n!==item.bytes||n>64*1024*1024||await Core.sha256(text)!==item.sha256)fail('package-hash-mismatch','更新包大小或指纹与签名目录不一致。');return text;};
   if(cache){try{const hit=await cache.match(item.url);if(hit){try{return await valid(await hit.text());}catch{await cache.delete(item.url);}}}catch{}}
   const r=await fetcher(item.url,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)fail('package-download','更新包返回HTTP '+r.status);
   const declared=Number(r.headers.get('content-length'));if(declared>64*1024*1024)fail('download-too-large','更新包超出64MiB。');
   const chunks=[];let size=0;if(r.body?.getReader){const reader=r.body.getReader();try{for(;;){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>64*1024*1024)fail('download-too-large','更新包超出64MiB。');chunks.push(v.value);}}finally{if(size>64*1024*1024)await reader.cancel();reader.releaseLock();}}
   else{const bytes=new Uint8Array(await r.arrayBuffer());size=bytes.length;chunks.push(bytes);}
   const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}const text=await valid(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(cache)try{await cache.put(item.url,new Response(text,{headers:{'Content-Type':'application/json'}}));}catch{}return text;
  }
  function prepare(item){
   if(preparing)return preparing;const owner=copy(scope());
   const check=()=>{if(!alive||!same(owner,scope()))fail('context-changed','故事已切换，原更新预览已停止。');};
   preparing=(async()=>{emit('downloading','正在准备官方更新包',{target:item,error:null});const text=await download(item);check();const result=await preview(text);check();if(result.pack.release?.updater&&await Core.sha256(result.pack.release.updater.content)!==result.pack.release.updater.manifest.targetHash)fail('updater-hash','独立更新器指纹与清单不一致。');local={item:copy(item),pack:result.pack,owner};const rows=[...(result.summary.inventory||[])];for(const r of result.pack.release?.resources||[]){const current=resources();rows.push({kind:'resource',id:r.id,name:'美术资源',label:'资源包',currentVersion:current?.version||'未核对',targetVersion:r.version,currentHash:current?.manifestId||null,targetHash:r.manifestId,action:current?.manifestId===r.manifestId?'keep':'replace'});}if(result.pack.release?.updater){const m=result.pack.release.updater.manifest,h=await updaterHash();rows.push({kind:'updater',id:m.updaterId,name:'卡内更新器',label:'更新器',currentVersion:currentVersion(),targetVersion:m.version,currentHash:h,targetHash:m.targetHash,action:h===m.targetHash?'keep':'replace'});}emit('prepared','更新包已核对，可查看清单并更新',{inventory:rows,target:item});return read();})().catch(e=>{emit('failed',e.message,{error:{code:e.code||'update-download',message:e.message}});throw e;}).finally(()=>{preparing=null;change(read());});return preparing;
  }
  function apply(){
   if(running)return running;
   running=(async()=>{
    if(preparing)await preparing;if(!local)fail('update-not-prepared','请先检查并准备更新包。');const {item,pack,owner}=local,check=()=>{if(!alive||!same(owner,scope()))fail('context-changed','故事已切换，原更新暂停。');};check();
    if(!Number.isFinite(documentTimeOrigin)||documentTimeOrigin<=0)fail('update-document-unknown','无法确认页面刷新状态，请重新打开酒馆后继续更新。');
    let receipt=readReceipt();if(receipt&&receipt.item.sha256!==item.sha256&&!['complete','superseded'].includes(receipt.phase))fail('update-pending','另一笔更新尚未结束，请先继续或恢复该更新。');
    receipt=receipt?.item.sha256===item.sha256?receipt:{schema:1,item:copy(item),owner,phase:'prepared',pluginReloads:0};record(receipt);
    emit('plugins','正在核对配套插件');const needs=pack.release?.plugins||[{id:'suite',version:'0.3.4',required:true}];
    if(plugins){await plugins.check();let rows=plugins.read().rows;
     for(const need of needs){const row=rows.find(p=>p.id===need.id);if(need.required!==false&&(!row||['disabled','incompatible','unknown'].includes(row.kind)))fail('plugin-not-ready',(row?.name||need.id)+'需要先核对来源、启用状态或版本。');}
     const ids=needs.filter(n=>n.required!==false||rows.some(r=>r.id===n.id&&r.kind!=='missing')).map(n=>n.id);
     const missing=rows.filter(r=>ids.includes(r.id)&&r.kind==='missing').map(r=>r.id);if(missing.length)await plugins.installMissing(missing);
     const minimums=Object.fromEntries(needs.filter(n=>ids.includes(n.id)&&n.version).map(n=>[n.id,n.version]));
     const outdated=rows.filter(r=>ids.includes(r.id)&&(r.kind==='outdated'||minimums[r.id]&&['ready','loading','reload'].includes(r.kind)&&!versionAtLeast(Core,r.installedVersion||r.runtimeVersion||r.version,minimums[r.id]))).map(r=>r.id);if(outdated.length)await plugins.updateInstalled(outdated,minimums);
     check();if(plugins.read().installation.error)fail('plugin-update',plugins.read().installation.error);
     for(let i=0;i<20;i++){await plugins.check();rows=plugins.read().rows;if(!rows.some(r=>ids.includes(r.id)&&r.kind==='loading'))break;await wait(250);check();}
     if(rows.some(r=>ids.includes(r.id)&&(['reload','outdated','missing'].includes(r.kind)||minimums[r.id]&&!versionAtLeast(Core,r.runtimeVersion||r.version,minimums[r.id])&&versionAtLeast(Core,r.installedVersion,minimums[r.id])))){if(receipt.pluginReloads)fail('plugin-reload-unconfirmed','刷新后插件仍未达到要求，请查看插件状态。');receipt.pluginReloads++;receipt.phase='plugins-downloaded';record(receipt);emit('awaiting-reload','配套插件已下载，刷新后继续');reload();return read();}
     for(const need of needs){const row=rows.find(p=>p.id===need.id);if(need.required!==false&&(!row||row.kind!=='ready'||!versionAtLeast(Core,row.runtimeVersion||row.version,need.version)))fail('plugin-not-ready',(row?.name||need.id)+'尚未加载所需版本'+(need.version?' '+need.version:'')+'，请先在酒馆扩展管理器更新并刷新，再继续本次卡内更新。');}
    }else if(needs.some(n=>n.required!==false))fail('plugin-not-ready','插件盘点服务尚未就绪。');
    check();if(!installed(item)){receipt.phase='applying';record(receipt);emit('applying','正在备份并更新卡片组件');await install();check();if(!installed(item))fail('release-not-installed','更新尚未完整应用，请检查暂缓组或保存诊断。');}
    // Persist the parent document before replacing this script. A new helper
    // iframe in the same page must not count as the requested full refresh.
    const replaceUpdater=pack.release?.updater&&await updaterHash()!==pack.release.updater.manifest.targetHash;check();
    if(replaceUpdater){receipt.phase='verify';receipt.reloadDocument=documentTimeOrigin;record(receipt);emit('upgrading-updater','正在升级卡内更新器');await upgradeUpdater(pack.release.updater);if(!same(owner,scope()))fail('context-changed','故事已切换，原更新暂停。');emit('awaiting-reload','更新器已保存，刷新后核对');reload();return read();}
    if(receipt.phase!=='verify'||!Number.isFinite(receipt.reloadDocument)||receipt.reloadDocument<=0){receipt.phase='verify';receipt.reloadDocument=documentTimeOrigin;record(receipt);}
    if(receipt.reloadDocument===documentTimeOrigin){emit('awaiting-reload','组件已保存，刷新后核对实际运行版本');reload();return read();}
    // The hash match skips replacement, not the upgrader's persisted-script
    // verification and awaiting-reload -> complete acknowledgement.
    if(pack.release?.updater){const verified=await upgradeUpdater(pack.release.updater);check();if(verified?.status!=='complete')fail('updater-verification-pending','更新器尚未完成刷新后的保存核对，请继续本次更新。');}
    if(currentVersion()!==item.version||!installed(item))fail('release-readback','刷新后实际版本或安装回执不一致。');receipt.phase='complete';record(receipt);emit('complete','更新完成 · '+item.version,{error:null});return read();
   })().catch(e=>{emit('failed',e.message,{error:{code:e.code||'update-failed',message:e.message}});throw e;}).finally(()=>{running=null;change(read());});return running;
  }
  async function resume(){const receipt=readReceipt();if(!receipt||['complete','superseded','prepared'].includes(receipt.phase))return read();if(!same(receipt.owner,scope()))return read();try{await prepare(receipt.item);return await apply();}catch(e){if(['host-busy','update-already-running'].includes(e.code))emit('waiting','正在等待当前故事空闲，随后继续本次更新',{error:null});throw e;}}
  return {read,prepare,apply,resume,stop(){alive=false;},inventory:args=>inventory({Core,...args})};
 }
 return {create,inventory};
});
