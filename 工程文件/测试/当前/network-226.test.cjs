'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),B=require('../../工具/lib/card-ast.cjs');
const H=require('../../卡片源码/运行时/player-host.js'),N=require('../../卡片源码/运行时/network-diagnostics.js');
test('普通回复不重复读取整卡，定义、聊天与安装记录变化仍进入同步',async()=>{
 const load=require('../lib/fixture-loader.cjs'),{fixture,signedRelease}=load('controller.test.cjs',['fixture','signedRelease']),f=fixture(signedRelease());
 let locks=0;const lock=f.host.withLock;f.host.withLock=async work=>{locks++;return lock(work);};await f.controller.check();const before=locks;
 f.controller.attachContentSync(Object.assign(async()=>{}, {isCurrent:()=>true}));await f.controller.check();await f.controller.check();assert.equal(locks,before);
 f.controller.attachContentSync(Object.assign(async()=>{}, {isCurrent:()=>false}));await f.controller.check();assert.equal(locks,before+1);
});
test('内容指纹在原文、数值变化时复用，在切聊天、修改定义和绑定时失效',async()=>{
 const f=require('../lib/fixture-loader.cjs')('content-routing.test.cjs',['fixture']).fixture();let chat='a',book='one';f.options.host.getContext=()=>({characterKey:'a.png',chatId:chat});f.options.api.getChatWorldbookName=()=>book;
 await f.sync();assert.equal(f.sync.isCurrent(),true);chat='b';assert.equal(f.sync.isCurrent(),false);chat='a';book='two';assert.equal(f.sync.isCurrent(),false);book='one';f.state.registry.packages.sample.content.worldbook[0].content='新设定';assert.equal(f.sync.isCurrent(),false);await f.sync();assert.equal(f.sync.isCurrent(),true);
});
test('影像与保存收据合并读回；同分支已核对结果复用，变量变化重新读盘，写入检查仍读盘',async()=>{
 const c={characterId:0,characters:[{avatar:'a.png'}],getCurrentChatId:()=> 'a',chat:[{mes:'正文',swipe_id:0,variables:[{stat_data:{terminal:{wallet:{yen:10}}}}]}],chatMetadata:{variables:{}}};let reads=0,disk=structuredClone([{chat_metadata:c.chatMetadata},...c.chat]);const api={SillyTavern:{getContext:()=>c},getVariables:()=>c.chatMetadata.variables};
 const read=H.createReader({api,readDisk:async()=>{reads++;await Promise.resolve();return structuredClone(disk);}});
 await Promise.all([read({reuse:true}),read({reuse:true})]);assert.equal(reads,1);await read({reuse:true});assert.equal(reads,1);
 c.chat[0].variables[0].stat_data.terminal.wallet.yen=20;await assert.rejects(read({reuse:true}),{code:'player-read-pending'});assert.equal(reads,2);
 disk=structuredClone([{chat_metadata:c.chatMetadata},...c.chat]);await read({reuse:true});assert.equal(reads,3);await read();assert.equal(reads,4);
 c.getCurrentChatId=()=> 'b';await read({reuse:true});assert.equal(reads,5);
});
test('人物服务普通入口复用确认；本地字段变化失效，保存后仍独立读回',async()=>{
 const {fixture}=require('../lib/fixture-loader.cjs')('../当前/save.test.cjs',['fixture']),f=fixture();
 await f.player.completeOpening({value:f.choice});await f.player.waitForSaved();const start=f.stats().reads;
 await f.player.read();await Promise.all([f.player.read(),f.player.read()]);assert.equal(f.stats().reads,start);
 f.row.variables[f.row.swipe_id].stat_data.terminal.wallet.yen+=1;
 await assert.rejects(f.player.read(),{code:'player-read-pending'});assert.equal(f.stats().reads,start+1);
 f.setDisk([{chat_metadata:f.c.chatMetadata},...f.c.chat]);await f.player.read();const confirmed=f.stats().reads;
 await f.player.retrySave();assert.equal(f.stats().reads,confirmed+1);await f.player.read();assert.equal(f.stats().reads,confirmed+1);
});
test('人物读回的消息快照保留隔离，正文、角色、分支及楼层变化均拒绝旧磁盘',async()=>{
 for(const change of ['mes','is_user','is_system','swipe_id','length']){
  const row={mes:'正文',variables:[{stat_data:{hp:10}},{stat_data:{hp:10}}]};
  const c={characterId:0,characters:[{avatar:'a.png'}],getCurrentChatId:()=> 'a',chat:[row],chatMetadata:{variables:{}}};
  const disk=structuredClone([{chat_metadata:c.chatMetadata},...c.chat]);let reads=0;
  const read=H.createReader({api:{SillyTavern:{getContext:()=>c},getVariables:()=>c.chatMetadata.variables},readDisk:async()=>{reads++;return structuredClone(disk);}});
  const snapshot=await read();assert.equal(snapshot.messages[0].is_user,false);assert.equal(snapshot.messages[0].swipe_id,0);
  if(change==='length')c.chat.unshift({mes:'多一层',is_user:true});
  else row[change]=change==='mes'?'改文':change==='swipe_id'?1:true;
  assert.equal(snapshot.messages[0].mes,'正文');assert.equal(snapshot.messages.length,1);
  await assert.rejects(read({reuse:true}),{code:'player-read-pending'});assert.equal(reads,2);
 }
});
test('人物磁盘读取期间的旧楼层变化不能被当前楼层变量一致掩盖',async()=>{
 const c={characterId:0,characters:[{avatar:'a.png'}],getCurrentChatId:()=> 'a',chat:[{mes:'历史'},{mes:'当前',variables:[{stat_data:{hp:10}}]}],chatMetadata:{variables:{}}};
 const disk=structuredClone([{chat_metadata:c.chatMetadata},...c.chat]);let release;
 const read=H.createReader({api:{SillyTavern:{getContext:()=>c},getVariables:()=>({})},readDisk:()=>new Promise(resolve=>release=resolve)});
 const work=read();c.chat[0].mes='历史已编辑';release(disk);
 await assert.rejects(work,{code:'player-read-pending'});
});
test('Gal 保存未就绪最多四次核对，结束等待后继续阅读',async()=>{
 const code=B.read('卡片源码/Gal/host.js');let source='';B.walk(B.acorn.parse(code,{ecmaVersion:'latest'}),n=>{if(n.type==='FunctionDeclaration'&&['mvuSource','mvuSourceChanged','guardState','watchMvu'].includes(n.id.name))source+=code.slice(n.start,n.end)+'\n';});
 const jobs=[],row={mes:'正文',swipe_id:0},state={chat:[row]},sandbox={context:()=>state,key:()=> 'a',mvuBusy:()=>false,nativeBusy:()=>false,setTimeout:(fn,ms)=>(jobs.push({fn,ms}),jobs.length),clearTimeout(){},CxxContent:{savedEventMedia:async()=>{sandbox.calls++;throw Error('保存尚未完成');}},calls:0,win:{},runtime:{refresh(){}}};vm.createContext(sandbox);
 vm.runInContext("let destroyed=false,mvuRead=false,mvuScope='a',mvuTimer=null,mvuTarget=null,mvuBound=true,mvuSeen=true,mvuParsed=true,mvuSaving=false,mvuRound=1,mvuCommands=true,mvuChecks=0,mvuIdleChecks=0,mvuStatus='';"+source+';watchMvu();',sandbox);
 for(let n=0;n<8;n++){await Promise.resolve();await Promise.resolve();const j=jobs.shift();if(j){assert([1000,3000,8000].includes(j.ms));j.fn();}}
 assert.equal(sandbox.calls,4);assert.equal(jobs.length,0);assert.equal(vm.runInContext('mvuSaving',sandbox),false);assert.match(vm.runInContext('mvuStatus',sandbox),/可继续阅读/);
});
test('无 Mvu 时按卡内回执判定：applied 直接放行核对，rejected 立刻标注原因',async()=>{
 // 旧机制已移除：以前只有 mag_command_parsed 事件才算「变量写完了」；现在无 Mvu 时读 Cxx236VariableGuard 的回执。
 const code=B.read('卡片源码/Gal/host.js');let source='';B.walk(B.acorn.parse(code,{ecmaVersion:'latest'}),n=>{if(n.type==='FunctionDeclaration'&&['mvuSource','mvuSourceChanged','guardState','watchMvu'].includes(n.id.name))source+=code.slice(n.start,n.end)+'\n';});
 const build=(receipt)=>{const jobs=[],notes=[],row={mes:'正文',swipe_id:0},state={chat:[row]},sandbox={context:()=>state,key:()=>'a',mvuBusy:()=>false,nativeBusy:()=>false,setTimeout:(fn,ms)=>(jobs.push({fn,ms}),jobs.length),clearTimeout(){},statusNote:(text,ms)=>notes.push({text,ms}),CxxContent:{savedEventMedia:async()=>({saved:true,floor:0,swipe:0,outcome:{phase:receipt.phase,message:receipt.message}})},win:{Cxx236VariableGuard:{state:()=>({ready:true,receipt})}},runtime:{refresh(){}}};vm.createContext(sandbox);
  vm.runInContext("let destroyed=false,mvuRead=false,mvuScope='a',mvuTimer=null,mvuTarget=null,mvuBound=true,mvuSeen=false,mvuParsed=false,mvuSaving=false,mvuRound=1,mvuCommands=false,mvuChecks=0,mvuIdleChecks=0,mvuStatus='';"+source+';watchMvu();',sandbox);
  return {sandbox,jobs,notes};};
 const ok=build({phase:'applied'});
 for(let n=0;n<6;n++)await Promise.resolve();
 assert.equal(vm.runInContext('mvuSeen',ok.sandbox),true,'回执 applied 应视为已看到变量结果');
 assert.equal(vm.runInContext('mvuParsed',ok.sandbox),true,'回执 applied 应视为已解析，不必等 MVU 事件');
 assert.deepEqual(ok.notes.map(x=>x.text),['变量已应用，保存待核对。']);
 const bad=build({phase:'rejected',message:'路径不合法'});
 assert.equal(vm.runInContext('mvuParsed',bad.sandbox),true,'被拒也算解析完成，不该继续空等');
 for(let n=0;n<6;n++)await Promise.resolve();
 assert.deepEqual(bad.notes.map(x=>x.text),['变量未应用：路径不合法'],'被拒原因必须出现在状态栏提示里');
 assert.doesNotMatch(bad.notes.map(x=>x.text).join('|'),/已保存并核对/);
});
test('流量诊断只保留路径和数值，按楼层分组，跨域缺计数单独标记',()=>{
 let floor=1;const n=N.create({origin:'https://host.test',context:()=>({character:'a',chat:'x',floor,branch:0})});
 n.add({name:'https://host.test/api/chats/get?token=hidden',transferSize:5000,decodedBodySize:9000});n.add({name:'https://cyber2051.top/a.png?private=hidden',transferSize:0,decodedBodySize:0});
 assert.equal(n.read()[0].transferBytes,5000);assert.equal(n.read()[0].unmeasured,1);assert(!JSON.stringify(n.read()).includes('hidden'));
 for(floor=2;floor<30;floor++)n.add({name:'https://host.test/api/chats/save',transferSize:320,decodedBodySize:10});assert.equal(n.read().length,20);
});
test('卡内框架请求合入同轮统计，卸载断开监听，重建可以再次采集',()=>{
 const callbacks=[],observers=[];function window(){const events=new Map();return {location:{origin:'https://host.test'},addEventListener:(e,f)=>events.set(e,f),removeEventListener:(e,f)=>{if(events.get(e)===f)events.delete(e);},PerformanceObserver:class{constructor(cb){callbacks.push(cb);observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}},hide:()=>events.get('pagehide')?.()};}
 const top=window(),frame=window(),n=N.install(top,()=>({floor:1}));n.watch(frame);n.watch(frame);assert.equal(observers.length,2);callbacks[1]({getEntries:()=>[{name:'https://host.test/api/chats/get',transferSize:1200,decodedBodySize:1000}]});assert.equal(n.read()[0].transferBytes,1200);
 frame.hide();assert.equal(observers[1].active,false);n.watch(frame);assert.equal(observers.length,3);n.destroy();assert(observers.every(x=>!x.active));
});
test('变量差异记录变化路径、删除和新增，限制条目与总详情大小',()=>{
 const D=require('../../卡片源码/运行时/diagnostics.js'),d=D.difference({hp:20,old:3},{hp:15,xp:50});assert.deepEqual(d.changes.map(x=>x.path),['/hp','/old','/xp']);assert.equal(d.changes[1].after,'（未设置）');
 const many=Object.fromEntries(Array.from({length:150},(_,i)=>['k'+i,'字'.repeat(300)])),r=D.difference({},many);assert(r.changes.length>0&&r.changes.length<=40);assert.equal(r.changes.length+r.omitted,150);assert(JSON.stringify(r).length<=4800);
});

test('临时图片缓存按预算淘汰，解码引用由对象URL单独持有',()=>{
 const code=B.read('卡片源码/运行时/resources.js');let source;B.walk(B.acorn.parse(code,{ecmaVersion:'latest'}),n=>{if(n.type==='FunctionDeclaration'&&n.id.name==='remember')source=code.slice(n.start,n.end);});const box={};vm.createContext(box);vm.runInContext("const memory=new Map(),leases=new Map([['a',1],['b',1]]);let memoryBytes=0;"+source+";remember({id:'a',bytes:20*1048576});remember({id:'b',bytes:20*1048576});",box);assert.equal(vm.runInContext('memoryBytes',box),20*1048576);assert.equal(vm.runInContext('leases.size',box),2);assert.equal(vm.runInContext('memory.has(\'a\')',box),false);
});
