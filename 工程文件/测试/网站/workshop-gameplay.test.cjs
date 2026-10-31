'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require("../../网站/gateway/workshop-contract.cjs"),F=require("../../网站/gateway/workshop-gameplay-fixtures.cjs"),P=C.library(),G=require("../../卡片源码/运行时/gameplay.js"),Content=require("../../卡片源码/运行时/content.js");
const identity={publisher_id:'2222222222222222',status:'active'},mapIndex=Object.fromEntries(C.schema().maps.map(m=>[m.id,m.places.map(p=>p.id)]));
function compile(kind,revision=1,id=9){const payload=JSON.stringify(F.payload(kind,revision)),type=C.schema().templates.find(t=>t.id===kind).type;return C.compile({id,revision,type,title:'隔离 '+kind,payload,content_hash:P.sha256(payload),publisher_id:identity.publisher_id,tags:'[]'},identity,P).package;}
for(const form of C.schema().templates.filter(t=>t.id!=='code_component'))test(form.id+' has stable two-version definitions and a real consumer',()=>{
 const a=compile(form.id),b=compile(form.id,2);assert.equal(a.id,b.id);assert.equal(a.version,'1.0.1');assert.equal(b.version,'1.0.2');
 const registry={packages:{[b.id]:{...b,history:{[a.version]:a.content}}}},options={subscriptions:{[a.id]:true},pins:{[a.id]:a.version},mapIndex};
 const choices=Content.storyChoices(registry,options);
 if(form.id==='npc'){assert.equal(choices.npcs[0].name,'隔离 name 1');assert.equal(choices.npcs[0].definitionRef.version,a.version);}
 if(form.id==='user_identity')assert.equal(choices.starts[0].opening,'隔离通用开场 1');
 if(a.content.gameplay){const cat=G.catalogue(registry,options);assert.ok(cat.lists.services.has('ugc_9_heal'));assert.equal(cat.get('items','ugc_9_supply').definitionRef.version,a.version);assert.equal(G.catalogue(registry,{...options,subscriptions:{}}).lists.items.size,0);}
 if(form.type==='contract')assert.equal(a.content.quests[0].id,b.content.quests[0].id);
 P.validateOwnership([a]);P.validateOwnership([b],{format:1,packages:{[a.id]:a}});
});
test('missing references, undeclared fields, executable content, false template and card capabilities are rejected',()=>{
 for(const change of [p=>p.gameplay.shops[0].offers[0].targetId='missing',p=>p.gameplay.items[0].code='ignored()',p=>p.gameplay.items[0].description='<script>x</script>',p=>p.gameplay.services[0].service='teleport',p=>p.gameplay.resources=[],p=>p.gameplay.items[0].id='a'.repeat(80)]){
  const p=F.payload('shop_item');change(p);assert.throws(()=>C.validateSubmission('shop_item',p));
 }
 assert.throws(()=>C.validateSubmission('skill',F.payload('shop_item')));const old=F.payload('user_identity');delete old.opening;assert.throws(()=>C.validateSubmission('user_identity',old));
 const a=compile('shop_item',1,1),b=compile('shop_item',1,2);assert.notEqual(a.content.gameplay.items[0].id,b.content.gameplay.items[0].id);P.validateOwnership([a,b]);
});
test('code proposal is static review data and cannot be compiled to an install package',()=>{
 assert.equal(C.validateSubmission('code_component',F.payload('code_component')).format,1);assert.throws(()=>compile('code_component'),/新版角色卡/);
});
module.exports={compile};
