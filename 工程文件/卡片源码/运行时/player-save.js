(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxPlayerSave=api;})(globalThis,function(){
 'use strict';
 // Shared persistence, independent of rules and DOM. State remains owned by player-host.
 function create({getState,assertCurrent,current,idle,writable,context:ctx,read,publish,notify,localSignature,saveTimeout,withChatSave}){
  const traces=new WeakMap();
  const stage=(s,phase,data)=>{for(const trace of traces.get(s)||[])trace.stage(phase,data);};
  function enqueue(s,work){const p=s.queue.then(()=>{assertCurrent(s);idle();return work();});s.queue=p.catch(()=>{});return p;}
  function dirty(s){s.revision++;s.needsSave=true;s.signature=localSignature();publish(s,'saving');}
  function flush(s,{verifyOnly=false,trace}={}){
   assertCurrent(s);
   if(trace){if(!traces.has(s))traces.set(s,new Set());traces.get(s).add(trace);}
   const observe=flight=>trace?flight.finally(()=>traces.get(s)?.delete(trace)):flight;
   if(s.flight)return observe(s.flight);
   publish(s,'saving');const flight=(async()=>{
    await s.queue;assertCurrent(s);
    do{
     const revision=s.revision;s.timings={...(s.timings||{}),startedAt:Date.now()};await writable(s);assertCurrent(s);
     const timer=setTimeout(()=>{publish(s,'timeout','保存响应较慢，配置已保留；原请求仍在处理中，请勿重载。');stage(s,'unconfirmed',{classification:'commit-unconfirmed'});},saveTimeout);
     try{
      if(s.needsSave||!verifyOnly){const expected=read.location(),save=async()=>{assertCurrent(s);await writable(s);stage(s,'persisting');const start=Date.now();await ctx().saveChat();s.timings.writeMs=Date.now()-start;};if(withChatSave)await withChatSave(expected,save);else await save();}
      assertCurrent(s);if(revision!==s.revision){await s.queue;continue;}
      stage(s,'confirming');const readStarted=Date.now(),saved=await read();s.timings.readbackMs=Date.now()-readStarted;s.timings.totalMs=Date.now()-s.timings.startedAt;assertCurrent(s);if(revision!==s.revision){await s.queue;continue;}
      s.saved=saved;s.savedRevision=revision;s.needsSave=false;s.signature=localSignature();publish(s,'saved');stage(s,'confirmed',{revision:saved.stat.terminal?.questJournal?.revision||0,timings:{...s.timings}});notify(saved,[...traces.get(s)||[]].at(-1)?.context);return saved;
     }catch(e){if(current(s)&&revision!==s.revision){await s.queue;continue;}throw e;}
     finally{clearTimeout(timer);}
    }while(current(s));
   })().catch(e=>{publish(s,'error',e.message||'保存失败，配置已保留。');throw e;}).finally(()=>{if(s.flight===flight)s.flight=null;});
   s.flight=flight;flight.catch(()=>{});return observe(flight);
  }
  function background(s,options){setTimeout(()=>{if(current(s)&&(s.needsSave||options?.verifyOnly&&(s.status!=='saved'||s.signature!==localSignature())))void flush(s,options).catch(()=>{});},0);}
  function retrySave(){return flush(getState());}
  async function waitForSaved({timeout=saveTimeout}={}){
   const s=getState();if(s.status==='saved'&&s.savedRevision===s.revision)return s.saved;
   const flight=s.flight||flush(s,{verifyOnly:!s.needsSave});let timer;
   try{return await Promise.race([flight,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('保存尚未确认，草稿已保留。'),{code:'player-save-timeout'})),timeout);})]);}finally{clearTimeout(timer);}
  }
  return {enqueue,dirty,flush,background,retrySave,waitForSaved};
 }
 return {create};
});
