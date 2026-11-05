(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxOpeningTemplates=api;})(globalThis,function(){
 'use strict';
 const databaseName='cxx2051-opening-templates';
 function create({indexedDB,scope}){
  if(!indexedDB?.open||typeof scope!=='string'||!scope)throw Error('本地开局方案存储尚未就绪。');
  let connection=null,loading=null,closed=false;
  function db(){
   if(closed)return Promise.reject(Error('开局方案窗口已关闭。'));if(connection)return Promise.resolve(connection);if(loading)return loading;
   loading=new Promise((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>{const table=request.result.createObjectStore('templates',{keyPath:['scope','id']});table.createIndex('scope','scope');};request.onerror=()=>{loading=null;reject(request.error);};request.onsuccess=()=>{loading=null;if(closed){request.result.close();reject(Error('开局方案窗口已关闭。'));return;}connection=request.result;connection.onversionchange=()=>{connection.close();connection=null;};resolve(connection);};});return loading;
  }
  async function transaction(mode,operation){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('templates',mode),request=operation(tx.objectStore('templates'));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||request.error||Error('本地开局方案操作失败。'));});}
  function recordId(id){if(typeof id!=='string'||!/^template_[a-z0-9-]+$/i.test(id))throw Error('开局方案编号无效。');return id;}
  return {
   async list(){const rows=await transaction('readonly',table=>table.index('scope').getAll(scope));return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
   async save({id,name,configuration}){name=String(name||'').trim();if(!name||name.length>80)throw Error('请填写80字以内的方案名称。');if(configuration?.schema!==1||!configuration.choices)throw Error('开局方案版本无效。');id=id?recordId(id):'template_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));const row={schema:1,scope,id,name,configuration,updatedAt:new Date().toISOString()};await transaction('readwrite',table=>table.put(row));return row;},
   async remove(id){await transaction('readwrite',table=>table.delete([scope,recordId(id)]));},
   close(){closed=true;connection?.close();connection=null;},
  };
 }
 return {create,databaseName};
});
