'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=process.env.CXX_EVIDENCE||path.join(root,'.cache/ui-motion-20261024');
const files=['当前/terminal-assembly','当前/build-transforms','当前/theme-runtime','当前/plugin-check','当前/map-document','当前/quest-view','当前/quest-actions','当前/character-comparison','运行时/location-catalog','Gal/terminal-numeric-ownership','当前/preferences-save'].map(file=>path.join(root,'测试',file+'.test.cjs'));
const result=spawnSync(process.execPath,['--require',path.join(root,'工具/lib/ui-motion-test-preload.cjs'),'--test','--test-concurrency=1',...files],{encoding:'utf8',maxBuffer:8e6,env:{...process.env,CXX_TEST_CARD:process.env.CXX_TEST_CARD||path.join(out,'candidate.json')}});
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'regression.txt'),result.stdout+result.stderr);
const receipt={exitCode:result.status,files,totals:(result.stdout+result.stderr).split('\n').filter(l=>/^ℹ (tests|pass|fail|skipped|duration_ms)|^✖/.test(l))};fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));process.exitCode=result.status;
