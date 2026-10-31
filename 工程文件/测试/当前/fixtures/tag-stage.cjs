'use strict';
// In-memory source assembly for tests only. Do not overwrite a frozen candidate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {extract}=require('../../../工具/lib/script-modules.cjs'),{inlineSource}=require('../../../工具/lib/inline-source.cjs'),{workerNode}=require('../../../工具/lib/card-ast.cjs');
const HistoryWorker=require('../../../工具/lib/history-worker.cjs');
const root=path.resolve(__dirname,'../../..'),baseline=path.join(root,'交付/基线/2.3.0-整理前.json');
const sources={Cxx238Dialogue:'正文/dialogue.js',CxxGalParser:'Gal/parser.js',CxxDisplayGuard235:'正文/display-guard.js',CxxNativeProse:'原生/prose.js',CxxNativeHost:'原生/host.js',CxxUpdateHost:'运行时/host.js'};
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function stage(){
  const bytes=fs.readFileSync(baseline);assert.equal(JSON.parse(bytes).data.character_version,'2.3.0');
  const original=JSON.parse(bytes),card=structuredClone(original),scripts=card.data.extensions.tavern_helper.scripts,changed=[];
  const code=Object.fromEntries(Object.entries(sources).map(([name,file])=>[name,extract(inlineSource(fs.readFileSync(path.join(root,'卡片源码',file),'utf8').replace(/\r\n/g,'\n')),[name])[0].source]));
  const found=[];
  for(const s of scripts){
    if(!s.content)continue;
    const edits=extract(s.content,Object.keys(sources)).map(m=>{found.push(m.name);return {...m,value:code[m.name]};});
    if(s.id==='cxx-business-core-241'){
      const n=workerNode(s.content),worker=HistoryWorker.build().source;
      edits.push({start:n.start,end:n.end,value:inlineSource(JSON.stringify(worker))});
    }
    for(const e of edits.sort((a,b)=>b.start-a.start))s.content=s.content.slice(0,e.start)+e.value+s.content.slice(e.end);
    if(edits.length)changed.push(s.id);
  }
  assert.deepEqual(found.sort(),Object.keys(sources).sort());
  const restored=structuredClone(card);
  for(const id of changed)restored.data.extensions.tavern_helper.scripts.find(s=>s.id===id).content=original.data.extensions.tavern_helper.scripts.find(s=>s.id===id).content;
  assert.deepEqual(restored,original);
  const core=scripts.find(s=>s.id==='cxx-business-core-241').content,worker=workerNode(core).value;
  assert.equal(extract(worker,['CxxGalParser'])[0].source,code.CxxGalParser);
  for(const s of scripts)for(const m of extract(s.content||'',Object.keys(sources)))assert.equal(m.source,code[m.name]);
  if(process.env.CXX_TEST_CARD||process.env.CXX_CARD){
    const file=path.resolve(process.env.CXX_TEST_CARD||process.env.CXX_CARD),raw=fs.readFileSync(file),actual=JSON.parse(raw),trees=actual.data.extensions.tavern_helper.scripts;
    for(const s of trees)for(const m of extract(s.content||'',Object.keys(sources)))assert.equal(m.source,code[m.name]);
    const core=trees.find(s=>s.id==='cxx-business-core-241').content,worker=workerNode(core).value;assert.equal(extract(worker,['CxxGalParser'])[0].source,code.CxxGalParser);
    return {card:actual,original,code,worker,core,receipt:{file,sha256:sha(raw),sources,mainWorkerParity:true,inMemoryOnly:false,realHost:false}};
  }
  return {card,original,code,worker,core,receipt:{baseline,sha256:sha(bytes),changed,sources,mainWorkerParity:true,inMemoryOnly:true,realHost:false}};
}
module.exports={stage,root,extract};
