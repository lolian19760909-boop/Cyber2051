/** Prepare the concrete upload candidate; never connect to or activate production. */
import fs from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import path from 'node:path';import {fileURLToPath} from 'node:url';import {ROOT,WEB} from './workspace-paths.mjs';
export function prepareSite({out=path.join(WEB,'artifacts/site-candidate')}={}){
 const receipt=JSON.parse(fs.readFileSync(path.join(WEB,'reports/build.json'),'utf8')),current=JSON.parse(fs.readFileSync(path.join(receipt.out,'current.json'),'utf8'));
 if(current.release!==receipt.buildId)throw Error('构建报告与当前入口不同，请先完成同一次构建');
 const play=path.join(out,'gateway/public/play'),release=path.join(play,'releases',receipt.buildId);fs.mkdirSync(release,{recursive:true});
 const copy=(from,to)=>{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);};
 const manifest=JSON.parse(fs.readFileSync(path.join(receipt.appDir,'release-manifest.json'),'utf8'));
 for(const row of manifest.files){const from=path.join(receipt.appDir,row.path),to=path.join(release,row.path);fs.mkdirSync(path.dirname(to),{recursive:true});if(row.path.startsWith('assets/')&&!fs.existsSync(to)){try{fs.linkSync(from,to);continue;}catch{}}copy(from,to);}
 copy(path.join(receipt.appDir,'release-manifest.json'),path.join(release,'release-manifest.json'));
 copy(path.join(receipt.out,'index.html'),path.join(play,'index.html'));
 // Local build history is not the production rollback history. On upgrades select-release reads
 // the server's existing pointer; this null-previous pointer is for a first installation only.
 fs.writeFileSync(path.join(play,'current.json'),JSON.stringify({...current,previous:null})+'\n');
 for(const name of fs.readdirSync(path.join(ROOT,'网站/gateway')).filter(name=>name==='server.js'||name==='package.json'||name==='contract-places.json'||name.endsWith('.cjs')&&!/(?:-fixtures|\.fixture)\.cjs$/.test(name)))copy(path.join(ROOT,'网站/gateway',name),path.join(out,'gateway',name));
 for(const name of fs.readdirSync(path.join(ROOT,'网站/caddy')).filter(name=>name==='Caddyfile'||name.endsWith('.caddy')))copy(path.join(ROOT,'网站/caddy',name),path.join(out,'caddy',name));
 const publicSource=path.join(ROOT,'网站/gateway/public'),websiteFiles=[];
 function website(dir,relative=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(!relative&&entry.name==='play')continue;const name=path.posix.join(relative,entry.name),source=path.join(dir,entry.name);if(entry.isDirectory())website(source,name);else if(entry.isFile()){copy(source,path.join(out,'gateway/public',name));websiteFiles.push({path:name,sha256:createHash('sha256').update(fs.readFileSync(source)).digest('hex')});}}}
 website(publicSource);

 const require=createRequire(import.meta.url),moduleEntries={CXX_FORMAT3_PACKAGES_MODULE:'工具/发布/packages.cjs',CXX_GAMEPLAY_MODULE:'卡片源码/运行时/gameplay.js',CXX_CONTENT_MODULE:'卡片源码/运行时/content.js'},backendFiles=[],visited=new Set();
 function backend(module){if(!module||visited.has(module.filename))return;visited.add(module.filename);const relative=path.relative(ROOT,module.filename);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('后端模块位于工程外：'+module.filename);copy(module.filename,path.join(out,'backend',relative));backendFiles.push({path:relative.split(path.sep).join('/'),sha256:createHash('sha256').update(fs.readFileSync(module.filename)).digest('hex')});module.children.forEach(backend);}
 for(const entry of Object.values(moduleEntries)){const file=path.join(ROOT,entry);require(file);backend(require.cache[file]);}

 copy(path.join(WEB,'tools/select-release.mjs'),path.join(out,'select-release.mjs'));
 const report={at:new Date().toISOString(),buildId:receipt.buildId,contentVersion:receipt.contentVersion,out,release,files:manifest.files.length,websiteFiles,moduleEntries,backendFiles,bytes:manifest.bytes,activation:'first installation pointer has no previous; on upgrades use select-release against the existing production pointer',scope:'prepared static/gateway/Caddy upload candidate only; no production changes; excludes environment, databases, storage and player records'};
 fs.writeFileSync(path.join(WEB,'reports/site-candidate.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(prepareSite(),null,2));
