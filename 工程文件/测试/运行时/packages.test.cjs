'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const api = require("../../工具/发布/packages.cjs");
const { worldbookEntry } = require("../../工具/lib/runtime-components.cjs");
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519'); // 仅测试内存密钥。
const trustedKeys = { 'test.key': publicKey };
const copy = value => JSON.parse(JSON.stringify(value));
const quest = (id = 'test.quest') => ({ id, title: '离线测试委托', fixer: '测试联系人', district: '红花街', type: '回收', difficulty: '低', pay: 100, brief: '只用于校验的既有数据形状。', goal: '测试完成条件。', unlock: '无' });
const image = (id = 'test.image') => ({ id, characterId: 'sakiko', category: 'standard', url: 'https://cyber2051.top/img/sakiko.v1.png' });
function content(id = 'official.content', v = '1.0.0', optional = false) {
  return api.createContentPackage({ id, version: v, optional, requires: { engine: '1.0.0', packages: [] }, content: { quests: [quest(id + '.quest')], gallery: [image(id + '.image')], worldbook: [] }, future: { keep: true } });
}
function card() {
  return { spec: 'chara_card_v2', data: { name: '测试卡V2.0.0', character_version: '2.0.0', character_book: { name: '测试世界书 2.0.0', entries: [{ id: 1, comment: '测试条目', content: '测试正文', keys: ['测试'], enabled: true, extensions: {} }] }, extensions: { world: '测试世界书 2.0.0', regex_scripts: [{ id: 'regex-1', scriptName: '测试正则', placement: [2], findRegex: 'test', replaceString: 'tested', markdownOnly: true }], tavern_helper: { scripts: [{ id: 'script-1', type: 'script', name: '测试脚本', content: 'void 0;', enabled: true, data: { playerSetting: 7 } }] } } } };
}
function build(packages = [content()], previousCatalog = null) {
  return api.buildRelease({ packages, privateKey, keyId: 'test.key', previousCatalog });
}
function temp(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyber2051-pack-test-'));
  try { return run(dir); }
  finally {
    const resolved = path.resolve(dir), parent = path.resolve(os.tmpdir());
    assert.ok(resolved.startsWith(parent + path.sep) && path.basename(resolved).startsWith('cyber2051-pack-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

test('canonical signing preserves arrays and unknown fields but sorts object keys', () => {
  const a = { z: [3, 1], a: { y: false, x: '中文' } }, b = { a: { x: '中文', y: false }, z: [3, 1] };
  assert.equal(api.canonical(a), api.canonical(b));
  const pkg = content();
  assert.deepEqual(pkg.future, { keep: true });
  const signed = api.signDocument(pkg, privateKey, 'test.key');
  assert.equal(api.verifyDocument(signed, trustedKeys), true);
});
test('retired quest/gallery IDs stay with the original package across registry history', () => {
  for (const key of ['quests', 'gallery']) {
    const first = content('official.a'), second = content('official.b');
    const oldItem = copy(first.content[key][0]);
    const archived = { format: 1, packages: { [first.id]: { version: '2.0.0', optional: false, activation: 'compatible', content: { quests: [], gallery: [], worldbook: [] }, history: { '1.0.0': copy(first.content) } } } };
    second.content[key] = [oldItem];
    assert.throws(() => api.validateOwnership([second], archived), /跨包内容编号冲突/);
    const restored = { ...copy(first), version: '3.0.0' };
    assert.equal(api.validateOwnership([restored], archived), true);
    // 同批把 A 的现有编号移除、交给 B 也不能绕过旧 registry。
    const current = { format: 1, packages: { [first.id]: { ...copy(first), history: {} } } };
    const removed = { ...copy(first), version: '2.0.0', content: { quests: [], gallery: [], worldbook: [] } };
    assert.throws(() => api.validateOwnership([removed, second], current), /跨包内容编号冲突/);
  }
});
test('canonical rejects prototype pollution, undefined, sparse arrays, nonfinite and cycles', () => {
  for (const value of [JSON.parse('{"__proto__":{}}'), JSON.parse('{"constructor":{}}'), JSON.parse('{"prototype":{}}'), { a: undefined }, { a: NaN }, [undefined], Array(2)]) assert.throws(() => api.canonical(value));
  const circular = {}; circular.self = circular;
  assert.throws(() => api.canonical(circular), /循环/);
  const sparseWithAttribute = [, 1]; sparseWithAttribute.extra = true;
  assert.throws(() => api.canonical(sparseWithAttribute), /稀疏数组/);
  assert.equal({}.polluted, undefined);
});
test('unsigned, tampered and untrusted documents cannot pass signature validation', () => {
  assert.throws(() => api.verifyDocument(content(), trustedKeys), /缺少/);
  const signed = api.signDocument(content(), privateKey, 'test.key');
  const bad = copy(signed); bad.content.quests[0].pay += 1;
  assert.throws(() => api.validatePackage(bad, { trustedKeys }), /签名校验失败/);
  assert.throws(() => api.verifyDocument(signed, { 'other.key': publicKey }), /未信任/);
  signed.signature.value = 'A'.repeat(86) + '==';
  assert.throws(() => api.verifyDocument(signed, trustedKeys), /签名校验失败/);
});
test('signed catalog protects its package URL, hash, size and classification', () => {
  const release = build();
  assert.equal(api.validateCatalog(release.catalog, { trustedKeys }), release.catalog);
  for (const field of ['sha256', 'bytes', 'optional']) {
    const changed = copy(release.catalog);
    changed.packages[0][field] = field === 'sha256' ? 'a'.repeat(64) : field === 'bytes' ? 1 : true;
    assert.throws(() => api.validateCatalog(changed, { trustedKeys }), /签名校验失败/);
  }
});
test('wrong-card, wrong-format and partial versions are rejected without silent conversion', () => {
  for (const change of [{ cardId: 'other-card' }, { format: 2 }, { version: '1.0' }, { version: '01.0.0' }]) {
    assert.throws(() => api.validatePackage({ ...content(), ...change }));
  }
  assert.throws(() => api.createContentPackage({ ...content(), cardId: 'other-card' }), /错误的卡身份/);
  assert.throws(() => api.validatePackage({ ...content(), id: 'constructor' }), /安全的固定/);
});
test('core requires aligned card version/name/worldbook/binding and uses runtime conversion', () => {
  const original = card(), pkg = api.createCorePackage(original);
  assert.equal(pkg.components.worldbook.entries[0].uid, 1);
  assert.equal(pkg.components.regex.scripts[0].find_regex, 'test');
  assert.deepEqual(pkg.components.scripts.trees[0].data, { playerSetting: 7 });
  const hashes = api.baselineHashes(pkg.components);
  assert.match(hashes.worldbook['1'], /^[a-f0-9]{64}$/);
  for (const alter of [d => d.character_version = '2.0.1', d => d.extensions.world = '别的书 2.0.0', d => d.character_book.name = '测试世界书 1.0.0', d => d.name = '测试卡V1.0.0']) {
    const wrong = card(); alter(wrong.data); assert.throws(() => api.createCorePackage(wrong), /必须一致/);
  }
  assert.deepEqual(original, card());
  const compatible = card(); compatible.data.extensions.__cxx_update_compatibility_worldbook_ids = [1, 101];
  assert.deepEqual(api.createCorePackage(compatible).compatibilityWorldbookIds, [1, 101]);
  assert.deepEqual(pkg.compatibilityWorldbookIds, []);
  assert.equal(pkg.id, 'cyber2051.core');
  for (const declaration of [[1, 1], [-1], ['1'], false, null]) {
    const wrong = card(); wrong.data.extensions.__cxx_update_compatibility_worldbook_ids = declaration;
    assert.throws(() => api.createCorePackage(wrong), /兼容世界书 uid 声明/);
  }
});
test('no unconsumed map/NPC/weapon payload or executable content gets admitted', () => {
  for (const key of ['maps', 'npcs', 'weapons', 'scripts']) {
    const pkg = content(); pkg.content[key] = [];
    assert.throws(() => api.validatePackage(pkg), /尚无内容消费者/);
  }
  const pkg = content(); pkg.components = { scripts: {} };
  assert.throws(() => api.validatePackage(pkg), /不能携带/);
  for (const body of ['<% doSomething() %>', '<script>alert(1)</script>']) {
    const wrong = content(); wrong.content.worldbook = [worldbookEntry({ id: 101, comment: '文本测试', keys: ['测试'], content: body, extensions: {} })];
    assert.throws(() => api.validatePackage(wrong), /不执行/);
  }
  for (const strategy of [{ type: 'vectorized', keys: [], keys_secondary: { keys: [] } }, { type: 'selective', keys: [{}], keys_secondary: { keys: [] } }]) {
    const wrong = content(); wrong.content.worldbook = [worldbookEntry({ id: 101, comment: '文本测试', keys: ['测试'], content: '既有文本', extensions: {} })];
    wrong.content.worldbook[0].strategy = strategy;
    assert.throws(() => api.validatePackage(wrong));
  }
});
test('gallery enforces stable IDs, existing character/category consumers and HTTPS assets', () => {
  for (const change of [{ characterId: 'unknown-person' }, { category: 'live2d' }, { id: '' }, { url: 'javascript:alert(1)' }, { url: 'http://images.test/a.png' }, { url: 'https://user:pass@images.test/a.png' }, { url: 'https://images.test/a.png' }, { url: 'https://cyber2051.top/img/a.png#x' }, { url: 'https://cyber2051.top/img/a\".png' }, { url: 'https://cyber2051.top/img/../outside.png' }]) {
    const pkg = content(); Object.assign(pkg.content.gallery[0], change);
    assert.throws(() => api.validatePackage(pkg));
  }
  const duplicate = content(); duplicate.content.gallery.push(copy(duplicate.content.gallery[0]));
  assert.throws(() => api.validatePackage(duplicate), /编号重复/);
  const fallback = content(); fallback.content.gallery[0].fallbackUrl = 'https://cyber2051.top/img/fallback.png';
  assert.equal(api.validatePackage(fallback), fallback);
  for (const url of ['javascript:alert(1)', 'https://other.test/fallback.png', 'https://cyber2051.top/img/fallback.png#fragment', '']) {
    fallback.content.gallery[0].fallbackUrl = url;
    assert.throws(() => api.validatePackage(fallback));
  }
});
test('quest location requires an existing explicit map/place consumer', () => {
  const pkg = content(); Object.assign(pkg.content.quests[0], { mapId: 'tokyo', placeId: 'ring' });
  assert.throws(() => api.validatePackage(pkg), /尚未接入/);
  assert.throws(() => api.validatePackage(pkg, { mapIndex: { tokyo: ['other'] } }), /尚未接入/);
  assert.equal(api.validatePackage(pkg, { mapIndex: { tokyo: ['ring'] } }), pkg);
  delete pkg.content.quests[0].placeId;
  assert.throws(() => api.validatePackage(pkg), /placeId/);
});
test('main/side prerequisites and story activation must have recognized consumers', () => {
  const pkg = content(); pkg.activation = 'new_chat'; pkg.content.quests[0].track = 'main'; pkg.content.quests[0].prerequisites = ['q01'];
  assert.doesNotThrow(() => api.validatePackage(pkg));
  const catalog = build([pkg]).catalog;
  assert.equal(catalog.packages[0].activation, 'new_chat');
  pkg.content.quests[0].prerequisites = ['missing.quest'];
  assert.throws(() => api.validatePackage(pkg), /尚无对应任务/);
  pkg.content.quests[0].prerequisites = ['q01']; pkg.content.quests[0].track = 'unknown';
  assert.throws(() => api.validatePackage(pkg), /track/);
  pkg.content.quests[0].track = 'side'; pkg.activation = 'rewrite_history';
  assert.throws(() => api.validatePackage(pkg), /activation/);
  pkg.activation = 'compatible';
  assert.doesNotThrow(() => api.validatePackage(pkg, { questIds: ['other.quest'] })); // 显式增补不会取消基础任务。
  const circular = content(); circular.content.quests = [quest('quest.a'), quest('quest.b')];
  circular.content.quests[0].prerequisites = ['quest.b']; circular.content.quests[1].prerequisites = ['quest.a'];
  assert.throws(() => api.validatePackage(circular), /前置条件形成循环/);
});
test('required packages resolve minimum complete versions and engine requirements', () => {
  const dependant = content('optional.dlc', '1.0.0', true);
  dependant.requires.packages = [{ id: 'official.content', version: '1.1.0' }];
  assert.throws(() => build([dependant]), /缺少满足版本/);
  assert.throws(() => build([content(), dependant]), /缺少满足版本/);
  assert.doesNotThrow(() => build([content('official.content', '1.1.0'), dependant]));
  const future = content(); future.requires.engine = '2.0.0';
  assert.throws(() => build([future]), /程序版本不足/);
});
test('automatic packages cannot opt the player into DLC through dependencies', () => {
  const base = content('official.base'); base.requires.packages = [{ id: 'optional.dlc', version: '1.0.0' }];
  assert.throws(() => build([base, content('optional.dlc', '1.0.0', true)]), /暗中订阅/);
  const a = content('optional.a', '1.0.0', true), b = content('optional.b', '1.0.0', true);
  a.requires.packages = [{ id: b.id, version: b.version }]; b.requires.packages = [{ id: a.id, version: a.version }];
  assert.throws(() => build([a, b]), /循环/);
});
test('official catalog only admits exact controlled package HTTPS URL', () => {
  for (const url of ['http://cyber2051.top/updates/v3/packages/official.content/1.0.0.json', 'https://evil.test/updates/v3/a.json', 'https://cyber2051.top/updates/v3/../x.json', 'https://cyber2051.top/updates/v3/packages/official.content/1.0.0.json?x=1']) {
    const catalog = copy(build().catalog); catalog.packages[0].url = url;
    assert.throws(() => api.validateCatalog(catalog), /URL/);
  }
});
test('deterministic builds are idempotent while same-version changes and downgrade fail', () => {
  const first = build(), again = build([content()], first.catalog);
  assert.deepEqual(again.catalogBytes, first.catalogBytes);
  assert.deepEqual(again.files[0].bytes, first.files[0].bytes);
  const changed = content(); changed.content.quests[0].brief = '变更';
  assert.throws(() => build([changed], first.catalog), /同版本不能/);
  const v2 = build([content('official.content', '1.1.0')], first.catalog);
  assert.throws(() => build([content()], v2.catalog), /不能降低/);
  assert.throws(() => build([content('official.content', '1.2.0', true)], v2.catalog), /分类/);
});
test('different packages cannot own the same task or image, including the seeded base', () => {
  const base = content('cyber2051.base-content'), dlc = content('optional.dlc', '1.0.0', true);
  base.content.quests[0].id = 'q01'; base.content.gallery[0].id = 'base.sakiko.standard.1';
  const registry = { format: 1, packages: { [base.id]: { version: base.version, optional: false, activation: 'compatible', content: base.content } } };
  const options = { packages: [dlc], privateKey, keyId: 'test.key', existingRegistry: registry };
  dlc.content.quests[0].id = 'q01';
  assert.throws(() => api.buildRelease(options), /跨包内容编号冲突 quests\/q01/);
  dlc.content.quests[0].id = 'dlc.quest'; dlc.content.gallery[0].id = 'base.sakiko.standard.1';
  assert.throws(() => api.buildRelease(options), /跨包内容编号冲突 gallery/);
  dlc.content.gallery[0].id = 'dlc.image';
  assert.doesNotThrow(() => api.buildRelease(options));
  const upgrade = copy(base); upgrade.version = '1.1.0'; upgrade.content.quests[0].brief = '更新基础定义';
  assert.doesNotThrow(() => api.buildRelease({ ...options, packages: [upgrade] }));
  upgrade.version = '1.0.0';
  assert.throws(() => api.buildRelease({ ...options, packages: [upgrade] }), /同版本不能改写已接入/);
  const a = content('optional.a', '1.0.0', true), b = content('optional.b', '1.0.0', true);
  b.content.quests[0].id = a.content.quests[0].id;
  assert.throws(() => build([a, b]), /跨包内容编号冲突/);
});
test('local writing keeps immutable older package files and switches manifest last', () => temp(dir => {
  const first = build(); api.writeRelease(first, dir);
  const originalBytes = fs.readFileSync(path.join(dir, first.files[0].relativePath));
  const v2 = build([content('official.content', '1.1.0')], first.catalog);
  api.writeRelease(v2, dir);
  assert.deepEqual(fs.readFileSync(path.join(dir, first.files[0].relativePath)), originalBytes);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'))), v2.catalog);
  assert.ok(fs.existsSync(path.join(dir, v2.files[0].relativePath)));
  assert.throws(() => api.writeRelease(first, dir), /清单已变化/);
}));
test('existing mismatched package aborts before touching the old manifest', () => temp(dir => {
  const first = build(); api.writeRelease(first, dir);
  const priorManifest = fs.readFileSync(path.join(dir, 'manifest.json'));
  const v2 = build([content('official.content', '1.1.0')], first.catalog);
  const destination = path.join(dir, v2.files[0].relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, 'wrong');
  assert.throws(() => api.writeRelease(v2, dir), /不可变包文件/);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'manifest.json')), priorManifest);
}));
test('output-path traversal is blocked before creating a package', () => temp(dir => {
  const release = build(); release.files[0].relativePath = '../escape.json';
  assert.throws(() => api.writeRelease(release, dir), /超出显式目录/);
  assert.equal(fs.existsSync(path.join(dir, 'manifest.json')), false);
}));
test('CLI defaults to dry-run without key generation or directory writes', () => temp(dir => {
  const source = path.join(dir, 'content.json'), output = path.join(dir, 'out');
  fs.writeFileSync(source, JSON.stringify(content()));
  const args = [path.resolve(__dirname, "../../工具/发布/cli.cjs"), 'build', '--content', source, '--out', output];
  const dry = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(dry.status, 0, dry.stderr); assert.equal(JSON.parse(dry.stdout).mode, 'dry-run');
  assert.equal(fs.existsSync(output), false);
  const write = spawnSync(process.execPath, [...args, '--write'], { encoding: 'utf8' });
  assert.equal(write.status, 1); assert.match(write.stderr, /必须显式提供/); assert.equal(fs.existsSync(output), false);
}));

test('CLI validates published package hash and length as well as its own signature', () => temp(dir => {
  const release = build(); api.writeRelease(release, dir);
  const pub = path.join(dir, 'test-public.pem'); fs.writeFileSync(pub, publicKey.export({ type: 'spki', format: 'pem' }));
  const args = [path.resolve(__dirname, "../../工具/发布/cli.cjs"), 'verify', '--package', path.join(dir, release.files[0].relativePath), '--catalog', path.join(dir, 'manifest.json'), '--public-key', pub, '--key-id', 'test.key'];
  const good = spawnSync(process.execPath, args, { encoding: 'utf8' }); assert.equal(good.status, 0, good.stderr);
  fs.appendFileSync(path.join(dir, release.files[0].relativePath), '\n'); // 签名仍对，传输 bytes/hash 已不同。
  const altered = spawnSync(process.execPath, args, { encoding: 'utf8' }); assert.equal(altered.status, 1); assert.match(altered.stderr, /包与签名清单不一致/);
}));
