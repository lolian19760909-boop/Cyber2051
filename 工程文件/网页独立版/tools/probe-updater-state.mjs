/** 探针六：换卡后 whenIdle 卡住的真实原因——读更新器状态、恢复检查与日志。只读，不写。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const fixture = JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url))).fixture;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const out = { at: new Date().toISOString(), state: null, idle: null, console: [], errors: [] };
page.on('console', m => { const t = m.text(); if (/更新|恢复|安装|journal|卡更新|错误|失败/i.test(t) && out.console.length < 120) out.console.push({ type: m.type(), text: t.slice(0, 300) }); });
page.on('pageerror', e => out.errors.push(String((e && e.stack) || e).slice(0, 600)));
await context.route('https://**/*', r => r.abort());

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
  await page.waitForTimeout(3000);

  out.state = await page.evaluate(async () => {
    const U = globalThis.Cxx233Updater;
    const safe = async (fn, label) => { try { return { ok: true, label, value: await fn() }; } catch (error) { return { ok: false, label, error: String((error && error.message) || error) }; } };
    const state = (() => { try { return U.host.readState(); } catch (error) { return { error: String(error.message || error) }; } })();
    const status = (() => { try { return U.getStatus(); } catch (error) { return { error: String(error.message || error) }; } })();
    const activity = (() => { try { return U.activity(); } catch (error) { return { error: String(error.message || error) }; } })();
    const inspect = await safe(() => U.inspectRecovery(), 'inspectRecovery');
    const vars = SillyTavern.getContext().chatMetadata?.variables || {};
    const origin = vars.__cxx_content_origin || null;
    return {
      state: {
        journalName: state?.journalName, pendingRegistry: state?.pendingRegistry, engineVersion: state?.engineVersion,
        characterKey: state?.characterKey, instanceId: state?.instanceId, lastReleaseBackup: state?.lastReleaseBackup,
      },
      status, activity, inspect,
      contentOrigin: origin,
      runtime: globalThis.Cxx233Updater.runtimeHash ? globalThis.Cxx233Updater.runtimeHash() : null,
    };
  });

  out.idle = await page.evaluate(() => Promise.race([
    globalThis.Cxx233Updater.whenIdle().then(() => 'idle'),
    new Promise(resolve => setTimeout(() => resolve('timeout'), 15000)),
  ]));
  out.after = await page.evaluate(() => {
    const U = globalThis.Cxx233Updater;
    const state = (() => { try { return U.host.readState(); } catch (e) { return { error: String(e.message || e) }; } })();
    return { journalName: state?.journalName, pendingRegistry: state?.pendingRegistry, activity: U.activity(), status: U.getStatus() };
  });
} catch (error) {
  out.errors.push('fatal: ' + String((error && error.stack) || error).slice(0, 1000));
}
await browser.close();
fs.writeFileSync(new URL('../reports/probe-updater-state.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ state: out.state, idle: out.idle, after: out.after, errors: out.errors }, null, 1).slice(0, 4000));
console.log('## console', JSON.stringify(out.console.slice(0, 12), null, 1).slice(0, 1200));
