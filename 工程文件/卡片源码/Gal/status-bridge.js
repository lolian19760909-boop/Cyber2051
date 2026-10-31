/* Present the chat-owned status instance without depending on a native message node. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxGalStatusBridge=api;})(globalThis,function(){
 'use strict';
 function create({document:doc,onClose}){
  const win=doc.defaultView;let active=null,disposed=false;
  function close(notify=false){
   const e=active;if(!e)return;active=null;
   e.lease.onInvalid=null;e.inner.removeEventListener('keydown',e.keydown);e.button?.remove();e.title?.remove();e.style?.remove();e.unplace?.();
   e.frame.removeAttribute('data-cxx-gal-status');e.surface?.setPresentation?.('native');e.surface?.setExpanded(e.expanded);
   e.lease.release();if(notify)onClose?.();
  }
  function open({messageId,lease}){
   if(disposed||!lease?.valid())throw Error('人物状态已变化，请重新打开。');
   const frame=lease.frame,inner=frame.contentDocument;if(!inner?.getElementById('diary')){lease.release();throw Error('人物状态尚未就绪。');}
   close();const e={frame,inner,lease,messageId,surface:frame.contentWindow?.CxxNativeStatus};active=e;
   try{
    e.expanded=e.surface?.isExpanded();lease.onInvalid=()=>close(true);frame.setAttribute('data-cxx-gal-status','1');
    e.surface?.setPresentation?.('gal');e.surface?.setExpanded(true);
    e.style=inner.createElement('style');e.style.textContent='html,body{margin:0!important;height:auto!important;min-height:0!important;max-width:100%!important;overflow-x:hidden!important;overflow-y:auto!important}body{padding-top:56px!important}.cxx-status-return{position:fixed;right:12px;top:6px;z-index:2147483647;min-height:44px;padding:8px 16px;border:1px solid var(--cxx-red);background:var(--cxx-panel);color:var(--cxx-text);cursor:pointer;font:16px/1.5 var(--cxx-font-ui)}.cxx-status-title{position:fixed;left:12px;top:16px;color:var(--cxx-muted);font:13px/1.5 var(--cxx-font-ui)}';if(frame.dataset.cxxShadow==='1')e.style.textContent+='.cxx-root{height:100%!important;overflow-y:auto!important}.cxx-body{overflow:visible!important}';inner.head.append(e.style);
    e.button=inner.createElement('button');e.button.type='button';e.button.className='cxx-status-return';e.button.textContent='返回对话 ×';e.button.onclick=()=>close(true);
    e.title=inner.createElement('span');e.title.className='cxx-status-title';e.title.textContent='人物状态 · 第 '+messageId+' 楼';inner.body.append(e.title,e.button);
    e.keydown=event=>{if(event.key==='Escape'&&!event.isComposing&&!event.defaultPrevented&&!inner.querySelector('dialog[open]')){event.preventDefault();close(true);}};inner.addEventListener('keydown',e.keydown);
    if(!win.CxxGalViewport)throw Error('Gal 画布尚未就绪。');e.unplace=win.CxxGalViewport.place(frame);e.button.focus({preventScroll:true});return true;
   }catch(error){close();throw error;}
  }
  return {open,close:()=>close(),destroy(){close();disposed=true;},get active(){return Boolean(active);},get messageId(){return active?.messageId??null;}};
 }
 return {create};
});
