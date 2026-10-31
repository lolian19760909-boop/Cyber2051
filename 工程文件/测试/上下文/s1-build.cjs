'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const B=require('../../工具/构建/当前/build.cjs'),{extract}=require('../../工具/lib/script-modules.cjs');
const stage=process.env.CXX_CONTEXT_STAGE||'S1';assert(/^[A-Za-z0-9_-]+$/.test(stage));
const out=process.env.CXX_S1_OUT||path.resolve(__dirname,'../../.cache/context-s0/s1-checkpoint');
(async()=>{
  const {card,receipt}=await B.build({write:false});
  const core=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-business-core-241');
  const names=['CxxEnsembleContent','CxxEnsembleState','CxxEnsembleMvu','CxxEnsembleView','CxxEnsembleUI','CxxContextSource','CxxContextHost','CxxContextRequests','CxxContextStore','CxxContextCompact','CxxContextController'];
  const modules=extract(core.content,names);assert.equal(modules.length,names.length);
  for(const name of names){const maintained=B.source(B.sources[name]);const expected=require('../../工具/lib/inline-source.cjs').inlineSource(extract(maintained,[name])[0].source);assert.equal(modules.find(m=>m.name===name).source,expected,name+' source parity');}
  assert(core.content.includes('globalThis.CxxEnsembleStyle='));
  const memory=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-long-memory-p1');assert(memory);assert.equal(extract(memory.content,['CxxMemoryKnowledge'])[0].source,require('../../工具/lib/inline-source.cjs').inlineSource(extract(B.source('长期记忆/knowledge.js'),['CxxMemoryKnowledge'])[0].source));
  const inline=require('../../工具/lib/inline-source.cjs').inlineSource,additional={CxxQuests:'运行时/quests.js',CxxQuestHost:'运行时/quest-host.js',CxxPlayerOperations:'运行时/player-operations.js',CxxPlayerHost:'运行时/player-host.js',CxxPlayerUI:'运行时/player-ui.js',Cxx236Schema:'MVU/schema.js',CxxMemoryPanel:'长期记忆/panel.js',CxxMemoryHistory:'长期记忆/history.js',CxxExperienceHost:'运行时/experience-host.js',CxxBattleHost:'运行时/battle-host.js',CxxTacticalHost:'运行时/tactical-host.js',CxxNumericHost:'运行时/numeric-host.js',Cxx236Variables:'MVU/variables.js'};
  const packaged=card.data.extensions.tavern_helper.scripts.flatMap(s=>extract(s.content,Object.keys(additional)));
  for(const [name,source]of Object.entries(additional)){const found=packaged.filter(m=>m.name===name);assert.equal(found.length,1,name+' packaged exactly once');assert.equal(found[0].source,inline(extract(B.source(source),[name])[0].source),name+' source parity');}
  const adapters=extract(memory.content,['CxxLongMemoryAdapter']);assert.equal(adapters.length,1,'memory adapter packaged exactly once');assert.equal(adapters[0].source,inline(extract(B.source('长期记忆/adapter.js'),['CxxLongMemoryAdapter'])[0].source),'memory adapter source parity');
  assert(memory.content.includes('globalThis.CxxMemoryPanelStyle='+JSON.stringify(B.source('长期记忆/panel.css'))),'memory panel style source parity');
  const terminal=require('../../工具/lib/card-ast.cjs').extract(card).html;
  assert(terminal.includes(inline(B.source('终端/quests-ui.js'))),'quest UI source parity');
  assert(terminal.includes(inline(B.source('终端/terminal.js'))),'terminal source parity');
  assert.equal(card.data.character_book.entries.find(e=>e.id===54).content,B.source('运行时/quest-rules.txt'),'quest rules source parity');
  const file=path.join(out,'赛博小祥2051-'+stage+'检查候选.json'),bytes=Buffer.from(JSON.stringify(card,null,2)+'\n');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(file,bytes);
  const reloaded=JSON.parse(fs.readFileSync(file,'utf8'));assert.deepEqual(reloaded,card);
  const result={scope:stage+' local checkpoint, not release or full role-switch/compaction acceptance',file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,modules:names,additionalSourceParity:{modules:Object.keys(additional),memoryKnowledge:true,memoryAdapter:true,terminal:['终端/quests-ui.js','终端/terminal.js'],worldbook:[54]},sourceParity:true,jsonRoundtrip:true,configuredOutputUntouched:B.output,receipt};
  fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({pass:true,file,bytes:result.bytes,sha256:result.sha256,modules:names.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
