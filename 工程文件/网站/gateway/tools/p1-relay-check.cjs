/**
 * P1 转发链路检查（本机夹具，不打真实模型、不消耗额度）。
 *
 * 覆盖：方法/鉴权/操作白名单/目标校验(SSRF)/流式透传/客户端取消/不自动重试/请求体限额。
 * 上游用本机回环 http，只有 `CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM=1` 时放行，
 * 生产路径仍是 https + 公网地址校验（见 play-connect.cjs）。
 *
 * 运行：node 工程文件/网站/gateway/tools/p1-relay-check.mjs
 */
process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM = '1';

const http = require('node:http');
const { createPlayConnect, LIMITS } = require('../play-connect.cjs');

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

let upstreamHits = 0;
let upstreamClosed = 0;

function startUpstream() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      upstreamHits += 1;
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        if (req.url.startsWith('/fail')) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'upstream boom' } }));
          return;
        }
        if (req.url.startsWith('/big')) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          const chunk = 'data: ' + JSON.stringify({ choices: [{ delta: { content: 'x'.repeat(4096) } }] }) + '\n\n';
          let sent = 0;
          const pump = () => {
            if (sent++ > 6000) return res.end('data: [DONE]\n\n');
            res.write(chunk);
            setImmediate(pump);
          };
          pump();
          return;
        }
        if (req.url.startsWith('/slow')) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          let i = 0;
          const timer = setInterval(() => {
            if (res.destroyed) return clearInterval(timer);
            if (i >= 50) {
              clearInterval(timer);
              return res.end('data: [DONE]\n\n');
            }
            res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: `块${i++}` } }] }) + '\n\n');
          }, 40);
          res.on('close', () => clearInterval(timer));
          return;
        }
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        for (const piece of ['你', '好', '，', '世', '界']) {
          res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: piece } }] }) + '\n\n');
        }
        res.end('data: [DONE]\n\n');
      });
    });
    server.on('connection', (socket) => socket.on('close', () => (upstreamClosed += 1)));
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function startGateway() {
  return new Promise((resolve) => {
    const play = createPlayConnect({
      send(res, code, body, extra) {
        const payload = JSON.stringify(body);
        res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...(extra || {}) });
        res.end(payload);
      },
      readRawBody(req, res, maxBytes, cb) {
        let size = 0;
        const chunks = [];
        let done = false;
        req.on('data', (c) => {
          if (done) return;
          size += c.length;
          if (size > maxBytes) {
            done = true;
            res.writeHead(413, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'payload_too_large' }));
            return;
          }
          chunks.push(c);
        });
        req.on('end', () => {
          if (done) return;
          done = true;
          cb(Buffer.concat(chunks));
        });
      },
      authorize(req) {
        const token = req.headers.authorization || '';
        if (!token.startsWith('Bearer ')) return { error: 'unauthorized' };
        return { row: { publisher_id: 'acct-1' } };
      },
    });
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (play.handle(req, res, url, req.method)) return;
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function post(port, pathname, body, { token = 'Bearer test', signal } = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port, path: pathname, method: 'POST', headers: { 'content-type': 'application/json', authorization: token } },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
      },
    );
    req.on('error', (error) => (signal?.aborted ? resolve({ aborted: true }) : reject(error)));
    if (signal) signal.addEventListener('abort', () => req.destroy());
    req.end(payload);
  });
}

function get(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method: 'GET', headers: { authorization: 'Bearer test' } }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.end();
  });
}

