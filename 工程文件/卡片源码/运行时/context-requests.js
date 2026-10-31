(function(root,factory){const local=typeof module==='object'&&module.exports,api=local?require('../../配套扩展/tavern-runtime-suite/context/core/requests.js'):factory(()=>root.parent?.TavernContext?.core?.Requests);if(local)module.exports=api;else root.CxxContextRequests=api;})(globalThis,function(resolve){
  'use strict';
  const required=()=>{const api=resolve();if(!api)throw Error('请安装并启用 Tavern Runtime Suite，通用压缩核心由插件提供。');return api;};
  function create(options){
    let service=resolve()?.create(options),destroyed=false;
    const current=()=>{if(destroyed)throw Error('上下文请求已关闭。');return service??=required().create(options);};
    return {run:input=>current().run(input),cancel:()=>service?.cancel(),status:()=>service?.status()||{busy:false,pending:0,active:null,records:[]},destroy(){destroyed=true;service?.destroy();}};
  }
  return {create,json:text=>required().json(text)};
});
