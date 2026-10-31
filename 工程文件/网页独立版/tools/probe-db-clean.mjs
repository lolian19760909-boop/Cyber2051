/** 清掉探针留下的待定事务表残留行（按当前 1 基位置删除，删到没有为止）。只动 probe 前缀。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const fixture = JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url))).fixture;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const out = { at: new Date().toISOString(), rounds: [], errors: [] };
page.on('pageerror', e => out.errors.push(String((e && e.stack) || e).slice(0, 400)));
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
  await page.evaluate(() => globalThis.Cxx233Updater.whenIdle());

  out.rounds = await page.evaluate(async () => {
    const A = globalThis.AutoCardUpdaterAPI;
    const rows = () => ((A.exportTableAsJson()?.['sheet_dai_ding_shi_wu_biao']?.content) || []).slice(1);
    const log = [];
    for (let guard = 0; guard < 12; guard += 1) {
      const list = rows();
      const at = list.findIndex(row => /^probe/.test(String(row[1])));
      log.push({ round: guard, rows: list.length, ids: list.map(row => String(row[1])), at });
      if (at < 0) break;
      const ret = await A.deleteRow('待定事务表', at + 1);
      log[log.length - 1].ret = ret;
      if (rows().length === list.length) log[log.length - 1].stuck = true;
      if (log.at(-1).stuck) break;
    }
    return { log, left: rows().map(row => String(row[1])) };
  });
} catch (error) {
  out.errors.push('fatal: ' + String((error && error.stack) || error).slice(0, 800));
}
await browser.close();
fs.writeFileSync(new URL('../reports/probe-db-clean.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 2000));
