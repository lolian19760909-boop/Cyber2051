/* Both reading modes use the same chat-owned terminal service. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxNativeTerminal=root.CxxGalTerminal=api;})(globalThis,function(){
  'use strict';
  function create({document:doc,onClose}){
    const consumer={};let disposed=false;
    const service=()=>doc.defaultView.Cxx233Terminal;
    function close(){service()?.close(consumer);}
    return {open({messageId}){if(disposed)throw Error('终端入口已关闭。');const target=service();if(!target)throw Error('共享终端脚本尚未就绪，请检查本卡助手脚本。');return target.open({messageId,consumer,onClose});},close,destroy(){if(disposed)return;close();disposed=true;}};
  }
  return {create};
});
