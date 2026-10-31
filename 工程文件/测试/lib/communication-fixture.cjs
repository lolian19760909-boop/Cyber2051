'use strict';
const vm=require('node:vm'),A=require('../../工具/lib/card-ast.cjs'),globals=require('../../工具/lib/card-global.cjs');
function configuration(card){
 const all=card.data.extensions.tavern_helper.scripts.map(s=>s.content||'').join('\n;\n'),modules=new Map(A.modules(all).map(m=>[m.name,m.source]));let profiles;
 const phone=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-phone-v1').content;
 A.walk(A.acorn.parse(phone,{ecmaVersion:'latest'}),n=>{if(n.type==='VariableDeclarator'&&n.id.name==='CXX_PHONE_PROFILES')profiles=vm.runInNewContext('('+phone.slice(n.init.start,n.init.end)+')');});
 return {code:globals(all,['CxxPhoneStyle','CxxMailboxStyle'])+';\n'+['Cxx238Dialogue','CxxGalParser','CxxPhoneCore','CxxPhoneHost','CxxPhoneUI','CxxMailboxFactory'].map(n=>{A.assert(modules.has(n),n);return modules.get(n);}).join('\n;\n'),profiles};
}
function setupPhone(profiles){
 const source='<cxx-story>车站外的雨已经停了。<cxx-say speaker="千早爱音">明天下午在这里见。</cxx-say></cxx-story><ztl>{"date":"2051年10月10日","time":"15:10","location":"车站","characters":[]}</ztl>';
 window.phoneKey=JSON.stringify(['phone-fixture.png','A']);window.modelCalls=0;window.phoneWrites=0;window.phoneSaves=0;window.audioCalls=[];window.phoneEvents=new Map();window.phoneWatchers=new Set();window.failPhoneSave=false;window.holdPhoneReply=false;window.failAfterReply=false;
 const chat=[{mes:source,swipe_id:0}],rows=CxxPhoneCore.timeline(chat,CxxGalParser),anchor=CxxPhoneCore.anchor(rows),store=CxxPhoneCore.create();
 window.phoneOriginalChat=structuredClone(chat);
 store.future={keep:false};
 for(const name of ['千早爱音','丰川祥子'])CxxPhoneCore.addContact(store,CxxPhoneCore.identity(name,CxxGalParser.characterAliases),anchor,'story');
 CxxPhoneCore.addContact(store,CxxPhoneCore.identity('高松灯',CxxGalParser.characterAliases),{floor:0,chain:'older-branch'},'story');
 store.turns=Array.from({length:5},(_,i)=>({id:'history-'+i,contactId:'Anon',name:'千早爱音',mode:'text',anchor,origin:phoneKey,status:'complete',audio:'none',input:'旧记录 '+i+'：我会记得这个约定。',reply:('嗯，我们慢慢把事情说清楚，再一起决定下一步。').repeat(10)+(i===4?'【通讯记录终点】':''),createdAt:'2051-10-10T15:00:00Z'}));
 window.phoneVars={foreign:{zero:0,no:false},[CxxPhoneCore.KEY]:store};window.phoneDisk=structuredClone(phoneVars);
 window.phoneContext={chat,characters:[{avatar:'phone-fixture.png',name:'通讯验收'}],characterId:0,name1:'玩家',getCurrentChatId:()=>JSON.parse(phoneKey)[1],getRequestHeaders:()=>({}),eventTypes:{GENERATION_AFTER_COMMANDS:'generation',GENERATION_ENDED:'ended',GENERATION_STOPPED:'stopped'},saveMetadata:async()=>{phoneSaves++;if(failPhoneSave)throw Error('验收夹具：通讯保存失败');phoneDisk=structuredClone(phoneVars);}};
 const nativeFetch=window.fetch.bind(window);window.fetch=async(url,...args)=>url==='/api/chats/get'?new Response(JSON.stringify([{chat_metadata:{variables:phoneDisk}}]),{headers:{'content-type':'application/json'}}):nativeFetch(url,...args);
 window.Cxx233Updater={host:{getContext:()=>({characterKey:'phone-fixture.png',chatId:JSON.parse(phoneKey)[1]}),withChatSave:async(_,fn)=>fn(),assertPlayerWritable:async()=>{}}};
 window.phoneApi={SillyTavern:{getContext:()=>phoneContext},getVariables:()=>structuredClone(phoneVars),updateVariablesWith:async fn=>{phoneVars=fn(structuredClone(phoneVars));phoneWrites++;},eventOn:(n,f)=>phoneEvents.set(n,f),eventRemoveListener:n=>phoneEvents.delete(n),injectPrompts:()=>()=>{}};
 window.phoneRuntime={key:()=>phoneKey,persona:()=>({name:'玩家'}),watchMessages:fn=>{phoneWatchers.add(fn);return()=>phoneWatchers.delete(fn);}};
 window.phoneCapabilities={text:true,call:true,mic:false,version:'0.50.1',reason:'受控连接已就绪',micReason:'语音输入尚未配置，可以打字参与通话。'};
 const bridge={refresh:async()=>structuredClone(phoneCapabilities),llm:async opts=>{modelCalls++;if(holdPhoneReply)await new Promise(r=>window.finishPhoneReply=r);const reply='[ANSWER]\n明天下午见。收到你的消息了，我们按原来的约定继续。';opts.onText(reply);if(failAfterReply)failPhoneSave=true;return reply;},stream:()=>({push(){},end(){},done:Promise.resolve({played:1}),cancel(){audioCalls.push('cancel');},resume(){audioCalls.push('resume');},on:()=>()=>{}}),stopAll:()=>audioCalls.push('stopMirror'),destroy(){}};
 const reader={stop:()=>audioCalls.push('stopReader'),readText:async()=>audioCalls.push('read'),resume(){}};
 window.CxxRadio={suspend:()=>{audioCalls.push('suspendRadio');return()=>audioCalls.push('resumeRadio');}};
 window.phone=CxxPhoneHost.create({api:phoneApi,top:window,runtime:phoneRuntime,parser:CxxGalParser,bridge,profiles,reader});window.phoneUI=CxxPhoneUI.mount({top:window,service:phone,reader,setup:{open(){window.setupOpened=true;}}});phone.start();phoneUI.open();
}
module.exports={configuration,setupPhone};
