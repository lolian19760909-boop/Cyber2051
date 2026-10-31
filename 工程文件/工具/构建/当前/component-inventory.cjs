'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const B=require('./build.cjs'),registry=require('./module-sources.json');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const relative=file=>path.relative(B.root,file).replaceAll('\\','/');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function inventory(card,receipt){
 const baseline=B.loadInput(),snapshot=read(path.join(B.root,'卡片源码/装配/manifest.json'));
 const scope=read(path.join(B.root,'卡片源码/世界书/entries.json'));
 const features=registry.features.map(f=>({...f,sources:[]}));
 const media=read(path.join(B.root,'卡片源码/运行时/media-pack.json'));
 const sources=Object.entries(receipt.maintenanceSources).map(([file,identity])=>{
  let matches=features.filter(f=>!f.fallback&&f.sourcePatterns.some(p=>new RegExp(p).test(file)));
  if(!matches.length)matches=features.filter(f=>f.fallback&&f.sourcePatterns.some(p=>new RegExp(p).test(file)));
  for(const feature of matches)feature.sources.push(file);
  return {file:'卡片源码/'+file,...identity,kind:'maintained-build-input',features:matches.map(f=>f.id),targets:receipt.sourceUses?.[file]??['build:indirect-read']};
 });
 const targetSources=target=>sources.filter(s=>s.targets.includes(target)).map(s=>s.file);
 const baseScripts=baseline.data.extensions.tavern_helper.scripts;
 for(const script of card.data.extensions.tavern_helper.scripts)assert(registry.scriptContracts[script.id],'Script ownership: '+script.id);
 const scripts=card.data.extensions.tavern_helper.scripts.map((s,index)=>({id:s.id,title:s.name,enabled:s.enabled,pointer:'/data/extensions/tavern_helper/scripts/'+index,
  category:baseScripts.some(b=>b.id===s.id)?'startup-recipe-plus-maintained-sources':'generated-script',sources:targetSources('script:'+s.id),generator:'工具/构建/当前/build.cjs',
  retainedShell:baseScripts.some(b=>b.id===s.id),bytes:Buffer.byteLength(s.content||'')}));
 const worldbook=card.data.character_book.entries.map((e,index)=>{
  const original=baseline.data.character_book.entries.find(b=>b.id===e.id),maintained=targetSources('worldbook:'+e.id);
  return {id:e.id,title:e.comment,enabled:e.enabled,pointer:'/data/character_book/entries/'+index,
   bodyOrigin:maintained.length?'maintained-source':original&&original.content===e.content?'frozen-shell':'build-generated',sources:maintained,
   metadataOrigin:equal(original,e)?'frozen-shell':scope.entries.some(row=>row.id===e.id)?'entries.json-plus-build':'build.cjs-plus-frozen-shell',
   purpose:e.comment,components:registry.components.filter(c=>c.worldbook?.includes(e.id)).map(c=>c.id),loading:{enabled:e.enabled,constant:e.constant,keys:e.keys,secondaryKeys:e.secondary_keys,selective:e.selective,position:e.position,order:e.insertion_order,extensions:e.extensions},bodyBytes:Buffer.byteLength(e.content||'')};
 });
 const regexRegistry=read(path.join(B.root,'卡片源码',registry.regexSources.registry));
 const regex=(card.data.extensions.regex_scripts||[]).map((r,index)=>{const row=regexRegistry.rules.find(x=>x.script.id===r.id);assert(row,'Regex maintenance owner: '+r.id);return {id:r.id,title:r.scriptName,pointer:'/data/extensions/regex_scripts/'+index,
  origin:'maintained-registry',enabled:!r.disabled,owner:row.owner,purpose:row.purpose,sources:targetSources('build:regex'),placement:r.placement,markdownOnly:r.markdownOnly,promptOnly:r.promptOnly,minDepth:r.minDepth,maxDepth:r.maxDepth,runOnEdit:r.runOnEdit};});
 const greetings=[card.data.first_mes,...card.data.alternate_greetings].map((text,index)=>({index,pointer:index?'/data/alternate_greetings/'+(index-1):'/data/first_mes',
  origin:equal(text,index?baseline.data.alternate_greetings[index-1]:baseline.data.first_mes)?'frozen-shell':'build-generated',bytes:Buffer.byteLength(text)}));
 const groups=new Set(['character_book','extensions','first_mes','alternate_greetings']);
 const fields=Object.keys(card.data).filter(k=>!groups.has(k)).map(k=>({pointer:'/data/'+k,origin:equal(card.data[k],baseline.data[k])?'frozen-shell':'build-generated'}));
 const extensions=Object.keys(card.data.extensions).map(key=>({pointer:'/data/extensions/'+key,origin:equal(card.data.extensions[key],baseline.data.extensions[key])?'frozen-shell':'assembled',detail:key==='tavern_helper'?'scripts及更新种子':key==='regex_scripts'?'显示正则':'原字段保留／构建元数据'}));
 const topLevel=Object.keys(card).filter(k=>k!=='data').map(k=>({pointer:'/'+k,origin:equal(card[k],baseline[k])?'frozen-shell':'build-generated'}));
 const indirectModules=Object.keys(require.cache).filter(file=>file.startsWith(path.join(B.root,'卡片源码'))&&!sources.some(s=>path.resolve(B.root,s.file)===file)).map(file=>({file:relative(file),kind:'build-time-module',origin:'Node实际加载；不据此声称整份源被嵌入'}));
 const builders=Object.keys(require.cache).filter(file=>file.startsWith(path.join(B.root,'工具'))).map(relative).sort();
 const known=new Map([...sources.map(s=>[s.file,s.kind]),...indirectModules.map(s=>[s.file,s.kind])]),sourceTree=[];
 function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git'].includes(entry.name))continue;const full=path.join(dir,entry.name),file=relative(full);if(entry.isSymbolicLink()){sourceTree.push({file,kind:'linked-path-not-traversed'});continue;}if(entry.isDirectory()){scan(full);continue;}
  const kind=known.get(file)||(file.startsWith('卡片源码/字段快照/')?'historical-field-snapshot':file==='卡片源码/功能索引.md'?'generated-index':/\.(md|txt)$/i.test(file)?'documentation-or-unread-text':['终端/host.html','终端/application.css','终端/player.css'].some(p=>file==='卡片源码/'+p)?'historical-or-standalone-preview':/\.(png|jpe?g|webp|gif|zip|mp3|ogg|wav|woff2?|riv)$/i.test(file)?'resource-see-manifest':'not-observed-by-current-build');sourceTree.push({file,kind});
 }}scan(path.join(B.root,'卡片源码'));
 const result={schema:1,version:receipt.version,cardBuild:receipt.cardBuild,baseline:receipt.baseline,componentSnapshot:{...snapshot.provenance,file:relative(B.input),role:'2.3.0装配源；维护模块按module-sources登记覆盖'},
  authority:'进度.md',registry:'工具/构建/当前/module-sources.json',features,sources,sourceTree,indirectModules,builders,scripts,worldbook,regex,greetings,fields,extensions,topLevel,resources:receipt.resources,components:registry.components,
  resourceInputs:{registry:'卡片源码/运行时/media-pack.json',id:media.id,files:media.files,archive:'资源/P4基础资源包.zip',playerArchive:'资源/P4玩家资源包-2.3.0.zip',profile:'资源/resource-profile.json',derivatives:'资源/P4玩家资源包-2.3.0.json',builder:'工具/lib/resource-pack.cjs',reader:'工具/lib/offline-resources.cjs',wordmark:'卡片源码/主题/assets/Tokyo2051-logo-v223.png',live2d:'卡片源码/Live2D/manifest.json'},
  historyWorker:receipt.historyWorker,
  boundaries:['sourceUses记录实际维护文本的读取目标；构建共享输入单独标记。','sourceTree覆盖卡片源码文件；not-observed-by-current-build只表示本次构建未读，不认定未使用或允许删除，远程资源与其他工具入口须分别追踪。','装配启动脚本保留原服务顺序；99模块槽及18静态槽由维护源填入。世界书配置与未知字段继续按装配字段保持。','模块登记是来源与功能范围清点，不等于所有深层调用与实机行为已经审查。']};
 result.counts={mappedModules:Object.keys(registry.modules).length,maintainedSources:sources.length,unclassifiedSources:sources.filter(s=>!s.features.length).length,scripts:scripts.length,worldbook:worldbook.length,regex:regex.length,greetings:greetings.length};
 assert.equal(result.counts.unclassifiedSources,0,'维护输入需要功能分类');
 for(const item of [...scripts,...worldbook,...regex])assert(item.pointer);
 return result;
}
function markdown(data,{inventoryFile='.cache/component-e01/inventory.json'}={}){
 const lines=['# 2051功能与构建来源索引','','由`工具/构建/当前/component-inventory.cjs`读取实际构建回执与现有登记生成；修改功能元数据请编辑`module-sources.json`。完成进度仍在[进度](../进度.md)。','',
  `当前候选版本：${data.version}；${data.counts.mappedModules}个模块替换、${data.counts.maintainedSources}份维护输入、${data.counts.scripts}个脚本、${data.counts.worldbook}条世界书、${data.counts.regex}条正则。`,
  `当前装配源：${data.componentSnapshot.file}。字段核对使用2.3.0快照。完整机器清单见[构建来源JSON](../${inventoryFile})。`,'','## 功能与状态归属','','| 功能 | 状态所有者 | 消费端 | 实际维护输入数 |','|---|---|---|---|'];
 for(const f of data.features)lines.push(`| ${f.title} | ${f.stateOwner} | ${f.consumers.join('、')} | ${f.sources.length} |`);
 lines.push('','## 功能入口、宿主与状态','','| 功能 | 入口 | 宿主依赖 | 状态范围 |','|---|---|---|---|');
 for(const f of data.features)lines.push(`| ${f.title} | ${f.entry} | ${f.host} | ${f.state} |`);
 lines.push('','## 制作器覆盖与验证入口','','| 功能 | 可视化适配 | 保留的实现 | 检查入口 |','|---|---|---|---|');
 for(const f of data.features)lines.push(`| ${f.title} | ${f.visualMode??'来源登记'} | ${f.visualAdaptation??''} | ${(f.tests??[]).join('、')} |`);
 lines.push('','## AIRP维护说明','','以下说明来自同一`module-sources.json`功能登记。已有维护源、入口、状态归属、消费者与检查入口沿用上表；这里只补玩家目的、启用条件和一轮叙事／状态／显示关系。保留源码的功能不因此算作可视化接管。','');
 for(const f of data.features){const a=f.airp;if(!a)continue;lines.push(`### ${f.title} · ${f.id}`,'',
  `- 玩家目的：${a.purpose}`,`- 启用条件：${a.enabled}`,`- 输入：${a.inputs}`,`- 输出：${a.outputs}`,
  `- 唯一读写分工：${a.authority}`,`- 世界书／提示关系：${a.prompts}`,`- 一轮流程：${a.turn.join(' → ')}`,
  `- 失败与恢复：${a.recovery}`,`- 复现与现成检查：${a.reproduction.join('；')}`,
  `- 源码调用追踪：${a.sourceTrace.map(s=>'`'+s+'`').join('、')}`,'');}
 lines.push('','## 助手脚本与维护源','','脚本壳标记保留冻结输入；下面列出本次构建实际读取或替换到对应脚本的文本源。','','| 脚本 | 来源类别 | 维护源 |','|---|---|---|');
 for(const s of data.scripts)lines.push(`| ${s.id} · ${s.title} | ${s.category} | ${s.sources.map(p=>'`'+p+'`').join('、')||'沿原壳与构建器处理'} |`);
 lines.push('','## 脚本装载与生命周期','','| 稳定ID | 所有者／依赖 | 销毁边界 | 验证范围 |','|---|---|---|---|');
 for(const s of data.scripts){const c=registry.scriptContracts[s.id];lines.push(`| ${s.id} | ${c.owner}；${c.dependencies} | ${c.disposal} | ${c.verification} |`);}
 lines.push('','## 世界书正文来源','','| UID | 条目 | 启用 | 正文来源 |','|---|---|---|---|');
 for(const e of data.worldbook)lines.push(`| ${e.id} | ${String(e.title).replaceAll('|','／')} | ${e.enabled} | ${e.sources.join('、')||e.bodyOrigin} |`);
 lines.push('','## 正则职责与执行顺序','','规则顺序来自正则/rules.json，共用模式来自正则/patterns.json；build.cjs生成宿主规则。显示与提示词条件按宿主OR语义，不把两个true当作互斥。placement 1为用户、2为助手。','','| 顺序／稳定ID | 职责／消费者 | 启用 | 显示／提示词 | 来源 | 深度 |','|---|---|---|---|---|---|');
 for(const [i,r]of data.regex.entries())lines.push(`| ${i+1} · ${r.id} | ${r.purpose} · ${r.owner} | ${r.enabled} | ${r.markdownOnly}／${r.promptOnly} | ${r.placement.join('、')} | ${r.minDepth??'不限'}—${r.maxDepth??'不限'} |`);
 lines.push('','## 原卡继承与下一步接管','','正则已接入独立维护组件；开场字段、未知扩展及顶层镜像逐项列在机器清单中，未改字段保持原样。原生脚本内的开场页面和终端模板另外由维护源替换，不与卡片的开场字段混为一项。','',...data.boundaries.map(x=>'- '+x),
  '','## 代表功能链','','- 当前任务：内容注册与原MVU任务记录 → `运行时/quest-view.js` → `终端/quests-ui.js`／制作器`rc-quest-value`。动作由`quest-controller`请求，`quest-host`校验来源，`quests`计划，`player-save`保存、`player-reader`读回；`player-refresh`触发刷新，面板确认修订。',
  '- 正文：宿主原文 → `正文/dialogue.js`及`Gal/parser.js` → 原生／Gal视图；`工具/lib/history-worker.cjs`用同源模块和`运行时/story-summaries.js`生成历史Worker。`正文/history-runtime.js`只负责队列、缓存和过期结果，`正文/history-worker.js`只负责消息收发。',
  '- 开场：`开场/catalog.json`与`MVU/openings/` → 共享开场流程 → `player-host.js` → 宿主故事与原生／Gal消费。',
  '- 存档：故事书架／角色操作 → `story-library.js`／`operations.js`／`player-host.js` → 宿主保存与实际读回；超时继续按结果未确认处理。','');
 return lines.join('\n');
}
async function run({write=false,candidate=false,outputDir=path.join(B.root,'.cache/component-e01'),candidateFile=path.join(B.root,'交付/组件/2.3.0-E1-任务组件-20261016/东京都2051-V2.3.0-E1-任务组件候选.json')}={}){
 const {card,receipt}=await B.build(),data=inventory(card,receipt),dir=path.resolve(outputDir);
 if(candidate){const output=path.resolve(candidateFile);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(card,null,2)+'\n');data.candidate=relative(output);receipt.output.file=output;}
 if(write){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'inventory.json'),JSON.stringify(data,null,2)+'\n');fs.writeFileSync(path.join(dir,'build.json'),JSON.stringify(receipt,null,2)+'\n');fs.writeFileSync(path.join(B.root,'卡片源码/功能索引.md'),markdown(data,{inventoryFile:relative(path.join(dir,'inventory.json'))}));}
 return data;
}
module.exports={inventory,markdown,run};
if(require.main===module){const option=name=>{const i=process.argv.indexOf(name);if(i<0)return undefined;assert(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing '+name);return process.argv[i+1];};run({write:process.argv.includes('--write'),candidate:process.argv.includes('--candidate'),outputDir:option('--output-dir'),candidateFile:option('--candidate-file')}).then(data=>console.log(JSON.stringify({counts:data.counts,candidate:data.candidate}))).catch(error=>{console.error(error);process.exitCode=1;});}
