#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const Core=require("../../卡片源码/运行时/core.js"),Release=require("../../卡片源码/运行时/release.js"),Tools=require('./packages.cjs');
const {componentsOf}=require("../lib/updater.cjs");
const Contract=require('./release-contract.cjs');
const PluginCheck=require('../../卡片源码/运行时/plugin-check.js'),{extract}=require('../lib/script-modules.cjs'),{parse,findNodes}=require('../lib/source-edits.cjs');
const clone=v=>structuredClone(v),hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const data=card=>card.data||card,updater=card=>Release.flatten(data(card).extensions.tavern_helper.scripts).find(s=>s.id===Release.UPDATER);
function pluginRequirements(card){
  const versions=Release.flatten(data(card).extensions.tavern_helper.scripts).flatMap(script=>extract(script.content||'',['CxxPluginCheck']).map(part=>{
    const declarations=findNodes(parse(part.source),node=>node.type==='VariableDeclarator'&&node.id?.name==='VERSION');
    assert.equal(declarations.length,1,'Frozen card must declare one Suite minimum per plugin checker');
    return declarations[0].init?.value;
  }));
  assert.ok(versions.length,'Frozen card is missing its plugin dependency declaration');
  for(const version of versions)assert.equal(version,PluginCheck.VERSION,'Frozen card Suite dependency differs from maintained plugin-check.VERSION; rebuild before publishing');
  return [{id:'suite',version:PluginCheck.VERSION,required:true}];
}
async function prepare({card,previous,notes='',updaterUpgrade=null}){
  const now=updater(card),old=updater(previous);assert.ok(now&&old,'Both cards must contain the independent updater');
  if(now.content!==old.content){
    assert.equal(updaterUpgrade?.type,'cyber2051.updater-upgrade','Independent updater changed: supply the explicit upgrade tool manifest');
    assert.equal(updaterUpgrade.updaterId,Release.UPDATER);
    assert.equal(updaterUpgrade.targetHash,hash(now.content),'Upgrade tool must contain the target updater');
    assert.ok(updaterUpgrade.sources.some(s=>s.sha256===hash(old.content)),'Upgrade tool must recognize this baseline updater');
  }
  const seed=now.data.__cxx_update_seed,oldSeed=old.data.__cxx_update_seed,version=data(card).character_version;
  const resourceProfile=JSON.parse(fs.readFileSync(path.join(__dirname,'../../资源/resource-profile.json'),'utf8')),resourceReceipt=JSON.parse(fs.readFileSync(path.join(__dirname,'../../资源/P4玩家资源包-'+resourceProfile.version+'.zip.json'),'utf8'));
  Contract.checkSeeds(seed,oldSeed);
  assert.equal(oldSeed.release?.protocol,1,'Use 2.0.41 or a later independent-updater baseline');
  assert.ok(Core.compareVersions(version,data(previous).character_version)>0,'Target version must increase');
  assert.equal(seed.migration.saveSchema,oldSeed.migration.saveSchema,'Save schema changed: supply a separately implemented migration before publishing');
  const components=clone(componentsOf(data(card)));
  // Exclude the updater, even if it was put inside a folder in the authoring card.
  function remove(nodes){return nodes.filter(n=>n.id!==Release.UPDATER).map(n=>n.type==='folder'?{...n,scripts:remove(n.scripts)}:n);}
  components.scripts.trees=remove(components.scripts.trees);
  const baseRegistry=clone(seed.registry),base=baseRegistry.packages['cyber2051.base-content'];if(base)base.version=version;
  const contentSeed={};for(const key of ['initialContent','initialAvatars','mapIndex','characterIds','migration'])if(seed[key]!==undefined)contentSeed[key]=clone(seed[key]);
  contentSeed.registry=baseRegistry;
  const baseline=await Core.fingerprints(components),buildId='card:'+await Core.sha256(baseline);
  contentSeed.migration.buildId=buildId;
  const pack={format:3,cardId:'cyber2051',id:Release.ID,kind:'core',optional:false,version,requires:{engine:'1.4.0',packages:[]},components,
    release:{protocol:1,updaterId:Release.UPDATER,minBaseVersion:'2.0.41',saveSchema:seed.migration.saveSchema,buildId,notes,seed:contentSeed,
      resources:[{id:'cyber2051.resources',version:resourceProfile.version,manifestId:resourceReceipt.manifest}],plugins:pluginRequirements(card),...(updaterUpgrade?{updater:{manifest:clone(updaterUpgrade),content:now.content}}:{})}};
  Release.validate(pack,oldSeed,Core);
  Contract.checkPack(pack);
  const oldOwned=Release.ownership(componentsOf(data(previous))),newOwned=Release.ownership(components),changes={};
  for(const k of Object.keys(oldOwned))changes[k]={previous:oldOwned[k].length,next:newOwned[k].length,added:newOwned[k].filter(x=>!oldOwned[k].includes(x)),removed:oldOwned[k].filter(x=>!newOwned[k].includes(x))};
  const oldComponents=componentsOf(data(previous)),oldPrints=await Core.fingerprints(oldComponents);
  const transport=oldComponents.worldbook.entries.filter(e=>changes.worldbook.removed.includes(e.uid)&&e.extra&&Object.keys(e.extra).length===1&&Object.hasOwn(e.extra,'__cxx_card_extensions')).map(e=>{
    const record=oldPrints.worldbook.entries.records['number:'+e.uid];
    return {uid:e.uid,hash:record.hash,extraHash:record.retained.extra};
  });
  if(transport.length)pack.release.worldbookTransportBaselines=transport;
  Release.validate(pack,oldSeed,Core);
  return {pack,changes};
}
function sign({pack,privateKey,keyId,previousCatalog=null}){
  const signed=Tools.signDocument(pack,privateKey,keyId),bytes=Buffer.from(JSON.stringify(signed,null,2)+'\n');
  Core.validatePackage(signed,{engineVersion:Core.ENGINE_VERSION});
  const item={id:pack.id,kind:pack.kind,optional:false,version:pack.version,requires:pack.requires,title:'东京都2051',notes:pack.release.notes,url:'https://cyber2051.top/updates/v3/packages/'+pack.id+'/'+pack.version+'.json',bytes:bytes.length,sha256:hash(bytes)};
  const catalog=Tools.signDocument({format:3,cardId:'cyber2051',engineVersion:Core.ENGINE_VERSION,packages:[item,...(previousCatalog?.packages||[]).filter(p=>p.id!==pack.id)]},privateKey,keyId);
  Core.validateCatalog(catalog,{engineVersion:Core.ENGINE_VERSION});return {pack:signed,bytes,catalog};
}
async function main(args){
  const o={};for(let i=0;i<args.length;i+=2){assert.ok(args[i].startsWith('--')&&args[i+1],'Use --option value');o[args[i].slice(2)]=args[i+1];}
  if(!o.card||!o.previous||!o.out)throw Error('用法：node release-package.cjs --previous 旧卡.json --card 新卡.json --notes 说明.txt --out 输出目录 [--key 私钥.pem --key-id 发布密钥编号] [--catalog 已有目录.json]');
  const card=JSON.parse(fs.readFileSync(o.card,'utf8')),previous=JSON.parse(fs.readFileSync(o.previous,'utf8'));
  const prepared=await prepare({card,previous,notes:o.notes?fs.readFileSync(o.notes,'utf8'):'',updaterUpgrade:o['updater-upgrade']?JSON.parse(fs.readFileSync(o['updater-upgrade'],'utf8')):null}),out=path.resolve(o.out);
  fs.mkdirSync(out,{recursive:true});
  if(!o.key){fs.writeFileSync(path.join(out,'release-plan.json'),JSON.stringify(prepared.pack,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({mode:'unsigned-plan',out,changes:prepared.changes},null,2));return;}
  assert.ok(o['key-id'],'Signing requires --key-id');
  const privateKey=crypto.createPrivateKey(fs.readFileSync(o.key)),pub=crypto.createPublicKey(privateKey).export({type:'spki',format:'der'}).toString('base64');
  assert.equal(updater(previous).data.__cxx_update_seed.trustedKeys[o['key-id']],pub,'Signing key does not match the baseline card');
  const result=sign({pack:prepared.pack,privateKey,keyId:o['key-id'],previousCatalog:o.catalog?JSON.parse(fs.readFileSync(o.catalog,'utf8')):null});
  const dir=path.join(out,'updates/v3/packages',Release.ID);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,prepared.pack.version+'.json'),result.bytes,{flag:'wx'});
  fs.writeFileSync(path.join(out,'updates/v3/release-manifest.json'),JSON.stringify(result.catalog,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(out,'release-receipt.json'),JSON.stringify({at:new Date().toISOString(),version:prepared.pack.version,packageSha256:hash(result.bytes),packageBytes:result.bytes.length,changes:prepared.changes,published:false},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({mode:'signed-local-release',out,version:prepared.pack.version,changes:prepared.changes},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={prepare,sign,pluginRequirements};
