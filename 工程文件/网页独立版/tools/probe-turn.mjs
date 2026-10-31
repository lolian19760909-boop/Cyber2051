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

const REPLY = [
  '<cxx-story>',
  '霓虹在雨幕里散成一片红。她撑着伞停在涩谷的路口。',
  '<cxx-say speaker="丰川祥子" expression="smile">「你终于来了。」</cxx-say>',
  '</cxx-story>',
  '<ztl>{"location":"涩谷·中央街","time":"夜","characters":[{"name":"丰川祥子","outfit":"制服","thought":"先把他拖进来"}]}</ztl>',
  '<xuan>', '1. 接过委托卡', '2. 问她为什么', '3. 退到屋檐下', '4. 打量黑色轿车', '5. 掉头走开', '</xuan>',
  '<UpdateVariable>[{"op":"replace","path":"/terminal/wallet/yen","value":1200},{"op":"replace","path":"/terminal/wallet/earned","value":1200}]</UpdateVariable>',
].join('\n');

const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await b.newPage();
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('PAGEERR', String(e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
await page.route('https://upstream.test/**', async (route) => {
  console.log('UPSTREAM HIT');
  const frames = REPLY.match(/[\s\S]{1,30}/g) || [];
  const body = frames.map((x) => `data: ${JSON.stringify({ choices: [{ delta: { content: x } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body });
});
await page.goto(`http://127.0.0.1:${port}/?mode=local&adapter=openai-chat&baseUrl=https://upstream.test/v1/chat/completions&model=m`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.getElementById('send').disabled, { timeout: 40000 });
console.log('READY', await page.textContent('#status-line'));
await page.fill('#input', '我走向她');
await page.click('#send');
for (let i = 0; i < 12; i += 1) {
  await page.waitForTimeout(1000);
  const status = await page.textContent('#status-line');
  console.log(`t+${i + 1}s`, status, '| lines=', await page.$$eval('#stage-lines .line', (n) => n.length));
}
await b.close();
app.close();
process.exit(0);
