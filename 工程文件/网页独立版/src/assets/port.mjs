/** Verified, demand-loaded official assets. Player saves and credentials never enter this cache.
 *  quality=standard swaps each PNG for its WebP variant from the same manifest; original keeps PNG. */
import {appUrl} from '../platform/paths.mjs';
export function createAssetPort({manifest={},fetchImpl=globalThis.fetch,baseUrl=appUrl(''),maxBytes=32*1024*1024,quality='original'}={}){
  const files=manifest.resources?.files||manifest.files||[],lookup=new Map(),pending=new Map(),urls=new Set(),controllers=new Set(),leases=new Map();let closed=false;
  const wantWebp=quality==='standard'||quality==='webp';
  for(const original of files){
    const variant=wantWebp?original.variants?.webp:null;
    const file=variant?{...original,id:variant.id,url:variant.url,sha256:variant.sha256,bytes:variant.bytes,mime:variant.mime,sourceId:original.id}:original;
    // 相对地址（卡片正文与 assets/… 别名）也要登记，否则标准画质仍会解析到原 PNG。
    for(const key of [original.id,original.sha256,original.url,new URL(original.url,baseUrl).href,...(original.aliases||[]),variant?.id,variant?.url,variant?new URL(variant.url,baseUrl).href:null].filter(Boolean))lookup.set(String(key),file);
  }
  function record(ref){const text=String(ref||'');const match=text.match(/#cxxasset-([a-f0-9]{64})/);return lookup.get(match?.[1]||text)||null;}
  function resolve(ref){
    if(closed)throw new Error('资源会话已关闭');const text=String(ref||''),file=record(text);if(file)return new URL(file.url,baseUrl).href;
    if(/#cxxasset-/.test(text))throw Object.assign(new Error('所需资源未收录，请更新资源文件'),{code:'asset_missing'});
    if(/^data:image\/(?:png|webp|jpeg|gif|svg\+xml)[;,]/i.test(text)||text.startsWith('blob:'))return text;
    const url=new URL(text,baseUrl);if(url.protocol==='https:'||url.origin===new URL(baseUrl).origin)return url.href;
    throw Object.assign(new Error('资源地址不可用'),{code:'asset_url'});
  }
  async function load(ref,{signal,type='response',verify=true}={}){
    const file=record(ref),url=resolve(ref),controller=new AbortController(),abort=()=>controller.abort();controllers.add(controller);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    try{
      const response=await fetchImpl(url,{signal:controller.signal,credentials:'omit',redirect:'error',cache:'force-cache'});if(!response.ok)throw Object.assign(new Error('资源读取失败（'+response.status+'）'),{code:'asset_http'});
      const size=Number(response.headers.get('content-length')||0);if(size>maxBytes)throw new Error('资源大小与登记不符');
      const buffer=await response.arrayBuffer();if(buffer.byteLength>maxBytes||file?.bytes&&buffer.byteLength!==file.bytes)throw new Error('资源大小与登记不符');
      if(verify&&file?.sha256){const digest=globalThis.CxxCrypto?.digest?await globalThis.CxxCrypto.digest(new Uint8Array(buffer)):await crypto.subtle.digest('SHA-256',buffer);const hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)throw Object.assign(new Error('资源校验失败，请重新下载此文件'),{code:'asset_integrity'});}
      if(controller.signal.aborted)throw new DOMException('资源读取已取消','AbortError');
      const fresh=new Response(buffer,{headers:{'content-type':file?.mime||response.headers.get('content-type')||'application/octet-stream'}});
      return type==='json'?fresh.json():type==='text'?fresh.text():type==='blob'?fresh.blob():type==='buffer'?buffer:fresh;
    }finally{controllers.delete(controller);signal?.removeEventListener('abort',abort);}
  }
  async function objectURL(ref,options){const key=resolve(ref);if(pending.has(key))return pending.get(key);const job=load(ref,{...options,type:'blob'}).then(blob=>{const url=URL.createObjectURL(blob);urls.add(url);return url;});pending.set(key,job);try{return await job;}catch(error){pending.delete(key);throw error;}}
  async function acquire(ref,options){const key=resolve(ref);leases.set(key,(leases.get(key)||0)+1);try{const url=await objectURL(ref,options);let released=false;return {url,release(){if(released)return;released=true;const count=(leases.get(key)||1)-1;if(count){leases.set(key,count);return;}leases.delete(key);pending.delete(key);urls.delete(url);URL.revokeObjectURL(url);}};}catch(error){const count=(leases.get(key)||1)-1;count?leases.set(key,count):leases.delete(key);throw error;}}
  function mount(root){
    const rewrite=node=>{if(node.nodeType!==1)return;for(const attr of ['src','poster','href']){const original=node.getAttribute(attr);if(!original||!record(original)&&!/#cxxasset-/.test(original))continue;try{const value=resolve(original);if(original!==value)node.setAttribute(attr,value);}catch{node.dataset.cxxAssetMissing='true';}}
      const style=node.getAttribute('style');if(style&&style.includes('#cxxasset-'))node.setAttribute('style',style.replace(/url\((['"]?)([^)'"\s]+)\1\)/g,(raw,quote,value)=>{try{return 'url("'+resolve(value)+'")';}catch{return 'none';}}));};
    const scan=node=>{rewrite(node);for(const item of node.querySelectorAll?.('[src],[poster],[href],[style]')||[])rewrite(item);};scan(root);
    const observer=new MutationObserver(records=>{for(const change of records){if(change.type==='attributes')rewrite(change.target);else for(const node of change.addedNodes)scan(node);}});observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['src','href','poster','style']});return ()=>observer.disconnect();
  }
  return {kind:'files',quality,resolve,load,objectURL,acquire,mount,record,source:resolve,read:()=>({cardVersion:manifest.contentVersion||'',files:files.length,active:controllers.size,quality}),describe:()=>({files:files.length,active:controllers.size,quality}),close(){if(closed)return;closed=true;for(const c of controllers)c.abort();controllers.clear();for(const url of urls)URL.revokeObjectURL(url);urls.clear();pending.clear();leases.clear();}};
}
