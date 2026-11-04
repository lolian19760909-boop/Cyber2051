(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxUpdateDiscovery=api;})(globalThis,function(root){
  'use strict';
  const URL='https://cyber2051.top/updates/v3/release-manifest.json',DAY=86400000,LIMIT=1024*1024;
  const CryptoCompat=typeof module==='object'&&module.exports?require('./crypto-compat.js'):root.CxxCrypto,PACKAGE_LIMIT=64*1024*1024;
  async function verifyDocument(doc,keys,core,crypto=root.crypto){const s=doc.signature,key=keys?.[s?.keyId],fail=(code,message)=>Object.assign(Error(message),{code});if(!key||s?.algorithm!=='Ed25519')throw fail('untrusted-signature','更新签名不属于本卡信任的发布者');const unavailable=()=>fail('crypto-signature-unavailable','当前脚本环境无法验证更新签名。请在支持 Web Crypto 的浏览器或电脑本机打开后安装更新；未安装此文件。'),subtle=CryptoCompat.create(crypto).subtle;if(typeof subtle?.importKey!=='function'||typeof subtle?.verify!=='function')throw unavailable();const decode=value=>Uint8Array.from(root.atob(value),c=>c.charCodeAt(0));try{const imported=await subtle.importKey('spki',decode(key),{name:'Ed25519'},false,['verify']),unsigned={...doc};delete unsigned.signature;if(!await subtle.verify('Ed25519',imported,decode(s.value),new TextEncoder().encode(core.canonical(unsigned))))throw fail('bad-signature','更新签名校验失败');}catch(e){if(['NotSupportedError','SecurityError'].includes(e.name))throw unavailable();throw e;}return doc;}
  async function readBytes(url,{fetch:fetcher=root.fetch?.bind(root),signal=AbortSignal.timeout(30000),limit,label}){if(!fetcher)throw Error('当前环境无法联网');const response=await fetcher(url,{credentials:'omit',redirect:'error',cache:'no-store',signal});if(!response.ok)throw Error(label+'返回 '+response.status);if(Number(response.headers.get('content-length'))>limit)throw Error(label+'超出大小限制');if(!response.body?.getReader){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>limit)throw Error(label+'超出大小限制');return bytes;}const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const row=await reader.read();if(row.done)break;size+=row.value.length;if(size>limit)throw Error(label+'超出大小限制');chunks.push(row.value);}}finally{if(size>limit)await reader.cancel();reader.releaseLock();}const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return bytes;}
  async function readCatalog({Core,verify,trustedKeys,url=URL,fetch,signal,label='内容目录'}){const bytes=await readBytes(url,{fetch,signal,limit:LIMIT,label}),doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await (verify||((value,keys)=>verifyDocument(value,keys,Core)))(doc,trustedKeys);Core.validateCatalog(doc,{cardId:'cyber2051',engineVersion:Core.ENGINE_VERSION});return doc;}
  async function downloadContent(entry,{Core,verify,trustedKeys,fetch,signal,mapIndex,characterIds}){if(entry.kind!=='content'||entry.bytes>PACKAGE_LIMIT)throw Error('请选择64 MiB以内的内容包');const bytes=await readBytes(entry.url,{fetch,signal,limit:Math.min(entry.bytes,PACKAGE_LIMIT),label:'内容包'});if(bytes.length!==entry.bytes||Array.from(new Uint8Array(await CryptoCompat.digest(bytes)),b=>b.toString(16).padStart(2,'0')).join('')!==entry.sha256)throw Object.assign(Error('内容包文件与签名目录不一致'),{code:'package-digest-mismatch'});const pack=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await (verify||((value,keys)=>verifyDocument(value,keys,Core)))(pack,trustedKeys);Core.validatePackage(pack,{cardId:'cyber2051',engineVersion:Core.ENGINE_VERSION,mapIndex,characterIds});if(pack.id!==entry.id||pack.version!==entry.version||pack.kind!=='content'||pack.optional!==entry.optional||(pack.activation||'compatible')!==(entry.activation||'compatible')||Core.canonical(pack.requires)!==Core.canonical(entry.requires))throw Object.assign(Error('内容包身份或版本与目录不一致'),{code:'package-entry-mismatch'});return {pack,sha256:entry.sha256};}
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
          const doc=await readCatalog({Core,verify,trustedKeys:seed().trustedKeys,fetch:fetcher,signal:controller.signal,label:'版本目录'});
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
  return {create,readCatalog,downloadContent,verifyDocument,URL,DAY,LIMIT};
});
