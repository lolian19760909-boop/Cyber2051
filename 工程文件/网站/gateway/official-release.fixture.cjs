'use strict';
// 开发专用本机夹具：新建临时数据库/存储/测试密钥，绝不读取现有 .env 或数据。
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const F = require('./official-release-fixtures.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve)); return port;
}
async function startFixture(port = 0) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cxx-official-http-fixture-'));
  const pair = F.keys(), keyFile = path.join(root, 'test-only-signing.pem');
  fs.writeFileSync(keyFile, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const gatewayPort = await freePort(), dbFile = path.join(root, 'workshop.db');
  const adminToken = crypto.randomBytes(32).toString('hex'), sessionSecret = crypto.randomBytes(32).toString('hex');
  const child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      CXX_GATEWAY_PORT: String(gatewayPort), CXX_DB_PATH: dbFile, CXX_STORAGE: path.join(root, 'workshop-storage'),
      CXX_ADMIN_TOKEN: adminToken, CXX_IPSALT: 'temporary-test-only-ip-salt', SESSION_SECRET: sessionSecret,
      CXX_FORMAT3_PACKAGES_MODULE: path.resolve(__dirname, "../../工具/发布/packages.cjs"),
      CXX_OFFICIAL_RELEASE_DIR: path.join(root, 'releases/v3'), CXX_OFFICIAL_SIGNING_KEY_FILE: keyFile, CXX_OFFICIAL_KEY_ID: 'test.key',
    },
  });
  child.stdout.resume(); child.stderr.resume();
  let server, closed = false;
  async function close() {
    if (closed) return; closed = true;
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited;
    }
    const absolute = path.resolve(root);
    if (!absolute.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(absolute).startsWith('cxx-official-http-fixture-')) throw Error('unsafe fixture cleanup');
    fs.rmSync(absolute, { recursive: true, force: true });
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw Error('temporary gateway stopped');
      try { const response = await fetch(`http://127.0.0.1:${gatewayPort}/api/workshop/health`); if (response.ok) { ready = true; break; } } catch {}
      await sleep(30);
    }
    if (!ready) throw Error('temporary gateway startup timeout');
    const db = new DatabaseSync(dbFile);
    const identities = { authorized: '1111111111111111', ordinary: '2222222222222222' };
    for (const [role, id] of Object.entries(identities)) db.prepare('INSERT INTO publishers (publisher_id,discord_id_hash,created_at,last_login_at,display_name_last,status,can_publish_official) VALUES (?,?,?,?,?,?,?)')
      .run(id, crypto.createHash('sha256').update('fixture-' + role).digest('hex'), new Date().toISOString(), new Date().toISOString(), '本地合成 ' + role, 'active', role === 'authorized' ? 1 : 0);
    db.close();
    const session = role => {
      if (role === 'admin') return { token: adminToken, fixture: true };
      if (!identities[role]) return null;
      const payload = Buffer.from(JSON.stringify({ v: 2, pid: identities[role], n: '本地合成 ' + role, exp: Date.now() + 60 * 60 * 1000 })).toString('base64url');
      return { token: payload + '.' + crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url'), publisherId: identities[role], displayName: '本地合成 ' + role, fixture: true };
    };
    const sendJson = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/test-session.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>仅本机测试登录桥</title><p id="status">正在载入合成测试会话；此页面不会连接 Discord 或生产数据库。</p><script>
            (async()=>{const role=new URLSearchParams(location.search).get('role');
              if(!['authorized','ordinary'].includes(role))throw Error('请选择 authorized 或 ordinary');
              const response=await fetch('/__fixture__/session?role='+role,{credentials:'omit',cache:'no-store'});
              if(!response.ok)throw Error('测试会话不可用');const session=await response.json();
              localStorage.setItem('cxx-oauth-token',session.token);localStorage.setItem('cxx-oauth-name',session.displayName);
              localStorage.removeItem('cxx-oauth-avatar');location.replace('/publish.html');
            })().catch(error=>document.getElementById('status').textContent=error.message);
          </script></html>`); return;
        }
        if (url.pathname === '/__fixture__/session') return sendJson(res, session(url.searchParams.get('role')) ? 200 : 404, session(url.searchParams.get('role')) || { ok: false });
        if (url.pathname === '/__fixture__/card.json') return sendJson(res, 200, F.card(pair.pem));
        if (url.pathname === '/__fixture__/content.json') return sendJson(res, 200, F.content());
        if (url.pathname === '/__fixture__/stop' && req.method === 'POST') {
          sendJson(res, 200, { ok: true, fixtureStopped: true }); setImmediate(() => close()); return;
        }
        if (url.pathname.startsWith('/api/')) {
          const chunks = []; for await (const chunk of req) chunks.push(chunk);
          const headers = {}; for (const key of ['authorization', 'content-type']) if (req.headers[key]) headers[key] = req.headers[key];
          const response = await fetch(`http://127.0.0.1:${gatewayPort}${req.url}`, { method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}) });
          const safetyHeaders = {};
          for (const key of ['x-content-type-options', 'content-security-policy']) if (response.headers.has(key)) safetyHeaders[key] = response.headers.get(key);
          res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store', ...safetyHeaders });
          res.end(Buffer.from(await response.arrayBuffer())); return;
        }
        const publicRoot = path.join(__dirname, "public"), filename = path.resolve(publicRoot, '.' + (url.pathname === '/' ? '/publish.html' : decodeURIComponent(url.pathname)));
        if (!filename.startsWith(publicRoot + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) return sendJson(res, 404, { ok: false, error: 'not_found' });
        const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[path.extname(filename)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); fs.createReadStream(filename).pipe(res);
      } catch { sendJson(res, 500, { ok: false, error: 'fixture_error' }); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    return { baseUrl: `http://127.0.0.1:${server.address().port}`, close, session, root };
  } catch (error) { await close(); throw error; }
}
if (require.main === module) {
  startFixture(Number(process.argv[2] || 6917)).then(fixture => {
    console.log('开发专用临时夹具已启动：' + fixture.baseUrl + '/publish.html（合成会话，非生产/OAuth验收）');
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => fixture.close());
  }).catch(() => { console.error('临时夹具启动失败；未连接生产数据。'); process.exitCode = 1; });
}
module.exports = { startFixture };
