import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';import {createMemoryStatePort} from '../src/store/memory.mjs';import {createWebSession} from '../src/app/session.mjs';import {createRulesEngine} from '../src/rules/engine.mjs';import {expandMacros} from '../src/app/prompt.mjs';
import {lintContent} from './preset-lint.mjs';
const require=createRequire(import.meta.url),formal=require('../../工具/构建/预设/paired.cjs').build({write:false}),web=JSON.parse(fs.readFileSync(new URL('../generated/presets.json',import.meta.url))),card=JSON.parse(fs.readFileSync(new URL('../generated/card.json',import.meta.url))),chain={...cardRuleChain(),parser:cardParser()};
const checks=[];for(const row of web){const source=formal.find(p=>p.preset.name===row.preset.name);assert.deepEqual(row.preset,source.preset);const state=createMemoryStatePort({accountId:'preset-check'}),root=createRulesEngine({chain}).emptyRoot(),runId='preset-'+row.id;await state.commit({accountId:'preset-check',runId,nodeId:'opening',operationId:'open',branchId:'main',parentNodeId:null,expectedRevision:0,stateAfter:root,message:{kind:'opening',raw:'<cxx-story>今天也是一个人。</cxx-story>'},profile:{name:'检查旅人'}});const session=createWebSession({mode:'local',accountId:'preset-check',runId,ports:{state,model:{async complete(){throw Error('本检查不调用模型')}}},chain,card,preset:row.preset});await session.restore();const result=session.buildPrompt('停下来查看四周');assert.ok(result.prompt.messages.length>0);const unresolved=(result.report.warnings||[]).filter(text=>text.includes('未识别的宏'));assert.deepEqual(unresolved,[]);checks.push({preset:row.id,equalToFormal:true,prompts:row.preset.prompts.length,messages:result.prompt.messages.length,inputTokens:result.report.inputTokens,unknownMacros:unresolved});session.dispose();}
for(const [text,expected]of [['{{roll 1d999999}}','1'],['{{roll: 6}}','1'],['{{roll::6}}','1'],['{{roll 2d6+3}}','5']])assert.equal(expandMacros(text,{random:()=>0}).text,expected);
for(const content of ['<%= value %>','<%- value %>','<% if (true) { %>正文<% } %>','{{user}} <%= value %>']){
 const result=lintContent({presets:[{id:'ejs-fixture',preset:{prompts:[{identifier:'test',content}]}}]});
 assert.equal(result.ok,false,'尚未支持的 EJS 必须在构建前拦住');assert.ok(result.findings.some(row=>row.scope==='ejs-fixture:prompt:test'&&row.message.includes('EJS')));
}
const book=lintContent({card:{character_book:{entries:[{id:'ejs-book',content:'<%= value %>',keys:[]}]}}});
assert.equal(book.ok,false);assert.ok(book.findings.some(row=>row.scope==='worldbook:ejs-book'));
const regex=lintContent({presets:[{regex_scripts:[{scriptName:'ejs-regex',findRegex:'{{user}}<%= value %>',substituteRegex:1}]}]});
assert.equal(regex.ok,false,'正则中的模板错误应进入报告，不能让预检抛错退出');
assert.equal(lintContent({presets:[{prompts:[{identifier:'ok',content:'普通正文 {{user}}'}]}]}).ok,true);
assert.equal(expandMacros('{{unknown_macro}}').text,'{{unknown_macro}}','运行时未知宏继续保留原文');
checks.push({name:'EJS preflight and macro regression',cases:8,ok:true});
console.log(JSON.stringify({at:new Date().toISOString(),checks,scope:'fixed formal presets, real card content and browser-kernel prompt assembly; no model output acceptance'},null,2));
