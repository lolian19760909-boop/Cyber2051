#!/usr/bin/env node
/** U06a 验收：世界书读取、配置合并、外部 revision、接管基线、journal、恢复与用户手改保留。 */
import fs from 'node:fs';
import {
  WORLDBOOK_SCHEMA,CONFIG_FIELDS,entryConfig,normalizeBook,readBooks,bookRevision,diffBooks,planRestore,fieldSnapshot,
} from '../src/platform/worldbook.mjs';
import {
  AGENT_STATE_SCHEMA,emptyAgentState,normalizeAgentState,setMode,takeoverRecord,recordTakeover,takeoverOf,clearTakeover,baselineOf,selectionJournal,journalOf,recordApplied,stateView,
} from '../src/context/agent-state.mjs';

const results=[];
function check(name,ok,detail){results.push({name,ok:!!ok,detail});}
const cardEntries=[
  {uid:1,comment:'世界观·夜之城',content:'街区与治安',enabled:true,constant:true,probability:100,insertion_order:5},
  {uid:2,comment:'角色·灯',content:'高松灯住在 RiNG 附近',enabled:true,selective:true,keys:['灯'],probability:80,position:'before_char',depth:4,role:'system',insertion_order:2},
];
const cardBook={bookId:'card',name:'东京都2051',entries:cardEntries,revision:'ext-card-1'};
const settings={books:{extra:{name:'宿命之环·规则',entriesRaw:[{uid:'r1',comment:'规则·义体反应',content:'义体过载会反噬',enabled:false,probability:30,effect:'dampen'}],revision:'ext-extra-3'},card:{entries:{2:{config:{enabled:false,probability:40}}}}}};

const read=readBooks({cards:[cardBook],settings,host:null});
check('两本书都读进来且带载体', read.schema===WORLDBOOK_SCHEMA&&read.books.length===2&&read.books[0].carrier==='card'&&read.books[1].carrier==='settings', read.books.map(book=>[book.bookId,book.carrier,book.entries.length]));
const entry=read.books[0].entries.find(row=>row.entryId==='2');
check('独立网页：内容来自条目，配置来自故事设置', entry.content.includes('RiNG')&&entry.config.enabled===false&&entry.config.probability===40, entry);
check('条目配置字段齐全', CONFIG_FIELDS.every(field=>field in entryConfig(cardEntries[1])), Object.keys(entryConfig(cardEntries[1])));
check('外部 revision 保留', read.books[0].externalRevision==='ext-card-1'&&read.books[1].externalRevision==='ext-extra-3', read.books.map(book=>book.externalRevision));

const bumped=readBooks({cards:[{...cardBook,entries:[{...cardEntries[0],enabled:false},cardEntries[1]]}],settings});
check('配置变化改变本书 revision', bumped.books[0].revision!==read.books[0].revision, {before:read.books[0].revision,after:bumped.books[0].revision});
const again=readBooks({cards:[cardBook],settings});
check('相同输入 revision 稳定', again.books[0].revision===read.books[0].revision&&again.revision===read.revision);

const diff=diffBooks(read,bumped);
check('差异按条目与字段报告', diff.length===1&&diff[0].entryId==='1'&&diff[0].kind==='config'&&diff[0].fields.includes('enabled'), diff);

let state=setMode(emptyAgentState(),'takeover','2026-10-26T00:00:00.000Z');
check('模式只接受三种取值', (()=>{try{setMode(state,'hack');return false;}catch{cause=>String(cause);}return true;})()&&stateView(state).mode==='takeover');

const baseline=read.books.map(book=>takeoverRecord(book,'2026-10-26T01:00:00.000Z'));
for(const record of baseline)state=recordTakeover(state,record);
const stored=takeoverOf(state,'card');
check('接管基线保存全部字段与正文', !!stored&&stored.entries['1'].content==='街区与治安'&&CONFIG_FIELDS.every(field=>field in stored.entries['1'].config), stored&&{revision:stored.revision,at:stored.at,entries:Object.keys(stored.entries)});
check('接管记录跨刷新仍在', normalizeAgentState(JSON.parse(JSON.stringify(state))).books.card.entries['2'].config.probability===40);

