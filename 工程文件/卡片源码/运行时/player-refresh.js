(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxPlayerRefresh=api;})(globalThis,function(){
 'use strict';
 function create({top,views,context=()=>({})}){
  function publish(saved,operation={}){
   const owner={...context(),...operation},report=error=>top.CxxDiagnostics?.report({module:'人物界面',stage:'view-refresh-failed',message:error.message,detail:error.stack,context:{...owner,component:owner.component||'cyber2051.player-view',classification:'view-not-refreshed'}});
   try{top.dispatchEvent?.(new top.CustomEvent('cxx-player-changed'));}catch(error){report(error);}
   for(const view of views)try{Promise.resolve(view.refresh?.(saved)).catch(report);}catch(error){report(error);}
  }
  return {publish};
 }
 return {create};
});
