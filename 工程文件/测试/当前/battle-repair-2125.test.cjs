'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),F=require('../lib/tactical-fixtures.cjs');
const {B,L,E,O,game,op}=F,C=require('../../卡片源码/运行时/battle-context.js'),Host=require('../../卡片源码/运行时/battle-host.js');global.CxxLoadout=L;global.CxxNumericEngine=E;
const proof=(quote,floor=0,swipe=0)=>({quote,floor,swipe}),enemy=(evidence=proof('敌人举枪向你开火。'))=>({id:'enemy',name:'持枪者',template:'thug',rank:'regular',health:'healthy',equipment:[],evidence});
const ally=(evidence=proof('我让乐奈加入战斗。',1))=>({id:'rana',name:'乐奈',template:'solo',rank:'regular',health:'healthy',equipment:[],evidence});
function start(g=game()){
 const a=enemy(),scene={...B.encounter({inCombat:true,allies:[],enemies:[a]},g),id:'scene',source:'initial',startFloor:0};scene.enemies[0].evidence=a.evidence;
 return B.operation(g,{action:'battle-start',mode:'system',id:'fight',encounterId:'scene'},{battleEncounter:scene});
}
function fixture({active=true,paused=false,text='敌人举枪向你开火。'}={}){
 let g=active?start():game();if(paused)g=op(g,{action:'battle-pause',paused:true});let stat={terminal:{gameplay:g}},draft='我等待对方回答。',chatId='chat',reply=null,hold=null,writes=0;
 const chat=[{mes:text,swipe_id:0,variables:[{stat_data:stat}]}],events=new Map(),storage=new Map(),calls=[];
 const ctx={chat,characters:[{avatar:'fixture'}],characterId:0,getCurrentChatId:()=>chatId,isGenerating:false,eventTypes:Object.fromEntries(['CHAT_CHANGED','GENERATION_STARTED','GENERATION_STOPPED','GENERATION_ENDED','MESSAGE_SENT','MESSAGE_RECEIVED','MESSAGE_SWIPED'].map(k=>[k,k]))};
 const emit=async(n,...a)=>{for(const fn of events.get(n)||[])await fn(...a);};
 const top={crypto:global.crypto,Event:class{},dispatchEvent(){},document:{querySelector:()=>({get value(){return draft;}})},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},__cxx_utility__:{request:async r=>{calls.push(r);if(hold)await hold;return structuredClone(typeof reply==='function'?reply(r):reply||{action:{kind:'defend'},allies:[],enemies:[enemy()],checks:[{name:'持枪者',participation:'enemy',evidence:enemy().evidence}],departures:[]});},cancel(){}},toastr:{warning(){}}};
 const api={SillyTavern:{getContext:()=>ctx},eventOn(n,f){if(!events.has(n))events.set(n,[]);events.get(n).push(f);},eventRemoveListener(n,f){events.set(n,(events.get(n)||[]).filter(x=>x!==f));},builtin:{duringGenerating:()=>false}};
 const service=Host.create({api,top,B});top.__cxx_player__={async commit(r){writes++;const row=chat[r.floor??chat.length-1],i=row.swipe_id||0,before=row.variables[i].stat_data;row.variables[i].stat_data=O.plan(before,r,{battleRoster:r.action==='battle-roster'?service.authorizeRoster(r.rosterId):undefined,battleClosure:r.reason==='narrative_end'?service.authorizeClosure():undefined});return row.variables[i];},async retrySave(){}};service.start();
 return {ctx,top,service,chat,events,calls,storage,emit,get stat(){return chat.at(-1).variables[0].stat_data;},get game(){return this.stat.terminal.gameplay;},draft:v=>draft=v,reply:v=>reply=v,hold(){let release;hold=new Promise(r=>release=r);return()=>{hold=null;release();};},writes:()=>writes,async switch(){chatId='other';await emit('CHAT_CHANGED');},append(text,{user=false,variables=true}={}){const row={mes:text,is_user:user,swipe_id:0};if(variables)row.variables=[{stat_data:structuredClone(this.stat)}];chat.push(row);return chat.length-1;}};
}
test('canonical evidence excludes planning, unused choices, advice and remote status',()=>{
 const raw='<konatan_planning~>敌人已经全部倒下。</konatan_planning~><cxx-story>乐奈护住玩家。敌人仍持枪。</cxx-story><xuan><option>乐奈斩断武器</option></xuan><advice>下一轮战斗结束。</advice><ztl>{"time":"10:00","location":"咖啡馆","characters":[{"name":"千早爱音"}]}</ztl><UpdateVariable><Analysis>战斗结束</Analysis></UpdateVariable>';
 const body=C.storyText({mes:raw});assert.equal(body,'乐奈护住玩家。敌人仍持枪。');assert.deepEqual(C.people([{text:body}]).map(x=>x.name),['要乐奈']);
 assert.equal(C.storyText({mes:'Master，规划她将参战。</konatan_planning~><cxx-story>敌人仍持枪。</cxx-story><advice>战斗结束</advice>'}),'敌人仍持枪。');
});
test('player declarations without prior presence are candidates; individual proof required',()=>{
 const messages=C.messages([{mes:'敌人举枪向你开火。'},{is_user:true,mes:'我让乐奈加入战斗。'}]);const result={inCombat:true,startFloor:0,evidence:enemy().evidence,allies:[ally()],enemies:[enemy()],checks:[{name:'乐奈',participation:'ally',evidence:ally().evidence}]};
 // Select an actual supported profession for the named ally.
 result.allies[0].template='thug';const checked=C.scene(result,messages,game());assert.equal(checked.allies[0].name,'要乐奈');assert.equal(checked.allies[0].evidence.role,'player');
 assert.throws(()=>C.scene({...result,allies:[]},messages,game()),/漏掉/);assert.throws(()=>C.scene({...result,checks:[]},messages,game()),/尚未核对/);
 assert.throws(()=>C.scene({...result,allies:[{...result.allies[0],evidence:proof('写作建议参战',1)}]},messages,game()),/依据/);
});
test('observer is excluded; unknown raw stats never enter a candidate',()=>{
 const messages=C.messages([{mes:'敌人举枪向你开火。乐奈在远处观察，没有参与。'}]),e=enemy(proof('敌人举枪向你开火。'));
 const result={inCombat:true,startFloor:0,evidence:e.evidence,allies:[],enemies:[{...e,hpMax:99999,level:99999}],checks:[{name:'乐奈',participation:'observer',evidence:proof('乐奈在远处观察，没有参与。')}]};
 const checked=C.scene(result,messages,game());assert.equal(checked.allies.length,0);assert.notEqual(checked.enemies[0].level,99999);assert.notEqual(checked.enemies[0].vitals.hp,99999);
});
test('roster changes retain existing injuries and store departures, absent mention is not departure',()=>{
 const g=start();g.numeric.combat.enemies[0].vitals.hp=37;const c=g.numeric.combat,messages=C.messages([{mes:'敌人举枪向你开火。'},{is_user:true,mes:'我让乐奈加入战斗。'}]),a={...ally(),template:'thug'};
 const r={allies:[a],enemies:[{...enemy(),health:'healthy'}],checks:[{name:'乐奈',participation:'ally',evidence:a.evidence},{name:'持枪者',participation:'enemy',evidence:enemy().evidence}],departures:[]};
 const delta=C.changes(r,messages,g),authorized={...delta,id:'roster',battleId:c.id,expected:JSON.stringify(c),source:'source'};
 const next=B.operation(g,{action:'battle-roster',rosterId:'roster'},{battleRoster:authorized});assert.equal(next.numeric.combat.enemies[0].vitals.hp,37);assert.equal(next.numeric.combat.allies[0].id,'rana');assert.equal(next.numeric.combat.round,0);assert.deepEqual(next.numeric.vitals,g.numeric.vitals);
 assert.throws(()=>B.operation(g,{action:'battle-roster',rosterId:'roster',battleRoster:authorized}),/凭据/);
 assert.equal(C.changes({...r,allies:[],checks:[{name:'乐奈',participation:'observer',evidence:a.evidence},{name:'持枪者',participation:'enemy',evidence:enemy().evidence}]},messages,next).departures.length,0);
});
test('scene scan carries earlier declarations beyond four rows and rejects auxiliary evidence',async()=>{
 const f=fixture({active:false});try{f.append('我让乐奈加入战斗。',{user:true});for(let i=0;i<6;i++)f.append('双方继续对峙。');const floor=f.append('敌人举枪向你开火。');f.draft('');
 f.reply({inCombat:true,startFloor:0,evidence:proof('敌人举枪向你开火。',floor),allies:[{...ally(),template:'thug'}],enemies:[enemy(proof('敌人举枪向你开火。',floor))],checks:[{name:'乐奈',participation:'ally',evidence:ally().evidence}]});const scene=await f.service.recognize();assert.equal(scene.allies.length,1);assert.ok(f.calls[0].input.messages.length>4);assert.equal(scene.startFloor,0);
 }finally{f.service.destroy();}
});
test('narrative preflight freezes defend and retries reuse the same numerical result',async()=>{
 const f=fixture();try{const before=structuredClone(f.game);await f.service.preflight();assert.equal(f.calls.length,1);assert.deepEqual(f.game,before);const p=f.service.prepare('normal',f.stat,false);assert.match(p,/defend/);await f.service.preflight();assert.equal(f.calls.length,1);assert.equal(f.service.prepare('normal',f.stat,false),p);assert.equal(f.writes(),0);}finally{f.service.destroy();}
});
test('system rounds cannot bypass preflight and ambiguous multi-target attacks do not freeze',async()=>{
 const f=fixture();try{assert.throws(()=>f.service.prepare('normal',f.stat,false),/尚未识别/);f.game.numeric.combat.enemies.push({...structuredClone(f.game.numeric.combat.enemies[0]),id:'other',name:'另一人'});f.reply({action:{kind:'attack'},allies:[],enemies:[enemy(),{...enemy(),id:'other',name:'另一人'}],checks:[{name:'持枪者',participation:'enemy',evidence:enemy().evidence},{name:'另一人',participation:'enemy',evidence:enemy().evidence}]});await assert.rejects(f.service.preflight(),/目标不明确/);assert.equal(f.service.state().pending,false);assert.equal(f.writes(),0);}finally{f.service.destroy();}
});
test('API failure preserves draft and a saved manual correction permits retry without API',async()=>{
 const f=fixture();try{f.top.__cxx_utility__.request=async()=>{throw Error('timeout');};await assert.rejects(f.service.preflight(),/timeout/);assert.equal(f.top.document.querySelector().value,'我等待对方回答。');assert.equal(f.writes(),0);f.stat.terminal.gameplay=op(f.game,{action:'battle-action',actions:{player:{kind:'defend'}}});await f.service.preflight();assert.match(f.service.prepare('normal',f.stat,false),/defend/);}finally{f.service.destroy();}
});
test('late preflight cannot survive draft edits, branch changes or chat changes',async()=>{
 for(const change of [f=>f.draft('我撤离。'),f=>f.chat[0].swipe_id=1,f=>f.switch()]){const f=fixture();try{const release=f.hold(),p=f.service.preflight();await change(f);release();await assert.rejects(p,/变化|起点/);assert.equal(f.writes(),0);assert.equal(f.service.state().pending,false);}finally{f.service.destroy();}}
});
test('active roster confirmation blocks sending without resetting existing HP',async()=>{
 const f=fixture();try{f.draft('我让乐奈加入战斗。');f.game.numeric.combat.enemies[0].vitals.hp=31;const a={...ally(),template:'thug'};f.reply({action:{kind:'defend'},allies:[a],enemies:[enemy()],checks:[{name:'乐奈',participation:'ally',evidence:a.evidence},{name:'持枪者',participation:'enemy',evidence:enemy().evidence}],departures:[]});await assert.rejects(f.service.preflight(),/名单/);const candidate=f.service.roster();assert.equal(candidate.allies[0].name,'要乐奈');await f.service.confirmRoster(candidate.id);assert.equal(f.game.numeric.combat.enemies[0].vitals.hp,31);assert.equal(f.game.numeric.combat.allies.length,1);assert.equal(f.game.numeric.combat.round,0);}finally{f.service.destroy();}
});
test('changed saved action cannot continue an old frozen attack',async()=>{
 const f=fixture();try{f.stat.terminal.gameplay=op(f.game,{action:'battle-action',actions:{player:{kind:'attack',target:'enemy'}}});await f.service.preflight();f.service.prepare('normal',f.stat,false);const uf=f.append('攻击',{user:true});await f.emit('MESSAGE_SENT',uf);f.append('尚未完成的正文');await f.emit('GENERATION_STOPPED');f.stat.terminal.gameplay=op(f.game,{action:'battle-action',actions:{player:{kind:'withdraw'}}});await assert.rejects(f.service.preflight({type:'continue'}),/不能续写/);assert.throws(()=>f.service.prepare('continue',f.stat,false),/不能续写/);assert.equal(f.game.numeric.combat.round,0);}finally{f.service.destroy();}
});
test('paused story ending closes conflict, retaining already settled resource changes',async()=>{
 const f=fixture({paused:true});try{f.draft('');const floor=f.append('敌人被制服并带离，乐奈收起武器，冲突结束。');f.stat.terminal.gameplay=E.settle(f.game,[{id:'chip_overload',kind:'resource',target:'player',resource:'hp',amount:-25,reason:'芯片过载'}]).state;const hp=f.game.numeric.vitals.hp,receipts=structuredClone(f.game.numeric.receipts);f.reply({ended:true,sameConflict:true,battleId:'fight',evidence:proof('冲突结束。',floor),enemies:[{id:'enemy',state:'incapacitated',evidence:proof('敌人被制服并带离',floor)}]});assert.equal(await f.service.checkClosure(),true);assert.equal(f.game.numeric.combat.active,false);assert.equal(f.game.numeric.combat.closed.reason,'narrative_end');assert.equal(f.game.numeric.vitals.hp,hp);assert.deepEqual(f.game.numeric.receipts,receipts);assert.equal(await f.service.checkClosure(),false);assert.equal(f.writes(),1);}finally{f.service.destroy();}
});
test('active battle is not overridden by prose and incomplete closure cannot end paused battle',async()=>{
 const f=fixture();try{f.reply({ended:true});assert.equal(await f.service.checkClosure(),false);assert.equal(f.calls.length,0);f.stat.terminal.gameplay=op(f.game,{action:'battle-pause',paused:true});f.reply({ended:true,sameConflict:true,battleId:'fight',evidence:proof('敌人举枪向你开火。'),enemies:[]});assert.equal(await f.service.checkClosure(),false);assert.equal(f.game.numeric.combat.active,true);assert.equal(f.writes(),0);}finally{f.service.destroy();}
});
test('recovery tombstone prevents old pending results from reactivating combat',async()=>{
 const f=fixture();try{await f.service.preflight();f.service.prepare('normal',f.stat,false);const p=JSON.parse([...f.storage.values()][0]).ticket,hp=f.game.numeric.vitals.hp;await f.service.endBattle();assert.equal(f.game.numeric.combat.active,false);assert.equal(f.game.numeric.combat.closed.reason,'recovery');assert.equal(f.game.numeric.vitals.hp,hp);assert.throws(()=>op(f.game,{action:'battle-resolve',pending:p}),/起点已变化/);assert.equal(f.service.state().pending,false);assert.equal(f.game.numeric.combat.round,0);}finally{f.service.destroy();}
});
test('closure response arriving after chat switch is ignored',async()=>{
 const f=fixture({paused:true});try{f.reply({ended:true,sameConflict:true,battleId:'fight',evidence:proof('敌人举枪向你开火。'),enemies:[{id:'enemy',state:'truce',evidence:enemy().evidence}]});const release=f.hold(),p=f.service.checkClosure();await f.switch();release();assert.equal(await p,false);assert.equal(f.writes(),0);}finally{f.service.destroy();}
});
test('invalid or unaffordable ability blocks preflight instead of silent no-op',()=>{
 const g=start();assert.throws(()=>C.action({kind:'ability',ability:'unknown'},g),/能力/);assert.throws(()=>C.action({kind:'attack',target:'unknown'},g),/目标/);
});
test('regenerating an aborted reply applies the explicit correction from that reply to the original round start',async()=>{
 const f=fixture();try{await f.service.preflight();f.service.prepare('normal',f.stat,false);const floor=f.append('我攻击敌人。',{user:true});await f.emit('MESSAGE_SENT',floor);const before=structuredClone(f.stat);f.append('尚未完成的交锋');await f.emit('GENERATION_STOPPED');f.stat.terminal.gameplay=op(f.game,{action:'battle-action',actions:{player:{kind:'withdraw'}}});const calls=f.calls.length;await f.service.preflight({type:'regenerate'});assert.equal(f.calls.length,calls);const prompt=f.service.prepare('regenerate',before,false);assert.match(prompt,/"player":\{"kind":"withdraw"/);assert.equal(f.game.numeric.combat.round,0);}finally{f.service.destroy();}
});
test('recovery clears uncommitted tickets even if the subsequent disk save fails',async()=>{
 const f=fixture();try{await f.service.preflight();f.service.prepare('normal',f.stat,false);const commit=f.top.__cxx_player__.commit;f.top.__cxx_player__.commit=async r=>{await commit(r);throw Error('disk-failed');};await assert.rejects(f.service.endBattle(),/disk-failed/);assert.equal(f.service.state().pending,false);assert.equal(f.game.numeric.combat.active,false);assert.equal(f.storage.size,0);}finally{f.service.destroy();}
});
test('identified action settles through the real round operation once and is not carried to the next round',async()=>{
 const f=fixture();try{f.draft('我攻击持枪者。');f.reply({action:{kind:'attack',target:'enemy',activeSlots:['invented']},allies:[],enemies:[enemy()],checks:[{name:'持枪者',participation:'enemy',evidence:enemy().evidence}],departures:[]});await f.service.preflight();f.service.prepare('normal',f.stat,false);const floor=f.append('我攻击持枪者。',{user:true});await f.emit('MESSAGE_SENT',floor);const reply=f.append('本轮交锋已经完成。');await f.emit('MESSAGE_RECEIVED',reply,'normal');await f.service.finish();assert.equal(f.game.numeric.combat.round,1);assert.equal(f.game.numeric.combat.lastRound.actions.player.kind,'attack');assert.equal(f.game.numeric.combat.lastRound.actions.player.activeSlots,undefined);assert.equal(f.game.numeric.combat.actionOverride,null);const saved=structuredClone(f.game);assert.equal(await f.service.finish(),false);assert.deepEqual(f.game,saved);assert.equal(f.writes(),1);}finally{f.service.destroy();}
});
test('cancelled queued auxiliary work releases its caller without waiting for an unrelated request',async()=>{
 const Utility=require('../../卡片源码/运行时/utility-api.js');let release;const held=new Promise(r=>release=r),config={apiBase:'https://example.test',model:'fixture'},api={SillyTavern:{getContext:()=>({characters:[{avatar:'fixture'}],characterId:0,getCurrentChatId:()=> 'fixture',chat:[]})}},top={__cxx_experience__:{config:()=>config,endpoint:s=>s}};
 const utility=Utility.create({api,top:{...top,__cxx_experience__:{...top.__cxx_experience__,request:async()=>{await held;return{ok:true,json:async()=>({choices:[{message:{content:'{}'}}]})};}}}});
 try{const first=utility.request({id:'first',kind:'item',input:{},system:'fixture'}),second=utility.request({id:'second',kind:'battle',input:{},system:'fixture'});utility.cancel('second');await assert.rejects(Promise.race([second,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('cancel did not release')),100);timer.unref();})]),/取消/);release();await first;}finally{release();utility.destroy();}
});
module.exports={fixture,proof,enemy};
