import {createMotion} from './shared/visual/runtime/motion.mjs';
const root=document.documentElement,motion=createMotion({settings:()=>({enabled:root.dataset.motion!=='off',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches})});
const scope=motion.mount(document.body,{keyboard:()=>root.dataset.input==='keyboard'});
window.CxxWorkshopMotion=scope;
document.addEventListener('pointerdown',event=>{const button=event.target.closest('button,.btn');if(button)scope.feedback(button);});
window.addEventListener('pagehide',()=>motion.dispose(),{once:true});
