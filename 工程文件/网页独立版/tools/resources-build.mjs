/** Publish individual, content-addressed files from the existing verified resource pack. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {ROOT,WEB} from './workspace-paths.mjs';
const require=createRequire(import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJSON=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
/** Original gallery URLs include percent-encoded slashes; map them to maintained image files. */
export function galleryResources(){
 const urls=new Set(),walk=value=>{if(typeof value==='string'&&value.startsWith('https://cyber2051.top/img/')&&/\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test(value))urls.add(value);else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')Object.values(value).forEach(walk);};walk(readJSON('卡片源码/终端/content/gallery.json'));
 const roots=['网站/img','../网站/img','../图片/赛博小祥2051/角色立绘','../图片/日常','../图片/瑟瑟','../图片/NSFW'].map(dir=>path.resolve(ROOT,dir));
 return [...urls].sort().map(url=>{const relative=decodeURIComponent(new URL(url).pathname.slice('/img/'.length)),candidates=[...roots.map(root=>path.join(root,relative)),path.resolve(ROOT,'../图片/瑟瑟',path.basename(relative))],file=candidates.find(file=>fs.existsSync(file)&&fs.statSync(file).isFile());if(!file)throw Error('图库维护文件缺失：'+relative);const data=fs.readFileSync(file);return {file,source:path.relative(ROOT,file).split(path.sep).join('/'),sha256:hash(data),bytes:data.length,mime:({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'})[path.extname(file).toLowerCase()]||'application/octet-stream',aliases:[url,'https://cyber2051.top/img/'+relative,'https://cyber2051.top/img/'+relative.split('/').map(encodeURIComponent).join('/'),'https://cyber2051.top/img/'+encodeURIComponent(relative)]};});
}
export function writeResources({resourcePack,gallery=galleryResources(),out=path.join(WEB,'generated/assets')}={}){
 if(!resourcePack?.manifest||!resourcePack.files)throw new Error('资源构建需要当前卡片构建器的已验证 resourcePack');
 const rows=[],standing=readJSON('卡片源码/Gal/standing-inventory.json').assets,logical=new Map(standing.map(a=>[a.sha256,a]));
 function put(entry,data,{category='media',source,aliases=[],fileName}={}){
  const sha256=hash(data);if(entry.sha256&&sha256!==entry.sha256||entry.id&&/^[a-f0-9]{64}$/.test(entry.id)&&sha256!==entry.id||entry.bytes!==undefined&&data.length!==entry.bytes)throw new Error('资源指纹不符：'+(entry.id||fileName));
  const name=fileName||entry.file||sha256+'.'+(entry.mime||'application/octet-stream').split('/')[1],rel=category==='atlas'?'atlas/'+name:sha256.slice(0,16)+'/'+path.basename(name),target=path.join(out,rel);
  fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target))fs.writeFileSync(target,data);else if(fs.statSync(target).size!==data.length||hash(fs.readFileSync(target))!==sha256)throw new Error('同哈希资源路径已有不同内容：'+rel);
  rows.push({id:entry.id||sha256,url:'assets/'+rel,sha256,bytes:data.length,mime:entry.mime||'application/octet-stream',source:source||'maintained-resource-pack',use:category,optional:true,aliases:[...new Set([...(entry.aliases||[]),...aliases])]});
 }
 for(const entry of resourcePack.manifest.entries){const item=resourcePack.files.get(entry.id);if(!item)throw new Error('资源缺失：'+entry.id);const actor=logical.get(entry.id),data=item.data||fs.readFileSync(item.source);put(entry,data,{category:actor?'standing':entry.aliases?.some(a=>/background/i.test(a))?'background':'ui',source:actor?'../'+readJSON('卡片源码/Gal/standing-inventory.json').sourceDirectory+'/'+actor.source.path:item.source?path.relative(ROOT,item.source).split(path.sep).join('/'):'资源/P4玩家资源包',aliases:[resourcePack.manifest.baseUrl+entry.file,'#cxxasset-'+entry.id,...(actor?[actor.id]:[])]});}
 const byHash=new Map(rows.map(row=>[row.sha256,row]));for(const entry of gallery){const existing=byHash.get(entry.sha256);if(existing){existing.aliases=[...new Set([...existing.aliases,...entry.aliases])];continue;}put({id:entry.sha256,sha256:entry.sha256,bytes:entry.bytes,mime:entry.mime},fs.readFileSync(entry.file),{category:'gallery',source:entry.source,aliases:entry.aliases,fileName:path.basename(entry.file)});byHash.set(entry.sha256,rows.at(-1));}
 const config=readJSON('卡片源码/地图/resources.json'),atlasRoot=path.join(ROOT,'网站/atlas'),manifestFile=path.join(atlasRoot,config.manifest.path),manifestBytes=fs.readFileSync(manifestFile);
 if(hash(manifestBytes)!==config.manifest.sha256||manifestBytes.length!==config.manifest.bytes)throw new Error('地图维护清单与本机发布文件不符');
 const index=JSON.parse(manifestBytes),references=new Map([[config.manifest.path,config.manifest]]);
 const scan=value=>{if(!value||typeof value!=='object')return;if(value.path&&value.sha256&&Number.isInteger(value.bytes))references.set(value.path,value);for(const item of Object.values(value))if(item&&typeof item==='object')scan(item);};scan(index);
 // GPU bundle references are inside compressed trusted map documents.
 const zlib=require('node:zlib'),B=require('../../工具/lib/card-ast.cjs');
 for(const document of Object.values(index.documents||{})){const page=fs.readFileSync(path.join(atlasRoot,document.page.path)),html=zlib.gunzipSync(page).toString('utf8');for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){if(!script[1].startsWith('window.CXX_ATLAS_GPU_ASSETS='))continue;const assignment=B.acorn.parse(script[1],{ecmaVersion:'latest'}).body[0].expression;scan(JSON.parse(script[1].slice(assignment.right.start,assignment.right.end)));}}
 for(const [name,entry]of references){if(!/^[a-f0-9]{64}\.(json|gz|bin)$/.test(name))throw new Error('地图文件名不符');put({...entry,id:entry.sha256,mime:name.endsWith('.json')?'application/json':name.endsWith('.gz')?'application/gzip':'application/octet-stream'},fs.readFileSync(path.join(atlasRoot,name)),{category:'atlas',fileName:name,source:'网站/atlas/'+name,aliases:[config.baseURL+name]});}
 const live=require('../../工具/lib/offline-resources.cjs')(ROOT,{file:'资源/爱音Live2D-v2.zip'});
 for(const entry of live.manifest.entries)put(entry,live.entries.get(entry.file),{category:'live2d',source:'资源/爱音Live2D-v2.zip/'+entry.file,aliases:[live.manifest.baseUrl+entry.file,'live2d/'+entry.file],fileName:entry.file});
 const fontRoot=path.join(WEB,'vendor/fonts'),fonts=JSON.parse(fs.readFileSync(path.join(fontRoot,'sources.json'),'utf8'));
 for(const entry of fonts.files)put({...entry,id:'font/noto-sc/'+entry.weight},fs.readFileSync(path.join(fontRoot,entry.file)),{category:'font',fileName:entry.file,source:'网页独立版/vendor/fonts/'+entry.file,aliases:[entry.url]});
 put({id:'font/noto-sc/license',sha256:fonts.license.sha256,mime:'text/plain'},fs.readFileSync(path.join(fontRoot,fonts.license.file)),{category:'font-license',fileName:'OFL-Noto-CJK.txt',source:'网页独立版/vendor/fonts/LICENSE',aliases:[fonts.license.url]});
 return {files:rows,atlas:{...config,baseURL:'assets/atlas/'},live2d:live.manifest,bytes:rows.reduce((n,r)=>n+r.bytes,0),count:rows.length};
}
