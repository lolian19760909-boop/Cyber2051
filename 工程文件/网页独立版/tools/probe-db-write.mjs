/** 探针：隔离宿主里「票据落库」为什么失败。只读+一次可回收的探针插入，不改卡产物。
 *  输出 reports/probe-db-write.json；控制台打印关键 reason 原文。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const fixture = JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url))).fixture;

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const consoleLines = [];
page.on('console', m => consoleLines.push({ type: m.type(), text: m.text().slice(0, 600) }));
page.on('pageerror', e => consoleLines.push({ type: 'pageerror', text: (e.stack || e.message).slice(0, 900) }));

await context.route('https://**/*', r => r.abort());

const result = { at: new Date().toISOString(), origin, surface: null, globalNames: [], detect: null, readsBefore: null, ensure: null, readsAfter: null, insertProbe: null, readBackProbe: null, removeProbe: null, writer: null, console: consoleLines, errors: [] };

try {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false, null, { timeout: 120000 });

  await page.evaluate(async ({ avatar, chatId }) => {
    let c = SillyTavern.getContext();
    await c.getCharacters();
    c = SillyTavern.getContext();
    const id = c.characters.findIndex(r => r.avatar === avatar);
    if (id < 0) throw Error('仅有隔离测试卡可用');
    await c.selectCharacterById(id);
    await SillyTavern.getContext().openCharacterChat(chatId);
  }, fixture);
  await page.waitForFunction(() => globalThis.Cxx233Updater?.whenIdle && globalThis.Cxx236VariableGuard?.state?.().ready, null, { timeout: 90000 });
  await page.evaluate(() => globalThis.Cxx233Updater.whenIdle());
  await page.evaluate(() => document.querySelector('#cxx2051-web-panel [data-close], #cxx2051-close-web, #cxx2051-web-panel .cxx-close')?.click?.());

  result.surface = await page.evaluate(() => {
    const S = globalThis.CxxDataStore;
    const W = globalThis.CxxDataWrite;
    const R = globalThis.CxxDataRead;
    const keys = o => (o && typeof o === 'object' ? Object.keys(o).sort() : typeof o);
    const types = o => Object.fromEntries(keys(o).map(k => [k, typeof o[k]]));
    return {
      store: types(S), storeTables: Array.isArray(S?.tables) ? S.tables.length : typeof S?.tables,
      write: types(W), read: types(R),
      guard: globalThis.Cxx236VariableGuard?.state?.() ?? null,
    };
  });

  result.globalNames = await page.evaluate(() => Object.keys(globalThis).filter(k => /shujuku|acup|AutoCard|DataBase|database|cxx/i.test(k)).sort());

  result.detect = await page.evaluate(() => {
    try {
      const d = globalThis.CxxDataStore.detect();
      return Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v !== 'object' && typeof v !== 'function'));
    } catch (e) { return { error: String(e && e.message || e) }; }
  });

  const readAll = async () => page.evaluate(async () => {
    const out = {};
    for (const logical of ['cxx_pending_tx', 'cxx_fact', 'cxx_wallet', 'cxx_actor', 'cxx_turn_index']) {
      try {
        const r = await globalThis.CxxDataStore.read(logical);
        out[logical] = r.ok
          ? { ok: true, key: r.key, name: r.name, rows: r.rows.length, header: r.header, sample: r.rows.slice(0, 3).map(x => x.cells) }
          : { ok: false, reason: r.reason };
      } catch (e) { out[logical] = { ok: false, thrown: String(e && e.message || e) }; }
    }
    return out;
  });

  result.readsBefore = await readAll();

  result.ensure = await page.evaluate(async () => {
    try { return await globalThis.CxxDataStore.ensureSchema(); }
    catch (e) { return { error: String(e && e.message || e) }; }
  });

  result.readsAfter = await readAll();

  const probeKey = 'probe_' + Date.now();
  result.insertProbe = await page.evaluate(async (key) => {
    try {
      const r = await globalThis.CxxDataStore.insert('cxx_pending_tx', {
        row_id: 0, tx_key: key, status: '待处理', state: '待处理',
        events: 'probe', wallet_before: '{"yen":0}', issues: '',
      });
      return { key, result: r };
    } catch (e) { return { key, thrown: String(e && e.message || e) }; }
  }, probeKey);

  result.readBackProbe = await page.evaluate(async (key) => {
    try {
      const r = await globalThis.CxxDataStore.read('cxx_pending_tx');
      if (!r.ok) return { ok: false, reason: r.reason };
      const hit = r.rows.find(x => String(x.cells[1]) === key);
      return { ok: true, rows: r.rows.length, found: !!hit, foundIndex: hit ? hit.index : -1 };
    } catch (e) { return { ok: false, thrown: String(e && e.message || e) }; }
  }, probeKey);

  result.removeProbe = await page.evaluate(async (key) => {
    try {
      const r = await globalThis.CxxDataStore.read('cxx_pending_tx');
      if (!r.ok) return { ok: false, reason: r.reason };
      const hit = r.rows.find(x => String(x.cells[1]) === key);
      if (!hit) return { ok: false, reason: '没有探针行，无需回收' };
      const removed = await globalThis.CxxDataStore.remove('cxx_pending_tx', hit.index);
      const after = await globalThis.CxxDataStore.read('cxx_pending_tx');
      return { ok: !!removed.ok, removed, rowsAfter: after.ok ? after.rows.length : null };
    } catch (e) { return { ok: false, thrown: String(e && e.message || e) }; }
  }, probeKey);

  result.writer = await page.evaluate(async () => {
    const W = globalThis.CxxDataWrite;
    const out = { ready: null, state: null };
    try { out.ready = typeof W?.ready === 'function' ? W.ready() : null; } catch (e) { out.ready = String(e && e.message || e); }
    try { out.state = typeof W?.state === 'function' ? W.state('probe-state') : null; } catch (e) { out.state = String(e && e.message || e); }
    return out;
  });
} catch (error) {
  result.errors.push({ message: String(error && error.stack || error) });
}

await browser.close();
fs.writeFileSync(new URL('../reports/probe-db-write.json', import.meta.url), JSON.stringify(result, null, 2));

const j = v => JSON.stringify(v);
console.log('surface', j(result.surface?.storeTables), 'detect', j(result.detect));
console.log('readsBefore', j(result.readsBefore));
console.log('ensure', j(result.ensure));
console.log('insertProbe', j(result.insertProbe));
console.log('readBack', j(result.readBackProbe), 'remove', j(result.removeProbe));
console.log('writer', j(result.writer));
console.log('globals', j(result.globalNames));
if (result.errors.length) console.log('ERRORS', j(result.errors));
