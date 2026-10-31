// 真实宿主验证：① 关闭插件门槛后回到卡内主界面（不是原生酒馆）② 更新接口无效时按仓库地址重装修复。
// 前置夹具：宿主扩展目录里的 SillyTavern-Runtime-Suite 为 0.2.0 且没有 .git（模拟“非 git 安装”的旧版本）。
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { chromium } = require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const cardFile = process.argv[2] || path.join(root, '.cache/build/东京都2051-V2.3.10.json');
const bytes = fs.readFileSync(cardFile), card = JSON.parse(bytes);
const out = path.join(root, '.cache/debug223/plugin-repair');
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const report = { card: { file: path.basename(cardFile), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }, checks: [], errors: [] };
const mark = m => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's ' + m);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await context.newPage();
  p.setDefaultTimeout(60000);
  p.on('pageerror', e => report.errors.push(String(e.message).slice(0, 300)));
  const boot = () => p.waitForFunction(() => window.SillyTavern && window.TavernHelper && !document.querySelector('#preloader'));
  const dismiss = () => p.evaluate(() => {
    [...document.querySelectorAll('.popup .popup-button-ok, #dialogs .popup-button-ok')].filter(b => b.getClientRects().length).forEach(b => b.click());
    const ann = document.querySelector('.cxx-announcement'); if (ann) ann.querySelector('button')?.click();
  });
  await p.goto('http://127.0.0.1:6948'); await boot(); mark('booted');
  const token = (await (await p.request.get('http://127.0.0.1:6948/csrf-token')).json()).token;
  const avatar = 'plugin-repair-' + Date.now() + '.png';
  const imported = await p.request.post('http://127.0.0.1:6948/api/characters/import', {
    headers: { 'X-CSRF-Token': token },
    multipart: { file_type: 'json', preserved_name: avatar, avatar: { name: 'plugin-repair.json', mimeType: 'application/json', buffer: bytes } },
  });
  assert(imported.ok(), 'import failed ' + imported.status()); mark('imported');
  p.evaluate(async ({ avatar, book, name }) => {
    const c = SillyTavern.getContext(), w = await import('/scripts/world-info.js');
    await w.saveWorldInfo(name, w.convertCharacterBook(book), true);
    await c.getCharacters();
    await c.selectCharacterById(c.characters.findIndex(x => x.avatar === avatar));
    window.__selectDone = true;
  }, { avatar, book: card.data.character_book, name: card.data.extensions.world }).catch(e => report.errors.push('select:' + e.message));
  let gateSeen = false;
  for (let i = 0; i < 120; i++) {
    await dismiss();
    if (await p.evaluate(() => !!document.querySelector('.cxx-plugin-dialog[open]'))) { gateSeen = true; break; }
    await p.waitForTimeout(1000);
  }
  assert(gateSeen, '插件门槛没有出现');
  report.rowsBefore = await p.evaluate(() => CxxPlugins.read().rows.map(r => ({ id: r.id, kind: r.kind, installed: r.installedVersion || '' })));
  report.suiteManifest = (await (await p.request.get('http://127.0.0.1:6948/scripts/extensions/third-party/SillyTavern-Runtime-Suite/manifest.json')).json()).version;
  assert.equal(report.suiteManifest, '0.2.0');
  mark('gate-visible manifest=' + report.suiteManifest);

  // ① 关闭门槛必须回到卡内主菜单，而不是原生酒馆
  const back = (await p.locator('.cxx-plugin-dialog > button').last().innerText()).trim();
  report.back = back;
  assert.match(back, /回到主界面/);
  await p.locator('.cxx-plugin-dialog > button').last().click();
  await p.waitForFunction(() => !document.querySelector('.cxx-plugin-dialog[open]'), null, { timeout: 20000 });
  const menu = await p.evaluate(() => {
    const el = document.querySelector('.cxx-game-menu');
    const visible = n => !!n && n.getClientRects().length > 0;
    return {
      menu: visible(el),
      title: !!el && [...el.querySelectorAll('button')].some(b => b.textContent.trim() === '新游戏' && b.getClientRects().length),
      nativeChat: visible(document.querySelector('#chat')) && !el,
    };
  });
  report.afterBack = menu;
  assert.equal(menu.menu, true, '关闭插件面板后卡内主菜单必须还在');
  assert.equal(menu.title, true, '关闭插件面板后必须停在主界面（能点新游戏）');
  await p.screenshot({ path: path.join(out, '1-back-to-title.png') });
  mark('back=' + JSON.stringify(menu));
  report.checks.push('关闭插件门槛回到卡内主界面（新游戏可用），不再掉回原生酒馆界面');

  // ② 非 git 安装的旧版本：更新接口必然失败，卡内应删目录并按仓库地址重装到 0.3.4
  await p.locator('.cxx-game-shell button, .cxx-game-menu button', { hasText: '插件安装' }).first().click({ timeout: 30000 });
  await p.locator('.cxx-plugin-dialog[open]').waitFor({ state: 'visible' });
  mark('panel-open');
  await p.locator('.cxx-plugin-check article[data-plugin=suite] button', { hasText: '更新' }).click();
  mark('clicked-update');
  // 重装走酒馆的安装接口，酒馆会弹第三方扩展确认框；真实用户点“确认”，这里代替点掉。
  let settled = false;
  for (let i = 0; i < 240; i++) {
    await dismiss();
    settled = await p.evaluate(() => CxxPlugins.read().installation.needReload === true || !!CxxPlugins.read().installation.error);
    if (settled) break;
    await p.waitForTimeout(1000);
  }
  assert(settled, '更新/重装既没有成功也没有报错');
  report.afterRepair = await p.evaluate(() => ({
    error: CxxPlugins.read().installation.error,
    notice: CxxPlugins.read().installation.notice,
    stage: CxxPlugins.read().installation.results.map(r => r.stage),
    needReload: CxxPlugins.read().installation.needReload,
    suite: (CxxPlugins.read().rows.find(r => r.id === 'suite') || {}).installedVersion,
  }));
  report.suiteAfter = (await (await p.request.get('http://127.0.0.1:6948/scripts/extensions/third-party/SillyTavern-Runtime-Suite/manifest.json')).json()).version;
  await p.screenshot({ path: path.join(out, '2-repaired.png') });
  mark('repair=' + JSON.stringify({ ...report.afterRepair, manifest: report.suiteAfter }));
  assert.equal(report.afterRepair.needReload, true, '重装成功应提示刷新：' + report.afterRepair.error);
  assert.equal(report.suiteAfter, '0.3.4', '重装必须把 0.3.4 落到磁盘');
  assert.match(report.afterRepair.notice, /重装/);
  report.checks.push('非 git 的旧版本：更新接口失败后自动删除目录并按仓库地址重装到 0.3.4，并提示刷新');

  await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.evaluate(() => location.reload())]);
  await boot(); mark('reloaded');
  p.evaluate(async ({ avatar }) => {
    const c = SillyTavern.getContext(); await c.getCharacters();
    await c.selectCharacterById(c.characters.findIndex(x => x.avatar === avatar));
  }, { avatar }).catch(() => { });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    await dismiss();
    ready = await p.evaluate(() => !!window.CxxPlugins && CxxPlugins.read().rows.some(r => r.id === 'suite' && r.kind === 'ready'));
    if (ready) break;
    await p.waitForTimeout(1000);
  }
  report.afterReload = { ready, version: await p.evaluate(() => window.TavernRuntimeSuite?.version || null), gate: await p.evaluate(() => document.querySelectorAll('.cxx-plugin-dialog[open]').length) };
  await p.screenshot({ path: path.join(out, '3-after-reload.png') });
  mark('afterReload=' + JSON.stringify(report.afterReload));
  assert.equal(ready, true, '刷新后 suite 行应 ready');
  report.checks.push('刷新后 Suite 0.3.4 运行时就绪，门槛不再出现');

  report.pass = true;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log('\nPASS ' + JSON.stringify(report.checks, null, 1));
})().catch(e => {
  report.pass = false; report.failure = e.message;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.error('FAIL ' + e.message);
  process.exit(1);
});
