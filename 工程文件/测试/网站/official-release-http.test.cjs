'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startFixture } = require("../../网站/gateway/official-release.fixture.cjs");
test('actual gateway HTTP preserves workshop APIs and enforces grant/preview/publish contract', async () => {
  const fixture = await startFixture();
  try {
    const authorized = fixture.session('authorized'), ordinary = fixture.session('ordinary'), admin = fixture.session('admin');
    const call = async (route, session, body) => {
      const response = await fetch(fixture.baseUrl + route, { headers: { ...(session ? { Authorization: 'Bearer ' + session.token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, method: body ? 'POST' : 'GET', ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json(), cors: response.headers.get('access-control-allow-origin') };
    };
    assert.equal((await call('/api/workshop/health')).status, 200);
    assert.equal((await call('/api/workshop/me', ordinary)).body.loggedIn, true);
    assert.equal((await call('/api/workshop/submissions')).status, 200);
    assert.equal((await call('/api/official/me')).status, 401);
    const ordinaryMe = await call('/api/official/me', ordinary); assert.equal(ordinaryMe.body.canPublishOfficial, false); assert.equal(ordinaryMe.cors, null);
    const card = await (await fetch(fixture.baseUrl + '/__fixture__/card.json')).json();
    assert.equal((await call('/api/official/preview', ordinary, { card })).status, 403);
    const me = await call('/api/official/me', authorized);
    assert.equal(me.body.publishingReady, true); assert.ok(me.body.publicKey.spkiBase64); assert.ok(me.body.displayName);
    const preview = await call('/api/official/preview', authorized, { card }); assert.equal(preview.status, 200); assert.equal(preview.body.packages.length, 2);
    assert.equal((await call('/api/admin/publishers/' + authorized.publisherId + '/official-release', ordinary, { enabled: false })).status, 401);
    const revoke = await call('/api/admin/publishers/' + authorized.publisherId + '/official-release', admin, { enabled: false }); assert.equal(revoke.body.canPublishOfficial, false);
    assert.equal((await call('/api/official/publish', authorized, { previewId: preview.body.previewId, previewHash: preview.body.previewHash })).status, 403);
    await call('/api/admin/publishers/' + authorized.publisherId + '/official-release', admin, { enabled: true });
    const accounts = await call('/api/admin/accounts', admin); assert.equal(accounts.body.items.find(item => item.publisher_id === authorized.publisherId).canPublishOfficial, true);
    const published = await call('/api/official/publish', authorized, { previewId: preview.body.previewId, previewHash: preview.body.previewHash }); assert.equal(published.status, 200); assert.equal(published.body.published, true);
    const again = await call('/api/official/publish', authorized, { previewId: preview.body.previewId, previewHash: preview.body.previewHash }); assert.equal(again.body.alreadyPublished, true);
    const audit = await call('/api/admin/official/releases', admin); assert.equal(audit.body.items[0].status, 'committed');
    assert.equal((await call('/api/workshop/feedback')).status, 200);
    assert.equal((await call('/api/official/preview', authorized, { card, keyId: 'attacker.key' })).status, 400);
  } finally { await fixture.close(); }
});


test('HTTP modern card keeps bundled stories and explicit content publishes independently', async () => {
  const fixture=await startFixture();
  try {
    const authorized=fixture.session('authorized'),card=await(await fetch(fixture.baseUrl+'/__fixture__/card.json')).json();
    const seed=card.data.extensions.tavern_helper.scripts.find(s=>s.data?.__cxx_update_seed).data.__cxx_update_seed;
    seed.engineVersion='1.4.0';seed.catalogUrl='https://cyber2051.top/updates/v3/component-manifest.json';
    const story=require('../../网站/gateway/official-release-fixtures.cjs').content('cyber2051.chip-night','0.9.0');
    seed.registry.packages[story.id]={version:story.version,optional:true,activation:'new_chat',content:story.content,history:{},historyActivation:{}};
    const call=async(route,body)=>{const r=await fetch(fixture.baseUrl+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+authorized.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,200);return r.json();};
    const preview=await call('/api/official/preview',{card});
    assert.deepEqual(preview.packages.map(p=>p.id),['cyber2051.base-content']);assert.equal(seed.registry.packages[story.id].version,'0.9.0');
    assert.equal((await call('/api/official/publish',{previewId:preview.previewId,previewHash:preview.previewHash})).published,true);
    const contentPreview=await call('/api/official/preview',{contents:[story]});await call('/api/official/publish',{previewId:contentPreview.previewId,previewHash:contentPreview.previewHash});const me=await call('/api/official/me');assert.equal(me.packages.find(p=>p.id===story.id).version,'0.9.0');assert.equal(me.packages.find(p=>p.id==='cyber2051.base-content').version,seed.baseVersion);
  } finally { await fixture.close(); }
});
