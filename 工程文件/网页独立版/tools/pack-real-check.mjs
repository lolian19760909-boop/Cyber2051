/**
 * 分层资源真实入口检查：真实 Edge + 8826 预览 + 正式 3.1.0 目录。
 * 只装标准档（common+webp），核对画质选择、两层缓存标记、WebP 视图、设置里的装载列表；
 * 不跑真实模型，不碰存档。原画档由 pack-layer-check 的故障注入覆盖。
 * 运行：node tools/pack-real-check.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8826';
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) { console.error('未找到系统 Edge'); process.exit(2); }
const receipt = { at: new Date().toISOString(), base: BASE, checks: [] };
const ok = (name, detail = {}) => { receipt.checks.push({ name, ok: true, ...detail }); console.log('PASS  ' + name + (detail.detail ? ' — ' + detail.detail : '')); };
const fail = (name, error) => { receipt.checks.push({ name, ok: false, error: String(error?.stack || error) }); console.error('FAIL  ' + name + '\n' + String(error?.stack || error)); };
const errors = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EDGE });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  page.on('console', msg => { const where = msg.location()?.url || ''; if (msg.type() === 'error' && !msg.text().includes('/favicon.ico') && !where.includes('favicon.ico')) errors.push('console: ' + msg.text() + ' @ ' + where); });
  page.on('pageerror', error => errors.push('pageerror: ' + String(error)));
  page.on('requestfailed', request => { const failure = request.failure()?.errorText || 'failed'; if (!request.url().includes('favicon')) errors.push('requestfailed: ' + request.url() + ' ' + failure); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().includes('favicon')) errors.push('HTTP ' + response.status() + ' ' + response.url()); });

  const current = await (await fetch(BASE + '/play/current.json', { cache: 'no-store' })).json();
  ok('候选版本', { detail: current.release });

  await page.goto(BASE + '/play/?mode=local', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('dialog.cxx-pack-choice', { timeout: 60000 });
  const title = await page.locator('dialog.cxx-pack-choice h2').textContent();
  assert.equal(title, '选择本机画质');
  const cards = await page.locator('dialog.cxx-pack-choice .cxx-pack-card').evaluateAll(nodes => nodes.map(node => ({ quality: node.dataset.quality, text: node.textContent, selected: node.dataset.selected })));
  assert.equal(cards.length, 2);
  assert.equal(cards.find(card => card.quality === 'standard')?.selected, 'true');
  ok('首次画质选择', { detail: cards.map(card => card.quality + ':' + card.selected).join(', ') });

  await page.locator('dialog.cxx-pack-choice input[value="standard"]').check();
  await page.locator('dialog.cxx-pack-choice button.primary').click();
  await page.waitForSelector('dialog.cxx-pack-choice', { state: 'detached', timeout: 60000 });

  const catalog = await page.evaluate(async () => {
    const rel = (await (await fetch('/play/current.json', { cache: 'no-store' })).json()).release;
    const base = '/play/releases/' + rel + '/';
    const data = await (await fetch(base + 'data/player-pack.json', { cache: 'no-store' })).json();
    return { release: rel, data };
  });
  assert.equal(catalog.data.schema, 2);
  assert.deepEqual(catalog.data.packs.standard.layers, ['common', 'webp']);
  ok('分层目录', { detail: 'standard=' + catalog.data.packs.standard.layers.join('+') + ', ' + Math.round(catalog.data.packs.standard.bytes / 1048576) + ' MB' });

  const layerIds = ['common', 'webp'].map(key => catalog.data.layers[key].id);
  const deadline = Date.now() + 300000;
  let ready = false;
  while (Date.now() < deadline) {
    ready = await page.evaluate(async ({ release, layerIds }) => {
      const cache = await caches.open('cxx2051-official-media-v1');
      const base = new URL('/play/releases/' + release + '/', location.origin);
      for (const id of layerIds) if (!await cache.match(new URL('../../__cxx_media__/complete/' + id, base).href)) return false;
      return true;
    }, { release: catalog.release, layerIds });
    if (ready) break;
    await page.waitForTimeout(500);
  }
  assert.equal(ready, true, '标准档两层在 5 分钟内未装完');
  const cacheState = await page.evaluate(async ({ release, common, webp, png }) => {
    const cache = await caches.open('cxx2051-official-media-v1');
    const base = new URL('/play/releases/' + release + '/', location.origin);
    const mark = async id => Boolean(await cache.match(new URL('../../__cxx_media__/complete/' + id, base).href));
    const keys = await cache.keys();
    return { blobs: keys.filter(r => r.url.includes('/__cxx_media__/blob/')).length, complete: { common: await mark(common), webp: await mark(webp), png: await mark(png) }, quality: localStorage.getItem('cxx2051:pack-quality:v1') };
  }, { release: catalog.release, common: catalog.data.layers.common.id, webp: catalog.data.layers.webp.id, png: catalog.data.layers.png.id });
  assert.equal(cacheState.complete.common, true);
  assert.equal(cacheState.complete.webp, true);
  assert.equal(cacheState.complete.png, false);
  assert.equal(cacheState.quality, 'standard');
  ok('标准档缓存标记', { detail: 'blob=' + cacheState.blobs + ', common=1, webp=1, png=0' });

  const webp = await page.evaluate(async () => {
    const rel = (await (await fetch('/play/current.json', { cache: 'no-store' })).json()).release;
    const data = await (await fetch('/play/releases/' + rel + '/data/player-pack.json', { cache: 'no-store' })).json();
    const row = data.layers.webp.entries.find(entry => entry.aliases?.some(alias => alias.startsWith('assets/')));
    const alias = row.aliases.find(alias => alias.startsWith('assets/'));
    const resolved = CxxResources.resolve(alias);
    const buffer = await CxxResources.load(alias, { type: 'buffer' });
    return { alias, resolved, webp: resolved.includes('/assets-webp/'), bytes: buffer.byteLength, mime: CxxResources.record(alias)?.mime, quality: CxxResources.quality };
  });
  assert.equal(webp.webp, true);
  assert.equal(webp.mime, 'image/webp');
  assert.ok(webp.bytes > 0);
  ok('标准档图片命中 WebP', { detail: webp.alias + ' → ' + webp.resolved.split('/').slice(-1)[0] + ' (' + webp.bytes + ' B)' });

  if (await page.locator('.cx77-splash').count()) await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  const notice = page.locator('.cxx-notice');
  if (await notice.count()) {
    const later = notice.getByRole('button', { name: '稍后再说' });
    if (await later.count()) await later.click();
  }
  await page.locator('.cxx-game-menu .game-navigation button', { hasText: '设置' }).first().click();
  await page.locator('#cx77-settings-tab-resources').click();
  await page.waitForSelector('#pack-controls .cxx-pack-manager', { timeout: 30000 });
  const manager = await page.locator('#pack-controls').innerText();
  assert.match(manager, /标准画质/);
  assert.match(manager, /公共资源/);
  assert.match(manager, /标准画质图片/);
  assert.match(manager, /已装载/);
  ok('设置里的本机资源列表', { detail: manager.replace(/\s+/g, ' ').slice(0, 180) });

  await page.screenshot({ path: path.join(HERE, '..', '..', '.cache', 'play-loading-20261027', 'checks', 'pack-real.png'), fullPage: false });
  if (errors.length) throw Error('页面错误：\n' + errors.join('\n'));
  ok('无脚本错误');
  receipt.passed = true;
  receipt.cache = cacheState;
  receipt.manager = manager;
} catch (error) {
  receipt.passed = false;
  fail('真实分层入口', error);
  if (browser) { const pages = browser.contexts().flatMap(context => context.pages()); if (pages[0]) await pages[0].screenshot({ path: path.join(HERE, '..', '..', '.cache', 'play-loading-20261027', 'checks', 'pack-real-failure.png') }).catch(() => {}); }
} finally {
  receipt.errors = errors;
  fs.mkdirSync(path.join(HERE, '..', '..', '.cache', 'play-loading-20261027', 'checks'), { recursive: true });
  fs.writeFileSync(path.join(HERE, '..', '..', '.cache', 'play-loading-20261027', 'checks', 'pack-real.json'), JSON.stringify(receipt, null, 2) + '\n');
  if (browser) await browser.close();
}
process.exitCode = receipt.passed ? 0 : 1;
