'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const parser=require('../../卡片源码/Gal/parser.js'),guard=require('../../卡片源码/正文/display-guard.js');
const {build}=require('../../工具/构建/当前/build.cjs'),{workerNode}=require('../../工具/lib/card-ast.cjs');
const scene={date:'2051年3月31日',time:'17:00',location:'红花街路口',characters:[]};
const body='<cxx-story>路灯亮了。\n<em>该回去了。</em></cxx-story>\n<ztl>'+JSON.stringify(scene)+'</ztl>\n<xuan>1. 等待\n2. 转身\n3. 查看\n4. 回家\n5. 挥手</xuan>';
// Same structure as the reported reply: protocol examples without closing tags,
// a prefilled planning opener omitted from storage, then valid real protocols.
const head='准备开始。\n3. 状态栏 <ztl> 使用 JSON。\n4. 选项 <xuan> 从 1 到 5。\n5. <tucao> 只有一段。\n<StatusPlaceHolderImpl/>\n<em>这里只是格式示例</em>\n';
const raw=head+'</konatan_planning~>\n<tucao>准备完成。</tucao>\n'+body;
let card,worker;
before(async()=>{card=(await build()).card;worker=workerNode(card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-business-core-241').content).value;});
test('prefilled planning examples cannot consume real story, status or options',()=>{
 const p=parser.parseMessage(raw);assert.equal(p.raw,raw);assert.deepEqual(parser.inspect(raw).diagnostics,[]);assert.equal(p.choices.length,5);assert.equal(p.scene.location,scene.location);assert.equal(p.paragraphs[0].text,'路灯亮了。');assert.equal(p.paragraphs[1].kind,'thought');assert.equal(p.auxiliary.filter(x=>x.label==='查看思考').length,1);assert.equal(p.auxiliary.filter(x=>x.label==='查看吐槽').length,1);assert.equal(p.validation.statusPlaceholder,false);
});
test('both explicit planning opener and direct story after the closer work',()=>{
 for(const s of ['<konatan_planning~>'+raw,head+'</konatan_planning~>\n'+body]){const p=parser.parseMessage(s);assert.deepEqual(parser.inspect(s).diagnostics,[]);assert.equal(p.choices.length,5);assert.equal(p.scene.location,scene.location);assert.equal(p.paragraphs[0].text,'路灯亮了。');assert.equal(p.raw,s);}
});
test('planning dialogue examples stay literal in native, Gal and outbound history copies',()=>{
 for(const transform of [parser.prepareDialogue,parser.nativeDialogue,parser.historyDialogue])assert.ok(transform(raw).startsWith(head+'</konatan_planning~>'));
 assert.ok(!parser.parseMessage(raw).paragraphs.some(p=>p.text.includes('格式示例')));
});
test('quoted, fenced and indented planning examples do not become a prefix',()=>{
 for(const literal of ['```html\n'+raw+'\n```','> '+raw.replaceAll('\n','\n> '),'    '+raw.replaceAll('\n','\n    '),'<pre>'+raw+'</pre>']){assert.equal(parser.inspect(literal).planning,null);assert.equal(parser.parseMessage(literal).scene,null);assert.equal(parser.parseMessage(literal).choices.length,0);}
 for(const close of ['`</konatan_planning~>`','“</konatan_planning~>”','    </konatan_planning~>'])assert.equal(parser.inspect(head+'\n'+close+'\n'+body).planning,null);
});
test('a closer after real story is not treated as a leading prefill',()=>{
 assert.equal(parser.inspect(body+'\n</konatan_planning~>\n'+body).planning,null);
 assert.equal(parser.inspect(head+'</konatan_planning~>普通文字').planning,null);
});
test('streaming cannot activate protocol examples before the planning boundary arrives',()=>{
 const prefix=head+'</konatan_planning~>\n<tucao>';
 for(let i=0;i<=prefix.length;i++){const p=parser.parseMessage(prefix.slice(0,i),{cache:false});assert.equal(p.scene,null);assert.equal(p.choices.length,0);}
 assert.equal(parser.parseMessage(raw).choices.length,5);
});
test('malformed real protocols after the prefix retain validation errors',()=>{
 const malformed=raw.replace('<ztl>'+JSON.stringify(scene)+'</ztl>','<ztl>broken</ztl>');const p=parser.parseMessage(malformed);assert.equal(p.scene,null);assert.ok(parser.inspect(malformed).diagnostics.length);assert.equal(p.choices.length,5);assert.ok(p.paragraphs.some(x=>x.text.includes('broken')));
});
test('the embedded background parser produces the same result as the maintained parser',()=>{
 let result;const box=vm.createContext({postMessage:r=>{result=r;}});box.self=box;vm.runInContext(worker,box);box.onmessage({data:{id:1,kind:'parse',payload:{raw}}});assert.ok(!result.error);assert.deepEqual(JSON.parse(JSON.stringify(result.value)),parser.parseMessage(raw,{cache:false}));
});
test('actual paired preset folding and card slots survive the display guard',()=>{
 const preset=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../卡片源码/预设/Izumi-V0.8.json'))),hooks={};
 const stop=guard.install({top:{crypto:{randomUUID:()=> 'prefill-test'}},api:{SillyTavern:{getContext:()=>({messageFormatter:{addHook:(fn,o)=>hooks[o.stage]=fn}})}},runtime:{alive:true,key:()=> 'chat'},parser});
 let rendered=hooks.beforeRegex(raw,{});
 for(const rule of [...preset.extensions.regex_scripts,...card.data.extensions.regex_scripts]){
  if(rule.disabled||!rule.placement.includes(2)||rule.promptOnly||rule.minDepth>0)continue;
  const m=/^\/(.*)\/([dgimsuvy]*)$/.exec(rule.findRegex);const re=m?new RegExp(m[1],m[2]):new RegExp(rule.findRegex);rendered=rendered.replace(re,rule.replaceString);
 }
 rendered=hooks.afterRegex(rendered);assert.match(rendered,/<details/);assert.match(rendered,/data-cxx-slot="status[012]"/);assert.match(rendered,/data-cxx-slot="options"/);assert.match(rendered,/路灯亮了/);assert.match(rendered,/bdc-thought/);assert.ok(!/CXXPROTECTED|CXXDIALOGUE|标签异常|&lt;cxx-story>/.test(rendered));assert.match(rendered,/&lt;ztl>/);assert.equal(hooks.beforeRegex(raw,{isUser:true}),raw);stop();
});
