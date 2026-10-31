'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('../../独立制卡器/workbench/node_modules/playwright');
const { extract } = require('../../工具/lib/script-modules.cjs');
const build = require('../../工具/构建/当前/build.cjs');
const file = process.env.CXX_TEST_CARD || build.output;
const out = process.env.CXX_EVIDENCE || path.join(build.root, '.cache/backend-performance');
const bytes = fs.readFileSync(file), card = JSON.parse(bytes);
const all = card.data.extensions.tavern_helper.scripts.map(s => s.content).join('\n;\n');
const modules = extract(all, ['CxxDataClone', 'CxxItemArt', 'CxxPlayerReader', 'CxxReadingGuard', 'CxxMirrorSource']);
const summary = samples => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { n: samples.length, p50: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * .95) - 1] };
};
const report = {
  scope: 'Isolated Edge, packaged modules, synthetic chats and in-memory disk/Mirror API; no real host or player data',
  card: { file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') },
  cases: [], errors: [],
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    report.browser = browser.version();
    for (const floors of [50, 500, 2000]) {
      const page = await browser.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      await page.addScriptTag({ content: modules.map(m => m.source).join('\n;\n') });
      const result = await page.evaluate(async floors => {
        const prose = '雨夜里核对街道与同伴的位置。'.repeat(250);
        const chat = Array.from({ length: floors }, (_, i) => ({
          mes: i + prose, swipe_id: 0, is_user: false,
          variables: [{ stat_data: { terminal: { wallet: { yen: i }, gameplay: { growth: {} } } } }],
        }));
        const c = { characterId: 0, characters: [{ avatar: 'fixture.png' }], getCurrentChatId: () => 'fixture',
          chat, chatMetadata: { variables: {} }, eventTypes: {} };
        const api = { SillyTavern: { getContext: () => c }, getVariables: () => c.chatMetadata.variables };
        let requests = 0, reads = 0, watch;
        const top = { setInterval: () => 1, clearInterval() {}, __JINGYI__: { features: ['reading'], reading: {
          apiVersion: 2, status: () => ({ apiVersion: 2 }), onChange: () => () => {},
          get: async ({ messageId, swipeId }) => {
            requests++;
            return { schema: 1, state: 'ready', sourceMessage: chat[messageId].mes,
              sourceRevision: 'source', readingRevision: 'reading', segments: [],
              owner: { chatId: 'fixture', messageId, swipeId } };
          },
        } } };
        const runtime = { key: () => 'fixture.png:fixture', scheduleMessages() {}, watchMessages(fn) { watch = fn; return () => {}; } };
        const source = CxxMirrorSource.create({ api, top, runtime }).start();
        await source.prime();
        const disk = structuredClone([{ chat_metadata: c.chatMetadata }, ...chat]);
        const read = CxxPlayerReader.create({ api, readDisk: async () => { reads++; return structuredClone(disk); } });
        await read();
        const stringify = JSON.stringify;
        let serialized = 0;
        JSON.stringify = function (...args) { const value = stringify.apply(this, args); serialized += value?.length || 0; return value; };
        const cases = [];
        try {
          for (const mode of ['source-cache', 'source-notification', 'player-read-reuse']) {
            serialized = 0;
            const samples = [], before = { requests, reads };
            for (let i = 0; i < 20; i++) {
              const start = performance.now();
              if (mode === 'source-cache') for (let floor = 0; floor < floors; floor++) {
                if (!source.peek(floor)?.ok) throw Error('Cache miss');
              }
              else if (mode === 'source-notification') watch({ full: false, floors: [floors - 1], reasons: ['source'] });
              else await read({ reuse: true });
              samples.push(performance.now() - start);
            }
            cases.push({ mode, samples, serializedCharacters: serialized, requests: requests - before.requests, reads: reads - before.reads });
          }
        } finally { JSON.stringify = stringify; source.destroy(); }
        return cases;
      }, floors);
      for (const { samples, ...item } of result) {
        assert.equal(item.requests, 0); assert.equal(item.reads, 0);
        report.cases.push({ floors, ...item, elapsedMs: summary(samples) });
      }
      await page.close();
    }
    assert.deepEqual(report.errors, []);
    report.pass = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    await browser?.close();
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  }
})();
