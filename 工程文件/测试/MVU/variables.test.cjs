'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const z=require('../../独立制卡器/node_modules/zod'),Schema=require("../../卡片源码/MVU/schema.js"),Guard=require("../../卡片源码/MVU/variables.js"),{executor}=require('./mvu-fixture.cjs');
const schema=Schema.build(z),copy=structuredClone,patch=p=>'<UpdateVariable><JSONPatch>'+JSON.stringify(p)+'</JSONPatch></UpdateVariable>',replace=(path,value)=>({op:'replace',path,value});
function stat(){return {...Object.fromEntries(Schema.characters.map(k=>[k,{好感度:100,extension:{keep:true}}])),terminal:{wallet:{id:'wallet',yen:1000,earned:1000,spent:0,custom:'keep'},quests:{q01:{id:'q01',state:'进行中',rank:'',acceptedFloor:1,custom:42}},gameplay:{schema:1,inventory:{},blueprints:{},skills:{},equipment:{},resources:{},events:{},results:{},custom:{keep:true}},net:{news:['old'],custom:{keep:true}}},unknown:{record:'keep'}};}
function setup(options={}){
 let key='A';const handlers=new Map(),messages=[{mes:'greeting'},{is_user:true,mes:'hello'}],c={chat:messages,eventTypes:{CHAT_CHANGED:'changed'}},notices=[];
 const api={SillyTavern:{getContext:()=>c},eventOn:(n,f)=>{if(!handlers.has(n))handlers.set(n,new Set());handlers.get(n).add(f);},eventRemoveListener:(n,f)=>handlers.get(n)?.delete(f)};
 const emit=async(n,...args)=>{for(const f of [...handlers.get(n)||[]])await f(...args);},mvu=executor(emit);api.Mvu={events:{COMMAND_PARSED:Guard.events.parsed,VARIABLE_UPDATE_ENDED:Guard.events.ended},parseMessage:mvu.run};
 const data={stat_data:stat(),initialized_lorebooks:{original:[15]},display_data:{old:1},delta_data:{old:2},other:{keep:true}};data.schema=copy(mvu.schema(copy(data.stat_data)));data.schema.properties.terminal.properties.gameplay.extensible=true;data.schema.properties.terminal.properties.gameplay.recursiveExtensible=true;data.schema.strictSet=true;data.schema.strictTemplate=false;messages[0].variables=[data];
 const policy=()=>({questRegistered:id=>id==='q01',questPays:()=>30000,mapIndex:{central:['plaza','clinic']}}),greetings=[];for(const [id,value]of [[20,1000],[23,600]])greetings[id]='<OpeningPage id="'+id+'"/>\n'+patch(Schema.characters.map(c=>replace('/'+c+'/好感度',value)));
 const checkedSchema=options.capture?{...schema,prepare(p,b,o){options.capture(o);return schema.prepare(p,b,o);}}:schema;
 const create=()=>Guard.create({api,win:{toastr:{warning:m=>notices.push(m),info:m=>notices.push(m)}},runtime:{key:()=>key},schema:options.missing?null:checkedSchema,greetings,policy});const service=create();
 return {data,c,api,emit,mvu,greetings,notices,service,create,handlers,async change(){key='B';await emit('changed');},run:async source=>{const result=copy(data);await mvu.run(source,result);return copy(result);}};
}
test('numbers: only explicit numeric strings convert; invalid values reject the entire batch',async()=>{
 const h=setup();for(const value of ['', ' ',true,false,null,'一百','0x10','Infinity','1,000']){const result=await h.run(patch([replace('/terminal/wallet/yen',1015),replace('/terminal/wallet/earned',value)]));assert.deepEqual(result,h.data,String(value));}
 const result=await h.run(patch([replace('/terminal/wallet/yen',' 1015 '),replace('/terminal/wallet/earned',' 1015 ')]));assert.equal(result.stat_data.terminal.wallet.yen,1015);assert.equal(h.service.state().lastError,'');assert.deepEqual(result.initialized_lorebooks,h.data.initialized_lorebooks);assert.equal(result.schema.type,'object');assert.equal(result.schema.strictSet,true);assert.ok(result.display_data);assert.ok(result.delta_data);h.service.destroy();
});
test('paths and bounds: reject unknown fields, container writes, unsupported operations and negative wallet',async()=>{
 const h=setup();for(const p of [[replace('/新人/好感度',1)],[replace('/terminal',{})],[replace('/unknown/record','changed')],[{op:'delta',path:'/高松灯/好感度',value:1}],[replace('/terminal/wallet/yen',-1)]])assert.deepEqual(await h.run(patch(p)),h.data);
 assert.deepEqual(await h.run('<JSONPatch>[{"op":"replace" broken]</JSONPatch>'),h.data);assert.deepEqual(await h.run('_.set("高松灯.好感度", 1000);'),h.data);
});


