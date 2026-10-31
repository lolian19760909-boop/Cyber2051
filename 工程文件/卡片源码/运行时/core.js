(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxUpdateCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const CryptoCompat=typeof module==='object'&&module.exports?require('./crypto-compat.js'):root.CxxCrypto;
  const ENGINE_VERSION = '1.4.0';
  const Gameplay = typeof module === 'object' && module.exports ? require('./gameplay.js') : root.CxxGameplay;
  const STAGES = ['worldbook', 'regex', 'registry', 'scripts'];
  const CHARACTERS = ['tomori', 'anon', 'soyo', 'taki', 'rana', 'sakiko', 'uika', 'mutsumi', 'umiri', 'nyamu'];
  const USER_FIELDS = new Set(['enabled', 'disabled', 'data', 'button', 'buttons', 'export_with', 'extra']);
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const put = (obj, key, value) => Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
  function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
  function canonical(value) {
    const seen = new Set();
    function encode(item) {
      if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
      if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
      if (typeof item !== 'object' || item === null || seen.has(item)) fail('invalid-json', '需要有限、无循环的 JSON 数据');
      seen.add(item);
      let result;
      if (Array.isArray(item)) {
        if (Object.keys(item).length !== item.length) fail('invalid-json', 'JSON 数组不能含额外属性');
        const elements = [];
        for (let i = 0; i < item.length; i++) {
          if (!own(item, i)) fail('invalid-json', 'JSON 数组不能含空洞');
          elements.push(encode(item[i]));
        }
        result = '[' + elements.join(',') + ']';
      } else {
        // Helper APIs return plain objects from the parent window's realm.
        const proto = Object.getPrototypeOf(item), ctor = proto && Object.getOwnPropertyDescriptor(proto, 'constructor')?.value;
        if (proto !== null && (Object.getPrototypeOf(proto) !== null || typeof ctor !== 'function' || ctor.prototype !== proto || Function.prototype.toString.call(ctor) !== Function.prototype.toString.call(Object))) fail('invalid-json', '需要普通 JSON 对象');
        result = '{' + Object.keys(item).sort().map(key => {
          if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('invalid-json', '拒绝原型污染字段');
          return JSON.stringify(key) + ':' + encode(item[key]);
        }).join(',') + '}';
      }
      seen.delete(item);
      return result;
    }
    return encode(value);
  }
  const clone = value => JSON.parse(canonical(value));
  const same = (a, b) => a === undefined || b === undefined ? a === b : canonical(a) === canonical(b);
  async function sha256(value, digest) {
    const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonical(value));
    const result = digest ? await digest(bytes) : await CryptoCompat.digest(bytes);
    if (typeof result === 'string') {
      if (!/^[0-9a-f]{64}$/i.test(result)) fail('invalid-digest', 'SHA256 返回值无效');
      return result.toLowerCase();
    }
    const output = result instanceof ArrayBuffer ? new Uint8Array(result) : new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
    if (output.byteLength !== 32) fail('invalid-digest', 'SHA256 返回值长度无效');
    return Array.from(output, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function version(value) {
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.test(value)) fail('invalid-version', '版本须为三段版本号');
    const release = value.split('-', 1)[0], parts = release.split('.').map(Number);
    if (parts.some(number => !Number.isSafeInteger(number))) fail('invalid-version', '版本数字过大');
    const pre = value.length > release.length ? value.slice(release.length + 1).split('.') : [];
    if (pre.some(part => /^\d+$/.test(part) && (part.length > 1 && part[0] === '0' || !Number.isSafeInteger(Number(part))))) fail('invalid-version', '预发行版本数字无效');
    return { parts, pre };
  }
  function compareVersions(a, b) {
    const left = version(a), right = version(b);
    for (let i = 0; i < 3; i++) if (left.parts[i] !== right.parts[i]) return left.parts[i] < right.parts[i] ? -1 : 1;
    if (!left.pre.length || !right.pre.length) return left.pre.length === right.pre.length ? 0 : left.pre.length ? -1 : 1;
    for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
      const x = left.pre[i], y = right.pre[i];
      if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
      if (x === y) continue;
      const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
      if (xn && yn) return Number(x) < Number(y) ? -1 : 1;
      if (xn !== yn) return xn ? -1 : 1;
      return x < y ? -1 : 1;
    }
    return 0;
  }
  function identifier(value, label) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) fail('invalid-id', label + ' 编号无效');
  }
  function signature(doc) {
    if (!object(doc.signature) || doc.signature.algorithm !== 'Ed25519' || typeof doc.signature.value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(doc.signature.value)) fail('invalid-signature', '缺少格式正确的官方签名');
    identifier(doc.signature.keyId, '签名密钥');
  }
  function header(doc, options) {
    if (!object(doc) || doc.format !== 3 || doc.cardId !== (options.cardId || 'cyber2051')) fail('invalid-format', '不是本作品的格式 3 更新');
    canonical(doc); signature(doc); // The host must separately verify the Ed25519 signature.
  }
  function requirements(requires, options) {
    if (!object(requires) || !Array.isArray(requires.packages)) fail('invalid-requirements', '更新包缺少依赖声明');
    version(requires.engine);
    if (compareVersions(options.engineVersion || ENGINE_VERSION, requires.engine) < 0) fail('engine-too-old', '需要更新引擎');
    const seen = new Set();
    for (const dependency of requires.packages) {
      if (!object(dependency)) fail('invalid-requirements', '依赖格式错误');
      identifier(dependency.id, '依赖包'); version(dependency.version);
      if (seen.has(dependency.id)) fail('duplicate-id', '依赖包重复'); seen.add(dependency.id);
      if (options.installed) {
        const installed = options.installed[dependency.id];
        const installedVersion = typeof installed === 'string' ? installed : installed && installed.version;
        if (!installedVersion || compareVersions(installedVersion, dependency.version) < 0) fail('dependency-missing', '缺少依赖包 ' + dependency.id);
      }
    }
  }
  function itemId(item, key) {
    const value = item && item[key];
    if (key === 'uid') { if (!Number.isSafeInteger(value) || value < 0) fail('invalid-id', '世界书 uid 无效'); }
    else identifier(value, key);
    return typeof value + ':' + value;
  }
  function checkList(list, key, visit) {
    if (!Array.isArray(list)) fail('invalid-components', '组件需要数组');
    const seen = new Set();
    for (const item of list) {
      if (!object(item)) fail('invalid-components', '组件条目需要对象');
      const id = itemId(item, key);
      if (seen.has(id)) fail('duplicate-id', '组件编号重复 ' + id); seen.add(id);
      if (visit) visit(item);
    }
  }
  function checkComponents(components, complete, allowEmpty = false) {
    if (!object(components)) fail('invalid-components', '缺少组件');
    for (const key of Object.keys(components)) if (!['worldbook', 'regex', 'scripts'].includes(key)) fail('invalid-components', '未知组件 ' + key);
    if (complete && ['worldbook', 'regex', 'scripts'].some(key => !own(components, key))) fail('invalid-components', '核心包须包含三类组件');
    if (components.worldbook) {
      if (typeof components.worldbook.internalName !== 'string' || !components.worldbook.internalName.trim()) fail('invalid-components', '世界书缺少名称');
      checkList(components.worldbook.entries, 'uid', item => {
        if (typeof item.content !== 'string' || typeof item.name !== 'string' || !item.name.trim() || typeof item.enabled !== 'boolean') fail('invalid-components', '世界书字段类型错误');
        for (const key of ['strategy', 'position', 'effect', 'recursion']) if (!object(item[key])) fail('invalid-components', '世界书缺少 ' + key);
      });
    }
    if (components.regex) checkList(components.regex.scripts, 'id', item => {
      if (typeof item.find_regex !== 'string' || typeof item.replace_string !== 'string' || typeof item.script_name !== 'string' || !item.script_name.trim() || typeof item.enabled !== 'boolean' || !object(item.source) || !object(item.destination)) fail('invalid-components', '正则格式须为助手运行时格式');
    });
    if (components.scripts) {
      const all = new Set();
      function tree(list) { checkList(list, 'id', item => {
        if (all.has(item.id)) fail('duplicate-id', '脚本树编号重复'); all.add(item.id);
        if (item.type === 'folder') tree(item.scripts);
        else if (item.type !== 'script' || typeof item.content !== 'string' || typeof item.enabled !== 'boolean' || typeof item.name !== 'string' || !item.name.trim()) fail('invalid-components', '脚本树格式无效');
      }); }
      tree(components.scripts.trees);
    }
    if (complete && !allowEmpty && (!components.worldbook.entries.length || !components.regex.scripts.length || !components.scripts.trees.length)) fail('invalid-components', '核心包三类组件不能为空');
  }
  function checkContent(content, options) {
    if (!object(content)) fail('invalid-content', '内容包缺少内容');
    for (const key of Object.keys(content)) if (!['quests', 'gallery', 'worldbook', 'gameplay'].includes(key)) fail('invalid-content', '尚未接入该类内容 ' + key);
    for (const key of ['quests', 'gallery', 'worldbook']) if (!Array.isArray(content[key])) fail('invalid-content', '内容清单须包含三个数组');
    if (content.gameplay) {
      if (!Gameplay) fail('engine-too-old', '正文玩法消费者未加载，需要新版角色卡');
      Gameplay.validate(content.gameplay, options);
    }
    if (!content.quests.length && !content.gallery.length && !content.worldbook.length && !Gameplay?.KINDS.some(k=>content.gameplay?.[k]?.length)) fail('invalid-content', '内容包不能为空');
    const questIds = new Set(['q_heist', ...Array.from({ length: 10 }, (_, i) => 'q' + String(i + 1).padStart(2, '0')), ...content.quests.map(quest => quest.id), ...(options.questIds || [])]);
    if (content.quests) checkList(content.quests, 'id', quest => {
      for (const key of ['title', 'fixer', 'district', 'type', 'difficulty', 'brief', 'goal']) if (typeof quest[key] !== 'string' || !quest[key].trim()) fail('invalid-content', '任务缺少 ' + key);
      if (!Number.isSafeInteger(quest.pay) || quest.pay < 0) fail('invalid-content', '任务报酬须为非负整数');
      for (const key of ['fixerNote', 'payNote', 'deadline', 'terms', 'risk', 'bonus', 'unlock']) if (own(quest, key) && typeof quest[key] !== 'string') fail('invalid-content', '任务补充字段须为文本');
      for (const key of ['title', 'fixer', 'district', 'type', 'difficulty', 'brief', 'goal', 'fixerNote', 'payNote', 'deadline', 'terms', 'risk', 'bonus', 'unlock']) if (typeof quest[key] === 'string' && /<%|<script\b/i.test(quest[key])) fail('invalid-content', '任务字段只接受静态文本：' + key);
      if (own(quest, 'flagship') && typeof quest.flagship !== 'boolean') fail('invalid-content', '任务标记须为布尔值');
      if (own(quest, 'track') && !['main', 'side'].includes(quest.track)) fail('invalid-content', '任务主线或支线标记无效');
      if (own(quest, 'mapId') !== own(quest, 'placeId')) fail('invalid-content', '任务地图与地点编号须成对');
      if (own(quest, 'mapId')) {
        identifier(quest.mapId, '地图'); identifier(quest.placeId, '地点');
        if (!own(options.mapIndex || {}, quest.mapId) || !options.mapIndex[quest.mapId].includes(quest.placeId)) fail('invalid-content', '任务引用尚未接入的地图地点');
      }
      if (own(quest, 'prerequisites')) {
        if (!Array.isArray(quest.prerequisites)) fail('invalid-content', '前置任务须为数组');
        if (new Set(quest.prerequisites).size !== quest.prerequisites.length) fail('invalid-content', '前置任务不能重复');
        for (const id of quest.prerequisites) { identifier(id, '前置任务'); if (id === quest.id || !questIds.has(id)) fail('invalid-content', '前置任务没有已接入的任务定义'); }
      }
    });
    const questsById = new Map(content.quests.map(quest => [quest.id, quest])), visitingQuests = new Set(), doneQuests = new Set();
    function visitQuest(id) {
      if (visitingQuests.has(id)) fail('invalid-content', '任务前置条件形成循环');
      if (doneQuests.has(id) || !questsById.has(id)) return;
      visitingQuests.add(id);
      for (const prerequisite of questsById.get(id).prerequisites || []) visitQuest(prerequisite);
      visitingQuests.delete(id); doneQuests.add(id);
    }
    for (const id of questsById.keys()) visitQuest(id);
    if (content.gallery) checkList(content.gallery, 'id', image => {
      identifier(image.characterId, '立绘角色');
      if (!['standard', 'daily', 'avatar'].includes(image.category)) fail('invalid-content', '立绘分类无效');
      let url; try { url = new URL(image.url); } catch (_) { fail('invalid-url', '立绘网址无效'); }
      if (typeof image.url !== 'string' || /[<>`\s'"\\]/.test(image.url) || url.origin !== 'https://cyber2051.top' || !url.pathname.startsWith('/img/') || url.protocol !== 'https:' || url.username || url.password || url.hash || url.port) fail('invalid-url', '立绘必须使用官方图床的 HTTPS 链接');
      if (!(options.characterIds || CHARACTERS).includes(image.characterId)) fail('invalid-content', '立绘角色尚无图库消费者');
    });
    if (content.worldbook) checkList(content.worldbook, 'uid', item => {
      (typeof module==='object' && module.exports ? require('./content.js') : root.CxxContent)?.validateStoryMetadata(item);
      const media=item.extra?.__cxx_event_media;
      if(media && !content.gameplay?.encounters?.find(e=>e.id===media.eventId)?.outcomes?.some(o=>o.id===media.outcomeId))fail('invalid-content','事件插画缺少本包对应的事件结果定义');
      if (typeof item.content !== 'string' || typeof item.name !== 'string' || !item.name.trim() || typeof item.enabled !== 'boolean') fail('invalid-content', '世界书字段类型错误');
      for (const key of ['strategy', 'position', 'effect', 'recursion']) if (!object(item[key])) fail('invalid-content', '世界书缺少 ' + key);
      if (/<%|<script\b/i.test(item.content) || item.strategy.type !== 'selective') fail('invalid-content', '内容包仅支持按关键词触发的静态世界书');
      if (!Array.isArray(item.strategy.keys) || !Array.isArray(item.strategy.keys_secondary?.keys) || [...item.strategy.keys, ...item.strategy.keys_secondary.keys].some(key => typeof key !== 'string')) fail('invalid-content', '内容包世界书关键词须为字符串数组');
      for (const value of [item.name, ...item.strategy.keys, ...item.strategy.keys_secondary.keys]) if (/<%|<script\b/i.test(value)) fail('invalid-content', '内容包世界书名称或关键词只接受静态文本');
    });
  }
  function validatePackage(pack, options = {}) {
    header(pack, options); identifier(pack.id, '更新包'); version(pack.version);
    if (!['core', 'content', 'component'].includes(pack.kind) || typeof pack.optional !== 'boolean' || pack.kind === 'core' && pack.optional || pack.kind === 'component' && !pack.optional) fail('invalid-package', '包类型或订阅范围无效');
    if (own(pack, 'activation') && !['compatible', 'new_chat', 'opt_in'].includes(pack.activation)) fail('invalid-package', '内容启用方式无效');
    requirements(pack.requires, options);
    if (pack.requires.packages.some(dependency => dependency.id === pack.id)) fail('invalid-requirements', '更新包不能依赖自己');
    if (pack.kind === 'core') {
      if (own(pack, 'content')) fail('invalid-package', '核心包不混入内容包'); checkComponents(pack.components, true, pack.release?.protocol === 1);
      if (pack.release && compareVersions(pack.requires.engine, '1.4.0') < 0) fail('engine-too-old', '完整版本包需要1.4.0更新器');
      if (!pack.release && !pack.components.worldbook.internalName.endsWith(' ' + pack.version)) fail('invalid-components', '核心包版本与世界书名称不一致');
    } else if (pack.kind === 'component') {
      if (own(pack, 'content') || own(pack, 'activation') && pack.activation !== 'compatible' || compareVersions(pack.requires.engine, '1.1.0') < 0) fail('invalid-package', '局部组件包须声明1.1.0引擎，不混入静态内容或聊天启用规则');
      validateComponentDefinition(pack.components);
    } else {
      if (own(pack, 'components')) fail('invalid-package', '内容包不允许更换脚本或正则');
      if ((pack.content?.gameplay || pack.content?.worldbook?.some(e=>e.extra?.__cxx_player_start || e.extra?.__cxx_npc)) && compareVersions(pack.requires.engine, '1.2.0') < 0) fail('engine-too-old', '正文玩法及新人物出身包须声明1.2.0以上消费者');
      if(pack.content?.worldbook?.some(e=>e.extra?.__cxx_event_media) && compareVersions(pack.requires.engine,'1.3.0')<0)fail('engine-too-old','事件插画包须声明1.3.0以上消费者');
      checkContent(pack.content, options);
    }
    return pack;
  }
  function validateCatalog(catalog, options = {}) {
    header(catalog, options); version(catalog.engineVersion);
    if (!Array.isArray(catalog.packages)) fail('invalid-catalog', '缺少包清单');
    const ids = new Set();
    const byId = new Map();
    for (const pack of catalog.packages) {
      if (!object(pack)) fail('invalid-catalog', '包清单条目无效'); identifier(pack.id, '更新包'); version(pack.version);
      if (ids.has(pack.id)) fail('duplicate-id', '清单包编号重复'); ids.add(pack.id);
      byId.set(pack.id, pack);
      if (!['core', 'content', 'component'].includes(pack.kind) || typeof pack.optional !== 'boolean' || pack.kind === 'core' && pack.optional || pack.kind === 'component' && (!pack.optional || compareVersions(pack.requires?.engine, '1.1.0') < 0)) fail('invalid-catalog', '清单包类型无效');
      if (own(pack, 'activation') && !['compatible', 'new_chat', 'opt_in'].includes(pack.activation)) fail('invalid-catalog', '清单启用方式无效');
      if (!/^[0-9a-f]{64}$/.test(pack.sha256) || !Number.isSafeInteger(pack.bytes) || pack.bytes <= 0) fail('invalid-catalog', '清单文件校验信息无效');
      requirements(pack.requires, { engineVersion: options.engineVersion || catalog.engineVersion });
      let url; try { url = new URL(pack.url); } catch (_) { fail('invalid-url', '更新包网址无效'); }
      if (url.origin !== (options.allowedOrigin || 'https://cyber2051.top') || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/updates/v3/packages/' + pack.id + '/' + pack.version + '.json') fail('invalid-url', '更新包必须来自固定官方发布路径');
    }
    const visiting = new Set(), done = new Set();
    function visit(id) {
      if (visiting.has(id)) fail('dependency-cycle', '更新包依赖形成循环');
      if (done.has(id)) return;
      visiting.add(id); const pack = byId.get(id);
      for (const dep of pack.requires.packages) {
        const target = byId.get(dep.id);
        if (!target || compareVersions(target.version, dep.version) < 0) fail('dependency-missing', '清单缺少满足版本的依赖');
        if (!pack.optional && target.optional) fail('invalid-requirements', '自动内容不能暗中订阅可选包');
        visit(dep.id);
      }
      visiting.delete(id); done.add(id);
    }
    for (const id of ids) visit(id);
    return catalog;
  }
  function owned(value) {
    if (Array.isArray(value)) return value.map(owned);
    if (!object(value)) return value;
    const result = {};
    for (const key of Object.keys(value)) if (!USER_FIELDS.has(key)) put(result, key, owned(value[key]));
    return result;
  }
  // 基线摘要只用于判断这个字段还是不是出厂内容，不需要完整 256 位。
  // 存前 16 位（64 bit）就够：2.3.16 实测基线里 10,904 个摘要，截断省下约 500KB。
  const shortDigest = value => String(value).slice(0, 16);
  const digestEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length > 0 && b.length > 0 && (a === b || a.startsWith(b) || b.startsWith(a));
  async function descriptor(value, digest) {
    const result = { hash: shortDigest(await sha256(canonical(owned(value)), digest)) };
    if (object(value)) {
      result.fields = {};
      for (const key of Object.keys(value)) if (!USER_FIELDS.has(key)) put(result.fields, key, await descriptor(value[key], digest));
    }
    return result;
  }
  async function listSeeds(list, key, digest) {
    const result = { order: [], records: {} }; checkList(list, key);
    for (const item of list) {
      const id = itemId(item, key); result.order.push(id);
      const seed = await descriptor(item, digest);
      // These hashes only guard upstream deletion. They are never update-owned
      // fields, and script data is excluded to avoid self-referential baselines.
      seed.retained = {};
      for (const field of USER_FIELDS) if (field !== 'data' && own(item, field)) put(seed.retained, field, shortDigest(await sha256(canonical(item[field]), digest)));
      if (Array.isArray(item.scripts) && item.type === 'folder') seed.children = await listSeeds(item.scripts, 'id', digest);
      put(result.records, id, seed);
    }
    return result;
  }
  async function fingerprints(components, digest) {
    const result = { format: 1 };
    if (components.worldbook) result.worldbook = { metadata: await descriptor({ internalName: components.worldbook.internalName }, digest), entries: await listSeeds(components.worldbook.entries, 'uid', digest) };
    if (components.regex) result.regex = { scripts: await listSeeds(components.regex.scripts, 'id', digest) };
    if (components.scripts) result.scripts = { trees: await listSeeds(components.scripts.trees, 'id', digest) };
    return result;
  }
  async function mergeComponents(baseline, current, incoming, options = {}) {
    const digest = options.digest;
    const seeds = baseline && baseline.format === 1 ? baseline : await fingerprints(baseline || {}, digest);
    const conflicts = [], counts = { added: 0, updated: 0, deleted: 0, kept: 0 }, components = clone(current);
    const conflict = (component, id, path, reason) => conflicts.push({ component, id, path, reason });
    async function deletable(seed, item) {
      if (item.data && Object.keys(item.data).length > 0) return false;
      if (!digestEqual(await sha256(canonical(owned(item)), digest), seed.hash)) return false;
      for (const field of USER_FIELDS) {
        if (field === 'data') continue;
        const existed = own(seed.retained || {}, field);
        if (existed !== own(item, field)) return false;
        if (existed && !digestEqual(await sha256(canonical(item[field]), digest), seed.retained[field])) return false;
      }
      if (seed.children) for (const child of item.scripts) {
        const childSeed = seed.children.records[itemId(child, 'id')];
        if (!childSeed || !await deletable(childSeed, child)) return false;
      }
      return true;
    }
    async function mergeFields(seed, local, remote, component, id, path) {
      const result = clone(local);
      for (const key of Object.keys(remote)) {
        if (key === 'scripts' && remote.type === 'folder') continue;
        if (USER_FIELDS.has(key) && own(local, key)) continue;
        const nextPath = path ? path + '.' + key : key, old = seed && seed.fields && seed.fields[key];
        if (!own(local, key)) {
          if (old) conflict(component, id, nextPath, 'local-field-deleted'); else put(result, key, clone(remote[key]));
        } else if (USER_FIELDS.has(key) || same(local[key], remote[key])) {
          // Retain the current user's enabled state, script data and buttons.
        } else if (old && old.fields && object(local[key]) && object(remote[key])) {
          put(result, key, await mergeFields(old, local[key], remote[key], component, id, nextPath));
        } else if (old && digestEqual(await sha256(canonical(owned(local[key])), digest), old.hash)) {
          put(result, key, clone(remote[key]));
        } else conflict(component, id, nextPath, old ? 'both-changed' : 'local-field-collision');
      }
      if (remote.type === 'folder' && Array.isArray(local.scripts)) put(result, 'scripts', await mergeList(seed && seed.children, local.scripts, remote.scripts, 'id', component, id + '.scripts'));
      return result;
    }
    async function mergeList(seedList, local, remote, key, component, path) {
      checkList(local, key); checkList(remote, key);
      const remoteById = new Map(remote.map(item => [itemId(item, key), item])), localIds = new Set(), result = [];
      for (const item of local) {
        const id = itemId(item, key); localIds.add(id);
        const seed = seedList && seedList.records[id], next = remoteById.get(id);
        if (next) {
          if (item.type !== next.type && (item.type === 'script' || item.type === 'folder' || next.type === 'script' || next.type === 'folder')) {
            result.push(clone(item)); counts.kept++; conflict(component, item[key], path, 'script-node-type-changed'); continue;
          }
          if (seed) {
            const merged = await mergeFields(seed, item, next, component, item[key], path);
            result.push(merged); counts[same(item, merged) ? 'kept' : 'updated']++;
          } else { result.push(clone(item)); counts.kept++; if (!same(item, next)) conflict(component, item[key], path, 'unowned-id-collision'); }
        } else if (!seed) { result.push(clone(item)); counts.kept++; }
        else {
          // Data is intentionally not fingerprinted. A nonempty script data bag
          // makes upstream deletion unsafe, so retain it instead of guessing.
          if (await deletable(seed, item)) counts.deleted++;
          else { result.push(clone(item)); counts.kept++; conflict(component, item[key], path, 'deleted-upstream-local-dirty'); }
        }
      }
      for (const item of remote) if (!localIds.has(itemId(item, key))) {
        const id = itemId(item, key);
        if (seedList && own(seedList.records, id)) conflict(component, item[key], path, 'local-item-deleted');
        else { result.push(clone(item)); counts.added++; }
      }
      return result;
    }
    if (incoming.worldbook) {
      if (!current.worldbook) components.worldbook = clone(incoming.worldbook);
      else {
        const metadata = await mergeFields(seeds.worldbook && seeds.worldbook.metadata, current.worldbook, { internalName: incoming.worldbook.internalName }, 'worldbook', 'metadata', '');
        metadata.entries = await mergeList(seeds.worldbook && seeds.worldbook.entries, current.worldbook.entries, incoming.worldbook.entries, 'uid', 'worldbook', ''); components.worldbook = metadata;
      }
    }
    if (incoming.regex) components.regex = { ...(current.regex || {}), scripts: await mergeList(seeds.regex && seeds.regex.scripts, current.regex ? current.regex.scripts : [], incoming.regex.scripts, 'id', 'regex', '') };
    if (incoming.scripts) components.scripts = { ...(current.scripts || {}), trees: await mergeList(seeds.scripts && seeds.scripts.trees, current.scripts ? current.scripts.trees : [], incoming.scripts.trees, 'id', 'scripts', '') };
    return { components, conflicts, counts };
  }
  const COMPONENT_TYPES = ['worldbook', 'regex', 'scripts'];
  const componentItems = (components, type) => type === 'worldbook' ? components.worldbook?.entries || [] : type === 'regex' ? components.regex?.scripts || [] : components.scripts?.trees || [];
  const componentListSeed = (baseline, type) => type === 'worldbook' ? baseline.worldbook?.entries : type === 'regex' ? baseline.regex?.scripts : baseline.scripts?.trees;
  const componentKey = (type, id) => itemId({ [type === 'worldbook' ? 'uid' : 'id']: id }, type === 'worldbook' ? 'uid' : 'id');
  function validateComponentDefinition(components) {
    canonical(components);
    if (!object(components) || !Object.keys(components).length) fail('invalid-components', '局部组件包至少提供一类组件');
    const normalized = clone(components);
    if (own(normalized, 'worldbook')) {
      if (!object(normalized.worldbook) || Object.keys(normalized.worldbook).some(key => key !== 'entries')) fail('invalid-components', '局部世界书只提供entries，不替换宿主世界书名');
      normalized.worldbook.internalName = 'component-local';
    }
    checkComponents(normalized, false);
    for (const type of Object.keys(normalized)) {
      if (!object(normalized[type]) || !componentItems(normalized, type).length) fail('invalid-components', '已提供的组件类别不能为空；不管理的类别请省略');
      const listKey = type === 'worldbook' ? 'entries' : type === 'regex' ? 'scripts' : 'trees';
      if (Object.keys(components[type]).some(key => key !== listKey)) fail('invalid-components', '局部组件类别含未知字段');
    }
    for (const script of componentItems(normalized, 'scripts')) if (script.type !== 'script' || own(script, 'scripts') || !script.content.trim() || !object(script.data)) fail('invalid-components', '本版局部组件只接受顶层脚本及其data，不接管文件夹');
    return components;
  }
  function componentIndex(snapshot, type) {
    const result = new Map();
    function walk(items, top) {
      for (const item of items) {
        const id = type === 'worldbook' ? item.uid : item.id, key = componentKey(type, id);
        if (result.has(key)) fail('duplicate-id', '宿主组件编号重复');
        result.set(key, { item, top });
        if (type === 'scripts' && item.type === 'folder') walk(item.scripts, false);
      }
    }
    walk(componentItems(snapshot, type), true); return result;
  }
  function reservedCoreIds(baseline, type) {
    const ids = new Set();
    function walk(list) { for (const [key, seed] of Object.entries(list?.records || {})) { ids.add(key); if (seed.children) walk(seed.children); } }
    walk(componentListSeed(baseline, type)); return ids;
  }
  function componentSlice(snapshot, owners) {
    return { worldbook: { internalName: snapshot.worldbook.internalName, entries: snapshot.worldbook.entries.filter(x => owners.worldbook.includes(x.uid)) },
      regex: { scripts: snapshot.regex.scripts.filter(x => owners.regex.includes(x.id)) }, scripts: { trees: snapshot.scripts.trees.filter(x => owners.scripts.includes(x.id)) } };
  }
  function checkComponentRecords(state) {
    if (!object(state.installed) || state.baseline?.format !== 1 || own(state, 'componentPackages') && !object(state.componentPackages)) fail('invalid-component-ledger', '安装基线或组件账本缺失');
    const records = state.componentPackages || {};
    for (const [id, record] of Object.entries(records)) {
      identifier(id, '组件包'); version(record.version);
      if (!/^[a-f0-9]{64}$/.test(record.sha256) || record.baseline?.format !== 1 || !object(record.owners) || !object(record.lastWritten) || !object(record.requires) || state.installed[id]?.version !== record.version || state.installed[id]?.sha256 !== record.sha256) fail('invalid-component-ledger', '组件账本与安装版本不一致');
      checkComponents({ ...record.lastWritten, worldbook: { ...record.lastWritten.worldbook, internalName: 'component-local' } }, false);
      for (const type of COMPONENT_TYPES) {
        if (!Array.isArray(record.owners[type])) fail('invalid-component-ledger', '组件账本缺少归属');
        const ids = record.owners[type].map(id => componentKey(type, id)), seeds = componentListSeed(record.baseline, type)?.records || {};
        if (new Set(ids).size !== ids.length || !same([...ids].sort(), Object.keys(seeds).sort()) || Object.values(seeds).some(seed => !/^[a-f0-9]{16,64}$/.test(seed.hash))) fail('invalid-component-ledger', '组件归属与基线不一致');
        for (const key of componentIndex(record.lastWritten, type).keys()) if (!ids.includes(key)) fail('invalid-component-ledger', '写入记录包含无归属组件');
      }
    }
    return records;
  }
  function guardComponentOwners(before, state, packageId, owners, previous) {
    for (const type of COMPONENT_TYPES) {
      const coreIds = reservedCoreIds(state.baseline, type), current = componentIndex(before, type);
      for (const id of owners[type]) {
        const key = componentKey(type, id);
        if (coreIds.has(key)) fail('component-id-collision', '局部组件不能接管基础组件：' + id);
        for (const [otherId, record] of Object.entries(state.componentPackages || {})) if (otherId !== packageId && record.owners[type].includes(id)) fail('component-id-collision', '组件编号属于另一包：' + id);
        if (!previous?.owners[type].includes(id) && current.has(key)) fail('component-id-collision', '组件编号属于玩家或未登记内容：' + id);
        if (type === 'scripts' && current.has(key) && (!current.get(key).top || current.get(key).item.type !== 'script')) fail('component-moved', '已拥有脚本移动到文件夹或变成其他类型，请先核查：' + id);
      }
    }
  }
  function assertCoreComponentOwnership(state, incoming) {
    for (const type of COMPONENT_TYPES) {
      const ids = componentIndex(incoming, type);
      for (const record of Object.values(state.componentPackages || {})) for (const id of record.owners?.[type] || []) if (ids.has(componentKey(type, id))) fail('component-id-collision', '基础更新不能接管可选组件编号：' + id);
    }
  }
  async function planComponentInstall({ pack, sha256: hash, before, state, digest }) {
    // Signature and byte hash are verified by the caller before planning; clone
    // here so a later UI edit cannot mutate the planned target across awaits.
    before = clone(before); state = clone(state); pack = clone(pack);
    validatePackage(pack, { installed: state.installed });
    if (pack.kind !== 'component' || !/^[a-f0-9]{64}$/.test(hash)) fail('invalid-component-package', '需要已验证的组件包与文件哈希');
    const records = checkComponentRecords(state), previous = records[pack.id];
    if (previous) {
      const order = compareVersions(pack.version, previous.version);
      if (order < 0) fail('downgrade', '不能降级已安装组件');
      if (order === 0 && hash !== previous.sha256) fail('version-collision', '同版本组件文件已变化');
    } else if (own(state.installed, pack.id)) fail('component-id-collision', '这个包编号已用于其他安装类型');
    const owners = Object.fromEntries(COMPONENT_TYPES.map(type => [type, [...new Set([...(previous?.owners[type] || []), ...componentItems(pack.components, type).map(x => type === 'worldbook' ? x.uid : x.id)])]]));
    guardComponentOwners(before, state, pack.id, owners, previous);
    if (previous?.sha256 === hash) return { before, after: clone(before), installed: state.installed, componentPackages: records, conflicts: [], noop: true };
    const incoming = clone(pack.components);
    if (incoming.worldbook) incoming.worldbook.internalName = before.worldbook.internalName;
    const merged = await mergeComponents(previous?.baseline || { format: 1 }, before, incoming, { digest });
    const baseline = clone(previous?.baseline || { format: 1 }), fresh = await fingerprints(incoming, digest);
    for (const type of Object.keys(incoming)) {
      // Keep reservations and original deletion baselines for removed or locally
      // deleted IDs until the package has been completely uninstalled.
      const oldList = componentListSeed(baseline, type), nextList = componentListSeed(fresh, type);
      if (oldList) { nextList.records = { ...oldList.records, ...nextList.records }; nextList.order = [...new Set([...oldList.order, ...nextList.order])]; }
      baseline[type] = fresh[type];
    }
    const record = { ...previous, version: pack.version, sha256: hash, signatureKeyId: pack.signature.keyId, requires: clone(pack.requires), owners, baseline,
      lastWritten: componentSlice(merged.components, owners), status: 'installed' };
    records[pack.id] = record;
    return { before, after: merged.components, installed: { ...state.installed, [pack.id]: { version: pack.version, sha256: hash, kind: 'component', requires: clone(pack.requires) } },
      componentPackages: records, conflicts: merged.conflicts, noop: false };
  }
  async function planComponentUninstall({ packageId, version: expectedVersion, sha256: expectedHash, before, state, digest }) {
    before = clone(before); state = clone(state); const records = checkComponentRecords(state), previous = records[packageId];
    if (!previous || previous.version !== expectedVersion || previous.sha256 !== expectedHash) fail('component-version-changed', '组件版本已变化，请重新查看后卸载');
    for (const [id, record] of Object.entries(state.installed)) if (id !== packageId && record.requires?.packages?.some(dep => dep.id === packageId)) fail('component-dependent', '仍有已安装内容依赖此组件：' + id);
    guardComponentOwners(before, state, packageId, previous.owners, previous);
    const empty = { worldbook: { internalName: before.worldbook.internalName, entries: [] }, regex: { scripts: [] }, scripts: { trees: [] } }, conflicts = [];
    for (const type of COMPONENT_TYPES) {
      const current = componentIndex(before, type), last = componentIndex(previous.lastWritten, type);
      for (const id of previous.owners[type]) {
        const key = componentKey(type, id), item = current.get(key)?.item;
        if (item && !same(item, last.get(key)?.item)) { componentItems(empty, type).push(clone(item)); conflicts.push({ component: type, id, reason: 'changed-since-last-write' }); }
      }
    }
    const merged = await mergeComponents(previous.baseline, before, empty, { digest });
    const remaining = componentSlice(merged.components, previous.owners), complete = COMPONENT_TYPES.every(type => !componentItems(remaining, type).length);
    if (complete) { delete records[packageId]; delete state.installed[packageId]; }
    else previous.status = 'retained-conflicts';
    return { before, after: merged.components, installed: state.installed, componentPackages: records, conflicts: [...conflicts, ...merged.conflicts], complete, noop: false };
  }
  function mergeRegistry(registry, pack, options = {}) {
    if (pack.kind !== 'content') fail('invalid-content', '只能把内容包装入内容清单');
    validatePackage(pack, { ...options, installed: { ...(options.installed || {}), ...((registry && registry.packages) || {}) } });
    const result = registry ? clone(registry) : { format: 1, packages: {} };
    if (result.format !== 1 || !object(result.packages)) fail('invalid-registry', '本地内容清单格式错误');
    if (pack.optional && !(options.subscriptions || []).includes(pack.id)) return { registry: result, skipped: true, reason: 'not-subscribed' };
    const previous = result.packages[pack.id];
    if (previous && compareVersions(pack.version, previous.version) < 0) fail('downgrade', '不自动安装旧版内容包');
    if (previous && pack.version === previous.version) {
      if (!same(pack.content, previous.content) || (pack.activation || 'compatible') !== (previous.activation || 'compatible') || pack.optional !== previous.optional) fail('version-collision', '同一版本的内容或启用方式发生变化');
      return { registry: result, skipped: true, reason: 'already-installed' };
    }
    const history = previous && previous.history ? clone(previous.history) : {};
    const historyActivation = previous && previous.historyActivation ? clone(previous.historyActivation) : {};
    if (previous) { put(history, previous.version, clone(previous.content)); put(historyActivation, previous.version, previous.activation || 'compatible'); }
    put(result.packages, pack.id, { version: pack.version, optional: pack.optional, activation: pack.activation || 'compatible', content: clone(pack.content), history, historyActivation });
    return { registry: result, skipped: false };
  }
  function contextMatches(actual, expected) { return !!actual && actual.cardId === expected.cardId && actual.characterKey === expected.characterKey && actual.chatId === expected.chatId; }
  async function checkContext(host, expected) {
    const context = await host.getContext();
    if (!contextMatches(context, expected)) fail('context-changed', '已切换角色卡或聊天，停止写入');
    if (context.busy) fail('busy', '正在生成或写变量，稍后再安装');
  }
  function journalKey(options) { return options.key || 'cxx-update-journal'; }
  function validContext(value) { return object(value) && ['cardId', 'characterKey', 'chatId'].every(key => typeof value[key] === 'string' && value[key].length > 0); }
  async function readJournal(storage, key) { return await storage.get(key) || null; }
  async function saveJournal(storage, key, journal) {
    const current = await readJournal(storage, key);
    if (!current || current.id !== journal.id) fail('stale-journal', '安装记录已被新实例处理');
    // The host repeats this owner check inside one IDB readwrite transaction.
    if (await storage.set(key, clone(journal), { expectedId: journal.id }) === false) fail('stale-journal', '安装记录已被新实例处理');
  }
  async function execute(options) {
    const { host, storage, before, after } = options, key = journalKey(options);
    // Transactions carry only their owned component domains. Older full snapshots
    // naturally retain the full comparison and recovery contract.
    const fields = STAGES.filter(stage => own(before, stage));
    if (!fields.length || !same(Object.keys(before).sort(), Object.keys(after).sort()) || Object.keys(before).some(stage => !STAGES.includes(stage))) fail('invalid-snapshot', '事务快照的组件范围不一致');
    if (!validContext(options.expectedContext)) fail('invalid-context', '需要作品、角色卡实例和聊天标识');
    if (typeof storage.claim !== 'function') fail('storage-capability', '需要原子占用安装记录的持久存储');
    if (await readJournal(storage, key)) fail('transaction-pending', '已有安装事务需要先恢复');
    await checkContext(host, options.expectedContext);
    if (!same(await host.snapshot(undefined, fields), before)) fail('snapshot-changed', '预览后组件已被修改，重新检查');
    await checkContext(host, options.expectedContext);
    const stages = fields.filter(stage => !same(before[stage], after[stage]));
    const id = options.id || CryptoCompat.uuid();
    const journal = { format: 2, id, context: clone(options.expectedContext), before: clone(before), after: clone(after), stages, attempted: [], completed: [], installed: clone(options.installed || {}), commitAttempted: false, status: 'prepared' };
    if (!await storage.claim(key, clone(journal))) fail('transaction-raced', '另一窗口正在安装');
    try {
      for (const stage of stages) {
        await checkContext(host, journal.context);
        const expected = clone(before);
        for (const written of journal.completed) put(expected, written, clone(after[written]));
        if (!same(await host.snapshot(undefined, fields), expected)) fail('snapshot-changed', '安装期间组件已被修改');
        await checkContext(host, journal.context);
        journal.status = 'applying'; journal.attempted.push(stage); await saveJournal(storage, key, journal);
        await checkContext(host, journal.context);
        // Host compares expectedCurrent immediately before its own API call.
        // scripts is last: its call can destroy this iframe before returning.
        await host.writeStage(stage, clone(after[stage]), clone(expected));
        await checkContext(host, journal.context);
        journal.completed.push(stage); await saveJournal(storage, key, journal);
      }
      journal.status = 'awaiting-verification'; await saveJournal(storage, key, journal);
      return { status: journal.status, journal: clone(journal) };
    } catch (error) {
      if (error.code === 'stale-journal') return { status: 'superseded' };
      journal.status = 'interrupted'; journal.errorCode = error.code || 'host-write-failed';
      try { await saveJournal(storage, key, journal); }
      catch (saveError) { if (saveError.code === 'stale-journal') return { status: 'superseded' }; throw saveError; }
      return { status: 'interrupted', errorCode: journal.errorCode, journal: clone(journal) };
    }
  }
  async function recover(options) {
    const { host, storage } = options, key = journalKey(options), journal = await readJournal(storage, key);
    if (!journal) return { status: 'none' };
    if (![1, 2].includes(journal.format) || !validContext(journal.context) || typeof journal.id !== 'string' || !object(journal.before) || !object(journal.after) || !Array.isArray(journal.stages) || !Array.isArray(journal.attempted) || !Array.isArray(journal.completed) || journal.stages.some(stage => !STAGES.includes(stage)) || new Set(journal.stages).size !== journal.stages.length || journal.attempted.some(stage => !journal.stages.includes(stage)) || new Set(journal.attempted).size !== journal.attempted.length || journal.completed.some(stage => !journal.attempted.includes(stage)) || new Set(journal.completed).size !== journal.completed.length) fail('invalid-journal', '安装记录损坏');
    const fields = STAGES.filter(stage => own(journal.before, stage));
    if (!fields.length || !same(Object.keys(journal.before).sort(), Object.keys(journal.after).sort()) || Object.keys(journal.before).some(stage => !STAGES.includes(stage)) || journal.stages.some(stage => !fields.includes(stage))) fail('invalid-journal', '安装记录的组件范围不一致');
    try { await checkContext(host, journal.context); } catch (error) { return { status: 'deferred', errorCode: error.code }; }
    let actual;
    try { actual = await host.snapshot(undefined, fields); await checkContext(host, journal.context); }
    catch (error) { return { status: 'deferred', errorCode: error.code || 'snapshot-failed' }; }
    if (same(actual, journal.after)) {
      // Actual verification also covers attempted writes whose promises never
      // returned because script replacement destroyed the old iframe.
      // Persist intent first: the ledger can reach disk even if its reply is lost.
      journal.format = 2; journal.commitAttempted = true; await saveJournal(storage, key, journal);
      if (await storage.set(options.installedKey || key + ':installed', clone(journal.installed), { expectedId: journal.id }) === false) return { status: 'needs-review', reason: 'installed-write-not-confirmed' };
      try {
        const installed = await storage.get(options.installedKey || key + ':installed');
        await checkContext(host, journal.context);
        const verified = await host.snapshot(undefined, fields); await checkContext(host, journal.context);
        if (!same(installed, journal.installed)) return { status: 'needs-review', reason: 'installed-readback-mismatch' };
        if (!same(verified, journal.after)) return { status: 'needs-review', reason: 'components-changed-after-ledger-write' };
      } catch (error) { return { status: 'deferred', errorCode: error.code || 'installed-readback-failed' }; }
      journal.status = 'committed'; await saveJournal(storage, key, journal);
      if (await storage.remove(key, { expectedId: journal.id }) !== true) return { status: 'needs-review', reason: 'journal-cleanup-not-confirmed' };
      return { status: 'committed', installed: clone(journal.installed) };
    }
    if (journal.format !== 2 || journal.commitAttempted !== false) return { status: 'needs-review', reason: journal.format === 2 && journal.commitAttempted === true ? 'components-changed-after-commit-attempt' : 'legacy-unmarked-commit-status' };
    const written = [];
    for (const stage of journal.stages) {
      if (same(actual[stage], journal.before[stage])) continue;
      if (journal.attempted.includes(stage) && same(actual[stage], journal.after[stage])) written.push(stage);
      else return { status: 'needs-review', reason: 'local-changes-after-interruption', stage };
    }
    for (const stage of fields) if (!journal.stages.includes(stage) && !same(actual[stage], journal.before[stage])) return { status: 'needs-review', reason: 'unrelated-component-changed', stage };
    const rollbackOrder = STAGES.filter(stage => written.includes(stage) && stage !== 'scripts').reverse();
    if (written.includes('scripts')) rollbackOrder.push('scripts');
    journal.status = 'rolling-back'; await saveJournal(storage, key, journal);
    try {
      for (const stage of rollbackOrder) {
        await checkContext(host, journal.context);
        if (!same(await host.snapshot(undefined, fields), actual)) fail('snapshot-changed', '恢复期间又出现修改');
        await checkContext(host, journal.context);
        journal.rollbackAttempted = stage; await saveJournal(storage, key, journal); await checkContext(host, journal.context);
        await host.writeStage(stage, clone(journal.before[stage]), clone(actual)); await checkContext(host, journal.context);
        put(actual, stage, clone(journal.before[stage]));
      }
      const verified = await host.snapshot(undefined, fields); await checkContext(host, journal.context);
      if (!same(verified, journal.before)) fail('snapshot-changed', '恢复结果与备份不同');
      if (await storage.remove(key, { expectedId: journal.id }) !== true) return { status: 'needs-review', reason: 'journal-cleanup-not-confirmed' };
      return { status: 'rolled-back' };
    } catch (error) { return { status: 'deferred', errorCode: error.code || 'rollback-failed' }; }
  }
  return { ENGINE_VERSION, STAGES: STAGES.slice(), canonical, canonicalJson: canonical, sha256, compareVersions, validateCatalog, validatePackage, validateContent: checkContent, validateComponentDefinition, fingerprints, mergeComponents, assertCoreComponentOwnership, planComponentInstall, planComponentUninstall, mergeRegistry, execute, recover };
});
