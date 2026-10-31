'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Content = require("../../卡片源码/运行时/content.js");
const copy = value => JSON.parse(JSON.stringify(value));
test('NPC and player starts are scoped data with explicit media, old notes remain notes',()=>{
 const entry={uid:1001,extra:{__cxx_player_start:{format:1,name:'隔离出身',background:'隔离背景',opening:'通用开场，仅供测试'},__cxx_npc:{format:1,name:'隔离NPC',identity:'测试身份',background:'测试背景',media:[{id:'portrait',url:'https://cyber2051.top/img/test.png',alt:'测试头像'}]}}};
 const r={packages:{'community.user_identity.1':{version:'1.0.1',optional:true,activation:'opt_in',content:{worldbook:[entry]},history:{}}}};
 assert.deepEqual(Content.storyChoices(r),{starts:[],npcs:[]});const options={subscriptions:{'community.user_identity.1':true},pins:{'community.user_identity.1':'1.0.1'}};
 const found=Content.storyChoices(r,options);assert.equal(found.starts[0].definitionRef.uid,1001);assert.equal(found.npcs[0].id,'community.user_identity.1:1001');assert.equal(found.npcs[0].media.length,1);
 const changed=copy(entry);changed.extra.__cxx_npc.media[0].url='javascript:run()';assert.throws(()=>Content.validateStoryMetadata(changed));
 const old=copy(r);delete old.packages['community.user_identity.1'].content.worldbook[0].extra;assert.deepEqual(Content.storyChoices(old,options),{starts:[],npcs:[]});
 const missing=copy(entry);delete missing.extra.__cxx_player_start.opening;assert.throws(()=>Content.validateStoryMetadata(missing));
});
const oldImage = 'https://cyber2051.top/img/old.png', newImage = 'https://cyber2051.top/img/new.png', customImage = 'https://cyber2051.top/img/player.png';
const quest = (id = 'q01', pay = 100) => ({ id, title: '委托', fixer: '中间人', district: '城区', type: '调查', difficulty: '普通', brief: '查清情况', goal: '汇报', pay });
const image = (url = oldImage) => ({ id: 'base.sakiko.standard.1', characterId: 'sakiko', category: 'standard', url });
const base = () => ({ quests: [quest()], gallery: { characters: [{ id: 'sakiko', standard: [oldImage], daily: [], av: oldImage }] } });
const content = (pay = 100, url = oldImage) => ({ quests: [quest('q01', pay)], gallery: [image(url)], worldbook: [] });
const registry = (record = {}) => ({ format: 1, packages: { 'cyber2051.base-content': { version: '1.0.0', activation: 'compatible', optional: false, content: content(), history: {}, ...record } } });
function browserContent(state, pins = {}) {
  const context = { URL, getVariables: option => {
    if (option.type === 'chat') return { __cxx_content_pins: pins };
    assert.equal(option.type, 'character'); return { [Content.NAMESPACE]: state };
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve("../../卡片源码/运行时/content.js"), 'utf8'), context);
  return context.CxxContent;
}

