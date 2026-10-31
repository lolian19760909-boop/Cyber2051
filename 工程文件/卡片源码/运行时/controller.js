(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CxxUpdateController = api;
    if (typeof root.getVariables === 'function') {
      Promise.resolve().then(() => api.create().start()).catch(e => console.error('[卡更新]', e.code || e.message));
    }
  }
})(typeof globalThis === 'object' ? globalThis : window, function (root) {
  'use strict';
  const Popover=typeof module==='object'&&module.exports?require('../共享/popover.js'):globalThis.CxxPopover;
  const CryptoCompat=typeof module==='object'&&module.exports?require('./crypto-compat.js'):globalThis.CxxCrypto;
  const JOURNAL = 'cxx-update-journal', BASE = 'cyber2051.base-content';
  const ORIGIN = 'https://cyber2051.top', CATALOG = ORIGIN + '/updates/v3/manifest.json';
  const COMPONENT_CATALOG = ORIGIN + '/updates/v3/component-manifest.json';
  const RELEASE_CATALOG = ORIGIN + '/updates/v3/release-manifest.json';
  const clone = x => JSON.parse(JSON.stringify(x));
  const Gameplay = typeof module==='object' && module.exports ? require('./gameplay.js') : root.CxxGameplay;
  const Release = typeof module==='object' && module.exports ? require('./release.js') : root.CxxRelease;
  const Mailbox = typeof module==='object'&&module.exports ? require('./mailbox.js') : root.CxxMailboxFactory;
  const Discovery = typeof module==='object' && module.exports ? require('./discovery.js') : root.CxxUpdateDiscovery;
  const Unified = typeof module==='object' && module.exports ? require('./unified-update.js') : root.CxxUnifiedUpdate;
  const PluginCheck = typeof module==='object' && module.exports ? require('./plugin-check.js') : root.CxxPluginCheck;
  const error = (code, message) => Object.assign(new Error(message), { code });
  function bytes64(value) { return Uint8Array.from(root.atob(value), c => c.charCodeAt(0)); }
  async function verifyDocument(doc, keys, core, crypto = root.crypto) {
    const s = doc.signature, publicKey = keys?.[s?.keyId];
    if (!publicKey || s?.algorithm !== 'Ed25519') throw error('untrusted-signature', '更新签名不属于本卡信任的发布者');
    const unavailable=()=>error('crypto-signature-unavailable','当前脚本环境无法验证更新签名。请在支持 Web Crypto 的浏览器或电脑本机打开后安装更新；未安装此文件。');
    const subtle=CryptoCompat.create(crypto).subtle;
    if(typeof subtle?.importKey!=='function'||typeof subtle?.verify!=='function')throw unavailable();
    try {
      const key = await subtle.importKey('spki', bytes64(publicKey), { name: 'Ed25519' }, false, ['verify']);
      const unsigned = { ...doc }; delete unsigned.signature;
      if (!await subtle.verify('Ed25519', key, bytes64(s.value), new TextEncoder().encode(core.canonical(unsigned)))) throw error('bad-signature', '更新签名校验失败');
    } catch(e) { if(['NotSupportedError','SecurityError'].includes(e.name))throw unavailable();throw e; }
    return doc;
  }
  function ownership(registry, pack) {
    for (const [id, old] of Object.entries(registry.packages || {})) {
      if (id === pack.id) continue;
      for (const kind of ['quests', 'gallery']) {
        const existing = new Set([old.content, ...Object.values(old.history || {})].flatMap(content => (content?.[kind] || []).map(x => x.id)));
        for (const x of pack.content?.[kind] || []) if (existing.has(x.id)) throw error('content-id-collision', '不同包用了同一内容编号：' + x.id);
      }
      for (const kind of ['slots','resources','items','blueprints','recipes','skills','shops','services','encounters']) {
        const existing = new Set([old.content,...Object.values(old.history || {})].flatMap(c=>(c?.gameplay?.[kind] || []).map(x=>x.id)));
        for (const item of pack.content?.gameplay?.[kind] || []) if (existing.has(item.id)) throw error('content-id-collision','不同包用了同一玩法编号：'+item.id);
      }
    }
  }
  function selection(catalog, state, core = root.CxxUpdateCore, mode = 'manual') {
    if (!['manual', 'content-manual'].includes(mode)) return [];
    const byId = new Map(catalog.packages.map(x => [x.id, x])), selected = new Set();
    function accepted(pack) {
      if (pack.kind === 'core') return mode !== 'content-manual' && (mode === 'manual' || state.policy?.basic === true && state.policy?.basicConsent === true);
      if (pack.kind !== 'content') return false;
      const choice = state.policy?.versions?.[pack.id];
      if (pack.kind === 'component' && !state.componentPackages?.[pack.id]) {
        const consent = state.policy?.componentConsent?.[pack.id];
        if (mode !== 'manual' || consent?.version !== pack.version || consent?.sha256 !== pack.sha256 || choice?.version !== pack.version || choice.accept !== true) return false;
      }
      if (choice?.version === pack.version && choice.accept === false) return false;
      if (['manual', 'content-manual'].includes(mode) && choice?.version === pack.version && choice.accept === true) return true;
      return pack.optional ? state.policy?.optionalConsent === true
        : state.policy?.basic === true && state.policy?.basicConsent === true;
    }
    function visit(pack) {
      if (selected.has(pack.id)) return;
      if (pack.kind === 'component') throw error('card-upgrade-required', '请通过官方完整版本包更新程序：' + pack.id);
      if (pack.optional && !(pack.kind === 'component' && mode === 'manual') && state.subscriptions?.[pack.id] !== true) throw error('subscription-needed', '请先订阅依赖内容：' + pack.id);
      if (!accepted(pack)) throw error('version-consent-needed', '需要先同意接收依赖版本：' + pack.id + ' ' + pack.version + '；当前版本会保留');
      for (const dep of pack.requires.packages) {
        const have = state.installed?.[dep.id]?.version;
        if (have && core.compareVersions(have, dep.version) >= 0) continue;
        const next = byId.get(dep.id);
        if (!next || core.compareVersions(next.version, dep.version) < 0) throw error('dependency-missing', '清单中没有所需内容：' + dep.id + ' ' + dep.version);
        visit(next);
      }
      selected.add(pack.id);
    }
    for (const p of catalog.packages) if (accepted(p) && (!p.optional || state.subscriptions?.[p.id] === true || p.kind === 'component' && mode === 'manual')) visit(p);
    return [...selected].map(id => byId.get(id));
  }
  function create(options = {}) {
    const api = options.api || root, Core = options.core || root.CxxUpdateCore;
    const sourceAtStart=Release.flatten(api.getScriptTrees?.({type:'character'})||[]).find(s=>s.id===Release.UPDATER)?.content;
    const runtimeHash=sourceAtStart?Core.sha256(sourceAtStart):Promise.resolve(null);
    const Content = options.content || root.CxxContent;
    const Host = options.hostModule || root.CxxUpdateHost;
    const host = options.host || Host.create({ core: Core, api, rawRegex: true });
    const Backup = options.backupModule || root.CxxUpdateBackup;
    const backup = options.backup || (Backup ? Backup.create({ api, host, core: Core, getSeed: readSeed,readOnlyExport:true,crypto:options.crypto||root.crypto }) : null);
    let gameplay = options.gameplay || null;
    const crypto = CryptoCompat.create(options.crypto || root.crypto);
    const storage = host.createStorage();
    let alive = true, running = false, queued = false, timer = null, panel = null, catalog = null, seed = options.seed, storyOperations = 0;
    let status = '正在读取本卡更新设置', contextAtStart = null, retryAfter = 0;
    let restoreDocument = null, restorePreview = null, panelBlocked = null, componentRemoval = null;
    let migrationDocument = null, migrationPreview = null, migrationExport = null, saveRunning = false;
    let mailbox=null,stories=null;
    let activeTab = 'migration', localPackage = null, lastError = null, panelReturnFocus = null, pendingRecovery = null;
    let unified=null,onlinePending=null,resumePending=false;
    let previewEpoch=0,migrationEpoch=0;
    const discovery=crypto.capabilities().signature?Discovery?.create({Core,verify:(doc,keys)=>verifyDocument(doc,keys,Core,crypto),seed:readSeed,currentVersion:()=>readSeed().baseVersion,
      fetch:options.fetch||root.fetch?.bind(root),storage:options.discoveryStorage,locks:options.discoveryLocks,
      onChange(){if(panel&&alive)renderPanel();},onNewVersion(latest){onlinePending=latest;api.parent?.toastr?.info('发现新版 '+latest.version+'，点击查看卡内更新。',null,{onclick(){activeTab='update';openPanel();}});}}):null;
    function clearMigrationExport() { migrationExport?.download.revoke(); migrationExport = null; }
    function invalidatePackage(){previewEpoch++;localPackage=null;}
    function invalidateSave(){migrationEpoch++;clearMigrationExport();migrationDocument=null;migrationPreview=null;restoreDocument=null;restorePreview=null;if(panel)renderPanel();}
    const disposers = [];
    const same = (a, b) => Core.canonical(a) === Core.canonical(b);
    function report(text) { status = text; if (panel) renderPanel(); }
    function readSeed() {
      if (!seed) seed = api.getVariables({ type: 'script' }).__cxx_update_seed;
      if (!seed || seed.cardId !== 'cyber2051' || Core.compareVersions(seed.engineVersion, '1.0.0') < 0 || Core.compareVersions(seed.engineVersion, Core.ENGINE_VERSION) > 0) throw error('seed-missing', '这张卡的更新基线需要匹配的更新器');
      if (![CATALOG, COMPONENT_CATALOG, RELEASE_CATALOG].includes(seed.catalogUrl)) throw error('unexpected-feed', '更新地址与本卡约定不一致');
      const current = host.readState().installed?.[Release.ID];
      if (!current?.release) return seed;
      return { ...seed, ...current.release.seed, baseVersion: current.version, migration: { ...seed.migration, ...current.release.seed.migration, buildId: current.release.buildId, saveSchema: current.release.saveSchema } };
    }
    // 状态统一入口：本楼没有 stat_data 时，向业务核心的 Cxx236State 取当前分支状态。
    function liveStat236() {
      const s = (typeof globalThis !== 'undefined' && globalThis.Cxx236State) || (typeof api !== 'undefined' && api.Cxx236State);
      if (!s || typeof s.stat !== 'function') return null;
      try { const v = s.stat(); return v && v.terminal ? v : null; } catch { return null; }
    }
    function readRecords() {
      try {
        for (let floor = api.getLastMessageId(); floor >= 0; floor--) {
          const value = api.getVariables({ type: 'message', message_id: floor });
          if (value?.stat_data) return value.stat_data.terminal?.quests || {};
        }
        const live = liveStat236();
        if (live) return live.terminal?.quests || {};
      } catch { /* Missing MVU is a read-only empty ledger, never initialization. */ }
      return {};
    }
    function readGameplay() {
      try {for(let floor=api.getLastMessageId();floor>=0;floor--){const value=api.getVariables({type:'message',message_id:floor});if(value?.stat_data)return value.stat_data.terminal?.gameplay || {};}}catch{}
      try {const live=liveStat236();if(live)return live.terminal?.gameplay || {};}catch{}
      return {};
    }
    function chatVars() { return api.getVariables({ type: 'chat' }); }
    function pins() { return chatVars().__cxx_content_pins || {}; }
    async function initialize({recoverInstallation=true}={}) {
      const s = readSeed(); let old = host.readState();
      if (old.cardId && old.cardId !== s.cardId) throw error('wrong-state', '角色中已有其他作品的更新记录');
      if (old.cardId) {
        const characterKey = host.getContext().characterKey;
        // A durable journal may exist even if its character pointer never saved.
        // Recover it before any engine/identity bookkeeping writes, then reread.
        if (recoverInstallation && (!old.characterKey || old.characterKey === characterKey)) { await recover(); old = host.readState(); }
        if (old.characterKey && old.characterKey !== characterKey) {
          if (old.journalName) throw error('instance-has-pending-update', '导入副本带有未完成更新记录，请先检查原实例的安装备份');
          old.instanceId = crypto.randomUUID(); old.backupNames = []; old.contentRevision = crypto.randomUUID();
        }
        if (old.characterKey !== characterKey || old.engineVersion !== Core.ENGINE_VERSION) { old.characterKey = characterKey; old.engineVersion = Core.ENGINE_VERSION; await host.saveState(old); }
        return old;
      }
      const value = { format: 1, cardId: s.cardId, instanceId: crypto.randomUUID(), characterKey: host.getContext().characterKey, engineVersion: Core.ENGINE_VERSION,
        installed: clone(s.installed), baseline: clone(s.baseline), registry: clone(s.registry),
        initialContent: clone(s.initialContent), initialAvatars: clone(s.initialAvatars || {}),
        subscriptions: {}, policy: { basic: false, basicConsent: false, optionalConsent: false }, mediaPreferences: {}, contentRevision: crypto.randomUUID(), conflicts: [] };
      await host.saveState(value); return value;
    }
    async function initializeChat() {
      const state = host.readState(), vars = chatVars();
      const expected = host.getContext(), fresh = typeof api.getLastMessageId === 'function' && api.getLastMessageId() <= 0;
      const initialized = vars.__cxx_content_origin?.instanceId === state.instanceId;
      if (initialized && (!vars.__cxx_content_origin.newChat || !fresh)) return;
      const next = clone(vars.__cxx_content_pins || {});
      if (fresh) for (const [id, record] of Object.entries(state.registry.packages)) {
        if (!next[id] && record.activation === 'new_chat' && (!record.optional || state.subscriptions[id])) next[id] = record.version;
      }
      if (initialized && same(next, vars.__cxx_content_pins || {})) return;
      host.assertContext(expected);
      await api.updateVariablesWith(value => ({ ...value, __cxx_content_pins: next,
        __cxx_content_origin: { instanceId: state.instanceId, initialized: true, newChat: fresh } }), { type: 'chat' });
      host.assertContext(expected);
    }
    async function getPackages(expected, mode = 'manual') {
      host.assertContext(expected, true);
      if (mode !== 'manual') return [];
      if (!localPackage) throw error('local-package-required', '请先从官网下载更新包，再选择更新包 JSON');
      const s = readSeed(), have = host.readState().installed?.[localPackage.pack.id]?.version;
      if (have && (Core.compareVersions(localPackage.pack.version, have) < 0||Core.compareVersions(localPackage.pack.version, have)===0&&!localPackage.allowInstalled)) throw error('downgrade', '此版本已经安装或比当前版本旧');
      const progress=host.readState().installed?.[Release.ID]?.release?.releaseProgress;
      if(progress&&progress.targetVersion===localPackage.pack.version&&progress.sha256!==localPackage.sha256)throw error('version-collision','此版本与之前部分安装的文件不同，请保留原包');
      if(progress&&Core.compareVersions(localPackage.pack.version,progress.targetVersion)<0)throw error('downgrade','已有更新版本的部分安装记录，请先补装或回退');
      host.setScope('character');
      if(!same(localPackage.context,contextIdentity(expected))||localPackage.previewHash!==await previewHash(await host.snapshot())){invalidatePackage();throw error('package-preview-stale','角色、组件或安装版本已变化，请重新选择并检查更新包');}
      Release.validate(localPackage.pack, s, Core); return [localPackage];
    }
    async function recover() {
      const journal = await storage.get(JOURNAL);
      if (!journal) return { status: 'none' };
      host.setScope(journal.installed.scope || 'character');
      // The original controller wrote four fields. Only that exact legacy shape
      // has an unambiguous registry in its durable component target.
      if (journal.format === 1 && same(Object.keys(journal.installed).sort(), ['baseline', 'conflicts', 'installed', 'scope'])) {
        if (Object.prototype.hasOwnProperty.call(host.readState(), 'componentPackages') || !journal.after?.registry) throw error('recovery-needed', '旧安装记录缺少完整组件归属目标，需要核查，原记录保留');
        journal.installed.registry = clone(journal.after.registry);
        if (await storage.set(JOURNAL, journal, { expectedId: journal.id }) === false) throw error('recovery-needed', '旧安装记录已被另一实例处理，请重新检查');
      }
      const result = await Core.recover({ host, storage, key: JOURNAL });
      if (result.errorCode === 'host-busy') throw error('host-busy', '正文或变量仍在处理，完成后会自动继续；也可稍后重新导出。');
      if (!['none', 'committed', 'rolled-back'].includes(result.status)) throw error('recovery-needed', '上次更新待恢复：' + result.status + (result.reason ? '（' + result.reason + '）' : '') + '；原进度保持不动');
      return result;
    }
    async function inspectRecovery() {
      const expected=host.getContext(),result=await host.inspectInstall();host.assertContext(expected,true);
      const j=result.backup?.journal;
      pendingRecovery={kind:result.kind,code:result.code||null,message:result.message||null,id:j?.id||null,phase:j?.status||j?.phase||null,scope:j?.installed?.scope||null,chatId:j?.context?.chatId||null,stages:j?.stages||[],otherChat:!!j&&j.context.chatId!==expected.chatId};
      if(panel)renderPanel();return clone(pendingRecovery);
    }
    async function openRecoveryStory() {
      const check=await inspectRecovery();
      if(check.kind!=='pending'||!check.otherChat)throw error('recovery-target-changed','待恢复的故事已变化，请重新检查。');
      if(!stories?.store)throw error('recovery-not-ready','故事服务尚未就绪，请稍后重试。');
      await stories.store.openRecovery(check.chatId);openPanel('recovery');
    }
    async function recoverPending() {
      await host.ready('export');
      const expected = host.getContext(); host.assertContext(expected);
      const check = await host.inspectInstall(); host.assertContext(expected);
      if (check.kind === 'blocked') throw error(check.code, check.message);
      if (check.kind !== 'pending') return { status: 'none', otherInstance: check.kind === 'foreign' };
      if (check.backup.journal.context.chatId !== expected.chatId) throw error('recovery-original-chat', '请先打开上次安装所在聊天：' + check.backup.journal.context.chatId);
      await host.ready('recover');
      return host.withLock(async () => { host.assertContext(expected); const result = await recover(); await host.assertNoPendingInstall(); return result; }, { waitForIdle: true });
    }
    async function transaction(before, after, installed, baseline, conflicts, scope, componentPackages) {
      const state = host.readState();
      const target = { installed, baseline, conflicts, scope, registry: clone(after.registry) };
      if (componentPackages !== undefined) target.componentPackages = clone(componentPackages);
      else if (Object.prototype.hasOwnProperty.call(state, 'componentPackages')) target.componentPackages = clone(state.componentPackages);
      const result = await Core.execute({ host, storage, key: JOURNAL, expectedContext: host.getContext(), before, after,
        installed: target });
      if (result.status === 'superseded') return result;
      return recover();
    }
    async function installCore(item) {
      if (!item.pack.release) throw error('invalid-release', '请使用独立更新器对应的完整版本包');
      const state = host.readState(); host.setScope('character');
      const plan = await Release.plan({ pack:item.pack, sha256:item.sha256, before:await host.snapshot(), state, seed:readSeed(), Core, Host });
      if (!same(plan.before.worldbook, plan.after.worldbook)) plan.after.worldbook.internalName = plan.before.worldbook.internalName;
      report('正在安装 ' + item.pack.version + '：世界书、正则和脚本');
      const result = await transaction(plan.before, plan.after, plan.installed, plan.baseline, plan.conflicts, 'character', plan.componentPackages);
      if (result?.status !== 'committed') throw error('release-not-installed', '本次版本未安装成功，已恢复原组件；可在备份恢复中查看');
      localPackage = null; return {...result,partial:!!plan.releaseProgress};
    }
    async function installContent(items) {
      if (!items.length) return;
      const state = host.readState(); host.setScope('character');
      const before = await host.snapshot(); let registry = before.registry;
      const installed = clone(state.installed);
      for (const item of items) {
        const archive = chatVars().__cxx_migration?.archive, old = archive?.packages?.[item.pack.id];
        const historical = old && Content.packageContent(old, item.pack.version);
        if (historical && !same(historical, item.pack.content)) throw error('migration-definition-conflict', '签名包与迁移历史的同一版本内容不同，停止安装：' + item.pack.id);
        const owners = { ...registry, packages: { ...(archive?.packages || {}), ...registry.packages } };
        // Synthetic legacy references are aliases for the original base quests.
        if (archive?.legacyQuests) delete owners.packages['migration.legacy'];
        ownership(owners, item.pack);
        registry = Core.mergeRegistry(registry, item.pack, { subscriptions: Object.keys(state.subscriptions).filter(id => state.subscriptions[id]),
          installed, mapIndex: readSeed().mapIndex || {}, characterIds: readSeed().characterIds,
          questIds: Object.values(registry.packages).flatMap(r => (r.content.quests || []).map(q => q.id)) }).registry;
        installed[item.pack.id] = { version: item.pack.version, sha256: item.sha256, kind: 'content', requires: clone(item.pack.requires) };
      }
      const after = { ...before, registry };
      await transaction(before, after, installed, state.baseline, state.conflicts || [], 'character');
    }
    async function commitComponentPlan(plan, state) {
      if (plan.noop) return;
      if (!same(plan.before.worldbook, plan.after.worldbook)) {
        plan.after.worldbook.internalName = plan.before.worldbook.internalName;
        for (const record of Object.values(plan.componentPackages)) record.lastWritten.worldbook.internalName = plan.after.worldbook.internalName;
      }
      const conflicts = [...(state.conflicts || []), ...plan.conflicts];
      return transaction(plan.before, plan.after, plan.installed, state.baseline, conflicts, 'character', plan.componentPackages);
    }
    async function installComponent(item) {
      const state = host.readState(); host.setScope('character');
      const before = await host.snapshot(), pack = clone(item.pack);
      if (pack.components.worldbook) pack.components.worldbook.entries = pack.components.worldbook.entries.map(Host.normalizeEntry);
      if (pack.components.scripts) pack.components.scripts.trees = pack.components.scripts.trees.map(Host.normalizeScript);
      const plan = await Core.planComponentInstall({ pack, sha256: item.sha256, before, state });
      return commitComponentPlan(plan, state);
    }
    let contentSync = null;
    async function syncChat() { if (contentSync) return contentSync(); }
    async function installPrepared() {
      const expected=host.getContext();
      while(alive&&(running||saveRunning||storyOperations||host.getContext().busy)){
        host.assertContext(expected,true);report('正在等待当前保存完成，随后安装已选版本');
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      if(!alive)throw error('updater-stopped','更新脚本已卸载');
      host.assertContext(expected);await check(true,'manual');
      if(lastError)throw Object.assign(Error(lastError.message),{code:lastError.code});
    }
    async function check(downloadUpdates = false, mode = 'sync') {
      if (!alive || running || saveRunning || storyOperations) { queued = true; return; }
      if (host.getContext().busy) { queued = true; report(mode === 'manual' ? '正在游玩或生成，所选版本尚未安装；空闲后请再次点击安装' : '正在游玩或生成，检查会等空闲时处理'); return; }
      running = true; queued = false; lastError = null;
      const expected = contextAtStart || host.getContext(); contextAtStart = expected;
      let installedCount = 0;
      try {
        host.assertContext(expected, true);
        await host.ready();
        host.assertContext(expected, true);
        const pending = await storage.get(JOURNAL);
        host.assertContext(expected, true);
        if (pending && pending.context.chatId !== expected.chatId) throw error('recovery-original-chat', '上次安装需要回到原聊天恢复：' + pending.context.chatId);
        const state=host.readState();
        if(mode==='sync'&&!downloadUpdates&&!pending&&!state.journalName&&!state.pendingRegistry&&state.characterKey===expected.characterKey&&state.engineVersion===Core.ENGINE_VERSION&&chatVars().__cxx_content_origin?.instanceId===state.instanceId&&contentSync?.isCurrent?.()){
          retryAfter=0;report('本轮内容定义未变化');return;
        }
        await host.withLock(async () => {
          host.assertContext(expected);
          await initialize(); await recover(); await initializeChat();
          if (downloadUpdates && mode === 'manual') {
            report('正在安装所选更新包');
            const packs = await getPackages(host.getContext(), mode);
            if (packs.length) {
              if (!backup) throw error('backup-module-missing', '完整聊天备份模块未加载，已停止安装；当前版本保持不动');
              report('正在保存更新前的完整聊天备份');
              const savedBackup = await backup.beforeContentInstall({ alreadyLocked: true });
              host.assertContext(expected);
              const backedState = host.readState(); backedState.lastChatBackup = savedBackup;
              await host.saveState(backedState);
            }
            for (const item of packs) {
              const result = item.pack.kind === 'core' ? await installCore(item) : item.pack.kind === 'component' ? await installComponent(item) : await installContent([item]);
              if (result?.status === 'superseded') return;
              installedCount++;
            }
            await initializeChat();
          }
          await syncChat();
          const n = host.readState().conflicts?.length || 0;
          const saved = n ? '更新已保存；' + n + '处玩家修改已保留，请查看冲突记录' : '当前内容已保存，游玩进度保持不动';
          if(installedCount) localPackage = null;
          const partial=host.readState().installed?.[Release.ID]?.release?.releaseProgress;
          report(partial?'部分更新至 '+partial.targetVersion+'；'+partial.blockedGroups.length+' 组因玩家修改或依赖暂缓，完整版本仍为 '+readSeed().baseVersion:installedCount ? '已安装更新，当前版本 '+readSeed().baseVersion : saved);
        }, { waitForIdle: mode === 'manual' || !!pending });
        retryAfter = 0;
      } catch (e) {
        lastError = { code:e.code || 'update-failed', message:e.message };
        const actual = host.getContext();
        if (['characterKey', 'chatId'].some(k => actual[k] !== expected[k])) {
          queued = alive; retryAfter = 0; report('聊天已切换，原安装已暂停；下一轮检查当前聊天'); return;
        }
        report(e.message || '更新暂不可用');
        const permanent = ['offline-package-fixture', 'publisher-not-configured', 'runtime-not-verified', 'lock-unavailable', 'storage-unavailable', 'capability-missing', 'seed-missing', 'backup-module-missing',
          'unexpected-feed', 'unexpected-origin', 'stale-character-cache', 'wrong-state', 'bad-signature', 'untrusted-signature', 'version-collision', 'downgrade',
          'story-compatibility-required', 'recovery-original-chat', 'backup-missing', 'subscription-needed', 'version-consent-needed', 'download-too-large', 'package-hash-mismatch', 'package-size-mismatch', 'catalog-package-mismatch'].includes(e.code)
          || /^(unsupported-|invalid-)/.test(e.code || '') || (e.code === 'recovery-needed' && e.message.includes('needs-review'));
        retryAfter = permanent ? 0 : Date.now() + 60000; queued = !permanent && alive;
        if (e.code === 'publisher-not-configured') {
          // The locally assembled candidate still exposes its built-in content.
          // No unsigned release is accepted as a workaround.
          try { await host.withLock(async () => { host.assertContext(expected); await recover(); await syncChat(); }); } catch (syncError) { report(syncError.message); }
        }
      } finally { running = false; if (panel) renderPanel(); }
    }
    async function command(value) {
      if (!alive) return;
      const state = host.readState();
      if (!value || value.instanceId !== state.instanceId || !['open', 'migration', 'gameplay', 'media', 'check', 'install', 'choose', 'subscribe', 'enable', 'confirm-component', 'uninstall-component'].includes(value.command)) return;
      if (!contextAtStart || !['characterKey', 'chatId'].every(k => host.getContext()[k] === contextAtStart[k])) return;
      if (value.command === 'open') return openPanel();
      if(value.command==='media'){
        if(!/^[a-f0-9-]{36}$/.test(value.requestId || ''))return;
        const result={requestId:value.requestId,instanceId:state.instanceId},expected=host.getContext();
        try{if(running || saveRunning || expected.busy || !gameplay)throw Error('酒馆正在保存或玩法尚未就绪，暂不解锁影像');const saved=await gameplay.readMedia();host.assertContext(expected);if(saved.busy)throw Error('MVU正在计算变量，保存结果尚未确认');result.media=Content.eventMedia(Content.withMigration(host.readState(),chatVars()).registry,saved.stat.terminal?.gameplay?.events || {});const floor=saved.messages.length-1,latest=saved.messages[floor];const variableGuard=(root.parent||root).Cxx236VariableGuard||api.Cxx236VariableGuard;if(saved.floor===floor)variableGuard?.confirmSaved?.(saved);result.mvuReceipt={floor,swipe:latest?.swipe_id || 0,saved:!!latest && !latest.is_user && !latest.is_system && saved.floor===floor,outcome:variableGuard?.state?.({floor})?.receipt||null};}
        catch(e){result.error=e.message;}
        await api.eventEmit('cxx:update:media:result',result);return;
      }
      if(value.command==='migration'){openPanel('migration');return;}
      if (value.command === 'gameplay') { if (!gameplay) throw error('card-upgrade-required','当前卡没有正文玩法，请换新版卡'); if(running || saveRunning){report('正在保存更新设置，请完成后再打开正文玩法');return;} return gameplay.open(value.tab); }
      if (value.command === 'check') return check();
      if (value.command === 'install') return check(true, 'manual');
      if (value.command === 'confirm-component') throw error('card-upgrade-required', '程序统一通过完整版本包安装');
      if (running || saveRunning) { report('已有更新或存档在处理，请稍后修改订阅'); return; }
      if (host.getContext().busy) { report('正在生成或保存，本次设置未修改；空闲后请再次操作'); return; }
      const expectedCommand = host.getContext();
      running=true;if(panel)renderPanel();
      try{
      await host.withLock(async () => {
        host.assertContext(expectedCommand);
        await recover();
        const next = host.readState(); host.assertContext(host.getContext());
        if (value.command === 'uninstall-component') {
          if (value.confirm !== true || !value.context || !['characterKey', 'chatId'].every(key => value.context[key] === expectedCommand[key])) throw error('component-confirmation-needed', '请在当前聊天重新确认卸载组件');
          host.setScope('character');
          const plan = await Core.planComponentUninstall({ packageId: value.id, version: value.version, sha256: value.sha256, before: await host.snapshot(), state: next });
          if (!backup) throw error('backup-module-missing', '完整聊天备份模块未加载，停止卸载');
          const savedBackup = await backup.beforeContentInstall({ alreadyLocked: true }); host.assertContext(expectedCommand);
          const backedState = host.readState(); backedState.lastChatBackup = savedBackup; await host.saveState(backedState);
          await commitComponentPlan(plan, next); componentRemoval = null;
          if (plan.complete) {
            const saved = host.readState(); delete saved.policy?.componentConsent?.[value.id];
            if (saved.policy?.versions) saved.policy.versions[value.id] = { version: value.version, accept: false };
            await host.saveState(saved);
          }
          return;
        } else if (value.command === 'confirm-component') {
          const p = catalog?.packages.find(p => p.id === value.id);
          if (p?.kind !== 'component' || p.version !== value.version || p.sha256 !== value.sha256) throw error('invalid-component-consent', '组件文件已变化，请重新查看后确认');
          next.policy = { ...(next.policy || {}), componentConsent: { ...(next.policy?.componentConsent || {}), [p.id]: { version: p.version, sha256: p.sha256 } } };
        } else if (value.command === 'subscribe') {
          const p = catalog?.packages.find(p => p.id === value.id);
          if (!p?.optional || typeof value.enabled !== 'boolean') throw error('invalid-subscription', '只有清单中的可选内容可以订阅');
          next.subscriptions[value.id] = value.enabled;
        } else if (value.command === 'choose') {
          const p = catalog?.packages.find(p => p.id === value.id);
          if (!p || p.version !== value.version || typeof value.accept !== 'boolean') throw error('invalid-version-choice', '更新列表已改变，请重新检查并选择版本');
          next.policy = { ...(next.policy || {}), versions: { ...(next.policy?.versions || {}), [p.id]: { version: p.version, accept: value.accept } } };
        } else {
          const p = next.registry.packages[value.id];
          if (!p || !(['new_chat', 'opt_in'].includes(p.activation) || p.activation === 'compatible' && pins()[value.id])) throw error('invalid-activation', '该包无需单独启用');
          const expected = host.getContext();
          await api.updateVariablesWith(vars => ({ ...vars, __cxx_content_pins: { ...(vars.__cxx_content_pins || {}), [value.id]: p.version } }), { type: 'chat' });
          host.assertContext(expected);
        }
        next.contentRevision = crypto.randomUUID(); await host.saveState(next);
      });
      }finally{running=false;if(panel)renderPanel();}
      return check(false);
    }
    function uiDocument() { return options.document || api.parent?.document || api.document; }
    async function saveAction(work) {
      if(running||saveRunning)throw error('update-running','已有操作正在进行');
      host.assertContext(contextAtStart);saveRunning=true;lastError=null;renderPanel();
      try{return await work();}finally{saveRunning=false;if(panel)renderPanel();}
    }
    async function readFile(file) {
      if(file.size>64*1024*1024)throw error('download-too-large','文件超过64 MiB');
      return file.text();
    }
    function fileReadCurrent(kind) {
      const expected=host.getContext(),epoch=kind==='package'?previewEpoch:migrationEpoch;
      return ()=>{host.assertContext(expected);if(!alive||epoch!==(kind==='package'?previewEpoch:migrationEpoch))throw error(kind==='package'?'package-preview-stale':'migration-preview-stale','读取文件期间聊天或内容已变化，请在当前故事重新选择文件。');};
    }
    const contextIdentity=c=>({cardId:c.cardId,characterKey:c.characterKey,chatId:c.chatId});
    async function previewHash(snapshot){return Core.sha256({snapshot,installed:host.readState().installed||{},instanceId:host.readState().instanceId||null,version:readSeed().baseVersion});}
    async function previewLocalPackage(text,{allowInstalled=false}={}) {
      invalidatePackage();const epoch=previewEpoch,expected=host.getContext();
      const pack=JSON.parse(text),initialSeed=readSeed();
      const current=()=>{host.assertContext(expected);if(!alive||epoch!==previewEpoch)throw error('package-preview-stale','文件或界面已变化，请重新检查');};
      await verifyDocument(pack,initialSeed.trustedKeys,Core,crypto);
      Core.validatePackage(pack,{cardId:initialSeed.cardId,engineVersion:Core.ENGINE_VERSION});
      Release.validate(pack,initialSeed,Core);
      await host.ready();current();
      // A preview can arrive before startup finishes its first ledger save.
      // Take the same bounded lock and use its confirmed state and snapshot.
      return host.withLock(async()=>{
        // Unlike storage.get under an exclusive lock, inspection never adopts
        // an orphaned journal or saves its missing character pointer.
        current();const inspected=await host.inspectInstall();current();
        if(inspected.kind==='blocked')throw error(inspected.code,inspected.message);
        const pending=inspected.backup?.journal;
        if(pending?.context?.chatId!==undefined&&pending.context.chatId!==expected.chatId)throw error('recovery-original-chat','上次安装需要回到原聊天恢复：'+pending.context.chatId);
        const old=host.readState();
        if(inspected.kind==='pending'||old.journalName||old.pendingRegistry)throw error('recovery-needed','上次安装尚未完成，请先到备份与恢复中检查并恢复，再预览更新包。');
        await initialize({recoverInstallation:false});current();
        const s=readSeed(),state=host.readState();
        if(!state.installed||typeof state.installed!=='object'||Array.isArray(state.installed))throw error('update-state-not-ready','安装记录尚未确认，请重新检查保存结果。');
        Core.validatePackage(pack,{cardId:s.cardId,engineVersion:Core.ENGINE_VERSION,installed:state.installed});
        Release.validate(pack,s,Core);host.setScope('character');
        const before=await host.snapshot(),sha256=await Core.sha256(text);current();
        const have=state.installed[Release.ID]?.version||s.baseVersion;
        if(Core.compareVersions(pack.version,have)<0||Core.compareVersions(pack.version,have)===0&&!allowInstalled)throw error('downgrade','此版本已经安装或比当前版本旧');
        if(pack.version===have&&state.installed[pack.id]?.sha256&&state.installed[pack.id].sha256!==sha256)throw error('version-collision','同版本正式更新包指纹不一致，未覆盖。');
        const progress=state.installed[Release.ID]?.release?.releaseProgress;
        if(progress&&pack.version===progress.targetVersion&&sha256!==progress.sha256)throw error('version-collision','同版本更新包内容已变化');
        const plan=await Release.plan({pack,sha256,before,state,seed:s,Core,Host});
        const stamp=await previewHash(before);
        const plugins=(api.parent||api).CxxPlugins?.read?.().rows||[],inventory=Unified?await Unified.inventory({Core,before:plan.before,after:plan.after,version:pack.version,currentVersion:have,plugins}):[];
        current();
        localPackage={pack,sha256,allowInstalled,previewHash:stamp,context:contextIdentity(expected),summary:{counts:plan.counts,conflicts:plan.conflicts,progress:plan.releaseProgress,inventory}};
        activeTab='update';report('更新包已核对：'+pack.version+'。'+(plan.conflicts.length?'玩家修改会保留，冲突及依赖组暂缓。':'')+'确认后安装。');
        return localPackage;
      },{waitForIdle:true});
    }
    async function prepareOnline(latest){
      if(!unified)throw error('update-not-ready','卡内更新服务尚未就绪。');
      if(!latest){await discovery?.check(true);latest=discovery?.state().latest;}
      if(!latest)throw error('update-catalog','尚未取得可核对的正式版本目录。');
      activeTab='update';return unified.prepare(latest);
    }
    async function openChat(chatId) {
      // The story service also restores the profile and binds this route's
      // own worldbook. Opening only the host chat leaves imported profiles
      // pointing at the source story while the new chat has no bound book.
      if(stories?.store){await stories.store.switchStory(chatId);return;}
      const c=api.SillyTavern?.getContext();
      if(typeof c?.openCharacterChat!=='function'){report('聊天已保存，请从聊天列表打开：'+chatId);return;}
      await c.openCharacterChat(chatId);
    }
    async function rollbackRelease() {
      await saveAction(async()=>host.withLock(async()=>{
        await recover();const state=host.readState(),name=state.lastReleaseBackup;
        if(!name)throw error('backup-missing','没有上一版组件备份');
        const record=await host.readReleaseBackup(name),j=record?.journal;
        if(record?.instanceId!==state.instanceId||!j?.previousLedger||j.installed.scope!=='character')throw error('backup-missing','上一版组件备份不完整');
        host.setScope('character');const before=await host.snapshot(),reversal=Release.rollback({before,journal:j,Core});
        if(reversal.blocked)throw error('rollback-player-conflict','更新后又修改了相关组件，已保留当前内容；请先处理冲突：'+reversal.conflicts.map(x=>x.path).join('、'));
        const after=reversal.after;
        after.worldbook.internalName=before.worldbook.internalName;
        const saved=await backup.beforeContentInstall({alreadyLocked:true});
        const backed=host.readState();backed.lastChatBackup=saved;await host.saveState(backed);
        const old=j.previousLedger,result=await transaction(before,after,old.installed,old.baseline,old.conflicts,'character',old.componentPackages);
        if(result?.status!=='committed')throw error('release-not-installed','回退未完成，请处理未完成的安装');
        const next=host.readState();next.policy={...next.policy,basic:false,basicConsent:false};delete next.lastReleaseBackup;await host.saveState(next);
        report('已恢复上一版组件。');
      }));
    }
    function renderPanel() {
      if(!panel)return;
      const UI=options.panelModule||root.CxxUpdatePanel;if(!UI)throw error('ui-unavailable','更新界面模块未加载');
      const state=host.readState(),version=readSeed().baseVersion;
      panelBlocked=running||saveRunning||host.getContext().busy;
      const errorUI=e=>{lastError={code:e.code||'operation-failed',message:e.message};report(e.message);};
      UI.render(panel,{tab:activeTab,status,version,recovery:pendingRecovery,capabilities:crypto.capabilities(),state,local:localPackage,online:unified?.read(),discovery:discovery?.state(),busy:panelBlocked||!!unified?.read().busy,error:lastError,download:migrationExport?.download,migration:migrationPreview,restore:restorePreview},{
        error:errorUI,close:closePanel,openRecoveryStory,tab(id){activeTab=id;renderPanel();},
        discover:()=>prepareOnline(),autoCheck:value=>discovery?.setEnabled(value),onlineInstall:()=>unified.apply(),
        openStories:()=>stories?.open(),
        install:()=>check(true,'manual'),
        packageFile:file=>{invalidatePackage();return saveAction(async()=>{const current=fileReadCurrent('package'),text=await readFile(file);current();return previewLocalPackage(text);});},
        exportMigration:()=>saveAction(async()=>{
          await host.ready('export');
          clearMigrationExport();const epoch=migrationEpoch;report('正在准备完整续玩存档');const expected=host.getContext(),result=await backup.captureMigration();
          host.assertContext(expected);const download=await backup.prepareExportFile(result.document);
          try{host.assertContext(expected);if(epoch!==migrationEpoch)throw error('migration-export-stale','聊天已变化，请重新准备续玩存档');}catch(e){download.revoke();throw e;}
          migrationExport={document:result.document,context:expected,download};report('续玩存档已准备好，请点击下载。');
        }),assertDownload(){if(!migrationExport)throw error('migration-export-stale','聊天已变化，请重新准备续玩存档');host.assertContext(migrationExport.context);try{backup.assertExportCurrent?.(migrationExport.document);}catch(e){clearMigrationExport();throw e;}},
        migrationFile:file=>saveAction(async()=>{migrationDocument=null;migrationPreview=null;const current=fileReadCurrent('migration'),text=await backup.readImportFile(file);current();const parsed=await backup.parseMigration(text);current();const preview=await backup.previewMigration(parsed);current();migrationDocument=parsed;migrationPreview=preview;report('存档兼容，确认后会新建续玩聊天。');}),
        importMigration:()=>saveAction(async()=>{const result=await backup.importMigration(migrationDocument,{preview:migrationPreview,confirm:'migrate-copy'});migrationDocument=null;migrationPreview=null;report('续玩聊天已保存');await openChat(result.chatId);}),
        rollback:rollbackRelease,recover:()=>saveAction(async()=>{report('正在检查并恢复未完成安装');let r;try{r=await recoverPending();}finally{await inspectRecovery();}report(r.status==='none'?(r.otherInstance?'安装记录属于另一实例，不影响当前故事，可以导出续玩存档。':'当前实例没有待恢复安装，可以导出续玩存档。'):'安装记录已恢复并核对，可以导出续玩存档。');}),openChat,
        exportRescue:()=>saveAction(async()=>{report('正在准备救援文件');await backup.exportFile(await backup.captureRescue());report('救援文件下载已发起；此文件需核查，不能直接作为续玩存档导入。');}),
        exportBackup:()=>saveAction(async()=>{await backup.exportFile(await backup.captureFull());report('完整聊天备份下载已发起');}),
        backupFile:file=>saveAction(async()=>{restoreDocument=null;restorePreview=null;const current=fileReadCurrent('migration'),text=await backup.readImportFile(file);current();const parsed=await backup.parse(text);current();const preview=await backup.previewRestore(parsed);current();restoreDocument=parsed;restorePreview=preview;report('聊天备份已核对。');}),
        restore:()=>saveAction(async()=>{const result=await backup.restoreCopy(restoreDocument,{preview:restorePreview,confirm:'restore-copy'});restoreDocument=null;restorePreview=null;await openChat(result.chatId);})
      });
    }

    function closePanel() {
      if(!unified?.read().busy)invalidatePackage();panel?.remove();panel=null;panelBlocked=null;const prior=panelReturnFocus;panelReturnFocus=null;if(prior?.isConnected)prior.focus({preventScroll:true});
    }
    function openPanel(tab) {
      if (!alive) return;
      (api.parent||api).__cxx_launcher__?.close();
      if (['update', 'migration', 'recovery'].includes(tab)) activeTab = tab;
      if (!panel) {
        const doc = uiDocument(); if (!doc) throw error('ui-unavailable', '当前环境无法打开更新面板');panelReturnFocus=doc.activeElement;
        panel = doc.createElement('section'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '更新与存档'); panel.setAttribute('data-cxx-update-panel',''); panel.setAttribute('tabindex', '-1');
        panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePanel();}});
        doc.body.append(panel);
      }
      renderPanel();Popover.show(panel); panel.focus();
      void inspectRecovery().catch(e=>{if(alive&&panel&&e.code!=='context-changed'){lastError={code:e.code||'recovery-inspect',message:e.message};renderPanel();}});
    }
    function stop() {
      if (!alive) return;
      alive = false; if (timer) clearInterval(timer);
      unified?.stop();invalidatePackage();discovery?.stop();mailbox?.destroy();if((api.parent||api).CxxMailbox===mailbox)delete (api.parent||api).CxxMailbox;
      gameplay = null;stories?.destroy();stories=null;
      host.stopChatSaveGuard?.();
      for (const dispose of disposers) dispose();
      panel?.remove(); panel = null; panelReturnFocus=null; clearMigrationExport();
    }
    function listen(name, callback) {
      if (!name || typeof api.eventOn !== 'function') return;
      const guarded = (...args) => alive ? callback(...args) : undefined;
      const listener = api.eventOn(name, guarded);
      disposers.push(() => {
        if (typeof api.eventRemoveListener === 'function') api.eventRemoveListener(name, guarded);
        else if (listener?.stop) listener.stop();
      });
    }
    async function start() {
      readSeed(); contextAtStart = host.getContext();
      if(Unified){const surface=api.parent||api;let sessionStorage;try{sessionStorage=surface.localStorage;}catch{}
       if(PluginCheck&&surface.document?.createElement&&(surface.CxxPlugins?.updateProtocol!==1||surface.CxxPlugins?.minimumVersionProtocol!==1))PluginCheck.install(surface,api);
       const cache=surface.caches?Object.fromEntries(['match','put','delete'].map(method=>[method,(...args)=>surface.caches.open('cyber2051-update-packages-v1').then(c=>c[method](...args))])):null;
       const pluginProxy={check:()=>surface.CxxPlugins?.check()||Promise.resolve(),read:()=>surface.CxxPlugins?.read()||{rows:[],installation:{}},installMissing:ids=>surface.CxxPlugins.installMissing(ids),updateInstalled:(ids,minimums)=>surface.CxxPlugins.updateInstalled(ids,minimums)};
       unified=Unified.create({Core,scope:()=>contextIdentity(host.getContext()),currentVersion:()=>readSeed().baseVersion,preview:text=>previewLocalPackage(text,{allowInstalled:true}),install:installPrepared,installed:item=>{const v=host.readState().installed?.[Release.ID];return v?.version===item.version&&v.sha256===item.sha256&&!v.release?.releaseProgress;},plugins:pluginProxy,resources:()=>surface.CxxResources?.read?.(),
        updaterHash:()=>Core.sha256(Release.flatten(api.getScriptTrees({type:'character'})).find(s=>s.id===Release.UPDATER).content),upgradeUpdater:async value=>{const U=typeof module==='object'&&module.exports?require('./upgrader.js'):root.CxxUpdaterUpgrade;if(!U)throw error('update-upgrader','更新器升级模块尚未就绪。');return U.create({api,manifest:value.manifest,content:value.content,Core,Host,Controller:{create},Backup,report}).run();},
        documentTimeOrigin:surface.performance?.timeOrigin,fetch:options.fetch||root.fetch?.bind(root),storage:sessionStorage,cache,change(value){report(value.status);},reload(){surface.location.reload();}});
      }
      host.startChatSaveGuard?.();
      if(root.CxxStoryLibrary&&backup)stories=root.CxxStoryLibrary.create({api,top:api.parent||api,host,backup,Core,crypto:CryptoCompat}).start();
      const win=api.parent||api;let mailStorage;try{mailStorage=win.localStorage;}catch{}if(Mailbox&&win.document){win.CxxMailbox?.destroy();mailbox=Mailbox.create({win,fetcher:options.fetch||root.fetch?.bind(root),verify:doc=>verifyDocument(doc,readSeed().trustedKeys,Core,crypto),storage:mailStorage});win.CxxMailbox=mailbox;win.dispatchEvent?.(new win.Event('cxx-mail-ready'));if(api.getButtonEvent)listen(api.getButtonEvent('邮件'),()=>mailbox.open());}
      for(const name of new Set(['MESSAGE_SENT','MESSAGE_RECEIVED','MESSAGE_UPDATED','MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SWIPED','GENERATION_STARTED'].map(k=>api.tavern_events?.[k]).filter(Boolean)))listen(name,invalidateSave);
      listen(api.iframe_events?.GENERATION_REQUESTED,invalidateSave);
      listen('cxx:update:request', value => command(value).catch(e => report(e.message)));
      listen(api.iframe_events?.GENERATION_REQUESTED, (id, kind, config) => host.mvuGenerationRequested?.(id, kind, config));
      listen(api.iframe_events?.GENERATION_STARTED, id => host.generationStarted(id));
      listen(api.iframe_events?.GENERATION_ENDED, (_text, id) => { host.generationEnded(id); queued = true; });
      listen(api.tavern_events?.GENERATION_STARTED, (_type,_options,dryRun) => { if(!dryRun)host.generationStarted('native'); });
      for(const name of [api.tavern_events?.GENERATION_ENDED,api.tavern_events?.GENERATION_STOPPED])listen(name,()=>{host.generationEnded('native');queued=true;});
      listen(api.tavern_events?.MESSAGE_SWIPED,()=>{queued=true;});
      listen(api.tavern_events?.CHAT_CHANGED, () => {
        const next = host.getContext();
        if (next.characterKey !== contextAtStart.characterKey) { stop(); return; }
        // A plugin can save the newly loaded chat before this listener runs.
        // Reuse that chat's ticket; resetting it would cancel the same save.
        // Reloading the same chat still captures a new loaded baseline.
        host.resetChatSaveGuard?.({reuseScope:next.chatId!==contextAtStart.chatId})?.catch(e=>report(e.message));
        // TH keeps this character's script iframe when only its chat changes.
        // An in-flight check retains its own expected context and cannot follow.
        if (next.chatId !== contextAtStart.chatId) { mailbox?.close(); invalidatePackage();invalidateSave();panel?.remove(); panel = null; restoreDocument = null; restorePreview = null; migrationDocument = null; migrationPreview = null; clearMigrationExport(); pendingRecovery=null; contextAtStart = next; }
        queued = true;
      });
      // Button name is stable; the helper provides its exact event identifier.
      if (typeof api.getButtonEvent === 'function') listen(api.getButtonEvent('卡更新'), openPanel);
      api.addEventListener?.('pagehide', stop, { once: true });
      timer = setInterval(() => {
        if (!alive || root.document?.hidden) return;
        if(resumePending&&unified&&!unified.read().busy&&!host.getContext().busy&&!running&&!saveRunning){resumePending=false;void unified.resume().catch(e=>{if(['host-busy','update-already-running'].includes(e.code))resumePending=true;else report(e.message);});return;}
        if(!host.getContext().busy)discovery?.check(false).catch(()=>{});
        if(onlinePending&&unified&&!unified.read().busy&&!host.getContext().busy&&!running&&!saveRunning){const item=onlinePending;onlinePending=null;prepareOnline(item).catch(e=>report(e.message));}
        if (panel && panelBlocked !== (running || saveRunning || host.getContext().busy)) renderPanel();
        if (Date.now() < retryAfter) return;
        if (queued&&!unified?.read().busy) check(false, 'sync').catch(e => report(e.message));
      }, 5000);
      queued = true; await check(false, 'sync');if(!host.getContext().busy)discovery?.check(false).catch(()=>{});resumePending=!!unified;return { status };
    }
    return { start, stop, check, installPrepared, command, openPanel, getStatus: () => status,
      initialize, initializeChat, getPackages, recover, recoverPending, inspectRecovery, syncChat, host, storage, backup, readSeed, hostModule:Host,discovery,rollbackRelease,invalidateSave,prepareOnline,online:()=>unified,runtimeHash:()=>runtimeHash,
      activity:()=>({running,saveRunning,storyOperations}),
      async pauseForStory(){
        storyOperations++;let released=false;const release=()=>{if(!released){released=true;storyOperations--;}};
        const expected=host.getContext();
        try{while(alive&&(running||saveRunning)){host.assertContext(expected,true);await new Promise(resolve=>setTimeout(resolve,100));}
          if(!alive)throw error('updater-stopped','更新脚本已卸载');host.assertContext(expected,true);
          return release;
        }catch(e){release();throw e;}
      },
      async whenIdle() {
        let attempted='',shown='';
        while(alive){
          if(running||saveRunning){await new Promise(resolve=>setTimeout(resolve,100));continue;}
          const pending=host.readState().journalName;
          if(!pending)return;
          // 孤儿安装记录（备份已不存在，来自上次换卡/导入残留）：恢复无从谈起，
          // 留着这个指针只会让本循环永久自旋，连带卡死剧情推进与真实宿主验收。
          if(await host.journalOrphan()){
            const fresh=host.readState();
            if(fresh.journalName||fresh.pendingRegistry){delete fresh.journalName;delete fresh.pendingRegistry;await host.saveState(fresh);}
            continue;
          }
          // A queued/busy recovery used to kill the core at startup permanently.
          // Recover through the existing transaction checks, then resume this same core.
          const scope=JSON.stringify([pending,host.getContext().chatId]);
          if(attempted!==scope&&!host.getContext().busy){attempted=scope;await check(false);continue;}
          if(attempted===scope&&shown!==scope){shown=scope;report(lastError?.message||'正在等待未完成的安装恢复');try{openPanel('recovery');}catch(e){console.warn('[卡更新恢复]',e.message);}}
          await new Promise(resolve=>setTimeout(resolve,250));
        }
        throw error('updater-stopped','更新脚本已卸载');
      },
      attachContentSync(value) { contentSync=value; return ()=>{if(contentSync===value)contentSync=null;}; }, transaction, previewLocalPackage,
      attachGameplay(value) { gameplay=value; return ()=>{if(gameplay===value)gameplay=null;}; } };
  }
  return { create, verifyDocument, ownership, selection, CATALOG, COMPONENT_CATALOG, RELEASE_CATALOG };
});
