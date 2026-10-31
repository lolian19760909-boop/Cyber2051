'use strict';
// 2026-10-25 加固：拒绝压缩入站请求体（SillyTavern 预认证解压炸弹同类放大攻击）。
// 背景：ST 自 v1.12.13（2025-03）起请求体解析存在预认证资源耗尽漏洞，截至 2026-10-24 官方未修；
// 本站网关必须在不读取字节的前提下拒绝 Content-Encoding 非 identity 的请求。
// 本测试真起一个网关实例，验证：gzip/deflate/br 一律 415 · identity 与无头正常放行 · 未压缩大体积不触发解压。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const SERVER = path.join(__dirname, '../../网站/gateway/server.js');
const PORT = 8900 + Math.floor(Math.random() * 90);

function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-ce-guard-'));
  fs.mkdirSync(path.join(dir, 'storage'), { recursive: true });
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      CXX_GATEWAY_PORT: String(PORT),
      CXX_DB_PATH: path.join(dir, 'workshop.db'),
      CXX_STORAGE: path.join(dir, 'storage'),
      CXX_ADMIN_TOKEN: 'test-admin',
      CXX_IPSALT: 'test-salt',
      SESSION_SECRET: 'test-session-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('gateway boot timeout')), 15000);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('listening')) { clearTimeout(timer); resolve(); }
    });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`gateway exited early: ${code}`)); });
  });
  const stop = () => new Promise((resolve) => {
    child.on('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 3000);
  });
  return { ready, stop, dir, child };
}

function request(method, urlPath, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: urlPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('网关拒绝压缩入站请求体，且放行 identity 与无 Content-Encoding', async () => {
  const server = boot();
  await server.ready;
  try {
    // 1) 解压炸弹形态：2 MiB 的零字节 gzip 到 2 MB，网关不得解压，直接 415。
    const bomb = zlib.gzipSync(Buffer.alloc(2 * 1024 * 1024, 0));
    for (const encoding of ['gzip', 'deflate', 'br', 'GZIP', 'x-gzip']) {
      const res = await request('POST', '/api/workshop/feedback', {
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': encoding, 'Content-Length': String(bomb.length) },
        body: bomb
      });
      assert.equal(res.status, 415, `${encoding} 应被拒绝`);
      const payload = JSON.parse(res.text);
      assert.equal(payload.ok, false);
      assert.equal(payload.error, 'content_encoding_not_supported');
      assert.equal(payload.contentEncoding, encoding.toLowerCase());
    }

    // 2) identity 显式声明：必须放行到业务层（这里是不带会话的留言写入，业务返回 401/400 都算放行）。
    const plain = Buffer.from(JSON.stringify({ body: 'guard-probe' }), 'utf8');
    const identity = await request('POST', '/api/workshop/feedback', {
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'identity', 'Content-Length': String(plain.length) },
      body: plain
    });
    assert.notEqual(identity.status, 415, 'identity 不应被压缩体防线拦截');

    // 3) 完全没有 Content-Encoding：正常放行。
    const none = await request('POST', '/api/workshop/feedback', {
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(plain.length) },
      body: plain
    });
    assert.notEqual(none.status, 415);

    // 4) GET 健康检查不受影响（防线不得误伤无体请求）。
    const health = await request('GET', '/api/workshop/health');
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.text).version, '0.8.2');

    // 5) 未压缩的大体积体不触发任何解压：仅按 64 KiB 帽返回 413，而不是崩溃或 415。
    const big = Buffer.alloc(200 * 1024, 0x41);
    const tooBig = await request('POST', '/api/workshop/feedback', {
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(big.length) },
      body: big
    });
    assert.equal(tooBig.status, 413);

    // 6) 网关仍存活（防线跑完没有把进程打死）。
    const again = await request('GET', '/api/workshop/health');
    assert.equal(again.status, 200);
  } finally {
    await server.stop();
    try { fs.rmSync(server.dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }); } catch { /* Windows 上句柄回收慢，临时目录残留不影响断言 */ }
  }
});
