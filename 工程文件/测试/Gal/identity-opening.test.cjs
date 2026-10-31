'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const opening = require("../../卡片源码/Gal/identity-opening.js");
const demo = { id: 'demo.identity', name: '演示身份', opening: '【仅用于测试】\n这是一篇通用开场。' };

test('default identities are four authorless drafts and nothing is selected automatically', () => {
  const model = opening.createSelection();
  assert.deepEqual(model.identities.map(entry => entry.id), ['corpo','street','student','custom']);
  assert.equal(model.selectedIdentity, null); assert.equal(model.selectedEra, null); assert.equal(model.canStart, false);
  for (const entry of model.identities) for (const era of model.eras) {
    const selected = opening.createSelection({ identityId: entry.id, eraId: era.id });
    assert.equal(selected.canStart, false); assert.equal(selected.opening, ''); assert.match(selected.reason, /待作者编写/);
  }
});
test('both eras retain the exact same single authored opening', () => {
  const before = JSON.stringify(demo);
  const models = ['2050-12','2051-04'].map(eraId => opening.createSelection({ identities:[demo], identityId:demo.id, eraId }));
  assert.equal(models[0].opening, demo.opening); assert.equal(models[1].opening, demo.opening);
  assert.equal(models[0].canPreview, true); assert.equal(models[1].canPreview, true);
  assert.equal(models[0].canStart, false); assert.equal(models[1].canStart, false);
  assert.equal(JSON.stringify(demo), before); assert.equal(models[1].initialStateReady, false);
});
test('supplied workshop identities are not selected merely by being installed', () => {
  const model = opening.createSelection({ identities:[demo], eraId:'2051-04' });
  assert.equal(model.selectedIdentity, null); assert.equal(model.opening, ''); assert.equal(model.canStart, false);
});
test('a workshop identity must contain one nonempty plain-text opening', () => {
  for (const value of [undefined,'','  ',null,{'2050-12':'早期','2051-04':'后期'}]) assert.throws(() => opening.validate({ ...demo, opening:value }), /通用开场/);
  assert.throws(() => opening.validate({ ...demo, openings:{} }), /不支持字段/);
  assert.throws(() => opening.validate({ ...demo, opening:'<script>run()</script>' }), /静态文本/);
});
test('unknown era, identity and duplicate identifiers are rejected', () => {
  assert.throws(() => opening.createSelection({ eraId:'2051-05' }), /未知的起始时间/);
  assert.throws(() => opening.createSelection({ identityId:'unknown' }), /未知的身份/);
  assert.throws(() => opening.createSelection({ identities:[{...demo,id:'corpo'}] }), /编号重复/);
  assert.throws(() => opening.createSelection({ identities:[demo,demo] }), /编号重复/);
});
test('choosing April without authored task IDs cannot invent skipped tasks or rewards', () => {
  const model = opening.createSelection({ identities:[demo], identityId:demo.id, eraId:'2051-04' });
  assert.deepEqual(model.timelineTaskIds, []); assert.equal(model.initialStateReady, false);
  for (const field of ['terminal','wallet','completedQuests','rewards','initialState']) assert.equal(Object.hasOwn(model,field),false);
  assert.throws(() => opening.validate({...demo,initialState:{terminal:{wallet:{yen:1000}}}}), /不支持字段/);
});
test('selection text explains missing manuscript and the separate initial-state gate', () => {
  assert.match(opening.describe(opening.createSelection({identityId:'corpo'})), /待作者编写/);
  const model=opening.createSelection({identities:[demo],identityId:demo.id,eraId:'2050-12'});
  assert.match(opening.describe(model), /两档时间共用/); assert.match(opening.describe(model), /初始状态尚待确认/);
});
const manifest = { version: 'fixture-1', identities: [{ id: 'corpo', label: '公司职员', body: '【夹具】一篇通用正文。' }],
  timelines: [{ id: '2050-12', label: '作者的较早背景', initialState: { story: { date: '2050-12' } }, timelineEvents: [] }] };
test('authored builtins and external previews coexist without auto-selection or authorising writes', () => {
  const before = JSON.stringify(manifest);
  const model = opening.createSelection({ manifest, identities: [demo] });
  assert.equal(model.selectedIdentity, null); assert.equal(model.selectedEra, null);
  assert.equal(model.identities[0].name, '公司职员'); assert.equal(model.identities[0].draft, false);
  assert.equal(model.identities[1].draft, true); assert.equal(model.identities.at(-1).source, 'external');
  for (const eraId of ['2050-12', '2051-04']) {
    const selected = opening.createSelection({ manifest, identityId: 'corpo', eraId });
    assert.equal(selected.opening, manifest.identities[0].body); assert.equal(selected.canStart, false);
    assert.equal(selected.initialStateReady, false);
  }
  assert.equal(JSON.stringify(manifest), before);
});
test('malformed author projections cannot impersonate external identities or render executable material', () => {
  for (const identities of [[{ ...manifest.identities[0], id: demo.id }], [manifest.identities[0], manifest.identities[0]]]) {
    assert.throws(() => opening.createSelection({ manifest: { ...manifest, identities } }), /编号未知或重复/);
  }
  for (const body of ['<iframe src=x>', '<style>body{display:none}</style>', '<% code %>']) {
    assert.throws(() => opening.createSelection({ manifest: { ...manifest, identities: [{ ...manifest.identities[0], body }] } }), /静态文本/);
  }
  const blank = opening.createSelection({ manifest: { ...manifest, identities: [{ ...manifest.identities[0], body: '  ' }] }, identityId: 'corpo' });
  assert.equal(blank.selectedIdentity.draft, true); assert.equal(blank.canPreview, false);
});
