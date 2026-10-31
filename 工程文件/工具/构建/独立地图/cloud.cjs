'use strict';
const B=require('../../lib/card-ast.cjs'),{fs,path,root,read,assert,acorn}=B,zlib=require('node:zlib');
const input=path.join(root,'交付/基线/2.3.0-整理前.json'),cache=path.join(root,'.cache/atlas'),publicDir=path.join(cache,'public'),baseURL='https://cyber2051.top/atlas/';
async function resources(native){
 const files=new Map(),parity=[];
 function put(data,extension){const bytes=Buffer.isBuffer(data)?data:Buffer.from(data),sha256=B.sha(bytes),name=sha256+'.'+extension;files.set(name,bytes);return {path:name,sha256,bytes:bytes.length};}
 const compress=text=>put(zlib.gzipSync(text,{level:9}),'gz');
 let pinned;
 B.walk(acorn.parse(native,{ecmaVersion:'latest'}),node=>{if(node.type==='CallExpression'&&node.callee.object?.name==='CxxAtlasResourcesFactory'&&node.callee.property?.name==='create'){
  const fields=node.arguments[0].properties;assert.equal(fields.find(p=>p.key.name==='baseURL').value.value,baseURL);
  const value=fields.find(p=>p.key.name==='manifest').value;pinned=JSON.parse(native.slice(value.start,value.end));
 }});assert.ok(pinned,'cloud base has a pinned manifest');
 async function existing(ref){
  assert.match(ref.path,/^[a-f0-9]{64}\.(bin|gz|json)$/);assert.equal(ref.path.split('.')[0],ref.sha256);assert.ok(ref.bytes>0&&ref.bytes<=12*1024*1024);
  const local=path.join(root,'网站/atlas',ref.path);
  let bytes;if(fs.existsSync(local))bytes=fs.readFileSync(local);else{const response=await fetch(baseURL+ref.path,{redirect:'error',signal:AbortSignal.timeout(60000)});assert.equal(response.status,200);bytes=Buffer.from(await response.arrayBuffer());}
  assert.equal(bytes.length,ref.bytes);assert.equal(B.sha(bytes),ref.sha256);return bytes;
 }
 const previous=JSON.parse(await existing(pinned));assert.equal(previous.schema,1);
 const shared=compress('window.CXX_ATLAS_WORKER_SOURCE='+JSON.stringify(read('卡片源码/地图/scene-worker.js'))+';\n'+read('卡片源码/地图/gpu-renderer.js'));
 const index={...previous,shared};
 for(const document of Object.values(previous.documents)){
  const page=await existing(document.page);put(page,'gz');
  const html=zlib.gunzipSync(page).toString(),source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].startsWith('window.CXX_ATLAS_GPU_ASSETS='))[1];
  const assignment=acorn.parse(source,{ecmaVersion:'latest'}).body[0].expression,assets=JSON.parse(source.slice(assignment.right.start,assignment.right.end));
  for(const [id,bundle]of Object.entries(assets.bundles)){
   const bytes=await existing(bundle.file);assert.deepEqual(put(bytes,'bin'),bundle.file);
   parity.push({id,bytes:bytes.length,views:Object.values(assets.views).filter(v=>v.pool===id).length});
  }
 }
 const manifest=put(JSON.stringify(index),'json');return {files,manifest,index,parity};
}
async function build(){const card=JSON.parse(fs.readFileSync(input)),pack=await resources(B.extract(card).native);fs.mkdirSync(publicDir,{recursive:true});for(const [name,bytes] of pack.files)fs.writeFileSync(path.join(publicDir,name),bytes);fs.mkdirSync(cache,{recursive:true});fs.writeFileSync(path.join(cache,'build.json'),JSON.stringify({manifest:pack.manifest,sceneParity:pack.parity},null,2)+'\n');return pack;}
module.exports={build,resources,cache,publicDir,baseURL};if(require.main===module)build().then(p=>console.log(JSON.stringify({manifest:p.manifest,resources:p.files.size}))).catch(e=>{console.error(e);process.exitCode=1;});
