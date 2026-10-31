(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxRelease=api;})(globalThis,function(){
  'use strict';
  const ID='cyber2051.core',UPDATER='cf33c692-7a41-444d-b8b7-6a70163e0104',PROTOCOL=1;
  const copy=x=>JSON.parse(JSON.stringify(x));
  const Safety=typeof module==='object'&&module.exports?require('./release-safety.js'):globalThis.CxxReleaseSafety;
  const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
  function flatten(trees){return trees.flatMap(n=>[n,...(n.type==='folder'?flatten(n.scripts):[])]);}
  function ownership(components){return {worldbook:components.worldbook.entries.map(e=>e.uid),regex:components.regex.scripts.map(e=>e.id),scripts:flatten(components.scripts.trees).map(e=>e.id).filter(id=>id!==UPDATER)};}
  function validate(pack,seed,Core){
    const r=pack.release;
    if(pack.id!==ID||pack.kind!=='core'||pack.optional||r?.protocol!==PROTOCOL||r.updaterId!==UPDATER)fail('invalid-release','不是本卡支持的完整版本包');
    if(Core.compareVersions(seed.baseVersion,r.minBaseVersion)<0)fail('release-base-too-old','请先换到 '+r.minBaseVersion+' 或更新的角色卡，再使用自动更新');
    if(r.saveSchema!==(seed.migration?.saveSchema||1))fail('release-save-migration','此版本改变了存档结构，需要发布者提供对应的存档迁移版本');
    if(typeof r.buildId!=='string'||!r.buildId.startsWith('card:')||!r.seed||typeof r.notes!=='string')fail('invalid-release','版本包缺少构建、更新说明或配套资料');
    if(flatten(pack.components.scripts.trees).some(s=>s.id===UPDATER))fail('updater-replacement','完整版本包不能包含独立更新器');
    if(r.updater!==undefined){const u=r.updater,m=u?.manifest;if(m?.type!=='cyber2051.updater-upgrade'||m.updaterId!==UPDATER||m.version!==pack.version||typeof u.content!=='string'||!/^[a-f0-9]{64}$/.test(m.targetHash||'')||!Array.isArray(m.sources)||m.sources.some(s=>!/^[a-f0-9]{64}$/.test(s.sha256||'')))fail('invalid-updater','独立更新器引导清单无效');}
    if(r.plugins!==undefined&&(!Array.isArray(r.plugins)||r.plugins.some(p=>p.id!=='suite'||!/^\d+\.\d+\.\d+$/.test(p.version)||typeof p.required!=='boolean')))fail('invalid-plugins','插件依赖清单无效');
    const owned=ownership(pack.components);
    for(const values of Object.values(owned))if(new Set(values).size!==values.length)fail('duplicate-id','版本包含重复组件编号');
    if(r.worldbookTransportBaselines!==undefined){
      const rows=r.worldbookTransportBaselines;
      if(!Array.isArray(rows)||rows.length>1000||new Set(rows.map(x=>x?.uid)).size!==rows.length||rows.some(x=>!Number.isSafeInteger(x?.uid)||x.uid<0||!/^[a-f0-9]{16,64}$/.test(x.hash||'')||!/^[a-f0-9]{16,64}$/.test(x.extraHash||'')))fail('invalid-release','旧世界书转换标记基线无效');
    }
    for(const n of pack.components.scripts.trees)if(n.type==='folder'&&n.scripts.some(s=>s.type==='folder'))fail('invalid-release','酒馆助手脚本文件夹不支持嵌套文件夹');
    return pack;
  }
  // A release owns its previous IDs, not every item currently on the player's card.
  // Rebuild official folders from the new tree; lift foreign children out of removed folders.
  function syncTrees(current,incoming,owned){
    const local=new Map(flatten(current).map(s=>[s.id,s])),nextIds=new Set(flatten(incoming).map(s=>s.id));
    for(const id of nextIds)if(local.has(id)&&!owned.has(id))fail('release-id-collision','新增脚本编号与玩家组件重复：'+id);
    function materialize(n){const result=copy(n),old=local.get(n.id);if(n.type==='folder')result.scripts=n.scripts.map(materialize);else if(old?.type==='script')result.data={...(n.data||{}),...(old.data||{})};return result;}
    function foreign(nodes){return nodes.flatMap(n=>{
      if(n.id===UPDATER)return [copy(n)];
      if(owned.has(n.id))return n.type==='folder'?foreign(n.scripts):[];
      const value=copy(n);if(n.type==='folder')value.scripts=foreign(n.scripts);return [value];
    });}
    return [...incoming.map(materialize),...foreign(current)];
  }
  function syncList(current,incoming,owned,key){
    const local=new Set(current.map(e=>e[key]));
    for(const e of incoming)if(local.has(e[key])&&!owned.has(e[key]))fail('release-id-collision','新增组件编号与玩家条目重复：'+e[key]);
    return [...copy(incoming),...copy(current.filter(e=>!owned.has(e[key])))];
  }
  function mergeRegistry(current,incoming,Core){
    const result=copy(current);
    for(const [id,r]of Object.entries(incoming?.packages||{})){
      const old=result.packages[id],history={...(old?.history||{}),...(old?{[old.version]:old.content}:{}),...(r.history||{})};
      const encode=Core?.canonical||JSON.stringify;
      if(old?.version===r.version&&encode(old.content)!==encode(r.content))fail('version-collision','同一内容版本发生变化：'+id);
      delete history[r.version];result.packages[id]={...copy(r),history};
    }
    return result;
  }
  async function plan({pack,sha256,before,state,seed,Core,Host}){
    validate(pack,seed,Core);
    const previous=state.installed?.[ID]?.release?.owned||seed.release?.owned;
    if(!previous)fail('release-baseline-missing','缺少官方组件清单，请从支持完整更新的角色卡开始');
    const currentUpdater=flatten(before.scripts.trees).filter(s=>s.id===UPDATER);
    if(currentUpdater.length!==1||currentUpdater[0].enabled!==true)fail('release-updater-missing','独立更新器必须保持启用');
    const incoming=copy(pack.components);
    incoming.worldbook.entries=incoming.worldbook.entries.map(Host.normalizeEntry);
    function norm(nodes){return nodes.map(n=>n.type==='folder'?{icon:'fa-solid fa-folder',color:'#9ccbd0',...n,scripts:norm(n.scripts)}:Host.normalizeScript(n));}
    incoming.scripts.trees=norm(incoming.scripts.trees);
    const baseline=state.baseline?.worldbook?state.baseline:seed.baseline;
    if(!baseline?.worldbook||!baseline?.scripts)fail('release-baseline-missing','缺少可核对的官方内容指纹，停止安装以保留玩家修改');
    let safe=await Safety.prepare({previous,before,incoming,baseline,groups:pack.release.groups,worldbookTransportBaselines:pack.release.worldbookTransportBaselines,Core,updaterId:UPDATER});
    const registry=mergeRegistry(before.registry,pack.release.seed.registry,Core);
    // Registry and its consumers must advance together. Without a separately
    // versioned data adapter a registry change is an atomic program release.
    if(safe.blocked.length&&Core.canonical(registry)!==Core.canonical(before.registry))safe=await Safety.prepare({previous,before,incoming,baseline,worldbookTransportBaselines:pack.release.worldbookTransportBaselines,Core,updaterId:UPDATER});
    const after={...safe.after,registry:safe.blocked.length?copy(before.registry):registry};
    // Keep the updater at its existing top-level index. Its content/data never come from the package.
    const stable=after.scripts.trees.findIndex(s=>s.id===UPDATER),oldIndex=before.scripts.trees.findIndex(s=>s.id===UPDATER);
    if(stable>=0&&oldIndex>=0)after.scripts.trees.splice(Math.min(oldIndex,after.scripts.trees.length-1),0,...after.scripts.trees.splice(stable,1));
    const installed=copy(state.installed);
    const releaseProgress=safe.blocked.length?{targetVersion:pack.version,sha256,completedGroups:safe.completed,blockedGroups:safe.blocked,skipped:safe.conflicts}:null;
    if(releaseProgress){
      const old=installed[ID]||seed.installed?.[ID]||{version:seed.baseVersion,kind:'core'};
      installed[ID]={...copy(old),release:{...(old.release||{}),owned:safe.owned,buildId:old.release?.buildId||seed.migration.buildId,saveSchema:seed.migration.saveSchema,seed:copy(old.release?.seed||{registry:seed.registry,migration:seed.migration}),releaseProgress}};
    }else{
      installed[ID]={version:pack.version,sha256,kind:'core',requires:copy(pack.requires),release:{owned:safe.owned,buildId:pack.release.buildId,saveSchema:pack.release.saveSchema,seed:copy(pack.release.seed)}};
      for(const [id,r]of Object.entries(pack.release.seed.registry?.packages||{}))installed[id]={version:r.version,kind:'content'};
    }
    return {before,after,installed,baseline:safe.baseline,conflicts:safe.conflicts,counts:safe.counts,releaseProgress,componentPackages:state.componentPackages||{}};
  }
  return {ID,UPDATER,PROTOCOL,flatten,ownership,validate,plan,syncTrees,syncList,mergeRegistry,rollback:args=>Safety.rollback({...args,updaterId:UPDATER})};
});
