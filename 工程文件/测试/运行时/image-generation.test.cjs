'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Images=require('../../卡片源码/运行时/image-generation.js');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=',source=id=>({key:'story:'+id,text:'雨夜东京，街边的修理工正在收好工具'});
function fixture(options={}){const records=new Map(),requests=[],writes=[],settings=[];let owner=true,failSave=false;
 const service=Images.create({read:async value=>records.get(value.key)||null,write:async(value,record)=>{if(failSave)throw Error('合成保存中断');records.set(value.key,record);writes.push(record);},current:()=>owner,saveSettings:value=>settings.push(value),fetch:async(url,init)=>{requests.push({url,init});return new Response(JSON.stringify({images:[{image:png,seed:42}]}));},random:()=>17,...options});
 return {service,records,requests,writes,settings,setOwner:value=>owner=value,setFailSave:value=>failSave=value};
}
test('默认手动、官方JSON请求与内存Key；保存资料和状态保留非secret字段',async()=>{
 const f=fixture(),s=source('one');assert.equal(f.service.settings().automatic,false);await f.service.generate(s,{automatic:true});assert.equal(f.requests.length,0);f.service.configure({key:'TEST-ONLY-image-token'});const result=await f.service.generate(s,{prompt:'cyberpunk, rain, mechanic'});
 assert.equal(f.requests.length,1);const request=f.requests[0];assert.equal(request.url,Images.endpoint);assert.equal(request.init.credentials,'omit');assert.equal(request.init.redirect,'error');assert.equal(request.init.headers.Accept,'application/json');assert.equal(request.init.headers.Authorization,'Bearer TEST-ONLY-image-token');const payload=JSON.parse(request.init.body);assert.equal(payload.input,'cyberpunk, rain, mechanic');assert.equal(payload.parameters.n_samples,1);assert.equal(payload.parameters.v4_prompt.caption.base_caption,payload.input);assert.equal(result.seed,42);assert.equal(result.image,png);assert(!JSON.stringify([f.settings,f.service.settings(),f.service.status(s),result]).includes('TEST-ONLY-image-token'));f.service.destroy();
});
test('自动每正文一次，手动重画等待新图保存后才替换原图',async()=>{
 const f=fixture(),s=source('one');f.service.configure({key:'TEST-ONLY',automatic:true});await f.service.generate(s,{automatic:true});await f.service.generate(s,{automatic:true});assert.equal(f.requests.length,1);assert.equal(f.records.get(s.key).sourceKey,s.key);await f.service.generate(s,{prompt:'edited prompt'});assert.equal(f.requests.length,2);assert.equal(f.records.get(s.key).prompt,'edited prompt');f.service.destroy();
});
test('保存失败保留旧图与新候选，重存完整候选复用同一供应商结果',async()=>{
 const f=fixture(),s=source('one');f.service.configure({key:'TEST-ONLY'});await f.service.generate(s,{prompt:'original'});const old=structuredClone(f.records.get(s.key));f.setFailSave(true);await assert.rejects(f.service.generate(s,{prompt:'redraw'}),/保存中断/);assert.deepEqual(f.records.get(s.key),old);assert.equal(f.service.status(s).candidate,true);f.setFailSave(false);await f.service.retrySave(s);assert.equal(f.requests.length,2);assert.equal(f.records.get(s.key).prompt,'redraw');assert.equal(f.service.status(s).phase,'saved');f.service.destroy();
});
test('独立串行图片队列；取消排队项会保持原图且释放后续工作',async()=>{
 let release,active=0,peak=0;const calls=[],f=fixture({fetch:async(_url,init)=>{calls.push(JSON.parse(init.body).input);peak=Math.max(peak,++active);if(calls.length===1)await new Promise(resolve=>release=resolve);active--;return new Response(JSON.stringify({images:[{image:png}]}));}});f.service.configure({key:'TEST-ONLY'});const a=source('one'),b=source('two'),first=f.service.generate(a),second=f.service.generate(b);await Promise.resolve();f.service.cancel(b);release();await first;await assert.rejects(second,{name:'AbortError'});assert.equal(peak,1);assert.equal(calls.length,1);assert.equal(f.records.has(b.key),false);assert.equal(f.service.status(b).phase,'cancelled');assert.equal(f.service.status(b).error,'');await f.service.generate(b);assert.equal(calls.length,2);f.service.destroy();
});
test('图片返回时换故事停止保存，HTTP原话保留并去掉回显Key',async()=>{
 let release;const f=fixture({fetch:async()=>{await new Promise(resolve=>release=resolve);return new Response(JSON.stringify({images:[{image:png}]}));}});f.service.configure({key:'TEST-ONLY'});const pending=f.service.generate(source('one'));await Promise.resolve();f.setOwner(false);release();await assert.rejects(pending,{code:'image_source_changed'});assert.equal(f.writes.length,0);f.service.destroy();
 const denied=fixture({fetch:async()=>new Response(JSON.stringify({message:'拒绝 TEST-ONLY'}),{status:401})});denied.service.configure({key:'TEST-ONLY'});await assert.rejects(denied.service.generate(source('one')),error=>error.message==='拒绝 [Key]');assert.equal(denied.service.status(source('one')).phase,'failed');denied.service.destroy();
});
test('自动读回已有楼层期间切故事，图片请求保持零次',async()=>{
 let release,live=true,requests=0;const service=Images.create({read:()=>new Promise(resolve=>release=resolve),write:async()=>{},current:()=>live,fetch:async()=>{requests++;return new Response(JSON.stringify({images:[{image:png}]}));}});service.configure({key:'TEST-ONLY',automatic:true});const pending=service.generate(source('one'),{automatic:true});await Promise.resolve();live=false;release(null);await assert.rejects(pending,{code:'image_source_changed'});assert.equal(requests,0);service.destroy();
});

