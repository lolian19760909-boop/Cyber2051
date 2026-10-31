'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require("../../网站/gateway/workshop-contract.cjs"),{sample}=require('./examples.cjs');
function harness(){
  const events={},nodes=new Map();let lang='zh';
  function element(tag='div'){
    let text='',value='',id='';const e={tag,children:[],listeners:{},style:{},attributes:{},hidden:false,disabled:false,checked:false,className:'',files:[],
      append(...items){for(const x of items){this.children.push(x);if(x&&typeof x==='object')x.parent=this;}if(tag==='select'&&!value)value=this.options[0]?.value||'';},
      appendChild(x){this.append(x);return x;},replaceChildren(...items){this.children=[];text='';if(tag==='select')value='';this.append(...items);},
      setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},addEventListener(k,f){this.listeners[k]=f;},
      async fire(k){return this.listeners[k]?.({target:this,preventDefault(){}});},remove(){this.parent.children=this.parent.children.filter(x=>x!==this);},
      reportValidity(){return !this.required||Boolean(this.value.trim());},contains(x){return this===x||this.children.some(c=>c&&typeof c==='object'&&c.contains?.(x));},
      querySelectorAll(selector){let root=this;if(selector.includes('#guided-prerequisites'))root=nodes.get('guided-prerequisites')||this;const found=[];function walk(n){if(!n||typeof n!=='object')return;if(n.tag==='input'&&n.type==='checkbox'&&(!selector.endsWith(':checked')||n.checked))found.push(n);for(const c of n.children)walk(c);}walk(root);return found;},
    };
    Object.defineProperties(e,{id:{get:()=>id,set:x=>{id=x;nodes.set(x,e);}},value:{get:()=>value,set:x=>{value=String(x??'');}},options:{get:()=>e.children.filter(c=>c?.tag==='option')},textContent:{get:()=>text,set:x=>{text=String(x);e.children=[];}}});return e;
  }
  const document={createElement:element,addEventListener(k,f){(events[k]??=[]).push(f);},getElementById(id){if(!nodes.has(id)){const e=element();e.id=id;}return nodes.get(id);}};
  const context=vm.createContext({document,fetch:async()=>({ok:true,json:async()=>({ok:true,schema:C.schema()})}),console,URL,URLSearchParams});context.window=context;context.CXXI18N={current:()=>lang};
  for(const name of ['submission-template.js','contract-form.js','submission-view.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../网站/gateway/public',name),'utf8'),context);
  const container=element(),form=context.CxxContractForm(container);
  return {form,container,nodes,context,element,async language(next){lang=next;for(const f of events['cxx-lang-changed']||[])await f();}};
}
const copy=x=>JSON.parse(JSON.stringify(x));
test('actual form round trips all fields, media and prerequisites across kind/language switches',async()=>{
  const h=harness();await h.form.ready;
  const npc=sample('npc').payload;npc.media=[{id:'portrait',url:'https://cyber2051.top/img/example.png',alt:'图片说明'}];
  h.form.setKind('npc');h.form.fill(npc);assert.deepEqual(copy(h.form.read()),npc);
  h.form.setKind('contract');const quest=sample('contract').payload;quest.contract.prerequisites=['q01','q02'];h.form.fill(quest);
  await h.language('en');assert.deepEqual(copy(h.form.read()),quest);
  h.form.setKind('user_identity');const origin=sample('user_identity').payload;h.form.fill(origin);await h.language('ja');assert.deepEqual(copy(h.form.read()),origin);
  h.form.setKind('npc');assert.deepEqual(copy(h.form.read()),npc);
  h.nodes.get('guided-name').value='已修改的姓名';await h.nodes.get('guided-name').fire('input');assert.equal(h.nodes.get('guided-keywords').value,'林澈','explicit keywords stay unchanged');
  h.form.setKind('contract');assert.deepEqual(copy(h.form.read()),quest);
  h.form.setKind('npc');assert.equal(h.form.read().sections.name,'已修改的姓名');
});
test('unfinished drafts export without validation; keyword suggestion and legacy gaps stay editable',async()=>{
  const h=harness();await h.form.ready;h.form.setKind('npc');h.nodes.get('guided-name').value='新姓名';await h.nodes.get('guided-name').fire('input');assert.equal(h.nodes.get('guided-keywords').value,'新姓名');
  assert.throws(()=>h.form.read());assert.equal(h.form.read({validate:false}).sections.name,'新姓名');
  h.nodes.get('guided-keywords').value='自定触发词';await h.nodes.get('guided-keywords').fire('input');h.nodes.get('guided-name').value='另一个姓名';await h.nodes.get('guided-name').fire('input');assert.equal(h.nodes.get('guided-keywords').value,'自定触发词');
  const old={format:1,templateKind:'npc',name:'旧名',identity:'旧身份',background:'旧段落',mapId:'tokyo-central',placeId:'plaza',keywords:['旧名']};h.form.fill(old);assert.equal(h.form.read({validate:false}).sections.background,'旧段落');assert.equal(h.nodes.get('guided-personality').value,'');
  h.form.setKind('world_factor');assert.throws(()=>h.form.read());h.form.setKind('npc');assert.equal(h.nodes.get('guided-background').value,'旧段落');
});
test('shared readable view displays literal text and revision comparison without HTML interpretation',()=>{
  const h=harness(),out=h.element();h.context.CxxSubmissionView.render(out,{panels:[{title:'世界书正文',text:'【姓名】\n<literal text>\n两行正文'}]},{previousRevision:2,changes:[{label:'背景',before:'旧文',after:'新文'}]});
  assert.equal(out.children[0].children[1].textContent,'【姓名】\n<literal text>\n两行正文');assert.equal(out.children[1].children[1].children[2].textContent,'旧文');
});
module.exports={harness};
test('actual submission-page editor loads legacy and new posts, renders preview and exports incomplete drafts',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../网站/gateway/public/submit.html'),'utf8'),inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  for(const kind of ['npc','user_identity','contract','paused','legacy','withdrawn']){
    const h=harness();await h.form.ready;
    for(const m of html.matchAll(/<(select|input|textarea|div|button|pre|details|a|span)[^>]*\bid="([^"]+)"[^>]*>/g)){const node=h.element(m[1]);node.id=m[2];node.required=m[0].includes(' required');}
    const d=sample(['npc','user_identity','contract'].includes(kind)?kind:'npc');
    if(kind==='paused'){d.type='world_factor';d.payload={format:1,templateKind:'world_factor',content:'关闭类别原稿'};}
    if(kind==='legacy')d.payload={format:1,templateKind:'npc',name:'旧人物',identity:'旧身份',background:'旧背景',mapId:'tokyo-central',placeId:'plaza',keywords:['旧人物']};
    const item={...d,id:42,revision:4,status:kind==='withdrawn'?'withdrawn':'approved'},calls=[],saved=[];
    Object.assign(h.context,{location:{search:'?edit=42'},navigator:{},setTimeout,Blob,URL:{createObjectURL:x=>{saved.push(x);return 'blob:fixture';},revokeObjectURL(){}},CXXUser:{headers:x=>x||{},check:async()=>({displayName:'合成作者'}),cancelLogin(){},logout(){}}});
    h.context.addEventListener=()=>{};
    h.context.fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/schema')?{ok:true,schema:C.schema()}:url.endsWith('/preview')?{ok:true,preview:C.presentation(JSON.parse(options.body))}:{ok:true,item}};};
    // 下载只记录 Blob，不触发本机保存。
    const create=h.context.document.createElement;h.context.document.createElement=tag=>{const e=create(tag);e.click=()=>{};return e;};
    vm.runInContext(inline+'\nglobalThis.loaded=editReady;globalThis.pageForm=formData;',h.context);await h.context.loaded;
    assert.equal(h.nodes.get('payload').textContent,JSON.stringify(item.payload,null,2));assert.equal(h.nodes.get('original-draft').hidden,false);
    if(kind==='paused'||kind==='withdrawn'){assert.equal(h.nodes.get('send').disabled,true);assert.equal(h.nodes.get('preview-content').disabled,true);await h.nodes.get('export-draft').fire('click');assert.deepEqual(JSON.parse(await saved[0].text()),item);}
    else if(kind==='legacy'){assert.equal(h.nodes.get('guided-background').value,'旧背景');assert.equal(h.nodes.get('guided-personality').value,'');await h.nodes.get('export-draft').fire('click');assert.equal(JSON.parse(await saved[0].text()).payload.sections.background,'旧背景');}
    else {assert.deepEqual(copy(await h.context.pageForm()),d);await h.nodes.get('preview-content').fire('click');assert.ok(h.nodes.get('content-preview').children.length);assert.ok(h.nodes.get('preview-json').textContent.includes('templateVersion'));}
  }
});
test('My posts retains read/export after withdrawal and hides closed-category edit/attachment actions',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../网站/gateway/public/my.html'),'utf8'),source=html.slice(html.indexOf('function card(it) {'),html.indexOf('async function boot()'));
  for(const [type,status,payload]of [['character','approved',sample('npc').payload],['world_factor','approved',{templateKind:'world_factor',content:'旧稿'}],['character','withdrawn',sample('npc').payload]]){
    const h=harness();await h.form.ready;Object.assign(h.context,{TYPE_CN:{},location:{href:''},Blob,URL,setTimeout});h.context.CXXI18N.t=(k,v)=>v;
    vm.runInContext(source+'\nglobalThis.makeCard=card;',h.context);const card=h.context.makeCard({id:19,type,status,payload,title:'原稿',summary:'简介',tags:[],revision:2});
    const acts=card.children.find(e=>e.className==='toolbar');assert.equal(acts.hidden,false);assert.ok(acts.children.some(e=>e.textContent==='导出原稿'));
    const open=type==='character'&&status!=='withdrawn';assert.equal(acts.children[0].textContent,open?'改稿':'查看原稿');assert.equal(acts.children.some(e=>e.textContent==='传附件'),open);
    await acts.children[0].fire('click');assert.equal(h.context.location.href,'/workshop/submit.html?edit=19');
  }
});
