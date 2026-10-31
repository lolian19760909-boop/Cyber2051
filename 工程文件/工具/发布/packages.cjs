'use strict';
// 纯离线格式 3：不联网、不生成密钥、不调用发布器。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { componentsOf } = require("../lib/runtime-components.cjs");
const RuntimeCore = require("../../卡片源码/运行时/core.js");
const CARD_ID = 'cyber2051', ENGINE_VERSION = '1.0.0', ORIGIN = 'https://cyber2051.top';
const CONSUMED_CHARACTER_IDS = ['tomori', 'anon', 'soyo', 'taki', 'rana', 'sakiko', 'uika', 'mutsumi', 'umiri', 'nyamu'];
const CONSUMED_QUEST_IDS = ['q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10', 'q_heist'];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ID = /^[a-z][a-z0-9._-]{0,95}$/, SHA = /^[a-f0-9]{64}$/;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const fail = message => { throw Error(message); };
const object = (v, label) => (!v || typeof v !== 'object' || Array.isArray(v)) && fail(label + ' 必须是对象');
const array = (v, label) => !Array.isArray(v) && fail(label + ' 必须是数组');
const text = (v, label) => (typeof v !== 'string' || !v.trim()) && fail(label + ' 必须是非空字符串');
const staticText = (v, label) => { if (typeof v === 'string' && /<%|<script\b/i.test(v)) fail(label + ' 只接受静态文本，不执行 EJS/脚本'); };
const version = (v, label) => !SEMVER.test(v || '') && fail(label + ' 必须是完整 x.y.z 版本');
const identifier = (v, label) => (!ID.test(v || '') || forbidden.has(v)) && fail(label + ' 必须是安全的固定小写编号');
const componentId = (v, label) => { text(v, label); if (forbidden.has(v)) fail(label + ' 使用了不安全的固定编号'); };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function canonical(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('不能签名非有限数字'); return JSON.stringify(value); }
  if (!value || typeof value !== 'object') fail('不能签名 undefined 或非 JSON 值');
  if (ancestors.has(value)) fail('不能签名循环引用');
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail('只接受普通 JSON 对象');
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, i) => key !== String(i))) fail('不能签名稀疏数组或额外数组属性');
    result = '[' + value.map(item => canonical(item, ancestors)).join(',') + ']';
  } else result = '{' + Object.keys(value).sort().map(key => {
    if (forbidden.has(key)) fail('拒绝原型污染字段 ' + key);
    return JSON.stringify(key) + ':' + canonical(value[key], ancestors);
  }).join(',') + '}';
  ancestors.delete(value);
  return result;
}
const clone = value => JSON.parse(canonical(value));
function signingBytes(document) {
  object(document, '签名文档');
  const unsigned = { ...document }; delete unsigned.signature;
  return Buffer.from(canonical(unsigned));
}
function edKey(key, privateKey) {
  const parsed = key instanceof crypto.KeyObject ? key : privateKey ? crypto.createPrivateKey(key) : crypto.createPublicKey(key);
  if (parsed.asymmetricKeyType !== 'ed25519' || (privateKey && parsed.type !== 'private')) fail('签名仅支持 Ed25519 密钥');
  return parsed;
}
function signDocument(document, privateKey, keyId) {
  identifier(keyId, 'keyId');
  const result = clone(document); delete result.signature;
  result.signature = { algorithm: 'Ed25519', keyId, value: crypto.sign(null, signingBytes(result), edKey(privateKey, true)).toString('base64') };
  return result;
}
function verifyDocument(document, trustedKeys) {
  canonical(document);
  const s = document.signature;
  if (!s || s.algorithm !== 'Ed25519') fail('缺少 Ed25519 签名');
  identifier(s.keyId, '签名 keyId');
  if (!Object.hasOwn(trustedKeys || {}, s.keyId)) fail('未信任的签名 keyId');
  if (typeof s.value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(s.value)) fail('签名不是 64 字节 base64');
  const bytes = Buffer.from(s.value, 'base64');
  if (bytes.toString('base64') !== s.value || !crypto.verify(null, signingBytes(document), edKey(trustedKeys[s.keyId], false), bytes)) fail('签名校验失败');
  return true;
}
function compareVersion(a, b) {
  version(a, '版本'); version(b, '版本');
  const aa = a.split('.').map(BigInt), bb = b.split('.').map(BigInt);
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] > bb[i] ? 1 : -1;
  return 0;
}
function validateRequires(requires, label) {
  object(requires, label); version(requires.engine, label + '.engine'); array(requires.packages, label + '.packages');
  const seen = new Set();
  for (const dep of requires.packages) {
    object(dep, '依赖'); identifier(dep.id, '依赖 id'); version(dep.version, '依赖 version');
    if (seen.has(dep.id)) fail('重复包依赖 ' + dep.id);
    seen.add(dep.id);
  }
}
function validateHeader(pkg) {
  canonical(pkg); object(pkg, '更新包');
  if (pkg.format !== 3 || pkg.cardId !== CARD_ID) fail('只接受 cyber2051 格式 3 更新包');
  identifier(pkg.id, '更新包 id'); version(pkg.version, '更新包 version');
  if (!['core', 'content', 'component'].includes(pkg.kind)) fail('未知更新包 kind');
  if (typeof pkg.optional !== 'boolean' || (pkg.kind === 'core' && pkg.optional) || (pkg.kind === 'component' && !pkg.optional)) fail('基础程序包不可标为可选，局部组件包必须可选');
  if (pkg.activation !== undefined && !['compatible', 'new_chat', 'opt_in'].includes(pkg.activation)) fail('未知内容启用规则 activation');
  validateRequires(pkg.requires, 'requires');
  if (pkg.kind === 'component' && (compareVersion(pkg.requires.engine, '1.1.0') < 0 || pkg.activation !== undefined && pkg.activation !== 'compatible')) fail('局部组件包须声明1.1.0引擎，不能混入聊天启用规则');
  if (pkg.requires.packages.some(dep => dep.id === pkg.id)) fail('包不能依赖自己');
}
function unique(items, key, label, validator) {
  array(items, label); const seen = new Set();
  items.forEach(item => {
    object(item, label + ' 条目'); validator(item);
    if (seen.has(item[key])) fail(label + ' 固定编号重复 ' + item[key]);
    seen.add(item[key]);
  });
}
function validateWorldbook(entries, contentOnly) {
  unique(entries, 'uid', '世界书', entry => {
    if (!Number.isSafeInteger(entry.uid) || entry.uid < 0) fail('世界书 uid 必须是非负固定整数');
    text(entry.name, '世界书 name');
    if (typeof entry.content !== 'string' || typeof entry.enabled !== 'boolean') fail('世界书 content/enabled 类型不符');
    for (const field of ['strategy', 'position', 'effect', 'recursion']) object(entry[field], '世界书 ' + field);
    if (contentOnly) {
      if (/<%|<script\b/i.test(entry.content) || entry.strategy.type !== 'selective') fail('内容包世界书仅支持按关键词触发的静态文本，不执行 EJS/脚本或常驻人设改写');
      array(entry.strategy.keys, '世界书关键词'); object(entry.strategy.keys_secondary, '世界书次要关键词'); array(entry.strategy.keys_secondary.keys, '世界书次要关键词');
      if ([...entry.strategy.keys, ...entry.strategy.keys_secondary.keys].some(key => typeof key !== 'string')) fail('内容包世界书关键词必须是字符串');
      for (const value of [entry.name, ...entry.strategy.keys, ...entry.strategy.keys_secondary.keys]) staticText(value, '内容包世界书名称或关键词');
    }
  });
}
function validateComponents(components, pkgVersion) {
  object(components, 'components');
  for (const key of ['worldbook', 'regex', 'scripts']) object(components[key], 'components.' + key);
  text(components.worldbook.internalName, '世界书内部名');
  if (!components.worldbook.internalName.endsWith(' ' + pkgVersion)) fail('世界书内部名与包版本不一致');
  validateWorldbook(components.worldbook.entries, false);
  unique(components.regex.scripts, 'id', '正则', regex => {
    componentId(regex.id, '正则 id'); text(regex.script_name, '正则 script_name');
    if (typeof regex.find_regex !== 'string' || typeof regex.replace_string !== 'string') fail('正则必须是助手运行时格式');
    if (typeof regex.enabled !== 'boolean') fail('正则 enabled 必须是布尔值');
    object(regex.source, '正则 source'); object(regex.destination, '正则 destination');
  });
  const ids = new Set();
  function trees(nodes) {
    array(nodes, '助手脚本树');
    nodes.forEach(node => {
      object(node, '助手脚本'); componentId(node.id, '助手脚本 id'); text(node.name, '助手脚本 name');
      if (ids.has(node.id)) fail('助手脚本固定编号重复 ' + node.id);
      ids.add(node.id);
      if (node.type === 'folder') trees(node.scripts);
      else if (node.type !== 'script' || typeof node.content !== 'string' || typeof node.enabled !== 'boolean') fail('助手脚本树格式不符');
    });
  }
  trees(components.scripts.trees);
  if (!components.worldbook.entries.length || !components.regex.scripts.length || !ids.size) fail('基础包三个组件不能为空');
}
function imageUrl(url) {
  text(url, '立绘 url');
  let parsed; try { parsed = new URL(url); } catch { fail('立绘 url 无效'); }
  if (!url.startsWith(ORIGIN + '/img/') || /[<>`\s"'\\]/.test(url) || parsed.origin !== ORIGIN || !parsed.pathname.startsWith('/img/') || parsed.username || parsed.password || parsed.hash || parsed.port) fail('立绘只接受官方 /img/ HTTPS 链接，不含凭据、引号、空白或片段');
}
function questGraph(quests) {
  const byId = new Map(quests.map(quest => [quest.id, quest])), visiting = new Set(), done = new Set();
  function visit(id) {
    if (visiting.has(id)) fail('任务前置条件形成循环，无法解锁 ' + id);
    if (done.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).prerequisites || []) if (byId.has(dependency)) visit(dependency);
    visiting.delete(id); done.add(id);
  }
  byId.forEach((_, id) => visit(id));
}
function validateContent(content, options = {}) {
  object(content, 'content');
  for (const key of Object.keys(content)) if (!['quests', 'gallery', 'worldbook', 'gameplay'].includes(key)) fail('尚无内容消费者: ' + key);
  for (const key of ['quests', 'gallery', 'worldbook']) array(content[key], 'content.' + key);
  if (content.gameplay || content.worldbook.some(e=>e.extra?.__cxx_event_media)) RuntimeCore.validateContent(content, options);
  for(const entry of content.worldbook)require("../../卡片源码/运行时/content.js").validateStoryMetadata(entry);
  if (!content.quests.length && !content.gallery.length && !content.worldbook.length && !content.gameplay) fail('内容包为空');
  const questIds = new Set([...CONSUMED_QUEST_IDS, ...(options.questIds || []), ...content.quests.map(quest => quest.id)]);
  unique(content.quests, 'id', '任务', quest => {
    identifier(quest.id, '任务 id');
    for (const key of ['title', 'fixer', 'district', 'type', 'difficulty', 'brief', 'goal']) text(quest[key], '任务 ' + key);
    if (!Number.isSafeInteger(quest.pay) || quest.pay < 0) fail('任务 pay 必须是非负整数');
    for (const key of ['fixerNote', 'payNote', 'deadline', 'terms', 'risk', 'bonus', 'unlock']) if (quest[key] !== undefined && typeof quest[key] !== 'string') fail('任务 ' + key + ' 必须是文本');
    for (const key of ['title', 'fixer', 'district', 'type', 'difficulty', 'brief', 'goal', 'fixerNote', 'payNote', 'deadline', 'terms', 'risk', 'bonus', 'unlock']) staticText(quest[key], '任务 ' + key);
    if (quest.flagship !== undefined && typeof quest.flagship !== 'boolean') fail('任务 flagship 必须是布尔值');
    if (quest.track !== undefined && !['main', 'side'].includes(quest.track)) fail('任务 track 只能是 main 或 side');
    if (quest.mapId !== undefined || quest.placeId !== undefined) {
      identifier(quest.mapId, '任务 mapId'); identifier(quest.placeId, '任务 placeId');
      if (!Object.hasOwn(options.mapIndex || {}, quest.mapId) || !options.mapIndex[quest.mapId].includes(quest.placeId)) fail('任务引用尚未接入的地图地点');
    }
    if (quest.prerequisites !== undefined) {
      array(quest.prerequisites, '任务 prerequisites'); quest.prerequisites.forEach(id => identifier(id, '前置任务 id'));
      if (quest.prerequisites.includes(quest.id)) fail('任务不能以前置任务引用自己');
      if (new Set(quest.prerequisites).size !== quest.prerequisites.length || quest.prerequisites.some(id => !questIds.has(id))) fail('任务前置编号重复或尚无对应任务消费者');
    }
  });
  unique(content.gallery, 'id', '立绘', image => {
    identifier(image.id, '立绘 id'); identifier(image.characterId, '立绘 characterId');
    if (!['standard', 'daily', 'avatar'].includes(image.category)) fail('立绘 category 未接入');
    imageUrl(image.url);
    if (image.fallbackUrl !== undefined) imageUrl(image.fallbackUrl);
    if (!(options.characterIds || CONSUMED_CHARACTER_IDS).includes(image.characterId)) fail('立绘角色尚无图库消费者');
  });
  questGraph(content.quests);
  validateWorldbook(content.worldbook, true);
}
function validatePackage(pkg, options = {}) {
  validateHeader(pkg);
  if (pkg.kind === 'core') {
    if (Object.hasOwn(pkg, 'content')) fail('基础包不能混入内容包字段');
    validateComponents(pkg.components, pkg.version);
    if (pkg.compatibilityWorldbookIds !== undefined && (!Array.isArray(pkg.compatibilityWorldbookIds) || pkg.compatibilityWorldbookIds.some(uid => !Number.isSafeInteger(uid) || uid < 0) || new Set(pkg.compatibilityWorldbookIds).size !== pkg.compatibilityWorldbookIds.length)) fail('兼容世界书 uid 声明必须为非负固定整数且不能重复');
  } else if (pkg.kind === 'component') {
    if (Object.hasOwn(pkg, 'content')) fail('局部组件包不能混入静态内容');
    RuntimeCore.validateComponentDefinition(pkg.components);
  } else {
    if (Object.hasOwn(pkg, 'components')) fail('内容包不能携带正则或助手脚本');
    if ((pkg.content?.gameplay || pkg.content?.worldbook?.some(e=>e.extra?.__cxx_player_start || e.extra?.__cxx_npc)) && compareVersion(pkg.requires.engine,'1.2.0')<0) fail('正文玩法及新人物出身包须声明1.2.0以上消费者');
    if(pkg.content?.worldbook?.some(e=>e.extra?.__cxx_event_media) && compareVersion(pkg.requires.engine,'1.3.0')<0)fail('事件插画包须声明1.3.0以上消费者');
    validateContent(pkg.content, options);
  }
  if (options.trustedKeys) verifyDocument(pkg, options.trustedKeys);
  return pkg;
}
const packageRelativePath = pkg => `packages/${pkg.id}/${pkg.version}.json`;
const packageUrl = pkg => ORIGIN + '/updates/v3/' + packageRelativePath(pkg);
function validateCatalog(catalog, options = {}) {
  canonical(catalog); object(catalog, '清单');
  if (catalog.format !== 3 || catalog.cardId !== CARD_ID) fail('清单卡身份或格式错误');
  version(catalog.engineVersion, '清单 engineVersion');
  const ids = new Map();
  unique(catalog.packages, 'id', '清单包', entry => {
    validateHeader({ ...entry, format: 3, cardId: CARD_ID });
    if (entry.url !== packageUrl(entry)) fail('更新包 URL 必须使用官方 HTTPS 固定目录与编号');
    if (!SHA.test(entry.sha256 || '') || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) fail('清单缺少有效 hash/bytes');
    ids.set(entry.id, entry);
  });
  const visiting = new Set(), done = new Set();
  function visit(id) {
    if (visiting.has(id)) fail('包依赖形成循环');
    if (done.has(id)) return;
    visiting.add(id); const pkg = ids.get(id);
    if (compareVersion(catalog.engineVersion, pkg.requires.engine) < 0) fail('清单程序版本不足以消费包 ' + id);
    for (const dep of pkg.requires.packages) {
      const target = ids.get(dep.id);
      if (!target || compareVersion(target.version, dep.version) < 0) fail('缺少满足版本的包依赖 ' + dep.id);
      if (!pkg.optional && target.optional) fail('自动基础包不能暗中订阅可选 DLC');
      visit(dep.id);
    }
    visiting.delete(id); done.add(id);
  }
  ids.forEach((_, id) => visit(id));
  if (options.trustedKeys) verifyDocument(catalog, options.trustedKeys);
  return catalog;
}
function createCorePackage(card) {
  canonical(card); object(card.data, 'card.data');
  const d = card.data, v = d.character_version; version(v, '角色卡版本');
  if (!d.name?.endsWith('V' + v) || !d.character_book?.name?.endsWith(' ' + v) || d.extensions?.world !== d.character_book.name) fail('卡名、卡版本、世界书内部名和绑定必须一致');
  return validatePackage(clone({ format: 3, cardId: CARD_ID, id: 'cyber2051.core', version: v, kind: 'core', optional: false,
    requires: { engine: ENGINE_VERSION, packages: [] }, compatibilityWorldbookIds: Object.hasOwn(d.extensions, '__cxx_update_compatibility_worldbook_ids') ? d.extensions.__cxx_update_compatibility_worldbook_ids : [], components: componentsOf(d) }));
}
function createContentPackage(definition, options = {}) {
  if ((definition.format !== undefined && definition.format !== 3) || (definition.cardId !== undefined && definition.cardId !== CARD_ID) || (definition.kind !== undefined && definition.kind !== 'content')) fail('内容定义指定了错误的卡身份或格式');
  const pkg = { ...clone(definition), format: 3, cardId: CARD_ID, kind: 'content' }; delete pkg.signature;
  return validatePackage(pkg, options);
}
function createComponentPackage(definition) {
  if ((definition.format !== undefined && definition.format !== 3) || (definition.cardId !== undefined && definition.cardId !== CARD_ID) || (definition.kind !== undefined && definition.kind !== 'component')) fail('组件定义指定了错误的卡身份或格式');
  const pkg = { ...clone(definition), format: 3, cardId: CARD_ID, kind: 'component' }; delete pkg.signature;
  return validatePackage(pkg);
}
function baselineHashes(components) {
  const hashes = (entries, key) => Object.fromEntries(entries.map(entry => [String(entry[key]), sha256(canonical(entry))]));
  const scripts = [];
  function collect(nodes) { nodes.forEach(node => { scripts.push(node); if (node.type === 'folder') collect(node.scripts); }); }
  collect(components.scripts.trees);
  return { worldbook: hashes(components.worldbook.entries, 'uid'), regex: hashes(components.regex.scripts, 'id'), scripts: hashes(scripts, 'id') };
}
function validateOwnership(packages, registry = null) {
  const componentOwners = new Map();
  for (const pkg of packages) if (['core', 'component'].includes(pkg.kind)) {
    for (const [type, items] of Object.entries({ worldbook: pkg.components?.worldbook?.entries || [], regex: pkg.components?.regex?.scripts || [], scripts: pkg.components?.scripts?.trees || [] })) {
      function visit(list) { for (const item of list) {
        const key = type + ':' + (type === 'worldbook' ? item.uid : item.id), owner = componentOwners.get(key);
        if (owner && owner !== pkg.id) fail('跨包组件编号冲突 ' + key);
        componentOwners.set(key, pkg.id); if (item.type === 'folder') visit(item.scripts);
      } }
      visit(items);
    }
  }
  const records = new Map();
  if (registry) {
    canonical(registry); object(registry, '既有内容清单');
    if (registry.format !== 1) fail('既有内容清单格式错误');
    object(registry.packages, '既有内容清单 packages');
    for (const [id, record] of Object.entries(registry.packages)) {
      identifier(id, '既有包 id'); object(record, '既有包'); version(record.version, '既有包 version');
      object(record.content, '既有包 content');
      for (const key of ['quests', 'gallery', 'worldbook']) array(record.content[key], '既有包 ' + key);
      records.set(id, clone(record));
    }
  }
  for (const pkg of packages) if (pkg.kind === 'content') {
    const previous = records.get(pkg.id);
    if (previous && compareVersion(pkg.version, previous.version) < 0) fail('不能降低已接入内容包版本');
    if (previous && pkg.version === previous.version && (canonical(pkg.content) !== canonical(previous.content) || (pkg.activation || 'compatible') !== (previous.activation || 'compatible') || pkg.optional !== previous.optional)) fail('同版本不能改写已接入内容或启用方式');
    records.set(pkg.id, pkg);
  }
  for (const key of ['quests', 'gallery', ...require("../../卡片源码/运行时/gameplay.js").KINDS.map(k=>'gameplay.'+k)]) {
    const owners = new Map();
    // 旧版本移除的编号仍归原包所有；同包可恢复该编号，另一包不可接管。
    const archived = new Map(Object.entries(registry?.packages || {}));
    for (const [packageId, record] of records) {
      const previous = archived.get(packageId);
      const list=content=>key.startsWith('gameplay.')?content?.gameplay?.[key.slice(9)] || []:content?.[key] || [];
      const collections = [list(record.content),list(previous?.content),...Object.values(previous?.history || {}).map(list),...Object.values(record.history || {}).map(list)];
      for (const item of collections.flat()) {
        identifier(item.id, key + ' 固定编号');
        if (owners.has(item.id) && owners.get(item.id) !== packageId) fail('跨包内容编号冲突 ' + key + '/' + item.id + '：' + owners.get(item.id) + ' 与 ' + packageId);
        owners.set(item.id, packageId);
      }
    }
  }
  questGraph([...records.values()].flatMap(record => record.content.quests));
  return true;
}
function buildRelease({ packages, privateKey, keyId, previousCatalog = null, withdraw = [], ...options }) {
  identifier(keyId, 'keyId');
  const privateParsed = edKey(privateKey, true), trustedKeys = { [keyId]: crypto.createPublicKey(privateParsed) };
  if (previousCatalog) validateCatalog(previousCatalog, { trustedKeys });
  validateOwnership(packages, options.existingRegistry);
  const entries = new Map((previousCatalog?.packages || []).map(entry => [entry.id, clone(entry)])), seen = new Set();
  if(!Array.isArray(withdraw)||new Set(withdraw).size!==withdraw.length)fail('撤回清单须为不重复的包编号');
  for(const id of withdraw){const old=entries.get(id);if(!old||!old.optional||old.kind!=='content'||packages.some(p=>p.id===id))fail('只能撤回已发行的可选纯内容包，且不能同批更新');entries.delete(id);}
  const files = packages.map(pkg => {
    validatePackage(pkg, options);
    if (seen.has(pkg.id)) fail('一次构建不能重复同一包编号');
    seen.add(pkg.id);
    const signed = signDocument(pkg, privateParsed, keyId), bytes = Buffer.from(canonical(signed));
    const entry = { id: pkg.id, version: pkg.version, kind: pkg.kind, optional: pkg.optional, activation: pkg.activation || 'compatible', requires: clone(pkg.requires), url: packageUrl(pkg), sha256: sha256(bytes), bytes: bytes.length };
    const old = entries.get(pkg.id);
    if (old && (old.kind !== entry.kind || old.optional !== entry.optional || compareVersion(entry.version, old.version) < 0)) fail('不能降低版本或更换包的基础/DLC分类');
    if (old && entry.version === old.version && old.sha256 !== entry.sha256) fail('同版本不能改写内容');
    entries.set(pkg.id, entry);
    return { relativePath: packageRelativePath(pkg), bytes, package: signed, entry };
  });
  const engineVersion = [...entries.values()].reduce((version,pkg)=>compareVersion(pkg.requires.engine,version)>0?pkg.requires.engine:version,previousCatalog?.engineVersion || ENGINE_VERSION);
  if (compareVersion(engineVersion, RuntimeCore.ENGINE_VERSION) > 0) fail('当前程序版本不足以生成此能力清单');
  const catalog = signDocument({ format: 3, cardId: CARD_ID, engineVersion, packages: [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)) }, privateParsed, keyId);
  validateCatalog(catalog, { trustedKeys });
  const sameChannel = previousCatalog && (compareVersion(previousCatalog.engineVersion, ENGINE_VERSION) > 0) === (compareVersion(engineVersion, ENGINE_VERSION) > 0);
  return { files, catalog, catalogBytes: Buffer.from(canonical(catalog)), previousCatalogHash: sameChannel ? sha256(canonical(previousCatalog)) : null };
}
function writeRelease(release, outputDirectory) {
  text(outputDirectory, '显式输出目录');
  const base = path.resolve(outputDirectory), manifest = path.join(base, compareVersion(release.catalog.engineVersion, ENGINE_VERSION) > 0 ? 'component-manifest.json' : 'manifest.json');
  let current = null;
  if (fs.existsSync(manifest)) current = sha256(canonical(JSON.parse(fs.readFileSync(manifest, 'utf8'))));
  if (current !== release.previousCatalogHash && current !== sha256(release.catalogBytes)) fail('输出清单已变化或未显式带入旧清单，停止覆盖');
  for (const file of release.files) {
    const destination = path.resolve(base, file.relativePath);
    if (!destination.startsWith(base + path.sep) || file.relativePath !== packageRelativePath(file.package)) fail('输出包路径超出显式目录或与包编号不符');
    if (fs.existsSync(destination) && !fs.readFileSync(destination).equals(file.bytes)) fail('不可变包文件已存在且内容不同');
  }
  for (const file of release.files) {
    const destination = path.join(base, file.relativePath); fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (!fs.existsSync(destination)) fs.writeFileSync(destination, file.bytes, { flag: 'wx', mode: 0o644 });
  }
  fs.mkdirSync(base, { recursive: true });
  const temporary = manifest + '.' + crypto.randomBytes(6).toString('hex') + '.new';
  try { fs.writeFileSync(temporary, release.catalogBytes, { flag: 'wx', mode: 0o644 }); fs.renameSync(temporary, manifest); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return { manifest, packages: release.files.map(file => path.join(base, file.relativePath)) };
}
module.exports = { CARD_ID, ENGINE_VERSION, CONSUMED_CHARACTER_IDS, CONSUMED_QUEST_IDS, canonical, canonicalJson: canonical, signingBytes, sha256, signDocument, verifyDocument,
  compareVersion, validatePackage, validateCatalog, validateOwnership, createCorePackage, createContentPackage, createComponentPackage, baselineHashes, packageRelativePath, packageUrl, buildRelease, writeRelease };
