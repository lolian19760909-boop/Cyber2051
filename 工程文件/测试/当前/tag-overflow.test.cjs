'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const parser=require('../../卡片源码/Gal/parser.js'),guard=require('../../卡片源码/正文/display-guard.js'),prose=require('../../卡片源码/原生/prose.js');
const {document}=require('../lib/dom.cjs'),f=require('./fixtures/update-variable.cjs'),{stage,extract}=require('./fixtures/tag-stage.cjs');
const invalid=raw=>parser.inspect(raw).roots.some(r=>r.kind==='UpdateVariable'&&!r.valid);
const story=raw=>'<cxx-story>交易结束，玩家走向街口。</cxx-story>\n'+raw;
function rendering(){
  const hooks={},doc=document('<main></main>'),top={document:doc},api={SillyTavern:{getContext:()=>({messageFormatter:{addHook:(fn,o)=>hooks[o.stage]=fn}})}},runtime={alive:true,key:()=> 'fixture'};
  const stop=guard.install({top,api,runtime,parser});
  return {hooks,doc,top,api,runtime,stop,render:raw=>hooks.afterRegex(hooks.beforeRegex(raw,{}))};
}
test('valid numericInput add arrays with Analysis or Analyze are display auxiliaries, preserving raw',()=>{
  for(const tag of ['Analysis','Analyze'])for(const op of ['add','replace']){
    const entries=structuredClone(f.fixed);entries[2].op=op;const raw=story(f.update(entries,tag)),p=parser.parseMessage(raw);
    assert.equal(p.raw,raw);assert.equal(invalid(raw),false);assert.equal(p.validation.roots.find(r=>r.kind==='UpdateVariable').valid,true);
    assert.deepEqual(p.paragraphs.map(x=>x.text),['交易结束，玩家走向街口。']);
  }
});
test('wrong numeric/input stays unchanged and schema rejects it without redirecting',()=>{
  assert.equal(invalid(f.reported),false);assert(parser.variableUpdates(f.reported).patches.some(p=>p.path==='/terminal/gameplay/numeric/input'));
  const adapter=require('../../卡片源码/数值引擎/adapters/mvu.js'),before={terminal:{gameplay:{}}},copy=structuredClone(before);
  assert.throws(()=>adapter.prepare(before,f.patch),/成长和战况/);assert.deepEqual(before,copy);
  const x=rendering(),html=x.render(f.reported);assert.match(html,/numeric\/input/);assert.doesNotMatch(html,/numericInput/);x.stop();
});
test('field errors remain schema errors; malformed and nested syntax stays inert',()=>{
 const entries=structuredClone(f.fixed);entries[2].value={kind:'item-gain'};assert.equal(invalid(f.update(entries)),false);
 const adapter=require('../../卡片源码/数值引擎/adapters/mvu.js');assert.throws(()=>adapter.prepare({terminal:{gameplay:{}}},[entries[2]]),/事件数组/);
 for(const raw of [f.valid.replace('[{','[invalid{'),'<UpdateVariable>'+f.valid+'</UpdateVariable>']){assert.equal(invalid(raw),true,raw);assert(parser.variableUpdates(raw).issues.length);const x=rendering();assert.match(x.render(raw),/cxx-update-diagnostic/);x.stop();}
 const repeated=f.valid+'\n'+f.valid;assert.equal(invalid(repeated),false);assert.equal(parser.variableUpdates(repeated).patches.length,f.fixed.length*2);
});

