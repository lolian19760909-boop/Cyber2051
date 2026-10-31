/**
 * P1 浏览器检查：在真实 Chromium 内核（本机 Edge）里跑 IndexedDB 端口与回合协调器。
 *
 * 为什么必须跑：内存端口只能证明逻辑，不能证明 IndexedDB 事务真的原子、Web Locks 真的生效。
 * 浏览器固定用系统 Edge（playwright 自带 chromium 在本机缺失，见进度记录）。
 *
 * 运行：node 工程文件/网页独立版/tools/p1-browser-check.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..');
// 卡内源码目录：浏览器夹具按 `/card/...` 取 UMD 文件（与 Node 侧读同一批文件）。
const CARD_ROOT = join(HERE, '..', '..', '卡片源码');
const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = EDGE_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('未找到系统 Edge，无法执行浏览器检查');
  process.exit(2);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const isCard = rel.startsWith('card/') || rel.startsWith('card\\');
  const root = isCard ? CARD_ROOT : WEB_ROOT;
  const full = join(root, isCard ? rel.slice(5) : rel);
  if (!full.startsWith(root)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(full);
    res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (error) => consoleErrors.push(`${error} @ ${String(error.stack || '').split('\n').slice(1, 4).join(' | ')}`));
page.on('response', (response) => {
  if (response.status() >= 400) consoleErrors.push(`HTTP ${response.status()} ${response.url()}`);
});

await page.goto(`http://127.0.0.1:${port}/tools/fixtures/idb.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__P1_RESULTS__?.done === true, null, { timeout: 30000 }).catch(() => {});
const outcome = await page.evaluate(() => window.__P1_RESULTS__ || null);

if (!outcome) {
  console.error('浏览器内未产出结果');
  for (const line of consoleErrors) console.error('console:', line);
  await browser.close();
  server.close();
  process.exit(1);
}

let failed = 0;
for (const item of outcome.results) {
  if (!item.ok) failed += 1;
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
}
console.log(`\n${outcome.results.length - failed}/${outcome.results.length} 通过（${executablePath.split('/').pop()}）`);
if (consoleErrors.length) {
  console.log('\n控制台错误：');
  for (const line of consoleErrors) console.log('  ', line);
}
await browser.close();
server.close();
process.exitCode = failed || consoleErrors.length ? 1 : 0;
