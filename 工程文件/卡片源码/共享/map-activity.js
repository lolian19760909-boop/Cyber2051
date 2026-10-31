/* Preserve map documents and functional redraws; decorative frames park in medium/low mode. */
(() => {
 'use strict';
 const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window),tasks=new Map();let next=0,paused=false,disposed=false,inside=false;
 const service=window.parent.Cxx236Preferences||window.parent.parent.Cxx236Preferences,media=matchMedia('(prefers-reduced-motion: reduce)');
 const low=()=>media.matches||service?.device?.()==='mobile'||service?.read().level!=='high';
 function schedule(id,task){if(task.native!==null)return;task.native=request(time=>{task.native=null;if(disposed||paused||!tasks.has(id))return;tasks.delete(id);inside=true;try{task.callback(time);}finally{inside=false;}});}
 function paint(){if(disposed||paused)return;for(const [id,task]of tasks)schedule(id,task);}
 window.requestAnimationFrame=callback=>{const id=++next,task={callback,native:null};tasks.set(id,task);if(!paused&&(!low()||!inside))schedule(id,task);return id;};
 window.cancelAnimationFrame=id=>{const task=tasks.get(id);if(task?.native!==null&&task?.native!==undefined)cancel(task.native);tasks.delete(id);};
 function pause(value){if(disposed)return;paused=Boolean(value);for(const task of tasks.values())if(task.native!==null){cancel(task.native);task.native=null;}if(!paused)paint();}
 const off=service?.subscribe(()=>pause(paused));media.addEventListener('change',paint);
 for(const name of ['pointermove','pointerdown','pointerup','wheel','keydown','input','change','resize'])window.addEventListener(name,paint,{passive:true});
 window.CxxMapActivity={pause,read:()=>({paused,pending:tasks.size,low:low()})};
 window.addEventListener('pagehide',()=>{disposed=true;off?.();media.removeEventListener('change',paint);for(const name of ['pointermove','pointerdown','pointerup','wheel','keydown','input','change','resize'])window.removeEventListener(name,paint);for(const task of tasks.values())if(task.native!==null)cancel(task.native);tasks.clear();},{once:true});
})();
