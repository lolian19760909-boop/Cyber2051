'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Library=require('../../卡片源码/运行时/story-library.js'),Core=require('../../卡片源码/运行时/core.js');
const {fixture:migrationFixture}=require('../lib/fixture-loader.cjs')('migration.test.cjs',['fixture']);
const copy=structuredClone;
async function fixture(){
 const source=migrationFixture('old'),target=migrationFixture('new',['old']);source.seed.migration.contract=target.seed.migration.contract='cyber2051.raw-save.v1';source.seed.baseVersion='2.3.33';target.seed.baseVersion='3.0.0';
 source.header.chat_metadata.legacyTableData={rows:[['名称','值'],['玩家','旧表保留']]};source.header.chat_metadata[Library.KEY]={schema:1,kind:'route',storyId:'source-story',routeId:'source-route',name:'备份恢复样本',slot:1,createdAt:'2026-10-01T00:00:00.000Z',stage:'playing'};
 const doc=(await source.client.captureMigration()).document;let writes=0;
 const adapter={flush:async()=>{},validateExport:doc=>target.client.parseMigration(doc),
  importDocument:async doc=>{writes++;return target.client.importMigration(doc,{preview:await target.client.previewMigration(doc),confirm:'migrate-copy'});},
  open:async id=>{const rows=target.copies.get(id);target.ctx.chatId=id;target.header=rows[0];target.messages=rows.slice(1);},
  current:async()=>({chatId:target.ctx.chatId,rows:copy(target.disk())}),tagCurrent:async meta=>{target.header.chat_metadata[Library.KEY]=copy(meta);},
  list:async()=>[...target.copies].map(([chatId,rows])=>({chatId,meta:Library.metadata(rows),playable:Library.playable(rows)})),read:async id=>copy(target.copies.get(id)),exists:async id=>target.copies.has(id)};
 return {doc,target,adapter,writes:()=>writes,store:Library.createStore({adapter,hash:Core.sha256,uuid:crypto.randomUUID,now:()=> '2026-11-05T00:10:00.000Z'})};
}
for(const change of ['none','continued','deleted'])test('new import of the same backup creates a fresh route after '+change,async()=>{
 const f=await fixture(),source=copy(f.doc),originalTarget=copy(f.target.disk()),first=await f.store.importDocument(f.doc),old=f.target.copies.get(first.chatId);
 if(change==='continued'){old[1].mes='导入后继续玩的正文';f.target.messages[0].mes=old[1].mes;}
 const existing=copy(old);
 if(change==='deleted'){f.target.copies.delete(first.chatId);f.target.ctx.chatId='new-chat';f.target.header=copy(originalTarget[0]);f.target.messages=copy(originalTarget.slice(1));}
 const second=await f.store.importDocument(f.doc),restored=f.target.copies.get(second.chatId);
 assert.notEqual(second.chatId,first.chatId);assert.notEqual(restored[0].chat_metadata[Library.KEY].routeId,existing[0].chat_metadata[Library.KEY].routeId);
 assert.equal(restored[1].variables[1].stat_data.money,40);assert.deepEqual(restored[0].chat_metadata.legacyTableData,source.payload.header.chat_metadata.legacyTableData);assert.deepEqual(f.doc,source);
 if(change!=='deleted')assert.deepEqual(f.target.copies.get(first.chatId),existing);else assert.equal(f.target.copies.has(first.chatId),false);
});
for(const phase of ['import','open','remember'])test('failed '+phase+' retries the same import operation and creates one copy',async()=>{
 const f=await fixture(),method={import:'importDocument',open:'open',remember:'tagCurrent'}[phase],original=f.adapter[method];let fail=true;
 f.adapter[method]=async(...args)=>{const value=await original(...args);if(fail){fail=false;throw Error('fixture '+phase+' interrupted');}return value;};
 await assert.rejects(f.store.importDocument(f.doc),new RegExp(phase+' interrupted'));assert.equal(f.target.copies.size,1);const first=[...f.target.copies.keys()][0];
 const result=await f.store.importDocument(f.doc);assert.equal(result.chatId,first);assert.equal(f.target.copies.size,1);assert.equal(f.writes(),phase==='import'?2:1);
 const next=await f.store.importDocument(f.doc);assert.notEqual(next.chatId,first);assert.equal(f.target.copies.size,2);
});
