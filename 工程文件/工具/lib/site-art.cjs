'use strict';
// Reuse the actual game UI artwork. This only decodes/copies maintained assets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),project=path.dirname(root);
function build(){
 const hub=JSON.parse(fs.readFileSync(path.join(root,'卡片源码/运行时/hub-assets.json'),'utf8'));
 const out=path.join(root,'网站/gateway/public/assets/game-ui');fs.mkdirSync(out,{recursive:true});
 const rows=[];
 function write(name,bytes,source){const file=path.join(out,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);rows.push({path:'assets/game-ui/'+name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),source});}
 for(const [key,name]of Object.entries({font:'rajdhani.woff2',wordmark:'wordmark.webp',background:'city.webp',menuPlate:'menu-plate.webp'}))write(name,Buffer.from(hub[key].slice(hub[key].indexOf(',')+1),'base64'),'卡片源码/运行时/hub-assets.json#'+key);
 fs.rmSync(path.join(out,'menu-frame.png'),{force:true});
 const ascii=path.join(project,'资料/设计/加载界面-ASCII-20261026/ascii-sakiko-run-v6');
 for(const file of ['pieces/sakiko-run.js','lib/kit.js','LICENSE','NOTICE'])write('ascii/'+file,fs.readFileSync(path.join(ascii,file)),'资料/设计/加载界面-ASCII-20261026/ascii-sakiko-run-v6/'+file);
 for(const name of ['player.js','canvas.js','glyphs.js'])write('ascii/runtime/'+name,fs.readFileSync(path.join(root,'网站/visual-kit/ascii-runtime',name)),'网站/visual-kit/ascii-runtime/'+name);
 for(const name of ['LICENSE','NOTICE'])write('ascii/RUNTIME-'+name,fs.readFileSync(path.join(root,'网站/visual-kit/ascii-runtime',name)),'网站/visual-kit/ascii-runtime/'+name);
 fs.writeFileSync(path.join(root,'网页独立版/reports/site-art.json'),JSON.stringify({at:new Date().toISOString(),source:'existing game artwork and author-approved Sakiko ASCII v6',files:rows},null,2)+'\n');
 return rows;
}
module.exports={build};
if(require.main===module)console.log(JSON.stringify(build().map(({path,bytes})=>({path,bytes})),null,2));
