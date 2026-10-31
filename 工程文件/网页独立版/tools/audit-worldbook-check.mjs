import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {readBooks,applySelection}=await import(new URL('../src/platform/worldbook.mjs',import.meta.url));
const books=readBooks({hostBooks:[{bookId:'A',entries:[{id:1,content:'oldA',enabled:true}]},{bookId:'B',entries:[{id:1,content:'oldB',enabled:true}]}]});
const plan={managedIds:['A:1','B:1'],bookChanges:['A','B'].map(bookId=>({bookId,entryId:1,fields:{content:'new'+bookId,enabled:false}}))};
const staleState={books:{A:{entries:{1:{content:'staleA',config:{enabled:false}}}},B:{entries:{1:{content:'staleB',config:{enabled:false}}}}}};
async function run(failRestore){const data={A:{content:'oldA',enabled:true},B:{content:'oldB',enabled:true}},writes=[];const host={canWrite:true,async apply(row){writes.push(row);if(row.restore&&row.bookId===failRestore)throw Error('restore-'+row.bookId+'-failed');for(const p of row.patches)Object.assign(data[row.bookId],{content:p.content,...p.config});if(!row.restore&&row.bookId==='B')throw Object.assign(Error('readback after write'),{code:'worldbook_readback_mismatch'});}};return {result:await applySelection({plan,books,state:staleState,host}),data,writes};}
const clean=await run();assert.equal(clean.result.status,'readback-mismatch');assert.deepEqual(clean.data,{A:{content:'oldA',enabled:true},B:{content:'oldB',enabled:true}});assert.deepEqual(clean.result.restore.map(x=>x.bookId),['B','A']);
for(const book of ['A','B']){const failed=await run(book);assert.equal(failed.result.error.bookId,'B');assert.equal(failed.result.restore.find(r=>r.bookId===book).error,'restore-'+book+'-failed');assert.ok(failed.result.restore.find(r=>r.bookId!==book&&!r.error));}
const success=await applySelection({plan,books,host:{canWrite:true,async apply(){}}});assert.equal(success.status,'applied');assert.equal(success.books.length,2);assert.equal(success.restore.length,0);
const unsupported=await applySelection({plan,books,host:{canWrite:false}});assert.equal(unsupported.status,'unsupported');assert.equal(unsupported.restore.length,0);
console.log(JSON.stringify({passed:5,total:5,scope:'In-memory host only; current-book readback rollback, current snapshot vs stale takeover, both restore failures, success/unsupported'}));
