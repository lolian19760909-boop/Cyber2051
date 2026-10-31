#!/usr/bin/env node
/** Synthetic contracts only. No browser, model, network, persistent store or product writes.
 * Staged use: node tools/game-setup-contract-check.mjs --app-root=<shared app source>
 * Normal use: node 工程文件/网页独立版/tools/game-setup-contract-check.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createGameSetup} from '../src/gameplay/game-setup.mjs';
const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const appRoot=path.resolve(process.argv.find(arg=>arg.startsWith('--app-root='))?.slice(11)||sourceRoot);
const load=relative=>import(pathToFileURL(path.join(appRoot,relative)));
const {readBooks}=await load('src/platform/worldbook.mjs'),{activateWorldInfo}=await load('src/app/worldinfo.mjs'),{assemblePrompt}=await load('src/app/prompt.mjs'),{createMemoryStatePort}=await load('src/store/memory.mjs');
const require=createRequire(path.join(appRoot,'package.json')),parser=require('../卡片源码/Gal/parser.js');
const checks=[];async function check(name,fn){await fn();checks.push({name,ok:true});}
const contract={rulesId:'fixture-only:rules-A',stateSchemaId:'fixture-only:schema-A'};
const declarations={versions:[{id:'1.3.0',label:'1.3.0'},{id:'fixture-other',label:'合成版本'}],expansions:[{packageId:'fixture.pack',version:'1',label:'合成扩展'}],features:[
 {id:'fixture-required',label:'合成核心',required:true,entries:[{bookId:'card',entryId:'11'}]},
 {id:'fixture-base',label:'合成玩法',defaultEnabled:true,entries:[{bookId:'card',entryId:'12'}]},
 {id:'fixture-detail',label:'合成细节',requires:['fixture-base'],entries:[{bookId:'card',entryId:'13'}]},
 {id:'fixture-alternative',label:'合成互斥项',conflicts:['fixture-base'],entries:[{bookId:'card',entryId:'14'}]},
],combinations:[
 {baseVersion:'1.3.0',expansions:[],featureIds:['fixture-required','fixture-base','fixture-detail','fixture-alternative'],contract},
 {baseVersion:'1.3.0',expansions:[{packageId:'fixture.pack',version:'1'}],featureIds:['fixture-base'],contract:{...contract,rulesId:'fixture-only:rules-pack'}},
 {baseVersion:'fixture-other',expansions:[],featureIds:[],contract:{rulesId:'fixture-only:rules-B',stateSchemaId:'fixture-only:schema-B'}},
]};
const setup=createGameSetup(declarations),draft=setup.draft(),bound=setup.bind(draft),clone=structuredClone;
const books=[{bookId:'card',name:'合成书',entries:[11,12,13,14].map(id=>({id,enabled:true,constant:true,keys:[],content:'FIXTURE_ENTRY_'+id,extensions:{position:0},insertion_order:id}))}];
await check('产品默认仅3.0.0，无虚构玩法或扩充包',()=>{const current=createGameSetup(),catalog=current.catalog;assert.deepEqual(catalog.versions.map(row=>row.id),['3.0.0']);assert.deepEqual(catalog.features,[]);assert.deepEqual(catalog.expansions,[]);assert.deepEqual(current.draft().features,{});});
await check('缺少真实规则与结构声明时可保留草稿，但不能绑定开局',()=>{const current=createGameSetup();assert.equal(current.inspect(current.draft()).ok,true);assert.throws(()=>current.bind(current.draft()),{code:'setup_contract_missing'});});
await check('显式组合保留精确版本、玩法及规则结构标识',()=>{assert.deepEqual(bound,{...draft,rulesId:contract.rulesId,stateSchemaId:contract.stateSchemaId});assert.equal(setup.compatibility(bound).status,'compatible');});
await check('未知版本不按版本号顺序升级',()=>{assert.equal(setup.compatibility({...bound,baseVersion:'99.0.0'}).canWrite,false);});
await check('未知选择记录结构停止写入',()=>{assert.equal(setup.compatibility({...bound,schema:99}).canWrite,false);});
await check('未知扩展和未声明组合停止写入',()=>{assert.equal(setup.compatibility({...bound,expansions:[{packageId:'fixture.pack',version:'2'}]}).canWrite,false);});
await check('规则与状态结构各自不匹配均停止写入',()=>{for(const field of ['rulesId','stateSchemaId'])assert.equal(setup.compatibility({...bound,[field]:'fixture-only:other'}).canWrite,false);});
await check('不能把已有不兼容绑定当草稿静默重绑',()=>{assert.throws(()=>setup.bind({...bound,rulesId:'fixture-only:old'}),{code:'setup_contract_mismatch'});});
await check('无新绑定的旧档交回原有路径，不伪造升级或禁用',()=>{const result=setup.compatibility(null);assert.deepEqual(result,{status:'legacy',canWrite:null,issues:[]});assert.throws(()=>setup.worldbookPatch(null,{books}),{code:'setup_binding_required'});});
await check('旧记录检查保持输入逐字不变',()=>{const old={...bound,unknownLegacy:{keep:true}},before=JSON.stringify(old);setup.compatibility(old);assert.equal(JSON.stringify(old),before);});
await check('玩法必开、依赖、互斥各自阻止无效绑定',()=>{for(const [values,code]of [[{'fixture-required':false},'setup_feature_required'],[{'fixture-base':false,'fixture-detail':true},'setup_feature_dependency'],[{'fixture-alternative':true},'setup_feature_conflict']])assert.throws(()=>setup.bind({...draft,features:{...draft.features,...values}}),error=>error.issues.some(row=>row.code===code));});
await check('未知或缺失玩法值不静默套用默认值',()=>{for(const values of [{...draft.features,unknown:true},{...draft.features,'fixture-base':'false'},{}])assert.throws(()=>setup.bind({...draft,features:values}));});
await check('返回切换组合时清除旧玩法和旧规则绑定',()=>{const expanded=setup.draft({baseVersion:'1.3.0',expansions:[{packageId:'fixture.pack',version:'1'}]});assert.deepEqual(Object.keys(expanded.features),['fixture-base']);assert.equal(setup.bind(expanded).rulesId,'fixture-only:rules-pack');const other=setup.draft({baseVersion:'fixture-other'});assert.deepEqual(other.features,{});assert.equal(setup.bind(other).rulesId,'fixture-only:rules-B');assert.deepEqual(setup.draft(),draft);});
await check('声明不会把同一条目交给两个玩法或引用未知依赖',()=>{const duplicate=clone(declarations);duplicate.features[1].entries=clone(duplicate.features[0].entries);assert.throws(()=>createGameSetup(duplicate),{code:'setup_declaration'});const missing=clone(declarations);missing.features[1].requires=['unknown'];assert.throws(()=>createGameSetup(missing),{code:'setup_declaration'});});
await check('条目补丁只包含本局enabled覆盖，不修改原书',()=>{const before=JSON.stringify(books),policy=setup.worldbookPatch(bound,{books});assert.deepEqual(policy.settingsPatch.books.card.entries['12'],{config:{enabled:true}});assert.deepEqual(policy.settingsPatch.books.card.entries['13'],{config:{enabled:false}});assert.equal(JSON.stringify(books),before);});
await check('条目和宿主书名映射必须确实存在',()=>{assert.throws(()=>setup.worldbookPatch(bound,{books:[]}),{code:'setup_worldbook_target'});const mapped=setup.worldbookPatch(bound,{books:[{...books[0],bookId:'fixture-host'}],bookIds:{card:'fixture-host'}});assert.ok(mapped.settingsPatch.books['fixture-host']);assert.equal(mapped.settingsPatch.books.card,undefined);});
await check('最终装配合同：关闭项排除、开启项保留、目录计划不能重新加入',()=>{
 const policy=setup.worldbookPatch(bound,{books}),world=readBooks({cards:books,settings:policy.settingsPatch});
 // This is the documented integration boundary, not a claim that session.mjs is wired.
 const disabled=new Set(policy.disabledEntries.map(row=>row.bookId+':'+row.entryId));
 const effective=books[0].entries.map(entry=>({...entry,enabled:world.books[0].entries.find(row=>row.entryId===String(entry.id)).config.enabled})).filter(entry=>!disabled.has('card:'+entry.id));
 const info=activateWorldInfo({entries:effective,budgetChars:10000,selection:{managedIds:['13'],selectedIds:['13'],bookChanges:[{bookId:'card',entryId:'13',fields:{enabled:true}}]}});
 const preset={prompts:[{identifier:'worldInfoBefore',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'worldInfoBefore',enabled:true}]}]};
 const prompt=assemblePrompt({preset,supplies:{worldInfoBefore:info.before}}),text=prompt.messages.map(row=>row.content).join('\n');
 assert.ok(text.includes('FIXTURE_ENTRY_12'));assert.ok(!text.includes('FIXTURE_ENTRY_13'));assert.ok(!text.includes('FIXTURE_ENTRY_14'));
});
await check('关闭后返回重选开启，不保留旧enabled覆盖',()=>{const off=setup.bind({...draft,features:{...draft.features,'fixture-base':false}}),a=setup.worldbookPatch(off,{books}),b=setup.worldbookPatch(bound,{books});const merged=clone(a.settingsPatch);Object.assign(merged.books.card.entries,b.settingsPatch.books.card.entries);assert.equal(readBooks({cards:books,settings:merged}).books[0].entries.find(row=>row.entryId==='12').config.enabled,true);assert.ok(!b.disabledEntries.some(row=>row.entryId==='12'));});
await check('建角前本局草稿、另一故事和个人库隔离；正式绑定随现有存档导入导出',async()=>{
 const port=createMemoryStatePort({accountId:'fixture-owner'});await port.writeContentLibrary({books:[{id:'fixture-library'}]});await port.writeStorySettings('fixture-story',{gameSetupDraft:draft});assert.equal(await port.readRun('fixture-story'),null);assert.equal(await port.readStorySettings('fixture-other'),null);
 await port.commit({runId:'fixture-story',accountId:'fixture-owner',branchId:'main',mode:'local',operationId:'fixture-create',nodeId:'fixture-root',parentNodeId:null,expectedRevision:0,profile:{name:'合成人物'},contentVersion:'fixture-only',beforeState:{},stateAfter:{terminal:{}},message:{kind:'opening',raw:'FIXTURE_OPENING',gameSetup:bound}});
 const exported=await port.exportRun('fixture-story'),before=JSON.stringify(exported),imported=createMemoryStatePort({accountId:'fixture-import'});await imported.importRun(exported,{accountId:'fixture-import',runId:'fixture-imported',mode:'local',parser});assert.deepEqual((await imported.readNode('fixture-imported','fixture-root')).message.gameSetup,bound);assert.deepEqual((await imported.readStorySettings('fixture-imported')).gameSetupDraft,draft);assert.deepEqual(await port.readContentLibrary(),{books:[{id:'fixture-library'}]});assert.equal(JSON.stringify(exported),before);
});
await check('新增模块与检查脚本通过Node语法检查',()=>{for(const relative of ['src/gameplay/game-setup.mjs','src/ui/game-setup.mjs','tools/game-setup-contract-check.mjs']){const result=spawnSync(process.execPath,['--check',path.join(sourceRoot,relative)],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);}});
await check('UI样式地址在维护源与既有构建目录都指向新增文件',async()=>{const {GAME_SETUP_STYLE_URL}=await import('../src/ui/game-setup.mjs');assert.equal(GAME_SETUP_STYLE_URL,pathToFileURL(path.join(sourceRoot,'web/styles/game-setup.css')).href);assert.ok(fs.existsSync(fileURLToPath(GAME_SETUP_STYLE_URL)));});
await check('样式可解析、选择器隔离，并沿现有主题变量与静态构建路径',()=>{const {parse}=require('@adobe/css-tools'),css=fs.readFileSync(path.join(sourceRoot,'web/styles/game-setup.css'),'utf8'),ast=parse(css);function visit(rules){for(const rule of rules){if(rule.type==='rule')for(const selector of rule.selectors)assert.ok(selector.startsWith('.cxx-game-setup'),selector);if(rule.rules)visit(rule.rules);}}visit(ast.stylesheet.rules);assert.ok(css.includes('--cxx-interactive'));assert.ok(!/https?:|@import/.test(css));});
const files=['src/gameplay/game-setup.mjs','src/ui/game-setup.mjs','web/styles/game-setup.css','tools/game-setup-contract-check.mjs'];
console.log(JSON.stringify({ok:true,checks:checks.length,results:checks,scope:'synthetic pure/assembly/in-memory save contracts; no live UI acceptance, model, network, real saves or project writes',integration:'Module-only contracts; actual startup/session/creation and final prompt filtering are covered separately by game-setup-session-check and the scoped creation browser fixture',files:files.map(relative=>{const bytes=fs.readFileSync(path.join(sourceRoot,relative));return {path:relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};})},null,2));
