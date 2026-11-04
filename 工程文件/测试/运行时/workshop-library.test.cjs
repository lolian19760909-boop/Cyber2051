'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../../卡片源码/运行时/core.js'),Content=require('../../卡片源码/运行时/content.js'),Controller=require('../../卡片源码/运行时/controller.js'),Discovery=require('../../卡片源码/运行时/discovery.js'),Tools=require('../../工具/发布/packages.cjs');
const F=require('../lib/fixture-loader.cjs')('controller.test.cjs',['fixture','signedRelease','definition','quest']);
const id='community.contract.94001',pack=version=>F.definition({id,version,optional:true,activation:'opt_in',content:{quests:[F.quest('workshop-quest',version==='1.0.1'?100:200)],gallery:[],worldbook:[]}});
const copy=structuredClone,bytes=value=>Buffer.from(Tools.canonical(value));
function fixture(release,options={}){return F.fixture(release,{catalogUrl:Controller.COMPONENT_CATALOG,...options});}
const action=(h,value)=>h.controller.command({instanceId:h.getState().instanceId,id,...value});
function publish(h,release){h.responses.set(Controller.COMPONENT_CATALOG,release.catalogBytes);for(const file of release.files)h.responses.set(file.entry.url,file.bytes);}
const options=release=>({Core,trustedKeys:release.trusted,fetch:async()=>new Response(release.files[0].bytes)});
test('内容目录无需core：下载订阅、固定旧版、手动换版、停用与撤回保留历史',async()=>{
 const first=F.signedRelease([pack('1.0.1')]),h=fixture(first);
 try{
  await h.controller.check(false);const initial=await h.controller.workshop({refresh:true});assert.equal(initial.loaded,true);assert.equal(initial.items[0].id,id);assert.equal(initial.installed.length,0);
  await action(h,{command:'subscribe',enabled:true,version:'1.0.1'});assert.equal(h.getState().installed[id].version,'1.0.1');assert.equal(h.getState().subscriptions[id],true);assert.equal(h.chat.__cxx_content_pins?.[id],undefined);
  await action(h,{command:'enable',enabled:true,version:'1.0.1'});assert.equal((await h.controller.workshop()).installed[0].enabledVersion,'1.0.1');
  const second=Tools.buildRelease({packages:[pack('1.0.2')],privateKey:first.keys.privateKey,keyId:'test-publisher'});publish(h,second);
  await action(h,{command:'subscribe',enabled:true,version:'1.0.2'});assert.equal(h.getState().installed[id].version,'1.0.2');assert.equal(h.chat.__cxx_content_pins[id],'1.0.1');assert.deepEqual(new Set((await h.controller.workshop()).installed[0].versions),new Set(['1.0.1','1.0.2']));
  const choices=()=>Content.view({quests:[]},h.getState().registry,{}, {subscriptions:h.getState().subscriptions,pins:h.chat.__cxx_content_pins});assert.equal(choices().quests[0].pay,100);
  await action(h,{command:'enable',enabled:true,version:'1.0.2'});assert.equal(choices().quests[0].pay,200);
  await action(h,{command:'enable',enabled:false});assert.equal(h.chat.__cxx_content_pins[id],undefined);assert.equal(choices().quests.length,0);
  await action(h,{command:'enable',enabled:true,version:'1.0.1'});
  h.responses.set(Controller.COMPONENT_CATALOG,bytes(Tools.signDocument({...first.catalog,packages:[]},first.keys.privateKey,'test-publisher')));assert.equal((await h.controller.workshop({refresh:true})).items.length,0);assert.equal(choices().quests[0].pay,100);assert.equal(h.getState().installed[id].version,'1.0.2');
 }finally{h.controller.stop();}
});
test('旧档独有内容可见、可停用和取消订阅，写回保留原档与全局注册表',async()=>{
 const firstRelease=F.signedRelease([pack('1.0.1')]),first=JSON.parse(firstRelease.files[0].bytes),release=F.signedRelease([pack('1.0.2')]),archive=Core.mergeRegistry({format:1,packages:{}},first,{subscriptions:[id]}).registry,h=fixture(release);
 try{
  h.chat.__cxx_migration={format:1,archive:{packages:copy(archive.packages),legacyQuests:[]},preferences:{subscriptions:{[id]:true}}};h.chat.__cxx_content_pins={[id]:'1.0.1'};const original=copy(h.chat.__cxx_migration);
  await h.controller.check(false);const view=await h.controller.workshop();assert.equal(view.subscriptions[id],true);assert.equal(view.installed[0].scope,'story');assert.equal(view.installed[0].installed,false);assert.equal(view.installed[0].enabledVersion,'1.0.1');
  await action(h,{command:'enable',enabled:false});await action(h,{command:'subscribe',enabled:false});assert.equal(h.getState().subscriptions[id],false);assert.equal(Content.withMigration(h.getState(),h.chat).subscriptions[id],false);assert.deepEqual(h.getState().registry.packages,{});assert.deepEqual(h.chat.__cxx_migration,original);
  await action(h,{command:'subscribe',enabled:true});await action(h,{command:'enable',enabled:true,version:'1.0.1'});assert.equal(h.chat.__cxx_content_pins[id],'1.0.1');assert.deepEqual(h.getState().registry.packages,{});
 }finally{h.controller.stop();}
});
test('异步下载中切换聊天保持新旧存档和安装记录',async()=>{
 const h=fixture(F.signedRelease([pack('1.0.1')]));try{await h.controller.check(false);const before=copy(h.getState()),pending=action(h,{command:'subscribe',enabled:true,version:'1.0.1'});h.currentContext.chatId='another-story';await assert.rejects(pending,{code:'context-changed'});assert.deepEqual(h.getState(),before);assert.equal(h.writes.length,0);assert.deepEqual(h.chat.__cxx_content_pins,{});}finally{h.controller.stop();}
});
test('内容包实际字节、签名与目录身份均参与验证',async()=>{
 const release=F.signedRelease([pack('1.0.1')]),entry=release.catalog.packages[0],valid=options(release);assert.equal((await Discovery.downloadContent(entry,valid)).pack.id,id);
 const corrupt=Buffer.from(release.files[0].bytes);corrupt[10]^=1;await assert.rejects(Discovery.downloadContent(entry,{...valid,fetch:async()=>new Response(corrupt)}),{code:'package-digest-mismatch'});
 await assert.rejects(Discovery.downloadContent(entry,{...valid,trustedKeys:{}}),{code:'untrusted-signature'});
 for(const change of [{id:'another.content'},{version:'1.0.9'},{optional:false},{activation:'compatible'},{requires:{engine:'1.0.1',packages:[]}}])await assert.rejects(Discovery.downloadContent({...entry,...change},valid),{code:'package-entry-mismatch'});
});
