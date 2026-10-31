/** Build maintained card/presets without publishing. Used by development and release builds. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {ROOT,WEB} from './workspace-paths.mjs';
import {galleryResources,writeResources} from './resources-build.mjs';
import siteTheme from '../../工具/lib/site-theme.cjs';
export {ROOT,WEB};
const require = createRequire(import.meta.url);
const digest = value => createHash('sha256').update(value).digest('hex');
const slash = value => value.split(path.sep).join('/');
export async function buildContent({ write = true, verifyAssets = false } = {}) {
  if(write)siteTheme.build();
  const builder = require('../../工具/构建/当前/build.cjs');
  const { card, receipt, resourcePack } = await builder.build({ write: false, includeResources: true });
  const paired = require('../../工具/构建/预设/paired.cjs').build({ write: false });
  const inputs = new Map();
  function add(file, reason) {
    const full = path.resolve(ROOT, file);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new Error('构建来源缺失：' + file);
    const relative = slash(path.relative(ROOT, full));
    if (relative.startsWith('../')) throw new Error('构建来源越界：' + file);
    if (inputs.has(relative)) { inputs.get(relative).uses.push(reason); return; }
    const bytes = fs.readFileSync(full);
    inputs.set(relative, { path: relative, bytes: bytes.length, sha256: digest(bytes), uses: [reason] });
  }
  for (const file of Object.keys(receipt.maintenanceSources)) add('卡片源码/' + file, receipt.sourceUses[file] || ['card-build']);
  const assembly = JSON.parse(fs.readFileSync(builder.input, 'utf8'));
  add(slash(path.relative(ROOT, builder.input)), 'assembly-manifest');
  for (const part of [{ file: assembly.baseFile }, ...assembly.parts]) add(slash(path.relative(ROOT, path.resolve(path.dirname(builder.input), part.file))), 'assembly-field');
  for (const result of paired) add(slash(path.relative(ROOT, result.receipt.input.file)), 'official-preset-original');
  for (const file of Object.keys(require.cache)) {
    const rel = slash(path.relative(ROOT, file));
    if (!rel.startsWith('../') && !rel.includes('node_modules/')) add(rel, 'loaded-build-dependency');
  }
  for (const file of ['工具/构建/当前/module-sources.json', '资源/resource-profile.json', '卡片源码/预设/提示词/2051配套衔接.txt', '卡片源码/预设/提示词/心理描写.txt', '卡片源码/预设/提示词/Reborn摘要衔接.txt']) add(file, 'maintained-input');
  add('网页独立版/src/context/knowledge.mjs', 'knowledge-index');
  add('网页独立版/src/context/worldbook-classification.json', 'worldbook-maintenance-classification');
  add('网页独立版/tools/worldbook-classification.mjs', 'worldbook-classification-builder');
  add('网页独立版/src/gameplay/game-setup-catalog.mjs', 'game-version-contract');
  // Web loaders also read raw CSS/data that the embedded card builder compiles away.
  // Trace existing literal file inputs from those maintained loaders, rather than shipping the source tree.
  const uiDirectory=path.join(WEB,'src/ui'),cardDirectory=path.join(ROOT,'卡片源码'),acorn=require('../../工具/lib/card-ast.cjs').acorn;
  for(const name of fs.readdirSync(uiDirectory).filter(name=>name.endsWith('.mjs'))){
    add('网页独立版/src/ui/'+name,'web-ui-loader');
    const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='Literal'&&typeof node.value==='string'){const file=path.resolve(cardDirectory,node.value),relative=path.relative(cardDirectory,file);if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&fs.existsSync(file)&&fs.statSync(file).isFile())add('卡片源码/'+slash(relative),'web-ui-direct-source');}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);};
    visit(acorn.parse(fs.readFileSync(path.join(uiDirectory,name),'utf8'),{sourceType:'module',ecmaVersion:'latest'}));
  }
  const profile = JSON.parse(fs.readFileSync(path.join(ROOT, '资源/resource-profile.json'), 'utf8'));
  for (const key of ['enhanced', 'standing', 'provenance', 'generator']) if (profile[key]) add(profile[key], 'resource-' + key);
  const fonts=JSON.parse(fs.readFileSync(path.join(WEB,'vendor/fonts/sources.json'),'utf8'));for(const file of ['sources.json',fonts.license.file,...fonts.files.map(row=>row.file)])add('网页独立版/vendor/fonts/'+file,'full-font-face');
  const gallery=galleryResources();for(const row of gallery)inputs.set(row.source,{path:row.source,bytes:row.bytes,sha256:row.sha256,uses:['maintained-gallery-image']});
  const sourceRows = [...inputs.values()].sort((a,b) => a.path.localeCompare(b.path, 'en'));
  const sourceHash = digest(JSON.stringify(sourceRows.map(({ path, sha256 }) => [path, sha256])));
  const data = structuredClone(card.data);
  // The standalone state service initializes the story; no MVU initialization entry is used.
  data.character_book.entries=data.character_book.entries.filter(entry=>entry.id!==15).map(entry=>{
    const value={...entry,comment:entry.comment.replace(/^\[mvu_plot\]/,'[database_plot]').replace(/^mvu变量列表$/,'数据库当前状态').replace(/^\[mvu_update\]变量输出格式/,'数据库更新格式').replace(/^变量输出格式/,'数据库更新格式'),content:entry.content.replaceAll('额外MVU','额外解析模型').replaceAll('MVU再','数据库更新器再')};
    if(entry.id===0||entry.id===79)value.extra={...entry.extra,__cxx_variable_mode:entry.id===0?'extra':'main'};
    return value;
  });
  data.extensions = { cxx: data.extensions?.cxx || {} };
  const seed=card.data.extensions.tavern_helper.scripts.find(script=>script.data?.__cxx_update_seed)?.data.__cxx_update_seed;
  if(!seed?.mapIndex||!seed.initialContent)throw new Error('网页内容缺少实际地图与玩法定义');
  const payload = { spec: 'cyber2051.web-content.v1', data,runtimePolicy:Object.fromEntries(['mapIndex','initialContent','registry','openingManifest','characterIds','trustedKeys','baseVersion'].filter(key=>seed[key]!==undefined).map(key=>[key,structuredClone(seed[key])])) };
  const classification=(await import('./worldbook-classification.mjs')).buildWorldbookClassification([{bookId:'card',entries:data.character_book.entries}],JSON.parse(fs.readFileSync(path.join(WEB,'src/context/worldbook-classification.json'),'utf8'))),classificationText=JSON.stringify(classification)+'\n';
  payload.runtimePolicy.plot=(await import('./ui-build.mjs')).memoryPlot(card);
  const presets = paired.map(({ preset, receipt }) => ({ id: receipt.profile, name: receipt.name, preset, source: receipt.input }));
  const promptVersion=digest(JSON.stringify(presets)).slice(0,16);
  const manifest = { schemaVersion: 1, workId: 'cyber2051', contentVersion: receipt.version + '+' + digest(sourceHash+promptVersion+resourcePack.manifest.id).slice(0,12), engineVersion: '3.0.0', promptVersion, sourceHash, sources: sourceRows, presets: presets.map(({id,name})=>({id,name})), resources: receipt.resources, cardBuild: receipt.cardBuild };
  manifest.worldbookClassification={schema:classification.schema,file:'worldbook-classification.json',entries:classification.entries.length,counts:classification.counts,bytes:Buffer.byteLength(classificationText),sha256:digest(classificationText)};
  let ui,assets;
  if (write) {
    const dir = path.join(WEB, 'generated'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir,'worldbook-classification.json'),classificationText);
    ui=(await import('./ui-build.mjs')).writeUI(card,{out:dir});
    const assetIndex=path.join(dir,'assets-manifest.json'),resourceKey=digest(JSON.stringify([resourcePack.manifest.id,JSON.parse(fs.readFileSync(path.join(ROOT,'卡片源码/地图/resources.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(ROOT,'卡片源码/Live2D/manifest.json'),'utf8')).id,fonts,gallery.map(row=>[row.source,row.sha256,row.aliases])]));
    try{assets=JSON.parse(fs.readFileSync(assetIndex,'utf8'));if(verifyAssets||assets.resourceKey!==resourceKey||assets.files.some(row=>!fs.existsSync(path.join(dir,row.url))))assets=null;}catch{}
    if(!assets){assets={...writeResources({resourcePack,gallery}),resourceKey};fs.writeFileSync(assetIndex,JSON.stringify(assets)+'\n');}
    manifest.resources={...manifest.resources,files:assets.files,totalBytes:assets.bytes,individual:true};
    const memoryBundle=require('../../卡片源码/长期记忆/package.cjs').data(),memoryContract={schema:1,tableVersion:memoryBundle.tableVersion,nativeTemplate:memoryBundle.template,tables:Object.values(memoryBundle.template).filter(table=>table.uid).map(table=>({id:table.uid,name:table.name,headers:table.content[0],instruction:table.sourceData.note})),recallPrompt:memoryBundle.recall.plotTasks[0].promptGroup[0].content,advancePrompt:memoryBundle.combined.plotTasks.find(task=>task.id==='cxx_memory_advance').promptGroup[0].content};
    fs.writeFileSync(path.join(dir,'memory-contract.json'),JSON.stringify(memoryContract)+'\n');
    // U02: one queryable index over the maintained worldbook, plus the prompts that regenerate and merge descriptions.
    const {buildKnowledgeIndex,agentPrompts}=await import('../src/context/knowledge.mjs');
    const knowledge=buildKnowledgeIndex({bookId:'card',name:String(card.data?.name||payload.data?.name||'东京都2051'),entries:payload.data?.character_book?.entries||[]},{sourceHash});
    const knowledgeText=JSON.stringify(knowledge)+'\n';
    fs.writeFileSync(path.join(dir,'knowledge-index.json'),knowledgeText);
    // U11/K42: install on first build, repair only the official states we know broke, never overwrite author edits.
    const official=agentPrompts(knowledge,{missing:'K27 原 Skill 生成提示原文未随原件提供，这里的提示是 2051 映射版'});
    const {installOrRepair,templateStatus}=await import('../src/context/templates.mjs');
    const promptFile=path.join(dir,'agent-prompts.json');
    let storedPrompt=null;try{storedPrompt=JSON.parse(fs.readFileSync(promptFile,'utf8'));}catch{storedPrompt=null;}
    const installed=installOrRepair({stored:storedPrompt,official});
    const promptText=JSON.stringify(installed.prompt)+'\n';
    fs.writeFileSync(promptFile,promptText);
    const templateReceipt=templateStatus(installed.prompt,installed);
    manifest.knowledge={schema:knowledge.schema,indexHash:knowledge.indexHash,items:knowledge.stats.items,groups:knowledge.stats.groups,longItems:knowledge.stats.longItems,derivedMeta:knowledge.stats.derivedMeta,file:'knowledge-index.json',bytes:Buffer.byteLength(knowledgeText),sha256:digest(knowledgeText),promptFile:'agent-prompts.json',promptBytes:Buffer.byteLength(promptText),promptSha256:digest(promptText),template:{version:installed.templateVersion,action:installed.action,reason:installed.reason,signature:installed.signature,changedFields:installed.changedFields,digest:templateReceipt.digest}};
    for (const [name, value] of Object.entries({ 'card.json': payload, 'presets.json': presets, 'manifest.json': manifest })) fs.writeFileSync(path.join(dir, name), JSON.stringify(value) + '\n');
  }
  return { card: payload, nativeCard:card, presets, manifest, receipt, resourcePack,ui,assets };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { manifest } = await buildContent();
  console.log(JSON.stringify({ contentVersion: manifest.contentVersion, sources: manifest.sources.length, presets: manifest.presets, resources: manifest.resources.unique }, null, 2));
}
