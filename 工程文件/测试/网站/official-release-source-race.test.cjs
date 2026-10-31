'use strict';
// Local synthetic DB/accounts/test keys only. No production, Discord or deployed files.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { spawnSync } = require('node:child_process'), { DatabaseSync } = require('node:sqlite');
const { createOfficialRelease } = require("../../网站/gateway/official-release.cjs");
const { createWorkshopBridge } = require("../../网站/gateway/workshop-bridge.cjs");
const Contract = require("../../网站/gateway/workshop-contract.cjs"), F = require("../../网站/gateway/official-release-fixtures.cjs");
const P = require("../../工具/发布/packages.cjs");
const official = '1111111111111111', owner = '2222222222222222';
const modulePath = require.resolve("../../工具/发布/packages.cjs");
const draft = () => ({ format: 1, contract: { fixer: '合成联系人', type: '调查', difficulty: '低', pay: 1000, mapId: 'tokyo-central', placeId: 'plaza', brief: '只用于本地竞争验收。', goal: '核对广场。' } });
function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-source-race-'));
  const database = path.join(root, 'test.db'), db = new DatabaseSync(database), other = new DatabaseSync(database);
  db.exec('CREATE TABLE publishers(publisher_id TEXT PRIMARY KEY,status TEXT,display_name_last TEXT); CREATE TABLE submissions(id INTEGER PRIMARY KEY,revision INTEGER,type TEXT,publisher_id TEXT,title TEXT,summary TEXT,author_name TEXT,tags TEXT,payload TEXT,content_hash TEXT,status TEXT)');
  db.prepare('INSERT INTO publishers VALUES(?,?,?)').run(official, 'active', '合成官方账号');
  db.prepare('INSERT INTO publishers VALUES(?,?,?)').run(owner, 'active', '合成投稿账号');
  const payload = JSON.stringify(draft());
  db.prepare('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(1, 1, 'contract', owner, '合成委托', '合成简介', '测试署名', '["合成"]', payload, P.sha256(payload), 'approved');
  other.exec('PRAGMA busy_timeout=0');
  const keys = F.keys(), config = { modulePath, outputDirectory: path.join(root, 'v3'), privateKey: keys.privateKey, keyId: 'test.key' };
  let bridge, check = () => {}, fault = () => {};
  const checks = [];
  const options = { db, config, authorize: req => ({ sess: { publisherId: req.pid } }), send() {}, readRawBody() {},
    fault: stage => fault(stage), beforeCommit: context => {
      assert.equal(context.db, db); assert.equal(context.publisherId, official);
      checks.push(context); bridge.assertSources(context.packages); return check(context);
    } };
  const api = createOfficialRelease(options);
  db.prepare('UPDATE publishers SET can_publish_official=1 WHERE publisher_id=?').run(official);
  bridge = createWorkshopBridge({ db, modulePath });
  const artifact = bridge.ensureArtifact(db.prepare('SELECT * FROM submissions WHERE id=1').get());
  const card = F.card(keys.pem); card.data.extensions.tavern_helper.scripts[0].data.__cxx_update_seed.mapIndex = { 'tokyo-central': Contract.schema().places.map(place => place.id) };
  const req = { pid: official }, confirm = preview => api.publish(req, { previewId: preview.previewId, previewHash: preview.previewHash });
  confirm(api.preview(req, { card })); checks.length = 0;
  const originalManifest = fs.readFileSync(path.join(config.outputDirectory, 'manifest.json'));
  const env = { root, db, other, api, bridge, artifact, config, options, checks, req, confirm, originalManifest,
    preview: (pkg = artifact.package) => api.preview(req, { contents: [pkg] }),
    setCheck: fn => { check = fn; }, setFault: fn => { fault = fn; },
    packageFile: path.join(config.outputDirectory, P.packageRelativePath(artifact.package)),
    assertUnpublished: () => assert.deepEqual(fs.readFileSync(path.join(config.outputDirectory, 'manifest.json')), originalManifest) };
  try { return run(env); }
  finally {
    other.close(); db.close();
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('cxx-source-race-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const code = wanted => error => error.code === wanted;
for (const [name, mutation, expected] of [
  ['revision', db => db.prepare('UPDATE submissions SET revision=2').run(), 'revision_conflict'],
  ['withdrawal', db => db.prepare("UPDATE submissions SET status='withdrawn'").run(), 'contract_not_approved'],
  ['author ban', db => db.prepare("UPDATE publishers SET status='banned' WHERE publisher_id=?").run(owner), 'source_hash_mismatch'],
  ['payload hash', db => db.prepare('UPDATE submissions SET content_hash=?').run('0'.repeat(64)), 'source_hash_mismatch'],
  ['raw payload whitespace with stale hash', db => db.prepare("UPDATE submissions SET payload=payload||' '").run(), 'source_hash_mismatch'],
  ['title', db => db.prepare("UPDATE submissions SET title='另一个标题'").run(), 'source_hash_mismatch'],
  ['summary', db => db.prepare("UPDATE submissions SET summary='另一份简介'").run(), 'source_hash_mismatch'],
  ['credit', db => db.prepare("UPDATE submissions SET author_name='别人的署名'").run(), 'source_hash_mismatch'],
  ['tags', db => db.prepare('UPDATE submissions SET tags=?').run('["新标签"]'), 'source_hash_mismatch'],
  ['owner', db => db.prepare('UPDATE submissions SET publisher_id=?').run(official), 'source_hash_mismatch'],
]) test('preview then ' + name + ' refuses before immutable package write', () => fixture(e => {
  const preview = e.preview(); mutation(e.other);
  assert.throws(() => e.confirm(preview), code(expected));
  e.assertUnpublished(); assert.equal(fs.existsSync(e.packageFile), false);
  assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM official_release_audit WHERE id=?').get(preview.previewId).n, 0);
}));
for (const field of ['publisherId', 'payloadSha256', 'submissionSha256', 'displayName', 'creditName']) test('forged source ' + field + ' cannot become a release', () => fixture(e => {
  const pkg = structuredClone(e.artifact.package); pkg.content.worldbook[0].extra.__cxx_workshop_source[field] = 'forged';
  const preview = e.preview(pkg); assert.throws(() => e.confirm(preview), code('source_hash_mismatch'));
  e.assertUnpublished(); assert.equal(fs.existsSync(e.packageFile), false);
}));
test('a reserved community package cannot remove its source to bypass the hook', () => fixture(e => {
  const pkg = structuredClone(e.artifact.package); delete pkg.content.worldbook[0].extra.__cxx_workshop_source;
  const preview = e.preview(pkg); assert.throws(() => e.confirm(preview), code('source_required')); e.assertUnpublished();
}));
test('both source checks hold the same SQLite write transaction against a second connection', () => fixture(e => {
  let attempted = 0;
  e.setCheck(({ packages }) => {
    if (!packages.some(pkg => pkg.id === e.artifact.package.id)) return;
    attempted++;
    assert.throws(() => e.other.prepare('UPDATE submissions SET revision=2').run(), /locked|busy/i);
  });
  const preview = e.preview(); assert.equal(e.confirm(preview).published, true); assert.equal(attempted, 2);
  assert.equal(e.db.prepare('SELECT revision FROM submissions').get().revision, 1);
  assert.equal(e.checks.length, 2); assert.equal(e.checks[0].preview.id, preview.previewId);
  e.other.prepare('UPDATE submissions SET revision=2').run(); // Lock released only after commit.
  assert.equal(e.db.prepare('SELECT revision FROM submissions').get().revision, 2);
}));
test('change in the prepare/manifest gap is checked again and leaves the old catalog recoverable', () => fixture(e => {
  e.setFault(stage => { if (stage === 'before-manifest') e.other.prepare("UPDATE submissions SET status='withdrawn'").run(); });
  const preview = e.preview(); assert.throws(() => e.confirm(preview), code('contract_not_approved'));
  e.assertUnpublished(); assert.equal(e.checks.length, 2);
  assert.equal(e.db.prepare('SELECT status FROM official_release_audit WHERE id=?').get(preview.previewId).status, 'prepared');
  assert.equal(fs.existsSync(e.packageFile), true); // Immutable orphan is not in the published catalog.
  e.setFault(() => {}); assert.equal(e.api.me(e.req).manifestHash, P.sha256(e.originalManifest));
  assert.equal(e.db.prepare('SELECT status FROM official_release_audit WHERE id=?').get(preview.previewId).status, 'aborted');
}));
test('an asynchronous hook fails closed rather than checking after the transaction', () => fixture(e => {
  e.setCheck(() => Promise.resolve()); const preview = e.preview();
  assert.throws(() => e.confirm(preview), code('source_check_async')); e.assertUnpublished(); assert.equal(fs.existsSync(e.packageFile), false);
}));
test('official non-community path retains default no-op and repeat publish stays idempotent', () => fixture(e => {
  const api = createOfficialRelease({ ...e.options, beforeCommit: undefined });
  const preview = api.preview(e.req, { contents: [F.content('official.test-data')] });
  const confirm = { previewId: preview.previewId, previewHash: preview.previewHash };
  assert.equal(api.publish(e.req, confirm).published, true);
  assert.equal(api.publish(e.req, confirm).alreadyPublished, true);
}));
test('real author HTTP update in the two-phase gap defeats the final publish check', { timeout: 30000 }, async () => {
  const { startFixture } = require("../../网站/gateway/workshop-contract.fixture.cjs");
  const f = await startFixture(); let db, server;
  try {
    assert.match(f.gatewayBaseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
    const auth = f.session('authorized'), ownerSession = f.session('ordinary'), admin = f.session('admin');
    const call = async (route, session, body) => {
      const response = await fetch(f.baseUrl + route, { method: 'POST', headers: { Authorization: 'Bearer ' + session.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const submission = { type: 'contract', title: 'HTTP竞争委托', summary: '合成', authorName: '测试署名', tags: [], payload: draft() };
    const created = await call('/api/workshop/submissions', ownerSession, submission); assert.equal(created.status, 201);
    const id = created.body.id, approved = await call('/api/admin/submissions/' + id + '/approve', admin, { baseRevision: 1 }); assert.equal(approved.status, 200);
    const artifact = approved.body.artifact;
    const card = await (await fetch(f.baseUrl + '/__fixture__/card.json')).json();
    const foundation = await call('/api/official/preview', auth, { card }); assert.equal(foundation.status, 200);
    assert.equal((await call('/api/official/publish', auth, { previewId: foundation.body.previewId, previewHash: foundation.body.previewHash })).status, 200);
    const preview = await call('/api/official/workshop/' + id + '/preview', auth, { baseRevision: 1, packageSha256: artifact.packageSha256 }); assert.equal(preview.status, 200);
    const outputDirectory = path.join(f.root, 'releases/v3'), before = fs.readFileSync(path.join(outputDirectory, 'manifest.json'));
    db = new DatabaseSync(path.join(f.root, 'workshop.db'));
    const bridge = createWorkshopBridge({ db, modulePath }); let changed = false, sourceChecks = 0;
    const workerCode = `const fs=require('node:fs');const info=JSON.parse(fs.readFileSync(0,'utf8'));fetch(info.url,{method:'POST',headers:{Authorization:'Bearer '+info.token,'Content-Type':'application/json'},body:JSON.stringify(info.body)}).then(async r=>process.stdout.write(JSON.stringify({status:r.status,body:await r.json()}))).catch(()=>{process.exitCode=1});`;
    const api = createOfficialRelease({ db,
      config: { modulePath, outputDirectory, privateKeyFile: path.join(f.root, 'TEST-ONLY-private.pem'), keyId: 'test.key' },
      authorize: req => req.headers.authorization === 'Bearer ' + auth.token ? { sess: { publisherId: auth.publisherId } } : { error: 'unauthorized', code: 401 },
      send: (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); },
      readRawBody: (req, _res, _max, callback) => { const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => callback(Buffer.concat(chunks))); },
      beforeCommit: context => { assert.equal(context.db, db); sourceChecks++; bridge.assertSources(context.packages); },
      fault: stage => {
        if (stage !== 'before-manifest' || changed) return; changed = true;
        const child = spawnSync(process.execPath, ['-e', workerCode], { windowsHide: true, timeout: 15000, encoding: 'utf8', input: JSON.stringify({ url: f.gatewayBaseUrl + '/api/workshop/submissions/' + id + '/update', token: ownerSession.token, body: { ...submission, title: 'HTTP竞争改稿', baseRevision: 1 } }) });
        assert.equal(child.status, 0); const result = JSON.parse(child.stdout); assert.equal(result.status, 200); assert.equal(result.body.revision, 2);
      } });
    server = http.createServer((req, res) => { if (!api.handle(req, res, '/api/official/publish', req.method)) res.end(); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/official/publish', { method: 'POST', headers: { Authorization: 'Bearer ' + auth.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ previewId: preview.body.previewId, previewHash: preview.body.previewHash }) });
    assert.equal(response.status, 404); assert.equal((await response.json()).error, 'contract_not_approved');
    assert.equal(sourceChecks, 2); assert.equal(changed, true); assert.deepEqual(fs.readFileSync(path.join(outputDirectory, 'manifest.json')), before);
    const row = db.prepare('SELECT revision,status FROM submissions WHERE id=?').get(id); assert.equal(row.revision, 2); assert.equal(row.status, 'pending');
    assert.equal(db.prepare('SELECT status FROM official_release_audit WHERE id=?').get(preview.body.previewId).status, 'prepared');
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve)); db?.close(); await f.close();
  }
});