test('retired special greetings preserve saved fields and do not initialize affinity',async()=>{
 const h=setup();for(const id of [20,23]){h.c.chat.splice(1);h.c.chat[0].mes=h.greetings[id];h.c.chat[0].swipe_id=id;const data=copy(h.data);await h.emit(Guard.events.initialized,data,id);await h.mvu.run(h.greetings[id],data);assert.deepEqual(data.stat_data,h.data.stat_data);}
 h.c.chat.push({is_user:true,mes:'初始化'});assert.deepEqual((await h.run(h.greetings[20])).stat_data,h.data.stat_data);h.service.destroy();
});
test('replay, repeated loading, dependency errors and chat switch do not apply a late batch',async()=>{
 const h=setup(),text=patch([replace('/terminal/wallet/yen',1020),replace('/terminal/wallet/earned',1020)]);const first=await h.run(text),repeated=copy(first);await h.mvu.run(text,repeated);assert.equal(repeated.stat_data.terminal.wallet.yen,1020);
 h.service.destroy();const service=h.create();assert.equal(h.handlers.get(Guard.events.parsed).size,1);h.api.eventOn('mag_variable_updated',async()=>h.change());await assert.rejects(()=>h.run(text),/聊天已切换/);service.destroy();assert.equal(h.handlers.get(Guard.events.parsed).size,0);
 const missing=setup({missing:true});assert.equal(missing.service.state().ready,false);assert.deepEqual(await missing.run(text),missing.data);assert.match(missing.service.state().lastError,/未就绪/);missing.service.destroy();
});
test('retired affinity commands are skipped while valid same-batch wallet changes settle once',async()=>{
 const h=setup();h.data.stat_data.高松灯.好感度='历史值';
 const p=patch([replace('/高松灯/好感度',999),replace('/terminal/wallet/yen',1050),replace('/terminal/wallet/earned',1050)]);
 const result=await h.run(p);assert.equal(result.stat_data.terminal.wallet.yen,1050);assert.equal(result.stat_data.高松灯.好感度,'历史值');assert.deepEqual(result.stat_data.高松灯.extension,{keep:true});assert.equal(h.service.state().lastError,'');
 await h.mvu.run(p,result);assert.equal(result.stat_data.terminal.wallet.yen,1050);assert.equal(result.stat_data.高松灯.好感度,'历史值');h.service.destroy();
});

test('MVU source stamps a stable message identity before context registration and uses registered variants',async()=>{
 let options;const h=setup({capture:o=>{options=o;}});
 const m={mes:'本轮已经完成的可读正文。',swipe_id:0};h.c.chat.push(m);
 const change=patch([replace('/terminal/wallet/yen',1010),replace('/terminal/wallet/earned',1010)]);
 await h.run(change);const first=options.numericOptions.source;assert(first.messageId);assert.equal(first.messageId,m.cxx_plot_id);
 h.c.chat.shift();await h.run(change);assert.equal(options.numericOptions.source.messageId,first.messageId);assert.equal(options.numericOptions.source.floor,1);
 m.cxx_context={messageId:'registered'};m.extra={cxx_context:{messageId:'registered',variantId:'branch2'}};m.swipe_id=1;
 await h.run(change);assert.equal(options.numericOptions.source.messageId,'registered');assert.equal(options.numericOptions.source.variantId,'branch2');assert.equal(m.cxx_plot_id,first.messageId);
 h.service.destroy();
});

test('web-owned selected swipes are not settled twice; native edits retain their prior state',async()=>{
 const h=setup(),raw='<cxx-story>已经提交😀</cxx-story>'+patch([replace('/terminal/wallet/yen',1020),replace('/terminal/wallet/earned',1020)]);
 let hash=2166136261;for(const ch of raw)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
 const state=copy(h.data.stat_data),row={mes:raw,swipe_id:0,extra:{cxx2051_node:'node-web'},variables:[{stat_data:state,__cxx_web_commit:{schema:1,owner:'web',operationId:'op-web',nodeId:'node-web',fingerprint:(hash>>>0).toString(16)+':'+raw.length}}]};h.c.chat.push(row);
 assert.equal((await h.service.settle(2)).status,'duplicate');assert.deepEqual(row.variables[0].stat_data,state);
 row.mes=raw+' edited';assert.equal((await h.service.settle(2)).status,'web-edited');assert.deepEqual(row.variables[0].stat_data,state);h.service.destroy();
});

test('a native reply inheriting previous floor variables is not owned by that web receipt',async()=>{
 const h=setup(),row={mes:'<cxx-story>原生下一轮</cxx-story>'+patch([replace('/terminal/wallet/yen',1020),replace('/terminal/wallet/earned',1020)]),is_user:false,swipe_id:0,variables:[{stat_data:copy(h.data.stat_data),__cxx_web_commit:{schema:1,owner:'web',operationId:'old-web',nodeId:'prior-web-node',fingerprint:'old'}}]};h.c.chat.push(row);
 const result=await h.service.settle(2);assert.notEqual(result.status,'web-edited');assert.notEqual(result.status,'duplicate');assert.match(result.reason,/数据库写入层尚未就绪/);h.service.destroy();
});
