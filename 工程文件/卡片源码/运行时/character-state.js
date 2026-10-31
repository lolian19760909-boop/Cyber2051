/* ST 1.19 merge-attributes: update only the updater's character variable.
 * Large cached card JSON is prepared off the UI thread; source/scripts stay put. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxCharacterState=value;})(globalThis,function(){
 'use strict';
 const UNSET='__@@UNSET@@__',record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const equal=(a,b)=>a===b||!!(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k])));
 function patch(before,after){
  if(!record(after))return after;
  const result={};for(const key of Object.keys(before||{}))if(!Object.hasOwn(after,key))result[key]=UNSET;
  for(const [key,value]of Object.entries(after)){if(['__proto__','prototype','constructor'].includes(key))throw Error('更新状态包含保留字段');if(value===UNSET||record(value)&&Object.hasOwn(before||{},key)&&!record(before[key]))throw Object.assign(Error('此状态变化需要完整替换'),{code:'full-replace-required'});if(!equal(before?.[key],value))result[key]=record(value)?patch(record(before?.[key])?before[key]:{},value):value;}
  return result;
 }
 function prepareJSON(text,namespace,value){
  if(!text)return text;const raw=JSON.parse(text),data=raw.data||raw,helper=data.extensions.tavern_helper;
  helper.variables={...helper.variables,[namespace]:value};return JSON.stringify(raw);
 }
 function outerKeys(text){const raw=JSON.parse(text);return raw?.data?Object.keys(raw):[];}
 async function readCharacter({url,request}){
  const response=await fetch(url,request);
  if(!response.ok)throw Object.assign(Error('宿主保存或读回失败：'+response.status),{code:'persistence-http-error'});
  const raw=await response.json();
  // /get repeats the card in json_data. Parse in the worker and only return
  // the already parsed data used by the existing comparison/readback guards.
  if(raw.data)return {data:raw.data};
  const parsed=typeof raw.json_data==='string'?JSON.parse(raw.json_data):raw;
  return {data:parsed.data||parsed};
 }
 function create({root=globalThis,api,namespace,assertContext,fetch:fetcher,hostOrigin,encode}){
  let worker=null,timer=null,job=0;const jobs=new Map();
  function dispose(){root.clearTimeout(timer);worker?.terminate();worker=null;for(const p of jobs.values())p.reject(Error('角色保存准备已取消'));jobs.clear();}
  function run(task,text,value){
   if(task==='prepare'&&encode)return encode(text,namespace,value);
   if(!root.Worker)return Promise.resolve().then(()=>task==='keys'?outerKeys(text):prepareJSON(text,namespace,value));
   root.clearTimeout(timer);
   if(!worker){const code='const prepare='+prepareJSON.toString()+';const keys='+outerKeys.toString()+';const read='+readCharacter.toString()+';onmessage=async({data:{id,task,text,namespace,value}})=>{try{postMessage({id,text:task==="read"?await read(text):task==="keys"?keys(text):prepare(text,namespace,value)});}catch(error){postMessage({id,error:error.message,code:error.code});}}';const url=root.URL.createObjectURL(new root.Blob([code],{type:'text/javascript'}));try{worker=new root.Worker(url);}finally{root.URL.revokeObjectURL(url);}
    worker.onmessage=({data})=>{const p=jobs.get(data.id);if(!p)return;jobs.delete(data.id);data.error?p.reject(Object.assign(Error(data.error),{code:data.code})):p.resolve(data.text);if(!jobs.size)timer=root.setTimeout(dispose,10000);};worker.onerror=dispose;
   }
   const id=++job;return new Promise((resolve,reject)=>{jobs.set(id,{resolve,reject});try{worker.postMessage({id,task,text,namespace,value});}catch(e){jobs.delete(id);reject(e);}});
  }
  root.addEventListener?.('pagehide',dispose,{once:true});
  async function write(value,expected){
   const context=api.SillyTavern.getContext(),character=context.characters?.[context.characterId],helper=character?.data?.extensions?.tavern_helper;
   if(!record(helper))return false;
   const before=api.getVariables({type:'character'})[namespace]||{},text=character.json_data;let delta;try{delta=patch(before,value);}catch(e){if(e.code==='full-replace-required')return false;throw e;}
   const current=()=>{assertContext(expected,true);const c=api.SillyTavern.getContext();if(c.characters?.[c.characterId]!==character||character.json_data!==text||!equal(api.getVariables({type:'character'})[namespace]||{},before))throw Object.assign(Error('准备保存时角色数据已变化，请重试'),{code:'concurrent-change'});};
   const prepared=text?await run('prepare',text,value):text;current();
   const response=await fetcher(new URL('/api/characters/merge-attributes',hostOrigin||root.parent.location.origin).href,{method:'POST',headers:context.getRequestHeaders(),credentials:'same-origin',cache:'no-store',body:JSON.stringify({avatar:expected.characterKey,data:{extensions:{tavern_helper:{variables:{[namespace]:delta}}}}})});
   current();if(!response.ok)throw Object.assign(Error('角色状态局部保存失败：'+response.status),{code:'persistence-http-error'});
   helper.variables={...helper.variables,[namespace]:JSON.parse(JSON.stringify(value))};
   if(text){character.json_data=prepared;const field=(root.parent?.document||root.document)?.getElementById('character_json_data');if(field)field.value=prepared;}
   // TH 4.11.3 owns a separate reactive settings store. Its public updater
   // refreshes that store; the already-equal character cache makes TH's writer
   // return before serializing/uploading the full card again.
   await api.updateVariablesWith(vars=>{vars[namespace]=JSON.parse(JSON.stringify(value));return vars;},{type:'character'});
   if(!equal(api.getVariables({type:'character'})[namespace],value))throw Object.assign(Error('角色变量缓存未同步，保存尚未确认'),{code:'state-cache-mismatch'});
   return true;
  }
  // TT intercepts fetch in its host window. A Worker has a different fetch and
  // must never bypass that bridge. Keep CPU preparation in the worker only.
  return {write,outerKeys:text=>run('keys',text),readCharacter:null,destroy(){dispose();root.removeEventListener?.('pagehide',dispose);}};
 }
 return {create,patch,prepareJSON};
});
