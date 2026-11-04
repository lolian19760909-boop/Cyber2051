'use strict';
const crypto=require('node:crypto'),Contract=require('./workshop-contract.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=(message,code,status=400)=>{throw new Contract.ContractError(message,code,status);};
const activeTypes='('+[...new Set(Contract.Writing.templates.map(form=>form.type))].filter(type=>Contract.CONTENT_TYPES.includes(type)).map(type=>"'"+type+"'").join(',')+')';
function createCommunity({db,send,readBody,authorize,rateLimited,pagination,bridge,links}){
 db.exec(`CREATE TABLE IF NOT EXISTS workshop_subscriptions (
 publisher_id TEXT NOT NULL,submission_id INTEGER NOT NULL,package_id TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(publisher_id,package_id),UNIQUE(publisher_id,submission_id));
 CREATE INDEX IF NOT EXISTS idx_ws_sub_package ON workshop_subscriptions(package_id);
 CREATE INDEX IF NOT EXISTS idx_ws_sub_submission ON workshop_subscriptions(submission_id);
 CREATE TABLE IF NOT EXISTS workshop_endorsements (
 publisher_id TEXT NOT NULL,submission_id INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(publisher_id,submission_id));
 CREATE INDEX IF NOT EXISTS idx_ws_endorse_submission ON workshop_endorsements(submission_id);
 CREATE TABLE IF NOT EXISTS workshop_published_versions (
 submission_id INTEGER NOT NULL,revision INTEGER NOT NULL,package_id TEXT NOT NULL,version TEXT NOT NULL,
 release_id TEXT NOT NULL,published_at TEXT NOT NULL,artifact_sha256 TEXT NOT NULL,signed_file_sha256 TEXT NOT NULL,
 relative_path TEXT NOT NULL,metadata TEXT NOT NULL,PRIMARY KEY(submission_id,revision),UNIQUE(package_id,version));
 CREATE TRIGGER IF NOT EXISTS cleanup_workshop_account AFTER DELETE ON publishers BEGIN
 DELETE FROM workshop_subscriptions WHERE publisher_id=OLD.publisher_id;
 DELETE FROM workshop_endorsements WHERE publisher_id=OLD.publisher_id; END;
 CREATE TRIGGER IF NOT EXISTS cleanup_workshop_submission AFTER DELETE ON submissions BEGIN
 DELETE FROM workshop_subscriptions WHERE submission_id=OLD.id;
 DELETE FROM workshop_endorsements WHERE submission_id=OLD.id; END;`);
 function transaction(work){db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
 function recordCommitted(id,payload,finishedAt){
  const P=Contract.library();
  for(const file of payload.files){
   const pkg=JSON.parse(file.text),source=pkg.content?.worldbook?.[0]?.extra?.__cxx_workshop_source;
   if(pkg.kind!=='content'||!pkg.id.startsWith('community.')||!source)continue;
   const artifact=bridge.getArtifact(source.submissionId,source.revision),unsigned={...pkg};delete unsigned.signature;
   if(!artifact||artifact.packageSha256!==P.sha256(P.canonical(unsigned))||P.canonical(source)!==P.canonical(artifact.source))fail('正式发布来源与审核产物不一致','publication_source_mismatch',409);
   const entry=payload.catalog.packages.find(row=>row.id===pkg.id&&row.version===pkg.version);
   if(!entry||entry.sha256!==hash(file.text))fail('正式发布文件指纹不一致','publication_file_mismatch',409);
   const display=pkg.content.worldbook[0].extra.__cxx_workshop_display||{};
   const metadata={...display,requires:pkg.requires,...(pkg.content.worldbook[0].extra.__cxx_collection?{members:pkg.content.worldbook[0].extra.__cxx_collection.members}:{}),publication:source.publication||{},panels:[{title:'模型读取正文',text:pkg.content.quests.length?pkg.content.quests.map(Contract.Writing.questText).join('\n\n'):pkg.content.worldbook.map(row=>row.content).join('\n\n')}]};
   db.prepare('INSERT OR IGNORE INTO workshop_published_versions VALUES(?,?,?,?,?,?,?,?,?,?)').run(source.submissionId,source.revision,pkg.id,pkg.version,id,finishedAt,artifact.packageSha256,entry.sha256,file.relativePath,P.canonical(metadata));
  }
  cachedHead=null;
 }
 let cachedHead=null,cachedCatalog=new Map();
 // Only committed files create history; catalog membership separately describes availability.
 transaction(()=>{for(const row of db.prepare("SELECT id,payload,finished_at,created_at FROM official_release_audit WHERE status='committed' ORDER BY created_at,id").all())recordCommitted(row.id,JSON.parse(row.payload),row.finished_at||row.created_at);});
 function catalog(){
  const head=db.prepare("SELECT manifest_hash FROM official_release_head WHERE card_id='cyber2051'").get()?.manifest_hash||'';
  if(cachedHead!==head){const row=db.prepare("SELECT payload FROM official_release_audit WHERE status='committed' AND manifest_hash=? ORDER BY finished_at DESC LIMIT 1").get(head);cachedCatalog=new Map((row?JSON.parse(row.payload).catalog.packages:[]).map(entry=>[entry.id,entry]));cachedHead=head;}
  return cachedCatalog;
 }
 function publication(id){const row=db.prepare('SELECT * FROM workshop_published_versions WHERE submission_id=? ORDER BY revision DESC LIMIT 1').get(id);return row?{revision:row.revision,version:row.version,publishedAt:row.published_at,available:catalog().get(row.package_id)?.version===row.version}:null;}
 const effectiveFrom=`(SELECT publisher_id,submission_id,package_id,created_at FROM workshop_subscriptions UNION SELECT w.publisher_id,json_extract(m.value,'$.submissionId'),json_extract(m.value,'$.packageId'),w.created_at FROM workshop_subscriptions w JOIN workshop_published_versions v ON v.submission_id=w.submission_id AND v.revision=(SELECT MAX(last.revision) FROM workshop_published_versions last WHERE last.submission_id=w.submission_id) JOIN json_each(v.metadata,'$.members') m)`;
 const countedFrom=`(SELECT s.*,COALESCE(w.n,0) AS subscriber_count,COALESCE(e.n,0) AS endorsement_count FROM submissions s
 LEFT JOIN (SELECT submission_id,COUNT(DISTINCT publisher_id) AS n FROM ${effectiveFrom} GROUP BY submission_id) w ON w.submission_id=s.id
 LEFT JOIN (SELECT submission_id,COUNT(*) AS n FROM workshop_endorsements GROUP BY submission_id) e ON e.submission_id=s.id)`;
 function stats(id){return db.prepare(`SELECT (SELECT COUNT(DISTINCT publisher_id) FROM ${effectiveFrom} WHERE submission_id=?) AS subscriber_count,(SELECT COUNT(*) FROM workshop_endorsements WHERE submission_id=?) AS endorsement_count`).get(id,id);}
 function decorate(row){const counts=row.subscriber_count===undefined?stats(row.id):row;return {subscriberCount:counts.subscriber_count,endorsementCount:counts.endorsement_count,publication:publication(row.id)};}
 function actor(req){const auth=authorize(req);if(auth.error)fail('请登录有效账号',auth.error,auth.code||401);return auth.row.publisher_id;}
 function approved(id){const row=db.prepare(`SELECT * FROM submissions WHERE id=? AND status='approved' AND type IN ${activeTypes}`).get(id);if(!row)fail('内容当前尚未公开','not_found',404);Contract.assertOpen(row.type,JSON.parse(row.payload));return row;}
 function packageId(row){const artifact=bridge.getArtifact(row.id,row.revision);const old=db.prepare('SELECT package_id FROM workshop_published_versions WHERE submission_id=? ORDER BY revision DESC LIMIT 1').get(row.id);const id=artifact?.package.id||old?.package_id;if(!id)fail('内容包正在准备','package_not_ready',409);return id;}
 function state(id,pid){const counts=stats(id);return {...decorate({id,...counts}),subscribed:!!db.prepare(`SELECT 1 FROM ${effectiveFrom} WHERE publisher_id=? AND submission_id=?`).get(pid,id),directSubscribed:!!db.prepare('SELECT 1 FROM workshop_subscriptions WHERE publisher_id=? AND submission_id=?').get(pid,id),endorsed:!!db.prepare('SELECT 1 FROM workshop_endorsements WHERE publisher_id=? AND submission_id=?').get(pid,id)};}
 function versions(id){approved(id);return db.prepare('SELECT * FROM workshop_published_versions WHERE submission_id=? ORDER BY revision DESC').all(id).map(row=>{const current=catalog().get(row.package_id),metadata=JSON.parse(row.metadata);return {revision:row.revision,version:row.version,publishedAt:row.published_at,...metadata,available:current?.version===row.version,packageRef:{id:row.package_id,version:row.version,sha256:row.signed_file_sha256,url:'https://cyber2051.top/updates/v3/'+row.relative_path}};});}
 function list(searchParams,map){
  const type=searchParams.get('type')||'',q=(searchParams.get('q')||'').trim().toLowerCase(),sort=searchParams.get('sort')||'new';
  const sorts={new:[{column:'id',type:'number'}],updated:[{column:'updated_at',type:'string'},{column:'id',type:'number'}],subscribers:[{column:'subscriber_count',type:'number'},{column:'id',type:'number'}],endorsements:[{column:'endorsement_count',type:'number'},{column:'id',type:'number'}]};
  if(!Object.hasOwn(sorts,sort))fail('排序方式无效','invalid_sort');
  let where="status='approved'";const args=[];
  if(Contract.TYPES.includes(type)){where+=' AND type=?';args.push(type);}
  if(q){where+=' AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)';args.push('%'+q+'%','%'+q+'%');}
  const result=pagination.page(db,searchParams,{scope:['public-submissions',type,q,sort],from:countedFrom,where,args,keys:sorts[sort],map});
  return result||{ok:true,items:db.prepare(`SELECT * FROM ${countedFrom} WHERE ${where} ORDER BY ${sorts[sort].map(key=>key.column+' DESC').join(',')} LIMIT 200`).all(...args).map(map)};
 }
 function handle(req,res,url,method){
  const p=url.pathname,linkMatch=p.match(/^\/api\/workshop\/submissions\/(\d+)\/links$/),versionMatch=p.match(/^\/api\/workshop\/submissions\/(\d+)\/versions$/),interaction=p.match(/^\/api\/workshop\/submissions\/(\d+)\/(subscribe|endorse|interaction)$/);
  if(!linkMatch&&!versionMatch&&!interaction&&!['/api/workshop/me/subscriptions','/api/admin/workshop/release-queue'].includes(p))return false;
  const respond=work=>{try{send(res,200,{ok:true,...work()});}catch(error){if(!(error instanceof Contract.ContractError))throw error;send(res,error.status,{ok:false,error:error.code,message:error.message},error.status===429?{'Retry-After':'3600'}:undefined);}};
  if(linkMatch&&method==='GET')respond(()=>links.read(Number(linkMatch[1]),url.searchParams));
  else if(versionMatch&&method==='GET')respond(()=>({items:versions(Number(versionMatch[1]))}));
  else if(p==='/api/workshop/me/subscriptions'&&method==='GET')respond(()=>{const pid=actor(req);return {publisherId:pid,items:db.prepare('SELECT w.*,s.title,s.status FROM workshop_subscriptions w LEFT JOIN submissions s ON s.id=w.submission_id WHERE w.publisher_id=? ORDER BY w.created_at DESC,w.package_id').all(pid).map(row=>({submissionId:row.submission_id,packageId:row.package_id,subscribedAt:row.created_at,title:row.title||'',available:row.status==='approved'&&catalog().has(row.package_id),version:catalog().get(row.package_id)?.version||null}))};});
  else if(p==='/api/admin/workshop/release-queue'&&method==='GET')respond(()=>({items:db.prepare(`SELECT s.* FROM submissions s JOIN publishers p ON p.publisher_id=s.publisher_id WHERE s.status='approved' AND s.type IN ${activeTypes} AND p.status='active' AND NOT EXISTS(SELECT 1 FROM workshop_published_versions v WHERE v.submission_id=s.id AND v.revision=s.revision) ORDER BY s.updated_at,s.id`).all().filter(row=>Contract.Writing.isOpen(row.type,JSON.parse(row.payload))).map(row=>{const artifact=bridge.getArtifact(row.id,row.revision);return {id:row.id,title:row.title,type:row.type,revision:row.revision,authorName:row.author_name,publication:publication(row.id),needsCompilation:!artifact,packageRef:bridge.packageRef(row)};})}));
  else if(interaction&&method==='GET'&&interaction[2]==='interaction')respond(()=>{approved(Number(interaction[1]));return state(Number(interaction[1]),actor(req));});
  else if(interaction&&method==='POST'&&interaction[2]!=='interaction'){
   readBody(req,res,raw=>respond(()=>{
    let data;try{data=JSON.parse(raw);}catch{fail('请求正文需要JSON','invalid_json');}
    const id=Number(interaction[1]),action=interaction[2];
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>action==='subscribe'?key!=='subscribed':true)||action==='subscribe'&&typeof data.subscribed!=='boolean')fail('互动参数无效','invalid_input');
    return transaction(()=>{
     const pid=actor(req),existing=db.prepare('SELECT 1 FROM workshop_subscriptions WHERE publisher_id=? AND submission_id=?').get(pid,id);
     if(action==='subscribe'&&!data.subscribed){if(existing){if(rateLimited('workshop-subscribe:'+pid,120))fail('请稍后再试','rate_limited',429);db.prepare('DELETE FROM workshop_subscriptions WHERE publisher_id=? AND submission_id=?').run(pid,id);}return state(id,pid);}
     const row=approved(id),package_id=packageId(row);
     if(action==='subscribe'){
      if(!existing){if(rateLimited('workshop-subscribe:'+pid,120))fail('请稍后再试','rate_limited',429);db.prepare('INSERT INTO workshop_subscriptions VALUES(?,?,?,?)').run(pid,id,package_id,new Date().toISOString());}
     }else{
      if(!db.prepare(`SELECT 1 FROM ${effectiveFrom} WHERE publisher_id=? AND submission_id=?`).get(pid,id))fail('订阅后可认可这份作品','subscription_required',409);
      if(!db.prepare('SELECT 1 FROM workshop_endorsements WHERE publisher_id=? AND submission_id=?').get(pid,id)){if(rateLimited('workshop-endorse:'+pid,60))fail('请稍后再试','rate_limited',429);db.prepare('INSERT INTO workshop_endorsements VALUES(?,?,?)').run(pid,id,new Date().toISOString());}
     }
     return state(id,pid);
    });
   }));
  }else send(res,404,{ok:false,error:'not_found'});
  return true;
 }
 return {handle,list,decorate,versions,recordCommitted};
}
module.exports={createCommunity};
