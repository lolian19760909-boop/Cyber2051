'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const C=require('../../网站/gateway/workshop-contract.cjs'),catalog=require('../../网站/gateway/contract-places.json'),engineering=path.resolve(__dirname,'../..');
test('shared catalog matches map sources and retains the original twelve-location API view', async () => {
  const { buildCatalog } = await import(pathToFileURL(path.join(engineering, "工具/构建/place-catalog.mjs")));
  assert.deepEqual(buildCatalog(), catalog);
  assert.deepEqual(catalog.maps.map(m => [m.id, m.places.length]), [['tokyo-central', 162], ['west-expansion', 19]]);
  assert.equal(C.schema().places.length, 12);
  assert.deepEqual(C.schema().maps, catalog.maps);
  for (const old of catalog.places) assert.ok(catalog.maps[0].places.some(p => p.id === old.id));
  assert.ok(!JSON.stringify(catalog.maps).includes('"desc"'), 'Identity catalog must not invent archives');
});
