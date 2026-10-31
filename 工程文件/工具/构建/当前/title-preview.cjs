'use strict';
const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir=path.resolve(__dirname,'../../../卡片源码/运行时');
(async()=>{const art=JSON.parse(fs.readFileSync(path.join(dir,'menu-assets.json'))),out={};
for(const [id,width]of [['city',640],['Saki',360],['wordmark',560]]){const original=Buffer.from(art.entries[id].fallback.split(',')[1],'base64'),bytes=await sharp(original).resize({width,withoutEnlargement:true}).webp({quality:id==='wordmark'?75:55}).toBuffer();out[id]='data:image/webp;base64,'+bytes.toString('base64');console.log(id,bytes.length);}
fs.writeFileSync(path.join(dir,'title-preview.json'),JSON.stringify(out)+'\n');})();
