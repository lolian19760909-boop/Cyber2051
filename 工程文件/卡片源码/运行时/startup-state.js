(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxStartupState=value;})(globalThis,function(){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 function install(win){
  win.CxxStartup?.destroy();const records=new Map(),timers=new Set();let ended=false;
  function mark(id,name,state,detail='',error=null){if(ended)return;const prior=records.get(id),row={id,name,state,detail,at:Date.now(),since:prior?.state===state&&prior?.detail===detail?prior.since:Date.now()};if(error)row.error={message:error.message||String(error),code:error.code||'',stack:error.stack||''};records.set(id,row);win.CxxDiagnostics?.module(name,state,detail?[detail]:[]);return row;}
  async function wait(id,name,dependency,work){mark(id,name,'等待依赖',dependency);const timer=win.setTimeout(()=>{if(!ended)mark(id,name,'依赖等待超过10秒',dependency);},10000);timers.add(timer);try{const value=await work();if(!ended)mark(id,name,'依赖已就绪',dependency);return value;}catch(error){mark(id,name,'启动失败',dependency,error);throw error;}finally{win.clearTimeout(timer);timers.delete(timer);}}
  const service={mark,wait,read:()=>[...records.values()].map(r=>structuredClone(r)),destroy(){ended=true;for(const t of timers)win.clearTimeout(t);timers.clear();if(win.CxxStartup===service)delete win.CxxStartup;}};
  win.CxxStartup=service;return service;
 }
 return {install};
});
