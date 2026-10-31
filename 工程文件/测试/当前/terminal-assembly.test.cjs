'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),B=require('../../工具/lib/card-ast.cjs'),E=require('../../工具/lib/script-modules.cjs').extract,I=require('../../工具/lib/inline-source.cjs').inlineSource;
const source=file=>fs.readFileSync(path.join(root,'卡片源码',file),'utf8').replace(/\r\n/g,'\n');
test('terminal browser fixture loads its requested modules despite unrelated compatibility aliases',()=>{
 const card=JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD||require('../../工具/构建/当前/build.cjs').output));
 const preview=require('../../工具/lib/terminal-preview.cjs').configuration(card);
 assert(preview.html.includes('<html'));assert.equal(E(preview.embedded,['CxxPlayerReader']).length,1);
 assert.equal(E(preview.embedded,['CxxNativeTerminal','CxxGalTerminal']).length,0);
});
test('terminal iframe uses the maintained gameplay and summary implementations instead of inherited prompt copies',()=>{
 const card=JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD||path.join(root,'.cache/build/赛博小祥2051-V2.3.0.json'))),html=B.extract(card).html;
 const code=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 for(const [name,file]of Object.entries({CxxGameplay:'运行时/gameplay.js',CxxSummaryUI235:'正文/summary-ui.js',CxxQuests:'运行时/quests.js',CxxQuestController:'终端/quest-controller.js',CxxQuestUI:'终端/quests-ui.js'})){const actual=E(code,[name]),expected=E(I(source(file)),[name]);assert.equal(actual.length,1,name+' must have one iframe owner');assert.equal(actual[0].source,expected[0].source,name+' current source');}
 assert(!html.includes('/*TERMINAL_'));assert(!card.data.extensions.tavern_helper.scripts.some(s=>/Unassembled (?:module:|shared runtime|Gal runtime)/.test(s.content)));
});
