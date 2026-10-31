'use strict';
// 实际服务器源码 + 临时 SQLite/附件目录；不连接 VPS、不接触玩家数据。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-regression-'));
let handler;
const source = fs.readFileSync(path.join(__dirname, "../../../网站/gateway/server.js"), 'utf8');
const gatewayRequire = createRequire(path.resolve(__dirname, "../../../网站/gateway/server.js"));
const ctx = vm.createContext({
  require: (id) => id === 'node:http' ? { createServer: (fn) => { handler = fn; return { listen() {}, on() {}, close() {} }; } } : gatewayRequire(id),
  __dirname: root, Buffer, URL, URLSearchParams, AbortSignal, setTimeout, clearTimeout,
  console: { log() {}, error() {} },
  process: { env: { CXX_ADMIN_TOKEN: 'isolated-admin', CXX_IPSALT: 'isolated-salt', SESSION_SECRET: 'isolated-session', DISCORD_CLIENT_ID: 'fake', DISCORD_CLIENT_SECRET: 'fake', CXX_ENABLE_DEV: '1' }, on() {}, exit() { throw Error('startup failed'); } },
  fetch: async (url) => ({ json: async () => String(url).includes('/oauth2/token') ? { access_token: 'fake' } : { id: 'synthetic-id', username: '<img src=x onerror=alert(1)>', avatar: 'fake' } }),
});
vm.runInContext(source + '\n globalThis.testApi = {db, issueSessionToken, encKey, sha256hex, hmac};', ctx);
const { db, issueSessionToken, encKey, sha256hex, hmac } = ctx.testApi;
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
async function request(method, url, body, headers = {}, beforeEnd) {
  const req = new EventEmitter(); Object.assign(req, { method, url, headers: { host: 'localhost', ...headers }, socket: { remoteAddress: '127.0.0.1' }, destroy() {} });
  let status, responseHeaders = {}, output;
  const res = { headersSent: false, writableEnded: false, setHeader(k, v) { responseHeaders[k.toLowerCase()] = v; }, writeHead(code, h) { status = code; this.headersSent = true; for (const [k, v] of Object.entries(h || {})) responseHeaders[k.toLowerCase()] = v; }, end(text) { this.writableEnded = true; output = text; } };
  await handler(req, res);
  if (body !== undefined) req.emit('data', Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
  if (beforeEnd) beforeEnd();
  req.emit('end');
  await new Promise((resolve) => setImmediate(resolve));
  let json; try { json = JSON.parse(output); } catch {}
  return { status, headers: responseHeaders, text: output, json };
}
const admin = { authorization: 'Bearer isolated-admin' };
const pid = 'aaaaaaaaaaaaaaaa';
const token = issueSessionToken(pid, 'test');
const owner = { authorization: 'Bearer ' + token };
const key = { 'x-edit-key': 'test-key', 'x-filename': 'sample.txt' };
function seed(status = 'pending') {
  db.prepare("INSERT OR IGNORE INTO publishers(publisher_id,discord_id_hash,created_at,last_login_at,status) VALUES (?,?,'now','now','active')").run(pid, 'hash-test');
  db.prepare("UPDATE publishers SET status='active' WHERE publisher_id=?").run(pid);
  db.prepare('DELETE FROM submissions').run();
  db.prepare("INSERT INTO submissions(id,created_at,updated_at,type,title,payload,content_hash,edit_key_hash,ip_hash,status,publisher_id) VALUES (1,'now','now','world_factor','test','{}','hash',?,'ip',?,?)").run(encKey('test-key'), status, pid);
}
(async () => {
  seed();
  await test('匿名不能读取账号', async () => assert.equal((await request('GET', '/api/admin/accounts')).status, 401));
  for (const action of ['ban', 'unban', 'delete']) await test('匿名不能' + action + '，数据不变', async () => { assert.equal((await request('POST', '/api/admin/accounts/' + pid + '/' + action, {})).status, 401); assert.equal(db.prepare('SELECT status FROM publishers WHERE publisher_id=?').get(pid).status, 'active'); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n, 1); });
  await test('错误管理 token 拒绝', async () => assert.equal((await request('GET', '/api/admin/accounts', undefined, { authorization: 'Bearer wrong' })).status, 401));
  await test('正确管理 token 可读取', async () => assert.equal((await request('GET', '/api/admin/accounts', undefined, admin)).status, 200));
  await test('JSON null/数组/字符串被拒绝且进程存活', async () => { for (const raw of ['null', '[]', '"bad"']) assert.equal((await request('POST', '/api/workshop/submissions', raw, owner)).status, 400); assert.equal((await request('GET', '/api/workshop/health')).status, 200); });
  await test('公开跨域和 Bearer 预检', async () => { assert.equal((await request('GET', '/api/workshop/submissions', undefined, { origin: 'http://localhost:8000' })).headers['access-control-allow-origin'], '*'); const r = await request('OPTIONS', '/api/workshop/submissions', undefined, { origin: 'null', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' }); assert.equal(r.status, 204); assert.ok(r.headers['access-control-allow-headers'].toLowerCase().includes('authorization')); assert.equal(r.headers['access-control-allow-credentials'], undefined); });
  await test('未知公开路由返回404', async () => assert.equal((await request('GET', '/api/workshop/missing')).status, 404));
  await test('所有者会话能上传附件，进入待审并加版本', async () => { seed('approved'); const r = await request('POST', '/api/workshop/submissions/1/attachment', Buffer.from('new file'), { ...owner, 'x-filename': 'sample.txt' }); assert.equal(r.status, 201); const row = db.prepare('SELECT status,revision FROM submissions WHERE id=1').get(); assert.equal(row.status, 'pending'); assert.equal(row.revision, 2); });
  await test('附件上传期间改稿不能覆盖新版本', async () => { seed('approved'); const r = await request('POST', '/api/workshop/submissions/1/attachment', Buffer.from('racing file'), key, () => db.prepare('UPDATE submissions SET revision=revision+1 WHERE id=1').run()); assert.equal(r.status, 409); });
  await test('旧审核页面不能审批新版本', async () => { seed(); db.prepare('UPDATE submissions SET revision=2 WHERE id=1').run(); assert.equal((await request('POST', '/api/admin/submissions/1/approve', { baseRevision: 1 }, admin)).status, 409); assert.equal(db.prepare('SELECT status FROM submissions WHERE id=1').get().status, 'pending'); assert.equal((await request('POST', '/api/admin/submissions/1/approve', { baseRevision: 2 }, admin)).status, 200); });
  await test('封禁后密钥和会话均不可互动', async () => { seed(); await request('POST', '/api/admin/accounts/' + pid + '/ban', {}, admin); for (const [url, body, h] of [['/api/workshop/submissions/1/update', { editKey: 'test-key', baseRevision: 1, title: 'changed' }, {}], ['/api/workshop/submissions/1/withdraw', { editKey: 'test-key' }, {}], ['/api/workshop/submissions/1/attachment', Buffer.from('bad'), key]]) assert.equal((await request('POST', url, body, h)).status, 403); assert.equal((await request('GET', '/api/workshop/me/submissions', undefined, owner)).status, 403); assert.equal(db.prepare('SELECT status FROM submissions WHERE id=1').get().status, 'pending'); });
  await test('重复登录会话返回409', async () => { const data = { handoffId: 'isolated-login-1234567890', challenge: sha256hex('isolated-secret-1234567890') }; assert.equal((await request('POST', '/api/workshop/login-handoff/start', data)).status, 200); assert.equal((await request('POST', '/api/workshop/login-handoff/start', data)).status, 409); });
  await test('ready 过期不能领 token', async () => { db.prepare("INSERT INTO login_handoffs(handoff_id,challenge,status,created_at,expires_at,session_token) VALUES (?,?,'ready','now','2000-01-01','secret')").run('isolated-expired-123456', sha256hex('isolated-secret-1234567890')); assert.equal((await request('GET', '/api/workshop/login-handoff?handoffId=isolated-expired-123456&secret=isolated-secret-1234567890')).status, 410); });
  await test('新 token 不含 Discord 原始 ID/头像地址', async () => { const claims = JSON.parse(Buffer.from(issueSessionToken(pid, 'test', 'https://cdn.discordapp.com/avatars/raw-id/fake.png').split('.')[0], 'base64url')); assert.equal(claims.a, undefined); });
  await test('OAuth 展示名按文本输出', async () => { const id = 'isolated-oauth-1234567890'; await request('POST', '/api/workshop/login-handoff/start', { handoffId: id, challenge: sha256hex('isolated-secret-1234567890') }); const r = await request('GET', '/api/workshop/oauth/callback?code=fake&state=' + encodeURIComponent(id + '.' + hmac(id))); assert.ok(!r.text.includes('<img src=x')); assert.ok(r.text.includes('&lt;img')); });
  await test('删除账号需明确确认，旧会话失效', async () => { seed(); assert.equal((await request('POST', '/api/admin/accounts/' + pid + '/delete', {}, admin)).status, 400); assert.equal((await request('POST', '/api/admin/accounts/' + pid + '/delete', { confirmPublisherId: pid }, admin)).status, 200); assert.equal((await request('GET', '/api/workshop/me', undefined, owner)).status, 401); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n, 0); });
})().catch((e) => { failed++; console.error(e); }).finally(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }); console.log(`RESULT ${passed} passed / ${failed} failed`); process.exitCode = failed ? 1 : 0; });
