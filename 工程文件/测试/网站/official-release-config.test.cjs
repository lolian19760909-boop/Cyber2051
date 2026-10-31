'use strict';
// 只读静态配置检查；不执行 Caddy/systemd，不启动服务，不读取真实 env 或私钥。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../网站');
const caddy = fs.readFileSync(path.join(root, 'caddy/Caddyfile'), 'utf8');
const service = fs.readFileSync(path.join(root, 'deploy/cxx-gateway.service'), 'utf8');
const env = Object.fromEntries(fs.readFileSync(path.join(root, 'deploy/gateway.env.example'), 'utf8').split(/\r?\n/).filter(line => /^[A-Z0-9_]+=/.test(line)).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
test('Caddy exposes only the intended publisher page/script through existing static handlers', () => {
  const pages = caddy.match(/^\s*@rootpages path (.*)$/m)[1].trim().split(/\s+/);
  const assets = caddy.match(/^\s*@static path (.*)$/m)[1].trim().split(/\s+/);
  assert.ok(pages.includes('/publish.html')); assert.ok(assets.includes('/publish.js'));
  assert.ok(pages.includes('/workshop.html') && pages.includes('/my.html'));
  assert.ok(assets.includes('/user.js') && assets.includes('/site.css'));
  for (const pathname of ['/publish.html', '/publish.js']) assert.equal(fs.statSync(path.join(root, 'gateway/public', pathname)).isFile(), true);
  assert.equal([...pages, ...assets].some(name => /server\.js|official-release\.cjs|gateway\.env/.test(name)), false);
  assert.match(caddy, /handle \/api\/\*\s*\{\s*reverse_proxy 127\.0\.0\.1:8787/);
});
test('v3 manifest exact handler revalidates; legacy update routing/CORS and package caching remain', () => {
  const handler = caddy.match(/handle \/updates\/v3\/manifest\.json\s*\{([\s\S]*?)\n\t\}/);
  assert.ok(handler); assert.match(handler[1], /header Cache-Control "no-cache"/);
  assert.match(handler[1], /uri strip_prefix \/updates/); assert.match(handler[1], /root \* \/opt\/cyber2051\/updates/);
  assert.ok(caddy.indexOf(handler[0]) < caddy.indexOf('handle /updates/*'));
  assert.match(caddy, /@updman path \/updates\/manifest\.json/);
  assert.match(caddy, /handle \/updates\/\*\s*\{[\s\S]*?header Cache-Control "public, max-age=3600"/);
  assert.match(caddy, /@updatecors path \/updates\/\* \/download\/\*/);
  assert.match(caddy, /header @updatecors Access-Control-Allow-Origin "\*"/);
});
test('service keeps hardening and adds only the fixed optional v3 write path', () => {
  for (const line of ['User=cxxapp', 'Group=cxxapp', 'ProtectSystem=strict', 'ProtectHome=true', 'NoNewPrivileges=true', 'PrivateTmp=true', 'ExecStart=/usr/bin/node server.js']) assert.ok(service.split(/\r?\n/).includes(line));
  const writes = [...service.matchAll(/^ReadWritePaths=(.*)$/gm)].flatMap(match => match[1].trim().split(/\s+/));
  assert.deepEqual(writes, ['/opt/cyber2051/workshop/gateway/data', '/opt/cyber2051/workshop/gateway/storage', '-/opt/cyber2051/updates/v3']);
  assert.equal(service.includes('ExecStartPre='), false);
  assert.equal(writes.map(item => item.replace(/^-/, '')).includes('/opt/cyber2051/updates'), false);
});
test('four publisher settings remain external, disabled by empty keyId, with correct dependency layout', () => {
  assert.equal(env.CXX_FORMAT3_PACKAGES_MODULE, '/opt/cyber2051/official-release/tools/packages.cjs');
  assert.equal(env.CXX_OFFICIAL_RELEASE_DIR, '/opt/cyber2051/updates/v3');
  assert.equal(env.CXX_OFFICIAL_SIGNING_KEY_FILE, '/etc/cyber2051/official-signing/private.pem');
  assert.equal(env.CXX_OFFICIAL_KEY_ID, '');
  const moduleSource = fs.readFileSync(path.join(root, '../工具/发布/packages.cjs'), 'utf8');
  assert.match(moduleSource, /require\(['"]\.\.\/lib\/runtime-components\.cjs['"]\)/);
  assert.equal(fs.statSync(path.join(root, '../工具/lib/runtime-components.cjs')).isFile(), true);
  assert.equal(Object.keys(env).some(key => /PRIVATE_KEY$|PRIVATE_KEY_PEM/.test(key)), false);
  for (const [, servedRoot] of caddy.matchAll(/root \* (\S+)/g)) assert.equal(env.CXX_OFFICIAL_SIGNING_KEY_FILE.startsWith(servedRoot + '/'), false);
});