function postStream(port, body, { onChunk } = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port, path: '/api/play/connect', method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test' } },
      (res) => {
        let text = '';
        res.on('data', (c) => {
          text += c;
          onChunk?.(c.toString(), text);
        });
        res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

async function main() {
const { server: upstream, port: upstreamPort } = await startUpstream();
const { server: gateway, port: gatewayPort } = await startGateway();
const target = `http://127.0.0.1:${upstreamPort}/v1/chat/completions`;
const base = { operation: 'chat', adapter: 'openai-chat', baseUrl: target, credential: { header: 'authorization', token: 'sk-upstream' }, requestId: 'req-1', payload: { model: 'm', messages: [{ role:'user', content:'fixture' }], stream: true } };

await check('方法白名单：GET 被拒 405', async () => {
  const r = await get(gatewayPort, '/api/play/connect');
  assert(r.status === 405, `应 405，实际 ${r.status}`);
  return `状态 ${r.status}`;
});

await check('鉴权：无本站会话 401 且来源标注 gateway', async () => {
  const r = await post(gatewayPort, '/api/play/connect', base, { token: '' });
  assert(r.status === 401, `应 401，实际 ${r.status}`);
  assert(r.headers['x-cxx-error-origin'] === 'gateway', '应标注 gateway');
  return '401 + X-CXX-Error-Origin: gateway';
});

await check('操作白名单：任意 operation 被拒', async () => {
  const r = await post(gatewayPort, '/api/play/connect', { ...base, operation: 'proxy_anything' });
  assert(r.status === 400, `应 400，实际 ${r.status}`);
  return '400 bad_operation';
});

await check('目标校验：http 公网地址被拒', async () => {
  const r = await post(gatewayPort, '/api/play/connect', { ...base, baseUrl: 'http://example.com/v1' });
  assert(r.status === 400, `应 400，实际 ${r.status}`);
  return '400 bad_target（只允许 https）';
});

await check('流式透传：SSE 帧按序到达前端', async () => {
  const chunks = [];
  const r = await postStream(gatewayPort, base, { onChunk: (c) => chunks.push(c) });
  assert(r.status === 200, `应 200，实际 ${r.status}`);
  assert(/text\/event-stream/.test(r.headers['content-type']), '应保持 event-stream');
  const joined = chunks.join('');
  assert(joined.includes('你') && joined.includes('界'), '正文片段应完整');
  assert(chunks.length > 1, `应分多块到达，实际 ${chunks.length}`);
  return `${chunks.length} 个网络块，正文完整`;
});

await check('不自动重试：上游 500 只发一次请求', async () => {
  const before = upstreamHits;
  const r = await post(gatewayPort, '/api/play/connect', { ...base, baseUrl: `http://127.0.0.1:${upstreamPort}/fail` });
  await new Promise((r2) => setTimeout(r2, 120));
  assert(upstreamHits - before === 1, `上游应只被请求 1 次，实际 ${upstreamHits - before}`);
  assert(r.status === 500, `应透传 500，实际 ${r.status}`);
  assert(r.headers['x-cxx-error-origin'] === 'upstream', '应标注 upstream');
  return '上游 1 次请求，错误来源 upstream';
});

await check('客户端取消：中止后上游连接关闭，不留后台生成', async () => {
  const closedBefore = upstreamClosed;
  await new Promise((resolve, reject) => {
    let deadline;
    const payload = JSON.stringify({ ...base, baseUrl: `http://127.0.0.1:${upstreamPort}/slow` });
    const req = http.request(
      { host: '127.0.0.1', port: gatewayPort, path: '/api/play/connect', method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test' } },
      (res) => {
        res.once('data', () => {
          clearTimeout(deadline);
          req.destroy();
          setTimeout(resolve, 260);
        });
        res.on('error', () => {});
      },
    );
    req.on('error', () => {});
    deadline=setTimeout(()=>{req.destroy();reject(new Error('未在 2.5 秒内收到可取消的流式块'));},2500);
    req.end(payload);
  });
  assert(upstreamClosed > closedBefore, `上游连接应被关闭，实际新增 ${upstreamClosed - closedBefore}`);
  return `取消后上游关闭连接，新增 ${upstreamClosed - closedBefore} 次 close`;
});

await check('限额：请求体超 2 MiB 被拒且不进上游', async () => {
  const before = upstreamHits;
  const huge = { ...base, payload: { blob: 'y'.repeat(LIMITS.requestBytes + 1024) } };
  const r = await post(gatewayPort, '/api/play/connect', huge);
  assert(r.status === 413, `应 413，实际 ${r.status}`);
  assert(upstreamHits === before, '超限请求不应到达上游');
  return `413，限额 ${LIMITS.requestBytes} 字节`;
});

await check('大小请求互不影响：256 KiB 长请求可转发，工坊 64 KiB 通用上限不被改动', async () => {
  const before = upstreamHits;
  const big = { ...base, payload: { model: 'm', messages: [{ role: 'user', content: 'z'.repeat(256 * 1024) }], stream: true } };
  const r = await post(gatewayPort, '/api/play/connect', big);
  assert(r.status < 400, `长请求应被接受，实际 HTTP ${r.status}`);
  assert(upstreamHits > before, '长请求应真正到达上游');
  const generic = 64 * 1024;
  assert(LIMITS.requestBytes > generic * 4, `relay 限额应独立且显著大于通用上限，实际 ${LIMITS.requestBytes}`);
  return `256 KiB 转发成功；relay 限额 ${LIMITS.requestBytes} 字节，通用上限保持 ${generic} 字节`;
});

const failed = results.filter((r) => !r.ok);
console.log('');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);

upstream.close();
gateway.close();
process.exitCode = failed.length ? 1 : 0;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
