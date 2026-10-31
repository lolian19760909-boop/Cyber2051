/* Short selection feedback only; no idle render loop. */
(()=>{
 'use strict';let selection='',frame=0,animation=null,ring=null,paused=false,disposed=false;
 function stop(){cancelAnimationFrame(frame);frame=0;animation?.cancel();animation=null;ring?.remove();ring=null;}
 function changed(){const current=window.TOKYO_ATLAS_VIEW?.read()?.state?.selection,key=current?.kind+':'+current?.id;if(key===selection)return;selection=key;stop();if(paused||disposed||document.hidden||document.documentElement.dataset.motion==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches||current?.kind!=='node')return;
  frame=requestAnimationFrame(()=>{frame=0;const target=document.querySelector('.poi[data-node="'+CSS.escape(current.id)+'"]');if(!target||target.hidden)return;ring=document.createElement('span');ring.className='poi-selection-ring';ring.setAttribute('aria-hidden','true');target.append(ring);const effect=ring.animate([{transform:'scale(.75)',opacity:.9},{transform:'scale(1.65)',opacity:0}],{duration:520,easing:'cubic-bezier(.2,.6,.3,1)'});animation=effect;effect.finished.then(()=>{if(animation===effect)stop();}).catch(()=>{});});
 }
 window.addEventListener('atlas-selection-changed',changed);
 const visibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',visibility);
 window.CxxAtlasFeedback={pause(value){paused=Boolean(value);if(paused)stop();},destroy(){disposed=true;stop();window.removeEventListener('atlas-selection-changed',changed);document.removeEventListener('visibilitychange',visibility);}};
})();
