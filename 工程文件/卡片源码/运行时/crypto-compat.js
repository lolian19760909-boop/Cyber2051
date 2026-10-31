(function(root,factory){const api=factory(root,typeof module==='object'&&module.exports?require('../共享/vendor/js-sha256/sha256.js'):root.CxxSha256);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxCrypto=api;})(globalThis,function(root,SHA){
 'use strict';
 const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
 const read=fn=>{try{return fn();}catch{return undefined;}};
 function create(provider=root.crypto){
  const subtle=read(()=>provider?.subtle);
  const capabilities=()=>({secureContext:typeof root.isSecureContext==='boolean'?root.isSecureContext:null,nativeDigest:typeof read(()=>subtle?.digest)==='function',nativeUUID:typeof read(()=>provider?.randomUUID)==='function',randomValues:typeof read(()=>provider?.getRandomValues)==='function',signature:typeof read(()=>subtle?.importKey)==='function'&&typeof read(()=>subtle?.verify)==='function'});
  async function digest(bytes){
   if(capabilities().nativeDigest){try{return await subtle.digest('SHA-256',bytes);}catch{/* A blocked native digest can use the same unkeyed SHA-256 algorithm. */}}
   if(!SHA?.arrayBuffer)fail('crypto-hash-unavailable','本地校验模块未加载，请重新加载角色卡脚本。');
   // ArrayBuffer constructors differ between the helper iframe and its host.
   const input=ArrayBuffer.isView(bytes)?new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength):new Uint8Array(bytes,0,Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get.call(bytes));
   return SHA.arrayBuffer(input);
  }
  function randomUUID(){
   if(capabilities().nativeUUID){try{return provider.randomUUID();}catch{/* Some WebViews expose a method that throws when called. */}}
   if(!capabilities().randomValues)fail('crypto-random-unavailable','当前脚本环境缺少安全随机数功能，无法创建保存记录。请更换浏览器后重试。');
   const bytes=new Uint8Array(16);
   try{provider.getRandomValues(bytes);}catch{fail('crypto-random-unavailable','浏览器拒绝生成安全随机数，未创建保存记录。请更换浏览器后重试。');}
   bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
   const hex=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
   return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }
  return {digest,randomUUID,subtle,capabilities};
 }
 return {create,digest:(bytes,provider)=>create(provider).digest(bytes),uuid:provider=>create(provider).randomUUID()};
});
