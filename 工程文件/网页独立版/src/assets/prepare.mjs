import {appUrl} from '../platform/paths.mjs';
import {activeLayers,loadPackCatalog,packEntries,selectPack} from './pack-state.mjs';
/** The entry loader owns this wait; no game UI is revealed before the chosen quality is locally installed. */
export async function prepareOfficialMedia(onProgress=()=>{},{quality='standard',catalog=null,signal}={}){
 const data=catalog||await loadPackCatalog(),pack=selectPack(data,quality);
 if(!pack)throw Error('当前资源包没有可用画质');
 const layers=activeLayers(data,pack.key),entries=packEntries(data,pack.key);
 if(!layers.length||!entries.length)throw Error('当前资源包目录为空');
 if(!navigator.serviceWorker)throw Error('当前浏览器无法保存资源包，请使用支持本机缓存的浏览器');
 const siteRoot=new URL('../../',appUrl('')),registration=await navigator.serviceWorker.register(new URL('resource-worker.js',siteRoot),{scope:siteRoot.pathname});
 try{await registration.update();}catch{}
 // 资源安装器自身也会随发行版更新。旧 worker 不认识分层配置，必须等新 worker 激活后再发 prepare。
 const pending=registration.installing||registration.waiting;
 if(pending)await new Promise((resolve,reject)=>{
  const finish=error=>{pending.removeEventListener('statechange',onState);signal?.removeEventListener('abort',onAbort);error?reject(error):resolve();};
  const onAbort=()=>finish(signal.reason);
  const onState=()=>{if(pending.state==='activated')finish();else if(pending.state==='redundant')finish(Error('资源安装器更新失败，请重新载入页面'));};
  pending.addEventListener('statechange',onState);signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)onAbort();else onState();
 });
 const worker=registration.active;if(!worker)throw Error('资源安装器尚未就绪，请重新载入页面');
 if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
  const finish=error=>{navigator.serviceWorker.removeEventListener('controllerchange',onChange);signal?.removeEventListener('abort',onAbort);error?reject(error):resolve();};
  const onChange=()=>{if(navigator.serviceWorker.controller)finish();},onAbort=()=>finish(signal.reason);
  navigator.serviceWorker.addEventListener('controllerchange',onChange);signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)onAbort();else onChange();
 });
 if(signal?.aborted)throw signal.reason;
 const channel=new MessageChannel();
 const config={schema:2,version:data.version,id:pack.id,quality:pack.key,layers,pool:Object.values(data.layers).map(layer=>layer.id),resourceBytes:pack.resourceBytes,baseUrl:appUrl('')};
 await new Promise((resolve,reject)=>{
  const cancel=()=>{try{worker.postMessage({type:'cancel-prepare',id:config.id});}catch(error){finish(error);}};
  const finish=error=>{channel.port1.close();signal?.removeEventListener('abort',cancel);worker.removeEventListener('statechange',onState);error?reject(error):resolve();};
  const onState=()=>{if(worker.state==='redundant')finish(Error('资源安装器已停止，请重新载入后继续'));};
  channel.port1.onmessage=({data:message})=>{if(message.stage==='done')finish();else if(message.stage==='error')finish(Object.assign(Error(message.message),{name:message.name||'Error'}));else onProgress(message);};
  worker.addEventListener('statechange',onState);if(worker.state==='redundant'){onState();return;}
  try{worker.postMessage({type:'prepare',config},[channel.port2]);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();}catch(error){finish(error);}
 });
 return {version:data.version,quality:pack.key,id:pack.id,assets:entries.length,layers:layers.map(layer=>layer.key)};
}
