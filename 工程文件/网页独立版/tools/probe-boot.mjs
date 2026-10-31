import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, relative, resolve } from 'node:path';

const WEB_ROOT = 'D:/deepseek harness Coding/赛博小祥2051/工程文件/网页独立版';
const PROJECT = 'D:/deepseek harness Coding/赛博小祥2051/工程文件';
const CARD_SRC = join(PROJECT, '卡片源码');
const CARD_JSON = join(PROJECT, '交付', '当前', '2.3.33-终端状态来源修复-20261025', '东京都2051-V2.3.33.json');
const PRESET_JSON = join(CARD_SRC, '预设', 'Izumi-V0.8.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

function safeJoin(root, p) {
  const c = normalize(decodeURIComponent(p));
  if (c.includes('..')) return null;
  const f = join(root, c);
  const rel = relative(resolve(root), resolve(f));
  return rel && !rel.startsWith('..') ? f : null;
}
async function send(res, file) {
  try {
    const b = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(b);
    return true;
  } catch {
    return false;
  }
}

const app = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  if (p === '/' || p === '/index.html') { if (await send(res, join(WEB_ROOT, 'web', 'index.html'))) return; }
  if (p === '/data/card.json') { if (await send(res, CARD_JSON)) return; }
  if (p === '/data/preset.json') { if (await send(res, PRESET_JSON)) return; }
  if (p.startsWith('/card/')) { const f = safeJoin(CARD_SRC, p.slice(6)); if (f && await send(res, f)) return; }
  if (p.startsWith('/src/') || p.startsWith('/web/')) { const f = safeJoin(WEB_ROOT, p.slice(1)); if (f && await send(res, f)) return; }
  if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
  console.log('404', p);
  res.writeHead(404).end('nf');
});
await new Promise((r) => app.listen(0, '127.0.0.1', r));
const port = app.address().port;
console.log('server', port);

const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await b.newPage();
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 220)));
page.on('pageerror', (e) => console.log('PAGEERR', String(e.message).slice(0, 300)));
page.on('requestfailed', (r) => console.log('REQFAIL', r.url().slice(-70), r.failure()?.errorText));
page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(-70)); });

await page.goto(`http://127.0.0.1:${port}/?mode=local&baseUrl=https://upstream.test/v1&model=m`, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(15000);
console.log('STATUS', await page.textContent('#status-line'));
console.log('SEND_DISABLED', await page.getAttribute('#send', 'disabled'));
await b.close();
app.close();
process.exit(0);
