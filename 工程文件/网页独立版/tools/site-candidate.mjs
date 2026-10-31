/** Prepare the concrete upload candidate; never connect to or activate production. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {ROOT,WEB} from './workspace-paths.mjs';
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
 for(const name of fs.readdirSync(path.join(ROOT,'网站/gateway')).filter(name=>name==='server.js'||name==='package.json'||name.endsWith('.cjs')))copy(path.join(ROOT,'网站/gateway',name),path.join(out,'gateway',name));
 for(const name of fs.readdirSync(path.join(ROOT,'网站/caddy')).filter(name=>name==='Caddyfile'||name.endsWith('.caddy')))copy(path.join(ROOT,'网站/caddy',name),path.join(out,'caddy',name));
 copy(path.join(WEB,'tools/select-release.mjs'),path.join(out,'select-release.mjs'));
 const report={at:new Date().toISOString(),buildId:receipt.buildId,contentVersion:receipt.contentVersion,out,release,files:manifest.files.length,bytes:manifest.bytes,activation:'first installation pointer has no previous; on upgrades use select-release against the existing production pointer',scope:'prepared static/gateway/Caddy upload candidate only; no production changes; excludes environment, databases, storage and player records'};
 fs.writeFileSync(path.join(WEB,'reports/site-candidate.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(prepareSite(),null,2));
