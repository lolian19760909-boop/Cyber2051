'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite'),C=require("../../网站/gateway/workshop-contract.cjs"),W=C.Writing,P=C.library();
const {sample}=require('./examples.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));

test('preview uses configured production package module outside the local checkout layout',()=>{
  const os=require('node:os'),{execFileSync}=require('node:child_process');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cxx-submission-module-'));
  try{
    fs.mkdirSync(path.join(dir,'tools'));fs.mkdirSync(path.join(dir,'runtime'));
    for(const name of ['content.js','gameplay.js'])fs.writeFileSync(path.join(dir,'runtime',name),'module.exports=require('+JSON.stringify(path.resolve(__dirname,"../../卡片源码/运行时",name))+');');
    fs.writeFileSync(path.join(dir,'tools/packages.cjs'),'globalThis.__configuredSubmissionPackages=true;module.exports=require('+JSON.stringify(path.resolve(__dirname,"../../工具/发布/packages.cjs"))+');');
    const source='const assert=require("node:assert/strict"),C=require('+JSON.stringify(path.join(__dirname, "../../网站/gateway/workshop-contract.cjs"))+'),{sample}=require('+JSON.stringify(path.join(__dirname, "examples.cjs"))+');for(const k of ["npc","user_identity","contract"]){const d=sample(k);C.validateIncoming(d.type,d.payload,d);assert.ok(C.presentation(d).panels.length);}assert.equal(globalThis.__configuredSubmissionPackages,true);';
    execFileSync(process.execPath,['-e',source],{env:{...process.env,CXX_FORMAT3_PACKAGES_MODULE:path.join(dir,'tools/packages.cjs')},stdio:'pipe'});
  }finally{assert.ok(dir.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(dir).startsWith('cxx-submission-module-'));fs.rmSync(dir,{recursive:true,force:true});}
});
test('three writing templates compile without losing sections or changing runtime formats',()=>{
  assert.deepEqual(C.schema().templates.map(x=>x.id),['npc','user_identity','contract']);
  for(const kind of ['npc','user_identity','contract']){
    const d=sample(kind),original=JSON.stringify(d);C.validateIncoming(d.type,d.payload,d);
    const payload=JSON.stringify(d.payload),row={...d,id:42,revision:3,publisher_id:'fixture-author',author_name:d.authorName,tags:JSON.stringify(d.tags),payload,content_hash:P.sha256(payload)};
    const a=C.compile(row,{publisher_id:'fixture-author',status:'active'},P),view=C.presentation(row),text=view.panels.map(x=>x.text).join('\n');
    for(const [key,v]of Object.entries(d.payload.sections))assert.ok(text.includes(v),kind+' lost '+key);
    if(kind==='contract'){
      const q=a.package.content.quests[0];assert.equal(q.pay,3000);assert.equal(q.id,'ugc.contract.42.01');assert.equal(view.panels[1].text,W.questText(q));
      // 对比现役 controller 的实际投影函数，而不是只比较两次相同实现。
      const source=fs.readFileSync(path.join(__dirname,"../../卡片源码/运行时/controller.js"),'utf8'),start=source.indexOf('    function questEntry(quest) {'),end=source.indexOf('    async function syncChat()',start);
      const actual=vm.runInNewContext(source.slice(start,end)+'\nquestEntry;', {error:(code,message)=>Error(message)})(q);
      assert.equal(view.panels[1].text,actual.content);
    }else{
      assert.equal(view.panels[0].text,a.package.content.worldbook[0].content);
      const meta=a.package.content.worldbook[0].extra;require("../../卡片源码/运行时/content.js").validateStoryMetadata({extra:meta});
      assert.ok(kind==='npc'?meta.__cxx_npc:meta.__cxx_player_start);
    }
    assert.equal(JSON.stringify(d),original,'compile must not mutate source');
  }
});

test('legacy open posts upgrade with exact previous text; paused attachments remain downloadable',async()=>{
  const f=await require("../../网站/gateway/workshop-contract.fixture.cjs").startFixture();
  try{
    const owner=f.session('ordinary'),admin=f.session('admin');
    const call=async(route,who,data)=>{const r=await fetch(f.baseUrl+route,{method:data===undefined?'GET':'POST',headers:{...(who?{Authorization:'Bearer '+who.token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {...await r.json(),httpStatus:r.status};};
    const db=new DatabaseSync(path.join(f.root,'workshop.db'));
    const seed=(type,payload)=>Number(db.prepare("INSERT INTO submissions(created_at,updated_at,type,title,summary,author_name,tags,payload,content_hash,edit_key_hash,ip_hash,revision,status,publisher_id)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('2026-10-01','2026-10-01',type,'旧稿标题','旧稿简介','旧署名','[]',JSON.stringify(payload),P.sha256(JSON.stringify(payload)),'unused','fixture',4,'approved',owner.publisherId).lastInsertRowid);
    const old=W.toLegacy('character',sample('npc').payload),id=seed('character',old);
    const closedId=seed('world_factor',{format:1,templateKind:'world_factor',mapId:'tokyo-central',placeId:'plaza',keywords:['旧稿'],content:'保留内容'});
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM submission_revisions').get().n,0,'reading old records must not synthesize revision history');
    const dir=path.join(f.root,'workshop-storage',String(closedId)),bytes=Buffer.from('historical attachment');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'att.json'),bytes);fs.writeFileSync(path.join(dir,'meta.json'),JSON.stringify({origName:'old.json',ext:'json',size:bytes.length,uploadedAt:'2026-10-01'}));
    const read=await call('/api/workshop/submissions/'+id+'/edit',owner);assert.deepEqual(read.item.payload,old);
    const incomplete={...sample('npc'),payload:W.upgradeLegacy('character',old),baseRevision:4};
    assert.equal((await call('/api/workshop/submissions/'+id+'/update',owner,incomplete)).httpStatus,400);
    assert.equal(db.prepare('SELECT revision FROM submissions WHERE id=?').get(id).revision,4);
    const revised=await call('/api/workshop/submissions/'+id+'/update',owner,{...sample('npc'),baseRevision:4});assert.equal(revised.revision,5);
    const snapshot=JSON.parse(db.prepare('SELECT snapshot FROM submission_revisions WHERE submission_id=? AND revision=4').get(id).snapshot);assert.deepEqual(snapshot.payload,old);
    const review=await call('/api/admin/submissions/'+id,admin);assert.equal(review.comparison.previousRevision,4);assert.ok(review.comparison.changes.some(x=>x.label==='原稿 / background'&&x.before===old.background));
    const download=await fetch(f.baseUrl+'/api/workshop/submissions/'+closedId+'/download');assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
    const blocked=await fetch(f.baseUrl+'/api/workshop/submissions/'+closedId+'/attachment',{method:'POST',headers:{Authorization:'Bearer '+owner.token,'x-filename':'new.json'},body:'replacement'});assert.equal((await blocked.json()).error,'submission_type_paused');
    assert.deepEqual(fs.readFileSync(path.join(dir,'att.json')),bytes);assert.equal(db.prepare('SELECT revision FROM submissions WHERE id=?').get(closedId).revision,4);db.close();
  }finally{await f.close();}
});
test('schema retains tuple fields for old pages and exposes shared writing descriptors; drafts use unassigned IDs',()=>{
  for(const form of C.schema().templates){assert.ok(form.fields.every(f=>Array.isArray(f)));assert.deepEqual(form.writingFields,W.byKind(form.id).fields);}
  assert.ok(C.schema().legacyTemplates.every(f=>!f.enabled));
  const preview=C.presentation(sample('contract'));assert.ok(preview.panels[1].text.includes('任务编号：（提交后分配）'));assert.ok(!JSON.stringify(preview).includes('100000000'));
});
test('new submission validation rejects omissions, placeholders, old JSON and closed categories',()=>{
  for(const kind of ['npc','user_identity','contract']){
    const d=sample(kind);for(const f of W.byKind(kind).fields.filter(x=>x.required)){
      const bad=clone(d);delete bad.payload.sections[f.name];assert.throws(()=>C.validateIncoming(bad.type,bad.payload,bad));
      bad.payload.sections[f.name]='待补';assert.throws(()=>C.validateIncoming(bad.type,bad.payload,bad));
    }
    assert.throws(()=>C.validateIncoming(d.type,d.payload,{...d,summary:''}));
    const old=W.toLegacy(d.type,d.payload);assert.throws(()=>C.validateIncoming(d.type,old,d),e=>e.code==='template_version_required');C.validateSubmission(d.type,old);
    const unexpected=clone(d);unexpected.payload.sections.unknown='额外文本';assert.throws(()=>C.validateIncoming(d.type,unexpected.payload,d));
  }
  for(const type of ['world_factor','shop_item','blueprint','recipe','skill','function','code_component'])assert.throws(()=>C.validateIncoming(type,{format:1},{}),e=>e.code==='submission_type_paused');
  assert.throws(()=>C.assertOpen('contract',{templateKind:'side_story'}));
  const bad=sample('contract');bad.payload.contract.placeId='not-a-place';assert.throws(()=>C.validateIncoming(bad.type,bad.payload,bad));
  bad.payload.contract.placeId='plaza';bad.payload.contract.pay=-1;assert.throws(()=>C.validateIncoming(bad.type,bad.payload,bad));
});
test('legacy upgrade is lossless to the original and never invents missing fields',()=>{
  const old={format:1,templateKind:'npc',mapId:'tokyo-central',placeId:'plaza',keywords:['旧稿'],name:'旧人物',identity:'旧身份',background:'原来的一整段背景'};
  const text=JSON.stringify(old),up=W.upgradeLegacy('character',old);assert.equal(JSON.stringify(old),text);assert.equal(up.sections.background,old.background);assert.equal(up.sections.personality,undefined);
  assert.equal(W.upgradeLegacy('world_factor',{content:'保留的原文'}),null);
  const row={type:'character',title:'历史稿',payload:{unstructured:'未结构化的历史原文'},tags:[]};assert.ok(C.presentation(row).panels[0].text.includes('未结构化的历史原文'));
});
test('inline page scripts and touched modules compile',()=>{
  for(const name of ['submit.html','my.html','submission.html','admin.html']){
    const text=fs.readFileSync(path.join(__dirname,'../../网站/gateway/public',name),'utf8');for(const m of text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1],{filename:name});
  }
  for(const name of ['../../网站/gateway/public/submission-template.js','../../网站/gateway/public/submission-view.js','../../网站/gateway/public/contract-form.js','../../网站/gateway/public/admin-ui.js','submission-history.cjs','workshop-contract.cjs','workshop-bridge.cjs','server.js'])new vm.Script(fs.readFileSync(path.resolve(__dirname,name.includes('/')?name:'../../网站/gateway/'+name),'utf8'),{filename:name});
});
test('local HTTP create/preview/revise/review/withdraw and old-post retention',async()=>{
  const f=await require("../../网站/gateway/workshop-contract.fixture.cjs").startFixture();
  try{
    const owner=f.session('ordinary'),other=f.session('other'),admin=f.session('admin');
    const call=async(route,who,data)=>{const r=await fetch(f.baseUrl+route,{method:data===undefined?'GET':'POST',headers:{...(who?{Authorization:'Bearer '+who.token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {...await r.json(),httpStatus:r.status};};
    for(const [i,kind]of ['npc','user_identity','contract'].entries()){
      const d=sample(kind),who=i===2?other:owner;
      assert.equal((await call('/api/workshop/content/preview',null,d)).httpStatus,200);
      const created=await call('/api/workshop/submissions',who,d);assert.equal(created.httpStatus,201,JSON.stringify(created));const id=created.id;
      assert.equal((await call('/api/workshop/submissions/'+id+'/edit',i===2?owner:other)).httpStatus,403);
      const original=(await call('/api/workshop/submissions/'+id+'/edit',who)).item;assert.deepEqual(original.payload,d.payload);
      const next=clone(d);next.summary='改稿后的简介，原版本应可对照。';next.payload.sections.background===undefined?next.payload.sections.goal+=' 由值班员确认交付。':next.payload.sections.background+=' 这些经历影响了目前的工作选择。';
      const revised=await call('/api/workshop/submissions/'+id+'/update',who,{...next,baseRevision:1});assert.equal(revised.revision,2);
      assert.equal((await call('/api/workshop/submissions/'+id+'/update',who,{...d,baseRevision:1})).httpStatus,409);
      const detail=await call('/api/admin/submissions/'+id,admin);assert.equal(detail.comparison.previousRevision,1);assert.ok(detail.comparison.changes.some(c=>c.label==='一句话简介'&&c.before===d.summary));
      const approved=await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:2});assert.equal(approved.httpStatus,200,JSON.stringify(approved));
      const pub=await call('/api/workshop/submissions/'+id);assert.deepEqual(pub.item.presentation,detail.presentation);
      const artifact=await call('/api/workshop/submissions/'+id+'/content-package');assert.equal(artifact.artifact.package.version,'1.0.2');
      assert.equal((await call('/api/workshop/submissions/'+id+'/withdraw',who,{})).httpStatus,200);
    }
    // 直接播种旧库，表示部署前已存在的稿，不能借新建 API 绕过版本要求。
    const db=new DatabaseSync(path.join(f.root,'workshop.db'));
    const old=JSON.stringify({format:1,templateKind:'world_factor',mapId:'tokyo-central',placeId:'plaza',keywords:['原稿'],content:'部署前已经存在的内容'});
    const row=db.prepare("INSERT INTO submissions(created_at,updated_at,type,title,summary,author_name,tags,payload,content_hash,edit_key_hash,ip_hash,revision,status,publisher_id)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('2026-10-01','2026-10-01','world_factor','历史设定','旧简介','旧署名','[]',old,P.sha256(old),'unused','fixture',7,'approved',owner.publisherId);const id=Number(row.lastInsertRowid);db.close();
    const saved=await call('/api/workshop/submissions/'+id+'/edit',owner);assert.deepEqual(saved.item.payload,JSON.parse(old));
    assert.equal((await call('/api/workshop/submissions/'+id)).httpStatus,200);
    assert.equal((await call('/api/workshop/submissions/'+id+'/update',owner,{...sample('npc'),baseRevision:7})).error,'submission_type_paused');
    assert.equal((await call('/api/workshop/submissions',owner,{type:'character',title:'绕过',payload:{content:'旧JSON'}})).error,'template_version_required');
    assert.equal((await call('/api/workshop/submissions/'+id+'/edit',owner)).item.revision,7);
    assert.equal((await call('/api/workshop/submissions/'+id+'/withdraw',owner,{})).httpStatus,200);
  }finally{await f.close();}
});
