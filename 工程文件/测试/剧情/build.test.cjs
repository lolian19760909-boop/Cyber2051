'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Build=require('../../卡片源码/剧情/build.cjs'),F=require('./fixtures.cjs');
function fixture(){
 const line=structuredClone(F.line),entries=line.nodes.map((node,i)=>({id:200+i,enabled:false,keys:['__cxx_node_'+line.id+'_'+node.id],content:node.content}));
 line.nodes.forEach((node,i)=>{node.lore=200+i;delete node.content;});
 const index={schema:1,lines:[line.id+'.json']},assets=[{file:'sample/parcel.webp',width:2560,height:1440,url:'https://example.test/parcel.webp'}];
 return {line,entries,index,assets,load(){const source=name=>name==='剧情/线/index.json'?JSON.stringify(index):name==='剧情/线/'+line.id+'.json'?JSON.stringify(line):assert.fail(name);return Build.load(source,{entries,assets});}};
}
test('build resolves one authoritative worldbook body and registered image metadata',()=>{
 const f=fixture(),lines=f.load();assert.equal(lines[0].nodes[1].content,f.entries[1].content);assert.equal(lines[0].nodes[1].illustrations[0].url,f.assets[0].url);
 assert.equal(Build.load(name=>JSON.stringify({schema:1,lines:[]})).length,0);
});
test('build rejects unsafe paths, duplicate entries, active lore and missing media',()=>{
 for(const change of [f=>f.index.lines=['../sample.json'],f=>f.index.lines.push(f.index.lines[0]),f=>f.entries[0].enabled=true,f=>f.entries[0].keys=['wrong'],f=>f.line.nodes[0].lore=999,f=>f.line.nodes[1].lore=f.line.nodes[0].lore,f=>f.assets.length=0,f=>f.assets[0].height=1000,f=>delete f.assets[0].url,f=>f.line.nodes[0].content='duplicated',f=>f.entries[0].content='x'.repeat(11000)]){
  const f=fixture();change(f);assert.throws(()=>f.load());
 }
});
test('cross-line prerequisites use stable node IDs and any-mode without numeric affinity',()=>{
 const f=fixture();f.line.nodes[1].requires=['P1'];f.line.nodes[1].gateMode='any';f.line.nodes[1].gate=[{check:'wallet',op:'>=',value:2000},{check:'state',path:['terminal','net','hasContact'],op:'==',value:true}];
 assert.equal(f.load()[0].nodes[1].gateMode,'any');
});
