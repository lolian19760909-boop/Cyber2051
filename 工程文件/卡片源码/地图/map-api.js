/* Public view contract; scene replacement never changes this interface. */
(()=>{
 'use strict';
 const listeners=new Set();let disposed=false;
 const read=()=>window.TOKYO_ATLAS_VIEW?.read();
 const emit=()=>{if(disposed)return;const view=read(),close=document.getElementById('detail-close');if(close){close.textContent=innerWidth<=680&&view?.state.selection?.kind==='node'?'返回地图':'×';close.setAttribute('aria-label','返回地图');}for(const fn of listeners)fn(view,document.getElementById('detail-body'));};
 window.addEventListener('atlas-selection-changed',emit);
 window.addEventListener('atlas-scene-ready',emit);
 const api=window.TOKYO_ATLAS_API={read,restore:value=>window.TOKYO_ATLAS_VIEW?.restore(value),
  focus(id){const d=window.TOKYO_ATLAS,places=[...d.nodes,...d.services,...d.districtExpansion.places,...d.terrainContext.places];if(!places.some(p=>p.id===id)||parent.CxxAtlasTool?.visible?.(id)===false)return false;window.TOKYO_ATLAS_NAV.focusNode(id);return true;},
  refresh(){window.TOKYO_ATLAS_VIEW?.restore(read());},
  subscribe(fn){listeners.add(fn);fn(read(),document.getElementById('detail-body'));return()=>listeners.delete(fn);},
  pause(value){window.CxxMapActivity?.pause(value);window.CxxAtlasFeedback?.pause(value);},
  escape(){const root=document.getElementById('atlas'),detail=document.getElementById('detail');if(!root.classList.contains('index-open')&&detail.hidden)return false;root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));return true;},
  destroy(){if(disposed)return;disposed=true;listeners.clear();window.removeEventListener('atlas-selection-changed',emit);window.removeEventListener('atlas-scene-ready',emit);window.TOKYO_ATLAS_UNMOUNT?.();window.CxxAtlasFeedback?.destroy();window.CxxAtlasGPU?.destroy();}
 };
 window.addEventListener('pagehide',e=>{if(!e.persisted)api.destroy();});
})();
