'use strict';
const fs=require('node:fs'),path=require('node:path'),B=require('../当前/build.cjs');
const out=path.join(B.root,'交付/组件/2.3.0-P4-待验收');
async function build({write=false,outputDir=out,fileName='东京都2051-V2.3.0-P4-待验收.json',evidenceDir=path.join(B.root,'.cache/memory-p4'),guideFile=path.join(B.root,'卡片源码/长期记忆/P4.md')}={}){
 const {card,receipt}=await B.build();
 const file=path.join(outputDir,fileName);
 if(write){
  fs.mkdirSync(outputDir,{recursive:true});fs.writeFileSync(file,JSON.stringify(card,null,2)+'\n');
  const evidence=evidenceDir;fs.mkdirSync(evidence,{recursive:true});
  fs.writeFileSync(path.join(evidence,'build.json'),JSON.stringify({...receipt,output:{...receipt.output,file},phase:'P4-content-import',acceptance:'author performs gameplay and model tests'},null,2)+'\n');
  const guide=guideFile;
  if(fs.existsSync(guide))fs.writeFileSync(path.join(outputDir,'使用说明.md'),fs.readFileSync(guide,'utf8').replace('(P3.md)','(../../../卡片源码/长期记忆/P3.md)').replace('(../../资料/设计/','(../../../资料/设计/'));
 }
 return {file,version:card.data.character_version,entries:card.data.character_book.entries.length,scripts:card.data.extensions.tavern_helper.scripts.length,written:write};
}
module.exports={build,out};
if(require.main===module){const cleanup=process.argv.includes('--ui-cleanup');build({write:process.argv.includes('--write'),...(cleanup?{outputDir:path.join(B.root,'交付/组件/2.3.0-P4-UI整理-20261016'),fileName:'东京都2051-V2.3.0-P4-UI整理-候选.json',evidenceDir:path.resolve(B.root,'../.cache/p4-ui-cleanup-20261016'),guideFile:path.join(B.root,'卡片源码/长期记忆/P4-UI整理.md')}:{})}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});}
