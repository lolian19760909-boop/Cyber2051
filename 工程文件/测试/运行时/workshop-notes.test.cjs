'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Content = require("../../卡片源码/运行时/content.js");
const packageId = 'community.world_factor.1', publisherId = '2222222222222222';
const clone = value => JSON.parse(JSON.stringify(value));
const entry = (patch = {}) => ({ uid: 1000000001, content: '静态地点资料。\n下一段保留原换行。', extra: {
  __cxx_workshop_location: { mapId: 'tokyo-central', placeId: 'plaza', title: '投稿地点资料', templateKind: 'world_factor' },
  __cxx_workshop_source: { submissionId: 1, revision: 1, publisherId, creditName: '合成作者' },
}, ...patch });
const base = () => ({ nodes: [{ id: 'plaza', name: '新日本时代广场', group: 'imperial', cat: '地标' }], regions: [{ id: 'imperial', name: '皇核', cover: '街区' }], quests: [], gallery: { characters: [] } });
const registry = (entries = [entry()]) => ({ packages: { [packageId]: { version: '1.0.1', optional: true, activation: 'opt_in', content: { quests: [], gallery: [], worldbook: entries }, history: {} } } });
const options = () => ({ subscriptions: { [packageId]: true }, pins: { [packageId]: '1.0.1' } });
test('notes derive from signed metadata without changing map, registry or game records', () => {
  const original = base(), installed = registry(), records = { q01: { state: '进行中', definitionRef: { version: '1.0.0' } } };
  const before = JSON.stringify({ original, installed, records });
  const result = Content.view(original, installed, records, options()), note = result.workshopNotes[0];
  assert.equal(result.workshopNotes.length, 1); assert.equal(note.id, packageId + ':1000000001');
  assert.equal(note.packageId, packageId); assert.equal(note.version, '1.0.1'); assert.equal(note.mapId, 'tokyo-central'); assert.equal(note.placeId, 'plaza');
  assert.equal(note.title, '投稿地点资料'); assert.equal(note.body, entry().content); assert.equal(note.source.publisherId, publisherId);
  note.source.creditName = '改变展示副本'; assert.equal(JSON.stringify({ original, installed, records }), before);
  assert.equal(result.nodes, original.nodes); assert.equal(result.regions, original.regions); assert.equal(result.quests.length, 0);
});
test('subscription and explicit opt-in pin are both required; cancelling hides notes', () => {
  for (const change of [o => { o.subscriptions[packageId] = false; }, o => { delete o.subscriptions[packageId]; }, o => { delete o.pins[packageId]; }]) {
    const o = options(); change(o); assert.deepEqual(Content.view(base(), registry(), {}, o).workshopNotes, []);
  }
  for (const patch of [{ optional: false }, { activation: 'compatible' }, { activation: 'new_chat' }]) {
    const installed = registry(); Object.assign(installed.packages[packageId], patch);
    assert.deepEqual(Content.view(base(), installed, {}, options()).workshopNotes, []);
  }
});
test('historical pin selects historical notes and does not reveal newer text or newer credit', () => {
  const installed = registry(), record = installed.packages[packageId]; record.version = '1.0.2';
  record.history['1.0.1'] = clone(record.content); record.content.worldbook[0].content = '最新正文'; record.content.worldbook[0].extra.__cxx_workshop_source.creditName = '最新署名';
  const old = Content.view(base(), installed, {}, options()).workshopNotes[0];
  assert.equal(old.body, entry().content); assert.equal(old.source.creditName, '合成作者'); assert.equal(old.version, '1.0.1');
  const o = options(); o.pins[packageId] = '1.0.2'; assert.equal(Content.view(base(), installed, {}, o).workshopNotes[0].body, '最新正文');
  o.pins[packageId] = 'missing'; const missing = Content.view(base(), installed, {}, o); assert.deepEqual(missing.workshopNotes, []); assert.match(missing.contentWarnings.join(' '), /旧版本内容不可用/);
});
test('all supported note kinds work; quest templates are not passed off as notes', () => {
  for (const kind of ['world_factor', 'character', 'user_identity', 'encounter', 'function_zone', 'npc']) {
    const e = entry(); e.extra.__cxx_workshop_location.templateKind = kind;
    assert.equal(Content.view(base(), registry([e]), {}, options()).workshopNotes[0].templateKind, kind);
  }
  for (const kind of ['contract', 'side_story', 'unknown']) {
    const e = entry(); e.extra.__cxx_workshop_location.templateKind = kind;
    const result = Content.view(base(), registry([e]), {}, options()); assert.equal(result.workshopNotes.length, 0); assert.ok(result.contentWarnings.length);
  }
});
test('existing place only, one note ID, exact title/body bounds; invalid data is hidden with warning', () => {
  const valid = entry({ content: '文'.repeat(40000) }); valid.extra.__cxx_workshop_location.title = '题'.repeat(60);
  assert.equal(Content.view(base(), registry([valid]), {}, options()).workshopNotes[0].body.length, 40000);
  for (const change of [
    e => { e.content += '文'; }, e => { e.extra.__cxx_workshop_location.title += '题'; },
    e => { e.extra.__cxx_workshop_location.placeId = 'new-marker'; }, e => { e.extra.__cxx_workshop_location.mapId = 'west-expansion'; },
    e => { e.extra.__cxx_workshop_location.title = ''; }, e => { e.content = {}; }, e => { e.uid = -1; },
    e => { delete e.extra.__cxx_workshop_source; }, e => { e.extra.__cxx_workshop_source.publisherId = Number(publisherId); },
    e => { e.extra.__cxx_workshop_source.creditName = '名'.repeat(25); },
  ]) {
    const e = clone(valid); change(e); const result = Content.view(base(), registry([e]), {}, options());
    assert.equal(result.workshopNotes.length, 0); assert.ok(result.contentWarnings.length);
  }
  const duplicate = Content.view(base(), registry([entry(), entry()]), {}, options()); assert.equal(duplicate.workshopNotes.length, 1); assert.ok(duplicate.contentWarnings.length);
});
test('static restrictions match the backend and markup stays plain text', () => {
  for (const text of ['<% dangerous() %>', '< SCRIPT>bad</SCRIPT>', '</ script >', 'javascript :dangerous()', '文本\u0000尾', '文本\u007f尾']) {
    const result = Content.view(base(), registry([entry({ content: text })]), {}, options()); assert.equal(result.workshopNotes.length, 0); assert.ok(result.contentWarnings.length);
  }
  const text = '<NPC>普通设定</NPC>\n[说明](https://example.invalid/)';
  assert.equal(Content.view(base(), registry([entry({ content: text })]), {}, options()).workshopNotes[0].body, text);
});
test('unrelated worldbook and non-community packages produce no map notes', () => {
  const e = entry(); delete e.extra.__cxx_workshop_location;
  assert.deepEqual(Content.view(base(), registry([e]), {}, options()).workshopNotes, []);
  const installed = registry(); installed.packages['official.notes'] = installed.packages[packageId]; delete installed.packages[packageId];
  const o = { subscriptions: { 'official.notes': true }, pins: { 'official.notes': '1.0.1' } };
  assert.deepEqual(Content.view(base(), installed, {}, o).workshopNotes, []);
});

