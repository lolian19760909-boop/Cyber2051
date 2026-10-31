'use strict';
// 2026-10-25 压缩体防线·兼容性回归：证明这道门不误伤任何正常流量。
// 作者要求「必须确保这个补丁不会造成负面效果，比如玩家无法登录」——本夹具把登录链路、跨域预检、
// 鉴权读接口、鉴权写接口、管理端与未压缩大体积体逐条跑一遍，并对照两种等价请求：
//   ①完全不带 Content-Encoding（浏览器与酒馆客户端的真实形态）
//   ②显式 Content-Encoding: identity（合规中间件可能补的形式）
// 两者状态码必须一致，且都不得出现 415。真正的 415 只留给压缩体，由 compressed-body-guard.test.cjs 锁住。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const SERVER = path.join(__dirname, '../../网站/gateway/server.js');
const PORT = 9000 + Math.floor(Math.random() * 90);
const SESSION_SECRET = 'compat-session-secret';
const ADMIN_TOKEN = 'compat-admin';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
function mintToken(publisherId, displayName = '兼容回归') {
  const payload = b64u(JSON.stringify({ v: 2, pid: publisherId, n: displayName, exp: Date.now() + 24 * 3600 * 1000 }));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-ce-compat-'));
  fs.mkdirSync(path.join(dir, 'storage'), { recursive: true });
  const dbPath = path.join(dir, 'workshop.db');
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      CXX_GATEWAY_PORT: String(PORT),
      CXX_DB_PATH: dbPath,
      CXX_STORAGE: path.join(dir, 'storage'),
      CXX_ADMIN_TOKEN: ADMIN_TOKEN,
      CXX_IPSALT: 'compat-salt',
      SESSION_SECRET,
      // 刻意不配置 Discord：登录入口应返回 503 oauth_not_configured，而不是被压缩体防线拦成 415。
      DISCORD_CLIENT_ID: '',
      DISCORD_CLIENT_SECRET: '',
      DISCORD_REDIRECT_URI: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('gateway boot timeout')), 15000);
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('listening')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`gateway exited early: ${code}`)); });
  });
  const stop = () => new Promise((resolve) => {
    child.on('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 3000);
  });
  return { ready, stop, dir, dbPath };
}

function request(method, urlPath, { headers = {}, body = null, chunked = false } = {}) {
  return new Promise((resolve, reject) => {
    const finalHeaders = { ...headers };
    if (body && !chunked) finalHeaders['Content-Length'] = String(Buffer.byteLength(body));
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: urlPath, headers: finalHeaders }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) {
      if (chunked) { req.write(body.slice(0, 1)); req.write(body.slice(1)); } else req.write(body);
    }
    req.end();
  });
}

// 每个请求跑两遍：不带头 / 显式 identity。返回两次结果，调用方断言等价且非 415。
async function twice(method, urlPath, opts = {}) {
  const plain = await request(method, urlPath, opts);
  const identity = await request(method, urlPath, { ...opts, headers: { ...(opts.headers || {}), 'Content-Encoding': 'identity' } });
  return { plain, identity };
}

function assertEquivalent(label, pair, expectedStatus) {
  assert.notEqual(pair.plain.status, 415, `${label}：不带 Content-Encoding 的正常请求被误拦成 415`);
  assert.notEqual(pair.identity.status, 415, `${label}：显式 identity 被误拦成 415`);
  assert.equal(pair.identity.status, pair.plain.status, `${label}：identity 与不带头的状态码不一致（${pair.plain.status} vs ${pair.identity.status}）`);
  if (expectedStatus !== undefined) assert.equal(pair.plain.status, expectedStatus, `${label}：状态码 ${pair.plain.status} 与既有行为 ${expectedStatus} 不一致`);
}

