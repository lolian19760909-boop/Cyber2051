'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../../卡片源码/运行时/context-source.js');
const scope={character:'fixture.png',chat:'story-a',group:null};
const original=()=>[{name:'原玩家',mes:'重复对白',is_user:true,extra:{unknown:17},other:{keep:1}},{name:'角色',mes:'选中回复',swipe_id:1,swipes:['旧回复','选中回复'],swipe_info:[{extra:{old:true}},{extra:{now:true}}],extra:{now:true},variables:[{keep:1},{keep:2}]},{name:'原玩家',mes:'重复对白',is_user:true,extra:{last:true}}];
const binding={actorId:'player',viewpointActorId:'player',revision:0,evidence:'original-player-story'};
function planned(chat=original(),options={}){let n=0;return S.plan(chat,{makeId:()=>`fixture_${++n}`,resolveBinding:()=>binding,...options});}
test('migration preserves fields, selected and alternate swipes, and is idempotent',()=>{
 const input=original(),before=structuredClone(input),p=planned(input);assert.deepEqual(input,before);assert.deepEqual(p.changes,[0,1,2]);
 for(let i=0;i<input.length;i++){for(const key of ['mes','name','swipes','variables','other'])assert.deepEqual(p.chat[i][key],input[i][key]);assert.equal(p.chat[i].extra.unknown,input[i].extra.unknown);}
 assert.equal(p.chat[1].swipe_info[0].extra.old,true);assert.equal(p.chat[1].swipe_info[1].extra.now,true);assert.notEqual(p.chat[1].swipe_info[0].extra.cxx_context.variantId,p.chat[1].extra.cxx_context.variantId);
 assert.deepEqual(S.plan(p.chat).changes,[]);assert.deepEqual(S.plan(p.chat).chat,p.chat);
});
test('identical text and filtered host indices map by identity only',async()=>{
 const p=planned(),index=await S.snapshot(p.chat,scope),rows=[{...p.chat[2],index:0,mes:'regex-transformed'},{...p.chat[0],index:1}];
 assert.deepEqual(S.map(rows,index).map(r=>r.floor),[2,0]);assert.throws(()=>S.map([{...p.chat[0],cxx_context:undefined}],index),{code:'source-unmapped'});
 assert.throws(()=>S.map([rows[0],rows[0]],index),{code:'source-unmapped'});
});
test('edits, deleted ancestors and switched swipes invalidate derived references without changing IDs',async()=>{
 const p=planned(),index=await S.snapshot(p.chat,scope),ref={...index.rows[2],scope};assert(S.valid(ref,index));
 const edited=structuredClone(p.chat);edited[0].mes+='编辑';assert(!S.valid(ref,await S.snapshot(edited,scope)));
 const deleted=structuredClone(p.chat);deleted.splice(0,1);assert(!S.valid(ref,await S.snapshot(deleted,scope)));
 const swiped=structuredClone(p.chat);swiped[1].swipe_id=0;swiped[1].mes=swiped[1].swipes[0];swiped[1].extra=structuredClone(swiped[1].swipe_info[0].extra);assert(!S.valid(ref,await S.snapshot(swiped,scope)));
 const switched=structuredClone(p.chat);switched[0].extra.cxx_context.binding={...binding,actorId:'wb_6',revision:1};assert(!S.valid(ref,await S.snapshot(switched,scope)));
 assert(!S.valid(ref,await S.snapshot(p.chat,{...scope,chat:'fork'})));
});
test('unproven legacy actors remain unresolved; established authors never follow a new current actor',()=>{
 const p=planned(original(),{resolveBinding:()=>null});assert.equal(p.unresolved.length,4);assert.equal(p.chat[0].extra.cxx_context.binding,null);
 const again=planned(p.chat,{resolveBinding:()=>({...binding,actorId:'wb_10',revision:1})});assert.equal(again.chat[0].extra.cxx_context.binding,null);
 const established=planned();assert.deepEqual(planned(established.chat,{resolveBinding:()=>({...binding,actorId:'wb_10',revision:1})}).chat,established.chat);
});
test('new native swipe reserves its own variant without stealing the former provenance',async()=>{
 const p=planned(),row=p.chat[1],old=row.extra.cxx_context.variantId;
 row.swipe_id=2;row.mes='…';const transient=S.plan(p.chat);assert.equal((await S.snapshot(transient.chat,scope)).rows[1].pending,true);
 row.swipes.push('新回复');row.mes='新回复';const next=S.plan(p.chat,{makeId:()=> 'new_variant',resolveBinding:()=>({...binding,actorId:'wb_6',revision:1})});
 assert.equal(next.chat[1].swipe_info[1].extra.cxx_context.variantId,old);assert.equal(next.chat[1].extra.cxx_context.variantId,'new_variant');assert.equal(next.chat[1].extra.cxx_context.binding.actorId,'wb_6');
});
test('unsupported markers and duplicate IDs do not get silently rewritten',()=>{
 const p=planned();p.chat[2].cxx_context=structuredClone(p.chat[0].cxx_context);assert.throws(()=>S.plan(p.chat),{code:'source-duplicate'});
 const u=original();u[0].cxx_context={schema:9};assert.throws(()=>S.plan(u),{code:'source-schema'});
});
test('native received callback stamps reserved or copied new swipe metadata only with explicit generation evidence',()=>{
 const p=planned(),row=p.chat[1],old=row.extra.cxx_context.variantId;row.swipe_id=2;row.mes='finished';row.swipes.length=3;
 row.swipe_info[2]={extra:{...structuredClone(row.extra),provider:'kept'}};
 const next=S.plan(p.chat,{completedFloor:1,newVariants:[{messageId:row.cxx_context.messageId,swipe:2}],makeId:()=> 'new_response',resolveBinding:()=>({...binding,actorId:'wb_6',revision:1})});
 assert.equal(next.chat[1].swipe_info[1].extra.cxx_context.variantId,old);assert.equal(next.chat[1].extra.cxx_context.variantId,'new_response');assert.equal(next.chat[1].swipe_info[2].extra.provider,'kept');assert.equal(next.chat[1].swipes[2],undefined);
});
