(function(root,factory){const local=typeof module==='object'&&module.exports;const value=factory(local?require('../src/engine.js'):root.CxxNumericEngine);if(local)module.exports=value;else root.CxxNumericStory=value;})(globalThis,function(engine){
  'use strict';
  function snapshot(messages,type='normal'){
    let end=messages.length-1;
    if(['swipe','regenerate'].includes(type)&&messages[end]&&!messages[end].is_user&&!messages[end].is_system)end--;
    for(let floor=end;floor>=0;floor--){const message=messages[floor];if(message.is_user||message.is_system)continue;const swipe=message.swipe_id||0,stat=message.variables?.[swipe]?.stat_data;if(stat)return {stat,floor,swipe};}
    return null;
  }
  function prompt(messages,{type='normal',owner='native',...options}={}){
    if(owner!=='native')return '';const current=snapshot(messages,type);return current?engine.context(current.stat,options):'';
  }
  return {snapshot,prompt};
});
