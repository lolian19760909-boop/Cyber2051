'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),acorn=require('D:/SillyTavern/node_modules/acorn');
const Build=require('../../工具/构建/当前/build.cjs'),L=require('../../卡片源码/运行时/loadout.js');
const before=Build.loadInput(),after=JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD||Build.output));
const old=before.data.character_book.entries.filter(e=>e.comment.startsWith('[mvu_plot]物品目录：')),next=after.data.character_book.entries.filter(e=>e.comment.startsWith('[mvu_plot]物品目录：'));
// Replay the installed ST matcher, including its real regexp parser and word
// boundaries. A substring-only test would miss the original false activations.
const st=fs.readFileSync('D:/SillyTavern/public/scripts/world-info.js','utf8'),ast=acorn.parse(st,{ecmaVersion:'latest',sourceType:'module'});
const buffer=ast.body.find(n=>n.type==='ClassDeclaration'&&n.id.name==='WorldInfoBuffer');
const methods=buffer.body.body.filter(n=>['matchKeys','transformString'].includes(n.key.name)).map(n=>st.slice(n.start,n.end)).join('\n');
const parser=ast.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='parseRegexFromString').declaration;
const ctx={world_info_case_sensitive:false,world_info_match_whole_words:false,escapeRegex:require('D:/SillyTavern/node_modules/lodash').escapeRegExp,console};
vm.runInNewContext(st.slice(parser.start,parser.end)+'\nclass Matcher{'+methods+'}\nthis.matcher=new Matcher;',ctx);
function activated(entries,text){return entries.filter(e=>e.keys.some(k=>ctx.matcher.matchKeys(text,k,{caseSensitive:e.extensions.case_sensitive,matchWholeWords:e.extensions.match_whole_words})));}
const samples=[
 {name:'ordinary English prose',text:'Our community values liberty and unity. Ambition, pride and a software crash are topics for tomorrow.',expected:0},
 {name:'ordinary Chinese prose',text:'爱音捡到一只甲壳虫，说今天的天气很好。大家继续讨论明天的排练。',expected:0},
 {name:'specific revolver',text:'她拿起那把 Crash 左轮，检查弹匣。',expected:1},
 {name:'specific handgun',text:'我检查 Constitutional Arms Unity 的弹匣。',expected:1},
 {name:'specific cyberware',text:'我查看额外磁盘与强化肌腱的安装记录。',expected:2},
 {name:'weapon catalogue request',text:'我想挑一把手枪，先看装备 Unity 的介绍。',expected:1},
 {name:'ordinary substrings',text:'The community dislikes disastrous crashes and unifying slogans.',expected:0},
];
test('reference keeps every model and stable entry ID, drops numerical prose, and respects lore budget',()=>{
 assert.equal(next.length,19);assert.deepEqual(next.map(e=>e.id),old.map(e=>e.id));
 for(const d of L.official.items)assert.ok(next.some(e=>e.content.includes(d.name)||d.aliases.some(a=>e.content.includes(a))),d.name);
 for(const e of next){assert.equal(e.extensions.scan_depth,2);assert.equal(e.extensions.ignore_budget,false);assert.ok(e.extensions.prevent_recursion&&e.extensions.exclude_recursion);assert.doesNotMatch(e.content,/本卡1阶|numericEffects|Crit Damage|\d\s*%|登记id|cp_[cw]_/);}
 assert.ok(next.reduce((n,e)=>n+e.content.length,0)<6500);
});
test('current ST keyword matching rejects ordinary prose and accepts intentional item references',()=>{
 const report=samples.map(s=>{const previous=activated(old,s.text),current=activated(next,s.text);assert.equal(current.length,s.expected,s.name);return{...s,before:{count:previous.length,characters:previous.reduce((n,e)=>n+e.content.length,0)},after:{count:current.length,characters:current.reduce((n,e)=>n+e.content.length,0)}};});

 fs.writeFileSync(path.join(Build.cache,'lore-cases.json'),JSON.stringify(report,null,2));
 for(const d of L.official.items){const hits=activated(next,'我查看装备【'+d.name+'】的资料。');assert.ok(hits.some(e=>e.content.includes(d.name)||d.aliases.some(a=>e.content.includes(a))),d.name);}
});
test('all 304 model names still register through the script with unchanged numeric definitions',()=>{
 for(const [i,d]of L.official.items.entries()){
  const game=L.applyEvents({},[{id:'reference_test_'+i,kind:'item-gain',item:{name:d.name,tier:1},quantity:1,reason:'仅在本地内存验证按名称登记'}]);
  const id=d.id+'_t1';assert.equal(game.inventory[id].quantity,1);assert.deepEqual(game.itemDefinitions[id].numericEffects,L.official.definition(d.id,1).numericEffects);
 }
 const {extract}=require('../../工具/lib/script-modules.cjs');const embedded=c=>extract(c.data.extensions.tavern_helper.scripts.map(s=>s.content||'').join('\n;\n'),['CxxItemCatalog'])[0].source;const unpack=card=>{const sandbox={module:{exports:{}},require:require('node:module').createRequire(require.resolve('../../卡片源码/运行时/item-catalog-data.js')),structuredClone};vm.runInNewContext(embedded(card),sandbox);return sandbox.module.exports;};const prior=unpack(JSON.parse(fs.readFileSync(path.join(Build.root,'交付/基线/2.3.0-整理前.json')))),current=unpack(after);assert.equal(current.textVersion,'2.2.5');for(const old of prior.items){const updated=current.find(old.id);assert.deepEqual(JSON.parse(JSON.stringify(updated.numericEffects)),JSON.parse(JSON.stringify(old.numericEffects)));assert.ok(updated.aliases.includes(old.name));}
});
