'use strict';
// 只执行从部署脚本提取的配置函数；不运行部署、不启动服务、不碰真实 env。
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const script=fs.readFileSync(path.join(__dirname,"../../../网站/deploy/110_official_publish.sh"),'utf8');
const blocks=[...script.matchAll(/<<'NODE'\n([\s\S]*?)\nNODE/g)].map(match=>match[1]);
const configure=blocks.find(block=>block.includes('const [mode,file,keyDir,keyId,backup]'));
const snapshot=blocks.find(block=>block.includes('const [mode,file,receipt]'));
function fixture(work){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cxx-official-config-'));
  const env=path.join(root,'gateway.env'),keyDir=path.join(root,'test-only-signing'),backup=path.join(root,'backup');
  fs.mkdirSync(keyDir);fs.mkdirSync(backup,{mode:0o700});
  const raw=['# Synthetic test values only','SESSION_SECRET=test-session-retained','OAUTH_SALT=test-oauth-retained','DISCORD_CLIENT_ID=test-client','DISCORD_CLIENT_SECRET=test-client-secret','DISCORD_REDIRECT_URI=https://cyber2051.top/api/workshop/oauth/callback','CXX_ADMIN_TOKEN=test-admin','CXX_IPSALT=test-ip','CXX_GATEWAY_PORT=8787','CXX_UNRELATED=test-unknown'].join('\n')+'\n';
  fs.writeFileSync(env,raw,{mode:0o600});
  const run=(mode,out=backup,keyId='official.test')=>spawnSync(process.execPath,['-',mode,env,keyDir,keyId,out],{input:configure,encoding:'utf8',windowsHide:true});
  try{work({root,env,keyDir,backup,raw,run});}
  finally{const resolved=path.resolve(root);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('cxx-official-config-'));fs.rmSync(resolved,{recursive:true,force:true});}
}
function pass(result){assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'');}
test('all embedded Node blocks compile and stage/deployment scope stays fixed',()=>{
  assert.ok(blocks.length>=8);for(const block of blocks)new vm.Script(block);
  for(const value of ['TARGET=cyber2051.top','KEY_DIR=/etc/cyber2051/official-signing','official-release/tools/packages.cjs',"工具/lib/runtime-components.cjs",'flock -n 9','--exclude=\'v3/.official-release.lock\''])assert.ok(script.includes(value));
  assert.ok(script.indexOf('configure record')<script.indexOf('configure apply'));
  const rollback=script.slice(script.indexOf('recover() {'),script.indexOf('trap recover EXIT'));
  assert.match(rollback,/code\.tar/);assert.match(rollback,/gateway\.env/);assert.match(rollback,/verify_login_runtime/);
  assert.doesNotMatch(rollback,/gateway-full\.tar|v3\.tar|signing-original\.tar/);
  assert.doesNotMatch(script,/UPDATE publishers|SESSION_SECRET=|OAUTH_SALT=|DISCORD_CLIENT_SECRET=/);
});
test('new test key is backed up and recoverable before append-only config activation',()=>fixture(e=>{
  pass(e.run('precheck'));assert.equal(fs.existsSync(path.join(e.keyDir,'private.pem')),false);assert.equal(fs.readFileSync(e.env,'utf8'),e.raw);
  pass(e.run('record'));pass(e.run('apply'));pass(e.run('verify'));
  const privateBytes=fs.readFileSync(path.join(e.keyDir,'private.pem')),saved=fs.readFileSync(path.join(e.backup,'signing-ready/private.pem'));
  assert.deepEqual(saved,privateBytes);assert.match(privateBytes.toString(),/^-----BEGIN PRIVATE KEY-----/);
  const restored=crypto.createPrivateKey(saved),pem=crypto.createPublicKey(restored).export({type:'spki',format:'pem'}).toString();
  assert.equal(restored.asymmetricKeyType,'ed25519');assert.equal(pem,fs.readFileSync(path.join(e.keyDir,'public.pem'),'utf8'));
  assert.ok(fs.readFileSync(e.env,'utf8').startsWith(e.raw));assert.equal((fs.readFileSync(e.env,'utf8').match(/^CXX_OFFICIAL_KEY_ID=/gm)||[]).length,1);
  const first=crypto.createHash('sha256').update(privateBytes).digest('hex'),again=path.join(e.root,'second-backup');fs.mkdirSync(again,{mode:0o700});
  pass(e.run('record',again));pass(e.run('apply',again));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(e.keyDir,'private.pem'))).digest('hex'),first);
}));
test('conflicting official settings refuse without key generation or env changes',()=>fixture(e=>{
  const raw=e.raw+'CXX_OFFICIAL_KEY_ID=other.key\n';fs.writeFileSync(e.env,raw);
  const result=e.run('precheck');assert.notEqual(result.status,0);assert.match(result.stderr,/官方配置已有冲突/);
  assert.equal(fs.existsSync(path.join(e.keyDir,'private.pem')),false);assert.equal(fs.readFileSync(e.env,'utf8'),raw);
}));
test('login changes after recorded baseline block activation without leaking test values',()=>fixture(e=>{
  pass(e.run('record'));fs.appendFileSync(e.env,'CXX_UNRELATED_NEW=synthetic-private-value\n');
  const result=e.run('apply');assert.notEqual(result.status,0);assert.match(result.stderr,/登录配置摘要改变/);assert.doesNotMatch(result.stderr,/synthetic-private-value|test-session-retained/);
  assert.equal(fs.existsSync(path.join(e.keyDir,'private.pem')),false);
}));
test('mismatched existing public key refuses to overwrite key or activate config',()=>fixture(e=>{
  const pair=crypto.generateKeyPairSync('ed25519');fs.writeFileSync(path.join(e.keyDir,'private.pem'),pair.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
  fs.writeFileSync(path.join(e.keyDir,'public.pem'),'synthetic incorrect public file');
  const before=fs.readFileSync(path.join(e.keyDir,'private.pem'));pass(e.run('precheck'));pass(e.run('record'));
  const result=e.run('apply');assert.notEqual(result.status,0);assert.match(result.stderr,/已有公钥与私钥不匹配/);
  assert.deepEqual(fs.readFileSync(path.join(e.keyDir,'private.pem')),before);assert.equal(fs.readFileSync(e.env,'utf8'),e.raw);
}));
test('private backup failure blocks config activation',()=>fixture(e=>{
  pass(e.run('record'));fs.mkdirSync(path.join(e.backup,'signing-ready'));
  const result=e.run('apply');assert.notEqual(result.status,0);assert.equal(fs.readFileSync(e.env,'utf8'),e.raw);
  assert.equal(fs.existsSync(path.join(e.keyDir,'private.pem')),true); // 已生成测试钥保留，不能偷偷换一把重试。
}));
test('database guard keeps original identities while permitting real login changes and observing other rows',()=>fixture(e=>{
  const {DatabaseSync}=require('node:sqlite'),database=path.join(e.root,'synthetic.db'),receipt=path.join(e.backup,'data-before.json');
  const db=new DatabaseSync(database),tables=['publishers','submissions','feedback','announcements','login_handoffs','publishers_ext_ready'];
  for(const table of tables){
    if(table==='publishers'){db.exec('CREATE TABLE publishers (publisher_id TEXT PRIMARY KEY,discord_id_hash TEXT,created_at TEXT,last_login_at TEXT,display_name_last TEXT)');db.prepare('INSERT INTO publishers VALUES (?,?,?,?,?)').run('synthetic-id','synthetic-provider','first-created','old-login',null);}
    else{db.exec('CREATE TABLE '+table+' (id INTEGER PRIMARY KEY,note TEXT,optional_value TEXT)');db.prepare('INSERT INTO '+table+' VALUES (?,?,?)').run(1,'synthetic original '+table,null);}
  }
  const run=mode=>spawnSync(process.execPath,['--no-warnings','-',mode,database,receipt],{input:snapshot,encoding:'utf8',windowsHide:true});
  try{
    pass(run('record'));assert.doesNotMatch(fs.readFileSync(receipt,'utf8'),/synthetic original/);
    db.exec('ALTER TABLE publishers ADD COLUMN can_publish_official INTEGER DEFAULT 0');
    for(const table of ['official_release_head','official_release_previews','official_release_audit'])db.exec('CREATE TABLE '+table+' (id INTEGER)');
    pass(run('verify'));fs.unlinkSync(path.join(e.backup,'data-after.json'));
    db.prepare('UPDATE login_handoffs SET note=? WHERE id=1').run('synthetic changed token');
    db.exec("UPDATE publishers SET last_login_at='new-login',display_name_last='synthetic renamed'");
    db.prepare('INSERT INTO publishers VALUES (?,?,?,?,?,?)').run('new-synthetic-id','new-provider','new-created','new-login',null,0);
    pass(run('verify'));const after=JSON.parse(fs.readFileSync(path.join(e.backup,'data-after.json'),'utf8'));assert.equal(after.observations.find(row=>row.table==='login_handoffs').exactMatch,false);assert.doesNotMatch(JSON.stringify(after),/synthetic changed token|synthetic renamed/);fs.unlinkSync(path.join(e.backup,'data-after.json'));
    db.exec("UPDATE publishers SET discord_id_hash='modified-provider' WHERE publisher_id='synthetic-id'");
    const changed=run('verify');assert.notEqual(changed.status,0);assert.match(changed.stderr,/原账号身份映射改变/);assert.doesNotMatch(changed.stderr,/modified-provider/);
    db.exec("UPDATE publishers SET discord_id_hash='synthetic-provider' WHERE publisher_id='synthetic-id'");
    db.exec('UPDATE publishers SET can_publish_official=NULL');assert.match(run('verify').stderr,/不允许新增官方账号授权/);
    db.exec('UPDATE publishers SET can_publish_official=0');db.exec('INSERT INTO official_release_previews VALUES (1)');assert.match(run('verify').stderr,/不允许发布数据写入/);
  }finally{db.close();}
}));
