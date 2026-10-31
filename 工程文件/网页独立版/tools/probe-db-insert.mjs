/** 探针二：直接问 AutoCardUpdaterAPI —— insertRow 的真实签名与拒绝原因。只读函数源码 + 可回收的一次插入。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const fixture = JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url))).fixture;

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const out = { at: new Date().toISOString(), api: null, signature: null, calls: [], console: [], errors: [] };
page.on('console', m => { const t = m.text(); if (/insertRow|autoCard|数据库|拒绝|sheet/i.test(t)) out.console.push({ type: m.type(), text: t.slice(0, 300) }); });
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

  out.api = await page.evaluate(() => {
    const A = globalThis.AutoCardUpdaterAPI, V2 = globalThis.AutoCardUpdaterV2API;
    const shape = o => Object.fromEntries(Object.keys(o || {}).sort().map(k => [k, typeof o[k]]));
    return { keys: shape(A), v2keys: shape(V2) };
  });

  out.signature = await page.evaluate(() => {
    const A = globalThis.AutoCardUpdaterAPI;
    const src = fn => { try { return String(fn).replace(/\s+/g, ' ').slice(0, 900); } catch (e) { return String(e); } };
    return {
      insertRowLength: A?.insertRow?.length,
      insertRowSource: src(A?.insertRow),
      updateRowSource: src(A?.updateRow)?.slice(0, 400),
      deleteRowSource: src(A?.deleteRow)?.slice(0, 400),
      importSource: src(A?.importTableAsJson)?.slice(0, 400),
      exportSource: src(A?.exportTableAsJson)?.slice(0, 400),
    };
  });

  const key = 'probe_' + Date.now();
  out.calls.push(await page.evaluate(async (k) => {
    const A = globalThis.AutoCardUpdaterAPI;
    const results = {};
    const attempt = async (label, args) => {
      try { results[label] = { ok: true, value: await A.insertRow(...args) }; }
      catch (e) { results[label] = { ok: false, thrown: String((e && e.message) || e) }; }
    };
    const row = { row_id: 0, tx_key: k, status: '待处理', events: 'probe', wallet_before: '{"yen":0}', issues: '' };
    await attempt('pinyinKey+sqlRow', ['sheet_dai_ding_shi_wu_biao', row]);
    await attempt('chineseName+sqlRow', ['待定事务表', row]);
    await attempt('uid+sqlRow', ['sheet_cxx_pending_tx', row]);
    return { key: k, results };
  }, key));

  // 回收：读出是否落了行，落了就用 deleteRow 两种候选清掉
  out.calls.push(await page.evaluate(async (k) => {
    const A = globalThis.AutoCardUpdaterAPI;
    const dump = A.exportTableAsJson();
    const sheet = dump?.['sheet_dai_ding_shi_wu_biao'];
    const rows = (sheet?.content || []).slice(1);
    const hit = rows.findIndex(r => String(r[1]) === k);
    const cleanup = { found: hit >= 0, index: hit, rows: rows.length, tries: [] };
    if (hit >= 0) {
      for (const name of ['sheet_dai_ding_shi_wu_biao', '待定事务表']) {
        for (const pos of [hit, hit + 1]) {
          try { cleanup.tries.push({ name, pos, ret: A.deleteRow(name, pos) }); } catch (e) { cleanup.tries.push({ name, pos, thrown: String(e && e.message || e) }); }
          const now = (A.exportTableAsJson()?.['sheet_dai_ding_shi_wu_biao']?.content || []).slice(1);
          if (!now.some(r => String(r[1]) === k)) { cleanup.cleaned = true; break; }
        }
        if (cleanup.cleaned) break;
      }
    }
    const after = (A.exportTableAsJson()?.['sheet_dai_ding_shi_wu_biao']?.content || []).slice(1);
    cleanup.rowsAfter = after.length;
    cleanup.stillThere = after.some(r => String(r[1]) === k);
    return cleanup;
  }, key));
} catch (error) {
  out.errors.push('fatal: ' + String((error && error.stack) || error).slice(0, 1200));
}

await browser.close();
fs.writeFileSync(new URL('../reports/probe-db-insert.json', import.meta.url), JSON.stringify(out, null, 2));

const j = v => JSON.stringify(v, null, 1);
console.log('## API keys', j(out.api?.keys).slice(0, 800));
console.log('## V2 keys', j(out.api?.v2keys).slice(0, 400));
console.log('## signature', j(out.signature));
console.log('## calls', j(out.calls).slice(0, 2500));
console.log('## console', j(out.console).slice(0, 800));
console.log('## errors', j(out.errors).slice(0, 800));
