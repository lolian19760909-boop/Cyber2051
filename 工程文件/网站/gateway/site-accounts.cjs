'use strict';
/** Website passwords share existing publisher IDs and sessions; model keys never enter this module. */
const crypto=require('node:crypto'),{promisify}=require('node:util'),derive=promisify(crypto.scrypt);
const HASH_OPTIONS={N:16384,r:8,p:5,maxmem:32*1024*1024};
const hashPassword=async(password,salt)=>Buffer.from(await derive(password,salt,64,HASH_OPTIONS));
const quote=name=>'"'+String(name).replaceAll('"','""')+'"';
function migratePublisherIdentities(db){
 const columns=db.prepare('PRAGMA table_info(publishers)').all();
 if(!columns.find(row=>row.name==='discord_id_hash')?.notnull)return {changed:false};
 const row=db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='publishers'").get();
 const nullable=row.sql.replace(/\bdiscord_id_hash\s+TEXT\s+NOT\s+NULL\b/i,'discord_id_hash TEXT');
 if(nullable===row.sql)throw Error('publishers identity schema does not match the maintained migration');
 const create=nullable.replace(/^(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)(?:"publishers"|`publishers`|\[publishers\]|publishers)(?=\s*\()/i,'$1"publishers_site_migration"');
 if(create===nullable)throw Error('publishers migration target unavailable');
 const objects=db.prepare("SELECT sql FROM sqlite_schema WHERE tbl_name='publishers' AND type IN ('index','trigger') AND sql IS NOT NULL").all();
 const foreignKeys=Object.values(db.prepare('PRAGMA foreign_keys').get())[0],legacyAlter=Object.values(db.prepare('PRAGMA legacy_alter_table').get())[0];
 db.exec('PRAGMA foreign_keys=OFF; PRAGMA legacy_alter_table=ON');
 try{db.exec('BEGIN IMMEDIATE');db.exec(create);const fields=columns.map(row=>quote(row.name)).join(',');db.exec('INSERT INTO publishers_site_migration('+fields+') SELECT '+fields+' FROM publishers');db.exec('DROP TABLE publishers');db.exec('ALTER TABLE publishers_site_migration RENAME TO publishers');for(const object of objects)db.exec(object.sql);if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Publisher migration has unresolved references');db.exec('COMMIT');return {changed:true};}
 catch(error){db.exec('ROLLBACK');throw error;}
 finally{db.exec('PRAGMA legacy_alter_table='+(legacyAlter?'ON':'OFF')+'; PRAGMA foreign_keys='+(foreignKeys?'ON':'OFF'));}
}
function normalizedUsername(value){if(typeof value!=='string')return '';const username=value.normalize('NFKC').trim().toLowerCase();return /^[\p{L}\p{N}_.-]{3,32}$/u.test(username)?username:'';}
function validPassword(value){return typeof value==='string'&&value.length>=10&&value.length<=128;}
function createSiteAccounts({db,send,readRawBody,authorize,issueSessionToken,configured,rateLimited,ipKey,now=()=>new Date().toISOString()}){
 const migration=migratePublisherIdentities(db);
 db.exec(`CREATE TABLE IF NOT EXISTS site_accounts(publisher_id TEXT PRIMARY KEY REFERENCES publishers(publisher_id) ON DELETE CASCADE,username TEXT NOT NULL UNIQUE,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
 const byName=db.prepare('SELECT a.*,p.status,p.display_name_last FROM site_accounts a JOIN publishers p USING(publisher_id) WHERE username=?'),byId=db.prepare('SELECT username,password_salt,password_hash FROM site_accounts WHERE publisher_id=?');
 async function passwordMatches(password,row){const expected=Buffer.from(row?.password_hash||'00'.repeat(64),'hex'),actual=await hashPassword(password,Buffer.from(row?.password_salt||'00'.repeat(16),'hex'));return !!row&&expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);}
 const session=(res,row)=>send(res,200,{ok:true,publisherId:row.publisher_id,displayName:row.display_name_last||row.username,token:issueSessionToken(row.publisher_id,row.display_name_last||row.username)});
 const inputError=res=>send(res,400,{ok:false,error:'invalid_account_input',message:'用户名需为3—32个文字、数字或 _ . -；密码需为10—128个字符。'});
 async function act(kind,req,res,data){
  if(!configured())return send(res,503,{ok:false,error:'account_login_unavailable',message:'网站登录暂不可用。'});
  const username=normalizedUsername(data.username),password=data.password;
  if(!username||!validPassword(password))return inputError(res);
  if(kind==='login'){
   const row=byName.get(username);if(!await passwordMatches(password,row))return send(res,401,{ok:false,error:'invalid_credentials',message:'用户名或密码不正确。'});
   if(row.status!=='active')return send(res,403,{ok:false,error:'account_unavailable',message:'此账号暂不可用。'});
   db.prepare('UPDATE publishers SET last_login_at=? WHERE publisher_id=?').run(now(),row.publisher_id);return session(res,row);
  }
  if(kind==='password'){
   const auth=authorize(req);if(auth.error)return send(res,auth.code||401,{ok:false,error:auth.error,message:'请先登录。'});
   const publisherId=auth.row.publisher_id,existing=byId.get(publisherId);
   if(existing&&(!validPassword(data.currentPassword)||!await passwordMatches(data.currentPassword,existing)))return send(res,401,{ok:false,error:'invalid_credentials',message:'原密码不正确。'});
   const duplicate=byName.get(username);if(duplicate&&duplicate.publisher_id!==publisherId)return send(res,409,{ok:false,error:'username_taken',message:'此用户名已被使用。'});
   const salt=crypto.randomBytes(16),hash=await hashPassword(password,salt),time=now();
   try{db.prepare('INSERT INTO site_accounts VALUES(?,?,?,?,?,?) ON CONFLICT(publisher_id) DO UPDATE SET username=excluded.username,password_salt=excluded.password_salt,password_hash=excluded.password_hash,updated_at=excluded.updated_at').run(publisherId,username,salt.toString('hex'),hash.toString('hex'),time,time);}catch(error){if(String(error.code).includes('CONSTRAINT'))return send(res,409,{ok:false,error:'username_taken',message:'此用户名已被使用。'});throw error;}
   return send(res,200,{ok:true,username,publisherId,message:'网站登录已保存，原账号和存档保留。'});
  }
  if(byName.get(username))return send(res,409,{ok:false,error:'username_taken',message:'此用户名已被使用。'});
  const salt=crypto.randomBytes(16),hash=await hashPassword(password,salt),publisherId=crypto.randomBytes(8).toString('hex'),time=now(),displayName=typeof data.displayName==='string'?data.displayName.trim().slice(0,24):username;
  try{db.exec('BEGIN IMMEDIATE');db.prepare("INSERT INTO publishers(publisher_id,discord_id_hash,created_at,last_login_at,display_name_last,status) VALUES(?,NULL,?,?,?,'active')").run(publisherId,time,time,displayName||username);db.prepare('INSERT INTO site_accounts VALUES(?,?,?,?,?,?)').run(publisherId,username,salt.toString('hex'),hash.toString('hex'),time,time);db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');if(String(error.code).includes('CONSTRAINT'))return send(res,409,{ok:false,error:'username_taken',message:'此用户名已被使用。'});throw error;}
  return session(res,{publisher_id:publisherId,display_name_last:displayName||username,username});
 }
 function handle(req,res,url,method){
  const match=/^\/api\/workshop\/account\/(register|login|password)$/.exec(url.pathname);if(!match)return false;
  const kind=match[1];if(kind==='password'&&method==='GET'){const auth=authorize(req);if(auth.error)send(res,auth.code||401,{ok:false,error:auth.error});else{const row=byId.get(auth.row.publisher_id);send(res,200,{ok:true,username:row?.username||'',hasPassword:!!row});}return true;}
  if(method!=='POST'){send(res,405,{ok:false,error:'method_not_allowed',message:'只接受 POST'},{Allow:kind==='password'?'GET, POST':'POST'});return true;}
  if(rateLimited('account:'+ipKey(req),30,10*60*1000)){send(res,429,{ok:false,error:'rate_limited',message:'操作过于频繁，请稍后再试。'},{'Retry-After':'600'});return true;}
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){send(res,415,{ok:false,error:'json_required'});return true;}
  readRawBody(req,res,8192,bytes=>{let data;try{data=JSON.parse(bytes.toString('utf8'));}catch{return send(res,400,{ok:false,error:'invalid_json'});}if(!data||typeof data!=='object'||Array.isArray(data))return send(res,400,{ok:false,error:'invalid_account_input'});return act(kind,req,res,data).catch(()=>send(res,500,{ok:false,error:'account_operation_failed',message:'账号操作未完成，请重试。'}));});return true;
 }
 return {handle,migration};
}
module.exports={createSiteAccounts,migratePublisherIdentities,normalizedUsername};
