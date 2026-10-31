/** 探针：切回后网页节点数比磁盘少一个 —— 直接看磁盘节点表与 head 链的关系，判断是"离线分支"还是"丢节点"。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const fixture = JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url))).fixture;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const out = { at: new Date().toISOString(), errors: [], disk: null, web: null, chain: null };
page.on('pageerror', e => out.errors.push(String((e && e.stack) || e).slice(0, 600)));
await context.route('https://**/*', r => r.abort());

async function dialogs() {
  const ok = page.locator('dialog[open] .popup-button-ok,dialog[open] .popup-button-yes,dialog[open].cxx-announcement button').last();
  if (await ok.isVisible().catch(() => false)) await ok.click({ timeout: 500 }).catch(() => {});
  const h = page.locator('.TH-popup').filter({ hasText: fixture.avatar }).filter({ hasText: '嵌入式脚本' });
  if (await h.isVisible().catch(() => false)) await h.getByRole('button', { name: '确认', exact: true }).click({ timeout: 500 }).catch(() => {});
}
async function operation(fn, arg) {
  let done = false, value, failure;
  page.evaluate(fn, arg).then(v => { done = true; value = v; }, e => { done = true; failure = e; });
  const until = Date.now() + 90000;
  while (!done && Date.now() < until) { await dialogs(); await new Promise(r => setTimeout(r, 100)); }
  if (!done) throw Error('90 秒未结束');
  if (failure) throw failure;
  return value;
}

await page.goto(origin);
await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false);
await operation(async ({ avatar, chatId }) => {
  let c = SillyTavern.getContext();
  await c.getCharacters();
  c = SillyTavern.getContext();
  const id = c.characters.findIndex(r => r.avatar === avatar);
  if (id < 0) throw Error('找不到隔离测试卡');
  await c.selectCharacterById(id);
  await SillyTavern.getContext().openCharacterChat(chatId);
}, { avatar: fixture.avatar, chatId: fixture.chatId });
await page.waitForFunction(() => globalThis.Cxx233Updater?.whenIdle && globalThis.Cxx236VariableGuard?.state?.().ready, null, { timeout: 120000 });
await operation(() => globalThis.Cxx233Updater.whenIdle());

out.disk = await page.evaluate(() => {
  const doc = SillyTavern.getContext().chatMetadata.cxx2051_web || {};
  const nodes = (doc.nodes || []).map(n => ({
    nodeId: n.nodeId, parentId: n.parentId || null, floor: n.nativeFloor ?? n.floor ?? null,
    kind: n.message?.kind || null, len: String(n.message?.raw || '').length,
    head: String(n.message?.raw || '').slice(0, 40), operationId: n.operationId || null,
  }));
  const byId = new Map(nodes.map(n => [n.nodeId, n]));
  const chain = []; const seen = new Set(); let id = doc.run?.headNodeId;
  while (id && byId.has(id) && !seen.has(id)) { seen.add(id); chain.push(id); id = byId.get(id).parentId; }
  return { chatId: SillyTavern.getContext().chatId, headNodeId: doc.run?.headNodeId || null, revision: doc.run?.revision ?? null, total: nodes.length, nodes, chain: chain.reverse() };
});

await page.evaluate(async () => { await (await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs')).openWeb(); });
let frame = null;
for (let i = 0; i < 600 && !frame; i++) {
  const candidate = page.frames().find(f => f.url().includes('/third-party/Cyber2051-Web/app/'));
  if (candidate) { const ready = await candidate.evaluate(() => !!(globalThis.CxxWebApp?.session && globalThis.CxxWebApp?.ui)).catch(() => false); if (ready) frame = candidate; }
  if (!frame) await page.waitForTimeout(250);
}
if (!frame) throw Error('网页未就绪');
out.web = await frame.evaluate(() => ({ total: CxxWebApp.session.nodes.length, ids: CxxWebApp.session.nodes.map(n => n.nodeId) }));

const chainSet = new Set(out.disk.chain);
out.chain = {
  chainIds: out.disk.chain.map(id => id.slice(0, 6)),
  offChain: out.disk.nodes.filter(n => !chainSet.has(n.nodeId)).map(n => ({ id: n.nodeId.slice(0, 6), parent: n.parentId ? n.parentId.slice(0, 6) : null, len: n.len, kind: n.kind, head: n.head })),
  webMissing: out.disk.chain.filter(id => !out.web.ids.includes(id)).map(id => id.slice(0, 6)),
  webExtra: out.web.ids.filter(id => !out.disk.nodes.some(n => n.nodeId === id)).map(id => id.slice(0, 6)),
};
fs.writeFileSync(new URL('../reports/probe-nodes.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('head', out.disk.headNodeId?.slice(0, 6), 'rev', out.disk.revision, 'diskNodes', out.disk.total, 'chain', out.disk.chain.length, 'web', out.web.total);
console.log('offChain', JSON.stringify(out.chain.offChain));
console.log('webMissing', out.chain.webMissing, 'webExtra', out.chain.webExtra);
console.log('errors', out.errors.slice(0, 2));
await browser.close();
