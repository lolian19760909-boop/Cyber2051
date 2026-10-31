/**
 * 资源页检查：真实 Edge 打开 8826 的 /resources.html，核对 3.1.0 分层目录渲染。
 * 运行：node tools/resources-page-check.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8826';
const OUT = path.join(HERE, '..', '..', '.cache', 'play-loading-20261027', 'checks');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) { console.error('未找到系统 Edge'); process.exit(2); }
const receipt = { at: new Date().toISOString(), base: BASE, checks: [] };
const ok = (name, detail = {}) => { receipt.checks.push({ name, ok: true, ...detail }); console.log('PASS  ' + name + (detail.detail ? ' — ' + detail.detail : '')); };
const fail = (name, error) => { receipt.checks.push({ name, ok: false, error: String(error?.stack || error) }); console.error('FAIL  ' + name + '\n' + String(error?.stack || error)); };
const errors = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EDGE });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  page.on('console', msg => { const where = msg.location()?.url || ''; if (msg.type() === 'error' && !msg.text().includes('/favicon.ico') && !where.includes('favicon.ico')) errors.push('console: ' + msg.text() + ' @ ' + where); });
  page.on('pageerror', error => errors.push('pageerror: ' + String(error)));
  page.on('requestfailed', request => { const failure = request.failure()?.errorText || 'failed'; if (!request.url().includes('favicon')) errors.push('requestfailed: ' + request.url() + ' ' + failure); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().includes('favicon')) errors.push('HTTP ' + response.status() + ' ' + response.url()); });
  await page.goto(BASE + '/resources.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pack-layers .pack-quality', { timeout: 30000 });
  const view = await page.evaluate(() => ({
    badge: document.querySelector('#pack-badge')?.textContent?.trim() || '',
    size: document.querySelector('#pack-size')?.textContent?.trim() || '',
    sections: [...document.querySelectorAll('#pack-layers .pack-quality h3')].map(node => node.textContent.trim()),
    rows: [...document.querySelectorAll('#pack-layers .pack-layer')].map(node => ({
      text: node.textContent.trim(),
      href: node.querySelector('a')?.href || '',
      download: node.querySelector('a')?.getAttribute('download') || '',
      sha: node.querySelector('code')?.textContent?.trim() || ''
    }))
  }));
  assert.match(view.badge, /3\.1\.0/);
  assert.match(view.size, /标准画质 \d+ 个文件[^·]+· \d+ MiB · 原画质 \d+ 个文件/);
  assert.deepEqual(view.sections, ['公共资源', '标准画质', '原画质']);
  assert.equal(view.rows.length, 3);
  assert(view.rows.every(row => /P4-(common|webp|png)-3\.1\.0\.zip/.test(row.text)), '层文件名');
  assert(view.rows.every(row => /^[a-f0-9]{64}$/.test(row.sha)), 'SHA-256');
  assert(view.rows.every(row => /\/resources\/3\.1\.0\/.*P4-/.test(new URL(row.href).pathname)), '下载路径');
  ok('资源页渲染 3.1.0 分层目录', { detail: view.size });
  ok('公共 / 标准 / 原画三组', { sections: view.sections });
  ok('三档下载链接与逐层 SHA-256', { rows: view.rows.length });
  await page.screenshot({ path: path.join(OUT, 'resources-page.png'), fullPage: true });
  const filtered = errors.filter(line => !line.includes('favicon'));
  assert.deepEqual(filtered, [], '控制台/网络错误');
  ok('无脚本错误');
  receipt.passed = true;
} catch (error) {
  fail('资源页检查', error);
  receipt.passed = false;
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch {}
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'resources-page.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log('receipt ' + path.join(OUT, 'resources-page.json'));
}
