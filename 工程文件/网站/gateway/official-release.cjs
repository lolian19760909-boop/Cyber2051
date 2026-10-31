'use strict';
// 官方格式 3 发布候选。配置、签名密钥和输出目录只由服务器提供。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const UPDATER_ID = 'cf33c692-7a41-444d-b8b7-6a70163e0104';
const BASE_ID = 'cyber2051.base-content';
const PREVIEW_TTL = 15 * 60 * 1000;
const MAX_BODY = 12 * 1024 * 1024;
const MAX_CARD_BODY = 18 * 1024 * 1024;
class ReleaseError extends Error {
  constructor(code, status = 409, message = code) { super(message); this.code = code; this.status = status; }
}
const reject = (code, status, message) => { throw new ReleaseError(code, status, message); };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
function fields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject('invalid_input', 400, label + ' 必须是 JSON 对象');
  if (Object.keys(value).some(key => !allowed.includes(key))) reject('invalid_input', 400, label + ' 含未支持字段');
}
function createOfficialRelease({ db, authorize, isAdmin = () => false, send, readRawBody, config = {}, fault = () => {}, beforeCommit = () => {} }) {
  try { db.exec("ALTER TABLE publishers ADD COLUMN can_publish_official INTEGER NOT NULL DEFAULT 0"); } catch (error) {
    if (!String(error.message).includes('duplicate column')) throw error;
  }
  db.exec(`CREATE TABLE IF NOT EXISTS official_release_head (
    card_id TEXT PRIMARY KEY, manifest_hash TEXT NOT NULL, registry TEXT NOT NULL, consumers TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS official_release_previews (
    id TEXT PRIMARY KEY, publisher_id TEXT NOT NULL, expires_at INTEGER NOT NULL, preview_hash TEXT NOT NULL,
    previous_hash TEXT, registry_hash TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
    CREATE TABLE IF NOT EXISTS official_release_audit (
    id TEXT PRIMARY KEY, publisher_id TEXT NOT NULL, created_at TEXT NOT NULL, finished_at TEXT,
    status TEXT NOT NULL, previous_hash TEXT, manifest_hash TEXT NOT NULL, payload TEXT NOT NULL);`);
  db.exec('PRAGMA busy_timeout=5000');
  let library;
  function settings() {
    if (!config.modulePath || !config.outputDirectory || !config.keyId || (!config.privateKey && !config.privateKeyFile)) reject('publishing_not_configured', 503, '官方发布尚未配置，现有工坊仍可使用');
    if (!path.isAbsolute(config.modulePath) || !path.isAbsolute(config.outputDirectory) || (config.privateKeyFile && !path.isAbsolute(config.privateKeyFile))) reject('publishing_not_configured', 503, '官方发布配置无效');
    try {
      library ||= require(config.modulePath);
      for (const name of ['canonical', 'createCorePackage', 'createContentPackage', 'buildRelease', 'validatePackage', 'validateCatalog', 'validateOwnership', 'packageRelativePath', 'sha256']) if (typeof library[name] !== 'function') throw Error('wrong module');
      if (library.CARD_ID !== 'cyber2051') throw Error('wrong card');
      const privateKey = config.privateKey || crypto.createPrivateKey(fs.readFileSync(config.privateKeyFile));
      if (privateKey.type !== 'private' || privateKey.asymmetricKeyType !== 'ed25519' || !/^[a-z][a-z0-9._-]{0,95}$/.test(config.keyId)) throw Error('wrong key');
      const pem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
      const spkiBase64 = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).toString('base64');
      return { P: library, privateKey, publicKey: { keyId: config.keyId, pem, spkiBase64 }, trustedKeys: { [config.keyId]: pem } };
    } catch { reject('publishing_not_configured', 503, '格式 3 模块或签名配置不可用'); }
  }
  function actor(req, required = true) {
    if (isAdmin(req)) return { publisher_id: 'admin', status: 'active', can_publish_official: 1, display_name_last: '管理员' };
    const result = authorize(req);
    if (result.error) reject(result.error, result.code || 401);
    const row = db.prepare('SELECT publisher_id,status,can_publish_official,display_name_last FROM publishers WHERE publisher_id=?').get(result.sess.publisherId);
    if (!row || row.status !== 'active') reject('publisher_unavailable', 403);
    if (required && row.can_publish_official !== 1) reject('official_release_forbidden', 403, '此账号未获官方发布授权');
    return row;
  }
  function safePath(relative, createParents = false) {
    const root = path.resolve(config.outputDirectory);
    const target = path.resolve(root, relative);
    if (!relative || path.isAbsolute(relative) || !target.startsWith(root + path.sep)) reject('unsafe_release_path');
    const ancestors = []; let at = path.dirname(target);
    while (at !== path.dirname(at)) { ancestors.push(at); at = path.dirname(at); }
    ancestors.push(at);
    for (const directory of ancestors.reverse()) {
      if (!fs.existsSync(directory)) {
        if (createParents) { fs.mkdirSync(directory); syncDirectory(path.dirname(directory)); } else continue;
      }
      if (fs.existsSync(directory) && (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink())) reject('unsafe_release_path');
    }
    if (fs.existsSync(target) && (!fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink())) reject('unsafe_release_path');
    return target;
  }
  function withLock(work) {
    safePath('manifest.json', true);
    const lock = path.join(config.outputDirectory, '.official-release.lock');
    try { fs.mkdirSync(lock); } catch (error) {
      if (error.code === 'EEXIST') reject('release_locked', 409, '另一发布正在进行，或上次发布需要运维恢复');
      throw error;
    }
    const ownerFile = path.join(lock, 'owner.json');
    try {
      fs.writeFileSync(ownerFile, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
      return work();
    } finally { if (fs.existsSync(ownerFile)) fs.unlinkSync(ownerFile); fs.rmdirSync(lock); }
  }
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function checkSources(publisherId, preview, packages) {
    const result = beforeCommit({ db, publisherId, preview, packages });
    if (result && typeof result.then === 'function') reject('source_check_async', 500, '发布来源核对必须在当前数据库事务内同步完成');
  }
  function manifestBytes() {
    const modern = safePath('component-manifest.json');
    const file = fs.existsSync(modern)?modern:safePath('manifest.json');
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
  }
  function recover(P) {
    for (const row of db.prepare("SELECT * FROM official_release_audit WHERE status='prepared' ORDER BY created_at,id").all()) {
      const current = manifestBytes(), currentHash = current ? hash(current) : null;
      const payload = JSON.parse(row.payload);
      if (currentHash === row.manifest_hash) transaction(() => finish(row.id, payload, P));
      else if (currentHash === row.previous_hash) transaction(() => {
        db.prepare("UPDATE official_release_audit SET status='aborted',finished_at=? WHERE id=?").run(new Date().toISOString(), row.id);
        db.prepare("UPDATE official_release_previews SET status='failed' WHERE id=?").run(row.id);
      });
      else reject('release_recovery_conflict', 409, '发布日志与当前清单不一致，需要运维核查');
      const temporary = safePath('.manifest-' + row.id + '.new');
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  function finish(id, payload, P) {
    if(payload.compatibility){
      const c=payload.compatibility,file=safePath('manifest.json'),current=fs.existsSync(file)?hash(fs.readFileSync(file)):null;
      if(current!==c.beforeHash&&current!==hash(c.text))reject('release_recovery_conflict',409,'旧客户端清单发生变化，保留恢复记录');
      if(current!==hash(c.text)){
        const temp=safePath('.compatibility-'+id+'.new');
        if(fs.existsSync(temp)){if(hash(fs.readFileSync(temp))!==hash(c.text))reject('release_recovery_conflict');}
        else durableFile(temp,c.text);
        fs.renameSync(temp,file);syncDirectory(config.outputDirectory);
      }
    }
    db.prepare('INSERT INTO official_release_head VALUES (?,?,?,?) ON CONFLICT(card_id) DO UPDATE SET manifest_hash=excluded.manifest_hash,registry=excluded.registry,consumers=excluded.consumers')
      .run(P.CARD_ID, payload.manifestHash, P.canonical(payload.registry), P.canonical(payload.consumers));
    db.prepare("UPDATE official_release_audit SET status='committed',finished_at=? WHERE id=?").run(new Date().toISOString(), id);
    db.prepare("UPDATE official_release_previews SET status='published' WHERE id=?").run(id);
  }
  function currentState(ctx) {
    try { return readState(ctx); } catch (error) {
      if (error instanceof ReleaseError) throw error;
      reject('release_state_invalid', 409, '现有发行文件或发布记录校验失败，需要运维核查');
    }
  }
  function readState(ctx) {
    const { P, trustedKeys } = ctx; recover(P);
    const bytes = manifestBytes(), manifestHash = bytes ? hash(bytes) : null;
    const head = db.prepare('SELECT * FROM official_release_head WHERE card_id=?').get(P.CARD_ID);
    if (!bytes && head) reject('release_state_conflict');
    if (!bytes) return { catalog: null, manifestHash: null, packages: [], registry: { format: 1, packages: {}, owners: { quests: {}, gallery: {}, worldbook: {} } }, consumers: { characterIds: P.CONSUMED_CHARACTER_IDS, mapIndex: {} } };
    if (!head || head.manifest_hash !== manifestHash) reject('release_state_conflict', 409, '发行清单尚未关联可信发布记录，不能忽略已有编号所有权');
    const catalog = JSON.parse(bytes); P.validateCatalog(catalog, { trustedKeys });
    const packages = catalog.packages.map(entry => {
      const pkgPath = P.packageRelativePath(entry), expectedUrl = 'https://cyber2051.top/updates/v3/' + pkgPath;
      if (entry.url !== expectedUrl) reject('release_state_conflict');
      const file = fs.readFileSync(safePath(pkgPath));
      if (file.length !== entry.bytes || hash(file) !== entry.sha256) reject('release_package_corrupt');
      const pkg = JSON.parse(file);
      if (pkg.id !== entry.id || pkg.version !== entry.version || pkg.kind !== entry.kind || pkg.optional !== entry.optional || (pkg.activation || 'compatible') !== (entry.activation || 'compatible') || P.canonical(pkg.requires) !== P.canonical(entry.requires)) reject('release_package_corrupt');
      return pkg;
    });
    const registry = JSON.parse(head.registry), consumers = JSON.parse(head.consumers);
    const questIds = [...new Set(packages.filter(pkg => pkg.kind === 'content').flatMap(pkg => pkg.content.quests.map(quest => quest.id)))];
    for (const pkg of packages) P.validatePackage(pkg, { trustedKeys, ...consumers, questIds });
    // 注册表须实际覆盖当前发行包，不能只信任一份客户端提供的 JSON。
    for (const pkg of packages.filter(pkg => pkg.kind === 'content')) {
      const record = registry.packages[pkg.id];
      if (!record || record.version !== pkg.version || P.canonical(record.content) !== P.canonical(pkg.content)) reject('release_registry_corrupt');
    }
    P.validateOwnership(packages, registry);
    ownership(P, registry, packages);
    return { catalog, manifestHash, packages, registry, consumers };
  }
  function ownership(P, before, packages) {
    const registry = clone(before);
    registry.owners ||= { quests: {}, gallery: {}, worldbook: {} };
    function reserve(kind, id, owner) {
      const key = String(id), old = registry.owners[kind][key];
      if (old && old !== owner) reject('ownership_conflict', 409, '编号已属于其他包：' + kind + '/' + key);
      registry.owners[kind][key] = owner;
    }
    for (const [id, record] of Object.entries(registry.packages)) for (const key of ['quests', 'gallery', 'worldbook']) {
      for (const item of record.content[key]) reserve(key, key === 'worldbook' ? item.uid : item.id, id);
      for (const previous of Object.values(record.history || {})) for (const item of previous[key] || []) reserve(key, key === 'worldbook' ? item.uid : item.id, id);
    }
    P.validateOwnership(packages, registry);
    for (const pkg of packages) {
      if (pkg.kind === 'core') for (const entry of pkg.components.worldbook.entries) reserve('worldbook', entry.uid, pkg.id);
      else {
        for (const key of ['quests', 'gallery', 'worldbook']) for (const item of pkg.content[key]) reserve(key, key === 'worldbook' ? item.uid : item.id, pkg.id);
        const old = registry.packages[pkg.id];
        registry.packages[pkg.id] = { version: pkg.version, optional: pkg.optional, activation: pkg.activation || 'compatible', content: clone(pkg.content), history: { ...(old?.history || {}), ...(old && old.version !== pkg.version ? { [old.version]: old.content } : {}) } };
      }
    }
    return registry;
  }
  function contentInput(P, definition, options) {
    fields(definition, ['format', 'cardId', 'id', 'version', 'kind', 'optional', 'activation', 'requires', 'content'], '内容定义');
    fields(definition.requires, ['engine', 'packages'], 'requires');
    for (const dep of definition.requires.packages || []) fields(dep, ['id', 'version'], '依赖');
    fields(definition.content, ['quests', 'gallery', 'worldbook','gameplay'], 'content');
    for (const quest of definition.content.quests || []) fields(quest, ['id', 'title', 'fixer', 'district', 'type', 'difficulty', 'brief', 'goal', 'pay', 'fixerNote', 'payNote', 'deadline', 'terms', 'risk', 'bonus', 'unlock', 'flagship', 'track', 'mapId', 'placeId', 'prerequisites'], '任务');
    for (const image of definition.content.gallery || []) fields(image, ['id', 'characterId', 'category', 'url', 'fallbackUrl'], '立绘');
    return P.createContentPackage(definition, options);
  }
  function inputs(ctx, input, state) {
    const { P } = ctx;
    fields(input, ['card', 'core', 'contents','withdraw'], '发布请求'); P.canonical(input);
    if (input.card && input.core) reject('invalid_input', 400, 'card 与 core 只能上传一种');
    if (!state.catalog && !input.card) reject('initial_card_required', 400, '首次发行须上传新卡以核对基础内容所有权');
    if (input.contents !== undefined && !Array.isArray(input.contents)) reject('invalid_input', 400, 'contents 必须为数组');
    const packages = [], consumers = clone(state.consumers);
    if (input.card) {
      const card = input.card, matches = [];
      function walk(nodes) {
        if (!Array.isArray(nodes)) reject('invalid_card', 400);
        for (const node of nodes) { if (node.type === 'folder') walk(node.scripts); else if (node.id === UPDATER_ID) matches.push(node); }
      }
      walk(card.data?.extensions?.tavern_helper?.scripts);
      const seed = matches.length === 1 && matches[0].data?.__cxx_update_seed;
      if (!seed || seed.cardId !== P.CARD_ID || seed.baseVersion !== card.data.character_version || seed.registry?.format !== 1 || !['https://cyber2051.top/updates/v3/manifest.json','https://cyber2051.top/updates/v3/component-manifest.json','https://cyber2051.top/updates/v3/release-manifest.json'].includes(seed.catalogUrl) || !seed.registry.packages[BASE_ID]) reject('invalid_card', 400, '须上传带官方自动更新基线的新卡 JSON');
      let seededKey;
      try {
        const value = seed.trustedKeys?.[config.keyId];
        if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || Buffer.from(value, 'base64').toString('base64') !== value) throw Error('invalid base64');
        seededKey = crypto.createPublicKey({ key: Buffer.from(value, 'base64'), type: 'spki', format: 'der' }).export({ type: 'spki', format: 'der' }).toString('base64');
      } catch { reject('card_signing_key_mismatch', 400, '须先把当前发布公钥组装进新卡'); }
      if (seededKey !== ctx.publicKey.spkiBase64) reject('card_signing_key_mismatch', 400, '新卡信任公钥与当前发布签名不一致');
      if (!Array.isArray(seed.characterIds) || P.canonical([...seed.characterIds].sort()) !== P.canonical([...P.CONSUMED_CHARACTER_IDS].sort())) reject('invalid_card', 400, '角色消费者基线不一致');
      consumers.characterIds = clone(seed.characterIds); consumers.mapIndex = clone(seed.mapIndex || {});
      // New framework releases travel as full cards. Extract only static base
      // content here; preserve the old publisher path for legacy baselines.
      if (P.compareVersion(seed.engineVersion || P.ENGINE_VERSION, '1.2.0') < 0) packages.push(P.createCorePackage(card));
      for (const [id, record] of Object.entries(seed.registry.packages)) {
        if (record.version !== seed.baseVersion) reject('invalid_card', 400, '卡内基础内容版本与新卡不一致');
        packages.push(contentInput(P, { id, version: record.version, optional: record.optional, activation: record.activation || 'compatible', requires: { engine: seed.engineVersion||P.ENGINE_VERSION, packages: [] }, content: record.content }, consumers));
      }
      if (P.canonical(seed.initialContent) !== P.canonical(seed.registry.packages[BASE_ID].content)) reject('invalid_card', 400, '新卡基础内容与所有权基线不一致');
    }
    if (input.core) {
      if (state.catalog && P.compareVersion(state.catalog.engineVersion, '1.2.0') >= 0) reject('next_card_required', 400, '新版程序通过完整角色卡与存档迁移交付，不能发布独立核心代码包');
      fields(input.core, ['format', 'cardId', 'id', 'version', 'kind', 'optional', 'activation', 'requires', 'compatibilityWorldbookIds', 'components', 'signature'], '基础包');
      if (!state.catalog) reject('initial_card_required', 400, '首次发行须上传新卡以核对基础内容所有权');
      const core = clone(input.core); delete core.signature;
      if (core.id !== 'cyber2051.core' || core.kind !== 'core') reject('invalid_card', 400);
      packages.push(P.validatePackage(core, consumers));
    }
    const questIds = [...new Set([...Object.values(state.registry.packages).flatMap(record => record.content.quests.map(q => q.id)), ...(input.contents || []).flatMap(def => def.content?.quests?.map(q => q.id) || [])])];
    for (const definition of input.contents || []) packages.push(contentInput(P, definition, { ...consumers, questIds }));
    const withdraw=input.withdraw||[];
    if(!Array.isArray(withdraw)||new Set(withdraw).size!==withdraw.length)reject('invalid_input',400,'撤回须为不重复包编号');
    for(const id of withdraw){const old=state.catalog?.packages.find(p=>p.id===id);if(!old||!old.optional||old.kind!=='content'||packages.some(p=>p.id===id))reject('invalid_input',400,'只能撤回已发行的可选纯内容包，且不能同批更新');}
    if ((!packages.length&&!withdraw.length) || new Set(packages.map(pkg => pkg.id)).size !== packages.length) reject('invalid_input', 400, '须上传内容或选择撤回，同批包编号不能重复');
    consumers.questIds = [...new Set([...questIds, ...packages.filter(pkg => pkg.kind === 'content').flatMap(pkg => pkg.content.quests.map(quest => quest.id))])];
    return { packages, withdraw, consumers, registry: ownership(P, state.registry, packages) };
  }
  function changes(P, previous, next) {
    const groups = pkg => {
      if (!pkg) return {};
      if (pkg.kind === 'content') return { quests: [pkg.content.quests, 'id'], gallery: [pkg.content.gallery, 'id'], worldbook: [pkg.content.worldbook, 'uid'],...Object.fromEntries(Object.entries(pkg.content.gameplay||{}).filter(([,v])=>Array.isArray(v)).map(([k,v])=>['gameplay.'+k,[v,'id']])) };
      const scripts = []; const walk = nodes => nodes.forEach(node => { scripts.push(node.type === 'folder' ? { ...node, scripts: node.scripts.map(s => s.id) } : node); if (node.type === 'folder') walk(node.scripts); }); walk(pkg.components.scripts.trees);
      return { worldbook: [pkg.components.worldbook.entries, 'uid'], regex: [pkg.components.regex.scripts, 'id'], scripts: [scripts, 'id'] };
    };
    const before = groups(previous), after = groups(next), result = {};
    for (const key of Object.keys(after)) {
      const [items, field] = after[key], old = new Map((before[key]?.[0] || []).map(item => [String(item[field]), item])), fresh = new Map(items.map(item => [String(item[field]), item]));
      result[key] = { added: [...fresh.keys()].filter(id => !old.has(id)), changed: [...fresh.keys()].filter(id => old.has(id) && P.canonical(old.get(id)) !== P.canonical(fresh.get(id))), removed: [...old.keys()].filter(id => !fresh.has(id)) };
    }
    return result;
  }
  function preview(req, input) {
    actor(req); const ctx = settings(), { P } = ctx;
    return withLock(() => {
      const who = actor(req), state = currentState(ctx), prepared = inputs(ctx, input, state);
      const release = P.buildRelease({ packages: prepared.packages, withdraw:prepared.withdraw, privateKey: ctx.privateKey, keyId: config.keyId, previousCatalog: state.catalog, existingRegistry: state.registry, ...prepared.consumers });
      const previewId = crypto.randomBytes(16).toString('hex'), expiresAt = Date.now() + PREVIEW_TTL;
      const payload = { catalog: release.catalog, files: release.files.map(file => ({ relativePath: file.relativePath, text: file.bytes.toString('utf8') })), registry: prepared.registry, consumers: prepared.consumers, manifestHash: hash(release.catalogBytes) };
      const legacyFile=safePath('manifest.json');
      if(P.compareVersion(release.catalog.engineVersion,P.ENGINE_VERSION)>0 && prepared.withdraw.length && fs.existsSync(legacyFile)){
        const legacyBytes=fs.readFileSync(legacyFile),legacyCatalog=JSON.parse(legacyBytes),withdraw=prepared.withdraw.filter(id=>legacyCatalog.packages.some(p=>p.id===id));
        if(withdraw.length){const oldRelease=P.buildRelease({packages:[],withdraw,privateKey:ctx.privateKey,keyId:config.keyId,previousCatalog:legacyCatalog,existingRegistry:state.registry,...prepared.consumers});payload.compatibility={beforeHash:hash(legacyBytes),text:oldRelease.catalogBytes.toString('utf8')};}
      }
      const registryHash = hash(P.canonical({ registry: state.registry, consumers: state.consumers }));
      const summary = release.files.map(file => ({ id: file.package.id, version: file.package.version, previousVersion: state.packages.find(pkg => pkg.id === file.package.id)?.version || null, kind: file.package.kind, optional: file.package.optional, activation: file.package.activation || 'compatible', bytes: file.bytes.length, sha256: file.entry.sha256, changes: changes(P, state.packages.find(pkg => pkg.id === file.package.id), file.package) }));
      payload.summary = summary;
      for(const id of prepared.withdraw)summary.push({id,version:state.catalog.packages.find(p=>p.id===id).version,withdrawn:true,historyPreserved:true});
      const previewHash = hash(P.canonical({ previewId, publisherId: who.publisher_id, expiresAt, previousManifestHash: state.manifestHash, registryHash, payload, summary }));
      db.prepare('DELETE FROM official_release_previews WHERE expires_at<? AND status=?').run(Date.now(), 'pending');
      db.prepare('INSERT INTO official_release_previews (id,publisher_id,expires_at,preview_hash,previous_hash,registry_hash,payload) VALUES (?,?,?,?,?,?,?)')
        .run(previewId, who.publisher_id, expiresAt, previewHash, state.manifestHash, registryHash, P.canonical(payload));
      return { ok: true, previewId, previewHash, expiresAt: new Date(expiresAt).toISOString(), previousManifestHash: state.manifestHash, manifestHash: payload.manifestHash, packages: summary };
    });
  }
  function durableFile(file, bytes) {
    const fd = fs.openSync(file, 'wx', 0o644);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    syncDirectory(path.dirname(file));
  }
  function syncDirectory(directory) {
    // Linux 发布环境须同步目录项；Windows 本地夹具没有可移植目录 fsync。
    if (process.platform === 'win32') return;
    const fd = fs.openSync(directory, 'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
  function publish(req, input) {
    fields(input, ['previewId', 'previewHash'], '确认请求');
    if (!/^[a-f0-9]{32}$/.test(input.previewId || '') || !/^[a-f0-9]{64}$/.test(input.previewHash || '')) reject('invalid_input', 400);
    actor(req); const ctx = settings(), { P } = ctx;
    return withLock(() => {
      const who = actor(req), state = currentState(ctx);
      const row = db.prepare('SELECT * FROM official_release_previews WHERE id=?').get(input.previewId);
      if (!row || row.publisher_id !== who.publisher_id || row.preview_hash !== input.previewHash) reject('preview_unavailable', 409);
      if (row.status === 'published') {
        const old = JSON.parse(row.payload);
        return { ok: true, published: true, alreadyPublished: true, previewId: row.id, manifestHash: old.manifestHash, packages: old.catalog.packages.map(({ id, version }) => ({ id, version })) };
      }
      if (row.status !== 'pending' || row.expires_at < Date.now()) reject('preview_expired', 409);
      if (row.previous_hash !== state.manifestHash || row.registry_hash !== hash(P.canonical({ registry: state.registry, consumers: state.consumers }))) reject('preview_stale', 409, '发行内容已变化，请重新预览');
      const payload = JSON.parse(row.payload); P.validateCatalog(payload.catalog, { trustedKeys: ctx.trustedKeys });
      if (hash(P.canonical({ previewId: row.id, publisherId: row.publisher_id, expiresAt: row.expires_at, previousManifestHash: row.previous_hash, registryHash: row.registry_hash, payload, summary: payload.summary })) !== row.preview_hash) reject('preview_corrupt');
      const nextPackages = payload.files.map(file => JSON.parse(file.text));
      if (P.canonical(ownership(P, state.registry, nextPackages)) !== P.canonical(payload.registry)) reject('preview_corrupt');
      const manifest = Buffer.from(P.canonical(payload.catalog));
      if (hash(manifest) !== payload.manifestHash) reject('preview_corrupt');
      transaction(() => {
        actor(req);
        checkSources(who.publisher_id, row, nextPackages);
        for (const file of payload.files) {
          const pkg = JSON.parse(file.text); P.validatePackage(pkg, { trustedKeys: ctx.trustedKeys, ...payload.consumers });
          if (file.relativePath !== P.packageRelativePath(pkg)) reject('preview_corrupt');
          const entry = payload.catalog.packages.find(item => item.id === pkg.id);
          if (!entry || hash(file.text) !== entry.sha256 || Buffer.byteLength(file.text) !== entry.bytes) reject('preview_corrupt');
          const destination = safePath(file.relativePath, true);
          if (fs.existsSync(destination)) { if (!fs.readFileSync(destination).equals(Buffer.from(file.text))) reject('immutable_package_conflict'); }
          else durableFile(destination, file.text);
        }
        fault('after-packages');
        db.prepare('INSERT INTO official_release_audit (id,publisher_id,created_at,status,previous_hash,manifest_hash,payload) VALUES (?,?,?,?,?,?,?)')
          .run(row.id, who.publisher_id, new Date().toISOString(), 'prepared', row.previous_hash, payload.manifestHash, P.canonical(payload));
      });
      const temporary = safePath('.manifest-' + row.id + '.new');
      try {
        durableFile(temporary, manifest); fault('before-manifest');
        transaction(() => {
          actor(req); // 与权限撤销共用 SQLite 写锁，最终换清单前再次检查。
          checkSources(who.publisher_id, row, nextPackages);
          const actual = manifestBytes(); if ((actual ? hash(actual) : null) !== row.previous_hash) reject('preview_stale');
          fs.renameSync(temporary, safePath(P.compareVersion(payload.catalog.engineVersion,P.ENGINE_VERSION)>0?'component-manifest.json':'manifest.json'));
          syncDirectory(config.outputDirectory);
          fault('after-manifest'); finish(row.id, payload, P);
        });
      } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
      return { ok: true, published: true, previewId: row.id, manifestHash: payload.manifestHash, packages: payload.catalog.packages.map(({ id, version }) => ({ id, version })) };
    });
  }
  function me(req) {
    const who = actor(req, false);
    if (!who.can_publish_official) return { ok: true, displayName: who.display_name_last || '', canPublishOfficial: false, publishingReady: false, readinessReason: 'official_release_forbidden', publicKey: null, packages: [] };
    try {
      const ctx = settings(); return withLock(() => {
        const state = currentState(ctx);
        return { ok: true, displayName: who.display_name_last || '', canPublishOfficial: true, publishingReady: true, readinessReason: null, publicKey: ctx.publicKey, manifestHash: state.manifestHash, packages: state.catalog?.packages || [] };
      });
    } catch (error) {
      if (!(error instanceof ReleaseError)) throw error;
      return { ok: true, displayName: who.display_name_last || '', canPublishOfficial: true, publishingReady: false, readinessReason: error.code, publicKey: null, packages: [] };
    }
  }
  function handle(req, res, urlPath, method) {
    const grant = urlPath.match(/^\/api\/admin\/publishers\/([a-f0-9]{16})\/official-release$/);
    const known = urlPath.startsWith('/api/official/') || !!grant || urlPath === '/api/admin/official/releases';
    if (!known) return false;
    if (method === 'POST' && ['/api/official/preview', '/api/official/publish'].includes(urlPath)) {
      try { actor(req); } catch (error) {
        send(res, error.status || 500, { ok: false, error: error.code || 'official_release_error', ...(error instanceof ReleaseError ? { message: error.message } : {}) });
        return true;
      }
    }
    const respond = work => { try { send(res, 200, work()); } catch (error) { send(res, error.status || 500, { ok: false, error: error.code || 'official_release_error', ...(error instanceof ReleaseError ? { message: error.message } : {}) }); } };
    const body = work => readRawBody(req, res, urlPath === '/api/official/preview' ? MAX_CARD_BODY : MAX_BODY, raw => respond(() => {
      let input; try { input = JSON.parse(raw.toString('utf8')); } catch { reject('invalid_json', 400); }
      if (!input?.card && raw.length > MAX_BODY) reject('file_too_large', 413);
      try { if (library) library.canonical(input); return work(input); } catch (error) {
        if (error instanceof ReleaseError) throw error;
        // 校验器提供的正文错误可显示；I/O、配置错误不暴露磁盘路径。
        if (!error.code && error.message && !/[/\\].*\.(json|pem|cjs)/.test(error.message)) reject('invalid_package', 400, error.message);
        throw error;
      }
    }));
    if (grant && method === 'POST') body(input => {
      fields(input, ['enabled'], '授权请求'); if (typeof input.enabled !== 'boolean') reject('invalid_input', 400);
      const row = db.prepare('SELECT status FROM publishers WHERE publisher_id=?').get(grant[1]);
      if (!row) reject('publisher_not_found', 404);
      if (input.enabled && row.status !== 'active') reject('publisher_unavailable', 403);
      db.prepare('UPDATE publishers SET can_publish_official=? WHERE publisher_id=?').run(Number(input.enabled), grant[1]);
      return { ok: true, publisherId: grant[1], canPublishOfficial: input.enabled };
    });
    else if (urlPath === '/api/admin/official/releases' && method === 'GET') respond(() => ({ ok: true, items: db.prepare('SELECT id,publisher_id,created_at,finished_at,status,previous_hash,manifest_hash FROM official_release_audit ORDER BY created_at DESC LIMIT 100').all() }));
    else if (urlPath === '/api/official/me' && method === 'GET') respond(() => me(req));
    else if (urlPath === '/api/official/preview' && method === 'POST') body(input => preview(req, input));
    else if (urlPath === '/api/official/publish' && method === 'POST') body(input => publish(req, input));
    else send(res, 404, { ok: false, error: 'not_found' });
    return true;
  }
  return { handle, me, preview, publish, actor };
}
module.exports = { createOfficialRelease, ReleaseError };
