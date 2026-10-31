'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const token=id=>'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E#cxxasset-'+id;
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b){let c=0xffffffff;for(const n of b)c=crcTable[(c^n)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function make({card,root,version,set}){
 const files=new Map(),references=new Set(),patterns=/data:image\/(png|webp|jpeg|gif);base64,[A-Za-z0-9+/]+={0,2}/g;
 let occurrences=0,inlineBytes=0;
 function visit(value,parts=[]){if(typeof value==='string'){
  const next=value.replace(patterns,(uri,mime)=>{const data=Buffer.from(uri.slice(uri.indexOf(',')+1),'base64');if(data.length<2048)return uri;const id=hash(data);occurrences++;inlineBytes+=Buffer.byteLength(uri);if(!files.has(id))files.set(id,{id,mime:'image/'+mime,bytes:data.length,data,aliases:[]});return token(id);});for(const m of next.matchAll(/#cxxasset-([a-f0-9]{64})/g))references.add(m[1]);if(next!==value)set(parts,next);
 }else if(Array.isArray(value))value.forEach((v,i)=>visit(v,[...parts,i]));else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))visit(v,[...parts,k]);}
 // Only executable resources and updater metadata; authored narrative is untouched.
 for(let i=0;i<card.data.extensions.tavern_helper.scripts.length;i++){const s=card.data.extensions.tavern_helper.scripts[i];visit(s.content,['data','extensions','tavern_helper','scripts',i,'content']);if(s.data)visit(s.data,['data','extensions','tavern_helper','scripts',i,'data']);}
 const readResources=require('./offline-resources.cjs'),archive=readResources(root,{master:true}),remote=JSON.parse(fs.readFileSync(path.join(root,'卡片源码/运行时/media-pack.json'),'utf8'));
 const master=new Map(archive.manifest.entries.map(e=>[e.id,e]));
 for(const id of references)if(!files.has(id)){const e=master.get(id),data=e&&archive.entries.get(e.file);if(!e||!data||data.length!==e.bytes||hash(data)!==id)throw Error('资源引用缺少已验证母版：'+id);files.set(id,{id,mime:e.mime,bytes:e.bytes,data,aliases:[]});}
 const packed=f=>archive?.entries.get(f.sha256+'.'+(path.extname(f.file).slice(1)==='jpg'?'jpeg':path.extname(f.file).slice(1)));
 const local=[],byName=new Map();
 function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='node_modules'||entry.name==='.git'||entry.isSymbolicLink())continue;const file=path.join(dir,entry.name);if(entry.isDirectory())collect(file);else if(entry.isFile())local.push(file);}}
 if(remote.files.some(f=>!packed(f)))collect(path.dirname(root));
 for(const f of local){const name=path.basename(f);if(!byName.has(name))byName.set(name,[]);byName.get(name).push(f);}
 for(const f of remote.files){const data=packed(f),source=data?undefined:(byName.get(f.file)||[]).find(p=>fs.statSync(p).size===f.bytes&&hash(fs.readFileSync(p))===f.sha256);if(data){if(data.length!==f.bytes||hash(data)!==f.sha256)throw Error('基础资源与登记不符：'+f.file);}else if(!source)throw Error('离线包缺少已登记原图：'+f.file);let entry=files.get(f.sha256);if(!entry){entry={id:f.sha256,mime:'image/'+(path.extname(f.file).slice(1)==='jpg'?'jpeg':path.extname(f.file).slice(1)),bytes:f.bytes,...(data?{data}:{source}),aliases:[]};files.set(f.sha256,entry);}entry.aliases.push(f.url);}
 // Keep the approved title wordmark at its original pixel dimensions.
 const logoSource=path.join(root,'卡片源码/主题/assets/Tokyo2051-logo-v223.png'),logo=fs.readFileSync(logoSource),logoId=hash(logo);
 if(!files.has(logoId))files.set(logoId,{id:logoId,mime:'image/png',bytes:logo.length,source:logoSource,aliases:[]});
 const ids=new Map(),sizes=new Map();let order;
 if(archive.profile?.provenance){
  const player=readResources(root),proof=JSON.parse(fs.readFileSync(path.resolve(root,archive.profile.provenance),'utf8'));
  if(!player||proof.sourceManifest!==archive.manifest.id||proof.manifest!==player.manifest.id||proof.archiveSHA256!==hash(fs.readFileSync(player.file)))throw Error('玩家派生包与来源回执不符');
  if((archive.profile.version||version)!==version||player.manifest.version!==(archive.profile.baseVersion||version))throw Error('玩家资源版本与构建版本不符');
  if(hash(JSON.stringify(player.manifest.entries))!==player.manifest.id)throw Error('玩家资源清单指纹不符');
  const derived=new Map(player.manifest.entries.map(e=>[e.id,e])),sources=new Map(proof.assets.map(e=>[e.sourceId,e]));
  order=new Map(player.manifest.entries.map((e,i)=>[e.id,i]));
  if(sources.size!==files.size||derived.size!==files.size)throw Error('玩家资源覆盖范围不符');
  for(const [id,entry]of [...files]){
   const origin=sources.get(id),target=derived.get(origin?.id),data=target&&player.entries.get(target.file);
   if(!origin||origin.sourceBytes!==entry.bytes||!target||!data||data.length!==target.bytes||hash(data)!==target.id||JSON.stringify(target.aliases)!==JSON.stringify(entry.aliases))throw Error('玩家派生资源不匹配：'+id);
   ids.set(id,target.id);sizes.set(id,origin.size);files.delete(id);files.set(target.id,{...target,data});
  }
  // Remap only resource tokens generated above, never player text or old URL aliases.
  function remap(value,parts){if(typeof value==='string'){const next=value.replace(/#cxxasset-([a-f0-9]{64})/g,(raw,id)=>ids.has(id)?'#cxxasset-'+ids.get(id):raw);if(next!==value)set(parts,next);}else if(Array.isArray(value))value.forEach((v,i)=>remap(v,[...parts,i]));else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))remap(v,[...parts,k]);}
  for(let i=0;i<card.data.extensions.tavern_helper.scripts.length;i++){const s=card.data.extensions.tavern_helper.scripts[i];remap(s.content,['data','extensions','tavern_helper','scripts',i,'content']);if(s.data)remap(s.data,['data','extensions','tavern_helper','scripts',i,'data']);}
 }
 let enhancedAssets=0,enhancedBytes=0;
 if(archive.profile?.enhanced){
  const inventoryFile=path.resolve(root,archive.profile.enhanced),inventory=JSON.parse(fs.readFileSync(inventoryFile,'utf8')),base=path.dirname(inventoryFile),replacements=new Map();
  for(const asset of inventory.assets){
   const oldId=ids.get(asset.sourceId)||asset.sourceId,source=path.resolve(base,asset.file),relative=path.relative(base,source),previous=files.get(oldId);
   if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!previous||replacements.has(oldId)||asset.mime!=='image/webp')throw Error('高清素材来源不符：'+asset.key);
   const data=fs.readFileSync(source);
   if(data.length!==asset.bytes||hash(data)!==asset.id||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP')throw Error('高清素材指纹不符：'+asset.key);
   files.set(asset.id,{id:asset.id,mime:asset.mime,bytes:asset.bytes,source,aliases:[]});replacements.set(oldId,asset.id);ids.set(asset.sourceId,asset.id);enhancedAssets++;enhancedBytes+=asset.bytes;
  }
  function remap(value,parts){if(typeof value==='string'){const next=value.replace(/#cxxasset-([a-f0-9]{64})/g,(raw,id)=>replacements.has(id)?'#cxxasset-'+replacements.get(id):raw);if(next!==value)set(parts,next);}else if(Array.isArray(value))value.forEach((v,i)=>remap(v,[...parts,i]));else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))remap(v,[...parts,k]);}
  for(let i=0;i<card.data.extensions.tavern_helper.scripts.length;i++){const s=card.data.extensions.tavern_helper.scripts[i];remap(s.content,['data','extensions','tavern_helper','scripts',i,'content']);if(s.data)remap(s.data,['data','extensions','tavern_helper','scripts',i,'data']);}
 }
 let standingAssets=0,standingBytes=0,standingAliasReplacements=0;
 if(archive.profile?.standing){
  const inventory=JSON.parse(fs.readFileSync(path.resolve(root,archive.profile.standing),'utf8')),sourceRoot=path.resolve(root,'..',inventory.sourceDirectory);
  const aliases=new Set();
  for(const asset of inventory.assets){
   const source=path.resolve(sourceRoot,asset.source.path),relative=path.relative(sourceRoot,source);
   if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!asset.remoteUrl.startsWith('https://cyber2051.top/img/galgame/standing/'))throw Error('立绘来源或地址不符：'+asset.file);
   const data=fs.readFileSync(source);
   if(data.length!==asset.bytes||hash(data)!==asset.sha256||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||aliases.has(asset.remoteUrl))throw Error('立绘指纹或别名重复：'+asset.file);
   aliases.add(asset.remoteUrl);
   // Current original PNGs own their exact URLs; retained derived tokens keep their bytes.
   for(const entry of files.values())if(entry.id!==asset.sha256&&entry.aliases.includes(asset.remoteUrl)){entry.aliases=entry.aliases.filter(url=>url!==asset.remoteUrl);standingAliasReplacements++;}
   let entry=files.get(asset.sha256);
   if(!entry){entry={id:asset.sha256,mime:'image/png',bytes:asset.bytes,source,aliases:[]};files.set(entry.id,entry);}
   if(!entry.aliases.includes(asset.remoteUrl))entry.aliases.push(asset.remoteUrl);
   standingAssets++;standingBytes+=asset.bytes;
  }
 }
 const entries=[...files.values()].map(({id,mime,bytes,aliases})=>({id,mime,bytes,file:id+'.'+mime.split('/')[1],aliases}));
 if(order)entries.sort((a,b)=>(order.get(a.id)??Number.MAX_SAFE_INTEGER)-(order.get(b.id)??Number.MAX_SAFE_INTEGER));
 const id=hash(JSON.stringify(entries));
 const manifest={schema:1,version,id,baseUrl:'https://cyber2051.top/resources/'+version+'/'+id+'/',entries};
 return {manifest,files,token:id=>token(ids.get(id)||id),dimensions:id=>sizes.get(id),stats:{occurrences,inlineBytes,unique:entries.length,resourceBytes:entries.reduce((n,e)=>n+e.bytes,0),standingAssets,standingBytes,standingAliasReplacements,enhancedAssets,enhancedBytes}};
}
async function writePack(file,pack){
 await fs.promises.mkdir(path.dirname(file),{recursive:true});const handle=await fs.promises.open(file,'w');let offset=0;const directory=[];
 try{const manifest=Buffer.from(JSON.stringify(pack.manifest));
  for(const item of [{name:'manifest.json',data:manifest},...pack.manifest.entries.map(e=>({name:e.file,entry:pack.files.get(e.id)}))]){
   const data=item.data||item.entry.data||await fs.promises.readFile(item.entry.source),name=Buffer.from(item.name),crc=crc32(data),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
   directory.push({offset,name,crc,size:data.length});for(const b of [header,name,data]){await handle.write(b,0,b.length,offset);offset+=b.length;}
  }
  const start=offset;
  for(const e of directory){const b=Buffer.alloc(46);b.writeUInt32LE(0x02014b50);b.writeUInt16LE(20,4);b.writeUInt16LE(20,6);b.writeUInt32LE(e.crc,16);b.writeUInt32LE(e.size,20);b.writeUInt32LE(e.size,24);b.writeUInt16LE(e.name.length,28);b.writeUInt32LE(e.offset,42);for(const data of [b,e.name]){await handle.write(data,0,data.length,offset);offset+=data.length;}}
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(directory.length,8);end.writeUInt16LE(directory.length,10);end.writeUInt32LE(offset-start,12);end.writeUInt32LE(start,16);await handle.write(end,0,end.length,offset);
 }finally{await handle.close();}
 return {file,bytes:fs.statSync(file).size,manifest:pack.manifest.id};
}
module.exports={make,writePack,token};
