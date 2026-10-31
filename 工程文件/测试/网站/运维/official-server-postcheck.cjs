'use strict';
// Read-only live/backup verification. Print checks, never secrets or user rows.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const [stage, backup] = process.argv.slice(2);
if (!/^\/tmp\/cxx-official-[a-zA-Z0-9-]+\/vps$/.test(stage || '') || !/^\/opt\/cyber2051\/backup\/pre-official-\d{8}-\d{6}$/.test(backup || '')) throw Error('Fixed deployment paths required');
const gw = '/opt/cyber2051/workshop/gateway';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checks = [];
function check(name, ok, details = {}) { checks.push({ name, ok: !!ok, ...details }); }
function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || Object.hasOwn(result, match[1])) throw Error('Ambiguous environment configuration');
    let value = match[2].trim(); if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}
function quote(identifier) { if (!/^[a-z_]+$/.test(identifier)) throw Error('Unexpected database identifier'); return '"' + identifier + '"'; }
function rowsHash(db, table, columns) { return hash(JSON.stringify(db.prepare('SELECT ' + columns.map(quote).join(',') + ' FROM ' + quote(table)).all().map(row => JSON.stringify(columns.map(column => row[column]))).sort())); }
(async () => {
  const targets = {
    'gateway/server.js': gw + '/server.js', 'gateway/official-release.cjs': gw + '/official-release.cjs',
    ...Object.fromEntries(['publish.html', 'publish.js', 'admin.html', 'my.html'].map(name => ['gateway/public/' + name, gw + '/public/' + name])),
    'official-release/tools/packages.cjs': '/opt/cyber2051/official-release/tools/packages.cjs',
    "工具/lib/runtime-components.cjs": '/opt/cyber2051/vps/release/runtime-components.cjs',
    'caddy/Caddyfile': '/etc/caddy/Caddyfile', 'deploy/cxx-gateway.service': '/etc/systemd/system/cxx-gateway.service'
  };
  const manifestText = fs.readFileSync(stage + '/official-files.sha256', 'utf8');
  const stageEntries = manifestText.trim().split('\n').map(row => { const match = row.match(/^([a-f0-9]{64})  ([a-zA-Z0-9._/-]+)$/); if (!match) throw Error('Invalid public manifest'); return { relative: match[2], expected: match[1] }; });
  check('candidate_manifest_11_public_files', stageEntries.length === 11 && new Set(stageEntries.map(row => row.relative)).size === 11 && stageEntries.every(row => hash(fs.readFileSync(stage + '/' + row.relative)) === row.expected), { manifestSha256: hash(manifestText) });
  const installedFiles = Object.entries(targets).map(([relative, target]) => ({ relative, target, expected: hash(fs.readFileSync(stage + '/' + relative)), actual: hash(fs.readFileSync(target)) }));
  check('installed_10_files_match', installedFiles.every(file => file.expected === file.actual));
  const services = cp.execFileSync('systemctl', ['is-active', 'cxx-gateway', 'caddy'], { encoding: 'utf8' }).trim().split('\n');
  check('both_services_active', services.length === 2 && services.every(value => value === 'active'));
  check('restricted_backup_directory', (fs.statSync(backup).mode & 0o777) === 0o700);
  check('predeploy_backup_checksums', cp.spawnSync('sha256sum', ['-c', '--quiet', 'backup-files.sha256'], { cwd: backup }).status === 0);
  check('new_key_backup_checksums', cp.spawnSync('sha256sum', ['-c', '--quiet', 'signing-ready.sha256'], { cwd: backup }).status === 0);
  const beforeEnvText = fs.readFileSync(backup + '/gateway.env', 'utf8');
  const beforeEnv = parseEnv(beforeEnvText), afterEnv = parseEnv(fs.readFileSync('/opt/cyber2051/etc/gateway.env', 'utf8'));
  check('all_original_environment_values_unchanged', Object.entries(beforeEnv).every(([key, value]) => afterEnv[key] === value));
  const pid = cp.execFileSync('systemctl', ['show', 'cxx-gateway', '--property=MainPID', '--value'], { encoding: 'utf8' }).trim();
  const liveEnv = Object.fromEntries(fs.readFileSync('/proc/' + pid + '/environ', 'utf8').split('\0').filter(Boolean).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
  check('live_process_keeps_original_login_configuration', Object.entries(beforeEnv).every(([key, value]) => liveEnv[key] === value));
  const expectedOfficial = { CXX_FORMAT3_PACKAGES_MODULE: '/opt/cyber2051/official-release/tools/packages.cjs', CXX_OFFICIAL_RELEASE_DIR: '/opt/cyber2051/updates/v3', CXX_OFFICIAL_SIGNING_KEY_FILE: '/etc/cyber2051/official-signing/private.pem', CXX_OFFICIAL_KEY_ID: 'cyber2051-official-20261003' };
  check('official_configuration_fixed_and_loaded', Object.entries(expectedOfficial).every(([key, value]) => afterEnv[key] === value && liveEnv[key] === value));
  const privateFile = expectedOfficial.CXX_OFFICIAL_SIGNING_KEY_FILE;
  const liveKey = crypto.createPrivateKey(fs.readFileSync(privateFile));
  const restoredKey = crypto.createPrivateKey(fs.readFileSync(backup + '/signing-ready/private.pem'));
  const publicDer = crypto.createPublicKey(liveKey).export({ type: 'spki', format: 'der' });
  const restoredDer = crypto.createPublicKey(restoredKey).export({ type: 'spki', format: 'der' });
  const proof = Buffer.from('cyber2051 production backup recovery check');
  check('signing_backup_restores_identical_public_key', publicDer.equals(restoredDer) && crypto.verify(null, proof, crypto.createPublicKey(liveKey), crypto.sign(null, proof, restoredKey)));
  const keyStat = fs.statSync(privateFile), backupKeyStat = fs.statSync(backup + '/signing-ready/private.pem');
  check('private_key_permissions', keyStat.uid === 0 && (keyStat.mode & 0o777) === 0o640 && backupKeyStat.uid === 0 && (backupKeyStat.mode & 0o777) === 0o600);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-official-dbverify-'));
  fs.chmodSync(scratch, 0o700);
  const dataChecks = [];
  try {
    cp.execFileSync('tar', ['-xf', backup + '/gateway-full.tar', '-C', scratch, 'workshop/gateway/data'], { stdio: 'pipe' });
    for (const relative of ['workshop', 'workshop/gateway', 'workshop/gateway/data', 'workshop/gateway/data/workshop.db', 'workshop/gateway/data/workshop.db-wal', 'workshop/gateway/data/workshop.db-shm']) {
      const extracted = path.join(scratch, relative);
      if (fs.existsSync(extracted) && (fs.lstatSync(extracted).isSymbolicLink() || !fs.realpathSync(extracted).startsWith(fs.realpathSync(scratch) + path.sep))) throw Error('Backup database escapes isolated scratch');
    }
    const oldDb = new DatabaseSync(scratch + '/workshop/gateway/data/workshop.db', { readOnly: true });
    const liveDb = new DatabaseSync(gw + '/data/workshop.db', { readOnly: true });
    try {
      for (const { name } of oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
        const columns = oldDb.prepare('PRAGMA table_info(' + quote(name) + ')').all().map(row => row.name);
        const beforeCount = oldDb.prepare('SELECT COUNT(*) AS n FROM ' + quote(name)).get().n;
        const afterCount = liveDb.prepare('SELECT COUNT(*) AS n FROM ' + quote(name)).get().n;
        dataChecks.push({ table: name, beforeCount, afterCount, originalRowsUnchanged: rowsHash(oldDb, name, columns) === rowsHash(liveDb, name, columns) });
      }
      const identities = oldDb.prepare('SELECT publisher_id,discord_id_hash,created_at FROM publishers').all();
      const originalIdentitiesPreserved = identities.every(row => {
        const current = liveDb.prepare('SELECT discord_id_hash,created_at FROM publishers WHERE publisher_id=?').get(row.publisher_id);
        return current && current.discord_id_hash === row.discord_id_hash && current.created_at === row.created_at;
      });
      check('all_original_account_identity_mappings_preserved', originalIdentitiesPreserved, { originalAccounts: identities.length });
      check('no_real_accounts_granted_official_permission', liveDb.prepare('SELECT COUNT(*) AS n FROM publishers WHERE can_publish_official != 0').get().n === 0);
      check('new_official_tables_empty', ['official_release_head', 'official_release_previews', 'official_release_audit'].every(table => liveDb.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n === 0));
      check('live_and_backup_database_integrity', [oldDb, liveDb].every(db => db.prepare('PRAGMA integrity_check').all().every(row => row.integrity_check === 'ok')));
    } finally { oldDb.close(); liveDb.close(); }
  } finally {
    if (fs.realpathSync(scratch) !== scratch || !path.basename(scratch).startsWith('cxx-official-dbverify-') || path.dirname(scratch) !== fs.realpathSync(os.tmpdir())) throw Error('Scratch cleanup target changed');
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  check('no_public_release_created', !fs.existsSync('/opt/cyber2051/updates/v3/manifest.json'));
  check('deployment_lock_released', !fs.existsSync('/opt/cyber2051/updates/v3/.official-release.lock'));
  const healthResponse = await fetch('http://127.0.0.1:8787/api/workshop/health', { signal: AbortSignal.timeout(10000) });
  const health = await healthResponse.json();
  check('live_gateway_health', healthResponse.status === 200 && health.ok && health.version === '0.8.1');
  const result = { checkedAt: new Date().toISOString(), target: 'cyber2051.top / 192.255.152.208', stage, backup, scope: 'read-only original DB/env protection and independent signature backup recovery; no identity tokens, real OAuth or public release', passed: checks.filter(item => item.ok).length, failed: checks.filter(item => !item.ok).length, checks, installedFiles, dataChecks, signingPublicKey: { keyId: expectedOfficial.CXX_OFFICIAL_KEY_ID, spkiBase64: publicDer.toString('base64'), spkiSha256: hash(publicDer), pem: crypto.createPublicKey(liveKey).export({ type: 'spki', format: 'pem' }).toString() }, realOAuthAccepted: false };
  console.log(JSON.stringify(result, null, 2));
  if (result.failed) process.exitCode = 1;
})().catch(() => { console.error('Production postcheck failed; no secret output'); process.exitCode = 1; });
