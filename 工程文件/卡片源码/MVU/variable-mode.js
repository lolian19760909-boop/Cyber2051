(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxVariableMode=value;})(globalThis,function(){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const modeOf=e=>e.extra?.__cxx_variable_mode||(e.name==='变量输出格式 · 正文解析'?'main':e.name==='[mvu_update]变量输出格式 · 额外解析'?'extra':null);
 const names={main:'随AI输出',extra:'额外模型解析'},labels={main:'正文解析',extra:'额外解析'};
 const isConfig=e=>e.name.trim().toLowerCase()==='[config_override]';
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 function mergeConfig(first,later){const out={...later,...first};for(const key of Object.keys(first))if(object(first[key])&&object(later[key]))out[key]=mergeConfig(first[key],later[key]);return out;}
 function create({api,top}){
  const ctx=()=>api.SillyTavern.getContext(),scope=()=>JSON.stringify([ctx().characters?.[ctx().characterId]?.avatar,api.getCharWorldbookNames('current').primary]);
  const stops=[];let mode=ctx().extensionSettings?.mvu_settings?.更新方式==='额外模型解析'?'extra':'main',flight=null,ended=false,error='',loadedScope='',off,deferred=null,modeLease=false;
  const listeners=new Set(),read=()=>({mode,label:labels[mode],busy:!!flight,error,ready:!!loadedScope&&loadedScope===scope()&&!error});
  const emit=()=>{for(const fn of listeners)fn(read());top.dispatchEvent(new top.CustomEvent('cxx-variable-mode-changed',{detail:read()}));};
  async function ensureBook(book,guard){
   if(!api.getWorldbookNames||api.getWorldbookNames().includes(book))return;
   await ctx().updateWorldInfoList?.();guard();if(api.getWorldbookNames().includes(book))return;
   const c=ctx(),embedded=c.characters?.[c.characterId]?.data?.character_book;
   if(embedded?.name!==book||!embedded.entries?.length||!c.convertCharacterBook||!c.saveWorldInfo)throw Error('绑定世界书“'+book+'”尚未导入，请导入这张卡的内置世界书。');
   await c.saveWorldInfo(book,c.convertCharacterBook(structuredClone(embedded)),true);guard();await c.updateWorldInfoList?.();guard();
   if(!api.getWorldbookNames().includes(book))throw Error('内置世界书写入后未找到“'+book+'”，请重试。');
  }
  function installing(){const u=top.Cxx233Updater;return !!(u?.activity?.().running&&!modeLease||u?.host?.readState?.().journalName);}
  function defer(){if(deferred||ended)return;deferred=setTimeout(()=>{deferred=null;if(!ended)void sync().catch(()=>{});},500);}
  async function sync(choice){if(flight){if(!choice)return flight;const waitingScope=scope();try{await flight;}catch{}if(ended||waitingScope!==scope())throw Error('角色已切换，变量设置停止。');return sync(choice);}if(!choice&&(top.Cxx233Updater?.host?.getContext?.().busy||top.Cxx233Updater?.activity?.().saveRunning||top.Cxx233Updater?.activity?.().storyOperations)){defer();return read();}if(installing()){if(choice)throw Error('组件正在更新，请完成后再切换变量模式。');defer();return read();}const owner=scope();const guard=()=>{if(ended||owner!==scope())throw Error('角色已切换，变量设置停止。');if(installing())throw Error('组件开始更新，变量设置已暂停。');};
   const work=async()=>{modeLease=true;try{const book=api.getCharWorldbookNames('current').primary;if(!book)throw Error('当前角色尚未绑定世界书。');await ensureBook(book,guard);const rows=await api.getWorldbook(book);guard();const configs=rows.filter(isConfig),config=configs[0];let override={};for(const entry of configs){let parsed;try{parsed=JSON.parse(entry.content||'{}');if(!object(parsed))throw Error('需要 JSON 对象');}catch(e){throw Error('MVU 配置条目 '+entry.uid+' 无法读取：'+e.message);}override=mergeConfig(override,parsed);}
    const selected=choice||((override.更新方式||ctx().extensionSettings?.mvu_settings?.更新方式)==='额外模型解析'?'extra':'main');
    if(!names[selected])throw Error('请选择正文解析或额外解析。');
    if(!rows.some(e=>modeOf(e)==='main')||!rows.some(e=>modeOf(e)==='extra'))throw Error('本卡两套变量规则尚未加载，请完成本版导入。');
    const next=rows.map(e=>{const group=modeOf(e);if(group)return {...e,enabled:group===selected};if(e===config)return {...e,name:'[config_override]',enabled:false,content:JSON.stringify({...override,更新方式:names[selected],额外模型解析配置:{...override.额外模型解析配置,启用自动请求:selected==='extra'&&(choice?true:(override.额外模型解析配置?.启用自动请求??ctx().extensionSettings?.mvu_settings?.额外模型解析配置?.启用自动请求??true))}},null,2)};if(isConfig(e))return {...e,name:'旧变量配置（已合并）',enabled:false};return e;});
    if(!config)throw Error('本卡缺少 MVU 角色配置条目。');
    if(JSON.stringify(rows)!==JSON.stringify(next)){
     const host=top.Cxx233Updater?.host,c=ctx();
     const readRaw=host?.readRawBook?()=>host.readRawBook(book):c.loadWorldInfo?()=>c.loadWorldInfo(book):null;
     const writeRaw=host?.writeRawBook?value=>host.writeRawBook(book,value,host.getContext(),true):c.saveWorldInfo?value=>c.saveWorldInfo(book,value,true):null;
     if(!readRaw||!writeRaw)throw Error('世界书原始保存接口尚未就绪，请稍后重试。');
     const prior=structuredClone(await readRaw());guard();const value=structuredClone(prior);
     for(let i=0;i<rows.length;i++){
      const before=rows[i],after=next[i],raw=value.entries?.[String(before.uid)];
      if(!raw||raw.uid!==before.uid||raw.content!==before.content||raw.comment!==before.name||!raw.disable!==before.enabled)throw Error('世界书已被其他操作修改，请重新选择变量模式。');
      if(after.content!==before.content)raw.content=after.content;
      if(after.name!==before.name)raw.comment=after.name;
      if(after.enabled!==before.enabled)raw.disable=!after.enabled;
     }
     // One raw write: a Helper replacement first would temporarily strip metadata
     // and emit WORLDINFO_UPDATED before the old merge could put it back.
     if(JSON.stringify(await readRaw())!==JSON.stringify(prior))throw Error('世界书已被其他操作修改，请重新选择变量模式。');guard();
     await writeRaw(value);guard();
     if(JSON.stringify(await readRaw())!==JSON.stringify(value))throw Error('变量模式世界书保存读回不一致，请重试。');guard();
    }
    const actual=await api.getWorldbook(book);guard();if(actual.filter(isConfig).length!==1||actual.filter(e=>modeOf(e)&&e.enabled).length!==1||actual.find(e=>modeOf(e)===selected)?.enabled!==true||JSON.parse(actual.find(isConfig).content).更新方式!==names[selected])throw Error('变量模式读回不一致，请重试。');
    mode=selected;loadedScope=owner;error='';top.CxxDiagnostics?.resolve(r=>r.module==='变量模式'&&r.context.character===ctx().characters?.[ctx().characterId]?.avatar);return read();
   }finally{modeLease=false;}};
   const lease=top.Cxx233Updater?.host?.withLock;flight=(lease?lease(work,{waitForIdle:true}):work()).catch(e=>{error=e.message;loadedScope='';top.CxxDiagnostics?.report({module:'变量模式',stage:'保存',message:error,detail:e.stack||'',level:'error'});throw e;}).finally(()=>{flight=null;emit();});emit();return flight;
  }
  const service={read,ready:()=>loadedScope===scope()?Promise.resolve(read()):sync(),select:choice=>{if(api.builtin?.duringGenerating?.())return Promise.reject(Error('请等本轮正文和变量处理结束后切换。'));return sync(choice);},subscribe(fn){listeners.add(fn);fn(read());return()=>listeners.delete(fn);},start(){top.CxxVariableMode=service;const event=ctx().eventTypes?.CHAT_CHANGED;if(event){const changed=()=>{if(loadedScope!==scope())void sync().catch(()=>{});};api.eventOn(event,changed);off=()=>api.eventRemoveListener(event,changed);}const updated=ctx().eventTypes?.WORLDINFO_UPDATED;if(updated){const changed=name=>{if(!flight&&name===api.getCharWorldbookNames('current').primary){loadedScope='';if(installing())defer();else void sync().catch(()=>{});}};api.eventOn(updated,changed);stops.push(()=>api.eventRemoveListener(updated,changed));}void sync().catch(()=>{});return service;},destroy(){ended=true;if(deferred)clearTimeout(deferred);off?.();stops.forEach(fn=>fn());listeners.clear();if(top.CxxVariableMode===service)delete top.CxxVariableMode;}};return service;
 }
 return {create,names,labels};
});
