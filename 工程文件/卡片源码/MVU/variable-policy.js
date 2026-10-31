(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.Cxx236VariablePolicy=value;})(globalThis,function(){
 'use strict';
 function create({api,win,content}){return function(){
  const seed=win.Cxx233Updater?.readSeed?.()||api.getVariables({type:'script'}).__cxx_update_seed;if(!seed)throw Error('本卡变量定义尚未就绪。');
  const registry=win.Cxx233Updater?.host?.readState()?.registry||seed.registry;
  const plot=win.CxxPlot?.enabled()?win.CxxPlot:null;
  function quest(id,record={}){if(plot?.owns(id))return plot.definition(id);const ref=record.definitionRef;if(ref){const pack=registry?.packages?.[ref.packageId],data=content.packageContent(pack,ref.version);return ref.questId===id?data?.quests?.find(q=>q.id===id):null;}return seed.initialContent.quests.find(q=>q.id===id);}
  const variables=api.getVariables({type:'chat'})||{},context=api.SillyTavern.getContext();
  const latest=context.chat?.findLast(m=>m.is_user&&!m.is_system),current=win.Cxx233Updater?.host?.getContext();
  const record=Object.values(variables.__cxx_gameplay_actions?.records||{}).find(r=>r.status==='submitted'&&r.ticket?.context.characterKey===current?.characterKey&&r.ticket?.context.chatId===current?.chatId&&['growth-initialize','talent-allocate'].includes(r.ticket?.plan.request.action)&&latest?.mes?.includes('[东京都2051正文行动 '+r.id+']'));
  return {plot,mapIndex:seed.mapIndex,questDefinition:quest,questRegistered:(id,record)=>!!quest(id,record),questPays:(id,record)=>Number(quest(id,record)?.pay)||0,growthIdentity:variables.__cxx_identity,growthAction:record?.ticket};
 };}
 return {create};
});
