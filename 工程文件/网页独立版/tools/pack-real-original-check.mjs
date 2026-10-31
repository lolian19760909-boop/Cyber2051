/** 原画档真实入口：标准→原画，核对 PNG 视图、双档保留、删除标准档。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8826';
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
if (!EDGE) { console.error('未找到系统 Edge'); process.exit(2); }
const receipt = {at: new Date().toISOString(), base: BASE, checks: []};
const ok = (name, detail = {}) => { receipt.checks.push({name, ok: true, ...detail}); console.log('PASS  ' + name + (detail.detail ? ' — ' + detail.detail : '')); };
const fail = (name, error) => { receipt.checks.push({name, ok: false, error: String(error?.stack || error)}); console.error('FAIL  ' + name + '\n' + String(error?.stack || error)); };
const errors = [];
let browser;
async function waitLayers(page, release, keys, timeout = 600000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const done = await page.evaluate(async ({release, keys}) => {
      const cache = await caches.open('cxx2051-official-media-v1');
      const base = new URL('/play/releases/' + release + '/', location.origin);
      for (const key of keys) if (!await cache.match(new URL('../../__cxx_media__/complete/' + key, base).href)) return false;
      return true;
    }, {release, keys});
    if (done) return true;
    await page.waitForTimeout(500);
  }
  return false;
}
async function cacheMark(page, release, keys) {
  return page.evaluate(async ({release, keys}) => {
    const cache = await caches.open('cxx2051-official-media-v1');
    const base = new URL('/play/releases/' + release + '/', location.origin);
    const out = {};
    for (const key of keys) out[key] = Boolean(await cache.match(new URL('../../__cxx_media__/complete/' + key, base).href));
    return out;
  }, {release, keys});
}
try {
  browser = await chromium.launch({headless: true, executablePath: EDGE});
  const context = await browser.newContext({viewport: {width: 1400, height: 900}});
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept().catch(() => {}));
  page.on('console', msg => { const where = msg.location()?.url || ''; if (msg.type() === 'error' && !where.includes('favicon.ico')) errors.push('console: ' + msg.text() + ' @ ' + where); });
  page.on('pageerror', error => errors.push('pageerror: ' + String(error)));
  page.on('response', response => { if (response.status() >= 400 && !response.url().includes('favicon')) errors.push('HTTP ' + response.status() + ' ' + response.url()); });
  const current = await (await fetch(BASE + '/play/current.json', {cache: 'no-store'})).json();
  const catalog = await (await fetch(BASE + '/play/releases/' + current.release + '/data/player-pack.json', {cache: 'no-store'})).json();
  await page.goto(BASE + '/play/?mode=local', {waitUntil: 'domcontentloaded', timeout: 60000});
  await page.waitForSelector('dialog.cxx-pack-choice', {timeout: 60000});
  await page.locator('dialog.cxx-pack-choice input[value="standard"]').check();
  await page.locator('dialog.cxx-pack-choice button.primary').click();
  const standardReady = await waitLayers(page, current.release, ['common', 'webp'].map(key => catalog.layers[key].id));
  assert.equal(standardReady, true, '标准档未装完');
  ok('标准档就绪', {detail: 'common+webp'});
  if (await page.locator('.cx77-splash').count()) await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  const notice = page.locator('.cxx-notice');
  if (await notice.count()) { const later = notice.getByRole('button', {name: '稍后再说'}); if (await later.count()) await later.click(); }
  await page.locator('.cxx-game-menu .game-navigation button', {hasText: '设置'}).first().click();
  await page.locator('#cx77-settings-tab-resources').click();
  await page.waitForSelector('#pack-controls .cxx-pack-manager', {timeout: 30000});
  let manager = await page.locator('#pack-controls').innerText();
  assert.match(manager, /标准画质/);
  assert.match(manager, /下载并切换到原画质/);
  ok('设置里的标准档', {detail: manager.replace(/\s+/g, ' ').slice(0, 160)});
  await page.getByRole('button', {name: /下载并切换到原画质/}).click();
  await page.waitForLoadState('domcontentloaded', {timeout: 60000}).catch(() => {});
  await page.waitForTimeout(1500);
  const originalReady = await waitLayers(page, current.release, ['common', 'png'].map(key => catalog.layers[key].id));
  assert.equal(originalReady, true, '原画档未装完');
  const marks = await cacheMark(page, current.release, ['common', 'webp', 'png'].map(key => catalog.layers[key].id));
  assert.equal(marks[catalog.layers.common.id], true);
  assert.equal(marks[catalog.layers.webp.id], true);
  assert.equal(marks[catalog.layers.png.id], true);
  ok('原画档与标准档并存', {detail: 'common=1, webp=1, png=1'});
  if (await page.locator('.cx77-splash').count()) await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  const notice2 = page.locator('.cxx-notice');
  if (await notice2.count()) { const later2 = notice2.getByRole('button', {name: '稍后再说'}); if (await later2.count()) await later2.click(); }
  const pngView = await page.evaluate(async () => {
    const rel = (await (await fetch('/play/current.json', {cache: 'no-store'})).json()).release;
    const data = await (await fetch('/play/releases/' + rel + '/data/player-pack.json', {cache: 'no-store'})).json();
    const row = data.layers.png.entries.find(entry => entry.aliases?.some(alias => alias.startsWith('assets/')));
    const alias = row.aliases.find(alias => alias.startsWith('assets/'));
    const resolved = CxxResources.resolve(alias);
    const buffer = await CxxResources.load(alias, {type: 'buffer'});
    return {alias, resolved, png: resolved.endsWith('.png'), mime: CxxResources.record(alias)?.mime, quality: CxxResources.quality, bytes: buffer.byteLength};
  });
  assert.equal(pngView.png, true);
  assert.equal(pngView.mime, 'image/png');
  assert.equal(pngView.quality, 'original');
  ok('原画档图片命中 PNG', {detail: pngView.alias + ' → ' + pngView.resolved.split('/').slice(-1)[0] + ' (' + pngView.bytes + ' B)'});
  await page.locator('.cxx-game-menu .game-navigation button', {hasText: '设置'}).first().click();
  await page.locator('#cx77-settings-tab-resources').click();
  await page.waitForSelector('#pack-controls .cxx-pack-manager', {timeout: 30000});
  manager = await page.locator('#pack-controls').innerText();
  assert.match(manager, /原画质/);
  assert.match(manager, /标准画质图片/);
  assert.match(manager, /删除标准画质图片/);
  ok('原画档设置列表', {detail: manager.replace(/\s+/g, ' ').slice(0, 200)});
  await page.getByRole('button', {name: /删除标准画质图片/}).click();
  await page.waitForTimeout(1200);
  const afterDelete = await cacheMark(page, current.release, ['common', 'webp', 'png'].map(key => catalog.layers[key].id));
  assert.equal(afterDelete[catalog.layers.common.id], true);
  assert.equal(afterDelete[catalog.layers.webp.id], false);
  assert.equal(afterDelete[catalog.layers.png.id], true);
  manager = await page.locator('#pack-controls').innerText();
  assert.doesNotMatch(manager, /删除标准画质图片/);
  ok('删除标准档只删 WebP', {detail: 'common=1, webp=0, png=1'});
  await page.screenshot({path: path.join(HERE, '..', '..', '.cache', 'play-loading-20261027', 'checks', 'pack-real-original.png'), fullPage: false});
  if (errors.length) throw Error('页面错误：\n' + errors.join('\n'));
  ok('无脚本错误');
  receipt.passed = true;
  receipt.manager = manager;
  receipt.pngView = pngView;
} catch (error) {
  receipt.passed = false;
  fail('原画档真实入口', error);
  if (browser) { const pages = browser.contexts().flatMap(context => context.pages()); if (pages[0]) await pages[0].screenshot({path: path.join(HERE, '..', '..', '.cache', 'play-loading-20261027', 'checks', 'pack-real-original-failure.png')}).catch(() => {}); }
} finally {
  receipt.errors = errors;
  fs.mkdirSync(path.join(HERE, '..', '..', '.cache', 'play-loading-20261027', 'checks'), {recursive: true});
  fs.writeFileSync(path.join(HERE, '..', '..', '.cache', 'play-loading-20261027', 'checks', 'pack-real-original.json'), JSON.stringify(receipt, null, 2) + '\n');
  if (browser) await browser.close();
}
process.exitCode = receipt.passed ? 0 : 1;
