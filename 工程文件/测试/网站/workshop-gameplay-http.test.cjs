'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startFixture}=require("../../网站/gateway/workshop-contract.fixture.cjs"),C=require("../../网站/gateway/workshop-contract.cjs"),F=require("../../网站/gateway/workshop-gameplay-fixtures.cjs"),P=C.library(),Core=require("../../卡片源码/运行时/core.js"),G=require("../../卡片源码/运行时/gameplay.js"),Content=require("../../卡片源码/运行时/content.js");
const mapIndex=Object.fromEntries(C.schema().maps.map(m=>[m.id,m.places.map(p=>p.id)]));
function call(f){return async(route,role,body)=>{const response=await fetch(f.baseUrl+route,{method:body?'POST':'GET',headers:{...(role?{Authorization:'Bearer '+f.session(role).token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};}
async function publish(api,body){const p=await api('/api/official/preview','authorized',body);assert.equal(p.status,200,JSON.stringify(p.body));const r=await api('/api/official/publish','authorized',{previewId:p.body.previewId,previewHash:p.body.previewHash});assert.equal(r.status,200,JSON.stringify(r.body));return p;}
for(const form of C.schema().templates.filter(t=>t.type!=='code_component'))test(form.id+' HTTP: two reviews, signed releases, installation, pinned consumer, withdrawal',async()=>{
 const f=await startFixture();try{
  const api=call(f),card=await(await fetch(f.baseUrl+'/__fixture__/card.json')).json();await publish(api,{card});
  const legacy=fs.readFileSync(path.join(f.root,'releases/v3/manifest.json'),'utf8'),key=(await api('/api/official/me','authorized')).body.publicKey.pem;
  const make=revision=>({type:form.type,title:'隔离 '+form.id,summary:'测试版本 '+revision,payload:F.payload(form.id,revision)});
  const preview=await api('/api/workshop/content/preview',null,make(1));assert.equal(preview.status,200);assert.equal(preview.body.preview.delivery,'signed_content');
  const created=await api('/api/workshop/submissions','ordinary',make(1));assert.equal(created.status,201);const id=created.body.id;
  let registry={format:1,packages:{}},first,packageId;
  const player={unknown:{preserved:true},terminal:{wallet:{yen:500,earned:500,spent:0},quests:{},gameplay:{schema:1,...Object.fromEntries(G.TABLES.map(k=>[k,{}])),resources:{['ugc_'+id+'_condition']:50},location:F.location}}},original=structuredClone(player);
  for(const revision of [1,2]){
   if(revision===2){const r=await api('/api/workshop/submissions/'+id+'/update','ordinary',{...make(2),baseRevision:1});assert.equal(r.status,200);assert.equal((await api('/api/workshop/submissions/'+id+'/content-package')).status,404);assert.equal((await api('/api/admin/submissions/'+id+'/approve','admin',{baseRevision:1})).status,409);}
   const review=await api('/api/admin/submissions/'+id+'/approve','admin',{baseRevision:revision});assert.equal(review.status,200,JSON.stringify(review.body));const artifact=review.body.artifact;packageId=artifact.package.id;
   const p=await api('/api/official/workshop/'+id+'/preview','authorized',{baseRevision:revision,packageSha256:artifact.packageSha256});assert.equal(p.status,200,JSON.stringify(p.body));
   assert.equal((await api('/api/official/publish','authorized',{previewId:p.body.previewId,previewHash:p.body.previewHash})).status,200);
   const filename=path.join(f.root,'releases/v3/packages',packageId,'1.0.'+revision+'.json'),signed=JSON.parse(fs.readFileSync(filename));
   P.verifyDocument(signed,{'test.key':key});Core.validatePackage(signed,{mapIndex});const merged=Core.mergeRegistry(registry,signed,{mapIndex,subscriptions:[packageId]});assert.equal(merged.skipped,false);registry=merged.registry;assert.deepEqual(player,original,'install cannot alter player save');
   assert.equal(registry.packages[packageId].version,'1.0.'+revision);
   if(revision===1)first=signed;
  }
  assert.deepEqual(registry.packages[packageId].history['1.0.1'],first.content);
  const options={mapIndex,subscriptions:{[packageId]:true},pins:{[packageId]:'1.0.1'}},choices=Content.storyChoices(registry,options);
  if(form.id==='npc')assert.equal(choices.npcs[0].name,'隔离 name 1');
  if(form.id==='user_identity')assert.equal(choices.starts[0].opening,'隔离通用开场 1');
  if(first.content.gameplay){
   const catalog=G.catalogue(registry,options),request=form.id==='encounter'?{action:'encounter',id:'ugc_'+id+'_sighting',outcomeId:'accept'}:['function','function_zone'].includes(form.id)?{action:'service',id:'ugc_'+id+'_heal'}:{action:'buy',id:'ugc_'+id+'_store',offerId:form.id==='blueprint'?'plan':form.id==='skill'?'ability':'material'};
   const plan=G.plan(player,catalog,request);assert.ok(plan.changes.length);assert.deepEqual(player,original);assert.equal(catalog.get('items','ugc_'+id+'_supply').definitionRef.version,'1.0.1');
   assert.equal(fs.readFileSync(path.join(f.root,'releases/v3/manifest.json'),'utf8'),legacy,'old client manifest preserved');
  }
  if(form.type==='contract')assert.equal(registry.packages[packageId].history['1.0.1'].quests[0].pay,11);
  assert.equal((await api('/api/workshop/submissions/'+id+'/withdraw','ordinary',{})).status,200);
  assert.equal((await api('/api/workshop/submissions/'+id+'/content-package')).status,404);
  assert.equal((await api('/api/official/preview','ordinary',{withdraw:[packageId]})).status,403);
  await publish(api,{withdraw:[packageId]});const manifest=JSON.parse(f.publicFixture().catalogText);P.verifyDocument(manifest,{'test.key':key});assert.ok(!manifest.packages.some(p=>p.id===packageId));
  assert.ok(fs.existsSync(path.join(f.root,'releases/v3/packages',packageId,'1.0.1.json')));assert.deepEqual(player,original);assert.deepEqual(registry.packages[packageId].history['1.0.1'],first.content);
 }finally{await f.close();}
});
test('code proposal passes review only for next card; attachments never become a signed install package',async()=>{
 const f=await startFixture();try{const api=call(f),data={type:'code_component',title:'隔离代码提案',payload:F.payload('code_component')};assert.equal((await api('/api/workshop/content/preview',null,data)).body.preview.delivery,'next_card');
 const c=await api('/api/workshop/submissions','ordinary',data);assert.equal(c.status,201);const id=c.body.id;
 const u=await fetch(f.baseUrl+'/api/workshop/submissions/'+id+'/attachment',{method:'POST',headers:{Authorization:'Bearer '+f.session('ordinary').token,'X-Filename':'source.js'},body:'throw Error("DO NOT EXECUTE");'});assert.equal(u.status,201);
 const approved=await api('/api/admin/submissions/'+id+'/approve','admin',{baseRevision:2});assert.equal(approved.status,200);assert.equal(approved.body.artifact,undefined);
 assert.equal((await api('/api/workshop/submissions/'+id+'/content-package')).status,404);assert.equal((await api('/api/official/workshop/'+id+'/preview','authorized',{baseRevision:2})).status,404);
 const download=await fetch(f.baseUrl+'/api/workshop/submissions/'+id+'/download');assert.equal(download.headers.get('content-type'),'application/octet-stream');assert.match(download.headers.get('content-disposition'),/^attachment/);assert.match(await download.text(),/DO NOT EXECUTE/);
 }finally{await f.close();}
});
