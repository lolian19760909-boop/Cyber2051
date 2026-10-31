'use strict';
// Read-only SSH stdin probe. Never print environment values, tokens or user rows.
const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const gw = '/opt/cyber2051/workshop/gateway';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fileInfo = file => fs.existsSync(file) ? { path: file, bytes: fs.statSync(file).size, mode: (fs.statSync(file).mode & 0o777).toString(8), sha256: digest(fs.readFileSync(file)) } : { path: file, exists: false };
const envText = fs.readFileSync('/opt/cyber2051/etc/gateway.env', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).map(line => { const at = line.indexOf('='); let value = line.slice(at + 1).trim(); if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1); return [line.slice(0, at), value]; }));
const loginKeys = ['SESSION_SECRET', 'OAUTH_SALT', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'CXX_ADMIN_TOKEN', 'CXX_IPSALT'];
const db = new DatabaseSync(gw + '/data/workshop.db', { readOnly: true });
const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
const counts = {};
for (const name of tableNames) { if (!/^[a-z_]+$/.test(name)) throw Error('Unexpected table'); counts[name] = db.prepare('SELECT COUNT(*) AS n FROM "' + name + '"').get().n; }
const integrity = db.prepare('PRAGMA quick_check').all().every(row => row.quick_check === 'ok');
const publisherColumns = db.prepare('PRAGMA table_info(publishers)').all().map(row => row.name);
const roleCounts = publisherColumns.includes('can_publish_official') ? db.prepare('SELECT can_publish_official AS enabled,COUNT(*) AS n FROM publishers GROUP BY can_publish_official').all() : [];
const readyCount = db.prepare("SELECT COUNT(*) AS n FROM login_handoffs WHERE status='ready' AND session_token IS NOT NULL AND expires_at>?").get(new Date().toISOString()).n;
db.close();
(async () => {
  const healthResponse = await fetch('http://127.0.0.1:8787/api/workshop/health');
  const health = await healthResponse.json();
  const evidence = {
    checkedAt: new Date().toISOString(), target: 'cyber2051.top / 192.255.152.208', node: process.version,
    gatewayRoot: gw, health: { status: healthResponse.status, version: health.version, ok: health.ok },
    services: cp.execFileSync('systemctl', ['is-active', 'cxx-gateway', 'caddy'], { encoding: 'utf8' }).trim().split('\n'),
    serviceUser: cp.execFileSync('systemctl', ['show', 'cxx-gateway', '--property=User', '--value'], { encoding: 'utf8' }).trim(),
    writablePaths: cp.execFileSync('systemctl', ['show', 'cxx-gateway', '--property=ReadWritePaths', '--value'], { encoding: 'utf8' }).trim(),
    sourceFiles: ['server.js', 'official-release.cjs', 'public/publish.html', 'public/publish.js', 'public/admin.html', 'public/my.html'].map(name => fileInfo(gw + '/' + name)),
    configFiles: ['/etc/caddy/Caddyfile', '/etc/systemd/system/cxx-gateway.service'].map(fileInfo),
    loginConfigurationPresent: Object.fromEntries(loginKeys.map(key => [key, !!env[key]])),
    officialConfigurationPresent: Object.fromEntries(['CXX_FORMAT3_PACKAGES_MODULE', 'CXX_OFFICIAL_RELEASE_DIR', 'CXX_OFFICIAL_SIGNING_KEY_FILE', 'CXX_OFFICIAL_KEY_ID'].map(key => [key, !!env[key]])),
    devHooksEnabled: /^['"]?1['"]?$/.test(env.CXX_ENABLE_DEV || ''),
    counts, integrity, roleCounts, unexpiredReadyHandoffs: readyCount, realSessionUsed: false,
    signingKeyAlreadyExists: fs.existsSync('/etc/cyber2051/official-signing/private.pem'),
    v3: { exists: fs.existsSync('/opt/cyber2051/updates/v3'), manifestExists: fs.existsSync('/opt/cyber2051/updates/v3/manifest.json') }
  };
  console.log(JSON.stringify(evidence, null, 2));
  if (healthResponse.status !== 200 || !health.ok || !integrity || evidence.devHooksEnabled || evidence.services.some(value => value !== 'active') || loginKeys.some(key => !env[key])) process.exitCode = 1;
})().catch(() => { console.error('Read-only preflight failed; no secret output'); process.exitCode = 1; });