test('压缩体防线不误伤登录、跨域预检、鉴权读写与管理端', async () => {
  const server = boot();
  await server.ready;
  try {
    // 先落一个可用的身份行，让会话 token 能验活（等价于玩家已登录过一次）。
    const db = new DatabaseSync(server.dbPath);
    const insertPublisher = db.prepare("INSERT INTO publishers (publisher_id, discord_id_hash, status, display_name_last, created_at, last_login_at) VALUES (?,?,?,?,?,?)");
    for (const [id, hashChar, name] of [['compat-p1','f','兼容回归'],['compat-p2','e','兼容回归二分块']]) {
      insertPublisher.run(id, hashChar.repeat(64), 'active', name, new Date().toISOString(), new Date().toISOString());
    }
    db.close();
    const token = mintToken('compat-p1');
    const auth = { Authorization: 'Bearer ' + token };
    const json = { 'Content-Type': 'application/json' };

    // ---- 1. 登录：发起 handoff（POST + JSON 体），未配置 Discord 时应是 503，不是 415 ----
    const handoffBody = JSON.stringify({ handoffId: 'compat-handoff-0001', challenge: 'a'.repeat(64) });
    assertEquivalent('登录发起 POST /login-handoff/start', await twice('POST', '/api/workshop/login-handoff/start', { headers: json, body: handoffBody }), 503);

    // ---- 2. 登录：Discord 回跳（GET + 查询串），返回登录失败页 200 ----
    assertEquivalent('登录回跳 GET /oauth/callback', await twice('GET', '/api/workshop/oauth/callback?state=abc.def&code=x'), 200);

    // ---- 3. 登录态验活：Bearer 会话必须仍然有效 ----
    const me = await twice('GET', '/api/workshop/me', { headers: auth });
    assertEquivalent('验活 GET /me', me, 200);
    assert.equal(JSON.parse(me.plain.text).loggedIn, true, '有效会话应被判为已登录');
    assert.equal(JSON.parse(me.plain.text).publisherId, 'compat-p1');

    // ---- 4. 登出（POST 无体）----
    assertEquivalent('登出 POST /logout', await twice('POST', '/api/workshop/logout', { headers: auth }), 200);

    // ---- 5. 跨域预检：卡内客户端来自别的域名，OPTIONS 必须照常放行 ----
    const preflightOpts = {
      headers: {
        Origin: 'https://tavern.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type'
      }
    };
    const preflight = await twice('OPTIONS', '/api/workshop/feedback', preflightOpts);
    assertEquivalent('跨域预检 OPTIONS /feedback', preflight, 204);
    assert.equal(preflight.plain.headers['access-control-allow-origin'], '*');
    assert.match(String(preflight.plain.headers['access-control-allow-methods']), /POST/);
    assert.match(String(preflight.plain.headers['access-control-allow-headers']), /Authorization/i);

    // ---- 6. 鉴权写：带会话写留言板（真实落库）----
    const feedbackBody = JSON.stringify({ body: '压缩体防线兼容回归', nickname: '夹具' });
    const feedback = await twice('POST', '/api/workshop/feedback', { headers: { ...json, ...auth }, body: feedbackBody });
    assertEquivalent('鉴权写 POST /feedback', feedback, 201);

    // ---- 7. 未登录写：应当仍是 401（业务判定，不是防线拦截）----
    assertEquivalent('未登录写 POST /feedback', await twice('POST', '/api/workshop/feedback', { headers: json, body: feedbackBody }), 401);

    // ---- 8. 分块传输（无 Content-Length，代理常见形态）----
    // feedback 对同一身份每 10 分钟只允许 3 次写，所以分块用例换第二个身份，避免把限流当成防线误伤。
    const chunkedPair = await twice('POST', '/api/workshop/feedback', { headers: { ...json, Authorization: 'Bearer ' + mintToken('compat-p2') }, body: feedbackBody, chunked: true });
    assertEquivalent('分块写 POST /feedback', chunkedPair, 201);

    // ---- 9. 管理端：Bearer 管理口令 ----
    const admin = { Authorization: 'Bearer ' + ADMIN_TOKEN };
    assertEquivalent('管理端 GET /api/admin/overview', await twice('GET', '/api/admin/overview', { headers: admin }), 200);
    assertEquivalent('管理端 GET /api/admin/announcements', await twice('GET', '/api/admin/announcements', { headers: admin }), 200);

    // ---- 10. 公开只读与健康 ----
    assertEquivalent('公开 GET /feedback', await twice('GET', '/api/workshop/feedback'), 200);
    assertEquivalent('公开 GET /announcements', await twice('GET', '/api/workshop/announcements'), 200);
    const health = await twice('GET', '/api/workshop/health');
    assertEquivalent('健康 GET /health', health, 200);
    assert.equal(JSON.parse(health.plain.text).version, '0.8.2');
    assert.equal(health.plain.headers['content-encoding'], undefined, '响应不应被加上 Content-Encoding');

    // ---- 11. 不存在的路径：仍是 404，不是 415 ----
    assertEquivalent('未知 GET', await twice('GET', '/api/workshop/nope'), 404);

    // ---- 12. 未压缩大体积体：仍走 413 上限帽，说明防线没改变读体行为 ----
    const big = JSON.stringify({ body: 'x'.repeat(200 * 1024) });
    const tooBig = await twice('POST', '/api/workshop/feedback', { headers: { ...json, ...auth }, body: big });
    assertEquivalent('超帽 POST /feedback', tooBig, 413);
  } finally {
    await server.stop();
    try { fs.rmSync(server.dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }); } catch { /* Windows 上句柄回收慢，临时目录残留不影响断言 */ }
  }
});
