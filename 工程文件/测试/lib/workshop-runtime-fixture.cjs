'use strict';
const crypto=require('node:crypto'),C=require('../../网站/gateway/workshop-contract.cjs'),{sample}=require('../网站/examples.cjs');
module.exports=function(){
 const P=C.library(),keys=crypto.generateKeyPairSync('ed25519'),keyId='workshop-ui-test',trusted={[keyId]:keys.publicKey.export({type:'spki',format:'der'}).toString('base64')},mapIndex=Object.fromEntries(C.schema().maps.map(m=>[m.id,m.places.map(p=>p.id)]));
 const create=revision=>['npc','user_identity','contract'].map((kind,index)=>{const d=sample(kind),payload=JSON.stringify(d.payload);return C.compile({...d,id:97001+index,revision,title:['验收·林澈','验收·维修学徒','验收·取错的包裹'][index],summary:'本机合成工坊内容 · 修订 '+revision,publisher_id:'3333333333333333',author_name:'隔离验收',tags:JSON.stringify(d.tags),payload,content_hash:P.sha256(payload)},{publisher_id:'3333333333333333',status:'active'},P).package;});
 const first=create(1),second=create(2),release=packages=>P.buildRelease({packages,privateKey:keys.privateKey,keyId,mapIndex});
 return {trusted,mapIndex,first,second,releases:[release(first),release(second),release([])],catalogUrl:'https://cyber2051.top/updates/v3/component-manifest.json'};
};
