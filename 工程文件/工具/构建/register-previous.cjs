'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=value=>createHash('sha256').update(value).digest('hex');
function register({cardFile,write=false}){
 assert(cardFile,'Provide --card with the exact previously delivered JSON');
 const bytes=fs.readFileSync(cardFile),card=JSON.parse(bytes),up=card.data.extensions.tavern_helper.scripts.find(s=>s.id===require('../../卡片源码/运行时/release.js').UPDATER),seed=up?.data?.__cxx_update_seed;
 assert.equal(seed?.cardId,'cyber2051');assert(seed.migration?.buildId&&seed.migration.saveSchema,'Previous card lacks a migration identity');
 const registryFile=path.join(__dirname,'旧版来源.json'),acceptsFile=path.join(__dirname,'当前续玩来源.json'),registry=JSON.parse(fs.readFileSync(registryFile)),accepts=JSON.parse(fs.readFileSync(acceptsFile));
 const updaterSHA256=sha(up.content),cardSHA256=sha(bytes),existing=registry.sources.find(s=>s.sha256===updaterSHA256);
 const migration={buildId:seed.migration.buildId,saveSchema:seed.migration.saveSchema};
 let addedSource=false,addedMigration=false;
 if(existing)assert.deepEqual(Object.fromEntries(Object.entries(existing.seedRefs).map(([k,i])=>[k,registry.seedValues[i]])),seed,'Same updater hash has a different seed; inspect the actual source');
 else{
  const indices=new Map(registry.seedValues.map((value,i)=>[JSON.stringify(value),i])),seedRefs={};
  for(const [key,value]of Object.entries(seed)){const text=JSON.stringify(value);if(!indices.has(text)){indices.set(text,registry.seedValues.length);registry.seedValues.push(value);}seedRefs[key]=indices.get(text);}
  registry.sources.push({name:`东京都2051-V${card.data.character_version}-${cardSHA256.slice(0,12)}.json`,sha256:updaterSHA256,seedRefs});addedSource=true;
 }
 if(!accepts.some(v=>v.buildId===migration.buildId&&v.saveSchema===migration.saveSchema)){accepts.push(migration);addedMigration=true;}
 if(write){if(addedSource)fs.writeFileSync(registryFile,JSON.stringify(registry,null,2)+'\n');if(addedMigration)fs.writeFileSync(acceptsFile,JSON.stringify(accepts,null,2)+'\n');}
 return {cardFile:path.resolve(cardFile),cardSHA256,updaterSHA256,...migration,addedSource,addedMigration,written:write};
}
module.exports={register};
if(require.main===module){const args=process.argv.slice(2),index=args.indexOf('--card');try{console.log(JSON.stringify(register({cardFile:index<0?undefined:args[index+1],write:args.includes('--write')})));}catch(e){console.error(e.message);process.exitCode=1;}}
