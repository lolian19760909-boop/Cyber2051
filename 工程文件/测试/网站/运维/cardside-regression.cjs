'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const assert = require('node:assert/strict');
let passed = 0;
async function test(name, fn) { await fn(); console.log('PASS ' + name); passed++; }
function load(file, globals, exports) {
  const ctx = vm.createContext({ crypto, TextEncoder, TextDecoder, Uint8Array, console, ...globals, $() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../../卡片源码/工坊", file), 'utf8') + '\nglobalThis.api = {' + exports + '};', ctx);
  return ctx.api;
}
const detail = { id: 1, type: 'world_factor', title: 'test', revision: 1, payload: { worldFactors: [{ title: 't', content: 'source' }] } };
let book = null, entries = [], createCalls = 0, beforeUpdate = () => {}, confirms = [];
const shop = load('001-创意工坊装载-审阅稿.js', {
  getChatWorldbookName: () => book,
  getOrCreateChatWorldbook: async (_current, name) => { assert.equal(name, undefined); createCalls++; return book = 'unique-chat-book'; },
  getWorldbook: async () => structuredClone(entries),
  updateWorldbookWith: async (_name, cb) => { beforeUpdate(); entries = await cb(structuredClone(entries)); entries.forEach((e, i) => { e.uid ??= i + 100; }); },
  confirm: () => confirms.length ? confirms.shift() : true, prompt: () => null,
  fetch: async () => ({ json: async () => ({ ok: true, item: detail }) }),
  localStorage: { getItem() { return null; } },
}, 'listInstalled, inspectPackage, installItem, uninstallItem, metaOf, findInstalledByPackage');
let names = { primary: 'base 1.0.0', additional: ['personal-book'] }, regex = [{ id: 'old' }], scripts = [{ id: 'old' }], books = new Map([['base 1.0.0', []]]), failRegex = false, events = [];
const updater = load('002-卡更新器-审阅稿.js', {
  getCharWorldbookNames: () => structuredClone(names), getWorldbook: async (name) => books.get(name),
  getTavernRegexes: () => regex, getScriptTrees: () => scripts,
  createWorldbook: async (name, rows) => { events.push('create'); if (books.has(name)) return false; books.set(name, rows); return true; },
  rebindCharWorldbooks: async (_current, value) => { events.push('bind'); names = structuredClone(value); },
  replaceTavernRegexes: async (value) => { events.push('regex'); if (failRegex) { failRegex = false; throw Error('synthetic regex failure'); } regex = value; },
  replaceScriptTrees: (value) => { events.push('scripts'); scripts = value; },
}, 'snapshotCurrent, applyPack, validatePack');
function pack(version) { return { packFormat: 2, cardId: 'cyber2051', cardVersion: version, counts: { worldbook: 1, regex: 1, scripts: 1 }, components: { worldbook: { internalName: 'base ' + version, entries: [{ content: 'new', strategy: {}, position: {}, effect: {} }] }, regex: { scripts: [{ id: 'new', find_regex: 'x', source: {}, destination: {} }] }, scripts: { trees: [{ id: 'new' }] } } }; }
(async () => {
  await test('浏览不创建聊天世界书', async () => { await shop.listInstalled(); assert.equal(createCalls, 0); });
  await test('装载使用聊天专属书，字段及元数据可保留', async () => { await shop.installItem(detail, null); assert.equal(createCalls, 1); assert.equal(entries[0].position.type, 'before_character_definition'); assert.equal(shop.metaOf(entries[0]).source, 'cyber2051-workshop'); });
  await test('新装条目不误判为玩家修改', async () => assert.equal((await shop.inspectPackage(detail, await shop.listInstalled())).dirty, false));
  await test('更新保留 uid、禁用状态及自定义字段', async () => { entries[0].enabled = false; entries[0].extra.custom = 'keep'; const uid = entries[0].uid; detail.revision = 2; await shop.installItem(detail, book); assert.equal(entries[0].uid, uid); assert.equal(entries[0].enabled, false); assert.equal(entries[0].extra.custom, 'keep'); });
  await test('预览后的修改会阻止覆盖', async () => { detail.revision = 3; beforeUpdate = () => { entries[0].content = 'user concurrent edit'; }; await assert.rejects(shop.installItem(detail, book), /预览后/); beforeUpdate = () => {}; assert.equal(entries[0].content, 'user concurrent edit'); });
  await test('修改过的条目拒绝卸载时保留', async () => { confirms = [false]; await shop.uninstallItem(detail, book); assert.equal(entries.length, 1); });
  await test('脱离副本不被当作同源安装', async () => { assert.equal(shop.findInstalledByPackage({ items: [{ extra: { __cxx_shop_meta: { source: 'user-detached', packageId: '1' } } }] }, 1), undefined); });
  await test('新书创建在先，保留附加绑定，脚本写入最后', async () => { const snap = await updater.snapshotCurrent(); await updater.applyPack(pack('1.1.0'), snap); assert.deepEqual(Array.from(names.additional), ['personal-book']); assert.equal(names.primary, 'base 1.1.0'); assert.deepEqual(events, ['create', 'bind', 'regex', 'scripts']); assert.ok(books.has('base 1.0.0')); });
  await test('写入失败恢复原绑定和正则，不替换脚本', async () => { const snap = await updater.snapshotCurrent(); events = []; failRegex = true; await assert.rejects(updater.applyPack(pack('1.2.0'), snap), /已尝试恢复/); assert.equal(names.primary, snap.localWorldbookName); assert.equal(events.includes('scripts'), false); });
  await test('已有同名书不会被覆盖', async () => { const snap = await updater.snapshotCurrent(); await assert.rejects(updater.applyPack(pack('1.2.0'), snap), /已存在/); });
  await test('旧 raw 包被拒绝，零写入', async () => { const snap = await updater.snapshotCurrent(), p = pack('1.3.0'); p.packFormat = 1; events = []; await assert.rejects(updater.applyPack(p, snap), /格式 2/); assert.equal(events.length, 0); });
  console.log('RESULT ' + passed + ' passed / 0 failed（模拟助手，非真实酒馆）');
})().catch(e => { console.error(e); process.exitCode = 1; });
