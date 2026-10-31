'use strict';
// P1 边界矩阵：短凭据、短认证文本、URL 用户名／密码与查询参数凭据、第三方配置形状。
// 反例先用同形状假值固定；真实凭据不进入夹具、日志或断言差异。
const {test}=require('node:test'),assert=require('node:assert/strict');
const load=require('../lib/fixture-loader.cjs'),M=load('migration.test.cjs',['fixture']);
const Core=require('../../卡片源码/运行时/core.js'),Backup=require('../../卡片源码/运行时/backup.js');
const copy=structuredClone;

const SHAPE={
  key:'sk12ab', auth:'Bearer zx9q', proxy:'socks5://proxyuser:pw9x2q@127.0.0.1:1080',
  endpoint:'https://api.example.test/v1/chat?api_key=q7w8e9&model=keep-model',
  thirdParty:'{"provider":"openai-compatible","apiKey":"tp4k9z","model":"keep-model","baseUrl":"https://relay.example.test/v1?token=rel8w2"}'
};
const SECRETS=[SHAPE.key,'zx9q','pw9x2q','q7w8e9','tp4k9z','rel8w2'];

function make(){
  const f=M.fixture();
  const connection={
    apiKey:SHAPE.key,note:SHAPE.key,log:'auth failed: '+SHAPE.key+' (retry)',
    headers:{Authorization:SHAPE.auth},lastError:'header was '+SHAPE.auth,
    proxyUrl:SHAPE.proxy,endpoint:SHAPE.endpoint,thirdParty:SHAPE.thirdParty,model:'keep-model'
  };
  const character={name:'test',data:{extensions:{tavern_helper:{variables:{connection:copy(connection),
    gameplay:{key:'quest-key',token:23,secret:'剧情秘密',secretHint:'keep-hint'}},scripts:[]}}}};
  f.header.chat_metadata.variables.connection=copy(connection);
  f.host.inspectInstall=async()=>({kind:'blocked',backup:{before:{character:copy(character)},error:'request rejected: '+SHAPE.key}});
  f.seed.migration.playerStores=[{kind:'character',name:'connection'}];
  f.adapters.capturePlayerStores=async()=>({connection:copy(connection)});
  const blobs=[],client=Backup.create({core:Core,host:f.host,seed:f.seed,adapters:f.adapters,
    api:{getCharData:()=>character},Blob,urlAPI:{createObjectURL(blob){blobs.push(blob);return 'blob:fixture';},revokeObjectURL(){}}});
  return {f,client,character,connection,blobs};
}

const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

test('short credentials and short auth text never survive in any rescue field',async()=>{
  const {f,client,character}=make(),before=copy({character,header:f.header,messages:f.messages});
  const doc=await client.captureRescue(),text=JSON.stringify(doc);
  for(const secret of SECRETS)assert.equal(text.includes(secret),false,'credential leak: '+secret);
  assert.equal(doc.payload.recovery.credentialsRemoved,true);
  assert.deepEqual({character,header:f.header,messages:f.messages},before);assert.equal(f.writes,0);
});

test('short credentials are removed from an already sealed legacy rescue object at download time',async()=>{
  const {client,blobs}=make(),doc=await client.captureRescue();
  doc.payload.recovery.legacy={apiKey:SHAPE.key,note:SHAPE.key,log:'used '+SHAPE.key,proxy:SHAPE.proxy};
  delete doc.sha256;doc.sha256=await Core.sha256(doc);const sealed=copy(doc);
  const prepared=await client.prepareExportFile(doc),download=JSON.parse(await blobs[0].text());prepared.revoke();
  const text=JSON.stringify(download);
  for(const secret of SECRETS)assert.equal(text.includes(secret),false,'legacy leak: '+secret);
  assert.deepEqual(doc,sealed,'download must not mutate the caller object');
  assert.equal(prepared.sha256,download.sha256);
  const digest=download.sha256;delete download.sha256;assert.equal(await Core.sha256(download),digest);
});

