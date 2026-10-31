'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { createOfficialRelease } = require("../../网站/gateway/official-release.cjs");
const F = require("../../网站/gateway/official-release-fixtures.cjs");
for (const stage of ['before-manifest', 'after-manifest']) test('real process exit at ' + stage + ' keeps durable audit and refuses stale-lock takeover', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-official-crash-test-'));
  let db;
  try {
    const keys = F.keys(), keyFile = path.join(root, 'test-only.pem'), database = path.join(root, 'test.db');
    fs.writeFileSync(keyFile, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    const config = { modulePath: path.resolve(__dirname, "../../工具/发布/packages.cjs"), outputDirectory: path.join(root, 'v3'), privateKeyFile: keyFile, keyId: 'test.key' };
    const childScript = `const fs=require('node:fs'),{DatabaseSync}=require('node:sqlite');
      const {createOfficialRelease}=require(${JSON.stringify(path.join(__dirname, "../../网站/gateway/official-release.cjs"))});
      const F=require(${JSON.stringify(path.join(__dirname, "../../网站/gateway/official-release-fixtures.cjs"))});
      const info=JSON.parse(process.argv[1]),db=new DatabaseSync(info.database);
      db.exec('CREATE TABLE publishers (publisher_id TEXT PRIMARY KEY,status TEXT,display_name_last TEXT)');
      db.prepare('INSERT INTO publishers VALUES (?,?,?)').run('1111111111111111','active','crash fixture');
      const api=createOfficialRelease({db,config:info.config,authorize:()=>({sess:{publisherId:'1111111111111111'}}),send:()=>{},readRawBody:()=>{},fault:s=>{if(s===info.stage)process.exit(86)}});
      db.prepare('UPDATE publishers SET can_publish_official=1').run();
      const preview=api.preview({}, {card:F.card(info.pem)});
      api.publish({}, {previewId:preview.previewId,previewHash:preview.previewHash});`;
    const result = spawnSync(process.execPath, ['-e', childScript, JSON.stringify({ database, config, pem: keys.pem, stage })], { windowsHide: true, timeout: 10000 });
    assert.equal(result.status, 86);
    db = new DatabaseSync(database);
    const api = createOfficialRelease({ db, config, authorize: () => ({ sess: { publisherId: '1111111111111111' } }), send: () => {}, readRawBody: () => {} });
    assert.equal(api.me({}).readinessReason, 'release_locked');
    assert.equal(db.prepare('SELECT status FROM official_release_audit').get().status, 'prepared');
    // 模拟运维在确认测试子进程已退出后，只清理此夹具的已知锁。
    const lock = path.join(config.outputDirectory, '.official-release.lock');
    assert.ok(lock.startsWith(path.resolve(root) + path.sep));
    const owner = JSON.parse(fs.readFileSync(path.join(lock, 'owner.json')));
    assert.ok(Number.isSafeInteger(owner.pid));
    fs.unlinkSync(path.join(lock, 'owner.json')); fs.rmdirSync(lock);
    const status = api.me({}); assert.equal(status.publishingReady, true);
    assert.equal(db.prepare('SELECT status FROM official_release_audit').get().status, stage === 'after-manifest' ? 'committed' : 'aborted');
    assert.equal(status.packages.length, stage === 'after-manifest' ? 2 : 0);
    assert.equal(fs.readdirSync(config.outputDirectory).some(name => name.startsWith('.manifest-')), false);
  } finally {
    db?.close();
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('cxx-official-crash-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
