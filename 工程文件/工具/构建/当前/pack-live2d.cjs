'use strict';
// The existing optional model pack owns its renderer libraries as well as art.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function build({write=false}={}){
 const original=require('../../lib/offline-resources.cjs')(root,{file:'资源/爱音Live2D-v1.zip'}),files=new Map(),entries=original.manifest.entries.map(e=>({...e}));
 for(const e of entries){const data=original.entries.get(e.file);assert(data&&data.length===e.bytes&&hash(data)===e.id,e.file);files.set(e.id,{data});}
 for(const file of require('../../lib/live2d-build.cjs').vendors){const data=fs.readFileSync(path.join(root,'卡片源码/Live2D',file)),e={file,id:hash(data),bytes:data.length,mime:'text/javascript'};assert(!entries.some(e=>e.file===file));entries.push(e);files.set(e.id,{data});}
 const id=hash(JSON.stringify(entries)),manifest={...original.manifest,version:'2',id,entries,compatible:[original.manifest.id],baseUrl:'https://cyber2051.top/resources/live2d-anon/'+id+'/'};
 const file=path.join(root,'资源/爱音Live2D-v2.zip');let receipt={file,manifest:id,models:original.manifest.entries.length,libraries:entries.length-original.manifest.entries.length,libraryBytes:entries.slice(original.manifest.entries.length).reduce((n,e)=>n+e.bytes,0),modelBytesUnchanged:true};
 if(write){receipt={...receipt,...await require('../../lib/resource-pack.cjs').writePack(file,{manifest,files})};fs.writeFileSync(path.join(root,'卡片源码/Live2D/manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(file+'.json',JSON.stringify(receipt,null,2)+'\n');}
 return receipt;
}
module.exports={build};if(require.main===module)build({write:process.argv.includes('--write')}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
