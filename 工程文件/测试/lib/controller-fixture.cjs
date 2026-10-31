'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Core = require("../../卡片源码/运行时/core.js");
const Content = require("../../卡片源码/运行时/content.js");
const Controller = require("../../卡片源码/运行时/controller.js");
const Host = require("../../卡片源码/运行时/host.js");
const Tools = require("../../工具/发布/packages.cjs");
const copy = value => JSON.parse(JSON.stringify(value));
const bytes = value => Buffer.from(Tools.canonical(value));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const quest = (id = 'new-quest', pay = 100) => ({ id, title: '新委托', fixer: '中间人', district: '城区', type: '调查', difficulty: '普通', brief: '找到线索', goal: '汇报', pay, track: 'side' });
function definition(overrides = {}) {
  return Tools.createContentPackage({ id: 'official.story', version: '1.0.0', optional: false, activation: 'compatible', requires: { engine: '1.0.0', packages: [] }, content: { quests: [quest()], gallery: [], worldbook: [] }, ...overrides });
}
function officialComponents() {
  return { worldbook: { internalName: 'world 1.0.0', entries: [Host.normalizeEntry({ uid: 1, name: '基础条目', content: 'official story', enabled: true,
    strategy: { type: 'selective', keys: ['trigger'], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
    position: { type: 'after_character_definition', role: 'system', depth: 4, order: 100 }, effect: {}, recursion: {}, extra: {} })] },
    regex: { scripts: [{ id: 'regex-a', script_name: 'regex-a', enabled: true, find_regex: 'old', replace_string: 'old', trim_strings: [], source: { user_input: false, ai_output: true, slash_command: false, world_info: false, reasoning: false }, destination: { display: true, prompt: false }, run_on_edit: false, min_depth: null, max_depth: null }] },
    scripts: { trees: [{ type: 'script', id: 'script-a', name: 'script-a', enabled: true, content: 'old script', data: {}, button: { enabled: true, buttons: [] }, export_with: { data: true, button: true } }] } };
}
function coreDefinition(components, compatibilityWorldbookIds) {
  const next = copy(components); next.worldbook.internalName = 'world 1.0.1'; next.regex.scripts[0].replace_string = 'new'; next.scripts.trees[0].content = 'new script';
  return { format: 3, cardId: 'cyber2051', id: 'official.core', version: '1.0.1', kind: 'core', optional: false, requires: { engine: '1.0.0', packages: [] }, components: next,
    ...(compatibilityWorldbookIds ? { compatibilityWorldbookIds } : {}) };
}
function signedRelease(packages = [definition()]) {
  // Test-only keys exist solely in memory and are never written or published.
  const keys = crypto.generateKeyPairSync('ed25519');
  const release = Tools.buildRelease({ packages, privateKey: keys.privateKey, keyId: 'test-publisher' });
  return { ...release, keys, trusted: { 'test-publisher': keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') } };
}
function fixture(release, overrides = {}) {
  const registry = { format: 1, packages: {} };
  let state = { cardId: 'cyber2051', instanceId: 'test-instance', engineVersion: '1.0.0', installed: {}, baseline: { format: 1 }, registry,
    initialContent: { quests: [], gallery: [], worldbook: [] }, initialAvatars: {}, subscriptions: {}, policy: { basic: true, basicConsent: true, optionalConsent: true }, mediaPreferences: {}, conflicts: [], ...overrides.state };
  const currentContext = { cardId: 'cyber2051', characterKey: 'test-card.png', chatId: 'test-chat', busy: false };
  const journal = new Map(), writes = [], requests = [], commits = [], saves = [];
  const snapshot = { worldbook: { internalName: '', entries: [] }, regex: { scripts: [] }, scripts: { trees: [] }, registry: copy(state.registry) };
  const chat = { playerNote: 'keep this chat metadata' }, mvudata = { stat_data: { money: 1234, affection: 72, terminal: { quests: {} } } }, originalMvu = copy(mvudata);
  let scope = 'character', locked = false;
  const host = {
    getContext: () => copy(currentContext), assertContext(expected) { if (expected.characterKey !== currentContext.characterKey || expected.chatId !== currentContext.chatId) { const error = Error('context changed'); error.code = 'context-changed'; throw error; } },
    ready: async () => ({ st: '1.19.0', helper: '4.11.2' }),
    readState: () => copy(state), async saveState(value) { saves.push(copy(value)); state = copy(value); },
    setScope(value) { scope = value; }, getScope: () => scope,
    async withLock(work) { assert.equal(locked, false); locked = true; try { return await work(); } finally { locked = false; } },
    async snapshot() { return copy(snapshot); },
    async writeStage(stage, value, expected) {
      assert.equal(locked, true); assert.equal(Core.canonical(expected), Core.canonical(snapshot)); writes.push({ stage, scope }); snapshot[stage] = copy(value);
      if (stage === 'scripts' && overrides.helperScriptDefaults) for (const script of snapshot.scripts.trees) {
        script.info ??= ''; script.button ??= { enabled: true, buttons: [] }; script.export_with ??= { data: true, button: true };
      }
      if (stage === 'registry') state.pendingRegistry = copy(value);
    },
  };
  const storage = {
    async get(key) { return key.endsWith(':installed') ? commits.at(-1) || null : journal.has(key) ? copy(journal.get(key)) : null; },
    async claim(key, value) { assert.equal(locked, true); if (journal.has(key)) return false; journal.set(key, copy(value)); return true; },
    async set(key, value, options) {
      if (key.endsWith(':installed')) {
        if (options?.expectedId && journal.get('cxx-update-journal')?.id !== options.expectedId) return false;
        commits.push(copy(value)); state.installed = copy(value.installed); state.baseline = copy(value.baseline); state.conflicts = copy(value.conflicts || []); state.scope = value.scope; state.registry = copy(snapshot.registry);
        if (Object.hasOwn(value, 'componentPackages')) state.componentPackages = copy(value.componentPackages);
        delete state.pendingRegistry; return true;
      }
      if (options?.expectedId && journal.get(key)?.id !== options.expectedId) return false;
      journal.set(key, copy(value));
    },
    async remove(key, options) { if (options?.expectedId && journal.get(key)?.id !== options.expectedId) return false; return journal.delete(key); },
  };
  host.createStorage = () => storage;
  host.inspectInstall = async () => {
    const pending = journal.get('cxx-update-journal');
    return pending ? { kind: 'pending', backup: { journal: copy(pending) } } : { kind: 'none' };
  };
  const listeners = new Map(), listenerWrappers = new Map();
  function removeListener(name, callback) {
    const map = listenerWrappers.get(name), wrapped = map?.get(callback);
    if (wrapped) { listeners.get(name).delete(wrapped); map.delete(callback); }
  }
  const api = {
    document: overrides.document,
    tavern_events: { CHAT_CHANGED: 'test:chat-changed',GENERATION_STARTED:'test:generation-started',GENERATION_ENDED:'test:generation-ended',GENERATION_STOPPED:'test:generation-stopped' },
    eventOn(name, callback) {
      if (!listeners.has(name)) { listeners.set(name, new Set()); listenerWrappers.set(name, new Map()); }
      const wrapped = (...args) => callback(...args); listenerWrappers.get(name).set(callback, wrapped); listeners.get(name).add(wrapped);
      // TH4.11.2 passes wrapped into a remover whose map is keyed by callback.
      return { stop() { removeListener(name, overrides.brokenEventStop ? wrapped : callback); } };
    },
    eventRemoveListener: removeListener,
    getButtonEvent: name => 'test:button:' + name,
    getLastMessageId: () => 0,
    getVariables(option) { return option.type === 'chat' ? copy(chat) : option.type === 'message' ? copy(mvudata) : {}; },
    async updateVariablesWith(update, option) { assert.equal(option.type, 'chat'); Object.assign(chat, await update(copy(chat))); },
  };
  if (overrides.nativeEventRemove === false) delete api.eventRemoveListener;
  const catalogUrl = overrides.catalogUrl || (release.catalog.packages.some(p => p.kind === 'component') ? Controller.COMPONENT_CATALOG : Controller.CATALOG);
  const responses = new Map([[catalogUrl, release.catalogBytes], ...release.files.map(file => [file.entry.url, file.bytes])]);
  async function fetch(url, options) {
    requests.push(url); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); assert.equal(options.body, undefined);
    if (!responses.has(url)) throw Error('unexpected test URL ' + url);
    const payload = responses.get(url);
    return new Response(payload, { status: 200, headers: { 'content-length': String(payload.byteLength), 'content-type': 'application/json' } });
  }
  const seed = { cardId: 'cyber2051', engineVersion: '1.0.0', catalogUrl, trustedKeys: release.trusted,
    installed: {}, baseline: { format: 1 }, registry, initialContent: state.initialContent, characterIds: ['sakiko'], mapIndex: {} };
  const backups = [];
  const backup = overrides.backup === undefined ? { async beforeContentInstall() { assert.equal(locked, true); backups.push({ writesBefore: writes.length, context: copy(currentContext) }); return { backupId: 'test-chat-backup-' + backups.length }; } } : overrides.backup;
  const createController = () => Controller.create({ core: Core, content: Content, hostModule: Host, host, api, fetch, crypto: crypto.webcrypto, seed, backup });
  const controller = createController();
  return { controller, createController, api, host, storage, responses, requests, writes, commits, saves, backups, getState: () => state, currentContext, snapshot, chat, mvudata, originalMvu,
    emit(name, ...args) { return Promise.all([...(listeners.get(name) || [])].map(callback => callback(...args))); }, listenerCount(name) { return listeners.get(name)?.size || 0; } };
}
function replaceCatalog(h, release, mutate) {
  const doc = copy(release.catalog); mutate(doc);
  const signed = Tools.signDocument(doc, release.keys.privateKey, 'test-publisher');
  h.responses.set(Controller.CATALOG, bytes(signed)); return signed;
}
function componentDefinition(version = '1.0.0') {
  return Tools.createComponentPackage({ id: 'optional.script', version, optional: true, requires: { engine: '1.1.0', packages: [] },
    components: { scripts: { trees: [{ type: 'script', id: 'optional-script', name: '隔离组件', content: 'void ' + JSON.stringify(version) + ';', enabled: true, data: {} }] } } });
}
function lifecycleDocument() {
  const doc = { createElement(tag) { return { tag, ownerDocument: doc, children: [], style: { setProperty(key, value) { this[key] = value; } }, textContent: '',
    append(child) { child.parent = this; this.children.push(child); }, replaceChildren() { this.children = []; },
    setAttribute() {}, addEventListener() {}, focus() {}, remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); } }; } };
  doc.body = doc.createElement('body'); return doc;
}
