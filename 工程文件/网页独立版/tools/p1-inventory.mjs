/** Effective recipe inputs. C is a new platform responsibility, never an exclusion bucket. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {createHash} from 'node:crypto';
import { buildContent, ROOT, WEB } from './content-build.mjs';
import {WEB_BEHAVIORS,sourceFeatureIds} from './p1-web-mapping.mjs';
const require = createRequire(import.meta.url);
const { manifest, receipt } = await buildContent();
const reports = path.join(WEB, 'reports'); fs.mkdirSync(reports, { recursive: true });
for (const name of ['p1-inventory.json', 'p1-baseline.json']) {
  const file = path.join(reports, name), prior = path.join(reports, name.replace('.json', '-initial.json'));
  if (fs.existsSync(file) && !fs.existsSync(prior)) fs.copyFileSync(file, prior);
}
const registry = require('../../工具/构建/当前/module-sources.json');
const modules = Object.entries(registry.modules);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function evidence(name){const file=path.join(reports,name);if(!fs.existsSync(file))return {report:'reports/'+name,status:'not-recorded'};const bytes=fs.readFileSync(file);let value;try{value=JSON.parse(bytes);}catch{return {report:'reports/'+name,status:'unreadable'};}const rows=value.results||value.checks||[],recorded=Array.isArray(rows)?rows:[],failed=recorded.filter(row=>row&&typeof row==='object'&&row.ok===false).length,errors=Array.isArray(value.errors)?value.errors.length:0,passed=typeof value.passed==='number'?value.passed:recorded.filter(row=>typeof row==='string'||row?.ok===true).length,total=value.total??recorded.length,script='tools/'+name.replace(/\.json$/,'.mjs');return {report:'reports/'+name,sha256:sha(bytes),at:value.at||null,scope:value.scope||'报告未声明范围；只作为来源登记',status:failed||errors||total&&passed<total?'recorded-with-failures':total?'controlled-evidence-recorded':'source-measurement-only',passed,total,...(fs.existsSync(path.join(WEB,script))?{command:'node '+script}:{}),checks:recorded.map(row=>typeof row==='string'?row:{name:row.name,ok:row.ok})};}
const modePort={public:{state:'src/store/idb.mjs',model:'src/models/port.mjs',host:'web/app.mjs'},local:{state:'src/store/idb.mjs',model:'tools/local-runtime.mjs',host:'web/app.mjs'},tavern:{state:'src/store/tavern.mjs',model:'tavern-extension/index.mjs',host:'tavern-extension/index.mjs'}};
const features=registry.features.map(feature=>{const web=WEB_BEHAVIORS[feature.id];if(!web)throw Error('现有功能域缺少网页映射：'+feature.id);return {id:feature.id,title:feature.title,sourceContract:feature,playerBehavior:web.behavior,promptInput:web.promptInput,webDestinations:web.files.map(file=>({path:file,present:fs.existsSync(path.join(WEB,file))})),modeSupport:Object.fromEntries(Object.entries(modePort).map(([mode,ports])=>[mode,{targeted:true,stateOwner:web.owner[mode],ports,implementation:'source-connected',evidenceScope:mode==='tavern'?'真实宿主切片＋合成模型，逐项参考R4报告':'受控协议/状态/界面，真实登录与模型按相应报告边界'}])),controlledEvidence:web.reports.map(evidence),acceptance:'evidence-linked; not a blanket feature or real-model acceptance'};});
const featuresById=new Map(features.map(feature=>[feature.id,feature]));
const rows = manifest.sources.map(source => {
  const cardPath = source.path.startsWith('卡片源码/') ? source.path.slice(5) : null;
  const names = modules.filter(([,file]) => file === cardPath).map(([name]) => name);
  const data = /\.(json|txt|md|css|html|png|webp|jpg)$/i.test(source.path);
  const featureIds=sourceFeatureIds(source,registry),links=featureIds.map(id=>featuresById.get(id));
  return { ...source, modules: names, class: data ? 'A' : 'B', reason: data ? '保留内容／视觉语义；嵌入文档仍需作用域与宿主适配' : '保留主体；适配及实际行为参考功能域映射', modes: ['public','local','tavern'], status: 'source-traced', featureIds,role:featureIds.length?'feature-input':'build-input',webBehavior:featureIds.length?links.map(feature=>({feature:feature.id,playerBehavior:feature.playerBehavior,promptInput:feature.promptInput,stateOwner:Object.fromEntries(Object.entries(feature.modeSupport).map(([mode,value])=>[mode,value.stateOwner])),destinations:feature.webDestinations.map(row=>row.path),evidence:feature.controlledEvidence.map(row=>({report:row.report,status:row.status}))})):[{playerBehavior:'构建闭包中的素材、数据或装配输入；不宣称为额外玩家入口',promptInput:'构建输入不直接注入；仅其经内容编译器选入的字段进入相应功能域',stateOwner:{public:'静态内容/资源manifest',local:'静态内容/资源manifest',tavern:'相同应用资源；不另持业务状态'},destinations:['tools/content-build.mjs','tools/resources-build.mjs'],evidence:[{report:'reports/p4-package-check.json',status:evidence('p4-package-check.json').status}]}],acceptance: {sourceUses:source.uses.flat(),behavior:'see linked feature evidence; source inclusion is not a behavior pass'} };
});
const newResponsibilities=[
 ['storage',['src/store/idb.mjs','src/store/tavern.mjs','src/store/backup.mjs'],['story-save'],'目标模式State及完整备份；当前账号/故事/分支为所有者'],
 ['relay',['../网站/gateway/play-connect.cjs','src/models/adapters.mjs','src/models/port.mjs'],['startup','variables'],'仅在途连接与并发限额；不保存Key/提示/回复'],
 ['localLauncher',['tools/local-runtime.mjs'],['startup'],'本机nonce、HTTP服务与稳定origin；故事仍归IndexedDB'],
 ['hostAdapter',['src/store/tavern.mjs','src/store/native-source.mjs','tavern-extension/index.mjs','src/platform/st-projection.mjs'],['story-save','shared','memory'],'宿主正文/选定楼层/receipt；NS图和六表带来源，插件表只是投影'],
 ['assets',['src/assets/port.mjs','tools/resources-build.mjs'],['map-media'],'官方manifest与可重建资源缓存；玩家媒体归State.media'],
 ['session',['src/app/session.mjs','src/app/turn.mjs'],['variables','story-save'],'候选与冻结票据；正文和状态经同一State.commit提交'],
 ['database',['src/memory/service.mjs','src/memory/timeline.mjs'],['memory'],'六表、任务与索引；来源hash与完整祖先链'],
 ['promptInspection',['src/context/inspector.mjs'],['shared','lore-prompts'],'仅Session内存中的实际发送副本，不进入诊断或存档'],
];
for(const [name,files,featureIds,stateOwner]of newResponsibilities)rows.push({path:files[0],files,class:'C',reason:'目标平台新增职责，不是排除迁移',responsibility:name,featureIds,stateOwner,modeSupport:Object.fromEntries(Object.entries(modePort).map(([mode,ports])=>[mode,{ports,stateOwner,targeted:true}])),status:files.every(file=>fs.existsSync(path.resolve(WEB,file)))?'implementation-present-evidence-linked':'pending',controlledEvidence:[...new Set(featureIds.flatMap(id=>WEB_BEHAVIORS[id].reports))].map(evidence)});
const pluginRoots = [path.join(ROOT,'.cache/web-host-20261025/data-clean/default-user/extensions'),path.join(ROOT,'.cache/debug223/host/app/public/scripts/extensions/third-party'), path.join(ROOT,'配套扩展/tavern-runtime-suite')];
const plugins=[];
for(const dir of pluginRoots){
  if(!fs.existsSync(dir))continue;
  const candidates = fs.existsSync(path.join(dir,'manifest.json')) ? [dir] : fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()||x.isSymbolicLink()).map(x=>path.join(dir,x.name));
  for(const candidate of candidates)for(const file of ['manifest.json','package.json']){const full=path.join(candidate,file);if(fs.existsSync(full)){const bytes=fs.readFileSync(full),value=JSON.parse(bytes);plugins.push({path:path.relative(ROOT,full).replaceAll('\\','/'),name:value.display_name||value.name,version:value.version||null,sha256:sha(bytes),verified:'manifest-only; runtime behavior requires the linked R4 evidence'});break;}}
}
const baseline={at:new Date().toISOString(),node:process.version,stVersion:JSON.parse(fs.readFileSync(path.join(ROOT,'.cache/debug223/host/app/package.json'),'utf8')).version,contentVersion:manifest.contentVersion,sourceHash:manifest.sourceHash,buildInputs:manifest.sources,plugins,modelMatrix:'src/models/registry.mjs',moduleKeys:modules.length,cardBuild:receipt.cardBuild};
const inventory={at:baseline.at,sourceAuthority:'工具/构建/当前/module-sources.json features / AIRP',classification:{A:'复用内容／纯逻辑',B:'保留主体、替换适配',C:'新增平台职责',excluded:'有效构建闭包以外的历史／备份不计完成分母'},summary:rows.reduce((out,row)=>(out[row.class]=(out[row.class]||0)+1,out),{}),features,remainingEvidence:['真实模型与100回合作者长档','实体设备与审美确认','真实公网Discord/Caddy/部署及发布前审核','每项结论仅按相应报告实际scope；功能域链接不代替逐行为验收'],rows};
fs.writeFileSync(path.join(reports,'p1-baseline.json'),JSON.stringify(baseline,null,2)+'\n');
fs.writeFileSync(path.join(reports,'p1-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
const safe=value=>String(value).replaceAll('|','\\|').replaceAll('\n',' '),featureRows=features.map(feature=>'| '+safe(feature.title)+' | '+safe(feature.playerBehavior)+' | '+feature.webDestinations.map(row=>'['+row.path+'](../'+row.path+')').join('、')+' | '+feature.controlledEvidence.map(row=>'['+path.basename(row.report)+']('+path.basename(row.report)+')'+(row.status==='not-recorded'?'（待记录）':row.status==='recorded-with-failures'?'（含失败）':row.total?'（记录 '+row.passed+'/'+row.total+'）':'（来源测量）')).join('、')+' |');
const mappedCount=rows.filter(row=>row.class!=='C'&&row.featureIds?.length).length,buildOnlyCount=rows.filter(row=>row.role==='build-input').length;
const description=[
 '# 网页行为、所有者与证据映射','',
 '本回执继承[原15域AIRP](../../工具/构建/当前/module-sources.json)，不替代[唯一计划](../../网页独立前端规划.md)。完整逐输入记录、三模式所有者、提示输入、落点、报告范围和SHA256在 [p1-inventory.json](p1-inventory.json)；插件版本指纹在 [p1-baseline.json](p1-baseline.json)。','',
 '本次内容 '+manifest.contentVersion+'，'+manifest.sources.length+' 个有效构建输入；'+mappedCount+' 项关联功能域，'+buildOnlyCount+' 项是装配／素材／编译输入，另有 '+newResponsibilities.length+' 项新增平台职责。source-traced 仅表示来源登记，表中的报告链接也不等于整域完成或真实模型通过。原收费短摘要已按作者决定合并到单一数据库Timeline，范围／近期／重建入口保留，新闻再创作仍独立显式请求。','',
 '公网和本地的业务状态由独立State持有；ST沿宿主正文、选定楼层状态与回执，NS图和六表保留来源，插件表是可重建投影。各域细分所有者保留在JSON的modeSupport，不把三模式共用UI当成三种真实链路都已验收。','',
 '| 原功能域 | 网页玩家行为 | 实际落点 | 已有证据及其边界 |','| --- | --- | --- | --- |',...featureRows,'',
 '报告指纹对应生成时点。后续回归若改写报告，应最后再运行 `node tools/p1-inventory.mjs` 和 `node tools/p1-web-mapping-check.mjs`；这两步检查映射与证据一致性，不替代作者的真实模型、实体设备、生产链路及发布验收。','',
];
fs.writeFileSync(path.join(reports,'p1-web-mapping.md'),description.join('\n'));
console.log(JSON.stringify({contentVersion:manifest.contentVersion,inputs:manifest.sources.length,moduleKeys:modules.length,summary:inventory.summary,featureContracts:features.length,mappedSourceInputs:rows.filter(row=>row.class!=='C'&&row.featureIds?.length).length,buildOnlyInputs:rows.filter(row=>row.role==='build-input').length,platformResponsibilities:newResponsibilities.length,plugins,evidenceBoundariesRetained:true},null,2));
