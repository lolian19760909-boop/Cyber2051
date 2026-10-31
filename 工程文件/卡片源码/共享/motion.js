(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxMotion=api;})(globalThis,function(root){
 'use strict';
 function hostOf(win){for(let i=0;i<6&&win;i++){try{if(win.TavernMotion?.features?.includes('navigation'))return win;if(win.parent===win)break;win=win.parent;}catch{break;}}return null;}
 function mount(element){
  const doc=element.ownerDocument,win=doc.defaultView,host=hostOf(win);let scope=null,ended=false,key=false;
  const profile=()=>({theme:({red:'crisp',yellow:'cut',night:'quiet'})[doc.documentElement.dataset.cxxTheme]||'crisp',level:host?.Cxx236Preferences?.read?.().level||'medium'});
  try{if(host)scope=host.TavernMotion.mount(element,{profile,keyboard:()=>key,reducedMotion:()=>profile().level==='low'});}catch{}
  function keyboard(event){if(event.key==='Tab'||event.key==='Escape'||event.key==='Enter'||event.key?.startsWith('Arrow')){key=true;scope?.finish();}}
  function pointer(event){key=false;const button=event.target?.closest?.('button'),handled=Symbol.for('cxx.motion.press');if(button&&!button.disabled&&element.contains(button)&&!event[handled]){event[handled]=true;void scope?.feedback(button);}}
  const refresh=()=>scope?.finish();
  if(scope){element.addEventListener('keydown',keyboard,true);element.addEventListener('pointerdown',pointer,true);host.addEventListener('cxx-ui-preferences-changed',refresh);}
  function dispose(){if(ended)return;ended=true;scope?.dispose();element.removeEventListener('keydown',keyboard,true);element.removeEventListener('pointerdown',pointer,true);host?.removeEventListener('cxx-ui-preferences-changed',refresh);win.removeEventListener('pagehide',dispose);}
  win.addEventListener('pagehide',dispose,{once:true});
  return {available:!!scope,capture:node=>scope?.capture(node),
   navigate(previous,next,options){if(scope)return scope.navigate(previous,next,options);if(previous&&previous!==next)previous.hidden=true;if(next)next.hidden=false;return Promise.resolve();},
   update(node,mutate,options){if(scope&&node)return scope.update(node,mutate,options);mutate();return Promise.resolve();},
   // 只做「新内容入场」的原地替换：不克隆旧内容做副本。
   // 整页/大面板切换必须走 swap（或 navigate），update 会留一张旧内容的覆盖层。
   swap(node,mutate,options={}){mutate();if(!node||!scope)return Promise.resolve();
     if(scope.diagnostics?.().active>=0&&(options.reduced??(profile().level==='low')))return Promise.resolve();
     const distance=options.direction===-1?-4:4;
     return Promise.resolve(scope.animate(node,[{opacity:0,transform:'translateY('+distance+'px)'},{opacity:1,transform:'none'}],{duration:options.duration??180})).catch(()=>{});},
   presence(node,visible,options){if(scope)return scope.presence(node,visible,options);node.hidden=!visible;return Promise.resolve();},
   layout(nodes,mutate,options){if(scope)return scope.layout(nodes,mutate,options);mutate();return Promise.resolve();},
   animate(node,frames,options){return scope?.animate(node,frames,options)||Promise.resolve();},
   feedback:(node,kind)=>scope?.feedback(node,kind),finish:()=>scope?.finish(),
   diagnostics:()=>scope?.diagnostics()||{active:0,transitions:0},dispose};
 }
 return {mount};
});
