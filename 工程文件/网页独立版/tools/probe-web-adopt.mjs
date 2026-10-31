/** 探针七：网页接回（openWeb）后 iframe 内应用为何没起来。只采集。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const fixture = JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url))).fixture;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const out = { at: new Date().toISOString(), console: [], failed: [], errors: [], app: null };
page.on('console', m => { const t = m.text(); if (!/Thumbnails|favicon|getRegexedString|\[WI\]/i.test(t) && out.console.length < 200) out.console.push({ type: m.type(), text: t.slice(0, 300) }); });
page.on('pageerror', e => out.errors.push(String((e && e.stack) || e).slice(0, 500)));
page.on('requestfailed', r => { if (out.failed.length < 40) out.failed.push({ url: r.url().slice(0, 160), why: r.failure()?.errorText }); });
await context.route('https://**/*', r => r.abort());

const dialogs = async () => { for (const text of ['确定', '确认', '好的', '关闭']) { const b = page.locator(`.popup-button-ok, .popup-button-yes, button:has-text("${text}")`).first(); if (await b.count().catch(() => 0)) await b.click({ timeout: 1500 }).catch(() => {}); } };

try {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false, null, { timeout: 120000 });
  await page.evaluate(async ({ avatar, chatId }) => {
    let c = SillyTavern.getContext();
    await c.getCharacters();
    c = SillyTavern.getContext();
    const id = c.characters.findIndex(r => r.avatar === avatar);
    await c.selectCharacterById(id);
    await SillyTavern.getContext().openCharacterChat(chatId);
  }, fixture);
  await page.waitForFunction(() => globalThis.Cxx233Updater?.whenIdle && globalThis.Cxx236VariableGuard?.state?.().ready, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  // 与验收脚本一致：先整页刷新、重新选中聊天，再看网页接回。
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false, null, { timeout: 120000 });
  await page.evaluate(async ({ avatar, chatId }) => {
    let c = SillyTavern.getContext();
    await c.getCharacters();
    c = SillyTavern.getContext();
    await c.selectCharacterById(c.characters.findIndex(r => r.avatar === avatar));
    await SillyTavern.getContext().openCharacterChat(chatId);
  }, fixture);
  await page.waitForTimeout(3000);
  out.closed = await page.evaluate(() => {
    const dialog = document.querySelector('dialog.cxx-announcement');
    if (!dialog) return 'no-announcement';
    const button = dialog.querySelector('button');
    if (button) { button.click(); return 'clicked:' + (button.textContent || '').slice(0, 20); }
    dialog.close?.(); return 'closed';
  });
  await page.waitForTimeout(600);
  out.dialogsLeft = await page.evaluate(() => [...document.querySelectorAll('dialog[open],.TH-popup')].map(d => (d.className || d.tagName) + '|' + (d.innerText || '').slice(0, 60)));

  out.open = await page.evaluate(async () => {
    try { const host = await (await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs')).openWeb(); globalThis.__probeBridge = host; return 'opened'; } catch (error) { return 'error: ' + String(error.message || error); }
  });
  await page.waitForTimeout(4000);
  const frame = page.frames().find(f => /app\/index\.html/.test(f.url()));
  out.frameUrl = frame?.url() || null;
  out.timeline = [];
  if (frame) {
    for (let i = 0; i < 50; i += 1) {
      const snap = await frame.evaluate(() => ({
        status: (document.querySelector('#status')?.textContent || (document.body.innerText.split('\n').find(l => /准备|装载|失败/.test(l)) || '')).slice(0, 80),
        session: !!globalThis.CxxWebApp?.session, ui: !!globalThis.CxxWebApp?.ui,
      })).catch(error => ({ error: String(error.message || error) }));
      out.timeline.push({ s: i * 2, ...snap });
      if (snap.session && snap.ui) break;
      await page.waitForTimeout(2000);
    }
  }
  out.conflict = await page.evaluate(() => {
    try { const host = globalThis.__probeBridge || globalThis.Cxx2051WebHost; const d = host?.diagnostics?.(); return d ? { conflict: d.lastConflict, phase: d.generationPhase } : { error: 'no-diagnostics' }; } catch (error) { return { error: String(error.message || error) }; }
  });
  if (frame) {
    out.app = await frame.evaluate(() => ({
      hasApp: typeof globalThis.CxxWebApp,
      keys: globalThis.CxxWebApp ? Object.keys(globalThis.CxxWebApp) : null,
      session: !!globalThis.CxxWebApp?.session, ui: !!globalThis.CxxWebApp?.ui,
      text: (document.body?.innerText || '').slice(0, 400),
      boot: globalThis.__cxxBootError || null,
    })).catch(error => ({ error: String(error.message || error) }));
  }
} catch (error) {
  out.errors.push('fatal: ' + String((error && error.stack) || error).slice(0, 800));
}
await browser.close();
fs.writeFileSync(new URL('../reports/probe-web-adopt.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ closed: out.closed, open: out.open, frameUrl: out.frameUrl, conflict: out.conflict, app: out.app, timeline: (out.timeline||[]).filter((r,i,a)=>i===0||i===a.length-1||r.status!==a[i-1].status) }, null, 1).slice(0, 2400));
console.log('## failed', JSON.stringify(out.failed.slice(0, 12), null, 1).slice(0, 1200));
console.log('## errors', JSON.stringify(out.errors.slice(0, 5)).slice(0, 800));
console.log('## console', JSON.stringify(out.console.slice(-14), null, 1).slice(0, 1800));
