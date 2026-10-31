/** Layered player packs: common assets, WebP standard images, original PNG images.
 *  Every layer is a normal stored ZIP with its own content hash, so cache-worker can install,
 *  resume, verify and later remove one layer without touching the other installed quality. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {ROOT,WEB} from './workspace-paths.mjs';
const {writePack}=createRequire(import.meta.url)('../../工具/lib/resource-pack.cjs');
const hash=value=>createHash('sha256').update(value).digest('hex');
const MIME={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.m4a':'audio/mp4','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const VERSION='3.1.0';
const receiptAt=name=>path.join(ROOT,'资源',name+'.json');
function readReceipt(name){try{return JSON.parse(fs.readFileSync(receiptAt(name),'utf8'));}catch{return null;}}
function collect(manifest,kind){
  const rows=new Map(),sources=new Map();
  function add(row,source,alias){
    const id=row.sha256,prior=rows.get(id);
    if(prior){prior.aliases=[...new Set([...prior.aliases,...(row.aliases||[]),alias].filter(Boolean))].sort();return;}
    const ext=path.extname(source).slice(1).toLowerCase()||'bin';
    rows.set(id,{id,mime:row.mime||MIME['.'+ext]||'application/octet-stream',bytes:row.bytes,file:id+'.'+ext,aliases:[...new Set([...(row.aliases||[]),alias].filter(Boolean))].sort()});
    sources.set(id,source);
  }
  if(kind==='webp'){
    for(const row of manifest.resources.files){
      const variant=row.variants?.webp;if(!variant)continue;
      add({sha256:variant.id,bytes:variant.bytes,mime:'image/webp',aliases:[...(row.aliases||[]),row.url,variant.url,'#cxxasset-'+variant.id]},path.join(WEB,'generated',variant.url),variant.url);
    }
  }else{
    for(const row of manifest.resources.files){
      const hasVariant=Boolean(row.variants?.webp);
      if(kind==='png'&&!hasVariant)continue;
      if(kind==='common'&&hasVariant)continue;
      add(row,path.join(WEB,'generated',row.url),row.url);
    }
    if(kind==='common')for(const [directory,prefix]of [[path.join(WEB,'generated/opening-ui/assets'),'opening-ui/assets/'],[path.join(ROOT,'网站/gateway/public/assets/game-ui'),'site/assets/game-ui/']]){
      for(const name of fs.readdirSync(directory).sort()){const source=path.join(directory,name);if(!fs.statSync(source).isFile()||!MIME[path.extname(name).toLowerCase()])continue;const bytes=fs.readFileSync(source);add({sha256:hash(bytes),bytes:bytes.length,mime:MIME[path.extname(name).toLowerCase()]},source,prefix+name);}
    }
  }
  return {rows:[...rows.values()].sort((a,b)=>a.id.localeCompare(b.id)),sources};
}
async function writeLayer(key,{rows,sources}){
  const id=hash(JSON.stringify(rows)),name='P4-'+key+'-'+VERSION+'.zip',target=path.join(ROOT,'资源',name),receipt=readReceipt(name),files=new Map();
  for(const row of rows)files.set(row.id,{source:sources.get(row.id)});
  let written;
  if(!receipt||receipt.manifest!==id||!fs.existsSync(target)||fs.statSync(target).size!==receipt.bytes){
    written=await writePack(target+'.tmp',{manifest:{schema:1,version:VERSION,id,entries:rows},files});
    const digest=createHash('sha256');for await(const chunk of fs.createReadStream(target+'.tmp'))digest.update(chunk);fs.renameSync(target+'.tmp',target);
    written={...written,file:name,version:VERSION,sha256:digest.digest('hex'),assets:rows.length,resourceBytes:rows.reduce((n,e)=>n+e.bytes,0)};
    fs.writeFileSync(receiptAt(name),JSON.stringify(written,null,2)+'\n');
  }else written=receipt;
  return {key,id,version:VERSION,bytes:written.bytes,sha256:written.sha256,resourceBytes:written.resourceBytes,download:'/resources/'+VERSION+'/'+id+'/'+encodeURIComponent(name),name,entries:rows};
}
export async function buildPlayerPack(manifest){
  const layers={
    common:await writeLayer('common',collect(manifest,'common')),
    webp:await writeLayer('webp',collect(manifest,'webp')),
    png:await writeLayer('png',collect(manifest,'png')),
  };
  const packs={};
  for(const [key,keys]of [['standard',['common','webp']],['original',['common','png']]]){
    const list=keys.map(name=>layers[name]);
    packs[key]={id:hash(JSON.stringify(list.map(layer=>layer.id))),layers:keys,bytes:list.reduce((n,layer)=>n+layer.bytes,0),resourceBytes:list.reduce((n,layer)=>n+layer.resourceBytes,0)};
  }
  const entries=[...new Map([...layers.common.entries,...layers.webp.entries,...layers.png.entries].map(entry=>[entry.id,entry])).values()].sort((a,b)=>a.id.localeCompare(b.id));
  const catalog={schema:2,version:VERSION,id:hash(JSON.stringify(Object.values(layers).map(layer=>layer.id))),layers,packs,entries,bytes:Object.values(layers).reduce((n,layer)=>n+layer.bytes,0),resourceBytes:Object.values(layers).reduce((n,layer)=>n+layer.resourceBytes,0)};
  fs.writeFileSync(path.join(WEB,'generated/player-pack.json'),JSON.stringify(catalog)+'\n');
  return catalog;
}
