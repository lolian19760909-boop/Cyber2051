'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {startFixture}=require('../../网站/gateway/workshop-contract.fixture.cjs'),C=require('../../网站/gateway/workshop-contract.cjs'),P=C.library(),{sample}=require('./examples.cjs');
const publication=note=>({version:1,updateNote:note,credits:'合成测试素材',rightsStatement:'作者原创；素材来源随署名说明',adaptation:'ask'});
async function setup(){const f=await startFixture(),owner=f.session('ordinary'),other=f.session('other'),official=f.session('authorized'),admin=f.session('admin');
 const call=async(route,who,body)=>{const response=await fetch(f.baseUrl+route,{method:body===undefined?'GET':'POST',headers:{...(who?{Authorization:'Bearer '+who.token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json()};};
 const create=async(title='发布资料测试')=>{const data={...sample('contract'),title,publication:publication('首版')},r=await call('/api/workshop/submissions',owner,data);assert.equal(r.status,201,JSON.stringify(r.body));return {id:r.body.id,data};};
 const approve=async(id,revision=1)=>{const r=await call('/api/admin/submissions/'+id+'/approve',admin,{baseRevision:revision});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.artifact;};
 const publish=async body=>{const preview=await call('/api/official/preview',official,body);assert.equal(preview.status,200,JSON.stringify(preview.body));const result=await call('/api/official/publish',official,{previewId:preview.body.previewId,previewHash:preview.body.previewHash});assert.equal(result.status,200,JSON.stringify(result.body));return result;};
 return {f,call,create,approve,publish,owner,other,official,admin};
}
test('正式提交才记录版本：预览、两次修订、元数据历史、发行队列和撤回',async()=>{
 const h=await setup(),{f,call,create,approve,publish,owner,official,admin}=h;try{
  await publish({card:await(await fetch(f.baseUrl+'/__fixture__/card.json')).json()});const {id,data}=await create(),base='/api/workshop/submissions/'+id,artifact=await approve(id);
  assert.deepEqual((await call(base+'/versions')).body.items,[]);assert.equal((await call('/api/admin/workshop/release-queue',owner)).status,401);assert.equal((await call('/api/admin/workshop/release-queue',admin)).body.items[0].id,id);
  const preview=await call('/api/official/workshop/'+id+'/preview',official,{baseRevision:1,packageSha256:artifact.packageSha256});assert.equal(preview.status,200);assert.equal((await call(base+'/versions')).body.items.length,0);
  assert.equal((await call('/api/official/publish',official,{previewId:preview.body.previewId,previewHash:preview.body.previewHash})).status,200);
  let versions=(await call(base+'/versions')).body.items;assert.equal(versions.length,1);assert.equal(versions[0].available,true);assert.equal(versions[0].publication.updateNote,'首版');assert.equal(versions[0].panels[0].text.includes(data.payload.sections.goal),true);assert.equal((await call('/api/admin/workshop/release-queue',admin)).body.items.length,0);
  const edit=await call(base+'/update',owner,{publication:publication('第二版'),baseRevision:1});assert.equal(edit.status,200);assert.equal((await call(base+'/edit',owner)).body.item.publication.updateNote,'第二版');const second=await approve(id,2);
  assert.equal((await call('/api/admin/workshop/release-queue',admin)).body.items[0].revision,2);assert.equal((await call(base+'/versions')).body.items[0].publication.updateNote,'首版');
  await publish({contents:[second.package]});versions=(await call(base+'/versions')).body.items;assert.deepEqual(versions.map(row=>row.version),['1.0.2','1.0.1']);assert.deepEqual(versions.map(row=>row.available),[true,false]);assert.equal(versions[0].publication.updateNote,'第二版');
  const db=new DatabaseSync(path.join(f.root,'workshop.db'));const old=JSON.parse(db.prepare('SELECT snapshot FROM submission_revisions WHERE submission_id=? AND revision=1').get(id).snapshot);assert.equal(old.publication.updateNote,'首版');db.close();
  await publish({withdraw:[artifact.package.id]});assert.equal((await call(base+'/versions')).body.items.every(row=>!row.available),true);assert.equal((await call(base)).body.item.publication.available,false);
 }finally{await f.close();}
});
test('唯一登录账号订阅和认可：重试、隔离、封禁、取消及删除清理',async()=>{
 const h=await setup(),{f,call,create,approve,owner,other,admin}=h;try{
  const {id}=await create();await approve(id);const base='/api/workshop/submissions/'+id;
  assert.equal((await call(base+'/subscribe',null,{subscribed:true})).status,401);assert.equal((await call(base+'/endorse',other,{})).status,409);
  const retries=await Promise.all(Array.from({length:8},()=>call(base+'/subscribe',other,{subscribed:true})));assert(retries.every(row=>row.status===200&&row.body.subscriberCount===1));
  const endorsements=await Promise.all(Array.from({length:8},()=>call(base+'/endorse',other,{})));assert(endorsements.every(row=>row.status===200&&row.body.endorsementCount===1));
  await call(base+'/subscribe',owner,{subscribed:true});assert.equal((await call(base)).body.item.subscriberCount,2);assert.equal((await call('/api/workshop/me/subscriptions',other)).body.items[0].submissionId,id);assert.equal((await call(base+'/interaction',other)).body.endorsed,true);
  await call(base+'/subscribe',other,{subscribed:false});assert.equal((await call('/api/workshop/me/subscriptions',other)).body.items.length,0);assert.equal((await call(base)).body.item.subscriberCount,1);assert.equal((await call(base)).body.item.endorsementCount,1);
  await call('/api/admin/accounts/'+other.publisherId+'/ban',admin,{});assert.equal((await call(base+'/subscribe',other,{subscribed:true})).status,403);
  await call('/api/admin/accounts/'+other.publisherId+'/delete',admin,{confirmPublisherId:other.publisherId});assert.equal((await call(base)).body.item.endorsementCount,0);
  await call(base+'/withdraw',owner,{});assert.equal((await call(base+'/subscribe',owner,{subscribed:false})).status,200);assert.equal((await call('/api/workshop/me/subscriptions',owner)).body.items.length,0);
 }finally{await f.close();}
});
test('目录排序绑定分页作用域；作品反馈独立审核和展示',async()=>{
 const h=await setup(),{f,call,create,approve,owner,other,admin}=h;try{
  const ids=[];for(const title of ['排序甲','排序乙','排序丙']){const {id}=await create(title);ids.push(id);await approve(id);}
  await call('/api/workshop/submissions/'+ids[0]+'/subscribe',other,{subscribed:true});await call('/api/workshop/submissions/'+ids[1]+'/subscribe',owner,{subscribed:true});await call('/api/workshop/submissions/'+ids[1]+'/endorse',owner,{});
  const route='/api/workshop/submissions?sort=subscribers&pageSize=1',first=await call(route);assert.equal(first.body.items[0].id,ids[1]);const second=await call(route+'&cursor='+encodeURIComponent(first.body.nextCursor));assert.equal(second.body.items[0].id,ids[0]);assert.equal((await call('/api/workshop/submissions?sort=endorsements&pageSize=1&cursor='+encodeURIComponent(first.body.nextCursor))).status,400);
  assert.equal((await call('/api/workshop/submissions?sort=unknown')).status,400);assert.equal((await call('/api/workshop/submissions?sort=updated')).status,200);
  assert.equal((await call('/api/workshop/feedback',other,{body:'未发行版本',submissionId:ids[0],version:'99.99.99'})).status,400);
  await h.publish({card:await(await fetch(f.baseUrl+'/__fixture__/card.json')).json()});await h.publish({contents:[(await call('/api/workshop/submissions/'+ids[0]+'/content-package')).body.artifact.package]});
  const fb=await call('/api/workshop/feedback',other,{body:'这份任务已经玩过',submissionId:ids[0],version:'1.0.1'});assert.equal(fb.status,201);assert.equal((await call('/api/workshop/feedback?submissionId='+ids[0])).body.items.length,0);await call('/api/admin/feedback/'+fb.body.id+'/approve',admin,{});
  assert.equal((await call('/api/workshop/feedback?submissionId='+ids[0])).body.items[0].content_version,'1.0.1');assert.equal((await call('/api/workshop/feedback')).body.items.length,0);assert.equal((await call('/api/workshop/feedback?submissionId='+ids[1])).body.items.length,0);await call('/api/workshop/submissions/'+ids[0]+'/withdraw',owner,{});assert.equal((await call('/api/workshop/feedback?submissionId='+ids[0])).status,404);
 }finally{await f.close();}
});
test('旧空发布资料保留原指纹，新授权进入审核指纹和编译来源',()=>{
 const payload=JSON.stringify(sample('contract').payload),row={id:80001,revision:1,type:'contract',title:'旧稿',summary:'旧简介',author_name:'原作者',tags:'[]',payload,publisher_id:'2222222222222222',content_hash:P.sha256(payload)};
 const expected=P.sha256(P.canonical({id:row.id,revision:1,type:row.type,title:row.title,summary:row.summary,authorName:row.author_name,tags:[],payload:JSON.parse(payload),publisherId:row.publisher_id}));assert.equal(C.snapshotHash(row,P),expected);assert.equal(C.snapshotHash({...row,publication_metadata:'{}'},P),expected);
 const next={...row,publication_metadata:JSON.stringify(publication('新版'))};assert.notEqual(C.snapshotHash(next,P),expected);assert.deepEqual(C.compile(next,{publisher_id:row.publisher_id,status:'active'},P).source.publication,publication('新版'));assert.throws(()=>C.publicationMetadata({...publication('x'),rightsStatement:''}));
});


test('反馈表升级从中断的旧库继续，保留原反馈和未知字段',async()=>{
 const initialDatabase="CREATE TABLE feedback(id INTEGER PRIMARY KEY AUTOINCREMENT,created_at TEXT NOT NULL,nickname TEXT,body TEXT NOT NULL,ip_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',submission_id INTEGER,future_flag TEXT);INSERT INTO feedback(created_at,body,ip_hash,future_flag)VALUES('2026-11-04','原反馈','synthetic','keep');";
 const f=await startFixture(0,{initialDatabase});try{const db=new DatabaseSync(path.join(f.root,'workshop.db'));try{const columns=db.prepare('PRAGMA table_info(feedback)').all().map(row=>row.name);assert(columns.includes('content_version'));assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_feedback_submission'").get().name,'idx_feedback_submission');assert.equal(db.prepare('SELECT body,future_flag FROM feedback WHERE id=1').get().future_flag,'keep');assert.equal(db.prepare('SELECT body FROM feedback WHERE id=1').get().body,'原反馈');}finally{db.close();}}finally{await f.close();}
});
