'use strict';
// SSH stdin 只读核对；不消费凭据，不输出玩家身份或内容。
const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const gw = '/opt/cyber2051/workshop/gateway';
const stage = process.argv[2] || '/tmp/cxx-repair-20261003-approved/vps';
const backup = process.argv[3] || '/opt/cyber2051/backup/pre-repair-20261003-110359';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const targets = [
  ['gateway/server.js', gw + '/server.js'],
  ...['admin.html', 'my.html', 'submit.html', 'user.js', 'i18n.js'].map(name => ['gateway/public/' + name, gw + '/public/' + name]),
  ['caddy/Caddyfile', '/etc/caddy/Caddyfile'],
  ['deploy/cxx-gateway.service', '/etc/systemd/system/cxx-gateway.service']
];
const files = targets.map(([source, target]) => {
  const expected = hash(fs.readFileSync(stage + '/' + source));
  const actual = hash(fs.readFileSync(target));
  return { source, expected, actual, ok: expected === actual };
});
const db = new DatabaseSync(gw + '/data/workshop.db', { readOnly: true });
const after = {};
for (const table of ['publishers', 'submissions', 'feedback', 'announcements', 'login_handoffs']) after[table] = db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n;
const integrity = db.prepare('PRAGMA quick_check').all();
db.close();
const before = JSON.parse(fs.readFileSync(backup + '/data-counts-before.json', 'utf8'));
const backupHash = hash(fs.readFileSync(backup + '/gateway.tar'));
const backupHashExpected = fs.readFileSync(backup + '/gateway.tar.sha256', 'utf8').split(/\s/)[0];
const oldSource = cp.execFileSync('tar', ['-xOf', backup + '/gateway.tar', 'server.js']);
const services = cp.execFileSync('systemctl', ['is-active', 'cxx-gateway', 'caddy'], { encoding: 'utf8' }).trim().split('\n');
const writablePaths = cp.execFileSync('systemctl', ['show', 'cxx-gateway', '--property=ReadWritePaths', '--value'], { encoding: 'utf8' }).trim();
const originHeaders = cp.execFileSync('curl', ['-sS', '--resolve', 'cyber2051.top:443:127.0.0.1', '-D', '-', '-o', '/dev/null', 'https://cyber2051.top/updates/manifest.json'], { encoding: 'utf8' });
const evidence = {
  checkedAt: new Date().toISOString(), files, services, writablePaths,
  before, after, countsEqual: JSON.stringify(before) === JSON.stringify(after), integrity,
  backup, backupMode: (fs.statSync(backup).mode & 0o777).toString(8), backupHash, backupHashOk: backupHash === backupHashExpected,
  backedUpServerHash: hash(oldSource), storageExists: fs.statSync(gw + '/storage').isDirectory(), originHeaders
};
console.log(JSON.stringify(evidence, null, 2));
if (files.some(x => !x.ok) || services.some(x => x !== 'active') || !evidence.backupHashOk || integrity.some(x => x.quick_check !== 'ok')) process.exitCode = 1;