test('redaction preserves non-credential connection settings, URL hosts and all message text',async()=>{
  const {client}=make(),doc=await client.captureRescue(),c=doc.payload.recovery.character.data.extensions.tavern_helper.variables.connection;
  assert.equal(c.model,'keep-model');
  assert.match(c.proxyUrl,/^socks5:\/\/proxyuser:[^@]+@127\.0\.0\.1:1080$/);
  assert.match(c.endpoint,/^https:\/\/api\.example\.test\/v1\/chat\?api_key=[^&]+&model=keep-model$/);
  assert.equal(JSON.parse(c.thirdParty).model,'keep-model');
  assert.equal(JSON.parse(c.thirdParty).baseUrl.startsWith('https://relay.example.test/v1?token='),true);
  const gameplay=doc.payload.recovery.character.data.extensions.tavern_helper.variables.gameplay;
  assert.deepEqual(gameplay,{key:'quest-key',token:23,secret:'剧情秘密',secretHint:'keep-hint'});
  assert.deepEqual(doc.payload.messages[0].variables[1].stat_data.terminal.quests.q01.state,'进行中');
  assert.equal(doc.payload.messages[0].mes,'first branch');
});

test('single-character and two-character credentials only clear their own field',async()=>{
  const f=M.fixture(),character={name:'t',data:{extensions:{tavern_helper:{variables:{a:{apiKey:'x',note:'x',other:'x-ray'}}}}}};
  f.host.inspectInstall=async()=>({kind:'blocked',backup:{before:{character:copy(character)},error:'x'}});
  f.seed.migration.playerStores=[];f.adapters.capturePlayerStores=undefined;
  const client=Backup.create({core:Core,host:f.host,seed:f.seed,adapters:f.adapters,api:{getCharData:()=>character},Blob,urlAPI:{createObjectURL(){return'blob:x';},revokeObjectURL(){}}});
  const doc=await client.captureRescue(),a=doc.payload.recovery.character.data.extensions.tavern_helper.variables.a;
  assert.equal(a.apiKey,'');assert.equal(a.other,'x-ray','unrelated text must not be shredded');
});

test('session cookies and hyphenated credential header names are cleared',async()=>{
  const f=M.fixture();
  const character={name:'t',data:{extensions:{tavern_helper:{variables:{h:{Cookie:'session=abc123; theme=dark','X-Api-Key':'xk55p','x-goog-api-key':'gk77r',note:'abc123'}}}}}};
  f.host.inspectInstall=async()=>({kind:'blocked',backup:{before:{character:copy(character)},error:'none'}});
  f.seed.migration.playerStores=[];f.adapters.capturePlayerStores=undefined;
  const client=Backup.create({core:Core,host:f.host,seed:f.seed,adapters:f.adapters,api:{getCharData:()=>character},Blob,urlAPI:{createObjectURL(){return'blob:x';},revokeObjectURL(){}}});
  const doc=await client.captureRescue(),h=doc.payload.recovery.character.data.extensions.tavern_helper.variables.h,text=JSON.stringify(doc);
  assert.equal(h.Cookie,'');assert.equal(h['X-Api-Key'],'');assert.equal(h['x-goog-api-key'],'');
  for(const secret of ['abc123','xk55p','gk77r'])assert.equal(text.includes(secret),false,'leak: '+secret);
  assert.equal(h.note,'[已移除凭据]');
});

test('encoded credential shapes stay outside the supported range and are reported as such',async()=>{
  // Base64-wrapped settings are not decoded: the boundary is stated, not guessed.
  const f=M.fixture(),encoded=Buffer.from('{"apiKey":"b64secret9"}').toString('base64');
  const character={name:'t',data:{extensions:{tavern_helper:{variables:{b:{blob:encoded}}}}}};
  f.host.inspectInstall=async()=>({kind:'blocked',backup:{before:{character:copy(character)},error:'none'}});
  f.seed.migration.playerStores=[];f.adapters.capturePlayerStores=undefined;
  const client=Backup.create({core:Core,host:f.host,seed:f.seed,adapters:f.adapters,api:{getCharData:()=>character},Blob,urlAPI:{createObjectURL(){return'blob:x';},revokeObjectURL(){}}});
  const doc=await client.captureRescue();
  assert.equal(doc.payload.recovery.credentialsRemoved,true);
  assert.equal(doc.payload.recovery.needsReview,true,'credentialsRemoved is not a manual review claim');
  assert.equal(doc.payload.recovery.character.data.extensions.tavern_helper.variables.b.blob,encoded,'unrecognized encoding is left intact rather than guessed');
});

test('successful capture keeps a stable digest across re-runs and rejects tampered rescue objects',async()=>{
  const {client,blobs}=make(),doc=await client.captureRescue();
  const digest=doc.sha256;delete doc.sha256;assert.equal(await Core.sha256(doc),digest);doc.sha256=digest;
  doc.payload.recovery.legacy={apiKey:'changed'};await assert.rejects(client.prepareExportFile(doc),{code:'backup-hash-mismatch'});
  assert.equal(blobs.length,0);
});
