'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const Q=require('../../卡片源码/运行时/quests.js'),Hub=require('../../卡片源码/运行时/hub-ui.js'),S=require('../../卡片源码/MVU/schema.js');
const before=JSON.parse(read('测试/夹具/历史行为/人物EJS.json'));
const maintained=JSON.parse(read('卡片源码/世界书/entries.json')).entries;
const characterIds=[4,6,7,8,9,10,11,12,13,14];
test('ten static profiles and closing tags are retained exactly around removed EJS blocks',()=>{
 const approved=JSON.parse(read('文案审阅/立绘与人设对应-20261021/植入回执.json')).changes;
 for(const id of characterIds){const old=before.data.character_book.entries.find(e=>e.id===id).content,s=read('卡片源码/'+maintained.find(e=>e.id===id).file);let expected=old.slice(0,old.indexOf('<%')).trimEnd()+'\n'+old.slice(old.lastIndexOf('%>')+2).trimStart();for(const edit of approved.find(r=>r.uid===id)?.edits||[]){assert.equal(expected.split(edit.before).length-1,1);expected=expected.replace(edit.before,edit.after);}assert.equal(s,expected);assert.doesNotMatch(s,/<%|getvar\(|好感度/);}
});
test('retired rules are disabled, initialization and both variable modes have no affinity fields',()=>{
 const retired=maintained.find(e=>e.id===2);assert.equal(retired.enabled,false);assert.equal(read('卡片源码/'+retired.file),'');
 for(const file of ['15','0','1','39','40'])assert.doesNotMatch(read('卡片源码/MVU/prompts/'+file+'.txt'),/好感度|初始好感/);
 const init=read('卡片源码/MVU/prompts/15.txt');assert(init.startsWith('terminal:'));assert.equal(init,before.data.character_book.entries.find(e=>e.id===15).content.split('\n\n')[1]);
 assert.match(read('卡片源码/MVU/prompts/1.txt'),/get_message_variable::stat_data\.terminal/);
});
test('legacy values remain opaque and do not control hub content or quest unlocks',()=>{
 const empty={terminal:{quests:{one:{state:'完成'},two:{state:'完成'}}}},legacy={...structuredClone(empty),高松灯:{好感度:-1000,extra:3}};
 assert.deepEqual(Hub.records(empty),Hub.records(legacy));assert.equal(Q.lock(empty,{id:'q_heist'}),'');assert.equal(Q.lock(legacy,{id:'q_heist'}),'');
 assert.match(Q.lock({terminal:{quests:{one:{state:'完成'}}}},{id:'q_heist'}),/2单/);
 const schema=S.build(require('D:/SillyTavern/node_modules/zod'));assert.deepEqual(schema.audit(legacy),[]);assert.deepEqual(schema.stat.parse(legacy),legacy);
 const fresh={terminal:{}};assert.deepEqual(schema.prepare([{op:'add',path:'/高松灯/好感度',value:600}],fresh).patches,[]);assert.deepEqual(fresh,{terminal:{}});
});
test('current native status retains character details and pictures without score rendering or stage effects',()=>{
 for(const id of ['status0']){const s=read('卡片源码/MVU/templates/'+id+'.html');assert.doesNotMatch(s,/好感|readAff|\bSTG\b|data-stage=|spawnHearts|<span>\x27\+a\+\x27/);assert.match(s,/人物资料/);if(id!=='status0')assert.match(s,/cd\.outfit/);assert.match(s,/cd\.thought/);assert.match(s,/function buildDetail/);}
});
test('installed Prompt Template EJS compiler reproduces old serialized profile error and accepts revised references',async()=>{
 const file='D:/SillyTavern/data/default-user/extensions/ST-Prompt-Template/src/3rdparty/ejs.js',context={exports:{},module:{exports:{}}};vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});const ejs=context.module.exports;
 const options={async:true,outputFunctionName:'print',_with:true,localsName:'locals',client:true};
 const old=JSON.stringify({references:{worldbook:before.data.character_book.entries.find(e=>e.id===10).content}});assert.throws(()=>ejs.compile(old,options),/Invalid or unexpected token/);
 const next=JSON.stringify({references:{worldbook:characterIds.map(id=>read('卡片源码/'+maintained.find(e=>e.id===id).file)).join('\n\n')}});assert.equal(await ejs.compile(next,options)({}),next);
});
