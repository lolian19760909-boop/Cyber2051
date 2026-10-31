/** Synthetic story and model; no player data, API credentials or network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {displayProjection,normalizeThinkingTags} from '../src/app/parse.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {createWebSession} from '../src/app/session.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';
import {nativeBook,exportWorldbook,checkedPreset} from '../src/app/content-settings.mjs';
import {encodeSave,decodeSave} from '../src/store/backup.mjs';
import {transformText} from '../src/app/prompt.mjs';

const checks=[],chain={...cardRuleChain(),parser:cardParser()},state=createMemoryStatePort({accountId:'content-fixture'}),calls=[];
const preset={name:'原预设',openai_max_context:64000,openai_max_tokens:2000,prompts:[{identifier:'worldInfoBefore',marker:true},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'worldInfoBefore',enabled:true},{identifier:'chatHistory',enabled:true}]}]};
const card={data:{name:'测试卡',character_book:{entries:[{id:1,content:'CARD_ORIGINAL',keys:[],enabled:true,constant:true,extensions:{position:0}}]}}};
const model={async chat(payload){calls.push(structuredClone(payload));return {text:'<cxx-story>RAW_STORY</cxx-story>'};}};
const define=(extra={})=>createWebSession({mode:'local',accountId:'content-fixture',runId:'content-story',ports:{state,model},preset,card,chain,...extra});
let app=define();const run=async text=>{const result=await app.runTurn(text);assert.equal(result.status,'committed',result.error?.message);return calls.at(-1).body.messages.map(row=>row.content).join('\n');};
const check=(name,fn)=>Promise.resolve().then(fn).then(()=>checks.push({name,ok:true}));
await check('本局新增、删除、启停条目及额外书进入实际请求，重复 UID 不串书',async()=>{
  await run('创建故事');const data=await app.readContent(),book=data.books[0];
  book.entries[0].content='CARD_EDITED';book.entries[0].extra={unknown:'retain'};
  book.entries.push({id:2,keys:['触发词'],secondary_keys:[],content:'KEYWORD_ENTRY',constant:false,enabled:true});
  await app.saveWorldbook(book);await app.saveWorldbook({bookId:'extra',name:'额外书',entries:[{id:1,content:'EXTRA_BOOK',keys:[],constant:true,enabled:true}]});
  let prompt=await run('触发词');assert.ok(prompt.includes('CARD_EDITED'));assert.ok(prompt.includes('KEYWORD_ENTRY'));assert.ok(prompt.includes('EXTRA_BOOK'));assert.ok(!prompt.includes('CARD_ORIGINAL'));
  book.entries=book.entries.filter(row=>row.id!==2);book.entries[0].enabled=false;await app.saveWorldbook(book);await app.deleteWorldbook('extra');
  prompt=await run('触发词');assert.ok(!prompt.includes('CARD_EDITED'));assert.ok(!prompt.includes('KEYWORD_ENTRY'));assert.ok(!prompt.includes('EXTRA_BOOK'));
});
await check('预设增删、开关、排序及重建会话后的模型预算',async()=>{
  const next=structuredClone(preset);next.name='玩家预设';next.openai_max_context=32000;next.openai_max_tokens=3000;
  next.prompts.unshift({identifier:'added',name:'新增',content:'PRESET_NEW',role:'system'});next.prompt_order[0].order.unshift({identifier:'added',enabled:true});
  await app.savePreset(next,{id:'custom'});assert.ok((await run('预设')).includes('PRESET_NEW'));
  app=define();await app.restore();assert.equal(app.presetId,'custom');assert.equal(app.promptOptions.contextSize,32000);assert.equal(app.promptOptions.outputTokens,3000);
  next.prompt_order[0].order[0].enabled=false;await app.savePreset(next);assert.ok(!(await run('预设关闭')).includes('PRESET_NEW'));
  const overridden=define({promptOptions:{contextSize:48000,outputTokens:4096}});await overridden.restore();assert.equal(overridden.promptOptions.contextSize,48000);assert.equal(overridden.promptOptions.outputTokens,4096);
});
const rule=(id,find,replacement,flags={})=>({id,scriptName:id,findRegex:find,replaceString:replacement,placement:[1,2],disabled:false,markdownOnly:false,promptOnly:false,...flags});
await check('普通、提示词、显示正则分别生效；原始正文保持',async()=>{
  await app.saveRegex([rule('raw','/RAW_STORY/g','NORMAL_STORY'),rule('prompt','/NORMAL_STORY/g','PROMPT_STORY',{promptOnly:true}),rule('display','/NORMAL_STORY/g','DISPLAY_STORY',{markdownOnly:true})]);
  const prompt=await run('正则请求');assert.ok(prompt.includes('PROMPT_STORY'));assert.ok(!prompt.includes('DISPLAY_STORY'));
  assert.equal(app.transformMessage('<cxx-story>RAW_STORY</cxx-story>'),'<cxx-story>DISPLAY_STORY</cxx-story>');assert.equal(app.nodes.at(-1).message.raw,'<cxx-story>RAW_STORY</cxx-story>');
  await app.saveRegex([rule('disabled','/RAW_STORY/g','SHOULD_NOT_APPEAR',{disabled:true})]);assert.equal(app.transformMessage('RAW_STORY'),'RAW_STORY');
});
await check('查找宏转义只转义替换值，不改变正则结构',()=>{
  const p={extensions:{regex_scripts:[rule('escaped','/^{{user}}$/g','MATCH',{substituteRegex:2,markdownOnly:true})]}};
  assert.equal(transformText('A.*(B)',{preset:p,stage:'display',context:{fields:{userName:'A.*(B)'}}}),'MATCH');assert.equal(transformText('AXXXB',{preset:p,stage:'display',context:{fields:{userName:'A.*(B)'}}}),'AXXXB');
});
await check('世界书原生导出同步别名并保留未知字段，支持原生对象条目',()=>{
  const book=nativeBook({name:'原生',entries:{0:{uid:0,key:['old'],keysecondary:['second'],content:'原文',order:7,position:2,unknown:{value:1}}}});
  Object.assign(book.entries[0],{keys:['new'],secondary_keys:['new2'],insertion_order:9});book.entries[0].extensions.position=4;
  const raw=exportWorldbook(book).entries['0'];assert.deepEqual(raw.key,['new']);assert.deepEqual(raw.keysecondary,['new2']);assert.equal(raw.order,9);assert.equal(raw.position,4);assert.deepEqual(raw.unknown,{value:1});
});
await check('无顺序组的预设在导入入口拒绝，不覆盖现有内容',()=>{
  for(const raw of [{prompts:[],prompt_order:[]},{prompts:[],prompt_order:[{}]}])assert.throws(()=>checkedPreset(raw),/order|顺序/);
});
await check('本局内容随完整存档导出、编码、导入新故事；个人库独立',async()=>{
  await app.saveLibrary({books:[{id:'library-book',name:'库书',value:{}}],preset:[],regex:[]});
  const original=await state.readStorySettings(app.identity.runId),snapshot=await state.exportRun(app.identity.runId),file=await encodeSave(snapshot,{compress:false}),{snapshot:decoded}=await decodeSave(file);
  assert.deepEqual(decoded.extensions.storySettings,original);assert.equal(JSON.stringify(decoded).includes('library-book'),false);
  const imported=await state.importRun(decoded,{runId:'imported-story',parser:chain.parser});assert.deepEqual(await state.readStorySettings(imported.runId),original);
  const reopened=createWebSession({mode:'local',accountId:'content-fixture',runId:imported.runId,ports:{state,model},preset,card,chain});await reopened.restore();assert.equal(reopened.presetId,'custom');assert.equal((await reopened.readContent()).books.find(row=>row.bookId==='extra').enabled,false);assert.equal((await reopened.readLibrary()).books[0].id,'library-book');
});
await check('额外变量解析同样使用玩家修改后的规则',async()=>{
  const extraState=createMemoryStatePort(),extraCalls=[],extraCard={data:{character_book:{entries:[{id:4,comment:'[mvu_update]变量输出格式 · 额外解析',content:'PARSE_OLD',constant:true,enabled:true,keys:[],extensions:{position:0}}]}}};
  const extra=createWebSession({mode:'local',accountId:'extra-fixture',runId:'extra-story',chain,preset,card:extraCard,ports:{state:extraState,model:{chat:async payload=>{extraCalls.push(payload);return {text:extraCalls.length%2?'<cxx-story>已完成正文</cxx-story>':'<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>'};}}},promptOptions:{variableMode:'extra'}});
  const data=await extra.readContent();data.books[0].entries[0].content='PARSE_EDITED';await extra.saveWorldbook(data.books[0]);assert.equal((await extra.runTurn('开始')).status,'committed');const parse=JSON.stringify(extraCalls[1]);assert.ok(parse.includes('PARSE_EDITED'));assert.ok(!parse.includes('PARSE_OLD'));
});
await check('阅读只解析一次；显示正则移除的辅助块不会覆回',async()=>{
  await app.saveRegex([rule('hide-aux','/<tucao>[\\s\\S]*?<\\/tucao>/g','',{markdownOnly:true})]);
  const source=fs.readFileSync(new URL('../src/ui/gameplay.mjs',import.meta.url),'utf8'),acorn=createRequire(import.meta.url)('acorn');let node;
  const visit=value=>{if(!value||typeof value!=='object')return;if(value.type==='VariableDeclarator'&&value.id.name==='viewParser')node=value.init;for(const field of Object.values(value))if(Array.isArray(field))field.forEach(visit);else if(field&&typeof field==='object')visit(field);};visit(acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'}));
  let count=0;const fixture={CxxGalParser:{...chain.parser,parseMessage(...args){count++;return chain.parser.parseMessage(...args);}},bodyDepths:new Map(),session:app,displayProjection,normalizeThinkingTags};
  const parser=vm.runInNewContext('('+source.slice(node.start,node.end)+')',fixture),parsed=parser.parseMessage('<cxx-story>显示正文</cxx-story><tucao>应该隐藏</tucao>');assert.equal(count,1);assert.ok(!JSON.stringify(parsed.auxiliary).includes('应该隐藏'));assert.ok(parsed.paragraphs.some(row=>row.text.includes('显示正文')));
});
const report={ok:true,checks,scope:'synthetic memory storage and model; no visual or live API acceptance'};
fs.mkdirSync(new URL('../../.cache/player-controls-20261029/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../../.cache/player-controls-20261029/content-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
