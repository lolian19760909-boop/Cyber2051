'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{webcrypto,createHash,generateKeyPairSync}=require('node:crypto'),vm=require('node:vm');
const Compat=require('../../卡片源码/运行时/crypto-compat.js'),Core=require('../../卡片源码/运行时/core.js'),Backup=require('../../卡片源码/运行时/backup.js'),Controller=require('../../卡片源码/运行时/controller.js');
const {fixture}=require('../lib/fixture-loader.cjs')('migration.test.cjs',['fixture']);
const portable=()=>({getRandomValues:bytes=>webcrypto.getRandomValues(bytes)}),hex=b=>Buffer.from(b).toString('hex');
test('portable SHA-256 matches native vectors and UTF-8/block boundaries',async()=>{
 const c=Compat.create(portable());
 for(const value of ['', 'abc', '心声与存档🙂',...Array.from({length:130},(_,i)=>'x'.repeat(i)),'a'.repeat(1000000)]){
  const bytes=new TextEncoder().encode(value);assert.equal(hex(await c.digest(bytes)),createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(hex(await c.digest(new TextEncoder().encode('abc'))),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('blocked native digest and UUID use identical hash and secure random values',async()=>{
 const c=Compat.create({subtle:{digest:async()=>{throw new DOMException('blocked','SecurityError');}},randomUUID(){throw new DOMException('blocked','SecurityError');},getRandomValues:bytes=>bytes.fill(255)});
 assert.equal(c.randomUUID(),'ffffffff-ffff-4fff-bfff-ffffffffffff');
 assert.equal(hex(await c.digest(new Uint8Array())),createHash('sha256').update('').digest('hex'));
 const values=new Set(Array.from({length:100},()=>Compat.create(portable()).randomUUID()));assert.equal(values.size,100);
 for(const value of values)assert.match(value,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.throws(()=>Compat.create({}).randomUUID(),{code:'crypto-random-unavailable'});
});
test('native methods stay bound to their original receiver and remain preferred',async()=>{
 const c=Compat.create(webcrypto),bytes=new Uint8Array([1,2,3]);assert.equal(hex(await c.digest(bytes)),hex(await webcrypto.subtle.digest('SHA-256',bytes)));assert.match(c.randomUUID(),/^[a-f0-9-]{36}$/);assert.equal(c.capabilities().signature,true);
});
test('foreign buffers and offset views hash the exact bytes without native digest',async()=>{
 const c=Compat.create(portable()),foreign=vm.runInNewContext('Uint8Array.from([9,1,2,3,8]).buffer');
 assert.equal(hex(await c.digest(foreign)),createHash('sha256').update(Buffer.from([9,1,2,3,8])).digest('hex'));
 for(const view of [new Uint8Array(foreign,1,3),new DataView(foreign,1,3),vm.runInNewContext('new DataView(Uint8Array.from([9,1,2,3,8]).buffer,1,3)')])assert.equal(hex(await c.digest(view)),createHash('sha256').update(Buffer.from([1,2,3])).digest('hex'));
 await assert.rejects(c.digest('not bytes'),TypeError);
});
test('private browser bundle has no global polyfill or AMD side effects',async()=>{
 const box=vm.createContext({crypto:portable(),TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,isSecureContext:false});
 vm.runInContext(require('../../工具/lib/crypto-compat.cjs').source(),box);
 assert.equal(box.sha256,undefined);assert.equal(box.crypto.subtle,undefined);assert.equal(box.crypto.randomUUID,undefined);
 assert.equal(hex(await box.CxxCrypto.digest(new TextEncoder().encode('abc'))),createHash('sha256').update('abc').digest('hex'));
 assert.equal(box.CxxCrypto.create().capabilities().secureContext,false);
});
test('backup/migration work without subtle or randomUUID and reject tampered player values',async()=>{
 const from=fixture(),to=fixture('new',['old']);
 const make=f=>Backup.create({core:Core,host:f.host,seed:f.seed,adapters:f.adapters,crypto:portable(),wait:async()=>{},readOnlyExport:true});
 const client=make(from),target=make(to),original=structuredClone(from.messages);
 const doc=(await client.captureMigration()).document,parsed=await target.parseMigration(JSON.stringify(doc)),preview=await target.previewMigration(parsed);
 const result=await target.importMigration(parsed,{preview,confirm:'migrate-copy'});
 assert.deepEqual(to.copies.get(result.chatId)[1].variables.map(v=>v.stat_data),original[0].variables.map(v=>v.stat_data));
 assert.deepEqual(from.messages,original);assert.equal(from.writes,0);
 const broken=structuredClone(doc);broken.payload.messages[0].variables[0].stat_data.money=999;
 await assert.rejects(target.parseMigration(JSON.stringify(broken)),{code:'migration-hash-mismatch'});
 assert.equal((await target.importMigration(parsed,{preview,confirm:'migrate-copy'})).chatId,result.chatId);
});
test('missing or unsupported signature support never accepts an update',async()=>{
 const {publicKey}=generateKeyPairSync('ed25519'),keys={test:publicKey.export({type:'spki',format:'der'}).toString('base64')},doc={signature:{algorithm:'Ed25519',keyId:'test',value:Buffer.alloc(64).toString('base64')}};
 await assert.rejects(Controller.verifyDocument(doc,keys,Core,portable()),{code:'crypto-signature-unavailable'});
 await assert.rejects(Controller.verifyDocument(doc,keys,Core,{subtle:{importKey:async()=>{throw new DOMException('algorithm not supported','NotSupportedError');},verify:async()=>{throw Error('must not verify');}}}),{code:'crypto-signature-unavailable'});
 await assert.rejects(Controller.verifyDocument(doc,keys,Core,webcrypto),{code:'bad-signature'});
});