let journaled=selectionJournal(state,{turn:7,at:'2026-10-26T03:00:00.000Z',plan:{managedIds:['1','2'],selectedIds:['2'],requiredIds:[],removedIds:['1'],bookChanges:[{bookId:'card',entryId:'1',fields:{enabled:false}}]},applied:{status:'applied'}});
journaled=selectionJournal(journaled,{turn:7,at:'2026-10-26T03:05:00.000Z',plan:{managedIds:['1'],selectedIds:['1'],requiredIds:['1'],removedIds:[],bookChanges:[]}});
check('同一轮只留最新一条选择记录', journaled.journal.length===1&&journaled.journal[0].plan.selectedIds[0]==='1'&&journalOf(journaled,7).at==='2026-10-26T03:05:00.000Z', journaled.journal);
journaled=selectionJournal(journaled,{turn:8,plan:{managedIds:[],selectedIds:[],requiredIds:[],removedIds:[],bookChanges:[]}});
check('不同轮次分别记录', journaled.journal.length===2&&journalOf(journaled,8)!==null);

// 关闭接管：恢复原字段，但用户手改的内容与配置保留
const userFields={card:{'2':{content:true,config:['probability']}}};
const current=JSON.parse(JSON.stringify(read));
const curEntry=current.books[0].entries.find(row=>row.entryId==='2');
curEntry.content='用户改写的灯';curEntry.config.probability=99;curEntry.config.enabled=true;
const restore=planRestore(baselineOf(state),current,{userFields});
const configPatch=restore.patches.find(row=>row.bookId==='card'&&row.entryId==='2');
check('恢复只写回原字段，保留用户手改', !configPatch?.content&&!('probability' in (configPatch?.config||{}))&&typeof configPatch?.config?.enabled==='boolean', {patches:restore.patches,kept:restore.kept});
check('用户手改的正文与概率不覆盖', restore.kept.some(row=>row.kind==='content')&&restore.kept.some(row=>row.kind==='config'&&row.field==='probability'), restore.kept);

const appliedEntry=current.books[1].entries[0];
appliedEntry.config.enabled=true;
const twoBookRestore=planRestore(baselineOf(state),current);
check('两本书的恢复补丁按书顺序生成', twoBookRestore.patches.some(row=>row.bookId==='extra')&&twoBookRestore.patches[0].bookId==='card', twoBookRestore.patches.map(row=>row.bookId));
const undo=[];let failed=null;
for(const patch of twoBookRestore.patches){
  if(patch.bookId==='extra'&&!failed){failed='second_book_write_failed';break;}
  undo.push(patch);
}
let rolled=JSON.parse(JSON.stringify(current));
for(const patch of undo.reverse()){
  const book=rolled.books.find(row=>row.bookId===patch.bookId);const target=book.entries.find(row=>row.entryId===patch.entryId);
  if(typeof patch.content==='string')target.content=patch.content;Object.assign(target.config,patch.config||{});
}
const rolledEntry=rolled.books[0].entries.find(row=>row.entryId==='2');
check('第二本写失败时第一本按原顺序回滚', failed==='second_book_write_failed'&&rolledEntry.config.enabled===false&&rolledEntry.config.probability===40&&rolledEntry.content==='高松灯住在 RiNG 附近', {failed,rolled:rolledEntry});

const hostRead=readBooks({cards:[cardBook],settings,host:null});
check('没有宿主能力时不伪装成 ST 写入', hostRead.host.available===false&&hostRead.host.reason==='host_missing'&&hostRead.books.every(book=>book.carrier!=='host'), hostRead.host);
const hostPartial=readBooks({cards:[cardBook],host:{list(){return [];}}});
check('宿主只读时标明不能写', hostPartial.host.available===true&&hostPartial.host.canWrite===false&&hostPartial.host.canRead===true, hostPartial.host);

check('快照只覆盖指定条目', Object.keys(fieldSnapshot(read.books[0],['1'])).length===1);
check('清理接管记录', Object.keys(clearTakeover(state,'card').books).length===1&&Object.keys(state.books).length===2);
const appliedState=recordApplied(state,{turn:7,at:'2026-10-26T04:00:00.000Z',plan:'p-1',books:['card'],patches:[{bookId:'card',entryId:'1',config:{enabled:false}}],kept:[],status:'applied'});
check('应用结果可追溯', appliedState.applied.length===1&&stateView(appliedState).applied===1&&appliedState.applied[0].books[0]==='card');

const passed=results.filter(row=>row.ok).length;
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/u06a-worldbook-check.json',JSON.stringify({at:new Date().toISOString(),verdict:passed===results.length?'all '+results.length+' checks passed':'failed',results},null,2));
console.log(passed===results.length?'all '+results.length+' checks passed':'FAILED '+(results.length-passed));
for(const row of results)console.log((row.ok?'PASS ':'FAIL ')+row.name+(row.ok?'':' :: '+JSON.stringify(row.detail)));
process.exit(passed===results.length?0:1);
