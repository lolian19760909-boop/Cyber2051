'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {startFixture}=require("../../网站/gateway/workshop-contract.fixture.cjs");
const P=require("../../工具/发布/packages.cjs");
const C=require("../../网站/gateway/workshop-contract.cjs");
function submission(title='HTTP合成验收委托') {return {type:'contract',title,summary:'非正式内容',authorName:'测试作者',tags:['验收'],payload:{format:1,contract:{fixer:'合成发布人',type:'调查',difficulty:'低',pay:1000,mapId:'tokyo-central',placeId:'plaza',brief:'合成调查委托。',goal:'核对广场。'}}};}
test('actual HTTP contract create/edit/review/export/sign/download keeps ownership and revision boundaries',async()=>{
 const f=await startFixture();
 try {
  const ordinary=f.session('ordinary'), official=f.session('authorized'), admin=f.session('admin');
  const call=async(route,who,body)=>{const r=await fetch(f.baseUrl+route,{method:body?'POST':'GET',headers:{...(who?{Authorization:'Bearer '+who.token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
  const schema=(await call('/api/workshop/contracts/schema')).body.schema;assert.equal(schema.places.length,12);
  assert.equal((await call('/api/workshop/submissions',null,submission())).status,401);
  assert.equal((await call('/api/workshop/submissions',ordinary,{...submission(),publisherId:official.publisherId})).status,400);
  const bad=submission();bad.payload.contract.goal='<% dangerous() %>';assert.equal((await call('/api/workshop/submissions',ordinary,bad)).status,400);
  const created=await call('/api/workshop/submissions',ordinary,submission());assert.equal(created.status,201);const id=created.body.id;
  assert.equal((await call('/api/workshop/submissions/'+id+'/edit',official)).status,403);
  assert.equal((await call('/api/workshop/submissions/'+id+'/contract-package')).status,404);
  assert.equal((await call('/api/admin/submissions/'+id+'/approve',ordinary,{baseRevision:1})).status,401);
  const edit=await call('/api/workshop/submissions/'+id+'/update',ordinary,{...submission('HTTP改稿验收'),baseRevision:1});assert.equal(edit.body.revision,2);
  assert.equal((await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:1})).status,409);
  const review=await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:2});assert.equal(review.status,200);const artifact=review.body.artifact;
  assert.equal(artifact.package.version,'1.0.2');assert.equal(artifact.source.publisherId,ordinary.publisherId);assert.equal(artifact.source.displayName,'本地合成 ordinary');
  const exported=await call('/api/workshop/submissions/'+id+'/contract-package');assert.deepEqual(exported.body.artifact,artifact);
  const catalog=(await call('/api/workshop/submissions')).body.items.find(x=>x.id===id);assert.equal(catalog.packageRef.id,artifact.package.id);
  assert.equal((await call('/api/official/workshop/'+id+'/preview',ordinary,{baseRevision:2,packageSha256:artifact.packageSha256})).status,403);
  assert.equal((await call('/api/official/workshop/'+id+'/preview',official,{baseRevision:2,packageSha256:'0'.repeat(64)})).status,409);
  const card=await (await fetch(f.baseUrl+'/__fixture__/card.json')).json();const seed=card.data.extensions.tavern_helper.scripts[0].data.__cxx_update_seed;seed.mapIndex={'tokyo-central':schema.places.map(p=>p.id)};
  const foundation=await call('/api/official/preview',official,{card});assert.equal(foundation.status,200);
  assert.equal((await call('/api/official/publish',official,{previewId:foundation.body.previewId,previewHash:foundation.body.previewHash})).status,200);
  const preview=await call('/api/official/workshop/'+id+'/preview',official,{baseRevision:2,packageSha256:artifact.packageSha256});assert.equal(preview.status,200);
  assert.equal((await call('/api/official/publish',official,{previewId:preview.body.previewId,previewHash:preview.body.previewHash})).status,200);
  const fs=require('node:fs'),path=require('node:path');const text=fs.readFileSync(path.join(f.root,'releases/v3/packages',artifact.package.id,artifact.package.version+'.json'),'utf8'),signed=JSON.parse(text);
  const key=(await call('/api/official/me',official)).body.publicKey.pem;P.verifyDocument(signed,{'test.key':key});assert.equal(signed.content.quests[0].title,'HTTP改稿验收');assert.deepEqual(signed.content.worldbook[0].extra.__cxx_workshop_source,artifact.source);
  const next=await call('/api/workshop/submissions/'+id+'/update',ordinary,{...submission('第三修订验收'),baseRevision:2});assert.equal(next.body.revision,3);
  assert.equal((await call('/api/workshop/submissions/'+id+'/contract-package')).status,404);
  assert.equal((await call('/api/official/workshop/'+id+'/preview',official,{baseRevision:2,packageSha256:artifact.packageSha256})).status,404);
  const approved=await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:3});assert.equal(approved.body.artifact.package.version,'1.0.3');assert.equal(fs.readFileSync(path.join(f.root,'releases/v3/packages',artifact.package.id,artifact.package.version+'.json'),'utf8'),text);
  assert.equal((await call('/api/workshop/submissions/'+id+'/withdraw',ordinary,{})).status,200);
  assert.equal((await call('/api/workshop/submissions/'+id+'/contract-package')).status,404);assert.ok(fs.existsSync(path.join(f.root,'releases/v3/packages',artifact.package.id,artifact.package.version+'.json')));
 }finally{await f.close();}
});
test('every guided template has HTTP create/read/review/export/sign paths; static package updates preserve older versions',async()=>{
 const f=await startFixture();try{
  const owner=f.session('ordinary'),official=f.session('authorized'),admin=f.session('admin');
  const call=async(route,who,body)=>{const r=await fetch(f.baseUrl+route,{method:body?'POST':'GET',headers:{...(who?{Authorization:'Bearer '+who.token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
  const card=await(await fetch(f.baseUrl+'/__fixture__/card.json')).json();const p=await call('/api/official/preview',official,{card});await call('/api/official/publish',official,{previewId:p.body.previewId,previewHash:p.body.previewHash});
  for(const form of C.schema().templates.filter(t=>['contract','world_factor','character','user_identity'].includes(t.type))){let payload;if(form.type==='contract'){payload=submission().payload;if(form.id==='side_story')payload.templateKind=form.id;}else{payload={format:1,templateKind:form.id,mapId:'tokyo-central',placeId:'beni-street',keywords:['红花街验收']};for(const [key,,required]of form.fields)if(required)payload[key]='静态 '+key;}
   const data={type:form.type,title:'完整链测试 '+form.id,summary:'合成材料',payload};const a=await call('/api/workshop/submissions',owner,data);assert.equal(a.status,201);const id=a.body.id;
   const own=await call('/api/workshop/submissions/'+id+'/edit',owner);assert.deepEqual(own.body.item.payload,payload);
   const approved=await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:1});assert.equal(approved.status,200);
   const export1=await call('/api/workshop/submissions/'+id+'/content-package');assert.equal(export1.body.artifact.package.version,'1.0.1');
   const preview=await call('/api/official/workshop/'+id+'/preview',official,{baseRevision:1,packageSha256:export1.body.artifact.packageSha256});assert.equal(preview.status,200);assert.equal((await call('/api/official/publish',official,{previewId:preview.body.previewId,previewHash:preview.body.previewHash})).status,200);
   assert.equal((await call('/api/workshop/submissions/'+id)).status,200);
  }
  // 使用另一个合成作者避开原有每小时10次限频，逐验证两版更新与撤回。
  const other=f.session('other');const d={type:'world_factor',title:'世界因子两版测试',payload:{format:1,templateKind:'world_factor',mapId:'tokyo-central',placeId:'plaza',keywords:['测试'],content:'第一版静态正文'}};
  const a=await call('/api/workshop/submissions',other,d),id=a.body.id;await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:1});const export1=(await call('/api/workshop/submissions/'+id+'/content-package')).body.artifact;
  const preview=await call('/api/official/workshop/'+id+'/preview',official,{baseRevision:1,packageSha256:export1.packageSha256});await call('/api/official/publish',official,{previewId:preview.body.previewId,previewHash:preview.body.previewHash});
  const next=structuredClone(d);next.payload.content='第二版静态正文';const edit=await call('/api/workshop/submissions/'+id+'/update',other,{...next,baseRevision:1});assert.equal(edit.body.revision,2);await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:2});
  const export2=(await call('/api/workshop/submissions/'+id+'/content-package')).body.artifact;assert.equal(export2.package.id,export1.package.id);assert.equal(export2.package.version,'1.0.2');assert.notEqual(export2.packageSha256,export1.packageSha256);
  const p2=await call('/api/official/workshop/'+id+'/preview',official,{baseRevision:2,packageSha256:export2.packageSha256});assert.equal((await call('/api/official/publish',official,{previewId:p2.body.previewId,previewHash:p2.body.previewHash})).status,200);
  const publicF=f.publicFixture();assert.ok(publicF.catalogText);const latest=JSON.parse(publicF.catalogText);P.verifyDocument(latest,{'test.key':(await call('/api/official/me',official)).body.publicKey.pem});assert.equal(latest.packages.find(x=>x.id===export2.package.id).version,'1.0.2');
  await call('/api/workshop/submissions/'+id+'/withdraw',other,{});assert.equal((await call('/api/workshop/submissions/'+id+'/content-package')).status,404);assert.ok(JSON.parse(f.publicFixture().catalogText).packages.some(x=>x.id===export2.package.id));
 }finally{await f.close();}
});
test('original three types, ownership attachment download and withdrawal remain available',async()=>{
 const f=await startFixture();try{
  const owner=f.session('ordinary'),admin=f.session('admin');
  const call=async(route,who,body)=>{const r=await fetch(f.baseUrl+route,{method:body?'POST':'GET',headers:{...(who?{Authorization:'Bearer '+who.token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
  for(const type of ['world_factor','character','user_identity']){const created=await call('/api/workshop/submissions',owner,{type,title:'旧类型'+type,payload:{worldFactors:[{title:'测试',content:'静态正文'}]}});assert.equal(created.status,201);const id=created.body.id;
   // 原始 JS 附件只是下载文件，未编入 v3，也未执行。
   const upload=await fetch(f.baseUrl+'/api/workshop/submissions/'+id+'/attachment',{method:'POST',headers:{Authorization:'Bearer '+owner.token,'X-Filename':'test-only.js','Content-Type':'application/octet-stream'},body:'throw Error("must not execute");'});assert.equal(upload.status,201);
   assert.equal((await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:2})).status,200);
   const download=await fetch(f.baseUrl+'/api/workshop/submissions/'+id+'/download');assert.equal(download.status,200);assert.equal(await download.text(),'throw Error("must not execute");');
   assert.equal((await call('/api/workshop/submissions/'+id+'/withdraw',owner,{})).status,200);assert.equal((await fetch(f.baseUrl+'/api/workshop/submissions/'+id+'/download')).status,404);
  }
 }finally{await f.close();}
});
