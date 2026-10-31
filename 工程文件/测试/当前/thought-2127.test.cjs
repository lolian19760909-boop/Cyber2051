'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const p=require('../../卡片源码/Gal/parser.js'),d=require('../../卡片源码/正文/dialogue.js'),guard=require('../../卡片源码/正文/display-guard.js');
const f=require('./fixtures/thought-lines.json'),wrap=s=>'<cxx-story>'+s+'</cxx-story>',line='千早爱音【心声，未说出口】【sadness】：希望雨快点停。';
const thoughts=s=>p.parseMessage(s,{cache:false}).paragraphs.filter(x=>x.kind==='thought');
function hooks(){const handlers=new Map(),callbacks={},runtime={alive:true,key:()=> 'test'},api={SillyTavern:{getContext:()=>({messageFormatter:{addHook:(fn,o)=>callbacks[o.stage]=fn},eventTypes:{CHAT_COMPLETION_PROMPT_READY:'prompt'}})},eventOn:(e,fn)=>handlers.set(e,fn),eventRemoveListener:e=>handlers.delete(e)};return {handlers,callbacks,stop:guard.install({top:{},api,runtime,parser:p})};}

test('all eight reported thought lines equal standard semantic tags, with raw input intact',()=>{
 const actual=p.parseMessage(f.raw),control=p.parseMessage(f.correct);assert.equal(actual.raw,f.raw);assert.deepEqual(actual.paragraphs,control.paragraphs);assert.equal(thoughts(f.raw).length,8);assert.equal(actual.diagnostics.length,0);assert.equal(actual.choices.length,5);
});
test('known aliases and explicit ordinary NPC thoughts preserve names without inventing portraits',()=>{
 for(const name of ['千早爱音','千早愛音','爱音','门卫甲'])for(const marker of ['【心声，未说出口】','【心声,未说出口】','【心声】']){
  const q=thoughts(wrap(name+marker+'：请稍等。'))[0];assert.ok(q);assert.equal(q.expression,'normal');assert.equal(q.characterId,name==='门卫甲'?null:'Anon');assert.equal(q.speaker,name==='门卫甲'?name:'千早爱音');
 }
});
test('all supported faces work; invalid faces and incomplete labels stay unchanged',()=>{
 for(const face of ['normal','smile','blush','serious','sadness','regret','shocked','constricted_pupils','cyberpsychosis'])assert.equal(thoughts(wrap(line.replace('sadness',face)))[0].expression,face);
 for(const raw of [line.replace('sadness','invented'),line.replace('【sadness】','【悲伤】'),'千早爱音【心声，未说出口】【sadness】：','千早爱音【心声，未说出口】【sad','【心声，未说出口】：文字','她想：希望雨停。','旁白提到：'+line]){
  assert.equal(thoughts(wrap(raw)).length,0);assert.equal(p.prepareDialogue(wrap(raw)),wrap(raw));
 }
});
test('line boundaries retain narration and unrelated dialogue without assigning the previous speaker',()=>{
 const rows=p.parseMessage(wrap(line+'\n这行没有人物标记。\n门卫甲【心声】：还没结束。\n<cxx-say speaker="千早爱音">「你好」</cxx-say>')).paragraphs;
 assert.deepEqual(rows.map(x=>[x.speaker,x.kind||null]),[['千早爱音','thought'],[null,null],['门卫甲','thought'],['千早爱音',null]]);
 const q=thoughts(wrap('  千早爱音【心声】：她说过“会来的”，我再等等。'))[0];assert.equal(q.text,'她说过“会来的”，我再等等。');
});
test('code, quotes, auxiliary sections, selected-action alternatives and outside-envelope text stay inert',()=>{
 for(const sample of ['```text\n'+line+'\n```','`'+line+'`','> 引文\n'+line,'    '+line,'\t'+line,'「'+line+'」','“'+line+'”','<blockquote>\n'+line+'\n</blockquote>','<pre>\n'+line+'\n</pre>',...['think','advice','xuan','ztl','UpdateVariable','current_event','progress'].map(t=>'<'+t+'>\n'+line+'\n</'+t+'>')]){
  const raw=/^<(?:think|advice|xuan|ztl|UpdateVariable|current_event|progress)>/.test(sample)?wrap('正文。')+'\n'+sample:wrap('\n\n'+sample+'\n\n');assert.equal(p.prepareDialogue(raw),raw,sample);assert.equal(p.historyDialogue(raw),raw,sample);
 }
 assert.equal(p.prepareDialogue(line),line);assert.equal(p.prepareDialogue(wrap('正文。')+'\n'+line),wrap('正文。')+'\n'+line);
 assert.equal(p.prepareDialogue('<think>'+wrap(line)+'</think>'),'<think>'+wrap(line)+'</think>');
 assert.equal(p.prepareDialogue(wrap('1. '+line)),wrap('1. '+line));
 for(const name of ['xuan','ztl','UpdateVariable']){const sample='<'+name+'>\n'+line+'\n</'+name+'>',normalized=p.prepareDialogue(wrap(sample));assert.ok(normalized.includes(sample));assert.doesNotMatch(normalized,/kind="thought"/);}
});
test('inline markup and literal tag examples cannot be promoted or executed by the fallback',()=>{
 for(const body of ['<img src=x onerror=alert(1)>','<cxx-say speaker="门卫">例子</cxx-say>','<UpdateVariable>例子</UpdateVariable>']){
  const raw=wrap('千早爱音【心声】：'+body);assert.equal(thoughts(raw).length,0);
 }
 const raw=wrap('千早爱音【心声】：&lt;img src=x onerror=alert(1)&gt;');assert.doesNotMatch(p.nativeDialogue(p.prepareDialogue(raw)),/<img/);
});
test('all streaming prefixes keep identified thoughts unspoken and preserve the final result',()=>{
 for(const face of ['normal','constricted_pupils']){const raw=wrap(line.replace('sadness',face));for(let i=0;i<=raw.length;i++){
  const rows=p.parseMessage(raw.slice(0,i),{cache:false}).paragraphs;for(const q of rows.filter(x=>x.speaker==='千早爱音'))assert.equal(q.kind,'thought');
 }assert.equal(thoughts(raw).length,1);}
});
test('normalization and history are stable across repeated passes and keep legacy italics semantic',()=>{
 for(const raw of [f.raw,f.correct,wrap('<em>门卫甲（心声）：还没结束。</em>'),wrap('*我再等等。*')]){
  const normalized=p.prepareDialogue(raw);assert.equal(p.prepareDialogue(normalized),normalized);assert.equal(p.historyDialogue(normalized),normalized);assert.equal(p.historyDialogue(p.historyDialogue(raw)),normalized);
  assert.doesNotMatch(normalized,/【心声，未说出口】/);assert.match(normalized,/kind="thought"/);
 }
 const unknown=thoughts(wrap('*我再等等。*'))[0];assert.equal(unknown.speaker,null);
});
test('outgoing assistant text keeps canonical tags, thought semantics, multimodal parts and original records',()=>{
 const h=hooks(),image={type:'image_url',image_url:{url:'fixture'}},row={role:'assistant',content:[{type:'text',text:f.raw,extra:1},image],name:'keep'},user={role:'user',content:f.raw},sys={role:'system',content:f.raw},payload={chat:[row,user,sys]};h.handlers.get('prompt')(payload);
 const result=payload.chat[0];assert.notEqual(result,row);assert.equal(result.name,'keep');assert.equal(result.content[0].extra,1);assert.equal(result.content[1],image);assert.equal(row.content[0].text,f.raw);assert.equal(payload.chat[1],user);assert.equal(payload.chat[2],sys);
 assert.match(result.content[0].text,/kind="thought"/);assert.equal(thoughts(result.content[0].text).length,8);assert.doesNotMatch(result.content[0].text,/【心声，未说出口】/);h.stop();assert.equal(h.handlers.size,0);
});
test('native guard wraps eight thoughts once and retains the two spoken utterances',()=>{
 const h=hooks(),out=h.callbacks.afterRegex(h.callbacks.beforeRegex(f.raw,{}));assert.equal((out.match(/ bdc-thought/g)||[]).length,8);assert.equal((out.match(/class="bdc bdc-cxx/g)||[]).length,10);assert.doesNotMatch(out,/【心声，未说出口】|CXXDIALOGUE/);h.stop();
});
test('candidate main and worker contain current codec and produce the same complete and partial paragraphs',async()=>{
 const B=require('../../工具/构建/当前/build.cjs'),{extract}=require('../../工具/lib/script-modules.cjs'),{workerNode}=require('../../工具/lib/card-ast.cjs'),{inlineSource}=require('../../工具/lib/inline-source.cjs');
 const card=process.env.CXX_TEST_CARD?JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD)):(await B.build({write:false})).card,core=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-business-core-241').content,worker=workerNode(core).value,source=extract(inlineSource(fs.readFileSync(require.resolve('../../卡片源码/正文/dialogue.js'),'utf8')),['Cxx238Dialogue'])[0].source;
 assert.equal(extract(core,['Cxx238Dialogue'])[0].source,source);assert.equal(extract(worker,['Cxx238Dialogue'])[0].source,source);
 const {parse,findNodes}=require('../../工具/lib/source-edits.cjs'),scripts=card.data.extensions.tavern_helper.scripts,slots=[];
 for(const script of scripts)if(script.content)for(const node of findNodes(parse(script.content),n=>n.type==='VariableDeclarator'&&n.id.name==='CXX_GAL_STANDING'))slots.push(vm.runInNewContext('('+script.content.slice(node.init.start,node.init.end)+')'));
 assert.equal(slots.length,1);assert.deepEqual(JSON.parse(JSON.stringify(slots[0])),require('../../卡片源码/Gal/standing-media.json'));
 assert.equal(Object.keys(B.profiles(card)).length,61);
 let result;const box=vm.createContext({postMessage:r=>result=r});box.self=box;vm.runInContext(worker,box);for(const raw of [f.raw,wrap(line),'<cxx-story>'+line.slice(0,-2)]){box.onmessage({data:{id:1,kind:'parse',payload:{raw}}});assert.ok(!result.error);assert.deepEqual(JSON.parse(JSON.stringify(result.value)),JSON.parse(JSON.stringify(p.parseMessage(raw,{cache:false}))));}
});
test('replacement accepts the superseded 2.1.27 save identity without downgrading its schema',async()=>{
 const B=require('../../工具/构建/当前/build.cjs'),old=(()=>{const d=require('../../工具/构建/旧版来源.json');return d.seedValues[d.sources.find(s=>s.name==='赛博小祥2051-V2.1.27-综合修复-候选.json').seedRefs.migration];})(),Release=require('../../卡片源码/运行时/release.js'),Backup=require('../../卡片源码/运行时/backup.js'),Core=require('../../卡片源码/运行时/core.js'),{fixture}=require('../lib/fixture-loader.cjs')('migration.test.cjs',['fixture']);
 const seed=JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD||B.output)).data.extensions.tavern_helper.scripts.find(s=>s.id===Release.UPDATER).data.__cxx_update_seed,from=fixture(),to=fixture('target');assert.ok(seed.migration.accepts.some(x=>x.buildId===old.buildId&&x.saveSchema===old.saveSchema));
 Object.assign(from.seed,structuredClone(seed));from.seed.migration.buildId=old.buildId;from.seed.migration.saveSchema=old.saveSchema;Object.assign(to.seed,structuredClone(seed));
 const client=Backup.create({host:from.host,core:Core,seed:from.seed,adapters:from.adapters,readOnlyExport:true}),doc=(await client.captureMigration()).document,preview=await to.client.previewMigration(doc),result=await to.client.importMigration(doc,{preview,confirm:'migrate-copy'}),saved=to.copies.get(result.chatId)[1].variables;
 for(const [i,v]of saved.entries()){assert.deepEqual(v.stat_data,from.messages[0].variables[i].stat_data);assert.deepEqual(v.unknownMVU,from.messages[0].variables[i].unknownMVU);assert.deepEqual(v.initialized_lorebooks['old-book'],from.messages[0].variables[i].initialized_lorebooks['old-book']);}assert.equal(from.writes,0);
});
