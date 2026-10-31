'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../../卡片源码/运行时/core.js'),Host=require('../../卡片源码/运行时/host.js');
const copy=structuredClone,context={cardId:'cyber2051',characterKey:'test.png',chatId:'test-chat',busy:false};
function fixture(){
 const current={worldbook:{internalName:'chat-book',entries:[{uid:1,content:'before'}]},registry:{format:1,packages:{}},scripts:{trees:[{content:'large untouched source'}]},regex:{scripts:[]}},journal=new Map(),fieldsSeen=[],writes=[];
 const pick=fields=>Object.fromEntries(fields.map(k=>[k,copy(current[k])])),fields=['worldbook','registry'],before=pick(fields),after=copy(before);after.worldbook.entries[0].content='after';
 const host={getContext:()=>copy(context),async snapshot(_,fields){assert.deepEqual(fields,['worldbook','registry']);fieldsSeen.push(fields);return pick(fields);},async writeStage(stage,value,expected){assert.equal(stage,'worldbook');assert.deepEqual(pick(Object.keys(expected)),expected);writes.push(stage);current[stage]=copy(value);}};
 const storage={async get(k){return journal.has(k)?copy(journal.get(k)):null;},async claim(k,v){if(journal.has(k))return false;journal.set(k,copy(v));return true;},async set(k,v){journal.set(k,copy(v));return true;},async remove(k){return journal.delete(k);}};
 return {current,journal,fieldsSeen,writes,before,after,host,storage,execute:()=>Core.execute({host,storage,key:'journal',expectedContext:context,before,after,installed:{scope:'chat'}}),recover:()=>Core.recover({host,storage,key:'journal'})};
}
test('chat worldbook transaction and recovery never snapshot or back up scripts; unrelated edits survive',async()=>{
 const f=fixture();assert.equal((await f.execute()).status,'awaiting-verification');const j=f.journal.get('journal');assert.deepEqual(Object.keys(j.before).sort(),['registry','worldbook']);assert.ok(!JSON.stringify(j).includes('large untouched source'));
 f.current.scripts.trees[0].content='player edited script';assert.equal((await f.recover()).status,'committed');assert.equal(f.current.scripts.trees[0].content,'player edited script');assert.deepEqual(f.writes,['worldbook']);assert.ok(f.fieldsSeen.length>=4);
});
test('owned worldbook races still block and preserve the newer value',async()=>{
 const f=fixture();f.current.worldbook.entries[0].content='newer';await assert.rejects(f.execute(),{code:'snapshot-changed'});assert.equal(f.current.worldbook.entries[0].content,'newer');assert.equal(f.journal.size,0);
});
test('interrupted scoped recovery preserves a newer external worldbook edit for review',async()=>{
 const f=fixture();const write=f.host.writeStage;f.host.writeStage=async(...args)=>{await write(...args);throw Error('interrupted');};assert.equal((await f.execute()).status,'interrupted');
 f.current.worldbook.entries[0].content='partial external change';assert.equal((await f.recover()).status,'needs-review');assert.equal(f.current.worldbook.entries[0].content,'partial external change');
});
test('scoped transaction rejects asymmetric domains',async()=>{const f=fixture();f.after.scripts={trees:[]};await assert.rejects(f.execute(),{code:'invalid-snapshot'});});
test('real host scoped snapshot does not ask the helper for character source, regex or script trees',async()=>{
 const unexpected=()=>{throw Error('unrelated character source was accessed');};
 const api={SillyTavern:{getContext:()=>({getCurrentChatId:()=>context.chatId,unshallowCharacter:unexpected})},getCurrentCharacterId:()=>context.characterKey,builtin:{duringGenerating:()=>false},getChatWorldbookName:()=>null,getVariables:()=>({[Host.NAMESPACE]:{registry:{format:1,packages:{}}}}),getCharData:unexpected,getTavernRegexes:unexpected,getScriptTrees:unexpected};
 const host=Host.create({api,core:Core});host.setScope('chat');assert.deepEqual(await host.snapshot(undefined,['worldbook','registry']),{worldbook:{internalName:'',entries:[]},registry:{format:1,packages:{}}});
});