test('图片备份导入在合法边界重绑账号和故事，像素、生成信息及未知字段保持',async()=>{
 const {createMemoryStatePort}=await import('../../网页独立版/src/store/memory.mjs'),{prepareImportedSnapshot}=await import('../../网页独立版/src/store/backup.mjs'),port=createMemoryStatePort({accountId:'image-a'}),raw='<cxx-story>雨夜的东京街道</cxx-story>';
 await port.commit({accountId:'image-a',runId:'image-run',branchId:'main',nodeId:'body-one',parentNodeId:null,operationId:'body-one',expectedRevision:0,beforeState:{terminal:{}},stateAfter:{terminal:{}},message:{kind:'body',raw},profile:{name:'合成人物'}});
 const record={format:1,sourceKey:JSON.stringify(['image-a','image-run','body-one',raw]),image:png,mime:'image/png',seed:42,model:'nai-diffusion-5-full',prompt:'rainy street',future:{keep:true}};
 await port.putRecords('media','image-run',[{mediaId:'illustration:body-one',kind:'generated-image',nodeId:'body-one',record,foreign:{keep:7}},{mediaId:'art_'+'a'.repeat(64),src:'original-player-image'}]);
 const snapshot=await port.exportRun('image-run'),original=structuredClone(snapshot),rebased=await prepareImportedSnapshot(snapshot,{accountId:'image-b',runId:'image-copy',parser:require('../../卡片源码/Gal/parser.js')}),image=rebased.tables.media.find(row=>row.kind==='generated-image');
 assert.equal(image.runId,'image-copy');assert.equal(image.record.sourceKey,JSON.stringify(['image-b','image-copy','body-one',raw]));assert.deepEqual({...image.record,sourceKey:record.sourceKey},record);assert.deepEqual(image.foreign,{keep:7});assert.deepEqual(snapshot,original);
 const bad=structuredClone(snapshot);bad.tables.media.find(row=>row.kind==='generated-image').record.sourceKey=JSON.stringify(['image-a','image-run','body-one','unrelated body']);await assert.rejects(prepareImportedSnapshot(bad,{accountId:'image-b',runId:'bad-copy',parser:require('../../卡片源码/Gal/parser.js')}),{code:'image_source'});
 const selected=await port.listRecords('media','image-run',{prefix:'art_'});assert.equal(selected.length,1);assert.equal(selected[0].src,'original-player-image');
});

test('首次保存尚未结束时重存共享同一次写入，候选会在确认后释放',async()=>{
 let release,writes=0,f;f=fixture({write:async(source,record)=>{writes++;await new Promise(resolve=>release=resolve);f.records.set(source.key,record);}});const s=source('one');f.service.configure({key:'TEST-ONLY'});const first=f.service.generate(s);while(!release)await new Promise(resolve=>setImmediate(resolve));const second=f.service.retrySave(s),third=f.service.retrySave(s);assert.equal(writes,1);release();await Promise.all([first,second,third]);assert.equal(f.requests.length,1);assert.equal(writes,1);assert.equal(f.service.status(s).candidate,false);f.service.destroy();
});


test('原生提示词dryRun保持外层正文资格，独立dryRun/quiet/停止保持零次',()=>{
 const Native=require('../../卡片源码/运行时/image-generation-host.js'),bus=new Map(),timers=new Map(),ctx={characterId:0,characters:[{avatar:'images.png'}],chat:[{mes:'旧正文',variables:[{}]}],getCurrentChatId:()=>'story'},win={document:{},localStorage:{getItem:()=>null},setTimeout(fn){timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id),Cxx233Runtime:{parser:{parseMessage:raw=>({paragraphs:[{text:raw}]})}},CustomEvent:class{},dispatchEvent(){},addEventListener(){},removeEventListener(){}};
 let calls=0;const api={SillyTavern:{getContext:()=>ctx},getButtonEvent:()=>'button',tavern_events:{GENERATION_STARTED:'start',GENERATION_ENDED:'end',GENERATION_STOPPED:'stop',CHAT_CHANGED:'chat'},eventOn:(name,fn)=>bus.set(name,fn),eventRemoveListener:(name,fn)=>{if(bus.get(name)===fn)bus.delete(name);}},runtime=Native.install({window:win,api,UI:{create:()=>({close(){},destroy(){}})},Generation:{create:()=>({settings:()=>({automatic:true,configured:true}),subscribe(){},generate(){calls++;return Promise.resolve();},destroy(){}})}});
 const flush=()=>{const list=[...timers.values()];timers.clear();list.forEach(fn=>fn());};
 bus.get('start')('normal',{},false);ctx.chat.push({mes:'完成的正文',variables:[{}]});bus.get('start')('normal',{},true);bus.get('end')();flush();assert.equal(calls,1);
 for(const [type,dryRun,stop]of [['normal',true,false],['quiet',false,false],['normal',false,true]]){ctx.chat.push({mes:type+dryRun+stop,variables:[{}]});bus.get('start')(type,{},dryRun);bus.get('end')();if(stop)bus.get('stop')();flush();assert.equal(calls,1);}
 runtime.destroy();assert.equal(bus.size,0);assert.equal(timers.size,0);
});
