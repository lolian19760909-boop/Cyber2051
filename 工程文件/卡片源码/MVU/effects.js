/* All decorative work subscribes to the same chat preference. Functional timers are untouched. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.Cxx236Effects=value;})(globalThis,function(){
 'use strict';
 function effective(selected,reduced,visible,device='desktop'){return !visible?'paused':reduced?'low':device==='mobile'&&selected==='high'?'medium':selected;}
 function create({win,preferences}){
  const media=win.matchMedia('(prefers-reduced-motion: reduce)'),subscribers=new Set();let ended=false;
  const read=()=>({selected:preferences.read().level,device:preferences.device?.()||'desktop',reduced:media.matches,visible:win.document.visibilityState!=='hidden'});
  const changed=()=>{if(!ended)for(const fn of subscribers)fn(read());};
  const off=preferences.subscribe(changed);media.addEventListener('change',changed);win.document.addEventListener('visibilitychange',changed);
  function attach(child,{parentSurface=false}={}){
   const doc=child.document,tasks=new Set(),timeouts=new Map(),frame=child.frameElement;let active=true,intersecting=true,disposed=false,tier='medium';
   const style=doc.createElement('style');style.dataset.cxxEffects='236';
   const base=parentSurface?'#cxx-galgame-root':'html';
   style.textContent=`${base}[data-cxx-effects="low"] *,${base}[data-cxx-effects="low"] *::before,${base}[data-cxx-effects="low"] *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition:none!important;scroll-behavior:auto!important}${base}[data-cxx-effects="paused"] *,${base}[data-cxx-effects="paused"] *::before,${base}[data-cxx-effects="paused"] *::after{animation-play-state:paused!important}${base}[data-cxx-effects="low"] .heart-p{display:none!important}`;
   // CSS also covers decorations created after attach; no animation scan or
   // recurring timer is needed to keep newly mounted mobile pages still.
   style.textContent+=`${base}[data-cxx-device="mobile"] *,${base}[data-cxx-device="mobile"] *::before,${base}[data-cxx-device="mobile"] *::after{animation:none!important}`;
   const scrollSurfaces=parentSurface?['#cxx-galgame-root','#cxx-galgame-root *','#cxx-first-settings-236','#cxx-first-settings-236 *']:['html','html *'];
   style.textContent+=`${scrollSurfaces.join(',')}{scrollbar-width:thin;scrollbar-color:#68717f #0c0f12;color-scheme:dark}${scrollSurfaces.map(s=>s+'::-webkit-scrollbar').join(',')}{width:7px;height:7px}${scrollSurfaces.map(s=>s+'::-webkit-scrollbar-track').join(',')}{background:#0c0f12}${scrollSurfaces.map(s=>s+'::-webkit-scrollbar-thumb').join(',')}{background:#68717f;border:2px solid #0c0f12;border-radius:8px}${scrollSurfaces.map(s=>s+'::-webkit-scrollbar-thumb:hover').join(',')}{background:#e45072}${scrollSurfaces.map(s=>s+'::-webkit-scrollbar-button').join(',')}{display:none}${scrollSurfaces.map(s=>s+'::-webkit-scrollbar-corner').join(',')}{background:#0c0f12}`;
   style.textContent+=`@supports selector(::-webkit-scrollbar){${scrollSurfaces.join(',')}{scrollbar-width:auto!important;scrollbar-color:auto!important}}`;
   doc.head.append(style);
   function surfaceVisible(){if(!active||!intersecting)return false;if(parentSurface)return Boolean(doc.querySelector('#cxx-galgame-root'));if(frame?.hidden)return false;if(frame?.hasAttribute('data-cxx-gal-status')||frame?.hasAttribute('data-cxx-gal-opening'))return true;if(frame?.dataset.cxxVisible==='0')return false;if(doc.documentElement.hasAttribute('data-cxx-native-status'))return doc.documentElement.getAttribute('data-cxx-status-open')==='1';const terminal=doc.getElementById('t2051x-terminal');if(terminal)return !terminal.hidden;return true;}
   function reschedule(task){if(task.timer!==null)child.clearInterval(task.timer);task.timer=null;if(tier==='low'||tier==='paused'||read().device==='mobile')return;task.timer=child.setInterval(task.fn,task.ms*(tier==='medium'?2:1));}
   function update(){if(disposed)return;const v=read(),next=effective(v.selected,v.reduced,v.visible&&surfaceVisible(),v.device);const target=parentSurface?doc.querySelector('#cxx-galgame-root'):doc.documentElement,changed=next!==tier||target?.getAttribute('data-cxx-device')!==v.device;if(!changed&&target?.getAttribute('data-cxx-effects')===next)return;tier=next;target?.setAttribute('data-cxx-effects',tier);target?.setAttribute('data-cxx-device',v.device);if(changed)for(const task of tasks)reschedule(task);
    // Pause sustained CSS effects in medium; leave short entrance and operation feedback intact.
    for(const animation of target?.getAnimations?.({subtree:true})||[]){if(animation.effect?.getComputedTiming?.().iterations===Infinity){if(tier!=='high'){if(animation.playState==='running'){animation.pause();animation.__cxxPaused236=true;}}else if(animation.__cxxPaused236){animation.__cxxPaused236=false;animation.play();}}}
    if(tier==='low'||tier==='paused'){for(const [id,fn]of timeouts){child.clearTimeout(id);fn();}timeouts.clear();}
    child.dispatchEvent(new child.Event('cxx-effects-change'));
   }
   function repeat(fn,ms){const task={fn,ms,timer:null};tasks.add(task);reschedule(task);return()=>{if(task.timer!==null)child.clearInterval(task.timer);tasks.delete(task);};}
   const observer=new child.MutationObserver(records=>{if(records.some(r=>r.type==='childList'||(r.attributeName!=='data-cxx-effects'&&r.attributeName!=='style')))update();});
   function ready(){observer.observe(parentSurface?doc.body:doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','data-cxx-status-open','data-cxx-gal-active']});update();}
   const visibility=frame&&win.IntersectionObserver?new win.IntersectionObserver(entries=>{for(const entry of entries)if(entry.target===frame)intersecting=entry.isIntersecting;update();}):null;visibility?.observe(frame);
   subscribers.add(update);if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
   const api={repeat,after(fn,ms){if(tier==='low'||tier==='paused'){fn();return;}const id=child.setTimeout(()=>{timeouts.delete(id);fn();},ms);timeouts.set(id,fn);},update,setVisible(value){active=value;update();},get tier(){return tier;},destroy(){if(disposed)return;disposed=true;subscribers.delete(update);observer.disconnect();visibility?.disconnect();doc.removeEventListener('DOMContentLoaded',ready);for(const task of tasks)if(task.timer!==null)child.clearInterval(task.timer);for(const [id,fn]of timeouts){child.clearTimeout(id);fn();}timeouts.clear();tasks.clear();style.remove();if(child.Cxx236Motion===api)delete child.Cxx236Motion;}};child.Cxx236Motion=api;return api;
  }
  return {read,attach,destroy(){ended=true;off();media.removeEventListener('change',changed);win.document.removeEventListener('visibilitychange',changed);subscribers.clear();}};
 }
 return {effective,create};
});
