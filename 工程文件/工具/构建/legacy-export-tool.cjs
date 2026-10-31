'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {extract}=require('../lib/script-modules.cjs'),{inlineSource}=require('../lib/inline-source.cjs');
const acorn=require('D:/SillyTavern/node_modules/acorn');
const root=path.resolve(__dirname,'../..');
const targetFile=path.join(root,'交付/基线/2.3.0-整理前.json');
const artifactName='cyber2051-legacy1x-export-2-2-11-r2';
function make({write=false}={}){
  const card=JSON.parse(fs.readFileSync(targetFile,'utf8'));
  if(card.data.character_version!=='2.2.11')throw Error('Expected exact 2.2.11 target');
  const updater=card.data.extensions.tavern_helper.scripts.find(script=>script.id==='cf33c692-7a41-444d-b8b7-6a70163e0104');
  if(updater.data.__cxx_update_seed.migration.contract!=='cyber2051.raw-save.v1')throw Error('Target raw-save contract missing');
  const names=['CxxSha256','CxxCrypto','CxxPhoneCore','CxxUpdateCore','CxxUpdateBackup'];
  const modules=extract(updater.content,names);
  const patchedBackup=extract(inlineSource(fs.readFileSync(path.join(root,'卡片源码/运行时/backup.js'),'utf8')),['CxxUpdateBackup'])[0];
  if(!patchedBackup)throw Error('Patched backup module missing');
  const transport=names.map(name=>{const found=modules.filter(value=>value.name===name);if(found.length!==1)throw Error('Missing target module '+name);return name==='CxxUpdateBackup'?patchedBackup.source:found[0].source;}).join('\n;\n');
  const source=fs.readFileSync(path.join(root,'卡片源码/运行时/legacy-export.js'),'utf8');
  const entry=`;(function(){let view;const tool=CxxLegacyExport.create({api:globalThis,report:message=>view?.report(message)});view=CxxLegacyExport.mount({document:parent.document,tool,subscribe:show=>{const event=getButtonEvent('1.x旧版存档导出');eventOn(event,show);return()=>eventRemoveListener(event,show);}});window.addEventListener('pagehide',()=>view.destroy(),{once:true});})();`;
  const content=inlineSource(transport+'\n;\n'+source+'\n'+entry);
  acorn.parse(content,{ecmaVersion:'latest',sourceType:'module'});
  const script={type:'script',id:'cxx-legacy1x-export-211',name:'2051｜1.x旧版存档导出 → 2.2.11（R2）',enabled:true,content,
    info:'导入酒馆助手全局脚本，打开1.0.0／1.2.0旧卡的原聊天，点击“1.x旧版存档导出”。准备并下载后，在2.2.11“卡更新 → 换卡续玩”导入为副本。每个旧聊天分别导出。新版已移除好感度系统，按2.2.11现行规则继续游玩。',
    button:{enabled:true,buttons:[{name:'1.x旧版存档导出',visible:true}]},data:{},export_with:{data:true,button:true}};
  const spec={schemaVersion:1,deliveryMode:'component',kind:'helper-script',items:[{artifactName,value:script}]};
  if(write){const dir=path.join(root,'.cache/legacy1x');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'component-spec.json'),JSON.stringify(spec,null,2)+'\n');fs.writeFileSync(path.join(dir,artifactName+'.script.json'),JSON.stringify(script,null,2)+'\n');}
  return {script,spec,targetFile,artifactName,targetSha256:crypto.createHash('sha256').update(fs.readFileSync(targetFile)).digest('hex')};
}
module.exports={make,root};
if(require.main===module){const result=make({write:process.argv.includes('--write')});console.log(JSON.stringify({artifactName:result.artifactName,bytes:Buffer.byteLength(result.script.content),targetSha256:result.targetSha256},null,2));}
