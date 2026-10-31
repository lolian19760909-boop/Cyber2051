'use strict';
const assert=require('node:assert/strict');
const {document}=require('../../测试/lib/dom.cjs');
const Core=require('../../卡片源码/运行时/core.js');
const probe=require('./probe.js');
const contract=require('./contract.json');
const copy=structuredClone;
const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).reverse().map(k=>[k,reorder(v[k])])):v;
function displayFixture(formatter){
  const doc=document('<html><head></head><body><div id="chat"><div class="mes" mesid="0"><div class="mes_text">opening</div></div><div class="mes" mesid="1"><div class="mes_text">old</div></div></div></body></html>');
  const create=doc.createElement;
  doc.createElement=tag=>{
    const node=create(tag);
    Object.defineProperty(node,'innerHTML',{set(value){for(const child of [...node.childNodes])child.remove();const fragment=document('<html><body>'+value+'</body></html>');node.append(...[...fragment.body.childNodes]);}});
    return node;
  };
  for(const node of doc.querySelectorAll('.mes_text'))node.replaceChildren=(...children)=>{for(const child of [...node.childNodes])child.remove();node.append(...children);};
  const context={chat:[{mes:'<OpeningPage id="0"/>'},{mes:'<cxx-story>街灯亮了。<em>该走了。</em></cxx-story>',swipe_id:0}],characters:[{name:'fixture'}],characterId:0,eventTypes:{CHAT_COMPLETION_PROMPT_READY:'prompt'},...formatter};
  const listeners=new Map(),watchers=new Set();let key='chat-a',formatCalls=0;
  if(context.messageFormatting)context.messageFormatting=text=>{formatCalls++;return '<p>'+text+'</p>';};
  const api={SillyTavern:{getContext:()=>context},eventOn:(n,f)=>listeners.set(n,f),eventRemoveListener:(n,f)=>{if(listeners.get(n)===f)listeners.delete(n);}};
  const runtime={alive:true,key:()=>key,watchMessages:f=>{watchers.add(f);return()=>watchers.delete(f);}};
  const top={document:doc,crypto:{randomUUID:()=> 'fixture'}};
  return {top,api,runtime,context,listeners,watchers,doc,refresh:()=>{for(const fn of watchers)fn({full:true});},changeScope:()=>{key='chat-b';},calls:()=>formatCalls};
}
async function runContracts(modules){
  const cases=[],warnings=[];
  const run=async(name,fn)=>{await fn();cases.push(name);};
  const guard=modules.CxxDisplayGuard235,parser=modules.CxxGalParser;
  await run('旧格式化接口：显示副本、编辑草稿、分支与聊天刷新、清理',()=>{
    const f=displayFixture({messageFormatting:()=>{}}),original=copy(f.context.chat),stop=guard.install({...f,parser});
    try{
      f.refresh();assert.equal(f.calls(),1);assert.match(f.doc.querySelector('[mesid="1"] .mes_text').textContent,/街灯亮了/);assert.deepEqual(f.context.chat,original);
      f.refresh();assert.equal(f.calls(),1,'unchanged messages must not rerender');
      const editor=f.doc.createElement('textarea');editor.className='edit_textarea';editor.textContent='未保存草稿';f.doc.querySelector('[mesid="1"]').append(editor);
      f.context.chat[1].mes+='新内容';f.refresh();assert.equal(f.calls(),1);assert.equal(editor.textContent,'未保存草稿');editor.remove();
      f.refresh();assert.equal(f.calls(),2);f.context.chat[1].swipe_id=1;f.refresh();assert.equal(f.calls(),3);f.changeScope();f.refresh();assert.equal(f.calls(),4);
    }finally{stop();}
    assert.equal(f.watchers.size,0);assert.equal(f.listeners.size,0);assert.equal(f.doc.querySelectorAll('[data-cxx-legacy-display]').length,0);
  });
  await run('新格式化接口：反复安装不叠加 hooks，销毁后不处理正文',()=>{
    const hooks=[],f=displayFixture({messageFormatter:{addHook:(fn,o)=>hooks.push({fn,...o})}});
    const a=guard.install({...f,parser}),b=guard.install({...f,parser});a();assert.equal(hooks.length,2);assert.equal(f.watchers.size,2,'one preference and one variable-receipt watcher remain on the active installation');
    const text=f.context.chat[1].mes,before=hooks.find(h=>h.stage==='beforeRegex').fn,after=hooks.find(h=>h.stage==='afterRegex').fn;
    assert.match(after(before(text,{})),/街灯亮了/);assert.equal(before(text,{isUser:true}),text);b();assert.equal(before(text,{}),text);assert.equal(f.listeners.size,0);assert.equal(f.watchers.size,0);
  });
  await run('缺少两种格式化接口：安装与销毁不崩溃',()=>{
    const f=displayFixture({});guard.install({...f,parser})();assert.equal(f.watchers.size,0);
  });
  await run('提示词副本：仅处理 assistant 文本，保留工具消息和多模态元数据',()=>{
    const f=displayFixture({}),stop=guard.install({...f,parser});
    const assistant={role:'assistant',name:'test',content:[{type:'text',text:f.context.chat[1].mes},{type:'image_url',image_url:{url:'fixture'}}]},tool={role:'tool',tool_call_id:'test',content:'工具原文'},user={role:'user',content:'用户原文'};
    const original=copy(assistant),payload={chat:[assistant,tool,user]};f.listeners.get('prompt')(payload);
    assert.deepEqual(assistant,original);assert.notEqual(payload.chat[0],assistant);assert.equal(payload.chat[1],tool);assert.equal(payload.chat[2],user);assert.equal(payload.chat[0].content[1],assistant.content[1]);stop();
  });
  const c={characters:[{avatar:'fixture.png',name:'fixture'}],characterId:0,groupId:null,getCurrentChatId:()=> 'a',getRequestHeaders:()=>({}),chat:[{mes:'正文',swipe_id:0,variables:[{stat_data:{terminal:{gameplay:{numeric:{hp:7,max:10},inventory:{a:1}}},other:{keep:1}}}]}]};
  const vars={__cxx_identity:{id:'fixture',nested:{a:1,b:2}},__cxx_ui_preferences:{device:'mobile'}};
  let disk=()=>reorder([{chat_metadata:{variables:vars}},...c.chat]),response=null,resolve;
  const api={SillyTavern:{getContext:()=>c},getVariables:()=>vars};
  const read=modules.CxxPlayerHost.createReader({api,hostWindow:{fetch:async(url,options)=>{
    assert.equal(url,'/api/chats/get');assert.equal(options.method,'POST');assert.equal(JSON.parse(options.body).file_name,'a');
    if(response)return response;return {ok:true,text:async()=>JSON.stringify(disk())};
  }}});
  await run('存档读回：对象键重排仍相等，原变量与未知字段不变',async()=>{const original=copy(c.chat);const saved=await read();assert.equal(saved.stat.terminal.gameplay.numeric.hp,7);assert.deepEqual(c.chat,original);});
  await run('存档读回：真实数值不一致不能报保存成功',async()=>{disk=()=>{const rows=copy([{chat_metadata:{variables:vars}},...c.chat]);rows[1].variables[0].stat_data.terminal.gameplay.numeric.hp=6;return rows;};await assert.rejects(read(),e=>e.code==='player-read-pending');});
  await run('存档读回：网页或非法格式必须报错',async()=>{response={ok:true,text:async()=>'<html>login</html>'};await assert.rejects(read(),/网页/);response={ok:true,text:async()=>'{}'};await assert.rejects(read(),/格式异常/);});
  await run('存档读回：晚到结果不能跨聊天生效',async()=>{let started;const entered=new Promise(r=>{started=r;});response={ok:true,text:()=>new Promise(r=>{resolve=r;started();})};const p=read();await entered;c.getCurrentChatId=()=> 'b';resolve(JSON.stringify([{chat_metadata:{variables:vars}},...c.chat]));await assert.rejects(p,e=>e.code==='context-changed');});
  await run('Gal：强制设备偏好与旋转后的浮层坐标',()=>{
    const L=modules.CxxGalLandscape;assert.equal(L.isMobile({innerWidth:390,innerHeight:844,navigator:{maxTouchPoints:1}}),true);assert.equal(L.isMobile({Cxx236Preferences:{read:()=>({device:'desktop'})},navigator:{maxTouchPoints:1}}),false);
    const v=L.geometry({width:390,height:844,left:3,top:9,rotated:true}),p=L.placement(v,{y:44});assert.equal(v.canvasWidth,844);assert.equal(p.left,'349px');assert.equal(p.top,'9px');assert.equal(p.height,'346px');assert.equal(p.transform,'rotate(90deg)');
  });
  await run('在线更新：按操作能力判断，旧版与未知版本保留可用功能',async()=>{
    const context=new Proxy({getCurrentChatId:()=> 'fixture'}, {get:(o,k)=>k in o?o[k]:()=>{}});
    const parent={};let version='1.19.0';const api=new Proxy({parent,SillyTavern:{getContext:()=>context},getTavernVersion:async()=>version,getTavernHelperVersion:async()=> '4.11.2',builtin:{duringGenerating:()=>false}},{get:(o,k)=>k in o?o[k]:()=>{}});
    const host=modules.CxxUpdateHost.create({api,core:Core,fetch:()=>{throw Error('readiness must not fetch');},hostOrigin:'http://fixture.invalid'});await host.ready();version=contract.reportedSillyTavernVersion;
    assert.equal((await host.ready()).st,version);version='unknown';await host.ready();
    parent.__TAURI_INTERNALS__={};assert.equal((await host.ready()).st,version);
    delete parent.__TAURI_INTERNALS__;parent.__TAURI__={core:{invoke(){}}};await host.ready();
    api.replaceScriptTrees=null;await assert.rejects(host.ready(),e=>e.code==='capability-missing');await host.ready('export');
  });
  await run('诊断探针：仅读接口，不读聊天正文、变量或保存',async()=>{
    let writes=0;const forbidden=()=>{writes++;throw Error('unexpected data access');};
    const context={messageFormatting(){},getCurrentChatId:forbidden,getRequestHeaders:forbidden,saveChat:forbidden,saveMetadata:forbidden,eventTypes:{CHAT_COMPLETION_PROMPT_READY:'prompt'}};
    Object.defineProperty(context,'chat',{get:forbidden});
    const root={SillyTavern:{getContext:()=>context},getVariables:forbidden,updateVariablesWith:forbidden,getTavernVersion:async()=> '1.18.0',getTavernHelperVersion:async()=> '4.11.2'};
    const report=await probe.collect(root);assert.equal(writes,0);assert.equal(report.formatter,'messageFormatting');assert.ok(report.notes.some(s=>s.includes('1.19.0')));assert.equal((await probe.collect({})).formatter,'unavailable');
  });
  return {cases,warnings};
}
module.exports={runContracts};
