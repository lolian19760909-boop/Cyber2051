(function(root,factory){const local=typeof module==='object'&&module.exports,api=local?require('../../配套扩展/tavern-runtime-suite/context/core/compact.js'):factory(()=>root.parent?.TavernContext?.core?.Compact);if(local)module.exports=api;else root.CxxContextCompact=api;})(globalThis,function(resolve){
  'use strict';
  const required=()=>{const api=resolve();if(!api)throw Error('请安装并启用 Tavern Runtime Suite，通用压缩核心由插件提供；安装状态见插件检查。');if(!api.projectionFingerprints)throw Error('请更新至 Tavern Runtime Suite 0.2.0 或更新版本，启用上下文模块并刷新酒馆。');return api;};
  function create(options){
    let service=resolve()?.projectionFingerprints?required().create(options):null;
    const current=()=>service??=required().create(options);
    return {before:request=>current().before(request),status:()=>service?.status()||{busy:false,error:resolve()?'':'请启用 Tavern Runtime Suite 的上下文模块。',errorCode:'',lastRun:null},records:()=>service?.records()||options.store.read().compactions||[]};
  }
  const api={create};
  for(const name of ['key','budget','valid','select','groups','eligible','messages','parse','render'])api[name]=(...args)=>required()[name](...args);
  Object.defineProperty(api,'defaults',{enumerable:true,get:()=>required().defaults});
  return api;
});
