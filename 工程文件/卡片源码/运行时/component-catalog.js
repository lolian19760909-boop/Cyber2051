(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxComponentCatalog=api;})(globalThis,function(){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 function lookup(components,query=''){const value=String(query).trim().toLowerCase();return structuredClone(components.filter(row=>!value||JSON.stringify(row).toLowerCase().includes(value)));}
 function worldbook(entries,components,sources={}){return entries.map(entry=>({id:entry.id,title:entry.comment,purpose:entry.comment,source:sources[entry.id]||(String(entry.comment).startsWith('[mvu_plot]物品目录：')?'运行时/item-catalog-data.js + 工具/构建/当前/build.cjs':'工具/构建/当前/输入/P4基础卡壳.json'),components:components.filter(c=>c.worldbook?.includes(entry.id)).map(c=>c.id),loading:{enabled:entry.enabled!==false,constant:!!entry.constant,keys:entry.keys||[],secondaryKeys:entry.secondary_keys||[],selective:entry.selective,position:entry.position,order:entry.insertion_order,extensions:structuredClone(entry.extensions||{})}}));}
 return {lookup,worldbook};
});
