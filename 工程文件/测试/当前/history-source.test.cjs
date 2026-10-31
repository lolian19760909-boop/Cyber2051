'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../../工具/构建/当前/build.cjs'),H=require('../../工具/lib/history-worker.cjs');
const {extract}=require('../../工具/lib/script-modules.cjs'),{inlineSource}=require('../../工具/lib/inline-source.cjs'),{workerNode}=require('../../工具/lib/card-ast.cjs');
const P=require('../../卡片源码/Gal/parser.js'),S=require('../../卡片源码/运行时/story-summaries.js');
const candidate=JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD||B.output)),baseline=JSON.parse(fs.readFileSync(path.join(B.root,'交付/组件/2.3.0-E1-任务组件-20261016/东京都2051-V2.3.0-E1-任务组件候选.json')));
const core=card=>card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-business-core-241').content;
const currentCore=core(candidate),oldCore=core(baseline),worker=workerNode(currentCore).value,oldWorker=workerNode(oldCore).value;
const plain=x=>JSON.parse(JSON.stringify(x));
function realm(code){let output;const box=vm.createContext({postMessage:r=>{output=r;}});box.self=box;vm.runInContext(code,box);return {box,send:(kind,payload,id=7)=>{box.onmessage({data:plain({id,kind,payload})});return plain(output);}};}
const current=realm(worker),old=realm(oldWorker),main=realm(extract(currentCore,H.spec.modules).map(m=>m.source).join('\n;\n'));
const raws=[...require('../Gal/fixtures/messages.json').map(x=>x.raw),...Object.values(require('./fixtures/thought-lines.json')).filter(x=>typeof x==='string'),
  require('./fixtures/update-variable.cjs').reported,require('./fixtures/update-variable.cjs').valid,
  '<cxx-story>雨停了。<cxx-say speaker="千早爱音" kind="thought" expression="sadness">再等一会。</cxx-say></cxx-story>',
  '示例：\n```html\n<ztl>{"location":"不生效"}</ztl>\n```',
  '<think>辅助信息</think>\n<cxx-story>回家。</cxx-story>\n<ztl>invalid</ztl>',
  '<cxx-story>不要动这条记录。</cxx-story>\n<UpdateVariable><JSONPatch>[',
  '格式 <ztl> <xuan>\n</konatan_planning~>\n<cxx-story>实际正文。</cxx-story>\n<tucao>旁注</tucao>',
  '', '普通正文与 emoji 🌧️。', '<cxx-story>'+'雨落在街道上。'.repeat(1800)+'</cxx-story>'
];
test('candidate main and generated Worker use canonical sources; unchanged modules retain frozen source',()=>{
  const generated=H.build();assert.equal(worker,generated.source);
  for(const name of H.spec.modules){
    assert.equal(extract(currentCore,[name])[0].source,generated.modules[name],name+' main');
    assert.equal(extract(worker,[name])[0].source,generated.modules[name],name+' worker');
    const legacyWorker=extract(inlineSource(oldWorker),[name])[0].source,legacyMain=extract(inlineSource(oldCore),[name])[0].source;
    assert.equal(legacyWorker,legacyMain,name+' frozen main/worker parity');
    // Parser scanning and the portrait/emotion codec intentionally change source; the tests below retain
    // complete output, prefix, summary and protocol equality against this copy.
    if(!['CxxGalParser','Cxx238Dialogue'].includes(name))assert.equal(legacyWorker,generated.modules[name],name+' unchanged source');
  }
  const runtime=extract(currentCore,['Cxx249HistoryRuntime'])[0].source;
  assert.equal(runtime,extract(oldCore,['Cxx249HistoryRuntime'])[0].source);
  assert.equal(runtime,inlineSource(fs.readFileSync(path.join(B.root,'卡片源码/正文/history-runtime.js'),'utf8')).trim());
});
test('complete, malformed, quoted, auxiliary and long messages match legacy, main and Worker outputs without writes',()=>{
  for(const raw of raws){const expected=plain(P.parseMessage(raw,{cache:false})),payload={raw};
    assert.deepEqual(current.send('parse',payload),{id:7,value:expected});
    if(!/<UpdateVariable>|<think>|<thinking>|<\/konatan_planning~>/i.test(raw))assert.deepEqual(old.send('parse',payload),{id:7,value:expected});
    assert.deepEqual(plain(main.box.CxxGalParser.parseMessage(raw,{cache:false})),expected);
    assert.equal(payload.raw,raw);assert.equal(expected.raw,raw);
  }
});
test('every prefix of dialogue and planning examples retains identical streaming semantics',()=>{
  const streams=[raws[raws.length-8],'<cxx-story>千早爱音【心声，未说出口】【sadness】：愿雨停。</cxx-story>','格式 <ztl> <xuan>\n</konatan_planning~>\n<cxx-story>回家。</cxx-story>'];
  for(const raw of streams)for(let i=0;i<=raw.length;i++){const prefix=raw.slice(0,i),expected=plain(P.parseMessage(prefix,{cache:false}));assert.deepEqual(current.send('parse',{raw:prefix}).value,expected);assert.deepEqual(old.send('parse',{raw:prefix}).value,expected);}
});
test('summary roles, swipes, ignored floors and errors keep text and fingerprints across both execution paths',()=>{
  for(const raw of raws)for(const is_user of [false,true])for(const [floor,is_system]of [[0,false],[3,false],[4,true]]){
    const message={mes:raw,is_user,is_system,swipe_id:2,extra:{keep:true}},snapshot=structuredClone(message),expected=plain(S.row(message,floor,P));
    const payload={message,floor};assert.deepEqual(current.send('summary',payload).value,expected);assert.deepEqual(old.send('summary',payload).value,expected);
    assert.deepEqual(plain(main.box.CxxStorySummaries.row(message,floor,main.box.CxxGalParser)),expected);assert.deepEqual(message,snapshot);
  }
});
test('Worker protocol keeps request IDs and error envelopes and continues after a bad job',()=>{
  for(const [kind,payload]of [['unknown',{}],['parse',null],['summary',{message:null,floor:2}]]){
    const result=current.send(kind,payload,12);assert.deepEqual(result,old.send(kind,payload,12));assert.equal(result.id,12);assert.equal(typeof result.error.message,'string');assert.ok(!('value' in result));
  }
  assert.equal(current.send('parse',{raw:'继续。'},13).value.raw,'继续。');
});