test('complete invalid update is closed, wrapped, escaped and retained in full',()=>{
  const raw=f.reported.replace('numeric/input','__proto__/input').replace('玩家购买零件','<img src=x onerror=alert(1)>玩家购买零件'),x=rendering();
  const html=x.render(story(raw)),doc=document(html),d=doc.querySelector('details'),body=d.querySelector('.cxx-native-aux-body');
  assert.equal(d.open,false);assert.equal(body.hidden,true);assert.equal(body.getAttribute('style'),'display:none!important');
  assert.equal(d.querySelector('pre').textContent,raw);assert.equal(doc.querySelector('img'),null);assert.equal(doc.querySelectorAll('details').length,1);
  assert.match(d.querySelector('summary').textContent,/变量格式异常/);assert.doesNotMatch(html,/CXXPROTECTED/);
  d.open=true;x.doc.dispatchEvent({type:'toggle',target:d});assert.equal(body.hidden,false);
  d.open=false;x.doc.dispatchEvent({type:'toggle',target:d});assert.equal(body.hidden,true);
  x.stop();assert.equal(x.doc.listeners.get('toggle').size,0);assert.equal(x.hooks.beforeRegex(raw,{}),raw);
});
test('quoted examples remain inert; complete EOF payload is recoverable and truncated JSON is diagnostic',()=>{
  const x=rendering();
  for(const raw of ['```html\n'+f.reported+'\n```','> '+f.reported,'`'+f.reported+'`','<blockquote>'+f.reported+'</blockquote>'])assert.doesNotMatch(x.render(raw),/cxx-update-diagnostic/);
  for(const field of ['isUser','isSystem','isReasoning'])assert.equal(x.hooks.beforeRegex(f.reported,{[field]:true}),f.reported);
  assert.match(x.render(f.valid),/cxx-update-diagnostic/);assert.doesNotMatch(x.render(f.valid),/CXXPROTECTED/);
  const recoverable=f.reported.slice(0,-17);assert.equal(parser.variableUpdates(recoverable).issues.length,0);assert.match(x.render(recoverable),/变量格式已识别/);
  const truncated='<UpdateVariable><JSONPatch>[{"op":';assert(parser.variableUpdates(truncated).issues.length);assert.match(x.render(truncated),/变量格式异常/);x.stop();
});
test('fallback prose folds bare text and sibling nodes, keeps open state, and restores source DOM',()=>{
  for(const multi of [false,true]){
    const doc=document('<main></main>'),container=doc.querySelector('main');
    if(multi){const p=doc.createElement('p');p.textContent=f.valid.slice(0,80);const q=doc.createElement('p');q.textContent=f.valid.slice(80);container.append(p,q);}
    else container.append(doc.createTextNode(f.valid));
    const text=container.textContent,visible=multi?f.valid.slice(0,80)+' '+f.valid.slice(80):f.valid;
    const api=prose.mount(container,{raw:()=>f.valid,renderText:()=>visible}),d=container.querySelector('details'),body=d.querySelector('.cxx-native-aux-body');
    assert.equal(d.open,false);assert.equal(body.hidden,true);assert.equal(body.textContent,text);
    d.open=true;d.dispatchEvent({type:'toggle'});api.refresh();assert.equal(d.open,true);assert.equal(body.hidden,false);assert.equal(container.querySelectorAll('details').length,1);
    api.destroy();assert.equal(container.querySelector('details'),null);assert.equal(container.textContent,text);assert.equal(d.listeners.get('toggle').size,0);
  }
});
test('reinstall uses one formatter dispatcher and releases owned listeners',()=>{
  const x=rendering(),stop2=guard.install({top:x.top,api:x.api,runtime:x.runtime,parser});x.stop();
  assert.match(x.render(f.reported),/cxx-update-diagnostic/);assert.equal(x.doc.listeners.get('toggle').size,1);stop2();assert.equal(x.doc.listeners.get('toggle').size,0);
});
test('current bundled parser accepts valid input; staged main and worker agree and preserve unrelated card data',async()=>{
  const s=stage(),oldCore=s.original.data.extensions.tavern_helper.scripts.find(x=>x.id==='cxx-business-core-241').content,old=vm.createContext({});
  vm.runInContext(extract(oldCore,['CxxGalParser'])[0].source,old);assert.equal(old.CxxGalParser.inspect(f.valid).roots.find(r=>r.kind==='UpdateVariable').valid,true);
  let result;const box=vm.createContext({postMessage:r=>result=r});box.self=box;vm.runInContext(s.worker,box);
  for(const raw of [story(f.valid),story(f.reported)]){box.onmessage({data:{id:1,kind:'parse',payload:{raw}}});assert.ok(!result.error);assert.deepEqual(JSON.parse(JSON.stringify(result.value)),parser.parseMessage(raw,{cache:false}));}
  const {checkCard}=require('../../测试/宿主/check.cjs'),tt=await checkCard(s.card);assert.equal(tt.cases.length,11);
});
