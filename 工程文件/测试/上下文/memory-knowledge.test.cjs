'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),K=require('../../卡片源码/长期记忆/knowledge.js'),M=require('../../卡片源码/长期记忆/material.js'),bundle=require('../../卡片源码/长期记忆/package.cjs').data();
const actors=['player','wb_10','wb_6'],source=(floor=0)=>({story:['fixture','chat'],floor,swipe:0,quote:'只有作者能看到的完整原句及秘密',ref:{messageId:'m'+floor}});
function fixture(){const data=structuredClone(bundle.template),row=(name,cells)=>{const t=Object.values(data).find(t=>t.name===name);t.content.push(t.content[0].map(h=>h==='row_id'?t.content.length:cells[h]??''));};
 const ev=(id='EV0001',floor=0,kind='已发生')=>row('事件记录',{'事件编号':id,'类别':kind,'内容':'钥匙实际藏在阁楼，旁人不知道。','参与人物':JSON.stringify(actors),'关联纪要':'AM0001','来源':JSON.stringify(source(floor))});
 const kn=(id='KN0001',actor='wb_10',event='EV0001',floor=0,more={})=>row('人物认知',{'认知编号':id,'人物编号':actor,'事件编号':event,'认知类型':'亲历','所知内容':'我已收到钥匙。','获知途径':'当面收到','来源':JSON.stringify(source(floor)),...more});
 const rel=(id='RL0001',from='wb_10',to='wb_6',floor=0,more={})=>row('关系变化',{'变化编号':id,'起点人物':from,'指向人物':to,'关系描述':'因为实际交付而增加信任。','标签':'["信任"]','未解问题':'之前的失约仍需解释。','事件编号':'EV0001','来源':JSON.stringify(source(floor)),...more});
 const collect=(valid=s=>!!s.ref)=>K.collect(data,{actors,validSource:valid});return {data,row,ev,kn,rel,collect};
}
test('directed relations and cognition do not grant participants the full event or reverse attitude',()=>{
 const f=fixture();f.ev();f.kn();f.rel();const r=f.collect(),a=K.project(r,{actorId:'wb_10'}),b=K.project(r,{actorId:'wb_6'});
 assert.equal(a.knowledge.length,1);assert.equal(a.relations.length,1);assert.deepEqual(b.knowledge,[]);assert.deepEqual(b.relations,[]);assert.deepEqual(a.events,[]);
 assert(!JSON.stringify(a).includes('阁楼'));assert(!JSON.stringify(a).includes('只有作者'));assert(K.project(r,{mode:'author',actorId:'wb_10'}).events[0].text.includes('阁楼'));
});
test('mistaken belief retains its claim without revealing the objective correction',()=>{
 const f=fixture();f.ev();f.kn('KN0001','wb_6','EV0001',1,{'认知类型':'误解','所知内容':'钥匙在楼下。','获知途径':'听到告知','告知者':'wb_10'});
 const view=K.project(f.collect(),{actorId:'wb_6'});assert.equal(view.knowledge[0].kind,'认为');assert.equal(view.knowledge[0].text,'钥匙在楼下。');assert(!JSON.stringify(view).includes('阁楼'));assert(!JSON.stringify(view).includes('误解'));
});
test('stale event removes all dependent cognition and relations even when their own source is valid',()=>{
 const f=fixture();f.ev();f.kn('KN0001','wb_10','EV0001',1);f.rel('RL0001','wb_10','wb_6',1);const r=f.collect(s=>s.floor!==0);assert.equal(r.events.length,0);assert.equal(r.knowledge.length,0);assert.equal(r.relations.length,0);assert.equal(r.issues.length,3);
});
test('replacement chains preserve history, reject cross-person links, and keep unresolved conflicts explicit',()=>{
 const f=fixture();f.ev();f.kn();f.kn('KN0002','wb_10','EV0001',1,{'取代认知':'KN0001','所知内容':'钥匙已经转交。'});f.rel();f.rel('RL0002','wb_10','wb_6',1);f.rel('RL0003','wb_6','wb_10',2,{'取代变化':'RL0001'});
 const r=f.collect();assert.equal(r.knowledge[0].current,false);assert.equal(r.knowledge[1].current,true);assert(r.relations.every(r=>r.conflicted));assert.equal(r.relations.length,2);assert.equal(r.issues.length,1);
 f.kn('KN0003','wb_6','EV0001',2,{'取代认知':'KN0004'});f.kn('KN0004','wb_6','EV0001',2,{'取代认知':'KN0003'});assert.equal(f.collect().knowledge.length,2);
});
test('duplicate event IDs, future evidence, unregistered actors, and plans cannot become settled relations',()=>{
 for(const mutate of [f=>f.ev(),f=>{f.data.sheet_cxx_events.content[1][6]=JSON.stringify(source(4));},f=>{f.data.sheet_cxx_events.content[1][4]='["unknown"]';},f=>{f.data.sheet_cxx_events.content[1][2]='计划';}]){
  const f=fixture();f.ev();f.rel();mutate(f);assert.equal(f.collect().relations.length,0);
 }
 const f=fixture();f.ev();f.kn();delete source().ref;const row=f.data.sheet_cxx_knowledge.content[1];row[row.length-1]=JSON.stringify({...source(),ref:undefined});assert.equal(f.collect().knowledge.length,0);
});
test('template upgrade preserves stable sheet keys, unknown data and extra columns without reseeding rows',()=>{
 const old={mate:{type:'chatSheets',version:2,unknown:3},native_legacy:{...structuredClone(bundle.template.sheet_cxx_chronicle),uid:'native_legacy',custom:'keep'},sheet_other:{uid:'sheet_other',name:'外部资料',sourceData:{ddl:'keep'},content:[['row_id','值'],[1,'不改']]}};
 old.native_legacy.content[0].push('未知列');old.native_legacy.content.push([8,'AM0001','','过去经历','旧内容','','未来数据']);old.native_legacy.sourceData.ddl+=' -- unknown column';
 const before=structuredClone(old),next=K.upgrade(old,bundle.template);assert.deepEqual(old,before);assert.equal(next.native_legacy.uid,'native_legacy');assert.equal(next.native_legacy.custom,'keep');assert.deepEqual(next.native_legacy.content,[old.native_legacy.content[0]]);assert.equal(next.native_legacy.sourceData.ddl,old.native_legacy.sourceData.ddl);assert.equal(next.sheet_other.sourceData.ddl,'keep');assert.equal(next.mate.unknown,3);assert.equal(next.sheet_cxx_chronicle,undefined);assert.equal(next.sheet_cxx_knowledge.content.length,1);
 assert(K.preserved(old,old));assert.throws(()=>K.preserved(old,next),/原记录尚未读回一致/);const duplicate=structuredClone(old);duplicate.other=structuredClone(old.native_legacy);assert.throws(()=>K.upgrade(duplicate,bundle.template),/同名/);
});
test('portable merge retains new tables and stable relationship IDs without duplicating a repeated import',()=>{
 const f=fixture();f.ev();f.kn();f.rel();const merged=M.merge({},f.data,()=>true),again=M.merge(merged,f.data,()=>true);assert.deepEqual(again,merged);assert.equal(K.collect(again,{actors,validSource:()=>true}).relations[0].id,'RL0001');
 const filtered=M.tables(again,()=>false);assert(K.names.every(name=>Object.values(filtered).find(t=>t.name===name).content.length===1));
});