test('content rendering reads cloned definitions without mutating the card or installed registry', () => {
  const original = base(), installed = registry(), originals = [copy(original), copy(installed)];
  const result = Content.view(original, installed);
  result.quests[0].pay = 999; result.gallery.characters[0].standard.push(newImage);
  assert.deepEqual(original, originals[0]); assert.deepEqual(installed, originals[1]);
});
test('an accepted quest keeps its old reward and definition reference after the package changes', () => {
  const installed = registry({ version: '1.1.0', content: content(500, newImage), history: { '1.0.0': content() } });
  const ref = { packageId: 'cyber2051.base-content', version: '1.0.0', questId: 'q01' };
  const records = { q01: { state: '进行中', acceptedFloor: 12, definitionRef: ref } }, before = copy(records);
  const result = Content.view(base(), installed, records);
  assert.equal(result.quests[0].pay, 100); assert.deepEqual(result.quests[0].definitionRef, ref); assert.deepEqual(records, before);
});
test('unsubscribing DLC hides its new quests while retaining already accepted definitions', () => {
  const installed = { format: 1, packages: { dlc: { version: '1.0.0', optional: true, activation: 'compatible', content: { quests: [quest('dlc-a'), quest('dlc-b')], gallery: [], worldbook: [] }, history: {} } } };
  const ref = { packageId: 'dlc', version: '1.0.0', questId: 'dlc-a' };
  const result = Content.view(base(), installed, { 'dlc-a': { state: '进行中', definitionRef: ref } }, { subscriptions: { dlc: false } });
  assert.equal(result.quests.some(q => q.id === 'dlc-a'), true); assert.equal(result.quests.some(q => q.id === 'dlc-b'), false);
});
test('new_chat and opt_in packages stay inactive until this chat pins a version', () => {
  const installed = { format: 1, packages: { chapter: { version: '2.0.0', activation: 'new_chat', optional: false, content: { quests: [quest('chapter-a', 800)], gallery: [], worldbook: [] }, history: { '1.0.0': { quests: [quest('chapter-a', 200)], gallery: [], worldbook: [] } } } } };
  assert.equal(Content.view(base(), installed).quests.some(q => q.id === 'chapter-a'), false);
  assert.equal(Content.view(base(), installed, {}, { pins: { chapter: '1.0.0' } }).quests.find(q => q.id === 'chapter-a').pay, 200);
});
test('missing historical quest data warns and never silently applies the new reward', () => {
  const installed = registry({ version: '1.1.0', content: content(500) });
  const result = Content.view(base(), installed, { q01: { state: '进行中', definitionRef: { packageId: 'cyber2051.base-content', version: '1.0.0', questId: 'q01' } } });
  assert.notEqual(result.quests[0].pay, 500); assert.ok(result.contentWarnings.some(x => x.includes('原始版本缺失')));
});
test('stable image ids replace the intended slot and explicit player preferences survive', () => {
  const installed = registry({ version: '1.1.0', content: content(100, newImage), history: { '1.0.0': content() } });
  const result = Content.view(base(), installed, {}, { mediaPreferences: { 'base.sakiko.standard.1': { url: customImage } } });
  assert.deepEqual(result.gallery.characters[0].standard, [customImage]); assert.equal(result.assetMeta[customImage].id, 'base.sakiko.standard.1');
});
test('invalid remote image urls never reach the visible image list', () => {
  const installed = registry(); installed.packages['cyber2051.base-content'].content.gallery[0].url = 'javascript:alert(1)';
  assert.deepEqual(Content.view(base(), installed).gallery.characters[0].standard, [oldImage]);
});
test('player edits to base quest fields are retained while untouched fields can receive an update', () => {
  const local = base(); local.quests[0].title = '玩家改名';
  const installed = registry({ version: '1.1.0', content: content(500), history: { '1.0.0': content() } });
  const result = Content.view(local, installed, {}, { initialContent: content() });
  assert.equal(result.quests[0].title, '玩家改名'); assert.equal(result.quests[0].pay, 500);
});
test('player replacement of a base image url survives an official update without explicit preference metadata', () => {
  const local = base(); local.gallery.characters[0].standard[0] = customImage;
  const installed = registry({ version: '1.1.0', content: content(100, newImage), history: { '1.0.0': content() } });
  const result = Content.view(local, installed, {}, { initialContent: content() });
  assert.deepEqual(result.gallery.characters[0].standard, [customImage]);
});
test('conflicting quest ids in different packs warn and retain one deterministic definition', () => {
  const installed = { format: 1, packages: { a: { version: '1.0.0', content: { quests: [quest('new-id', 100)], gallery: [], worldbook: [] } }, b: { version: '1.0.0', content: { quests: [quest('new-id', 500)], gallery: [], worldbook: [] } } } };
  const result = Content.view(base(), installed);
  assert.equal(result.quests.filter(q => q.id === 'new-id').length, 1); assert.equal(result.quests.find(q => q.id === 'new-id').pay, 100);
  assert.ok(result.contentWarnings.some(x => x.includes('任务编号冲突')));
});
test('a first-release image resolves its own safe fallback URL through the legacy gallery path', () => {
  const asset = { ...image(newImage), id: 'new.sakiko.standard.1', fallbackUrl: oldImage };
  const state = { cardId: 'cyber2051', registry: registry({ content: { quests: [], gallery: [asset], worldbook: [] } }), initialContent: { gallery: [] } }, before = copy(state);
  assert.equal(browserContent(state).fallback(newImage), oldImage);
  assert.deepEqual(state, before);
});
test('unsafe incoming image fallback URLs and self-referential URLs are rejected', () => {
  for (const fallbackUrl of ['javascript:alert(1)', 'http://cyber2051.top/img/old.png', 'https://other.example/img/old.png', 'https://user@cyber2051.top/img/old.png', 'https://cyber2051.top/img/old.png#fragment', 'https://cyber2051.top/img/a b.png', 'data:image/png;base64,AA==', newImage]) {
    const state = { cardId: 'cyber2051', registry: registry({ content: { quests: [], gallery: [{ ...image(newImage), fallbackUrl }], worldbook: [] } }) };
    assert.equal(browserContent(state).fallback(newImage), '', fallbackUrl);
  }
});
test('original images and historical images retain precedence over the incoming fallback URL', () => {
  const state = { cardId: 'cyber2051', registry: registry({ version: '1.1.0', content: { quests: [], gallery: [{ ...image(newImage), fallbackUrl: customImage }], worldbook: [] }, history: { '1.0.0': content(100, oldImage) } }), initialContent: { gallery: [image('https://cyber2051.top/img/original.png')] } };
  const browser = browserContent(state);
  assert.equal(browser.fallback(newImage), 'https://cyber2051.top/img/original.png');
  state.initialContent.gallery = [];
  assert.equal(browser.fallback(newImage), oldImage);
  state.registry.packages['cyber2051.base-content'].history = {};
  assert.equal(browser.fallback(newImage), customImage);
});

