'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../卡片源码/数值引擎'),repo=path.resolve(root,'../..'),digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'reference/baseline.json'),'utf8'));
const sourceChecks=baseline.sources.map(entry=>({...entry,currentSha256:digest(path.join(repo,entry.file))}));
if(sourceChecks.some(entry=>entry.sha256!==entry.currentSha256))throw Error('Maintained source changed; inspect the parallel change before asserting preservation.');
const originalRoot=path.join(repo,"工程文件/资料/设计/讨论材料/2026-10-07-角色卡更新/轻量数值引擎/实施前");
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
const beforeChecks=walk(originalRoot).map(file=>({source:path.relative(originalRoot,file).split(path.sep).join('/'),beforeSha256:digest(file),currentSha256:digest(path.join(repo,path.relative(originalRoot,file)))}));
if(beforeChecks.some(entry=>entry.beforeSha256!==entry.currentSha256))throw Error('A maintained source differs from the pre-task snapshot.');
fs.writeFileSync(path.join(root,'evidence/source-preservation.json'),JSON.stringify({date:'2026-10-07',unchanged:true,sourceChecks,beforeChecks,cardEmbedding:false,previewCardCreated:false},null,2)+'\n');
const files=walk(root).filter(file=>path.relative(root,file)!==path.join('evidence','manifest.json')).map(file=>({path:path.relative(root,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:digest(file)}));
fs.writeFileSync(path.join(root,'evidence/manifest.json'),JSON.stringify({date:'2026-10-07',project:'tokyo2051-numeric-engine',version:'0.1.0',files},null,2)+'\n');
console.log(JSON.stringify({files:files.length+1,maintainedSourcesPreserved:beforeChecks.length,cardEmbedded:false,previewCardCreated:false}));
