'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createOfficialRelease } = require("../../网站/gateway/official-release.cjs");
const F = require("../../网站/gateway/official-release-fixtures.cjs");
const P = require("../../工具/发布/packages.cjs");
const authorized = { pid: '1111111111111111' }, ordinary = { pid: '2222222222222222' }, other = { pid: '3333333333333333' };
function fixture(run, fault = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-official-test-'));
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE publishers (publisher_id TEXT PRIMARY KEY,status TEXT NOT NULL,display_name_last TEXT)');
  for (const req of [authorized, ordinary, other]) db.prepare('INSERT INTO publishers VALUES (?,?,?)').run(req.pid, 'active', '合成测试账号');
  const key = F.keys(), config = { modulePath: path.resolve(__dirname, "../../工具/发布/packages.cjs"), outputDirectory: path.join(root, 'v3'), privateKey: key.privateKey, keyId: 'test.key' };
  const options = { db, config, fault, authorize: req => req.pid ? { sess: { publisherId: req.pid } } : { error: 'unauthorized', code: 401 }, send: () => {}, readRawBody: () => {} };
  const api = createOfficialRelease(options);
  db.prepare('UPDATE publishers SET can_publish_official=1 WHERE publisher_id IN (?,?)').run(authorized.pid, other.pid);
  const env = { api, options, db, config, key, root, card: () => F.card(key.pem), initial: () => api.preview(authorized, { card: F.card(key.pem) }), confirm: preview => api.publish(authorized, { previewId: preview.previewId, previewHash: preview.previewHash }) };
  try { return run(env); }
  finally {
    db.close();
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('cxx-official-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const code = wanted => error => error.code === wanted;
test('ordinary Discord sessions cannot preview/publish; missing config is read-only', () => fixture(e => {
  assert.equal(e.api.me(ordinary).canPublishOfficial, false);
  assert.throws(() => e.api.preview(ordinary, { card: e.card() }), code('official_release_forbidden'));
  assert.throws(() => e.api.preview({}, { card: e.card() }), code('unauthorized'));
  const missing = createOfficialRelease({ ...e.options, config: {} });
  assert.equal(missing.me(authorized).readinessReason, 'publishing_not_configured');
  assert.throws(() => missing.preview(authorized, { card: e.card() }), code('publishing_not_configured'));
  assert.equal(fs.existsSync(e.config.outputDirectory), false);
}));
test('official POST routes reject missing/ordinary sessions before reading any body', () => fixture(e => {
  let bodyReads = 0;
  const api = createOfficialRelease({ ...e.options,
    send: (res, status, body) => { res.status = status; res.body = body; },
    readRawBody: (_req, res, _max, callback) => { bodyReads++; callback(Buffer.from('{')); },
  });
  for (const endpoint of ['/api/official/preview', '/api/official/publish']) {
    for (const [req, expectedStatus] of [[{}, 401], [ordinary, 403]]) {
      const res = {};
      assert.equal(api.handle(req, res, endpoint, 'POST'), true);
      assert.equal(res.status, expectedStatus); assert.equal(bodyReads, 0);
    }
  }
  const res = {};
  api.handle(authorized, res, '/api/official/preview', 'POST');
  assert.equal(bodyReads, 1); assert.equal(res.status, 400); assert.equal(res.body.error, 'invalid_json');
}));
test('new-card preview signs core and seed-owned base content without publishing', () => fixture(e => {
  const preview = e.initial();
  assert.deepEqual(preview.packages.map(pkg => pkg.id), ['cyber2051.core', 'cyber2051.base-content']);
  assert.deepEqual(preview.packages[1].changes.quests.added, ['q01']);
  assert.ok(preview.packages.every(pkg => pkg.bytes > 0));
  assert.equal(fs.existsSync(path.join(e.config.outputDirectory, 'manifest.json')), false);
  assert.equal(e.api.me(authorized).displayName, '合成测试账号');
}));

test('modern card publishes static base content only and refuses standalone code packages', () => fixture(e => {
  const card=e.card(),script=card.data.extensions.tavern_helper.scripts.find(s=>s.data?.__cxx_update_seed);
  script.data.__cxx_update_seed.engineVersion='1.2.0';script.data.__cxx_update_seed.catalogUrl='https://cyber2051.top/updates/v3/component-manifest.json';
  const preview=e.api.preview(authorized,{card});assert.deepEqual(preview.packages.map(p=>p.id),['cyber2051.base-content']);e.confirm(preview);
  const catalog=JSON.parse(fs.readFileSync(path.join(e.config.outputDirectory,'component-manifest.json')));assert.ok(catalog.packages.every(p=>p.kind==='content'));
  assert.equal(fs.existsSync(path.join(e.config.outputDirectory,'manifest.json')),false);
  assert.throws(()=>e.api.preview(authorized,{core:P.createCorePackage(card)}),code('next_card_required'));
}));
test('confirmed release has signature/immutable bytes/registry/audit; repeat is idempotent', () => fixture(e => {
  const preview = e.initial(), receipt = e.confirm(preview);
  assert.equal(receipt.published, true);
  const manifest = fs.readFileSync(path.join(e.config.outputDirectory, 'manifest.json'));
  assert.equal(P.sha256(manifest), receipt.manifestHash);
  const catalog = JSON.parse(manifest); P.validateCatalog(catalog, { trustedKeys: { 'test.key': e.key.pem } });
  for (const entry of catalog.packages) {
    const bytes = fs.readFileSync(path.join(e.config.outputDirectory, P.packageRelativePath(entry)));
    assert.equal(bytes.length, entry.bytes); assert.equal(P.sha256(bytes), entry.sha256);
    P.validatePackage(JSON.parse(bytes), { trustedKeys: { 'test.key': e.key.pem } });
  }
  const registry = JSON.parse(e.db.prepare('SELECT registry FROM official_release_head').get().registry);
  assert.equal(registry.owners.quests.q01, 'cyber2051.base-content');
  assert.equal(registry.owners.worldbook['1'], 'cyber2051.core');
  assert.equal(e.db.prepare('SELECT status FROM official_release_audit').get().status, 'committed');
  assert.equal(e.confirm(preview).alreadyPublished, true);
  assert.equal(e.api.me(authorized).packages.length, 2);
}));
test('grant revocation, ban and deleted account invalidate an existing preview', () => fixture(e => {
  const preview = e.initial();
  e.db.prepare('UPDATE publishers SET can_publish_official=0 WHERE publisher_id=?').run(authorized.pid);
  assert.throws(() => e.confirm(preview), code('official_release_forbidden'));
  e.db.prepare("UPDATE publishers SET status='banned',can_publish_official=1 WHERE publisher_id=?").run(authorized.pid);
  assert.throws(() => e.confirm(preview), code('publisher_unavailable'));
  e.db.prepare('DELETE FROM publishers WHERE publisher_id=?').run(authorized.pid);
  assert.throws(() => e.confirm(preview), code('publisher_unavailable'));
  assert.equal(fs.existsSync(path.join(e.config.outputDirectory, 'manifest.json')), false);
}));
test('stale, wrong-hash, expired and another-author previews are rejected', () => fixture(e => {
  const a = e.initial(), b = e.api.preview(authorized, { card: F.card(e.key.pem, '1.0.1') });
  assert.throws(() => e.api.publish(other, { previewId: a.previewId, previewHash: a.previewHash }), code('preview_unavailable'));
  assert.throws(() => e.confirm({ ...a, previewHash: '0'.repeat(64) }), code('preview_unavailable'));
  e.confirm(a);
  assert.throws(() => e.confirm(b), code('preview_stale'));
  const c = e.api.preview(authorized, { contents: [F.content()] });
  e.db.prepare('UPDATE official_release_previews SET expires_at=0 WHERE id=?').run(c.previewId);
  assert.throws(() => e.confirm(c), code('preview_expired'));
}));
test('client cannot provide paths, private keys, key IDs or arbitrary JSON top fields', () => fixture(e => {
  for (const key of ['outputDirectory', 'privateKey', 'keyId', 'existingRegistry', 'cardId']) assert.throws(() => e.api.preview(authorized, { card: e.card(), [key]: 'ignored?' }), code('invalid_input'));
  const polluted = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => e.api.preview(authorized, { contents: [polluted] }));
  assert.equal({}.polluted, undefined);
  assert.throws(() => e.api.publish(authorized, { previewId: 'a'.repeat(32), previewHash: 'b'.repeat(64), outputDirectory: e.root }), code('invalid_input'));
}));
test('cross-card input, absent seed and wrong public key fail before package publication', () => fixture(e => {
  for (const change of [card => card.data.extensions.tavern_helper.scripts[0].data.__cxx_update_seed.cardId = 'other', card => card.data.extensions.tavern_helper.scripts[0].data = {}]) {
    const card = e.card(); change(card); assert.throws(() => e.api.preview(authorized, { card }), code('invalid_card'));
  }
  for (const pem of [null, F.keys().pem]) {
    const card = e.card(); card.data.extensions.tavern_helper.scripts[0].data.__cxx_update_seed.trustedKeys = pem ? { 'test.key': pem } : {};
    assert.throws(() => e.api.preview(authorized, { card }), code('card_signing_key_mismatch'));
  }
  assert.throws(() => e.api.preview(authorized, { core: P.createCorePackage(e.card()) }), code('initial_card_required'));
  assert.throws(() => e.api.preview(authorized, { contents: [F.content()] }), code('initial_card_required'));
  assert.throws(() => e.api.preview(authorized, { contents: [{ ...F.content(), cardId: 'other' }] }));
}));
test('same-version different content and downgrades cannot change the manifest', () => fixture(e => {
  e.confirm(e.initial()); const before = e.api.me(authorized).manifestHash;
  const changed = e.card(); changed.data.character_book.entries[0].content = '不同正文';
  assert.throws(() => e.api.preview(authorized, { card: changed }), /同版本不能/);
  assert.throws(() => e.api.preview(authorized, { card: F.card(e.key.pem, '0.9.0') }), /降低/);
  assert.equal(e.api.me(authorized).manifestHash, before);
}));
test('content owners survive removal; DLC cannot steal base IDs or core worldbook UIDs', () => fixture(e => {
  e.confirm(e.initial());
  const stealing = F.content(); stealing.content.quests[0].id = 'q01';
  assert.throws(() => e.api.preview(authorized, { contents: [stealing] }), /跨包内容编号冲突/);
  const wb = F.content(); wb.content.worldbook = [require("../../工具/lib/runtime-components.cjs").worldbookEntry({ id: 1, comment: '冲突', content: '静态文本', keys: ['测试'], extensions: {} })];
  assert.throws(() => e.api.preview(authorized, { contents: [wb] }), code('ownership_conflict'));
  const owned = F.content('test.owner'); e.confirm(e.api.preview(authorized, { contents: [owned] }));
  const remove = F.content('test.owner', '1.0.1'); remove.content.quests = [F.quest('test.owner.new')];
  e.confirm(e.api.preview(authorized, { contents: [remove] }));
  const take = F.content('test.other'); take.content.quests = [F.quest('test.owner.quest')];
  assert.throws(() => e.api.preview(authorized, { contents: [take] }), /跨包内容编号冲突/);
}));
test('content dependencies on other packages stay valid after fresh service readback', () => fixture(e => {
  e.confirm(e.initial());
  const a = F.content('test.one'), b = F.content('test.two'); b.content.quests[0].prerequisites = ['test.one.quest'];
  e.confirm(e.api.preview(authorized, { contents: [a, b] }));
  assert.equal(createOfficialRelease(e.options).me(authorized).publishingReady, true);
}));
test('persisted preview hash binds all signed data, registry and consumers', () => fixture(e => {
  const preview = e.initial(), row = e.db.prepare('SELECT payload FROM official_release_previews WHERE id=?').get(preview.previewId);
  const payload = JSON.parse(row.payload); payload.consumers.mapIndex = { forged: ['place'] };
  e.db.prepare('UPDATE official_release_previews SET payload=? WHERE id=?').run(JSON.stringify(payload), preview.previewId);
  assert.throws(() => e.confirm(preview), code('preview_corrupt'));
}));
test('revocation after immutable files were prepared still blocks the final manifest switch', () => {
  let db;
  fixture(e => {
    db = e.db; const preview = e.initial();
    assert.throws(() => e.confirm(preview), code('official_release_forbidden'));
    assert.equal(fs.existsSync(path.join(e.config.outputDirectory, 'manifest.json')), false);
    e.db.prepare('UPDATE publishers SET can_publish_official=1 WHERE publisher_id=?').run(authorized.pid);
    assert.equal(e.api.me(authorized).manifestHash, null);
    assert.equal(e.db.prepare('SELECT status FROM official_release_audit').get().status, 'aborted');
  }, stage => { if (stage === 'before-manifest') db.prepare('UPDATE publishers SET can_publish_official=0 WHERE publisher_id=?').run(authorized.pid); });
});
test('cross-process mkdir lock excludes another publisher without deleting its lock', () => fixture(e => {
  e.initial(); const lock = path.join(e.config.outputDirectory, '.official-release.lock'); fs.mkdirSync(lock);
  assert.throws(() => e.initial(), code('release_locked'));
  assert.equal(fs.existsSync(lock), true); fs.rmdirSync(lock);
}));
test('symlink package directories are rejected before writing outside fixed output', () => fixture(e => {
  const preview = e.initial(), outside = path.join(e.root, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(e.config.outputDirectory, 'packages'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => e.confirm(preview), code('unsafe_release_path'));
  assert.deepEqual(fs.readdirSync(outside), []);
}));
test('actual immutable-file corruption blocks later releases', () => fixture(e => {
  e.confirm(e.initial());
  fs.appendFileSync(path.join(e.config.outputDirectory, 'packages/cyber2051.core/1.0.0.json'), ' ');
  assert.throws(() => e.api.preview(authorized, { contents: [F.content()] }), code('release_package_corrupt'));
}));
test('an unregistered old manifest cannot be adopted by ignoring ownership history', () => fixture(e => {
  fs.mkdirSync(e.config.outputDirectory); fs.writeFileSync(path.join(e.config.outputDirectory, 'manifest.json'), '{}');
  assert.throws(() => e.initial(), code('release_state_conflict'));
}));
for (const failure of ['after-packages', 'before-manifest', 'after-manifest']) test('fault recovery at ' + failure + ' follows actual manifest and leaves audit evidence', () => {
  let thrown = false;
  fixture(e => {
    const preview = e.initial();
    assert.throws(() => e.confirm(preview), /合成故障/);
    const fresh = createOfficialRelease({ ...e.options, fault: () => {} });
    const status = fresh.me(authorized);
    assert.equal(status.publishingReady, true);
    if (failure === 'after-manifest') {
      assert.equal(status.manifestHash, preview.manifestHash);
      assert.equal(e.db.prepare('SELECT status FROM official_release_audit').get().status, 'committed');
      assert.equal(fresh.publish(authorized, { previewId: preview.previewId, previewHash: preview.previewHash }).alreadyPublished, true);
    } else {
      assert.equal(status.manifestHash, null);
      if (failure === 'before-manifest') assert.equal(e.db.prepare('SELECT status FROM official_release_audit').get().status, 'aborted');
    }
  }, stage => { if (stage === failure && !thrown) { thrown = true; throw Error('合成故障'); } });
});

for(const interrupted of [false,true])test('modern channel preserves old clients and withdrawal updates both catalogs with recovery '+interrupted,()=>fixture(e=>{
 e.confirm(e.initial());const old=F.content('legacy.optional');e.confirm(e.api.preview(authorized,{contents:[old]}));
 const legacyFile=path.join(e.config.outputDirectory,'manifest.json'),before=fs.readFileSync(legacyFile,'utf8');
 const modern=F.content('modern.optional');modern.requires.engine='1.2.0';e.confirm(e.api.preview(authorized,{contents:[modern]}));
 assert.equal(fs.readFileSync(legacyFile,'utf8'),before);const modernFile=path.join(e.config.outputDirectory,'component-manifest.json');assert.equal(JSON.parse(fs.readFileSync(modernFile)).engineVersion,'1.2.0');
 assert.throws(()=>e.api.preview(authorized,{withdraw:['cyber2051.base-content']}),code('invalid_input'));
 const preview=e.api.preview(authorized,{withdraw:['legacy.optional','modern.optional']});
 if(interrupted){const failing=createOfficialRelease({...e.options,fault:stage=>{if(stage==='after-manifest')throw Error('two-channel-test');}});assert.throws(()=>failing.publish(authorized,{previewId:preview.previewId,previewHash:preview.previewHash}),/two-channel-test/);const fresh=createOfficialRelease(e.options);assert.equal(fresh.me(authorized).publishingReady,true);}
 else e.confirm(preview);
 for(const file of [legacyFile,modernFile]){const catalog=JSON.parse(fs.readFileSync(file));P.verifyDocument(catalog,{'test.key':e.key.pem});assert.ok(!catalog.packages.some(p=>p.id==='legacy.optional'||p.id==='modern.optional'));}
 assert.ok(fs.existsSync(path.join(e.config.outputDirectory,'packages/legacy.optional/1.0.0.json')));assert.ok(fs.existsSync(path.join(e.config.outputDirectory,'packages/modern.optional/1.0.0.json')));
 const head=JSON.parse(e.db.prepare('SELECT registry FROM official_release_head').get().registry);assert.ok(head.packages['legacy.optional']);assert.ok(head.packages['modern.optional']);
}));
