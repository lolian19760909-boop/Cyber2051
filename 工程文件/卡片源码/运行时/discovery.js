(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxUpdateDiscovery=api;})(globalThis,function(root){
  'use strict';
  const URL='https://cyber2051.top/updates/v3/release-manifest.json',DAY=86400000,LIMIT=1024*1024;
  function create({Core,verify,seed,currentVersion,fetch:fetcher=root.fetch?.bind(root),storage,locks=root.navigator?.locks,now=Date.now,onChange=()=>{},onNewVersion=()=>{}}){
    let stopped=false,active=null,view={status:'尚未检查',latest:null,checking:false},memory={};
    try{storage=storage||root.parent?.localStorage||root.localStorage;}catch{}
    const key='cyber2051:update-discovery:v1';
    function read(){try{return storage?JSON.parse(storage.getItem(key)||'{}'):memory;}catch{return memory;}}
    function save(v){memory=v;try{storage?.setItem(key,JSON.stringify(v));}catch{}}
    function state(){const s=read();return {...view,enabled:s.enabled!==false,lastAttempt:s.lastAttempt||null};}
    function enabled(value){save({...read(),enabled:!!value});if(!value)active?.abort();onChange(state());}
    async function check(manual=false){
      if(stopped||active)return state();const s=read();if(!manual&&(s.enabled===false||now()-(s.lastAttempt||0)<DAY))return state();
      const work=async()=>{
        const latestState=read();if(!manual&&(latestState.enabled===false||now()-(latestState.lastAttempt||0)<DAY))return state();
        save({...latestState,lastAttempt:now()});const controller=new AbortController();active=controller;const timer=setTimeout(()=>controller.abort(),15000);
        view={...view,checking:true,status:'正在检查官方版本'};onChange(state());
        try{
          if(!fetcher)throw Error('当前环境无法联网');
          const response=await fetcher(URL,{credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
          if(!response.ok)throw Error('版本目录返回 '+response.status);const declared=Number(response.headers.get('content-length'));if(declared>LIMIT)throw Error('版本目录超出大小限制');
          let bytes;if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const row=await reader.read();if(row.done)break;size+=row.value.length;if(size>LIMIT)throw Error('版本目录超出大小限制');chunks.push(row.value);}}finally{if(size>LIMIT)await reader.cancel();reader.releaseLock();}bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}}
          else{bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>LIMIT)throw Error('版本目录超出大小限制');}
          const doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await verify(doc,seed().trustedKeys);Core.validateCatalog(doc,{cardId:'cyber2051',engineVersion:Core.ENGINE_VERSION});
          if(stopped||controller.signal.aborted)throw Error('检查已取消');
          const candidate=doc.packages.find(p=>p.id==='cyber2051.core'&&p.kind==='core');
          if(!candidate)throw Error('目录尚未提供正式版本');const newer=Core.compareVersions(candidate.version,currentVersion())>0;
          view={checking:false,latest:{...candidate},status:newer?'发现新版 '+candidate.version+'，正在准备更新包':'当前已是目录中的最新版本'};
          const token=candidate.version+':'+candidate.sha256;if(newer&&read().notified!==token){save({...read(),notified:token});onNewVersion(view.latest);}
        }catch(e){view={...view,checking:false,latest:null,status:'检查失败：'+(e.name==='AbortError'?'连接超时或已取消':e.message)+'；仍可选择本地更新包'};}
        finally{clearTimeout(timer);active=null;if(!stopped)onChange(state());}return state();
      };
      if(locks?.request)return locks.request('cyber2051:version-discovery',{mode:'exclusive',ifAvailable:true},lock=>lock?work():state());
      return work();
    }
    return {check,state,setEnabled:enabled,stop(){stopped=true;active?.abort();}};
  }
  return {create,URL,DAY,LIMIT};
});
