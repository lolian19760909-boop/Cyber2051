'use strict';
/** One expiring opaque backup per account. No model execution or server-side story runtime. */
const crypto=require('node:crypto');
const TTL_MS=72*60*60*1000,MAX_BYTES=256*1024*1024;
function createTemporarySaves({db,send,readRawBody,authorize,now=Date.now,cleanupIntervalMs=15*60*1000}){
  db.exec('CREATE TABLE IF NOT EXISTS temporary_play_saves(account_id TEXT PRIMARY KEY,updated_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,payload BLOB NOT NULL,sha256 TEXT NOT NULL);CREATE INDEX IF NOT EXISTS idx_temporary_play_expiry ON temporary_play_saves(expires_at)');
  const expired=db.prepare('DELETE FROM temporary_play_saves WHERE expires_at<=?'),metadata=db.prepare('SELECT updated_at,expires_at,length(payload) AS bytes,sha256 FROM temporary_play_saves WHERE account_id=? AND expires_at>?'),read=db.prepare('SELECT * FROM temporary_play_saves WHERE account_id=? AND expires_at>?'),write=db.prepare('INSERT INTO temporary_play_saves VALUES(?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET updated_at=excluded.updated_at,expires_at=excluded.expires_at,payload=excluded.payload,sha256=excluded.sha256');
  const clean=()=>expired.run(now());clean();const timer=cleanupIntervalMs?setInterval(clean,cleanupIntervalMs):null;timer?.unref();
  const describe=row=>({updatedAt:row.updated_at,expiresAt:row.expires_at,bytes:row.bytes??row.payload.byteLength,sha256:row.sha256});
  function handle(req,res,url,method){if(url.pathname!=='/api/play/temporary-save')return false;const auth=authorize(req);if(auth.error){send(res,auth.code||401,{error:auth.error,message:auth.reason||'请登录后使用跨设备续玩'},{'cache-control':'no-store'});return true;}const accountId=auth.row.publisher_id,time=now();
    if(method==='GET'&&url.searchParams.get('meta')==='1'){const row=metadata.get(accountId,time);send(res,200,{ok:true,save:row?describe(row):null},{'cache-control':'no-store'});return true;}
    if(method==='GET'){const row=read.get(accountId,time);if(!row){send(res,404,{error:'temporary_save_missing',message:'没有可读取的临时存档，或已超过72小时。'},{'cache-control':'no-store'});return true;}res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':row.payload.byteLength,'Cache-Control':'no-store','Content-Disposition':'attachment; filename="Tokyo2051.cxxsave"','X-Cxx-Save-Expires-At':String(row.expires_at),'X-Cxx-Save-Sha256':row.sha256});res.end(Buffer.from(row.payload));return true;}
    if(method==='POST'){if(!/^application\/octet-stream(?:\s*;|$)/i.test(req.headers['content-type']||'')){send(res,415,{error:'temporary_save_type',message:'临时存档需要完整备份文件'});return true;}
      readRawBody(req,res,MAX_BYTES,bytes=>{if(!bytes.length)return send(res,400,{error:'temporary_save_empty',message:'存档内容为空'});try{const uploaded=now(),expiresAt=uploaded+TTL_MS,sha256=crypto.createHash('sha256').update(bytes).digest('hex');write.run(accountId,uploaded,expiresAt,bytes,sha256);send(res,200,{ok:true,save:{updatedAt:uploaded,expiresAt,bytes:bytes.length,sha256}},{'cache-control':'no-store'});}catch{send(res,500,{error:'temporary_save_failed',message:'临时上传未完成，本机存档仍保留。'},{'cache-control':'no-store'});}});return true;}
    send(res,405,{error:'method_not_allowed'},{Allow:'GET, POST','cache-control':'no-store'});return true;
  }return {handle,clean,destroy(){if(timer)clearInterval(timer);},TTL_MS};
}
module.exports={createTemporarySaves,TTL_MS,MAX_BYTES};
