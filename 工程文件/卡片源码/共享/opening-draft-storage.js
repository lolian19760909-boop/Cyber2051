(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxOpeningDraftStorage=api;})(globalThis,function(){
 'use strict';
 const owned=key=>key.startsWith('cxx-opening-draft:')||key==='cxx-story-creation'||key.startsWith('cxx-story-creation:');
 async function open(win){
  const database=await new Promise((resolve,reject)=>{const request=win.indexedDB.open('cyber2051-opening-drafts',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('开局草稿数据库正被旧页面占用，请关闭旧页面后重新打开人物创建。'));});
  try{
  const pending=new Set();let failure=null,closed=false;
  const memory=await new Promise((resolve,reject)=>{const tx=database.transaction('drafts','readonly'),store=tx.objectStore('drafts'),keys=store.getAllKeys(),values=store.getAll();tx.oncomplete=()=>resolve(new Map(keys.result.map((key,i)=>[key,values.result[i]])));tx.onerror=tx.onabort=()=>reject(tx.error||Error('开局草稿读取失败'));});
  function write(put=[],remove=[]){
   if(closed)throw Error('开局草稿数据库已关闭。');
   const bytes=put.reduce((n,[key,value])=>n+2*(key.length+value.length),0);
   const work=new Promise((resolve,reject)=>{const tx=database.transaction('drafts','readwrite'),store=tx.objectStore('drafts');for(const [key,value]of put)store.put(value,key);for(const key of remove)store.delete(key);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>{const cause=tx.error||Error('事务中断');reject(Object.assign(Error('开局草稿写入 IndexedDB 失败（'+cause.name+'，本次 '+bytes+' 字节）。当前输入仍保留在页面中。'),{code:'opening-draft-write',cause,details:{storage:'IndexedDB',stage:'write',bytes,cause:cause.name}}));};});
   for(const [key,value]of put)memory.set(key,value);for(const key of remove)memory.delete(key);
   pending.add(work);work.then(()=>{failure=null;pending.delete(work);},error=>{failure=error;pending.delete(work);});return work;
  }
  // Migrate only this feature's keys. Delete a legacy value after its exact value
  // is committed, leaving other site settings and independently changed keys intact.
  let legacy;try{legacy=win.localStorage;}catch{}
  const captured=[];if(legacy)for(let i=0;i<legacy.length;i++){const key=legacy.key(i);if(key&&owned(key)){const value=legacy.getItem(key);if(typeof value==='string')captured.push([key,value]);}}
  const incoming=captured.filter(([key])=>!memory.has(key));if(incoming.length)await write(incoming);
  for(const [key,value]of captured)if(memory.get(key)===value&&legacy.getItem(key)===value)legacy.removeItem(key);
  return {getItem:key=>memory.get(key)??null,setItem:(key,value)=>write([[key,String(value)]]),setItems:items=>write(items),removeItem:key=>write([],[key]),removeItems:keys=>write([],keys),
   async flush(){while(pending.size)await Promise.all([...pending]);if(failure)throw failure;},async close(){if(closed)return;try{while(pending.size)await Promise.allSettled([...pending]);}finally{closed=true;database.close();}}};
  }catch(error){database.close();throw error;}
 }
 return {open};
});
