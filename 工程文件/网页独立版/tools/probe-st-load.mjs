/** 探针五：换卡后 selectCharacter/openCharacterChat 卡住的原因。采集控制台、异常、弹窗文本与全局就绪标志。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const fixture = JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url))).fixture;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const out = { at: new Date().toISOString(), console: [], errors: [], stages: {}, state: null };
page.on('console', m => { const t = m.text(); if (!/Thumbnails|favicon/i.test(t) && out.console.length < 400) out.console.push({ type: m.type(), text: t.slice(0, 400) }); });
page.on('pageerror', e => out.errors.push(String((e && e.stack) || e).slice(0, 800)));
await context.route('https://**/*', r => r.abort());

async function snapshot(label) {
  out.stages[label] = await page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('dialog[open], .TH-popup, #dialogue_popup')].map(node => ({ tag: node.tagName, cls: node.className, text: (node.innerText || '').slice(0, 200) }));
    const c = globalThis.SillyTavern?.getContext?.();
    return {
      url: location.pathname,
      ready: document.querySelector('#cxx2051-open-web')?.disabled,
      hasUpdater: !!globalThis.Cxx233Updater, hasGuard: !!globalThis.Cxx236VariableGuard, hasStore: !!globalThis.CxxDataStore,
      guardReady: globalThis.Cxx236VariableGuard?.state?.().ready,
      generating: c?.generating, chatLength: c?.chat?.length, characterId: c?.characterId, characters: c?.characters?.length,
      dialogs,
      toast: [...document.querySelectorAll('#toast-container > *')].map(n => (n.innerText || '').slice(0, 160)).slice(0, 6),
    };
  }).catch(error => ({ snapshotError: String((error && error.message) || error) }));
}

try {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false, null, { timeout: 120000 });
  await snapshot('page-ready');

  const selected = page.evaluate(async ({ avatar, chatId }) => {
    let c = SillyTavern.getContext();
    await c.getCharacters();
    c = SillyTavern.getContext();
    const id = c.characters.findIndex(r => r.avatar === avatar);
    if (id < 0) return { stage: 'character-missing', listing: c.characters.map(r => r.avatar).slice(0, 8) };
    await c.selectCharacterById(id);
    const opened = await SillyTavern.getContext().openCharacterChat(chatId);
    return { stage: 'opened', opened: String(opened) };
  }, fixture);
  const raced = await Promise.race([selected, new Promise(resolve => setTimeout(() => resolve({ stage: 'timeout' }), 90000))]);
  out.stages['select-result'] = raced;
  if (raced.stage === 'timeout') await snapshot('after-timeout');
  else await snapshot('after-open');
} catch (error) {
  out.errors.push('fatal: ' + String((error && error.stack) || error).slice(0, 1200));
  await snapshot('after-fatal').catch(() => {});
}
await browser.close();
fs.writeFileSync(new URL('../reports/probe-st-load.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('## stages', JSON.stringify(out.stages, null, 1).slice(0, 2600));
console.log('## errors', JSON.stringify(out.errors).slice(0, 1200));
console.log('## console tail', JSON.stringify(out.console.slice(-18), null, 1).slice(0, 2400));
