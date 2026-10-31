/* Same image URLs and request mode as the reader: use the browser's immutable HTTP cache. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxMediaPreload=api;})(globalThis,function(){
 'use strict';
 const KEY='cxx2051.media-preload.v1';
 function create({win,manifest}){
  const files=(manifest?.files||[]).filter(f=>/^https:\/\/cyber2051\.top\/img\/galgame\//.test(f.url)),listeners=new Set(),active=new Set();let ended=false,run=0,state={running:false,pack:'common',completed:0,bytes:0,total:0,totalBytes:0,failed:[],last:null},memory={};
  try{memory=JSON.parse(win.localStorage.getItem(KEY)||'{}');}catch{}
  const select=pack=>files.filter(f=>pack==='all'||f.common),read=()=>structuredClone({...state,last:memory.manifest===manifest?.id?(memory.last||null):null,offered:memory.manifest===manifest?.id&&!!memory.dismissed});
  function emit(){for(const fn of listeners)fn(read());}
  function remember(patch){memory={...(memory.manifest===manifest.id?memory:{}),manifest:manifest.id,...patch};try{win.localStorage.setItem(KEY,JSON.stringify(memory));}catch{}}
  function stop(){run++;state.running=false;for(const cancel of [...active])cancel();emit();}
  function one(file,token){return new Promise(resolve=>{const img=new win.Image();let timer,settled=false;const finish=ok=>{if(settled)return;settled=true;win.clearTimeout(timer);img.onload=null;img.onerror=null;active.delete(cancel);img.removeAttribute?.('src');resolve(ok);},cancel=()=>finish(null);active.add(cancel);img.referrerPolicy='no-referrer';img.onload=()=>finish(img.naturalWidth>0);img.onerror=()=>finish(false);timer=win.setTimeout(()=>finish(false),45000);if(ended||token!==run)return cancel();img.src=file.url;});}
  async function start(pack='common'){
   if(ended||state.running)return;const list=select(pack);if(!list.length)throw Error('美术清单尚未就绪。');const token=++run;state={...state,running:true,pack,completed:0,bytes:0,total:list.length,totalBytes:list.reduce((n,f)=>n+f.bytes,0),failed:[]};remember({dismissed:true});emit();let cursor=0;
   async function worker(){while(!ended&&token===run&&cursor<list.length){const file=list[cursor++],ok=await one(file,token);if(ended||token!==run)return;if(ok){state.completed++;state.bytes+=file.bytes;}else state.failed.push(file.file);emit();}}
   await Promise.all([worker(),worker()]);if(ended||token!==run)return;state.running=false;if(!state.failed.length)remember({last:{pack,at:new Date().toISOString(),count:state.completed,bytes:state.bytes}});emit();return read();
  }
  return {read,start,stop,skip(){remember({dismissed:true});emit();},packs:()=>['common','all'].map(id=>({id,count:select(id).length,bytes:select(id).reduce((n,f)=>n+f.bytes,0)})),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},destroy(){ended=true;stop();listeners.clear();}};
 }
 return {create,KEY};
});
