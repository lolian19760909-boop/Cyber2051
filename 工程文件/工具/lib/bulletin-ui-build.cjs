'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),prefix='../网页独立版/';
function assets(source){
 const css=source(prefix+'web/bulletin/notice.css'),references=[...new Set([...css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)].map(m=>m[1]))];
 return {schema:1,assets:references.map(reference=>{const file=path.posix.normalize('网页独立版/web/bulletin/'+reference),bytes=fs.readFileSync(path.join(root,file)),sha256=crypto.createHash('sha256').update(bytes).digest('hex');return {reference,source:file,bytes:bytes.length,sha256,url:'https://cyber2051.top/resources/bulletin/'+sha256+'/'+encodeURIComponent(path.basename(file))};})};
}

// The web controller and view are the maintained implementation for both hosts.
// Native cards carry the layout and guides; existing immutable UI art stays shared.
function runtime(source){
 const base='https://cyber2051.top/resources/bulletin/',inventory=JSON.parse(source('../资源/公告/manifest.json'));
 assert.deepEqual(inventory,assets(source),'公告美术来源变化，请运行 node 工程文件/工具/lib/bulletin-ui-build.cjs --write');
 const view=source(prefix+'src/ui/bulletin-view.mjs').replace('export function mountBulletinView','function mountBulletinView');
 const controller=source(prefix+'src/ui/bulletin.mjs').replace(/^import .*;\s*$/gm,'').replace(/export function /g,'function ');
 const css=source('主题/tokens.css')+'\n'+source(prefix+'web/bulletin/notice.css').replace(/url\(["']?([^)'"\s]+)["']?\)/g,(_,relative)=>{
  return 'url("'+inventory.assets.find(asset=>asset.reference===relative).url+'")';
 });
 const layout={html:source(prefix+'web/bulletin/dialog.html'),css,authored:JSON.parse(source(prefix+'web/bulletin/content.json')).items};
 const logo=JSON.parse(source('运行时/menu-assets.json')).entries.wordmark.fallback;
 return '(function(){const appUrl=relative=>new URL(relative,"https://cyber2051.top/play/").href;'+view+'\n'+controller+'\nglobalThis.CxxBulletin={createBulletin,layout:'+JSON.stringify(layout)+',logo:'+JSON.stringify(logo)+',base:'+JSON.stringify(base)+'};})();';
}
module.exports={runtime,assets};
if(require.main===module){assert(process.argv.includes('--write'),'Use --write to refresh the reviewed asset manifest');const manifest=assets(file=>fs.readFileSync(path.resolve(root,'卡片源码',file),'utf8')),file=path.join(root,'资源/公告/manifest.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({assets:manifest.assets.length,bytes:manifest.assets.reduce((n,a)=>n+a.bytes,0),file}));}