test('a pinned historical image uses its own fallback and excludes the current version image', () => {
  const asset = { ...image(oldImage), id: 'new.sakiko.standard.1', fallbackUrl: customImage };
  const state = { cardId: 'cyber2051', registry: registry({ version: '2.0.0', activation: 'new_chat', content: { quests: [], gallery: [{ ...asset, url: newImage }], worldbook: [] }, history: { '1.0.0': { quests: [], gallery: [asset], worldbook: [] } } }), initialContent: { gallery: [] } };
  const pins = { 'cyber2051.base-content': '1.0.0' }, before = copy({ state, pins }), browser = browserContent(state, pins);
  assert.deepEqual(Array.from(browser.urls('sakiko', 'standard', [])), [oldImage]);
  assert.equal(browser.fallback(oldImage), customImage);
  assert.equal(browser.fallback(newImage), '');
  assert.deepEqual({ state, pins }, before);
});

test('new_chat and opt_in image fallbacks remain inactive without an available pinned version', () => {
  for (const activation of ['new_chat', 'opt_in']) {
    const state = { cardId: 'cyber2051', registry: registry({ activation, content: { quests: [], gallery: [{ ...image(newImage), fallbackUrl: oldImage }], worldbook: [] } }) };
    const pins = {}, browser = browserContent(state, pins);
    assert.equal(browser.fallback(newImage), '');
    pins['cyber2051.base-content'] = '9.0.0';
    assert.equal(browser.fallback(newImage), '');
    pins['cyber2051.base-content'] = '1.0.0';
    assert.equal(browser.fallback(newImage), oldImage);
  }
});

test('unsubscribed optional images expose no fallback even when the chat retains their pin', () => {
  const packageId = 'cyber2051.base-content', state = { cardId: 'cyber2051', subscriptions: { [packageId]: false }, registry: registry({ optional: true, content: { quests: [], gallery: [{ ...image(newImage), fallbackUrl: oldImage }], worldbook: [] } }) };
  const browser = browserContent(state, { [packageId]: '1.0.0' });
  assert.deepEqual(Array.from(browser.urls('sakiko', 'standard', [])), []);
  assert.equal(browser.fallback(newImage), '');
  state.subscriptions[packageId] = true;
  assert.deepEqual(Array.from(browser.urls('sakiko', 'standard', [])), [newImage]);
  assert.equal(browser.fallback(newImage), oldImage);
  state.subscriptions[packageId] = false;
  assert.equal(browser.fallback(newImage), '');
});
