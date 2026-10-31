/* The script owns startup and button listeners; the adapter owns story data. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CxxLongMemoryStartup=factory();})(globalThis,function(){
 'use strict';
 async function install({host,api,bundle,chapter,chapters,quests,detection,lines=[]}){
  let closed=false,service,panel,plot,destroyService;const buttons=[];
  const stop=()=>{
   if(closed)return;closed=true;
   for(const [event,handler]of buttons)api.eventRemoveListener(event,handler);
   buttons.length=0;panel?.destroy();destroyService?.();
   if(host.CxxLongMemory===service)delete host.CxxLongMemory;
   if(host.CxxPlot===plot)delete host.CxxPlot;
   api.removeEventListener('pagehide',stop);
  };
  api.addEventListener('pagehide',stop,{once:true});
  try{
   await api.waitGlobalInitialized('Cxx233Runtime');if(closed)return;
   host.CxxLongMemory?.destroy();
   service=api.CxxLongMemoryAdapter.create({api,host,parser:host.Cxx233Runtime.parser,material:api.CxxMemoryMaterial,historyFactory:api.CxxMemoryHistory,bundle});
   destroyService=service.destroy;
   plot=api.CxxMemoryPlot.create({chapter,chapters,quests,detection,lines});
   plot.enabled=()=>!!service.state().story&&service.state().plots;
   plot.story=raw=>service.story(raw).replace(/<cxx-say\b(?=[^>]*\bkind=["']thought["'])[^>]*>[\s\S]*?<\/cxx-say>/gi,'');
   plot.illustrationsAt=(message,floor)=>{
    const stat=message?.variables?.[message.swipe_id||0]?.stat_data;
    if(!stat||message.is_user||message.is_system)return [];
    const variant=message.extra?.cxx_context;
    const pictures=plot.illustrations(stat).filter(p=>{
     const s=p.source;if(!s||!p.url)return false;
     const sameMessage=s.messageId?[message.cxx_context?.messageId,message.cxx_plot_id].includes(s.messageId):s.floor===floor;
     const sameVariant=s.variantId?variant?.variantId===s.variantId:s.swipe===(message.swipe_id||0);
     return sameMessage&&sameVariant;
    });
    if(!pictures.length)return [];
    const raw=host.CxxSource?host.CxxSource.sync(floor):message.mes;
    const body=String(plot.story(raw)||'').replace(/\r\n/g,'\n').replace(/<StatusPlaceHolderImpl\/>/g,'').trim();
    let hash=2166136261;for(const ch of body)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
    return pictures.filter(p=>p.source.story===(hash>>>0).toString(16));
   };
   host.CxxPlot=plot;
   panel=api.CxxMemoryPanel.create({api,host,memory:service,plot,quests:host.CxxQuests});
   service.destroy=stop;service.openPanel=panel.open;host.CxxLongMemory=service.start();
   const bind=(name,fn)=>{const handler=async()=>{if(closed)return;try{await fn();}catch(e){host.toastr?.error(e.message);host.CxxDiagnostics?.report({module:'长期记忆与剧情',stage:'面板操作',message:e.message,detail:e.stack||''});}};const event=api.getButtonEvent(name);buttons.push([event,handler]);api.eventOn(event,handler);};
   bind('长期记忆面板',panel.open);
   bind('长期记忆配置',async()=>{if(host.CxxPlugins&&!await host.CxxPlugins.ensureMemory()||closed)return;await service.install();if(!closed)await service.openSettings();});
   return service;
  }catch(error){stop();throw error;}
 }
 return {install};
});
