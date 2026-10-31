#!/usr/bin/env node
/** U06b 验收：应用、读回、失败回滚、宿主不可写不伪装、用户手改保留、未识别条目报告。 */
import fs from 'node:fs';
import {readBooks,applySelection,planRestore} from '../src/platform/worldbook.mjs';
import {emptyAgentState,setMode,takeoverRecord,recordTakeover,baselineOf} from '../src/context/agent-state.mjs';

const results=[];
const check=(name,ok,detail)=>results.push({name,ok:!!ok,detail});
const cards=[{bookId:'card',name:'东京都2051',entries:[
  {uid:1,comment:'世界观',content:'街区',enabled:true,probability:100,insertion_order:5},
  {uid:2,comment:'角色·灯',content:'灯在 RiNG',enabled:true,selective:true,probability:80,position:'before_char',depth:4},
]},{bookId:'extra',name:'规则书',entries:[{uid:'r1',comment:'规则·义体',content:'过载反噬',enabled:false,probability:30,effect:'dampen'}]}];
const books=readBooks({cards,settings:null});
let state=setMode(emptyAgentState(),'takeover');
for(const book of books.books)state=recordTakeover(state,takeoverRecord(book));

const planA={inputRef:'attempt-1',managedIds:['1','2','r1'],bookChanges:[
  {bookId:'card',entryId:1,fields:{enabled:false}},
  {bookId:'extra',entryId:'r1',fields:{enabled:true,probability:55}},
]};
const appliedSettings=await applySelection({plan:planA,books,state});
check('两本书都按设置载体写入并读回', appliedSettings.status==='applied'&&appliedSettings.books.length===2&&appliedSettings.books.every(row=>row.verified), appliedSettings.books);
check('补丁只包含声明字段', appliedSettings.settingsPatch.books.card.entries['1'].config.enabled===false&&appliedSettings.settingsPatch.books.extra.entries.r1.config.probability===55, appliedSettings.settingsPatch);

const writes=[];
function fakeHost({failOn=null,mutate=null}={}){
  const store={card:[{uid:1,comment:'世界观',content:'街区',enabled:true,probability:100},{uid:2,comment:'角色·灯',content:'灯在 RiNG',enabled:true,selective:true,probability:80}],extra:[{uid:'r1',comment:'规则·义体',content:'过载反噬',enabled:false,probability:30,effect:'dampen'}]};
  return {
    available:true,canRead:true,canWrite:true,
    async read({bookId}){return {bookId,entries:store[bookId]};},
    async apply({bookId,patches,restore}){
      writes.push({bookId,restore:!!restore,patches});
      if(failOn===bookId&&!restore)throw Object.assign(new Error('write boom'),{code:'host_write_failed'});
      for(const patch of patches){const list=store[bookId];const target=list.find(row=>String(row.uid)===String(patch.entryId));if(!target)continue;if(typeof patch.content==='string')target.content=patch.content;Object.assign(target,patch.config||{});}
      // 真实宿主（tavern-extension）在 apply 内部读回核对，不一致抛这个码；夹具照同一口径。
      if(mutate&&mutate[bookId])throw Object.assign(new Error('worldbook readback mismatch'),{code:'worldbook_readback_mismatch'});
    },
  };
}
const hostBooks=readBooks({host:fakeHost(),hostBooks:[{bookId:'card',entries:cards[0].entries},{bookId:'extra',entries:cards[1].entries}]});
let hostState=setMode(emptyAgentState(),'takeover');
for(const book of hostBooks.books)hostState=recordTakeover(hostState,takeoverRecord(book));
const hostOk=await applySelection({plan:{managedIds:['1'],bookChanges:[{bookId:'card',entryId:1,fields:{enabled:false}}]},books:hostBooks,state:hostState,host:fakeHost()});
check('宿主载体写后读回一致', hostOk.status==='applied'&&hostOk.books[0].carrier==='host'&&writes.length>=1, {status:hostOk.status,books:hostOk.books});

writes.length=0;
const failingHost=fakeHost({failOn:'extra'});
const failed=await applySelection({plan:planA,books:hostBooks,state:hostState,host:failingHost});
check('第二本写失败后当前书和第一本均按逆序恢复', failed.status==='failed'&&failed.error?.bookId==='extra'&&failed.restore.length===2&&failed.restore[0].bookId==='extra'&&failed.restore[1].bookId==='card'&&writes.some(row=>row.restore&&row.bookId==='card'), {status:failed.status,error:failed.error,restore:failed.restore,writes});

const mismatch=await applySelection({plan:{managedIds:['1'],bookChanges:[{bookId:'card',entryId:1,fields:{enabled:false}}]},books:hostBooks,state:hostState,host:fakeHost({mutate:{card:target=>{target.enabled=true;}}})});
check('读回不一致按失败处理', mismatch.status==='readback-mismatch'&&mismatch.error?.code==='readback_mismatch', mismatch.error);

const noWrite=await applySelection({plan:{managedIds:['1'],bookChanges:[{bookId:'card',entryId:1,fields:{enabled:false}}]},books:hostBooks,state:hostState,host:{available:true,canRead:true,canWrite:false}});
check('宿主不能写时明确 unsupported', noWrite.status==='unsupported'&&noWrite.error?.code==='host_write_missing'&&noWrite.books.length===0, noWrite.error);

const unscoped=await applySelection({plan:{managedIds:['1'],bookChanges:[{bookId:'card',entryId:2,fields:{enabled:false}},{bookId:'card',entryId:99,fields:{enabled:false}}]},books,state});
check('未纳入本轮管理与不存在的条目不写入', unscoped.books.length===0&&unscoped.unknown.length===1&&unscoped.unknown[0].entryId==='99', {unknown:unscoped.unknown,books:unscoped.books});

const current=JSON.parse(JSON.stringify(books));
current.books[0].entries.find(row=>row.entryId==='2').content='用户改写';
const restore=planRestore(baselineOf(state),current,{userFields:{card:{'2':{content:true}}}});
check('应用后可生成只回写原字段的恢复计划', restore.patches.length===0&&restore.kept.some(row=>row.kind==='content'), restore);

const passed=results.filter(row=>row.ok).length;
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/u06b-apply-check.json',JSON.stringify({at:new Date().toISOString(),verdict:passed===results.length?'all '+results.length+' checks passed':'failed',results},null,2));
console.log(passed===results.length?'all '+results.length+' checks passed':'FAILED '+(results.length-passed));
for(const row of results)console.log((row.ok?'PASS ':'FAIL ')+row.name+(row.ok?'':' :: '+JSON.stringify(row.detail)));
process.exit(passed===results.length?0:1);
