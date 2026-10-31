// Installs the shared map into either maintained game host's existing map service.
// The service continues to own state, task actions and returning to the terminal.
export async function installGame({window:win=window,service=win.CxxAtlasTool,assetBase,publicURL}){
 if(!service?.setDisplay||!service.renderDetail)throw Error('请先装入本批地图服务接线。');
 const base=new URL(assetBase,win.location.href),get=async p=>{const r=await fetch(new URL(p,base));if(!r.ok)throw Error('地图资源不可用：'+p);return r.json();};
 const[catalog,tiles]=await Promise.all([get('data/catalog.json'),get('data/tiles.json')]);const doc=win.document;
 const dialog=doc.createElement('dialog');dialog.setAttribute('aria-label','城市地图');dialog.style.cssText='padding:0;border:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;background:#050b11;color:#dbe7e8';
 const bar=doc.createElement('header');bar.style.cssText='height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#0b171f;border-bottom:1px solid #29414d';
 const name=doc.createElement('span');name.textContent='城市地图';const back=doc.createElement('button');back.textContent='返回终端';back.style.cssText='color:inherit;background:transparent;border:0;padding:8px 12px;cursor:pointer';bar.append(name,back);dialog.append(bar);doc.body.append(dialog);
 let frame=null,instance=null,opening=null,epoch=0,stopped=false,cancelLoad=null,failure=null;
 function close(){epoch++;cancelLoad?.();cancelLoad=null;instance?.destroy();instance=null;frame?.remove();frame=null;opening=null;failure?.remove();failure=null;if(dialog.open)dialog.close();}
 back.onclick=()=>service.returnToTerminal();dialog.addEventListener('cancel',e=>{e.preventDefault();service.returnToTerminal();});
 async function open(options={}){
  if(stopped)return false;const scope=service.read().scope;if(!scope)return false;const invocation=epoch;failure?.remove();failure=null;if(!dialog.open)dialog.showModal();
  if(!instance&&!opening){const version=epoch;opening=(async()=>{frame=doc.createElement('iframe');frame.title='东京都2051地图';frame.style.cssText='display:block;width:100%;height:calc(100% - 44px);border:0';
   const css=new URL('site.css',base).href,module=new URL('app.mjs',base).href,quote=s=>JSON.stringify(s).replaceAll('<','\\u003c');
   const loaded=new Promise((resolve,reject)=>{cancelLoad=resolve;frame.onload=()=>{cancelLoad=null;resolve();};frame.onerror=()=>reject(Error('地图界面未能载入。'));});
   frame.srcdoc='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="map-site"></main><script type="module">import{mount}from '+quote(module)+';const link=document.createElement("link");link.rel="stylesheet";link.href='+quote(css)+';document.head.append(link);window.CxxMapSiteMount=mount;<\/script></body></html>';dialog.append(frame);await loaded;if(version!==epoch||stopped)return;
   if(typeof frame.contentWindow.CxxMapSiteMount!=='function')throw Error('地图模块未能载入。');
   const mount=frame.contentWindow.CxxMapSiteMount;
   const getPlaces=mapId=>(catalog.maps.find(m=>m.id===mapId)?.places||[]).filter(p=>mapId!=='tokyo-central'||service.visible(p.id)).map(p=>({...p,...service.location(mapId,p.id),mapId,category:p.category}));
   const created=await mount(frame.contentDocument.getElementById('map-site'),{catalog,tiles,assetBase:base.href,publicURL:publicURL||base.href,scope,storage:win.localStorage,search:'?map='+encodeURIComponent(options.mapId||'tokyo-central'),getPlaces,subscribe:service.subscribe,
    onDetail:(place,body)=>service.renderDetail({mapId:place.mapId,state:{selection:{kind:'node',id:place.id}}},body)});
   if(version!==epoch||stopped){created.destroy();return;}instance=created;
  })().finally(()=>{if(version===epoch)opening=null;});}
  try{await opening;if(!instance)return false;if(options.mapId&&instance.read().mapId!==options.mapId&&!await instance.switchMap(options.mapId))return false;if(options.placeId)return await instance.focus(options.placeId,options.mapId||'tokyo-central');return true;}catch(error){if(invocation!==epoch||stopped)return false;close();failure=doc.createElement('section');failure.style.cssText='padding:28px';const text=doc.createElement('p');text.textContent='地图未能打开：'+error.message;const retry=doc.createElement('button');retry.textContent='重试';retry.onclick=()=>open(options);failure.append(text,retry);dialog.append(failure);dialog.showModal();return false;}
 }
 const display={open,close,destroy(){if(stopped)return;stopped=true;close();dialog.remove();},isVisible:()=>dialog.open};const uninstall=service.setDisplay(display);
 return{open,close,destroy(){uninstall();display.destroy();},read:()=>instance?.read()||{visible:false}};
}
export const installTavern=installGame;
export const installWeb=installGame;
