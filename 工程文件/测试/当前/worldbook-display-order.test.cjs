const test=require('node:test'),assert=require('node:assert/strict'),Host=require('../../卡片源码/运行时/host.js');
test('fresh disk worldbook follows helper displayIndex order and retains real content changes',()=>{
 const raw=(uid,index)=>({uid,displayIndex:index,comment:'fixture',content:'retained-'+uid,key:[],keysecondary:[],constant:true,position:0,order:1,extra:{keep:0}});
 const book={entries:{1:raw(1,3),79:raw(79,1),80:raw(80,2),90:raw(90,undefined)}};
 const actual=Host.rawWorldbookEntries(book),helper=[79,80,1,90].map(uid=>Host.rawEntryRuntime(book.entries[uid]));
 assert.deepEqual(actual,helper);assert.equal(actual[0].extra.keep,0);
 book.entries[79].content='real edit';assert.notDeepEqual(Host.rawWorldbookEntries(book),helper);
});
