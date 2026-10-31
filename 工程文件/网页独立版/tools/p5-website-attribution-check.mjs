/** Bounded current-contract evidence for the historical website 18 failures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),WEB=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),ROOT=path.resolve(WEB,'..');
const {startFixture}=require('../../网站/gateway/workshop-contract.fixture.cjs'),C=require('../../网站/gateway/workshop-contract.cjs'),P=C.library(),{sample}=require('../../测试/网站/examples.cjs'),Content=require('../../卡片源码/运行时/content.js'),Core=require('../../卡片源码/运行时/core.js');
const checks=[];
async function check(name,fn){try{await fn();checks.push({name,ok:true});console.log('PASS '+name);}catch(error){checks.push({name,ok:false,error:error.stack});console.log('FAIL '+name+'\n'+error.stack);}}
const fixture=await startFixture();
try{
  const roles=['ordinary','other','authorized'],admin=fixture.session('admin'),official=fixture.session('authorized');
  const call=async(route,role,body)=>{const response=await fetch(fixture.baseUrl+route,{method:body===undefined?'GET':'POST',headers:{...(role?{Authorization:'Bearer '+role.token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json()};};
  const expectStatus=(result,status)=>assert.equal(result.status,status,JSON.stringify(result.body));
  async function publish(body){const preview=await call('/api/official/preview',official,body);expectStatus(preview,200);expectStatus(await call('/api/official/publish',official,{previewId:preview.body.previewId,previewHash:preview.body.previewHash}),200);}
  const card=await(await fetch(fixture.baseUrl+'/__fixture__/card.json')).json();await publish({card});
  const publicKey=(await call('/api/official/me',official)).body.publicKey.pem;
  const mapIndex=Object.fromEntries(C.schema().maps.map(map=>[map.id,map.places.map(place=>place.id)]));
  await check('当前规范稿要求登录；旧模板、暂停类别与伪造身份保持拒绝',async()=>{
    const data=sample('contract');expectStatus(await call('/api/workshop/submissions',null,data),401);
    expectStatus(await call('/api/workshop/submissions',fixture.session('ordinary'),{...data,publisherId:official.publisherId}),400);
    const old={...data,payload:C.Writing.toLegacy(data.type,data.payload)};
    const rejected=await call('/api/workshop/submissions',fixture.session('ordinary'),old);expectStatus(rejected,400);assert.equal(rejected.body.error,'template_version_required');
    for(const type of ['world_factor','shop_item','blueprint','recipe','skill','function','code_component']){
      const paused=await call('/api/workshop/submissions',fixture.session('ordinary'),{type,title:'隔离旧稿',summary:'隔离',payload:{format:1}});expectStatus(paused,409);assert.equal(paused.body.error,'submission_type_paused');
    }
  });
  for(const map of C.schema().maps)for(const [index,kind]of ['npc','user_identity','contract'].entries())await check(map.id+' / '+kind+'：规范两版真实HTTP、权限、签名、固定旧版与撤回',async()=>{
    const owner=fixture.session(roles[index]),other=fixture.session(roles[(index+1)%roles.length]),place=map.places.at(-1),data=sample(kind);
    data.title='隔离归因 '+map.id+' '+kind;Object.assign(data.payload.contract||data.payload,{mapId:map.id,placeId:place.id});
    expectStatus(await call('/api/workshop/content/preview',null,data),200);
    const created=await call('/api/workshop/submissions',owner,data);expectStatus(created,201);const id=created.body.id;
    expectStatus(await call('/api/workshop/submissions/'+id+'/edit',other),403);
    expectStatus(await call('/api/workshop/submissions/'+id+'/content-package'),404);
    const record=(await call('/api/workshop/submissions/'+id+'/edit',owner)).body.item;assert.deepEqual(record.payload,data.payload);
    let first,signedFile,firstBytes,registry={format:1,packages:{}};
    for(const revision of [1,2]){
      if(revision===2){
        data.summary='隔离二版，原始来源保留。';data.payload.sections[kind==='contract'?'goal':'background']+=' 第二版只用于隔离测试。';
        const edited=await call('/api/workshop/submissions/'+id+'/update',owner,{...data,baseRevision:1});expectStatus(edited,200);assert.equal(edited.body.revision,2);
        expectStatus(await call('/api/workshop/submissions/'+id+'/update',owner,{...data,baseRevision:1}),409);
        expectStatus(await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:1}),409);
        expectStatus(await call('/api/workshop/submissions/'+id+'/content-package'),404);
      }
      const approved=await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:revision});expectStatus(approved,200);const artifact=approved.body.artifact;
      assert.equal(artifact.source.publisherId,owner.publisherId);assert.equal(artifact.package.version,'1.0.'+revision);
      const location=kind==='contract'?artifact.package.content.quests[0]:artifact.package.content.worldbook[0].extra.__cxx_workshop_location;
      assert.equal(location.mapId,map.id);assert.equal(location.placeId,place.id);
      expectStatus(await call('/api/official/workshop/'+id+'/preview',other,{baseRevision:revision,packageSha256:artifact.packageSha256}),other.publisherId===official.publisherId?200:403);
      const preview=await call('/api/official/workshop/'+id+'/preview',official,{baseRevision:revision,packageSha256:artifact.packageSha256});expectStatus(preview,200);
      expectStatus(await call('/api/official/publish',official,{previewId:preview.body.previewId,previewHash:preview.body.previewHash}),200);
      const file=path.join(fixture.root,'releases/v3/packages',artifact.package.id,'1.0.'+revision+'.json'),signed=JSON.parse(fs.readFileSync(file));
      P.verifyDocument(signed,{'test.key':publicKey});Core.validatePackage(signed,{mapIndex});
      const merged=Core.mergeRegistry(registry,signed,{mapIndex,subscriptions:[signed.id]});assert.equal(merged.skipped,false);registry=merged.registry;
      if(revision===1){first=signed;signedFile=file;firstBytes=fs.readFileSync(file);}
      else{assert.equal(signed.id,first.id);assert.deepEqual(fs.readFileSync(signedFile),firstBytes);assert.deepEqual(registry.packages[first.id].history['1.0.1'],first.content);}
    }
    const options={mapIndex,subscriptions:{[first.id]:true},pins:{[first.id]:'1.0.1'}},choices=Content.storyChoices(registry,options);
    if(kind==='npc')assert.equal(choices.npcs[0].name,sample(kind).payload.sections.name);
    if(kind==='user_identity')assert.equal(choices.starts[0].opening,sample(kind).payload.sections.opening);
    if(kind==='contract')assert.equal(registry.packages[first.id].history['1.0.1'].quests[0].goal,sample(kind).payload.sections.goal);
    expectStatus(await call('/api/workshop/submissions/'+id+'/withdraw',owner,{}),200);
    expectStatus(await call('/api/workshop/submissions/'+id+'/content-package'),404);assert.deepEqual(fs.readFileSync(signedFile),firstBytes);
  });
}finally{await fixture.close();}
await check('既有发布竞争断言保持：仅在内存将HTTP旧稿替换为现役规范稿，作者改稿仍阻止发布',()=>{
  const sourceFile=path.join(ROOT,'测试/网站/official-release-source-race.test.cjs'),source=fs.readFileSync(sourceFile,'utf8');
  const old="const submission = { type: 'contract', title: 'HTTP竞争委托', summary: '合成', authorName: '测试署名', tags: [], payload: draft() };";
  const replacement="const submission = { type: 'contract', title: 'HTTP竞争委托', summary: '合成', authorName: '测试署名', tags: [], payload: require('./examples.cjs').sample('contract').payload };";
  assert.equal(source.split(old).length,2,'只允许替换一个旧HTTP输入，不改权限、版本、原子发布断言');
  const env=Object.fromEntries(['SystemRoot','SYSTEMROOT','Path','PATH','COMSPEC','TEMP','TMP'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
  const code='const fs=require("node:fs"),Module=require("node:module"),path=require("node:path");const info=JSON.parse(fs.readFileSync(0,"utf8"));const m=new Module(info.file);m.filename=info.file;m.paths=Module._nodeModulePaths(path.dirname(info.file));m._compile(info.source,info.file);';
  const result=spawnSync(process.execPath,['--test-reporter=tap','-e',code],{encoding:'utf8',windowsHide:true,timeout:30000,env,input:JSON.stringify({file:sourceFile,source:source.replace(old,replacement)})});
  const output=path.join(ROOT,'.cache/web-website-closure-20261025/source-race-current.tap');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,result.stdout||'');
  assert.equal(result.status,0,(result.stdout||'')+'\n'+(result.stderr||''));assert.match(result.stdout,/# fail 0/);assert.match(result.stdout,/ok 21 - real author HTTP update/);
  // Source and the sole input substitution remain reviewable beside the raw TAP.
  fs.writeFileSync(output.replace('.tap','.json'),JSON.stringify({source:path.relative(ROOT,sourceFile).replaceAll('\\','/'),sourceSha256:createHash('sha256').update(source).digest('hex'),onlySubstitution:{before:old,after:replacement},counts:result.stdout.split(/\r?\n/).filter(line=>/^# (tests|pass|fail|skipped)/.test(line))},null,2)+'\n');
});
const report={at:new Date().toISOString(),scope:'现役分栏模板与当前网关；合成账号/密钥、隔离DB、真实回环HTTP。并非Discord/OAuth或生产验证。',passed:checks.filter(row=>row.ok).length,total:checks.length,checks};
fs.writeFileSync(path.join(WEB,'reports/p5-website-current-contract.json'),JSON.stringify(report,null,2)+'\n');
if(report.passed!==report.total)process.exitCode=1;
