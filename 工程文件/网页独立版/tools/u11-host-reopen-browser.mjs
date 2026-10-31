/** U11 host side: open twice at once, reopen the same build, close and dispose without leftovers. */
import fs from 'node:fs';
import { chromium } from 'playwright';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base = 'http://127.0.0.1:22351';
// 选有 2051 正文的角色与聊天：空聊天会停在人物创建，booted 永远为 false，会把“开合残留”判成失败。
const DIR = process.argv.find(value => value.startsWith('--dir='))?.slice(6) || 'WEB_HOST_TEST_1792928536359';
const CHAT = process.argv.find(value => value.startsWith('--chat='))?.slice(7) || 'web-controlled-1792928546613';
const report = { schema: 1, at: new Date().toISOString(), steps: [] };
const step = (name, detail) => { report.steps.push({ name, ok: true, detail }); console.log('PASS ' + name + (detail ? ' :: ' + detail : '')); };
const fail = (name, error) => { report.steps.push({ name, ok: false, error: String(error?.message || error) }); console.log('FAIL ' + name + ' :: ' + String(error?.message || error)); };
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1184, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error.message).slice(0, 200)));
try {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.SillyTavern?.getContext, null, { timeout: 180000 });
  await page.waitForFunction(() => globalThis.Cxx2051WebExtension?.identity?.buildId, null, { timeout: 90000 });
  await page.waitForFunction(() => (globalThis.SillyTavern?.getContext?.().characters?.length || 0) > 0, null, { timeout: 120000 });
  const picked = await page.evaluate(async fixture => {
    const chars = globalThis.SillyTavern.getContext().characters;
    let index = chars.findIndex(row => row.avatar === fixture.dir + '.png');
    if (index < 0) index = chars.findIndex(row => /^WEB_HOST_TEST_.*\.png$/.test(row.avatar));
    if (index < 0) index = chars.findIndex(row => /2051/.test(String(row.name || '')));
    if (index < 0) index = 0;
    const context = globalThis.SillyTavern.getContext();
    await context.selectCharacterById(index);
    if (fixture.chat && globalThis.SillyTavern.getContext().getCurrentChatId?.() !== fixture.chat) await globalThis.SillyTavern.getContext().openCharacterChat(fixture.chat);
    return { index, avatar: chars[index]?.avatar || null, name: chars[index]?.name || null, chat: globalThis.SillyTavern.getContext().getCurrentChatId?.() ?? null, total: chars.length };
  }, { dir: DIR, chat: CHAT });
  report.character = picked;
  await page.waitForTimeout(1200);
  // openWeb 的守卫是「宿主还有打开着的弹窗就拒绝」，所以先把本轮切换角色引起的弹窗逐轮点掉，直到页面真的干净。
  for (let round = 0; round < 6; round += 1) {
    await page.evaluate(() => {
      for (const dialog of document.querySelectorAll('dialog[open],.TH-popup')) {
        const buttons = [...dialog.querySelectorAll('button,input[type=button]')].filter(node => node.offsetParent !== null);
        const dismiss = buttons.filter(node => /确定|确认|知道了|关闭|好的|OK|继续/i.test(node.textContent || node.value || '')).pop();
        (dismiss || buttons.pop())?.click();
      }
    });
    await page.waitForTimeout(200);
  }
  report.leftoverDialogs = await page.evaluate(() => [...document.querySelectorAll('dialog[open],.TH-popup')].map(node => String(node.innerText || '').slice(0, 120)));

  const built = JSON.parse(fs.readFileSync('artifacts/st-extension/identity.json', 'utf8'));
  // 同版本重开：两次并发 openWeb 只应产生一个面板（openFlight 单飞）。
  const double = await page.evaluate(async () => {
    const mod = await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs');
    const [first, second] = await Promise.all([mod.openWeb(), mod.openWeb()]);
    const identity = globalThis.Cxx2051WebExtension?.identity || null;
    const panels = document.querySelectorAll('#cxx2051-web-panel').length;
    return { samePromise: first === second, panels, buildId: identity?.buildId || null, files: identity?.verify?.files?.length ?? null };
  });
  try {
    if (double.panels !== 1) throw new Error('面板数量 ' + double.panels);
    if (double.buildId !== built.buildId) throw new Error('扩展身份 ' + double.buildId + ' 与构建 ' + built.buildId + ' 不同');
    step('并发两次打开只建一个面板', 'panels=' + double.panels + ' samePromise=' + double.samePromise);
    step('运行中的扩展身份等于本次构建', double.buildId);
  } catch (error) { fail('并发两次打开只建一个面板', error); }

  await page.waitForFunction(() => { const frame = document.getElementById('cxx2051-web-panel')?.querySelector('iframe'); return frame?.contentWindow?.CxxWebApp?.read?.().booted === true; }, null, { timeout: 180000 });
  const runId1 = await page.evaluate(() => document.getElementById('cxx2051-web-panel').querySelector('iframe').contentWindow.CxxWebApp.read().release?.buildId || null);
  try { if (runId1 !== built.buildId) throw new Error('页面内构建 ' + runId1); step('页面内构建与发布一致', runId1); } catch (error) { fail('页面内构建与发布一致', error); }

  // 关闭再打开：面板移除，重开后仍是同一构建。
  const reopen = await page.evaluate(async () => {
    const mod = await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs');
    mod.closeWeb({ refresh: false });
    const afterClose = document.querySelectorAll('#cxx2051-web-panel').length;
    await mod.openWeb();
    const afterOpen = document.querySelectorAll('#cxx2051-web-panel').length;
    const identity = globalThis.Cxx2051WebExtension?.identity || null;
    return { afterClose, afterOpen, buildId: identity?.buildId || null };
  });
  try {
    if (reopen.afterClose !== 0) throw new Error('关闭后仍留有面板 ' + reopen.afterClose);
    if (reopen.afterOpen !== 1) throw new Error('重开后面板 ' + reopen.afterOpen);
    step('关闭释放面板、重开仍只一个', 'close=' + reopen.afterClose + ' open=' + reopen.afterOpen);
  } catch (error) { fail('关闭释放面板、重开仍只一个', error); }

  await page.waitForFunction(() => { const frame = document.getElementById('cxx2051-web-panel')?.querySelector('iframe'); return frame?.contentWindow?.CxxWebApp?.read?.().booted === true; }, null, { timeout: 180000 });
  const runId2 = await page.evaluate(() => document.getElementById('cxx2051-web-panel').querySelector('iframe').contentWindow.CxxWebApp.read().release?.buildId || null);
  try { if (runId2 !== runId1) throw new Error('重开后构建 ' + runId2); step('重开后仍是同一构建', runId2); } catch (error) { fail('重开后仍是同一构建', error); }

  // 卸载：dispose 后按钮与面板都不留，且可被重新安装。
  const disposed = await page.evaluate(async () => {
    const mod = await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs');
    mod.disposeWebExtension();
    const panels = document.querySelectorAll('#cxx2051-web-panel').length;
    const buttons = [...document.querySelectorAll('button,.menu_button')].filter(row => (row.textContent || '').includes('网页'));
    const reopened = await mod.openWeb();
    return { panels, buttons: buttons.length, reopened: !!reopened };
  });
  try {
    if (disposed.panels !== 0) throw new Error('卸载后仍有面板');
    if (!disposed.reopened) throw new Error('卸载后无法重新打开');
    step('卸载后无残留且可重新打开', 'panels=' + disposed.panels + ' buttons=' + disposed.buttons);
  } catch (error) { fail('卸载后无残留且可重新打开', error); }

  report.pageErrors = errors.slice(0, 6);
} catch (error) { report.error = String(error?.message || error); report.pageErrors = errors.slice(0, 6); }
finally { await browser.close(); }
const failed = report.steps.filter(row => !row.ok).length;
report.verdict = report.error ? 'error' : failed ? 'fail' : 'ok';
fs.writeFileSync('reports/u11-host-reopen.json', JSON.stringify(report, null, 2) + '\n');
console.log('U11-HOST=' + (report.verdict === 'ok' ? 0 : 1) + ' (' + (report.steps.length - failed) + '/' + report.steps.length + ')');
process.exit(report.verdict === 'ok' ? 0 : 1);
