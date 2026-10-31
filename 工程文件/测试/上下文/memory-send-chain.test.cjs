'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture:base}=require('../lib/fixture-loader.cjs')('../上下文/context-controller.test.cjs',['fixture']);
const Adapter=require('../../卡片源码/长期记忆/adapter.js'),parser=require('../../卡片源码/Gal/parser.js'),bundle=require('../../卡片源码/长期记忆/package.cjs').data();
async function fixture(){
  const f=await base(),key='__cxx_long_memory',body='已经收到简报并约好明天回访。'.repeat(180),source={story:['a.png','a'],floor:1,swipe:0,quote:'scene 1 detail detail'};
  Object.assign(f.c.eventTypes,Object.fromEntries(['GENERATION_STARTED','GENERATE_AFTER_DATA','MESSAGE_DELETED','MESSAGE_SWIPED','MESSAGE_EDITED'].map(name=>[name,name])));
  Object.assign(f.c.chatMetadata.variables[key],{enabled:true,book:'book',notes:[],controls:{},nextNote:1});
  const tables={sheet:{name:'纪要表',content:[['row_id','编码索引','概览','纪要'],[1,'AM0001','简报与回访',body+'<cxx-source>'+JSON.stringify(source)+'</cxx-source>']]}};
  f.top.AutoCardUpdaterAPI={exportTableAsJson:()=>tables};f.top.document={querySelector:()=>({value:'核对简报。'})};
  const api={SillyTavern:{getContext:()=>f.c},getVariables:()=>f.c.chatMetadata.variables,updateVariablesWith:async fn=>{f.c.chatMetadata.variables=fn(f.c.chatMetadata.variables);},getWorldbook:async()=>[{name:'TavernDB-ACU-CustomExport-纪要索引',content:'AM0001'}],injectPrompts:()=>({uninject(){}}),setChatMessages:async rows=>{for(const row of rows)f.c.chat[row.message_id].mes=row.message;}};
  const memory=Adapter.create({api,host:f.top,parser,bundle}).start();f.top.CxxLongMemory=memory;
  const dispose=f.dispose;f.dispose=()=>{memory.destroy();dispose();};
  f.prepare=async(fixed=0)=>{
    await f.emit('GENERATION_STARTED','normal',{},false);await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);await memory.recallContext();
    const index=f.c.chat.length;f.c.chat.push({is_user:true,name:'player',mes:'【CXX_LONG_MEMORY_P1】<cxx_memory_ids>{"ids":["AM0001"]}</cxx_memory_ids><cxx_memory_direction>准备核对。</cxx_memory_direction>',extra:{}});await f.emit('MESSAGE_SENT',index);
    const rows=f.c.chat.map(row=>({...row}));await f.bridge.intercept(rows,20000,()=>assert.fail(f.bridge.status().error?.message),'normal');
    return {chat:[{role:'system',content:'r'.repeat(fixed)+[...f.prompts.values()].join('')},...rows.map(row=>({role:row.is_user?'user':'assistant',content:row.mes}))]};
  };
  return f;
}
for(const multimodal of [false,true])test(`native ${multimodal?'multimodal':'text'} send measures expanded recall, restores input and retains compaction sources through the reply`,async()=>{
  const f=await fixture();try{
    const old=f.c.chat.map(row=>row.mes),payload=await f.prepare(),picture={type:'image_url',image_url:{url:'data:image/png;base64,cGljdHVyZQ=='}};
    if(multimodal)payload.chat.at(-1).content=[{type:'text',text:payload.chat.at(-1).content},structuredClone(picture)];
    const auxiliary={chat:[{role:'user',content:'辅助调用'}]};await f.emit('CHAT_COMPLETION_PROMPT_READY',auxiliary);assert.equal(auxiliary.chat[0].content,'辅助调用');assert(f.c.chat.at(-1).mes.includes('CXX_LONG_MEMORY_P1'));
    await f.emit('CHAT_COMPLETION_PROMPT_READY',payload);await f.emit('GENERATE_AFTER_DATA',{prompt:payload.chat},false);
    assert(JSON.stringify(payload).includes('已经收到简报'));assert(!JSON.stringify(payload).includes('CXX_LONG_MEMORY_P1'));assert(!JSON.stringify(payload).includes('[CXXCTX_'));if(multimodal)assert.deepEqual(payload.chat.at(-1).content[1],picture);
    assert.equal(f.controller.status().lastRun.finalInputEstimate,JSON.stringify(payload.chat).length,'budget must include expanded recall');assert.equal(f.c.chat.at(-1).mes,'核对简报。');assert.deepEqual(f.c.chat.slice(0,10).map(row=>row.mes),old);
    const index=f.c.chat.length;f.c.chat.push({is_user:false,name:'fixture',mes:'已经核对完简报。',extra:{}});await f.emit('MESSAGE_RECEIVED',index,'normal');await f.emit('GENERATION_ENDED');
    assert.equal(f.disk().chat.at(-2).mes,'核对简报。');assert(f.controller.status().records.every(record=>record.status==='ready'));assert(f.source.reference(index));
  }finally{f.dispose();}
});
test('expanded recall crossing the final input limit stops the main request before transmission',async()=>{
  const f=await fixture();try{const payload=await f.prepare(6500);assert(JSON.stringify(payload.chat).length<17000,'unexpanded recall fits the input budget');await assert.rejects(f.emit('CHAT_COMPLETION_PROMPT_READY',payload),/预算/);assert(f.controller.status().lastRun.finalInputEstimate>17000,'expanded recall exceeds the input budget');assert(f.stopped);assert.equal(f.c.chat.at(-1).mes,'核对简报。');await f.emit('GENERATION_STOPPED');}finally{f.dispose();}
});
