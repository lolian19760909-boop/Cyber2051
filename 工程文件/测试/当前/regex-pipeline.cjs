'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const {load}=require('./fixtures/st-regex-engine.cjs');
const eng=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(eng,'卡片源码',f),'utf8');
const rules=require('../../卡片源码/正则/build.cjs').build(read);
const before=process.env.CXX_REGEX_BEFORE?JSON.parse(fs.readFileSync(process.env.CXX_REGEX_BEFORE)):rules;
const output=process.env.CXX_EVIDENCE||path.join(eng,'.cache/regex230');
const a=load(before),b=load(rules),raw='<cxx-story>雨停后，大家一起离开车站。</cxx-story>\n<ztl>{"location":"车站","characters":[]}</ztl>\n<xuan>1. 等待\n2. 离开</xuan>\n<UpdateVariable><Analysis>说明</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>\n<StatusPlaceHolderImpl/>\n<Gui>旧面板</Gui>';
const fixtures={ordinary:'大家沿着河岸散步。\n'.repeat(100),protocol:raw,quoted:'“'+raw+'”\n'+raw,inline:'`'+raw+'`\n'+raw,fenced:'```xml\n'+raw+'\n```\n'+raw,unfinishedFence:'~~~xml\n'+raw,blockquote:'> '+raw.replaceAll('\n','\n> ')+'\n\n'+raw,indented:'    '+raw.replaceAll('\n','\n    ')+'\n'+raw,html:'<pre>'+raw+'</pre>\n<!--'+raw+'-->\n'+raw,unfinished:'<UpdateVariable><Analysis>尚未闭合\n'+raw,crossed:'<UpdateVariable><Analysis>未闭合\n</UpdateVariable>\n'+raw,opening:'<OpeningPage id="10"/>\n【开局】原始开局【/开局】'};
const stages=[{name:'display',params:{isMarkdown:true}},{name:'prompt',params:{isPrompt:true}},{name:'raw',params:{}},{name:'edit-display',params:{isMarkdown:true,isEdit:true}},{name:'edit-prompt',params:{isPrompt:true,isEdit:true}}];
const report={scope:'Installed ST engine in isolated VM; no macro expansion, model or player writes',engineSHA256:b.sha256,ruleCount:rules.length,comparisons:0,measurements:[]};
for(const [name,text]of Object.entries(fixtures))for(const placement of [1,2,5,6])for(const stage of stages)for(const depth of [undefined,0,1,2,3,4,100]){assert.equal(b.run(text,placement,{...stage.params,depth}),a.run(text,placement,{...stage.params,depth}),[name,placement,stage.name,depth].join('/'));report.comparisons++;}
for(const literal of ['“'+raw+'”','`'+raw+'`','```\n'+raw+'\n```','<pre>'+raw+'</pre>','<!--'+raw+'-->'])assert.equal(b.run(literal,2,{isPrompt:true,depth:4}),literal,'Prompt literal must survive');
assert.equal(b.run(raw,2,{}),raw,'Raw/save stage is unchanged');
assert.match(b.run(raw,2,{isMarkdown:true,depth:0}),/data-cxx-slot="status0"/);
assert.match(b.run(raw,2,{isMarkdown:true,depth:0}),/data-cxx-slot="music12"/);
assert.doesNotMatch(b.run(raw,2,{isPrompt:true,depth:4}),/<ztl>|<UpdateVariable>|<xuan>|<StatusPlaceHolderImpl\/>|<Gui>/);
for(const [name,text]of Object.entries({ordinary:fixtures.ordinary,long:'大家沿着河岸散步。\n'.repeat(20000)+raw,unfinished:('<UpdateVariable>未结束\n').repeat(1000),literals:('“示例'+raw+'”\n').repeat(200)}))for(const stage of stages.slice(0,2)){
 for(const [version,engine]of [['before',a],['after',b]]){
  for(let i=0;i<3;i++)engine.run(text,2,{...stage.params,depth:4});const times=[];
  for(let i=0;i<30;i++){const t=performance.now();engine.run(text,2,{...stage.params,depth:4});times.push(performance.now()-t);}times.sort((x,y)=>x-y);
  const eligible=(version==='before'?before:rules).filter(r=>!r.disabled&&r.placement.includes(2)&&(stage.params.isMarkdown?r.markdownOnly:r.promptOnly)&&(r.minDepth==null||r.minDepth<=4)&&(r.maxDepth==null||r.maxDepth<0||r.maxDepth>=4));
  report.measurements.push({name,stage:stage.name,version,chars:text.length,scans:eligible.length,p50:times[14],p95:times[28],max:times[29]});
 }
}
report.pass=true;fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'regex-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
