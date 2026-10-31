'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require("../../网站/gateway/workshop-contract.cjs");
const read=name=>fs.readFileSync(path.join(__dirname,'../../网站/gateway/public',name),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
function element(tag='div'){
 const style={};Object.defineProperty(style,'cssText',{set(value){this.text=value;const match=value.match(/(?:^|;)display:([^;]+)/);if(match)this.display=match[1];},get(){return this.text||'';}});
 const node={tag,style,children:[],listeners:{},value:'',checked:false,hidden:false,options:[],className:'',textContent:'',
  append(...items){this.children.push(...items);if(tag==='select')for(const item of items){this.options.push(item);if(this.options.length===1)this.value=item.value;}},
  appendChild(item){this.append(item);return item;},replaceChildren(...items){this.children=[];this.append(...items);},
  addEventListener(name,fn){this.listeners[name]=fn;},removeAttribute(){},reportValidity(){return true;},click(){return this.listeners.click?.();},
  querySelector(selector){this.selected??=new Map();if(!this.selected.has(selector))this.selected.set(selector,element());return this.selected.get(selector);},
  querySelectorAll(selector){const result=[];const walk=n=>{if(!n||typeof n!=='object')return;if(n.tag==='input'&&n.type==='checkbox'&&(!selector.endsWith(':checked')||n.checked))result.push(n);for(const child of n.children||[])walk(child);};walk(this);return result;}};
 let value='';Object.defineProperty(node,'value',{get(){return value;},set(next){value=String(next);}});return node;
}
function dom(){const nodes=new Map();return {nodes,document:{createElement:element,getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);}}};}
test('My submissions routes all four connected types to the owner guided page; unknown old types retain the old editor',()=>{
 const html=read('my.html'),script=html.match(/function card\(it\) \{[\s\S]*?(?=async function boot\()/)[0];
 const d=dom(),context=vm.createContext({...d,location:{href:''},CXXI18N:{t:(key,fallback)=>fallback},TYPE_CN:{},$:id=>d.document.getElementById(id)});
 vm.runInContext(script+'\nglobalThis.makeCard=card;',context);
 for(const type of ['character','world_factor','user_identity','contract','shop_item','blueprint','recipe','skill','function','code_component','future_type']){
  context.location.href='';const card=context.makeCard({id:42,type,revision:3,status:'approved',title:'合成稿',tags:[],payload:{content:'旧正文'}});
  const actions=card.children.find(n=>n.className==='toolbar'),button=actions.children.find(n=>n.textContent==='改稿');button.click();
  if(type==='future_type'){assert.equal(context.location.href,'');assert.equal(card.children.at(-1).style.display,'');}
  else{assert.equal(context.location.href,'/workshop/submit.html?edit=42');assert.equal(card.children.at(-1).style.display,'none');}
 }
});
test('actual guided edit source restores all seven templates and legacy JSON with owner GET and original revision',async()=>{
 const submit=read('submit.html');const source=submit.slice(submit.indexOf("const contractForm ="),submit.lastIndexOf('</script>'));
 for(const form of C.schema().templates){
  let payload;if(!['contract','world_factor','character','user_identity'].includes(form.type)){payload=require("../../网站/gateway/workshop-gameplay-fixtures.cjs").payload(form.id);}else if(form.type==='contract'){payload={format:1,...(form.id==='side_story'?{templateKind:'side_story'}:{}),contract:{fixer:'发布人',type:'调查',difficulty:'低',pay:30000,mapId:'tokyo-central',placeId:'beni-street',brief:'第一版简报',goal:'第一版目标',prerequisites:['q01']}};}
  else{payload={format:1,templateKind:form.id,mapId:'tokyo-central',placeId:'beni-street',keywords:['红花街']};for(const [key]of form.fields)payload[key]='静态 '+key;}
  await run(form.type,payload,false);
 }
 for(const type of ['character','world_factor','user_identity'])await run(type,{legacy:'只读静态正文'},true);
 async function run(type,payload,raw){
  const d=dom(),calls=[],item={id:42,type,revision:4,status:'approved',title:'合成改稿',summary:'简介',authorName:'已绑定作者',tags:['验收'],payload};
  d.document.getElementById('type').value='contract';
  const fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.endsWith('/schema')?{ok:true,schema:C.schema()}:url.endsWith('/update')?{ok:true,revision:5}:url.endsWith('/attachment')?{ok:true,revision:6}:{ok:true,item:copy(item)}};};
  const context=vm.createContext({window:{},...d,fetch,URLSearchParams,location:{search:'?edit=42'},CXXI18N:{t:(key,fallback)=>fallback},$:id=>d.document.getElementById(id),authHeaders:extra=>({...extra,Authorization:'Bearer synthetic-owner'})});
  vm.runInContext(read('contract-form.js')+'\nglobalThis.CxxContractForm=window.CxxContractForm;',context);
  vm.runInContext(source+'\nglobalThis.done=editReady;globalThis.readForm=formData;globalThis.getEditing=()=>editing;',context);await context.done;
  const value=copy(await context.readForm());assert.deepEqual(value,{type,title:item.title,authorName:item.authorName,tags:item.tags,summary:item.summary,payload});
  assert.equal(d.document.getElementById('use-json').checked,raw);assert.equal(context.getEditing().revision,4);
  assert.equal(calls.find(x=>x.url.endsWith('/42/edit')).options.headers.Authorization,'Bearer synthetic-owner');
  if(type==='code_component')d.document.getElementById('file').files=[{name:'proposal.js',arrayBuffer:async()=>new TextEncoder().encode('// Review-only proposal').buffer}];
  await d.document.getElementById('send').click();const update=calls.find(x=>x.url.endsWith('/42/update'));
  assert.equal(update.options.headers.Authorization,'Bearer synthetic-owner');assert.deepEqual(JSON.parse(update.options.body),{...value,baseRevision:4});
  assert.equal(context.getEditing().revision,type==='code_component'?6:5);assert.equal(context.getEditing().status,'pending');
  if(type==='code_component'){const attachment=calls.find(x=>x.url.endsWith('/42/attachment'));assert.ok(attachment);assert.equal(attachment.options.headers.Authorization,'Bearer synthetic-owner');assert.equal(new TextDecoder().decode(attachment.options.body),'// Review-only proposal');assert.ok(calls.indexOf(attachment)>calls.indexOf(update));}
 }
});
