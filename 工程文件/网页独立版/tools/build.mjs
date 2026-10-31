/** One static application for public hosting and the ST extension. Sources stay in their maintenance directories. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {createHash} from 'node:crypto';
import { buildContent,ROOT,WEB } from './content-build.mjs';
import {releaseEntry,bootstrapEntry} from './entry-loading.mjs';
import {buildPlayerPack} from './player-pack-build.mjs';
import {buildWebpAssets,applyWebpVariants} from './webp-build.mjs';
import {buildDatabase} from './database-build.mjs';
import {lintContent} from './preset-lint.mjs';
export async function build({out=path.join(WEB,'dist'),cardCheckpoint=true}={}){
  const {manifest,card,presets,ui,nativeCard}=await buildContent();
  const lint=lintContent({card,presets});
  if(!lint.ok)throw new Error('内容预检未通过（源头拦截，未打包）：'+lint.findings.slice(0,8).map(row=>row.scope+' · '+row.message).join('；'));
  const webp=await buildWebpAssets(manifest);applyWebpVariants(manifest,webp.variants);
  const playerPack=await buildPlayerPack(manifest);
  (await import('./mirror-snapshot.mjs')).snapshotMirror();
  if(fs.existsSync(path.join(WEB,'tools/p3a-adapt-views.mjs')))(await import('./p3a-adapt-views.mjs')).adaptViews();
  fs.mkdirSync(out,{recursive:true});
  for(const dir of ['src','web'])fs.cpSync(path.join(WEB,dir),path.join(out,dir),{recursive:true,filter:file=>!file.includes(path.sep+'fixtures'+path.sep)&&!file.endsWith(path.sep+'fixtures')});
  fs.cpSync(path.join(WEB,'generated/opening-ui'),path.join(out,'opening-ui'),{recursive:true});
  buildDatabase(out);
  fs.writeFileSync(path.join(out,'index.html'),releaseEntry(fs.readFileSync(path.join(WEB,'web/index.html'),'utf8')));
  const data=path.join(out,'data');fs.mkdirSync(data,{recursive:true});
  fs.writeFileSync(path.join(data,'player-pack.json'),JSON.stringify(playerPack)+'\n');
  for(const [name,value]of Object.entries({'card.json':card,'preset.json':presets[0].preset,'presets.json':presets,'manifest.json':manifest}))fs.writeFileSync(path.join(data,name),JSON.stringify(value)+'\n');
  fs.copyFileSync(path.join(WEB,'generated/ui.json'),path.join(data,'ui.json'));fs.copyFileSync(path.join(WEB,'generated/map-runtime.js'),path.join(data,'map-runtime.js'));
  fs.copyFileSync(path.join(WEB,'generated/memory-contract.json'),path.join(data,'memory-contract.json'));
  for(const name of ['knowledge-index.json','agent-prompts.json','worldbook-classification.json'])fs.copyFileSync(path.join(WEB,'generated',name),path.join(data,name));
  copyAssets(path.join(WEB,'generated/assets'),path.join(out,'assets'));
  copyAssets(path.join(WEB,'generated/assets-webp'),path.join(out,'assets-webp'));
  for(const group of ['context/core','visual/runtime']){
    const from=path.join(ROOT,'配套扩展/tavern-runtime-suite',group),to=path.join(out,'shared',group==='context/core'?'context':'visual/runtime');
    if(group==='context/core'){fs.mkdirSync(to,{recursive:true});for(const name of ['data-clone.js','requests.js','compact.js'])fs.copyFileSync(path.join(from,name),path.join(to,name));}
    else fs.cpSync(from,to,{recursive:true});
  }
  fs.cpSync(path.join(ROOT,'配套扩展/tavern-runtime-suite/visual/recipes'),path.join(out,'shared/visual/recipes'),{recursive:true});
  fs.cpSync(path.join(WEB,'shared/mirror'),path.join(out,'shared/mirror'),{recursive:true});
  fs.mkdirSync(path.join(out,'site'),{recursive:true});fs.copyFileSync(path.join(ROOT,'网站/gateway/public/site.css'),path.join(out,'site/site.css'));
  for(const name of ['theme.css','theme-runtime.js'])fs.copyFileSync(path.join(ROOT,'网站/gateway/public',name),path.join(out,'site',name));
  fs.cpSync(path.join(ROOT,'网站/gateway/public/assets/game-ui'),path.join(out,'site/assets/game-ui'),{recursive:true});
  fs.copyFileSync(path.join(ROOT,'网站/gateway/public/user.js'),path.join(out,'user.js'));
  for(const source of manifest.sources){if(!source.path.startsWith('卡片源码/'))continue;const rel=source.path.slice(5),target=path.join(out,'card',rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(ROOT,source.path),target);}
  const release=freezeRelease(out,manifest);
  fs.copyFileSync(path.join(WEB,'src/assets/cache-worker.mjs'),path.join(out,'resource-worker.js'));
  for(const layer of Object.values(playerPack.layers)){
   const packedFile=path.join(out,'resources',playerPack.version,layer.id,layer.name),source=path.join(ROOT,'资源',layer.name);fs.mkdirSync(path.dirname(packedFile),{recursive:true});if(fs.existsSync(packedFile))continue;try{fs.linkSync(source,packedFile);}catch{fs.copyFileSync(source,packedFile);}
  }
  const local=path.join(out,'local');fs.mkdirSync(local,{recursive:true});fs.copyFileSync(path.join(WEB,'tools/local-runtime.mjs'),path.join(local,'launcher.mjs'));fs.copyFileSync(path.join(WEB,'tools/select-release.mjs'),path.join(local,'select-release.mjs'));for(const name of ['play-connect.cjs','vertex-auth.cjs'])fs.copyFileSync(path.join(ROOT,'网站/gateway',name),path.join(local,name));
  fs.writeFileSync(path.join(out,'启动.cmd'),'@echo off\r\ncd /d "%~dp0"\r\nnode local/launcher.mjs %*\r\npause\r\n');
  fs.writeFileSync(path.join(out,'使用说明.md'),'# 东京都2051本地候选\n\n需要Node.js 24或更新版。双击启动.cmd，打开 http://127.0.0.1:2051/?mode=local 。免Discord登录，可以使用在线模型。请保持同一浏览器、域名及端口，浏览器存档按origin分区。先在菜单导出完整备份，再清浏览器数据或升级。\n\n模型Key由玩家自行配置。首次开始游玩时，祥子加载页下载并缓存3.1.0公共层与所选画质层，完成后进入游戏；同版已缓存资源之后复用。此目录可整体移动，运行不读取维护工程。releases保留不可变版本，current.json为当前入口；回退前先备份存档，再把current.json的release改为已保留版本并关闭、重启本机启动器。引擎回退不会自动降级已迁移存档。\n\n这是部署与作者验收候选；检查回执见维护工程reports。真实模型/设备体验由作者验收，具体部署状态见上线交接。\n');
  let nativeCardReceipt;
  if(cardCheckpoint){const cardFile=path.join(WEB,'artifacts/网页接入验收成卡.json');fs.mkdirSync(path.dirname(cardFile),{recursive:true});const cardBytes=Buffer.from(JSON.stringify(nativeCard)+'\n');fs.writeFileSync(cardFile,cardBytes);nativeCardReceipt={file:cardFile,bytes:cardBytes.length,sha256:createHash('sha256').update(cardBytes).digest('hex'),gate:'checkpoint package; maintained full card, not a published release'};}
  const receipt={at:new Date().toISOString(),out,...release,engineVersion:manifest.engineVersion,contentVersion:manifest.contentVersion,sourceHash:manifest.sourceHash,preflight:{ok:true,...lint.counts},webp:{generated:webp.generated,available:webp.available,quality:webp.quality},...(nativeCardReceipt?{nativeCard:nativeCardReceipt}:{}),scope:'static and loopback candidate; no deployment or real-model/device acceptance'};
  fs.writeFileSync(path.join(WEB,'reports/build.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
export async function buildExtension({out=path.join(WEB,'artifacts/st-extension'),appOut=path.join(WEB,'dist'),appReceipt}={}){
  const receipt=appReceipt||await build({out:appOut});fs.mkdirSync(out,{recursive:true});
  for(const name of fs.readdirSync(path.join(WEB,'tavern-extension')).filter(name=>/\.(?:mjs|json)$/.test(name))){const from=path.join(WEB,'tavern-extension',name),to=path.join(out,name);if(name.endsWith('.mjs'))fs.writeFileSync(to,fs.readFileSync(from,'utf8').replace(/(['"])\.\.\/src\//g,'$1./app/src/'));else fs.copyFileSync(from,to);}
  fs.cpSync(receipt.appDir,path.join(out,'app'),{recursive:true,filter:file=>path.relative(receipt.appDir,file)!=='assets'&&!path.relative(receipt.appDir,file).startsWith('assets'+path.sep)});copyAssets(path.join(receipt.appDir,'assets'),path.join(out,'app/assets'));
  const files=fs.readdirSync(path.join(WEB,'tavern-extension')).filter(name=>/\.(?:mjs|json)$/.test(name)).map(name=>{const bytes=fs.readFileSync(path.join(out,name));return {path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}),extensionReceipt={schema:1,appBuildId:receipt.buildId,contentVersion:receipt.contentVersion,files};
  fs.writeFileSync(path.join(out,'extension-receipt.json'),JSON.stringify(extensionReceipt)+'\n');
  // 安装身份回执：扩展、内嵌 app 与角色卡各一段指纹，运行期据此自检是不是同一版。
  const nativeCard=JSON.parse(fs.readFileSync(receipt.nativeCard.file,'utf8'));
  const lens=await (await import('../src/platform/identity.mjs')).cardLens(nativeCard);
  const fileMeta=relative=>{const bytes=fs.readFileSync(path.join(receipt.appDir,relative));return {path:'app/'+relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
  const countApp=dir=>{let count=0,total=0;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(path.relative(receipt.appDir,full).split(path.sep)[0]==='assets')continue;if(entry.isDirectory()){const nested=countApp(full);count+=nested.files;total+=nested.bytes;}else{count++;total+=fs.statSync(full).size;}}return {files:count,bytes:total};};
  const appTotals=countApp(receipt.appDir);
  // U11: which external origins this build actually reaches for, plus the Skill template receipt.
  const genManifest=(()=>{try{return JSON.parse(fs.readFileSync(path.join(WEB,'generated/manifest.json'),'utf8'));}catch{return {};}})();
  const identity={schema:1,at:new Date().toISOString(),buildId:receipt.buildId,engineVersion:receipt.engineVersion,contentVersion:receipt.contentVersion,sourceHash:receipt.sourceHash,
    loader:{remoteOrigins:scanRemoteOrigins(receipt.appDir),template:genManifest.knowledge?.template||null},
    extension:{files},
    app:{buildId:receipt.buildId,entry:fileMeta('index.html'),releaseManifest:fileMeta('release-manifest.json'),files:appTotals.files,bytes:appTotals.bytes},
    card:{file:path.basename(receipt.nativeCard.file),bytes:receipt.nativeCard.bytes,sha256:receipt.nativeCard.sha256,lens}};
  fs.writeFileSync(path.join(out,'identity.json'),JSON.stringify(identity)+'\n');
  const result={...receipt,extension:out,extensionReceipt,identity};
  fs.writeFileSync(path.join(WEB,'reports/build-extension.json'),JSON.stringify(result,null,2)+'\n');return result;
}
function freezeRelease(out,manifest){
 const sha=value=>createHash('sha256').update(value).digest('hex'),files=[];
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,e.name),rel=path.relative(out,full).split(path.sep).join('/');if(['releases','local','resources'].includes(rel.split('/')[0])||['current.json','release-manifest.json','resource-worker.js','启动.cmd','使用说明.md'].includes(rel))continue;if(e.isDirectory())walk(full);else{const bytes=fs.readFileSync(full);files.push({path:rel,bytes:bytes.length,sha256:sha(bytes)});}}};walk(out);files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 const buildId=sha(JSON.stringify(files)).slice(0,20),appDir=path.join(out,'releases',buildId),metadata={schema:1,buildId,engineVersion:manifest.engineVersion,contentVersion:manifest.contentVersion,promptVersion:manifest.promptVersion,sourceHash:manifest.sourceHash,files,bytes:files.reduce((n,f)=>n+f.bytes,0)};
 if(!fs.existsSync(appDir)){fs.mkdirSync(appDir,{recursive:true});for(const row of files){const from=path.join(out,row.path),to=path.join(appDir,row.path);fs.mkdirSync(path.dirname(to),{recursive:true});if(row.path.startsWith('assets/')){try{fs.linkSync(from,to);continue;}catch{}}fs.copyFileSync(from,to);}fs.writeFileSync(path.join(appDir,'release-manifest.json'),JSON.stringify(metadata)+'\n');}
 let old;try{old=JSON.parse(fs.readFileSync(path.join(out,'current.json'),'utf8'));}catch{}fs.writeFileSync(path.join(out,'current.json'),JSON.stringify({schema:1,release:buildId,previous:old?.release!==buildId?old?.release||null:old?.previous||null,contentVersion:manifest.contentVersion})+'\n');
 fs.writeFileSync(path.join(out,'index.html'),bootstrapEntry(buildId));
 return {buildId,appDir,files:files.length,bytes:metadata.bytes};
}
const TEXT_EXT=['.mjs','.js','.json','.html','.css','.txt'];
const HOST_CHARS='abcdefghijklmnopqrstuvwxyz0123456789.-';
/** Scans shipped text for absolute http(s) origins; local file reads stay out of the list. */
function scanRemoteOrigins(root){
  const found=new Set(),skip=new Set(['www.w3.org','json-schema.org','localhost','127.0.0.1']);
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name),rel=path.relative(root,full).split(path.sep)[0];if(rel==='assets')continue;if(entry.isDirectory()){walk(full);continue;}if(!TEXT_EXT.some(ext=>entry.name.toLowerCase().endsWith(ext)))continue;let text='';try{const stat=fs.statSync(full);if(stat.size>2*1024*1024)continue;text=fs.readFileSync(full,'utf8').toLowerCase();}catch{continue;}const parts=text.split('://');for(let index=1;index<parts.length;index++){const head=parts[index-1].slice(-5);if(!head.endsWith('http')&&!head.endsWith('https'))continue;let host='';for(const ch of parts[index]){if(HOST_CHARS.includes(ch))host+=ch;else break;}if(!host||skip.has(host))continue;found.add(host);}}};
  try{walk(root);}catch{return [];}
  return [...found].sort().slice(0,16);
}
function copyAssets(from,to){fs.mkdirSync(to,{recursive:true});for(const entry of fs.readdirSync(from,{withFileTypes:true})){const source=path.join(from,entry.name),target=path.join(to,entry.name);if(entry.isDirectory())copyAssets(source,target);else if(!fs.existsSync(target)){try{fs.linkSync(source,target);}catch{fs.copyFileSync(source,target);}}}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(process.argv.includes('--extension')?await buildExtension():await build({cardCheckpoint:!process.argv.includes('--web-only')}),null,2));
