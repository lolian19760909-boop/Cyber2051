'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
async function main(){
 const args=process.argv.slice(2),index=args.indexOf('--previous-card'),previous=index<0?process.env.CXX_PREVIOUS_CARD:args[index+1];
 assert(previous,'Provide --previous-card with the exact previous candidate JSON');
 const registration=require('../register-previous.cjs').register({cardFile:previous});
 assert(!registration.addedSource&&!registration.addedMigration,'Previous candidate is not registered. Run register-previous.cjs --card <same JSON> --write, then verify again.');
 const build=await require('./build.cjs').build({write:true}),root=require('./build.cjs').root,steps=[];
 for(const [file,...args] of [['tests.cjs'],['tests.cjs','--data-fallback'],['upgrade-check.cjs'],['../../../测试/当前/runtime-compat-browser.cjs']]){
  const result=spawnSync(process.execPath,[path.resolve(__dirname,file),...args],{encoding:'utf8',maxBuffer:8e6,env:{...process.env,CXX_TEST_CARD:build.receipt.output.file,CXX_PREVIOUS_CARD:path.resolve(previous)}});
  process.stdout.write(result.stdout);process.stderr.write(result.stderr);steps.push({file,args,exitCode:result.status});
  assert.equal(result.status,0,'Verification failed: '+file);
 }
 const receipt={card:build.receipt.output,previous:registration,steps};
 const file=path.join(root,'.cache/mirror220/verify-current.json');fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({verified:receipt.card,receipt:file}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
