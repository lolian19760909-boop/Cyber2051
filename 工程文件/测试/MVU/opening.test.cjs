'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const O=require("../../卡片源码/MVU/openings.js"),P=require("../../卡片源码/MVU/preferences.js");
function document(){const doc=require("../lib/dom.cjs").document('<body></body>'),create=doc.createElement;doc.createElement=tag=>{const n=create(tag);if(tag==='input')Object.defineProperty(n,'name',{get:()=>tag,set:value=>{n.attribs.name=value;}});n.style={cssText:''};n.focus=()=>doc.activeElement=n;n.replaceChildren=(...children)=>{for(const child of [...n.children])child.remove();n.append(...children);};return n;};return doc;}
function fixture(chat=[{mes:'<OpeningForm/>',swipe_id:0}]){let key='A';const chats={A:{chat,vars:{unknown:{keep:1}}},B:{chat:[{mes:'<OpeningForm/>'}],vars:{other:2}}},events=new Map(),win={document:document(),Event,dispatchEvent(){}};let writes=0,saves=0,verify=async()=>{};const c={get chat(){return chats[key].chat;},eventTypes:{CHAT_CHANGED:'changed',CHARACTER_MESSAGE_RENDERED:'rendered'},saveMetadata:async()=>{saves++;}};const api={SillyTavern:{getContext:()=>c},getVariables:()=>structuredClone(chats[key].vars),updateVariablesWith:fn=>{chats[key].vars=fn(structuredClone(chats[key].vars));writes++;},eventOn:(n,f)=>events.set(n,f),eventRemoveListener:n=>events.delete(n)};const service=P.create({api,win,runtime:{key:()=>key},verifySaved:r=>verify(r)});return {service,chats,win,events,writes:()=>writes,saves:()=>saves,setVerify:fn=>verify=fn,switch(k){key=k;events.get('changed')();}};}


test('settings: defaults are preview only; successful choices are one merged write',async()=>{
 const h=fixture();assert.equal(h.writes(),0);const fields=h.win.document.querySelectorAll('input').filter(n=>n.checked);assert.deepEqual(fields.map(n=>n.value),['desktop','medium','native']);assert.equal(h.service.read().device,'auto');
 await h.service.save({level:'low',gal:true});assert.equal(h.writes(),1);assert.equal(h.saves(),1);assert.equal(h.chats.A.vars.__cxx_gal_mode.enabled,true);assert.deepEqual(h.chats.A.vars.unknown,{keep:1});assert.equal(h.service.read().complete,true);assert.equal(h.win.document.querySelectorAll('[role="dialog"]').length,0);h.events.get('changed')();assert.equal(h.win.document.querySelectorAll('[role="dialog"]').length,0);h.service.destroy();assert.equal(h.events.size,0);
});
test('settings: old chats do not prompt or overwrite; cancel does not complete',()=>{
 const h=fixture([{mes:'legacy greeting'},{mes:'story',is_user:true}]);assert.equal(h.win.document.querySelectorAll('[role="dialog"]').length,0);assert.equal(h.writes(),0);h.service.destroy();
 const x=fixture();x.win.document.querySelectorAll('button').find(b=>b.textContent==='稍后设置').onclick();assert.equal(x.service.read().complete,false);x.events.get('changed')();assert.equal(x.win.document.querySelectorAll('[role="dialog"]').length,0);x.service.destroy();
});
test('settings: failed persistence restores preferences; a late completion cannot write a new chat',async()=>{
 const h=fixture();h.setVerify(async()=>{throw Error('disk failed');});await assert.rejects(h.service.save({level:'high',gal:true}),/disk failed/);assert.equal(h.service.read().complete,false);assert.deepEqual(h.chats.A.vars,{unknown:{keep:1}});
 let release;h.setVerify(()=>new Promise(r=>release=r));const pending=h.service.save({level:'low',gal:false});await new Promise(r=>setImmediate(r));h.switch('B');release();await assert.rejects(pending,/聊天已切换/);assert.deepEqual(h.chats.B.vars,{other:2});h.service.destroy();
});
