'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Core=require('../../卡片源码/运行时/core.js'),Backup=require('../../卡片源码/运行时/backup.js'),Art=require('../../卡片源码/运行时/item-art.js');
const {fixture}=require('../lib/fixture-loader.cjs')('migration.test.cjs',['fixture']);
function setup(){const f=fixture(),src=require('../../卡片源码/运行时/player-assets.js').cyberdeck,raw=Buffer.from(src.split(',')[1],'base64'),id='art_'+crypto.createHash('sha256').update(raw).digest('hex');
 const asset={id,schema:1,mime:'image/webp',src,...Art.dimensions(raw),purpose:'portrait',future:{keep:true}};
 f.header.chat_metadata.__cxx_story_profile={schema:1,id:'profile_test',name:'旧档人物',appearance:'原文字',additional:'原补充',appearanceTraits:{schema:1,values:{hair:'银色短发',future:'保留'},future:{x:3}},portrait:{schema:1,kind:'asset',id},future:{x:1}};
 f.header.chat_metadata[Art.key]={schema:1,assets:{[id]:asset},future:{x:2}};return {f,asset};}
const exportDoc=async f=>(await f.client.captureMigration()).document;
async function seal(doc){delete doc.sha256;doc.sha256=await Core.sha256(doc);return doc;}
test('new profile and actual portrait travel through full, migration and repeat import without projecting unknown data',async()=>{
 const {f}=setup(),original=structuredClone(f.header.chat_metadata),doc=await exportDoc(f),to=fixture('new',['old']);
 const preview=await to.client.previewMigration(doc),r=await to.client.importMigration(doc,{preview,confirm:'migrate-copy'});
 for(const k of ['__cxx_story_profile',Art.key])assert.deepEqual(to.copies.get(r.chatId)[0].chat_metadata[k],original[k]);
 assert.equal((await to.client.importMigration(doc,{preview,confirm:'migrate-copy'})).chatId,r.chatId);
 const full=await f.client.captureFull();assert.deepEqual((await f.client.parse(full)).payload.header.chat_metadata,original);
 const progress=await f.client.captureProgress();assert.deepEqual((await f.client.parse(progress)).payload.header.chat_metadata,original);
});
test('missing or corrupt portrait blocks preview before any target writes, naming the profile and asset',async()=>{
 const {f,asset}=setup(),good=await exportDoc(f),to=fixture('new',['old']);
 for(const change of [d=>delete d.payload.header.chat_metadata[Art.key],d=>d.payload.header.chat_metadata[Art.key].assets[asset.id].width++,d=>d.payload.header.chat_metadata[Art.key].assets[asset.id].src='data:image/webp;base64,AA==']){
  const bad=structuredClone(good);change(bad);await seal(bad);await assert.rejects(to.client.previewMigration(bad),e=>/^migration-art-/.test(e.code)&&e.message.includes('旧档人物')&&e.message.includes(asset.id));assert.equal(to.writes,0);
 }
 const bad=structuredClone(good);bad.payload.header.chat_metadata[Art.key].assets[asset.id].id='art_'+'0'.repeat(64);await seal(bad);await assert.rejects(to.client.previewMigration(bad),{code:'migration-art-invalid'});
});
test('unfinished creation cannot be exported or accepted from an old tool as a playing story',async()=>{
 const {f}=setup(),doc=await exportDoc(f);f.header.chat_metadata.__cxx_story_v1={schema:1,stage:'creating',creationId:'keep'};
 await assert.rejects(exportDoc(f),{code:'migration-creation-pending'});
 doc.payload.header.chat_metadata.__cxx_story_v1={schema:1,stage:'creating',creationId:'keep'};await seal(doc);const to=fixture('new',['old']);await assert.rejects(to.client.previewMigration(doc),{code:'migration-creation-pending'});assert.equal(to.writes,0);
});
test('legacy profile remains optional; blank extensions do not seed host user descriptions',async()=>{
 const f=fixture(),to=fixture('new',['old']),doc=await exportDoc(f),p=await to.client.previewMigration(doc),r=await to.client.importMigration(doc,{preview:p,confirm:'migrate-copy'});assert.equal(to.copies.get(r.chatId)[0].chat_metadata.__cxx_story_profile,undefined);
 const {f:g}=setup();delete g.header.chat_metadata.__cxx_story_profile.appearanceTraits;const d=await exportDoc(g);assert.equal(d.payload.header.chat_metadata.__cxx_story_profile.appearanceTraits,undefined);assert.equal(d.payload.header.chat_metadata.__cxx_story_profile.appearance,'原文字');
});
