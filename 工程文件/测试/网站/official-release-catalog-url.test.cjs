'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createOfficialRelease } = require("../../网站/gateway/official-release.cjs");
const F = require("../../网站/gateway/official-release-fixtures.cjs");

function previewCard(cardFactory) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-catalog-url-'));
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE publishers (publisher_id TEXT PRIMARY KEY,status TEXT NOT NULL,display_name_last TEXT)");
    db.prepare('INSERT INTO publishers VALUES (?,?,?)').run('catalog-url-test', 'active', '本地校验');
    const key = F.keys();
    const api = createOfficialRelease({ db,
      config: { modulePath: path.resolve(__dirname, "../../工具/发布/packages.cjs"), outputDirectory: path.join(root, 'v3'), privateKey: key.privateKey, keyId: 'test.key' },
      authorize: () => ({ sess: { publisherId: 'catalog-url-test' } }), send: () => {}, readRawBody: () => {},
    });
    db.exec('UPDATE publishers SET can_publish_official=1');
    const preview = api.preview({}, { card: cardFactory(key) });
    assert.deepEqual(preview.packages.map(p => p.id), ['cyber2051.base-content']);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM official_release_audit').get().n, 0);
    assert.deepEqual(fs.readdirSync(path.join(root, 'v3')), []);
    return preview;
  } finally {
    db.close();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('cxx-catalog-url-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function modernCard(key, url) {
  const card = F.card(key.pem, '2.0.45');
  const seed = card.data.extensions.tavern_helper.scripts[0].data.__cxx_update_seed;
  seed.engineVersion = '1.4.0'; seed.catalogUrl = url;
  return card;
}
test('official legacy and release catalog URLs pass full preview without publication', () => {
  for (const name of ['manifest.json', 'component-manifest.json', 'release-manifest.json']) {
    previewCard(key => modernCard(key, 'https://cyber2051.top/updates/v3/' + name));
  }
});
test('unrecognized catalog origins and paths remain rejected', () => {
  for (const url of ['https://example.com/updates/v3/release-manifest.json', 'http://cyber2051.top/updates/v3/release-manifest.json', 'https://cyber2051.top/updates/v3/unknown.json']) {
    assert.throws(() => previewCard(key => modernCard(key, url)), error => error.code === 'invalid_card');
  }
});
test('provided 2.0.45 card passes full preview with an isolated test signing key', { skip: !process.env.CXX_CHECK_CARD }, () => {
  const bytes = fs.readFileSync(process.env.CXX_CHECK_CARD);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '5eaed33c7b1482481e6acb704d1d0f2b037409a4f4ad90dd8360c3ad2801338c');
  const preview = previewCard(key => {
    const card = JSON.parse(bytes);
    const visit = nodes => nodes.flatMap(node => node.type === 'folder' ? visit(node.scripts) : [node]);
    const seed = visit(card.data.extensions.tavern_helper.scripts).find(s => s.id === 'cf33c692-7a41-444d-b8b7-6a70163e0104').data.__cxx_update_seed;
    assert.equal(card.data.character_version, '2.0.45');
    assert.equal(seed.catalogUrl, 'https://cyber2051.top/updates/v3/release-manifest.json');
    seed.trustedKeys = { 'test.key': crypto.createPublicKey(key.pem).export({ type: 'spki', format: 'der' }).toString('base64') };
    return card;
  });
  assert.equal(preview.packages[0].version, '2.0.45');
});
