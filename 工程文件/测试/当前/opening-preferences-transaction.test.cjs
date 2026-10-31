'use strict';
const fs=require('fs'),path=require('path'),Module=require('module'),test=require('node:test'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../..'),original=path.join(repo,'工程文件/测试/当前/opening-flow.test.cjs');
const fixtureModule=new Module(original,module);fixtureModule.filename=original;fixtureModule.paths=Module._nodeModulePaths(path.dirname(original));
let source=fs.readFileSync(original,'utf8').split("test('discard removes")[0];
source=source.replace('existing=null}={})','existing=null,preferences={}}={})').replace('external:{keep:3},','external:{keep:3},__cxx_ui_preferences:copy(preferences),');
source=source.replace("readPreferences:()=>({level:'medium',device:'desktop',gal:false})","readPreferences:()=>require('../../卡片源码/MVU/preferences.js').read(ctx.chatMetadata.variables)");
source=source.replace('return {flow,player,row,ctx,storage,','return {flow,player,row,ctx,storage,disk:()=>copy(disk),');
fixtureModule._compile(source+'\nmodule.exports={fixture,ready};',original);
const {fixture,ready}=fixtureModule.exports,P=require(path.join(repo,'工程文件/卡片源码/MVU/preferences.js'));
for(const nsfw of [false,true])for(const battleMode of ['fast','text','tactical'])test('final opening transaction persists '+nsfw+'/'+battleMode+' and preserves unrelated fields',async()=>{
 const f=fixture({preferences:{nsfw:!nsfw,nsfwChosen:true,battleMode:battleMode==='text'?'tactical':'text',unknown:{keep:7}}});
 assert.equal(f.flow.state().draft.preferences.nsfw,!nsfw);assert.equal(f.flow.state().draft.preferences.battleMode,battleMode==='text'?'tactical':'text');
 ready(f);f.flow.patch({preferences:{nsfw,nsfwChosen:true,battleMode,mirror:true,level:'low',device:'mobile',gal:true}});assert.equal(f.stats().mutations,0);f.flow.review();await f.flow.commit();
 const persisted=f.disk()[0].chat_metadata.variables,read=P.read(persisted);
 assert.equal(read.nsfw,nsfw);assert.equal(read.nsfwChosen,true);assert.equal(read.battleMode,battleMode);assert.equal(read.mirror,true);assert.equal(read.gal,true);assert.equal(read.device,'mobile');assert.equal(read.level,'low');assert.deepEqual(persisted.__cxx_ui_preferences.unknown,{keep:7});assert.deepEqual(persisted.external,{keep:3});assert.equal(f.stats().saves,1);assert.equal(f.stats().mutations,2);f.player.stop();
});
test('same-story saved preferences seed draft; invalid preferences reject before writes',async()=>{const f=fixture({preferences:{setupVersion:1,completed:true,nsfw:true,nsfwChosen:true,battleMode:'tactical'}});assert.equal(f.flow.state().draft.preferences.nsfw,true);assert.equal(f.flow.state().draft.preferences.battleMode,'tactical');for(const patch of [{nsfw:'true'},{nsfwChosen:1},{battleMode:'instant'}])await assert.rejects(f.player.completeOpening({preferences:{level:'low',device:'mobile',gal:false,...patch}}),/显示设置无效/);assert.equal(f.stats().mutations,0);f.player.stop();});
test('uncompleted legacy preferences retain valid choices; absent preferences use defaults',()=>{const old=fixture({preferences:{nsfw:true,nsfwChosen:true,battleMode:'text'}}),fresh=fixture();assert.equal(P.read(old.ctx.chatMetadata.variables).complete,false);assert.equal(old.flow.state().draft.preferences.nsfw,true);assert.equal(old.flow.state().draft.preferences.battleMode,'text');assert.equal(fresh.flow.state().draft.preferences.nsfw,false);assert.equal(fresh.flow.state().draft.preferences.nsfwChosen,false);assert.equal(fresh.flow.state().draft.preferences.battleMode,'fast');old.player.stop();fresh.player.stop();});
