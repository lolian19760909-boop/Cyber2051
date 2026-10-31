/** 探针三：问卡内 CxxDataStore.insert 的真实回执，并核对 exportTableAsJson 里的表显示名。只读代码 + 一次可回收插入。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const fixture = JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url))).fixture;

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const out = { at: new Date().toISOString(), sheets: null, insert: null, cleanup: null, console: [], errors: [] };
page.on('console', m => { const t = m.text(); if (/insertRow|数据库|拒绝|sheet|落库/i.test(t)) out.console.push({ type: m.type(), text: t.slice(0, 300) }); });
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
  await page.evaluate(() => globalThis.Cxx233Updater.whenIdle());

  out.sheets = await page.evaluate(() => {
    const dump = globalThis.AutoCardUpdaterAPI.exportTableAsJson() || {};
    return Object.keys(dump).filter(k => /^sheet_/.test(k)).map(k => ({
      key: k,
      name: dump[k]?.name,
      uid: dump[k]?.uid,
      rows: (dump[k]?.content || []).length ? (dump[k].content.length - 1) : 0,
    }));
  });

  out.insert = await page.evaluate(async () => {
    const key = 'probe2_' + Date.now();
    const shape = { row_id: 0, tx_key: key, status: '待处理', state: '待处理', kind: 'other', turn_no: 0, payload: 'probe2', events: 'probe2', updated_turn: 0 };
    const result = await globalThis.CxxDataStore.insert('cxx_pending_tx', shape);
    return { key, shape, result };
  });

  out.cleanup = await page.evaluate(async (key) => {
    const A = globalThis.AutoCardUpdaterAPI;
    const rows = () => ((A.exportTableAsJson()?.['sheet_dai_ding_shi_wu_biao']?.content) || []).slice(1);
    const hit = rows().findIndex(r => String(r[1]) === key);
    const tries = [];
    if (hit >= 0) {
      for (const name of ['待定事务表', 'sheet_dai_ding_shi_wu_biao']) {
        for (const pos of [hit, hit + 1]) {
          try { tries.push({ name, pos, ret: await A.deleteRow(name, pos) }); }
          catch (e) { tries.push({ name, pos, thrown: String((e && e.message) || e) }); }
          if (!rows().some(r => String(r[1]) === key)) break;
        }
        if (!rows().some(r => String(r[1]) === key)) break;
      }
    }
    return { hit, tries, left: rows().filter(r => String(r[1]) === key).length, rowsNow: rows().length };
  }, out.insert.key);
} catch (error) {
  out.errors.push('fatal: ' + String((error && error.stack) || error).slice(0, 1200));
}

await browser.close();
fs.writeFileSync(new URL('../reports/probe-db-insert2.json', import.meta.url), JSON.stringify(out, null, 2));

const j = v => JSON.stringify(v, null, 1);
console.log('## sheets', j(out.sheets));
console.log('## insert', j(out.insert));
console.log('## cleanup', j(out.cleanup));
console.log('## errors', j(out.errors).slice(0, 900));
