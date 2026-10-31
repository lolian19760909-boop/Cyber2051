'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Host=require("../../卡片源码/Gal/integrations/m18/terminal-host-state.js");
function fixture(){
  let busy=false,data={stat_data:{sentinel:{keep:true},terminal:{quests:{}}}},writes=0;
  const c={characters:[{avatar:'current.png'}],characterId:0,chat:[{mes:'story',is_user:false,swipe_id:0}],getCurrentChatId:()=> 'one'};
  const h=Host.create({getContext:()=>c,getLastMessageId:()=>0,getVariables:()=>data,busy:()=>busy,updateVariablesWith:fn=>{data=fn(structuredClone(data));writes++;}});
  return {h,get data(){return data;},get writes(){return writes;},busy:v=>busy=v,missing:()=>data={}};
}

test('MVU calculation or saving prevents quest and news metadata writes',()=>{
  const f=fixture(),before=structuredClone(f.data);f.busy(true);
  assert.equal(f.h.updateLedger(t=>t.quests.q={state:'进行中'}),false);assert.equal(f.h.writeNews({news:[{title:'news'}],threads:[]},()=>true),false);
  assert.deepEqual(f.data,before);assert.equal(f.writes,0);
});
test('missing MVU state is not silently initialized by terminal metadata',()=>{
  const f=fixture();f.missing();assert.equal(f.h.updateLedger(t=>t.quests.q={state:'进行中'}),false);assert.deepEqual(f.data,{});assert.equal(f.writes,0);
});
