"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),source=file=>fs.readFileSync(path.join(root,'卡片源码',file),'utf8').replace(/\r\n/g,'\n'),runtime=()=>require('../../工具/lib/bulletin-ui-build.cjs').runtime(source);
test('新版公告把后台card条目映射到更新记录，并保留文本和版本身份',async()=>{
 const {announcementArticles}=await import('../../网页独立版/src/ui/bulletin.mjs');
 const [article]=announcementArticles([{id:3,kind:'card',title:'正式更新',body:'第一段。\n\n<script>纯文本</script>',created_at:'2026-11-14T09:16:39Z',updated_at:'2026-11-14T09:20:00Z',pinned:1}]);
 assert.equal(article.id,'announcement-3');assert.equal(article.kind,'update');assert.equal(article.date,'2026-11-14');assert.equal(article.revision,'2026-11-14T09:20:00Z');assert.deepEqual(article.sections[0].paragraphs,['第一段。','<script>纯文本</script>']);
});
test('公告外部边界略过无有效身份或正文的条目',async()=>{
 const {announcementArticles}=await import('../../网页独立版/src/ui/bulletin.mjs');
 const result=announcementArticles([{id:'3',title:'错误身份',body:'正文'},{id:4,title:null,body:'正文'},{id:5,title:'错误正文',body:[]},{id:6,title:'网站公告',body:'可读正文',kind:'site'}]);
 assert.deepEqual(result.map(a=>[a.id,a.kind]),[['announcement-6','notice']]);
});
test('酒馆构建包含同源新版控制器、完整指南和已发布美术地址',()=>{
 const context={URL};vm.createContext(context);vm.runInContext(runtime(),context);
 const ui=context.CxxBulletin;assert.equal(typeof ui.createBulletin,'function');assert(ui.layout.html.includes('公告与指南'));assert.equal(ui.layout.authored.filter(row=>row.kind==='guide').length,5);assert(ui.layout.css.includes('https://cyber2051.top/resources/bulletin/'));
 assert(!runtime().includes('notice.txt'));assert(!runtime().includes('目前卡最新版为'));
});
test('酒馆公告组件装配缺失时定位组件原因，避免退回旧弹窗',()=>{
 const Entry=require('../../卡片源码/运行时/entry-experience.js');assert.throws(()=>Entry.announcements({}),/公告与指南组件未装载/);
});
