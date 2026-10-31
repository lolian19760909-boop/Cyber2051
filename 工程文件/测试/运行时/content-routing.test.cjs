'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('../../卡片源码/运行时/core.js'),Host=require('../../卡片源码/运行时/host.js'),Content=require('../../卡片源码/运行时/content.js'),Sync=require('../../卡片源码/运行时/business-content-sync.js');
const {extract}=require('../../工具/lib/script-modules.cjs');
const clone=structuredClone;
function fixture(){
 const state={instanceId:'routing',registry:{packages:{sample:{version:'1',content:{worldbook:[{uid:5,name:'街区设定',content:'只供叙事'},{uid:6,name:'[mvu_update]明确的变量规则',content:'指定路由'}],quests:[{id:'delivery',title:'送货',pay:20,goal:'送到目的地'}],gallery:[]}}}},initialContent:{quests:[]},subscriptions:{},conflicts:[],installed:{},baseline:{}};
 const f={state,writes:0,book:{internalName:'content',entries:[]}};
 const api={getLastMessageId:()=>0,getVariables:({type})=>type==='message'?{stat_data:{terminal:{gameplay:{}}}}:{}};
 const host={readState:()=>state,setScope(){},snapshot:async()=>({worldbook:clone(f.book),registry:clone(state.registry)}),saveState:async()=>{}};
 const Gameplay={promptEntries:()=>[{owner:'sample',id:'gameplay.items.test.1',version:'1',entry:{name:'玩法定义·测试物品',content:'测试物品的真实定义',extra:{keep:'unchanged'}}}]};
 const options={api,Core,Content,Host,Gameplay,host,readSeed:()=>({characterIds:[],mapIndex:[]}),transaction:async(_before,after)=>{f.book=clone(after.worldbook);f.writes++;}};
 f.sync=Sync.create(options);f.options=options;return f;
}
test('generated books route narrative to plot, item and quest facts to both, keeping explicit routes',async()=>{
 const f=fixture();await f.sync();const names=f.book.entries.map(e=>e.name);
 assert.ok(names.includes('[mvu_plot]街区设定'));assert.ok(names.includes('[mvu_update]明确的变量规则'));
 assert.ok(names.includes('[mvu_plot][mvu_update]玩法定义·测试物品'));assert.ok(names.includes('[mvu_plot][mvu_update]更新任务·送货'));
 assert.equal(f.book.entries.find(e=>e.name.includes('测试物品')).extra.keep,'unchanged');
 const before=clone(f.book);await f.sync();assert.equal(f.writes,1);assert.deepEqual(f.book,before);
});
test('an existing untagged chat book upgrades once, preserving UIDs, content, player changes and foreign entries',async()=>{
 const f=fixture(),card=JSON.parse(fs.readFileSync(require('node:path').resolve(__dirname,'../../交付/基线/2.3.0-整理前.json')));
 const source=extract(card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-business-core-241').content,['CxxBusinessContentSync'])[0].source;
 const context={module:{exports:{}},crypto:globalThis.crypto,require:require('node:module').createRequire(require.resolve('../../卡片源码/运行时/business-content-sync.js'))};vm.runInNewContext(source,context);await context.module.exports.create(f.options)();
 const old=clone(f.book);f.book.entries[0].content='玩家自改的街区说明';f.book.entries.push(Host.normalizeEntry({uid:999,name:'玩家自建',content:'不要改',extra:{keep:9}}));
 await f.sync();for(const e of old.entries){const next=f.book.entries.find(n=>n.uid===e.uid);assert.equal(next.content,e.uid===old.entries[0].uid?'玩家自改的街区说明':e.content.replace('仅在玩家接取后推进。既有任务状态和账目按原委托系统处理，不因安装内容包自动接单、结算或改写历史。','玩家接取后开始推进，任务进度与账目使用当前故事记录。'));}
 assert.equal(f.book.entries.find(e=>e.uid===999).name,'玩家自建');assert.ok(f.book.entries.some(e=>e.name==='[mvu_plot][mvu_update]玩法定义·测试物品'));
 const writes=f.writes;await f.sync();assert.equal(f.writes,writes);
});
test('the pinned MVU filter accepts the generated book and sends shared definitions to both requests',async()=>{
 const source=fs.readFileSync(require('node:path').resolve(__dirname,'../MVU/fixtures/mvu-pinned.js'),'utf8'),from=source.indexOf('async function zn('),to=source.indexOf('const Vn=new Map',from);
 assert.ok(from>0&&to>from);const state={runtimes:{}},context={yt:{D:()=>state},ut:/\[mvu_update\]/i,pt:/\[mvu_plot\]/i,_:require('D:/SillyTavern/node_modules/lodash'),Pn:{UO:()=>({})}};
 vm.runInNewContext(source.slice(from,to)+';this.filter=zn;',context);
 const f=fixture();await f.sync();const rows=f.book.entries.map(e=>({world:f.book.internalName,comment:e.name,content:e.content}));
 async function filter(isExtra,rows){const lores={characterLore:[],globalLore:[],chatLore:clone(rows),personaLore:[]};await context.filter(lores,{update_method:'额外模型解析',extra_model_supported:true,is_extra_analysis:isExtra});return lores.chatLore;}
 const before=await filter(true,rows.filter(e=>!e.comment.includes('明确')).map(e=>({...e,comment:e.comment.replace(/\[mvu_(?:plot|update)\]/g,'')})));assert.equal(before.length,0);assert.ok(state.runtimes.unsupported_warnings);
 const plot=await filter(false,rows);assert.equal(state.runtimes.unsupported_warnings,'');assert.ok(plot.some(e=>e.comment.includes('测试物品')));assert.ok(plot.some(e=>e.comment.includes('街区设定')));assert.ok(!plot.some(e=>e.comment.includes('明确')));
 const update=await filter(true,rows);assert.equal(state.runtimes.unsupported_warnings,'');assert.ok(update.some(e=>e.comment.includes('测试物品')));assert.ok(update.some(e=>e.comment.includes('送货')));assert.ok(!update.some(e=>e.comment.includes('街区设定')));
});

test('content edits stay in the original worldbook and do not create a book at the title',async()=>{
 const f=fixture();await f.sync();const name=f.book.internalName;assert.equal(name,'content');
 f.state.registry.packages.sample.content.worldbook[0].content='新版街区说明';await f.sync();assert.equal(f.book.internalName,name);assert.equal(f.writes,2);
 assert.equal(f.book.entries.find(e=>e.name.includes('街区')).content,'新版街区说明');
 const empty=fixture();empty.options.api.SillyTavern={getContext:()=>({chat:[{is_user:false}]})};await empty.sync();assert.equal(empty.writes,0);
});

test('a worldbook writer that drops our entry marker adopts the old entries instead of appending a second copy',async()=>{
 const f=fixture();await f.sync();const first=clone(f.book),names=new Set(first.entries.map(e=>e.name));
 let uid=10000;
 for(const e of f.book.entries) delete e.extra.__cxx_official_content;         // older writer drops extensions
 for(const e of first.entries.slice(0,3)){const c=clone(e);c.uid=uid++;delete c.extra.__cxx_official_content;f.book.entries.push(c);}  // copies left by earlier syncs
 const duplicated=f.book.entries.length;
 await f.sync();
 const after=f.book.entries.map(e=>e.name);
 assert.equal(new Set(after).size,after.length,'no duplicate official entries after adoption');
 assert.equal(f.book.entries.length,duplicated-3,'stale byte-identical copies are collapsed');
 for(const e of f.book.entries) if(names.has(e.name)) assert.equal(e.extra?.__cxx_official_content?.instanceId,'routing','ownership marker is restored');
 const writes=f.writes;await f.sync();assert.equal(f.writes,writes,'a second sync is a no-op');
});
