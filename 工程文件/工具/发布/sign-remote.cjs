'use strict';
// Local delivery only. The existing VPS reads its private key in memory and
// returns a signature. No remote files, catalog, workshop or services are changed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const Tools=require('./packages.cjs'),Contract=require('./release-contract.cjs');
const Core=require('../../卡片源码/运行时/core.js'),Release=require('../../卡片源码/运行时/release.js');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(args){
 const o={};for(let i=0;i<args.length;i++){const key=args[i];assert.ok(key.startsWith('--'));if(key==='--sign'||key==='--catalog')o[key.slice(2)]=true;else {assert.ok(args[i+1]);o[key.slice(2)]=args[++i];}}
 for(const key of ['plan','card','out','host','identity'])assert.ok(o[key],'Missing --'+key);
 assert.equal(o.sign,true,'Use --sign only for an authorized release');
 assert.match(o.host,/^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+$/);
 assert.ok(!fs.existsSync(o.out),'Refuse to replace a delivered package');
 const pack=JSON.parse(fs.readFileSync(o.plan,'utf8')),card=JSON.parse(fs.readFileSync(o.card,'utf8'));
 const seed=Release.flatten(card.data.extensions.tavern_helper.scripts).find(s=>s.id===Release.UPDATER).data.__cxx_update_seed;
 if(o.catalog){assert.equal(pack.format,3);assert.equal(pack.cardId,'cyber2051');assert.equal(pack.engineVersion,Core.ENGINE_VERSION);assert.ok(Array.isArray(pack.packages));}else {Contract.checkPack(pack);Release.validate(pack,seed,Core);assert.equal(pack.version,card.data.character_version);}assert.ok(!pack.signature);
 const payload=Tools.signingBytes(pack),expected=sha(payload);
 // All substitutions are vetted JSON literals. stdin contains only canonical
 // public package bytes; the remote command never evaluates package contents.
 const remote=`const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const env=fs.readFileSync('/opt/cyber2051/etc/gateway.env','utf8');
function field(name){const line=env.split(/\\r?\\n/).find(s=>s.startsWith(name+'='));assert.ok(line,'Signing configuration missing');return line.slice(name.length+1).trim().replace(/^['"]|['"]$/g,'');}
const keyId=field('CXX_OFFICIAL_KEY_ID'),keyPath=field('CXX_OFFICIAL_SIGNING_KEY_FILE');
assert.ok(keyPath.startsWith('/etc/cyber2051/'),'Unexpected private key location');
let size=0;const chunks=[];process.stdin.on('data',b=>{size+=b.length;assert.ok(size<33554432,'Payload too large');chunks.push(b);});
process.stdin.on('end',()=>{const bytes=Buffer.concat(chunks),hash=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(hash,${JSON.stringify(expected)});
const doc=JSON.parse(bytes);assert.equal(doc.cardId,'cyber2051');assert.equal(doc.format,3);${o.catalog?"assert.ok(Array.isArray(doc.packages));":"assert.equal(doc.id,"+JSON.stringify(Release.ID)+");assert.equal(doc.version,"+JSON.stringify(pack.version)+");"}assert.ok(!doc.signature);
const key=crypto.createPrivateKey(fs.readFileSync(keyPath));assert.equal(key.asymmetricKeyType,'ed25519');
const pub=crypto.createPublicKey(key).export({type:'spki',format:'der'}).toString('base64');
assert.equal(pub,${JSON.stringify(seed.trustedKeys['cyber2051-official-20261003'])});assert.equal(keyId,'cyber2051-official-20261003');
process.stdout.write(JSON.stringify({keyId,publicKey:pub,sha256:hash,value:crypto.sign(null,bytes,key).toString('base64')}));});`;
 const code=Buffer.from(remote).toString('base64');
 const command=`node -e 'eval(Buffer.from("${code}","base64").toString("utf8"))'`;
 const result=spawnSync('ssh',['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15','-i',path.resolve(o.identity),o.host,command],{input:payload,timeout:90000,maxBuffer:1048576});
 if(result.error||result.status!==0)throw Error('Remote signing failed; no package delivered. '+(result.error?.message||result.stderr.toString().slice(0,2000)));
 const answer=JSON.parse(result.stdout);assert.equal(answer.sha256,expected);assert.equal(answer.publicKey,seed.trustedKeys[answer.keyId]);
 pack.signature={algorithm:'Ed25519',keyId:answer.keyId,value:answer.value};
 const publicKey=crypto.createPublicKey({key:Buffer.from(answer.publicKey,'base64'),type:'spki',format:'der'});
 Tools.verifyDocument(pack,{[answer.keyId]:publicKey});
 if(o.catalog)Core.validateCatalog(pack,{engineVersion:Core.ENGINE_VERSION});else Core.validatePackage(pack,{engineVersion:Core.ENGINE_VERSION});
 const bytes=Buffer.from(JSON.stringify(pack,null,2)+'\n');fs.mkdirSync(path.dirname(path.resolve(o.out)),{recursive:true});fs.writeFileSync(o.out,bytes,{flag:'wx'});
 const receipt={at:new Date().toISOString(),version:pack.version,keyId:answer.keyId,payloadSha256:expected,package:{file:path.resolve(o.out),bytes:bytes.length,sha256:sha(bytes)},officialSignatureVerified:true,privateKeyExported:false,remoteFilesWritten:false,catalogPublished:false,workshopPublished:false};
 if(o.receipt){fs.mkdirSync(path.dirname(path.resolve(o.receipt)),{recursive:true});fs.writeFileSync(o.receipt,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});}
 console.log(JSON.stringify(receipt,null,2));return receipt;
}
module.exports={main};if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
