'use strict';
// Re-encode supplied art for the card fallback; composition/cropping remains CSS.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../../..'),project=path.dirname(root);
async function build(){
 const backgrounds=JSON.parse(fs.readFileSync(path.join(root,'卡片源码/Gal/media-inventory.json'))).files;
 const standing=JSON.parse(fs.readFileSync(path.join(root,'卡片源码/Gal/standing-media.json'))).files;
 const entries={};
 async function add(id,file,source,url,width){const bytes=await sharp(source).resize({width,withoutEnlargement:true}).webp({quality:78}).toBuffer();entries[id]={file,url,source:path.relative(project,source).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),fallback:'data:image/webp;base64,'+bytes.toString('base64'),bytes:bytes.length};}
 for(const [id,file]of [['city','2051CG_core_midnight.png'],['ring','2051CG_RING_midnight.png'],['mujica','2051CG_core_mujica hideout_balcony.png']]){const item=backgrounds.find(x=>x.file===file);await add(id,file,path.join(project,'图片/2051_backgroundCG',file),item.url,1600);}
 for(const id of ['Saki','Tomorin','Anon','Soyo','Taki','Rana','Uika','Mutsumi','Umiri','Nyamu']){const a=standing.find(x=>x.characterId===id&&x.expressionId==='normal');await add(id,a.file,path.join(project,'图片/2051_character_Tachi',a.file),'https://cyber2051.top/img/galgame/standing/'+a.sha256.slice(0,16)+'/'+encodeURIComponent(a.file),id==='Saki'?900:480);}
 await add('wordmark','Tokyo2051-logo-v223.png',path.join(root,'卡片源码/主题/assets/Tokyo2051-logo-v223.png'),null,1200);
 const common=new Set(Object.values(entries).map(e=>e.url).filter(Boolean)),files=[...backgrounds.map(f=>({file:f.file,url:f.url,bytes:f.bytes,sha256:f.sha256})),...standing.map(f=>({file:f.file,url:'https://cyber2051.top/img/galgame/standing/'+f.sha256.slice(0,16)+'/'+encodeURIComponent(f.file),bytes:fs.statSync(path.join(project,'图片/2051_character_Tachi',f.file)).size,sha256:f.sha256}))].map(f=>({...f,common:common.has(f.url)}));
 const hubManifest=path.join(root,'资料/参考/2077菜单人物-20261011/云端素材清单.json');if(fs.existsSync(hubManifest))files.push(...JSON.parse(fs.readFileSync(hubManifest)).files.map(({id,local,...entry})=>entry));
 fs.writeFileSync(path.join(root,'卡片源码/运行时/media-pack.json'),JSON.stringify({schema:1,id:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),files},null,2)+'\n');
 const output=path.join(root,'卡片源码/运行时/menu-assets.json');fs.writeFileSync(output,JSON.stringify({schema:1,source:'本卡既有背景与人物立绘；现有 VPS 原图，随卡 WebP 备用；Tokyo 2051 字标由 GPT Image 生成并随卡打包；CSS 响应式裁切',entries},null,2)+'\n');
 console.log(JSON.stringify({output,count:Object.keys(entries).length,bytes:Object.values(entries).reduce((n,a)=>n+a.bytes,0)}));
}
if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={build};
