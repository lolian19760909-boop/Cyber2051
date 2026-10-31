'use strict';
// 发布事务只运行在临时目录；不调用 SSH/SCP。
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const ops = require("../../../工具/发布/release-transaction.cjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-release-test-'));
let passed = 0;
function test(name, fn) { fn(); console.log('PASS ' + name); passed++; }
function fixture(version = '1.1.0') {
  const base = path.join(root, String(passed)), stage = path.join(base, 'stage'); fs.mkdirSync(stage, { recursive: true });
  for (const dir of ['updates', 'download']) fs.mkdirSync(path.join(base, dir));
  fs.writeFileSync(path.join(base, 'updates/manifest.json'), JSON.stringify({ cardId: 'cyber2051', latest: '1.0.0', versions: [{ version: '1.0.0', notes: 'old' }] }));
  fs.writeFileSync(path.join(base, 'download/manifest.json'), JSON.stringify({ latest: '1.0.0', png: {}, json: {} }));
  const files = ['pack.json', 'card.png', 'card.json'].map((file, i) => { const bytes = Buffer.from('synthetic-' + i); fs.writeFileSync(path.join(stage, file), bytes); return { file, size: bytes.length, sha256: ops.sha(bytes) }; });
  fs.writeFileSync(path.join(stage, 'release.json'), JSON.stringify({ version, notes: 'new', files })); return { base, stage };
}
const latest = (base, zone) => JSON.parse(fs.readFileSync(path.join(base, zone, 'manifest.json'))).latest;
try {
  test('缺 PNG/JSON 在网络操作前拒绝', () => { assert.throws(() => ops.preflight(null, null, '1.1.0'), /同时提供/); assert.throws(() => execFileSync(process.execPath, [path.join(__dirname, '../release/release_update.mjs'), '--version', '1.1.0'], { stdio: 'pipe' }), /同时提供/); });
  test('PNG 与 JSON 的内容/版本不一致被拒绝', () => {
    const card = { data: { name: 'fixture V1.1.0', character_version: '1.1.0', character_book: { name: 'fixture 1.1.0' }, extensions: { world: 'fixture 1.1.0' } } };
    const text = Buffer.from('chara\0' + Buffer.from(JSON.stringify(card)).toString('base64'));
    const chunk = Buffer.alloc(text.length + 12); chunk.writeUInt32BE(text.length); chunk.write('tEXt', 4); text.copy(chunk, 8);
    const png = path.join(root, 'fixture.png'), json = path.join(root, 'fixture.json');
    fs.writeFileSync(png, Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk])); fs.writeFileSync(json, JSON.stringify(card));
    assert.equal(ops.preflight(png, json, '1.1.0').card.data.character_version, '1.1.0');
    card.data.description = 'different'; fs.writeFileSync(json, JSON.stringify(card)); assert.throws(() => ops.preflight(png, json, '1.1.0'), /内容不一致/);
    assert.throws(() => ops.preflight(png, json, '1.2.0'), /版本/);
  });
  test('禁止降版', () => { const f = fixture('0.9.0'); assert.throws(() => ops.publish(f.base, f.stage), /降版/); assert.equal(latest(f.base, 'updates'), '1.0.0'); });
  test('禁止同版覆盖', () => { const f = fixture('1.0.0'); assert.throws(() => ops.publish(f.base, f.stage), /覆盖/); });
  test('清单损坏不能当成首次发布', () => { const f = fixture(); fs.writeFileSync(path.join(f.base, 'updates/manifest.json'), '{broken'); assert.throws(() => ops.publish(f.base, f.stage)); assert.equal(latest(f.base, 'download'), '1.0.0'); });
  test('暂存文件损坏不能更新指针', () => { const f = fixture(); fs.writeFileSync(path.join(f.stage, 'pack.json'), 'changed'); assert.throws(() => ops.publish(f.base, f.stage), /校验失败/); assert.equal(latest(f.base, 'updates'), '1.0.0'); });
  test('成功发布保留两种清单历史，三个文件一致', () => { const f = fixture(); ops.publish(f.base, f.stage); assert.equal(latest(f.base, 'updates'), '1.1.0'); const um = JSON.parse(fs.readFileSync(path.join(f.base, 'updates/manifest.json'))), dm = JSON.parse(fs.readFileSync(path.join(f.base, 'download/manifest.json'))); assert.equal(um.versions[1].version, '1.0.0'); assert.equal(dm.history[0].latest, '1.0.0'); assert.equal(ops.sha(fs.readFileSync(path.join(f.base, 'download/cyber2051-V1.1.0.json'))), dm.json.sha256); ops.rollback(f.base, f.stage); assert.equal(latest(f.base, 'updates'), '1.0.0'); assert.equal(latest(f.base, 'download'), '1.0.0'); });
  test('第二个清单写入失败恢复两个旧指针', () => { const f = fixture(); const rename = fs.renameSync; let fault = true; fs.renameSync = (a, b) => { if (fault && b === path.join(f.base, 'updates/manifest.json')) { fault = false; throw Error('synthetic disk failure'); } return rename(a, b); }; try { assert.throws(() => ops.publish(f.base, f.stage), /disk failure/); } finally { fs.renameSync = rename; } assert.equal(latest(f.base, 'updates'), '1.0.0'); assert.equal(latest(f.base, 'download'), '1.0.0'); });
  test('回退不能覆盖后来发布的版本', () => { const f = fixture(); ops.publish(f.base, f.stage); fs.writeFileSync(path.join(f.base, 'updates/manifest.json'), JSON.stringify({ latest: '1.2.0' })); assert.throws(() => ops.rollback(f.base, f.stage), /其他发布/); assert.equal(latest(f.base, 'download'), '1.1.0'); });
  test('已存在的版本字节禁止覆盖', () => { const f = fixture(); fs.mkdirSync(path.join(f.base, 'updates/packages')); fs.writeFileSync(path.join(f.base, 'updates/packages/v1.1.0.update.json'), 'existing'); assert.throws(() => ops.publish(f.base, f.stage), /已存在/); assert.equal(latest(f.base, 'updates'), '1.0.0'); });
  console.log(`RESULT ${passed} passed / 0 failed（临时目录，未发布）`);
} catch (e) { console.error(e); process.exitCode = 1; } finally { fs.rmSync(root, { recursive: true, force: true }); }
