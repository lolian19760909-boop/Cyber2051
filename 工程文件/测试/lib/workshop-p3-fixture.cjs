"use strict";
const crypto=require('node:crypto'),C=require('../../网站/gateway/workshop-contract.cjs'),F=require('../../网站/gateway/workshop-gameplay-fixtures.cjs'),P=C.library();
module.exports=function(){
 const keys=crypto.generateKeyPairSync('ed25519'),trusted={p3:keys.publicKey.export({type:'spki',format:'der'}).toString('base64')},mapIndex=Object.fromEntries(C.schema().maps.map(m=>[m.id,m.places.map(p=>p.id)])),forms=C.schema().templates.filter(t=>!['code_component','collection'].includes(t.id));
 function pack(form,id,revision,payload=F.payload(form.id,revision)){
  if(revision===2&&payload.gameplay)payload.gameplay.services[0].cost=3;
  const text=JSON.stringify(payload);return C.compile({id,revision,type:form.type,title:'隔离P3 '+form.id,summary:'逐类消费者验收 '+revision,author_name:'本机合成作者',publisher_id:'p3',tags:'[]',payload:text,content_hash:P.sha256(text)},{publisher_id:'p3',status:'active'},P).package;
 }
 const sets=[1,2].map(revision=>{const packages=forms.map((f,i)=>pack(f,98010+i,revision)),members=packages.map(p=>({submissionId:p.content.worldbook[0].extra.__cxx_workshop_source.submissionId,packageId:p.id,minVersion:p.version})),root=pack({id:'collection',type:'collection'},98099,revision,{format:1,templateVersion:1,templateKind:'collection',sections:{description:'本机P3合集，包含恢复模板与原有三类'},members});return {packages,root};});
 const releases=sets.map(s=>P.buildRelease({packages:[...s.packages,s.root],privateKey:keys.privateKey,keyId:'p3',mapIndex}));
 return {keys,sets,first:sets[0].packages,second:sets[1].packages,releases,trusted,mapIndex,catalogUrl:'https://cyber2051.top/updates/v3/component-manifest.json',policy:{registry:{format:1,packages:{}},initialContent:{quests:[]},mapIndex,trustedKeys:trusted},byKind:kind=>sets[0].packages.find(p=>p.content.worldbook[0].extra.__cxx_workshop_source.templateKind===kind)};
};
