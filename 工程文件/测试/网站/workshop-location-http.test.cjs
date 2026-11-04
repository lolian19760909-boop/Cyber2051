'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startFixture } = require("../../网站/gateway/workshop-contract.fixture.cjs");
const C = require("../../网站/gateway/workshop-contract.cjs");

for (const mapId of C.schema().maps.map(map => map.id)) test(mapId + ' drafts pass real local HTTP review with exact map identity and two approved revisions', async () => {
  const f = await startFixture();
  try {
    const owners = ['ordinary', 'other', 'authorized'].map(role => f.session(role)), admin = f.session('admin');
    let caseIndex = 0;
    const call = async (route, who, body) => {
      const response = await fetch(f.baseUrl + route, { method: body ? 'POST' : 'GET', headers: {
        ...(who ? { Authorization: 'Bearer ' + who.token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {})
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    };
    const schema = (await call('/api/workshop/contracts/schema')).body.schema;
    assert.deepEqual(schema.maps, C.schema().maps); assert.equal(schema.places.length, 12);
    for (const map of schema.maps.filter(map => map.id === mapId)) for (const form of schema.templates.filter(t => t.location !== false)) {
      // Stay within the real per-author limit; never disable rate limiting for a test.
      const owner = owners[caseIndex++ % owners.length];
      const place = map.places.at(-1);
      const payload=require('../../网站/gateway/workshop-gameplay-fixtures.cjs').payload(form.id);Object.assign(payload.contract||payload,{mapId:map.id,placeId:place.id});if(payload.gameplay){for(const row of [...payload.gameplay.shops,...payload.gameplay.services])row.location={mapId:map.id,placeId:place.id};for(const row of payload.gameplay.encounters)row.requires={...row.requires,location:{mapId:map.id,placeId:place.id}};}if(payload.contract)payload.contract.pay=0;else payload.keywords=['隔离地点'];
      const draft = { type: form.type, title: '地点隔离验证', summary: '隔离地图身份测试', authorName: '', tags: [], payload };
      const created = await call('/api/workshop/submissions', owner, draft); assert.equal(created.status, 201, JSON.stringify({ template: form.id, body: created.body }));
      const id = created.body.id, first = await call(`/api/admin/submissions/${id}/approve`, admin, { baseRevision: 1 });
      assert.equal(first.status, 200); const package1 = first.body.artifact.package;
      const record = form.type === 'contract' ? package1.content.quests[0] : package1.content.worldbook[0].extra.__cxx_workshop_location;
      assert.equal(record.mapId, map.id); assert.equal(record.placeId, place.id);
      const edited = await call(`/api/workshop/submissions/${id}/update`, owner, { ...draft, title: '地点隔离验证二版', baseRevision: 1 });
      assert.equal(edited.body.revision, 2);
      const second = await call(`/api/admin/submissions/${id}/approve`, admin, { baseRevision: 2 }); assert.equal(second.status, 200);
      assert.equal(second.body.artifact.package.id, package1.id); assert.equal(second.body.artifact.package.version, '1.0.2');
      const saved = await call(`/api/workshop/submissions/${id}/edit`, owner);
      assert.deepEqual(saved.body.item.payload, payload);
    }
  } finally { await f.close(); }
});
