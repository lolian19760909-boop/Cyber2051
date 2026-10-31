'use strict';
// 委托是静态数据；此模块不加载投稿附件、不执行作者代码、不签名。
const path = require('node:path');
const Gameplay = require('./workshop-gameplay.cjs');
const Writing = require('./public/submission-template.js');
const Content = require(process.env.CXX_CONTENT_MODULE || "../../卡片源码/运行时/content.js");
const CONTENT_TYPES = ['character','world_factor','user_identity','contract',...Object.keys(Gameplay.forms)];
const TYPES = [...CONTENT_TYPES,'code_component'];
const places = require('./contract-places.json');
const mapIndex = Object.fromEntries(places.maps.map(map => [map.id, map.places.map(place => place.id)]));
const findPlace = (mapId, placeId) => places.maps.find(map => map.id === mapId)?.places.find(place => place.id === placeId);
const TEXT_FIELDS = ['fixer', 'brief', 'goal', 'fixerNote', 'payNote', 'deadline', 'terms', 'risk', 'bonus', 'unlock'];
const REQUIRED = ['fixer', 'brief', 'goal'];
const BASE_QUESTS = ['q01','q02','q03','q04','q05','q06','q07','q08','q09','q10','q_heist'];
class ContractError extends Error {
  constructor(message, code = 'invalid_contract', status = 400) { super(message); this.code = code; this.status = status; }
}
function fail(message, code, status) { throw new ContractError(message, code, status); }
function fields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' 必须是对象');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(label + ' 不接受字段 ' + key);
}
function staticText(value, label, max = 4000, required = false) {
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) fail(label + ' 文本缺失或过长');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || /<%|<\s*\/?\s*script\b|javascript\s*:/i.test(value)) fail(label + ' 只接受非执行文本');
  return value;
}
function validate(payload) {
  fields(payload, ['format', 'templateKind', 'contract'], '委托正文');
  if (payload.format !== 1) fail('委托格式须为 1');
  if (payload.templateKind !== undefined && !['contract','side_story'].includes(payload.templateKind)) fail('委托模板无效');
  const q = payload.contract;
  fields(q, [...TEXT_FIELDS, 'type', 'difficulty', 'pay', 'mapId', 'placeId', 'prerequisites'], '委托');
  for (const name of TEXT_FIELDS) if (q[name] !== undefined || REQUIRED.includes(name)) staticText(q[name], name, ['brief','goal'].includes(name) ? 4000 : 1500, REQUIRED.includes(name));
  if (!['回收','护送','调查','交涉','救援','其他'].includes(q.type)) fail('请选择委托类型');
  if (!['低','中','高','极高'].includes(q.difficulty)) fail('请选择难度');
  if (!Number.isSafeInteger(q.pay) || q.pay < 0 || q.pay > 10000000) fail('报酬须为 0 至 10000000 的整数');
  if (!findPlace(q.mapId, q.placeId)) fail('只接受现有地图目录中的地点');
  if (q.prerequisites !== undefined && (!Array.isArray(q.prerequisites) || new Set(q.prerequisites).size !== q.prerequisites.length || q.prerequisites.some(id => !BASE_QUESTS.includes(id)))) fail('前置任务只能选择已接入的基础任务，且不能重复');
  return JSON.parse(JSON.stringify(payload));
}
function validateMetadata(input) {
  staticText(input.title, '标题', 60, true); staticText(input.summary, '简介', 2000);
  if (input.authorName) staticText(input.authorName, '署名', 24);
  for (const tag of input.tags || []) staticText(tag, '标签', 60);
}
const WORLD_FIELDS = {
  world_factor: { type:'world_factor', title:'世界因子', fields:[['content','设定正文',true]] },
  encounter: { type:'world_factor', title:'遭遇 / 目击', fields:[['witness','目击者',true],['event','发生的事件',true],['clue','线索',false]] },
  function_zone: { type:'world_factor', title:'功能区设定', fields:[['purpose','用途',true],['access','开放条件说明',false],['services','提供的服务说明',false]] },
  npc: { type:'character', title:'NPC设定', fields:[['name','姓名',true],['identity','身份',true],['background','背景',true],['relationships','关系',false],['boundaries','行为边界',false]] },
  user_identity: { type:'user_identity', title:'玩家出身资料', fields:[['identity','出身名称',true],['background','背景',true],['appearance','外貌',false],['skills','技能说明',false]] },
};
function staticJson(value, depth=0) {
  if (depth>12) fail('内容层级过深');
  if (typeof value==='string') return staticText(value,'正文',40000);
  if (value===null || typeof value==='boolean' || typeof value==='number' && Number.isFinite(value)) return;
  if (!value || typeof value!=='object') fail('正文只接受静态JSON');
  for (const [key,item] of Object.entries(value)) { if (['__proto__','prototype','constructor'].includes(key)) fail('正文含不安全字段'); staticText(key,'字段名',2000); staticJson(item,depth+1); }
}
function validateSubmission(type,payload) {
  staticJson(payload);
  if(payload.templateVersion !== undefined) return validateWriting(type,payload);
  if(type==='contract') return validate(payload);
  if(type==='code_component') {
    fields(payload,['format','templateKind','proposal','entrypoints','compatibility'],'代码集成提案');
    if(payload.format!==1||payload.templateKind!=='code_component')fail('代码提案格式不符');
    for(const name of ['proposal','entrypoints','compatibility'])staticText(payload[name],name,4000,true);
    return JSON.parse(JSON.stringify(payload));
  }
  const gameForm=Gameplay.forms[payload.templateKind];
  if(gameForm){
    if(type!==payload.templateKind||payload.format!==2)fail('玩法模板与类型或格式不一致');
    fields(payload,['format','templateKind','keywords','mapId','placeId','description','gameplay'],'玩法模板');
    staticText(payload.description,'玩法说明',4000,true);validateLocation(payload);
    try{Gameplay.compile(payload.gameplay,payload.templateKind,100000000,mapIndex);}catch(e){fail(e.message);}
    return JSON.parse(JSON.stringify(payload));
  }
  if(!['world_factor','character','user_identity'].includes(type)) fail('没有接入该类消费者');
  if(payload.templateKind!==undefined) {
    const form=WORLD_FIELDS[payload.templateKind];if(!form || form.type!==type)fail('模板与投稿类型不一致');
    fields(payload,['format','templateKind','keywords','mapId','placeId',...form.fields.map(f=>f[0]),...(payload.format===2?['opening','media','gameplay']:[])],'静态模板');
    if(![1,2].includes(payload.format))fail('模板格式须为1或2');
    for(const [name,,required]of form.fields)if(payload[name]!==undefined||required)staticText(payload[name],name,4000,required);
    validateLocation(payload);
    if(payload.format===2){
      const extras={npc:['media'],user_identity:['opening'],encounter:['gameplay'],function_zone:['gameplay'],world_factor:[]}[payload.templateKind];
      for(const field of ['opening','media','gameplay'])if(payload[field]!==undefined&&!extras.includes(field))fail('该模板不接受 '+field);
      if(['encounter','function_zone'].includes(payload.templateKind))try{Gameplay.compile(payload.gameplay,payload.templateKind,100000000,mapIndex);}catch(e){fail(e.message);}
      try{Content.validateStoryMetadata({extra:storyMetadata(payload)});}catch(e){fail(e.message);}
    }
  }
  return JSON.parse(JSON.stringify(payload));
}
function validateLocation(payload){
  if(!findPlace(payload.mapId,payload.placeId))fail('只接受现有地图目录中的地点');
  if(!Array.isArray(payload.keywords)||!payload.keywords.length||payload.keywords.length>8)fail('请填写1至8个关键词');
  for(const key of payload.keywords)staticText(key,'关键词',60,true);
}
function storyMetadata(p){
  if(p.format!==2)return {};
  const pick=names=>Object.fromEntries(names.filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
  if(p.templateKind==='npc')return {__cxx_npc:{format:1,...pick(['name','identity','background','relationships','boundaries','media'])}};
  if(p.templateKind==='user_identity')return {__cxx_player_start:{format:1,name:p.identity,...pick(['opening','background','appearance','skills'])}};
  return {};
}
function schema() {
  return { format: 1, type: 'contract', consumer: 'quests', mapId: places.mapId, places: places.places,
    catalogVersion: places.catalogVersion, maps: places.maps,
    sourceSha256: places.sourceSha256, prerequisites: BASE_QUESTS, taskTypes: ['回收','护送','调查','交涉','救援','其他'], difficulties: ['低','中','高','极高'],
    limits: { pay: 10000000, title: 60, text: 4000 }, activation: 'opt_in',
    templateVersion: Writing.version,
    templates: Writing.templates.map(form => ({...form,writingFields:form.fields,fields:form.fields.map(f=>[f.name,f.label[0],f.required]),enabled:true, templateVersion:Writing.version,
      consumer:form.id==='contract'?'quests':form.id==='npc'?'NPC资料与模型读取':'新聊天出身选择'})),
    legacyTemplates: [
      { id: 'contract', type:'contract', title: '委托', enabled: true, consumer: 'quests', fields: ['发布人','已有地点','简报','目标','报酬','要求','风险','前置任务'] },
      { id: 'side_story', type:'contract', title: '侧剧情', enabled: true, consumer: 'quests', fields: ['发布人','已有地点','剧情背景（简报）','本章目标','前置任务'], note:'剧情正文存为任务简报，接取后随固定任务版本消费。' },
      ...Object.entries(WORLD_FIELDS).map(([id,form])=>({ id,type:form.type,title:form.title,format:2,legacy:true,enabled:true,consumer:{npc:'NPC资料与模型读取',user_identity:'新聊天出身选择',encounter:'目击结果',function_zone:'实际服务'}[id]||'关键词世界书',fields:form.fields,
        note:'启用后按对应玩法使用；不会在安装时修改玩家存档。' })),
      ...Object.entries(Gameplay.forms).map(([id,[title,table]])=>({id,type:id,title,format:2,enabled:true,consumer:table,fields:[['description','用途与操作说明',true]],gameplay:true,note:'只使用现有玩法规则；局部编号由服务端分配固定前缀。依赖定义须一并提交。'})),
      {id:'code_component',type:'code_component',title:'代码集成提案',format:1,enabled:true,consumer:'next_card',fields:[['proposal','功能说明',true],['entrypoints','接入点与影响范围',true],['compatibility','兼容与测试说明',true]],note:'源代码以附件提交，审核后由主工程集成进新版卡；不生成可安装代码包。'},
    ].map(template=>({...template,enabled:false})) };
}
function compile(row, identity, P, options={}) {
  if(!CONTENT_TYPES.includes(row.type))fail('代码提案需集成进新版角色卡，不能导出安装包','next_card_required',409);
  if (!Number.isSafeInteger(row.id) || row.id < 1 || row.id > 100000000 || !Number.isSafeInteger(row.revision) || row.revision < 1) fail('投稿编号或修订号超出范围');
  if (!identity || identity.publisher_id !== row.publisher_id || identity.status !== 'active') fail('作者身份不可用', 'publisher_unavailable', 409);
  const submitted = validateSubmission(row.type,JSON.parse(row.payload));
  const payload = Writing.toLegacy(row.type,submitted);
  validateMetadata({ title: row.title, summary: row.summary || '', authorName: row.author_name, tags: JSON.parse(row.tags || '[]') });
  const source = { submissionId: row.id, revision: row.revision, payloadSha256: row.content_hash, submissionSha256: snapshotHash(row, P),
    publisherId: identity.publisher_id, displayName: identity.display_name_last || '', creditName: row.author_name || '', type:row.type, templateKind:payload.templateKind || row.type };
  if (P.sha256(row.payload) !== source.payloadSha256) fail('投稿正文与已审内容指纹不一致', 'source_hash_mismatch', 409);
  const q = payload.contract, mapId = q?.mapId || payload.mapId, place = findPlace(mapId, q?.placeId || payload.placeId);
  const packageId = options.packageId || 'community.' + row.type + '.' + row.id;
  const quest = q && { ...q, id: 'ugc.contract.' + row.id + '.01', title: row.title, district: place.district, track: 'side' };
  const entry = { uid: 1000000000 + row.id, name: '[工坊委托]' + row.title, enabled: true,
    strategy: { type: 'selective', keys: quest ? [row.title,quest.id] : payload.keywords || [row.title], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
    position: { type: 'before_character_definition', role: 'system', depth: 0, order: 100 }, probability: 100,
    recursion: { prevent_incoming: true, prevent_outgoing: true, delay_until: null }, effect: { sticky: null, cooldown: null, delay: null },
    content: ['委托来源：' + row.title, '投稿 #' + row.id + ' / 修订 ' + row.revision,
      '署名：' + (row.author_name || '作者未填写署名'), '此条目只记录投稿来源。具体目标、报酬和状态以卡内任务条目及已接任务的固定定义为准。'].join('\n'),
    extra: { __cxx_workshop_source: source } };
  if(!quest) {
    entry.name='[工坊资料]'+row.title;
    if(place)entry.extra.__cxx_workshop_location={mapId,placeId:place.id,title:row.title,templateKind:payload.templateKind || row.type};
    let text;
    if(submitted.templateVersion===Writing.version) text=Writing.sectionsText(submitted.templateKind,submitted.sections);
    else if(payload.templateKind) { const form=WORLD_FIELDS[payload.templateKind];text=form?form.fields.filter(([key])=>payload[key]).map(([key,label])=>label+'：'+payload[key]).join('\n'):payload.description; }
    else if(Array.isArray(payload.worldFactors)) text=payload.worldFactors.map(item=>[String(item.title||''),String(item.content||'')].filter(Boolean).join('：')).join('\n\n');
    else if(row.type==='user_identity') text=['identity','background','appearance','skills'].filter(k=>payload[k]).map(k=>k+'：'+payload[k]).join('\n');
    if(!text)text=JSON.stringify(payload,null,2);
    entry.content=[row.title,place?'地点：'+place.name:'',text,'署名：'+(row.author_name||'未填写署名'),'投稿 #'+row.id+' / 修订 '+row.revision].filter(Boolean).join('\n');
    staticText(entry.content,'世界书正文',40000,true);
  }
  Object.assign(entry.extra,storyMetadata(payload));
  const gameplay=payload.gameplay?Gameplay.compile(payload.gameplay,payload.templateKind,row.id,mapIndex):null;
  const pkg = P.createContentPackage({ id: packageId, version: '1.0.' + row.revision, optional: true, activation: 'opt_in',
    requires: { engine: gameplay||Object.keys(storyMetadata(payload)).length?'1.2.0':'1.0.0', packages: [] }, content: { quests: quest ? [quest] : [], gallery: [], worldbook: [entry],...(gameplay?{gameplay}:{}) } },
  { mapIndex });
  return { format: 1, source, packageSha256: P.sha256(P.canonical(pkg)), package: pkg };
}
function snapshotHash(row, P) {
  return P.sha256(P.canonical({ id: row.id, revision: row.revision, type: row.type, title: row.title, summary: row.summary || '',
    authorName: row.author_name || '', tags: JSON.parse(row.tags || '[]'), payload: JSON.parse(row.payload), publisherId: row.publisher_id }));
}
function library(modulePath) { return require(modulePath || process.env.CXX_FORMAT3_PACKAGES_MODULE || path.resolve(__dirname, "../../工具/发布/packages.cjs")); }
function assertOpen(type,payload={}) {
  if(!Writing.isOpen(type,payload)) fail('该类别暂停新建和改投；历史稿仍可查看、导出或撤回。','submission_type_paused',409);
}
function validateWriting(type,payload) {
  assertOpen(type,payload);
  const form=Writing.byKind(Writing.kindOf(type,payload));
  if(payload.templateVersion!==Writing.version || payload.templateKind!==form.id || payload.format!==form.format)fail('请使用当前分栏投稿模板。','template_version_required');
  fields(payload,['format','templateVersion','templateKind','sections',...(form.id==='contract'?['contract']:['mapId','placeId','keywords',...(form.id==='npc'?['media']:[])])],'投稿正文');
  fields(payload.sections,form.fields.map(f=>f.name),'分栏正文');
  for(const f of form.fields) {
    const v=payload.sections[f.name];
    if(v!==undefined || f.required)staticText(v,f.label[0],f.max,f.required);
    if(f.required && /^(?:待补(?:充)?|待定|同上|略|tbd|todo|n\/a|[.。…\s]+)$/i.test(v.trim()))fail('请补写「'+f.label[0]+'」，不要用占位文字代替正文。');
  }
  if(form.id==='contract') fields(payload.contract,['mapId','placeId','type','difficulty','pay','prerequisites'],'任务参数');
  // 通过现役卡接口再校验一次，包含合并后长度与地图/关键词，避免表单通过却无法入包。
  validateSubmission(type,Writing.toLegacy(type,payload));
  return JSON.parse(JSON.stringify(payload));
}
function validateIncoming(type,payload,metadata) {
  assertOpen(type,payload);
  if(payload.templateVersion!==Writing.version)fail('请将原稿补齐为当前分栏模板后重新提交；原稿不会被自动改写。','template_version_required');
  const out=validateSubmission(type,payload);
  validateMetadata(metadata);
  staticText(metadata.summary,'一句话简介',2000,true);
  return out;
}
function presentation(row) {
  const P=library(), payload=typeof row.payload==='string'?row.payload:JSON.stringify(row.payload);
  const author=row.author_name || row.authorName || '';
  const draft={id:row.id || 100000000,revision:row.revision || 1,publisher_id:row.publisher_id || 'preview-author',
    title:row.title,summary:row.summary || '',author_name:author,tags:typeof row.tags==='string'?row.tags:JSON.stringify(row.tags||[]),payload,content_hash:P.sha256(payload)};
  try {
    const artifact=compile({...draft,type:row.type},{publisher_id:draft.publisher_id,status:'active',display_name_last:author},P);
    const {worldbook,quests}=artifact.package.content;
    const panels=[];
    if(quests.length) {
      const q=quests[0],place=findPlace(q.mapId,q.placeId);
      const labels={fixer:'委托人',type:'类型',difficulty:'难度',brief:'简报',goal:'目标',terms:'条款与收尾',risk:'风险',pay:'报酬（日元）',fixerNote:'委托人备注',deadline:'期限',payNote:'报酬说明',bonus:'额外奖励',unlock:'解锁说明',prerequisites:'前置任务'};
      panels.push({title:'任务详情',text:[draft.title,'地点：'+(place?.name||q.district),...Object.entries(labels).filter(([k])=>q[k]!==undefined&&q[k]!==''&&(!Array.isArray(q[k])||q[k].length)).map(([k,l])=>l+'：'+(Array.isArray(q[k])?q[k].join('、'):q[k]))].join('\n\n')});
      panels.push({title:'模型读取正文',text:Writing.questText(q)});
    } else panels.push({title:'世界书正文',text:worldbook[0].content});
    if(!row.id)for(const panel of panels)panel.text=panel.text.replaceAll('ugc.contract.100000000.01','（提交后分配）').replaceAll('投稿 #100000000 / 修订 1','投稿编号：提交后分配');
    return {templateVersion:JSON.parse(payload).templateVersion||null,panels,delivery:'signed_content',installsAssets:false};
  } catch(e) {
    // 旧自由格式仍能阅读；新格式的编译错误必须交回作者处理。
    const p=JSON.parse(payload);if(p.templateVersion!==undefined)throw e;
    const text=legacyText(p);
    return {legacy:true,panels:[{title:'历史原稿（未转换）',text}],note:'保留历史稿；再次改投需补齐当前模板。'};
  }
}
function legacyText(p) {
  if(!p || typeof p!=='object')return String(p??'');
  return Object.entries(p).map(([k,v])=>k+'：'+(v&&typeof v==='object'?'\n'+legacyText(v):String(v??''))).join('\n\n');
}
module.exports = { TYPES,CONTENT_TYPES,ContractError, validate, validateSubmission, validateIncoming,assertOpen,validateMetadata, staticText, schema, compile, snapshotHash, library,presentation,Writing };
