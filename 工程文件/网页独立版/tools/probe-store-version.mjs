/** 探针四：确认页面实际加载的 store.js 是哪一个字节版本。只读。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const out = { at: new Date().toISOString(), fetched: null, live: null, errors: [] };
page.on('pageerror', e => out.errors.push(String((e && e.stack) || e).slice(0, 400)));
await context.route('https://**/*', r => r.abort());

try {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false, null, { timeout: 120000 });
  out.fetched = await page.evaluate(async () => {
    const url = '/scripts/extensions/third-party/Cyber2051-Web/app/card/' + encodeURIComponent('数据') + '/store.js';
    const response = await fetch(url, { cache: 'no-store' });
    const text = await response.text();
    return {
      url, status: response.status, bytes: text.length,
      hasWriteNames: /function writeNames/.test(text),
      hasProbe: /已试/.test(text),
      head: text.slice(0, 160),
      tail: text.slice(-160),
    };
  });
  out.live = await page.evaluate(() => {
    const fn = globalThis.CxxDataStore?.insert;
    return {
      hasStore: !!globalThis.CxxDataStore,
      keys: Object.keys(globalThis.CxxDataStore || {}),
      insertSource: fn ? String(fn).replace(/\s+/g, ' ').slice(0, 700) : null,
      rejectText: fn ? /已试/.test(String(fn)) : null,
    };
  });
} catch (error) {
  out.errors.push('fatal: ' + String((error && error.stack) || error).slice(0, 800));
}
await browser.close();
fs.writeFileSync(new URL('../reports/probe-store-version.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 2600));
