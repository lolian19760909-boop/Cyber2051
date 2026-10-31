/* Character creation belongs to gameplay, independently of either reader. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxOpeningStartupFactory=value;})(globalThis,function(){
 'use strict';
 function install({win,api,runtime,pages}){
  let instance=null,ended=false,lastError='';
  function ensure(){
   if(ended||!runtime.alive)throw Error('人物创建服务已卸载，请重新打开当前角色卡。');
   if(instance&&win.Cxx236OpeningHost===instance)return instance;
   try{
    instance=win.Cxx236OpeningMap.create({win,api,runtime,pages});
    const current=instance;runtime.register('Cxx236OpeningHost',current,()=>current.destroy(),['CxxOpeningStartup']);
    lastError='';win.CxxDiagnostics?.resolve(r=>r.module==='人物创建'&&r.stage==='启动');
    return instance;
   }catch(error){lastError=error.message||String(error);win.CxxDiagnostics?.report({module:'人物创建',stage:'启动',message:lastError,detail:error.stack||''});throw error;}
  }
  const service={ensure,read:()=>({ready:!!instance&&win.Cxx236OpeningHost===instance,lastError}),destroy(){ended=true;instance?.destroy();instance=null;}};
  runtime.register('CxxOpeningStartup',service,()=>service.destroy(),['Cxx236OpeningMap','Cxx236Preferences']);
  try{ensure();}catch{/* The creation button retries and shows the recorded error. */}
  return service;
 }
 return {install};
});
