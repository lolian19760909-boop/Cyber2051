'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const P = require("../../工具/发布/packages.cjs");
const C = require("../../网站/gateway/workshop-contract.cjs");
const { createWorkshopBridge } = require("../../网站/gateway/workshop-bridge.cjs");
function draft() { return { format:1, contract:{ fixer:'本地合成联系人', type:'调查', difficulty:'低', pay:1000, mapId:'tokyo-central', placeId:'plaza', brief:'合成验收委托，调查霓虹招牌。', goal:'核对地图地点。', prerequisites:['q01'] } }; }
function row(id = 1, revision = 1) { const payload = JSON.stringify(draft()); return { id, revision, type:'contract', publisher_id:'2222222222222222', title:'合成测试委托', summary:'非正式剧情', author_name:'测试署名', tags:'[]', payload, content_hash:P.sha256(payload) }; }
const identity = { publisher_id:'2222222222222222', display_name_last:'合成账号显示名', status:'active' };
test('compiled optional package has stable IDs and signed provenance; revision1 starts1.0.1', () => {
  const a=C.compile(row(),identity,P), b=C.compile(row(1,2),identity,P);
  assert.equal(a.package.id,'community.contract.1');assert.equal(a.package.version,'1.0.1');assert.equal(b.package.version,'1.0.2');
  assert.equal(a.package.content.quests[0].id,b.package.content.quests[0].id);assert.equal(a.package.content.worldbook[0].uid,b.package.content.worldbook[0].uid);
  assert.equal(a.package.optional,true);assert.equal(a.package.activation,'opt_in');assert.equal(a.source.publisherId,identity.publisher_id);assert.equal(a.source.displayName,identity.display_name_last);
  assert.deepEqual(a.package.content.worldbook[0].extra.__cxx_workshop_source,a.source);
  const keys=crypto.generateKeyPairSync('ed25519'), signed=P.signDocument(a.package,keys.privateKey,'test.key');P.verifyDocument(signed,{'test.key':keys.publicKey});
  signed.content.worldbook[0].extra.__cxx_workshop_source.revision=50;
  assert.throws(()=>P.verifyDocument(signed,{'test.key':keys.publicKey}),/签名/);
});
test('contract rejects executable text, authority fields, invented maps, malformed rewards and prerequisites', () => {
  for (const text of ['<% alert(1) %>','<script>alert(1)</script>','javascript:alert(1)']) { const v=draft();v.contract.brief=text;assert.throws(()=>C.validate(v),/非执行文本/); }
  for (const [key,value] of [['placeId','unknown-place'],['mapId','dlc-map'],['pay',-1],['pay',1.5],['pay',Infinity],['pay',10000001],['prerequisites',['q01','q01']],['prerequisites',['foreign.task']],['script','alert(1)'],['publisherId','forged']]) { const v=draft();v.contract[key]=value;assert.throws(()=>C.validate(v)); }
  assert.throws(()=>C.validate(JSON.parse('{"format":1,"contract":{},"__proto__":{}}')));
  assert.throws(()=>C.validateMetadata({title:'<% x %>',summary:'',tags:[]}));
});
test('compiler refuses altered original bytes or wrong/banned owner', () => {
  assert.throws(()=>C.compile({...row(),content_hash:'0'.repeat(64)},identity,P),/指纹/);
  assert.throws(()=>C.compile(row(),{...identity,publisher_id:'different'},P),/身份/);
  assert.throws(()=>C.compile(row(),{...identity,status:'banned'},P),/身份/);
});
test('immutable artifact preserves owner snapshot and refuses metadata mutation within a revision', () => {
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE publishers(publisher_id TEXT,status TEXT,display_name_last TEXT)');db.prepare('INSERT INTO publishers VALUES(?,?,?)').run(identity.publisher_id,identity.status,identity.display_name_last);
    const bridge=createWorkshopBridge({db,modulePath:require.resolve("../../工具/发布/packages.cjs")});
    const a=bridge.ensureArtifact(row());assert.deepEqual(bridge.ensureArtifact(row()),a);
    db.prepare('UPDATE publishers SET display_name_last=?').run('之后修改的显示名');assert.deepEqual(bridge.ensureArtifact(row()),a);
    assert.throws(()=>bridge.ensureArtifact({...row(),title:'同revision改标题'}),/变化/);
    const old=bridge.getArtifact(1,1), newer=bridge.ensureArtifact(row(1,2));assert.deepEqual(bridge.getArtifact(1,1),old);assert.equal(newer.source.displayName,'之后修改的显示名');
    const tamper=JSON.parse(JSON.stringify(a));tamper.package.content.quests[0].pay=999999;
    db.prepare('UPDATE workshop_contract_packages SET artifact=? WHERE revision=1').run(JSON.stringify(tamper));assert.throws(()=>bridge.getArtifact(1,1),/损坏/);
  } finally {db.close();}
});
module.exports={draft};
test('all guided templates compile to existing consumers and bind only known map locations',()=>{
  const forms=C.schema().templates.filter(t=>['contract','world_factor','character','user_identity'].includes(t.type));
  for(const form of forms){let payload;if(form.type==='contract'){payload=draft();if(form.id==='side_story')payload.templateKind='side_story';}
   else{payload={format:1,templateKind:form.id,mapId:'tokyo-central',placeId:'beni-street',keywords:['合成关键词']};for(const [field,,required]of form.fields)if(required)payload[field]='静态测试内容';}
   const r={...row(),type:form.type,payload:JSON.stringify(payload)};r.content_hash=P.sha256(r.payload);const a=C.compile(r,identity,P);
   assert.equal(a.package.kind,'content');assert.equal(a.package.optional,true);assert.equal(a.package.activation,'opt_in');assert.equal(a.package.content.gallery.length,0);assert.equal(a.package.components,undefined);
   if(form.type==='contract'){assert.equal(a.package.content.quests.length,1);assert.ok(!a.package.content.worldbook[0].content.includes(payload.contract.goal));}
   else{assert.equal(a.package.content.quests.length,0);assert.deepEqual(a.package.content.worldbook[0].extra.__cxx_workshop_location,{mapId:'tokyo-central',placeId:'beni-street',title:r.title,templateKind:form.id});assert.equal(a.package.content.worldbook[0].strategy.type,'selective');}
   const wrong=structuredClone(payload);(wrong.contract||wrong).placeId='invented-map-point';assert.throws(()=>C.validateSubmission(form.type,wrong),/地点/);
  }
  assert.throws(()=>C.validateSubmission('world_factor',JSON.parse('{"<% dangerous %>":"text"}')),/非执行/);
});
