(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxNetworkDiagnostics=api;})(globalThis,function(){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 function create({context=()=>({}),origin='',now=Date.now}={}){
  const rounds=[];
  function add(entry){let url;try{url=new URL(entry.name);}catch{return;}if(!/^https?:$/.test(url.protocol))return;
   const c=context(),key=JSON.stringify([c.character,c.chat,c.floor,c.branch]);let round=rounds.find(r=>r.key===key);
   if(!round){round={key,context:{...c},at:now(),requests:0,transferBytes:0,bodyBytes:0,unmeasured:0,paths:[]};rounds.push(round);if(rounds.length>20)rounds.shift();}
   const category=url.origin===origin&&url.pathname.startsWith('/api/')?'宿主接口':/live2d/i.test(url.pathname)?'动态立绘':/\.(png|webp|jpg|jpeg|gif|woff2?)(?:$)/i.test(url.pathname)||/\/(resources|img)\//.test(url.pathname)?'美术资源':'其他资源';
   const measured=url.origin===origin||entry.transferSize>0||entry.decodedBodySize>0,path=url.origin+url.pathname;let item=round.paths.find(x=>x.path===path);
   if(!item){if(round.paths.length>=100)round.paths.shift();item={path,category,requests:0,transferBytes:0,bodyBytes:0,unmeasured:0};round.paths.push(item);}
   for(const target of [round,item]){target.requests++;target.transferBytes+=Number(entry.transferSize)||0;target.bodyBytes+=Number(entry.decodedBodySize)||0;if(!measured)target.unmeasured++;}
  }
  return {add,read:()=>structuredClone(rounds).reverse(),clear:()=>rounds.splice(0)};
 }
 function install(win,context){const data=create({context,origin:win.location.origin}),watchers=new Map();
  function watch(target){if(watchers.has(target))return watchers.get(target);let observer;
   const stop=()=>{observer?.disconnect();target.removeEventListener('pagehide',stop);watchers.delete(target);};
   try{if(target.PerformanceObserver){observer=new target.PerformanceObserver(list=>{for(const entry of list.getEntries())data.add(entry);});observer.observe({type:'resource',buffered:false});}}catch{observer?.disconnect();}
   target.addEventListener('pagehide',stop,{once:true});watchers.set(target,stop);return stop;
  }
  watch(win);return {...data,watch,destroy(){for(const stop of [...watchers.values()])stop();}};
 }
 return {create,install};
});
