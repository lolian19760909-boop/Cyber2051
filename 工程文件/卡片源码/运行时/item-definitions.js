/* Definition identity is shared by saved inventory, numeric effects and content sync. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxItemDefinitions=api;})(globalThis,function(root){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const same=(a,b)=>a===b||!!(a&&b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k])));
  let formal=null;
  function resolve(state,id,ref,{registry,official=formal}={}){
    if(ref&&(ref.kind!=='items'||ref.id!==id))throw Error('物品原定义引用不一致：'+id);
    const saved=state?.itemDefinitions?.[id];
    if(saved){if(saved.id!==id||ref&&!same(ref,saved.definitionRef))throw Error('物品原定义版本不匹配：'+id);return saved;}
    if(official){let d;try{d=official(id);}catch{}if(d&&d.id===id&&(!ref||same(ref,d.definitionRef)))return d;}
    if(!ref)return null;
    registry=registry||(root.parent||root).Cxx233Updater?.host?.readState?.().registry;
    const record=registry?.packages?.[ref.packageId],content=record&&(record.version===ref.version?record.content:record.history?.[ref.version]);
    const d=content?.gameplay?.items?.find(row=>row.id===id);
    return d?{...structuredClone(d),definitionRef:structuredClone(ref)}:null;
  }
  return {resolve,same,registerOfficial(provider){formal=provider;}};
});
