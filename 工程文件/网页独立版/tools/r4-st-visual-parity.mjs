/** 真 ST 与网页同状态截图 v6：ST 侧走卡片自己的快捷回复入口（城市地图／战斗／手机／创意工坊／故事存档），
 *  网页侧走面板内同名视图。只截图与记录；开不出来的记 missing 并写明原因。 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const ROOT = new URL('../reports/', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(new URL('r4-browser-check.json', ROOT))).fixture;
const QR = [
  {view: '地图', label: '城市地图'},
  {view: '战斗进行态', label: '战斗'},
  {view: '通讯', label: '手机'},
  {view: '图库', label: '创意工坊'},
  {view: '委托', label: '故事存档'},
];
const WEB_PAGES = [{view: '终端', page: 'city'}, {view: '委托', page: 'operations'}, {view: '图库', page: 'media'}, {view: '人物', page: 'characters'}];
const out = { at: new Date().toISOString(), fixture, viewport: '1440x960', native: [], web: [], missing: [], errors: [] };

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', e => out.errors.push(String(e.message || e).slice(0, 200)));
await context.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(origin) || url.startsWith('https://cyber2051.top/') || /^(blob|data):/.test(url)) return route.continue();
  return route.abort();
});
const shot = async name => { const file = name + '.png'; await page.screenshot({ path: fileURLToPath(new URL(file, ROOT)) }); return file; };
async function dialogs() {
  const ok = page.locator('dialog[open] .popup-button-ok,dialog[open] .popup-button-yes,dialog[open].cxx-announcement button').last();
  if (await ok.isVisible().catch(() => false)) await ok.click({ timeout: 500 }).catch(() => {});
}
async function operation(fn, arg) {
  let done = false, value, failure;
  page.evaluate(fn, arg).then(v => { done = true; value = v; }, e => { done = true; failure = e; });
  const until = Date.now() + 120000;
  while (!done && Date.now() < until) { await dialogs(); await new Promise(r => setTimeout(r, 120)); }
  if (!done) throw Error('120 秒未结束');
  if (failure) throw failure;
  return value;
}
const clickText = async (text, selector = 'button,[role=button],a,summary') => page.evaluate(({ text, selector }) => {
  const el = [...document.querySelectorAll(selector)].find(n => (n.innerText || '').trim() === text);
  if (!el) return false;
  el.scrollIntoView?.({ block: 'center' });
  el.click();
  return true;
}, { text, selector });

await page.goto(origin);
await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false, null, { timeout: 90000 });
await operation(async ({ avatar, chatId }) => {
  let c = SillyTavern.getContext(); await c.getCharacters(); c = SillyTavern.getContext();
  const id = c.characters.findIndex(r => r.avatar === avatar);
  if (id < 0) throw Error('找不到隔离测试卡');
  await c.selectCharacterById(id);
  await SillyTavern.getContext().openCharacterChat(chatId);
}, { avatar: fixture.avatar, chatId: fixture.chatId });
out.booted = await page.waitForFunction(() => /继续游戏|新游戏/.test(document.body.innerText || ''), null, { timeout: 180000 }).then(() => true).catch(() => false);
if (!out.booted) out.missing.push({view: '全部', side: 'st', reason: '标题页 180 秒未出现'});
else {
  out.native.push({view: '原生整体（标题页）', file: await shot('st-parity-title')});
  out.entered = (await clickText('继续游戏')) || (await clickText('读取存档')) || 'no-entry';
  await page.waitForTimeout(6500);
  await operation(() => globalThis.Cxx233Updater?.whenIdle?.()).catch(() => null);
  for (let i = 0; i < 5; i++) { await dialogs(); await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(180); }
  out.qr = await page.evaluate(() => [...document.querySelectorAll('.qr--button')].map(n => (n.innerText || '').trim()).filter(Boolean));
  out.native.push({view: '原生整体（阅读页）', file: await shot('st-parity-whole')});
  for (const item of QR) {
    const ok = await clickText(item.label, '.qr--button, button, [role=button]');
    if (!ok) { out.missing.push({view: item.view, side: 'st', reason: '没有同名快捷回复'}); continue; }
    await page.waitForTimeout(2600);
    out.native.push({view: item.view, via: 'quick-reply ' + item.label, file: await shot('st-parity-' + encodeURIComponent(item.view))});
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(900);
    await operation(() => globalThis.Cxx233Updater?.whenIdle?.()).catch(() => null);
  }
  out.missing.push({view: '终端', side: 'st', reason: '真 ST 侧终端没有独立快捷回复入口，只在阅读页内的“原生阅读与终端”区域打开；自动化未稳定命中，留给作者 10.2 实机补拍'});
}

let webOpen = 'none';
for (let i = 0; i < 6 && webOpen !== 'ok'; i++) {
  webOpen = await page.evaluate(async () => { try { await (await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs')).openWeb(); return 'ok'; } catch (e) { return 'err:' + e.message; } });
  if (webOpen !== 'ok') { for (let k = 0; k < 3; k++) { await dialogs(); await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(400); } await operation(() => globalThis.Cxx233Updater?.whenIdle?.()).catch(() => null); await page.waitForTimeout(1200); }
}
out.webOpen = webOpen;
if (webOpen === 'ok') {
  let frame = null;
  for (let i = 0; i < 720 && !frame; i++) {
    const candidate = page.frames().find(f => f.url().includes('/third-party/Cyber2051-Web/app/'));
    if (candidate) { const ready = await candidate.evaluate(() => !!(globalThis.CxxWebApp?.session && globalThis.CxxWebApp?.ui)).catch(() => false); if (ready) frame = candidate; }
    if (!frame) await page.waitForTimeout(250);
  }
  if (!frame) out.missing.push({view: '全部', side: 'web', reason: '网页未就绪'});
  else {
    await page.waitForTimeout(1000);
    out.web.push({view: '原生整体', file: await shot('web-parity-whole')});
    out.webNav = await frame.evaluate(() => { const b = [...document.querySelectorAll('button,[role=button]')].find(n => /终端/.test(n.innerText || '')); if (!b) return 'no-button'; b.click(); return 'clicked'; });
    await page.waitForTimeout(2600);
    for (const item of WEB_PAGES) {
      const opened = await frame.evaluate(p => { const app = globalThis.CxxTerminalApp; if (!app?.open) return 'no-terminal'; app.open({page: p}); return app.read?.().page || 'opened'; }, item.page).catch(e => 'err:' + e.message);
      if (opened === 'no-terminal' || String(opened).startsWith('err:')) { out.missing.push({view: item.view, side: 'web', reason: String(opened)}); continue; }
      await page.waitForTimeout(1100);
      out.web.push({view: item.view, page: item.page, file: await shot('web-parity-' + encodeURIComponent(item.view)), opened});
    }
    await frame.evaluate(() => { try { globalThis.CxxTerminalApp?.close?.(); } catch {} });
    const webAtlas = await frame.evaluate(() => { try { if (!globalThis.CxxAtlasTool?.open) return 'no-atlas'; globalThis.CxxAtlasTool.open(); return 'opened'; } catch (e) { return 'err:' + e.message; } });
    if (webAtlas === 'opened') { await page.waitForTimeout(1500); out.web.push({view: '地图', file: await shot('web-parity-' + encodeURIComponent('地图'))}); }
    else out.missing.push({view: '地图', side: 'web', reason: webAtlas});
    out.missing.push({view: '战斗进行态', side: 'web', reason: '网页侧战斗视图需真实战斗提交后挂载，本轮不临时构造'});
  }
}

fs.writeFileSync(new URL('r4-st-visual-parity.json', ROOT), JSON.stringify(out, null, 1) + '\n');
console.log('booted', out.booted, 'entered', out.entered, 'webOpen', out.webOpen);
console.log('qr', JSON.stringify(out.qr));
console.log('native', out.native.map(r => r.view + ':' + r.file).join(' '));
console.log('web', out.web.map(r => r.view + ':' + r.file).join(' '));
console.log('missing', JSON.stringify(out.missing));
await browser.close();
