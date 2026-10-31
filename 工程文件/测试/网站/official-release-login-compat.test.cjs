'use strict';
// Real old/new gateway processes; only generated sessions and a new temporary database.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os');
const path=require('node:path'),crypto=require('node:crypto'),net=require('node:net'),{spawn}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
async function freePort(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
async function runGateway(file,env){
  const port=await freePort(),child=spawn(process.execPath,[path.resolve(__dirname,file==='server.js'?'../../网站/gateway/server.js':'fixtures/preofficial-gateway.cjs')],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{}),...env,CXX_GATEWAY_PORT:String(port)}});
  child.stdout.resume();child.stderr.resume();const base='http://127.0.0.1:'+port;
  const close=async()=>{if(child.exitCode!==null||child.signalCode!==null)return;const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;};
  try{for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Isolated gateway stopped');try{if((await fetch(base+'/api/workshop/health')).ok)return{base,close};}catch{}await sleep(30);}throw Error('Isolated gateway startup timeout');}catch(e){await close();throw e;}
}
function session(secret,publisherId,legacy=false){const payload=Buffer.from(JSON.stringify({...(legacy?{}:{v:2}),pid:publisherId,n:'合成旧用户',exp:Date.now()+3600000})).toString('base64url');const signature=legacy?crypto.createHash('sha256').update(secret+'.'+payload).digest('base64url'):crypto.createHmac('sha256',secret).update(payload).digest('base64url');return payload+'.'+signature;}
async function request(base,route,token,body){const response=await fetch(base+route,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.json()};}
function originalRows(db){return Object.fromEntries(['publishers','submissions','feedback','login_handoffs','announcements'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all().map(row=>{const item={...row};delete item.can_publish_official;return item;})]));}
test('pre-module database and issued sessions survive official startup without account/submission/handoff replacement',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cxx-login-compat-'));
  const dbFile=path.join(root,'workshop.db'),secret=crypto.randomBytes(32).toString('hex'),owner='1111111111111111',other='2222222222222222';
  const env={CXX_DB_PATH:dbFile,CXX_STORAGE:path.join(root,'storage'),CXX_ADMIN_TOKEN:crypto.randomBytes(32).toString('hex'),CXX_IPSALT:'isolated-compat-salt',SESSION_SECRET:secret};
  const oldToken=session(secret,owner),legacyToken=session(secret,owner,true),otherToken=session(secret,other),handoffSecret='isolated-handoff-secret-123456',handoffId='isolated-handoff-123456';
  let running,db;
  try{
    running=await runGateway('server.js.preofficial-20261003.bak',env);db=new DatabaseSync(dbFile);
    assert.equal(db.prepare('PRAGMA table_info(publishers)').all().some(c=>c.name==='can_publish_official'),false,'Old DB unexpectedly has the official grant');
    const now=new Date().toISOString();
    for(const pid of[owner,other])db.prepare('INSERT INTO publishers(publisher_id,discord_id_hash,created_at,last_login_at,display_name_last,status) VALUES(?,?,?,?,?,?)').run(pid,hash('synthetic-'+pid),now,now,'合成旧用户','active');
    for(const[id,pid,status]of[[1,owner,'approved'],[2,owner,'pending'],[3,other,'approved']])db.prepare('INSERT INTO submissions(id,created_at,updated_at,type,title,payload,content_hash,edit_key_hash,ip_hash,status,publisher_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,now,now,'world_factor','合成旧投稿'+id,JSON.stringify({content:'旧内容保留'+id}),hash('content'+id),hash('edit'+id),'synthetic-ip',status,pid);
    db.prepare('INSERT INTO feedback(created_at,body,ip_hash,publisher_id) VALUES(?,?,?,?)').run(now,'合成旧反馈','synthetic-ip',owner);
    db.prepare('INSERT INTO announcements(created_at,updated_at,title,body) VALUES(?,?,?,?)').run(now,now,'合成公告','保留');
    db.prepare("INSERT INTO login_handoffs(handoff_id,challenge,status,publisher_id,display_name,session_token,created_at,expires_at) VALUES(?,?,'ready',?,?,?,?,?)").run(handoffId,hash(handoffSecret),owner,'合成旧用户',oldToken,now,new Date(Date.now()+300000).toISOString());
    const beforeDigest=hash(originalRows(db));
    assert.equal((await request(running.base,'/api/workshop/me',oldToken)).status,200);
    const oldPosts=await request(running.base,'/api/workshop/me/submissions',oldToken);assert.equal(oldPosts.status,200);assert.deepEqual(oldPosts.body.items.map(x=>x.id),[2,1]);
    db.close();db=null;await running.close();running=null;
    running=await runGateway('server.js',env);db=new DatabaseSync(dbFile);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.equal(hash(originalRows(db)),beforeDigest,'Existing account/post/feedback/handoff/announcement rows changed');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM publishers WHERE can_publish_official<>0').get().n,0,'Existing users were automatically granted official publish access');
    assert.equal((await request(running.base,'/api/workshop/me',oldToken)).status,200);
    const posts=await request(running.base,'/api/workshop/me/submissions',oldToken);assert.equal(hash(posts),hash(oldPosts),'Old owner view changed');
    const otherPosts=await request(running.base,'/api/workshop/me/submissions',otherToken);assert.deepEqual(otherPosts.body.items.map(x=>x.id),[3]);
    assert.equal((await request(running.base,'/api/workshop/me')).status,401);
    const officialMe=await request(running.base,'/api/official/me',oldToken);assert.equal(officialMe.status,200);assert.equal(officialMe.body.canPublishOfficial,false);
    assert.equal((await request(running.base,'/api/official/preview',oldToken,{})).status,403);
    assert.equal((await request(running.base,'/api/workshop/me',session(crypto.randomBytes(32).toString('hex'),owner))).status,401,'A changed signing secret must not accept old sessions');
    const legacyExpected=Date.now()<Date.parse('2026-11-02T00:00:00Z')?200:401;
    const legacy=await request(running.base,'/api/workshop/me',legacyToken);assert.equal(legacy.status,legacyExpected);if(legacyExpected===200)assert.equal(legacy.body.avatarUrl,null);
    assert.equal(hash(originalRows(db)),beforeDigest,'Read-only login checks mutated existing rows');
    const redeem=await request(running.base,'/api/workshop/login-handoff',null,{handoffId,secret:handoffSecret});assert.equal(redeem.status,200);assert.equal(redeem.body.token===oldToken,true,'Old ready handoff issued another session');
    assert.equal((await request(running.base,'/api/workshop/login-handoff',null,{handoffId,secret:handoffSecret})).status,410);
    assert.equal((await request(running.base,'/api/workshop/me',oldToken)).status,200);
  }finally{
    if(db)db.close();if(running)await running.close();
    const absolute=path.resolve(root);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(absolute).startsWith('cxx-login-compat-'))throw Error('Unsafe isolated cleanup');
    fs.rmSync(absolute,{recursive:true,force:true});
  }
});
