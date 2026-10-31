/** C1：空正文重试期间点“中断”，确认停的是正在跑的那次生成，且不写存档。 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

// 夹具聊天属于哪个角色，就打开哪个角色：把 avatar 与 chatId 拆成两件独立的事会得到“A 的角色 + B 的聊天”。
const CHATS_ROOT = 'D:/deepseek harness Coding/赛博小祥2051/工程文件/.cache/web-host-20261025/data-clean/default-user/chats';
const CHAT_ID = (process.argv.find(value => value.startsWith('--chat='))?.slice(7)) || JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url), 'utf8')).fixture.chatId;
const dirArg = process.argv.find(value => value.startsWith('--dir='))?.slice(6) || null;
const AVATAR = dirArg || fs.readdirSync(CHATS_ROOT, { withFileTypes: true }).filter(row => row.isDirectory() && fs.existsSync(CHATS_ROOT + '/' + row.name + '/' + CHAT_ID + '.jsonl')).map(row => row.name)[0] || 'WEB_HOST_TEST_1792928536359';
let CHAT_DIR = CHATS_ROOT + '/' + AVATAR;
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
const diskFile = () => {
  const path = CHAT_DIR + '/' + CHAT_ID + '.jsonl';
  return fs.existsSync(path) ? path : null;
};

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error.message || error).slice(0, 300)));

const requests = [];
await page.route('**/api/backends/chat-completions/generate', async route => {
  const body = route.request().postDataJSON() ?? {};
  const stream = body.stream === true;
  const text = JSON.stringify(body.messages ?? body.prompt ?? '');
  requests.push({ index: requests.length + 1, stream, at: Date.now(), second: requests.length + 1 >= 3, promptHasRetryText: text.includes('继续下一步'), url: route.request().url(), bodyHead: text.slice(0, 80) });
  const sse = frames => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: frames });
  if (requests.length >= 2) return sse('data: ' + JSON.stringify({ choices: [{ delta: { content: '<cxx-story>C1_STOP_OK</cxx-story>' } }] }) + '\n\ndata: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  if (requests.length === 1) return sse('data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  return sse('data: ' + JSON.stringify({ choices: [{ delta: { content: '<cxx-story>C1_STOP_OK</cxx-story>' } }] }) + '\n\ndata: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
});

const apiLog = [];
page.on('request', req => { const url = req.url(); if (!url.includes('/api/')) return; apiLog.push({ at: Date.now(), method: req.method(), url: url.slice(-70), kind: (req.resourceType?.() ?? '') }); });
page.on('response', res => { const url = res.url(); if (!url.includes('/api/')) return; if (apiLog.length < 400) apiLog.push({ at: Date.now(), status: res.status(), url: url.slice(-70), resp: true }); });

const snapshot = (file, label) => {
  if (!file) return null;
  fs.copyFileSync(file, '.cache/c1-chat-' + label + '.jsonl');
  return '.cache/c1-chat-' + label + '.jsonl';
};
const metaDiff = (a, b) => {
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8').split(String.fromCharCode(10))[0] || '{}');
  const left = read(a), right = read(b), out = [];
  const walk = (x, y, path) => {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (!x || !y || typeof x !== 'object' || typeof y !== 'object') { out.push(path + ': ' + JSON.stringify(x)?.slice(0, 60) + ' -> ' + JSON.stringify(y)?.slice(0, 60)); return; }
    for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[key], y[key], path + "/" + key);
  };
  walk(left, right, '');
  return out.slice(0, 40);
};
const report = { requests, apiLog, patch: null, before: null, stop: null, after: null, second: null, poll: [], errors };
const FRAME = () => document.getElementById('cxx2051-web-panel')?.querySelector('iframe');
const readStatus = () => page.evaluate(() => document.getElementById('cxx2051-web-panel')?.querySelector('iframe')?.contentDocument?.getElementById('status-line')?.textContent ?? null);
const readBusy = () => page.evaluate(() => document.getElementById('cxx2051-web-panel')?.querySelector('iframe')?.contentWindow?.CxxWebApp?.read?.()?.busy ?? null);
const clickIn = id => page.evaluate(name => document.getElementById('cxx2051-web-panel')?.querySelector('iframe')?.contentDocument?.getElementById(name)?.click(), id);
const sendIn = text => page.evaluate(value => {
  const win = document.getElementById('cxx2051-web-panel')?.querySelector('iframe')?.contentWindow;
  const doc = win?.document; if (!doc) return false;
  const input = doc.getElementById('input'); input.value = value;
  input.dispatchEvent(new (win.Event)('input', { bubbles: true }));
  doc.getElementById('send')?.click();
  return true;
}, text);

try {
  await page.goto('http://127.0.0.1:22351');
  await page.waitForFunction(() => typeof SillyTavern?.getContext === 'function', null, { timeout: 60000 });
  await page.waitForFunction(() => { const button = document.querySelector('#cxx2051-open-web'); return !!button && !button.disabled; }, null, { timeout: 120000 });
  const chat = await page.evaluate(async fixture => {
    const context = SillyTavern.getContext();
    await context.getCharacters();
    let index = fixture.avatar ? context.characters.findIndex(row => row.avatar === fixture.avatar + '.png') : -1;
    if (index < 0) index = context.characters.findIndex(row => /^WEB_HOST_TEST_.*\.png$/.test(row.avatar));
    if (index < 0) return { selected: false };
    await context.selectCharacterById(index);
    const live = SillyTavern.getContext();
    if (fixture.id && live.getCurrentChatId?.() !== fixture.id) await live.openCharacterChat(fixture.id);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const now = SillyTavern.getContext();
    return { selected: true, avatar: now.characters[now.characterId]?.avatar ?? null, chatId: now.getCurrentChatId?.() ?? null, rows: now.chat?.length ?? 0 };
  }, { id: CHAT_ID, avatar: dirArg ?? null });
  report.chat = chat;
  // 磁盘快照必须跟着真正打开的角色走；否则快照目录与宿主聊天目录不是同一个角色，行数对不上。
  if (chat.avatar) CHAT_DIR = CHATS_ROOT + '/' + String(chat.avatar).replace(/\.png$/, '');
  report.chatDir = CHAT_DIR;
  report.diskFile = diskFile();
  for (let index = 0; index < 6; index++) {
    await page.evaluate(() => {
      for (const scope of [...document.querySelectorAll('dialog[open],.TH-popup')]) {
        const buttons = [...scope.querySelectorAll('button,input[type=button]')].filter(node => node.offsetParent !== null);
        const dismiss = buttons.filter(node => /确定|确认|知道了|关闭|好的|OK|继续/i.test(node.textContent || node.value || '')).pop();
        (dismiss || buttons.pop())?.click();
      }
    });
    await page.waitForTimeout(150);
  }
  report.patch = await page.evaluate(() => {
    const helper = globalThis.TavernHelper;
    if (!helper?.generateRaw || !helper?.stopGenerationById) return { ok: false, reason: 'helper_missing' };
    const generate = helper.generateRaw.bind(helper);
    const stop = helper.stopGenerationById.bind(helper);
    const seen = window.__c1 = { generate: [], stop: [], stacks: [] };
    helper.generateRaw = async args => { seen.generate.push(String(args?.generation_id)); seen.stacks.push(String(new Error().stack || '').split('\n').slice(1, 5).join(' | ')); return generate(args); };
    helper.stopGenerationById = id => { seen.stop.push(String(id)); return stop(id); };
    return { ok: true };
  });
  let open = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    open = await page.evaluate(async () => {
      try { const extension = await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs'); await extension.openWeb(); return { ok: true }; }
      catch (cause) { return { ok: false, code: cause?.code ?? null, message: String(cause?.message || cause) }; }
    });
    if (open.ok || open.code !== 'host_loading') break;
    await page.waitForTimeout(2500);
  }
  report.open = open;
  if (!open.ok) throw new Error('openWeb failed: ' + open.message);
  // 面板与 iframe 的启动阶段都要留痕：打不开与打不开的原因不能混成一个超时。
  report.bootTrace = [];
  for (let round = 0; round < 36; round += 1) {
    const state = await page.evaluate(() => {
      const panel = document.getElementById('cxx2051-web-panel');
      const frame = panel?.querySelector('iframe');
      let app = null;
      try { app = frame?.contentWindow?.CxxWebApp?.read?.() ?? null; } catch (cause) { app = { readError: String(cause?.message || cause) }; }
      const inner = frame?.contentDocument;
      return { panel: !!panel, booted: app?.booted ?? null, phase: app?.phase ?? null, mode: app?.mode ?? null, readError: app?.readError ?? null, status: String(inner?.querySelector('#status-line')?.textContent || '').slice(0, 160), composerHidden: inner?.querySelector('.composer')?.hidden ?? null, stageChars: (inner?.querySelector('#stage')?.textContent || '').length, dialogs: [...document.querySelectorAll('dialog[open],.TH-popup')].map(node => String(node.innerText || '').slice(0, 60)) };
    });
    if (round === 0 || state.booted === true || round % 6 === 0) report.bootTrace.push({ at: round * 5, ...state });
    if (state.booted === true) break;
    await page.waitForTimeout(5000);
  }
  if (!report.bootTrace.some(row => row.booted === true)) throw new Error('iframe 未完成启动：' + JSON.stringify(report.bootTrace));
  const file = diskFile();
  await page.evaluate(() => {
    const host = globalThis.Cxx2051WebHost;
    const log = globalThis.__cxxErrLog = [];
    if (!host) return;
    for (const key of ['read', 'write', 'writeTask', 'generate', 'ready', 'assertScope']) {
      const fn = host[key];
      if (typeof fn !== 'function') continue;
      host[key] = (...args) => {
        try { log.push({ key, phase: 'enter', at: Date.now() }); const out = fn(...args); if (out && typeof out.then === 'function') return out.then(value => { log.push({ key, phase: 'exit', at: Date.now() }); return value; }, cause => { log.push({ key, phase: 'error', at: Date.now(), code: cause?.code ?? null, message: String(cause?.message || cause).slice(0, 200), busy: globalThis.Cxx233Updater?.host?.getContext?.().busy === true, stack: String(cause?.stack || '').slice(0, 300) }); throw cause; }); return out; }
        catch (cause) { log.push({ key, sync: true, code: cause?.code ?? null, message: String(cause?.message || cause).slice(0, 200), stack: String(cause?.stack || '').slice(0, 300) }); throw cause; }
      };
    }
  });
  report.snapshot = snapshot(file, 'before');
  report.before = {
    rows: await page.evaluate(() => SillyTavern.getContext().chat?.length ?? 0),
    disk: file ? sha(file) : null,
    status: await readStatus(),
  };
  await sendIn('继续');
  await page.waitForFunction(() => window.__c1?.generate?.length >= 1, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__c1?.generate?.length >= 2, null, { timeout: 120000 });
  await page.waitForTimeout(700);
  await clickIn('stop');
  await page.waitForFunction(() => window.__c1.stop.length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  report.stop = await page.evaluate(() => ({ generate: window.__c1.generate, stop: window.__c1.stop, diagnostics: globalThis.Cxx2051WebHost?.diagnostics?.() ?? null }));
  report.snapshotAfter = snapshot(file, 'after');

  report.after = {
    rows: await page.evaluate(() => SillyTavern.getContext().chat?.length ?? 0),
    disk: file ? sha(file) : null,
    status: await readStatus(),
    busy: await readBusy(),
  };
  report.metaDiff = report.snapshot && report.snapshotAfter ? metaDiff(report.snapshot, report.snapshotAfter) : null;
  report.snapshotBefore = snapshot(file, 'retry');
  await sendIn('继续下一步');
  for (let tick = 0; tick < 20; tick++) {
    await page.waitForTimeout(3000);
    const hostState = await page.evaluate(() => { const c = globalThis.Cxx233Updater?.host?.getContext?.() ?? null; const st = SillyTavern.getContext(); return { cardBusy: c?.busy ?? null, stGenerating: st?.isGenerating ?? null, online: c?.onlineStatus ?? null }; });
    const row = { tick, requests: requests.length, rows: await page.evaluate(() => SillyTavern.getContext().chat?.length ?? 0), busy: await readBusy(), ...hostState, status: await readStatus(), generate: await page.evaluate(() => window.__c1.generate.slice()) };
    report.poll.push(row);
    if (row.rows >= (report.before?.rows ?? 0) + 2) break;
  }
  report.second = {
    requests: requests.length,
    rows: await page.evaluate(() => SillyTavern.getContext().chat?.length ?? 0),
    disk: file ? sha(file) : null,
    status: await readStatus(),
    generate: await page.evaluate(() => window.__c1.generate),
    stacks: await page.evaluate(() => window.__c1.stacks),
    marks: await page.evaluate(() => (globalThis.__cxxTurnMark || []).slice(-40)),
    busyLog: await page.evaluate(() => globalThis.__cxxBusyLog ?? null),
    errLog: await page.evaluate(() => globalThis.__cxxErrLog ?? null),
  };
  report.verdict = {
    retried: (report.stop?.generate?.length ?? 0) === 2,
    distinctIds: report.stop?.generate?.[0] !== report.stop?.generate?.[1],
    stopStoppedActiveId: report.stop?.generate?.[1] === report.stop?.stop?.[0],
    phaseStopped: report.stop?.diagnostics?.generationPhase === 'stopped',
    noWrite: report.after?.rows === report.before?.rows && (report.metaDiff ?? []).every(row => row.startsWith('/chat_metadata/')),
    secondCommitted: (report.second?.rows ?? 0) >= (report.before?.rows ?? 0) + 2 && report.second?.disk !== report.after?.disk,
  };
  report.ok = Object.values(report.verdict).every(Boolean);
} catch (cause) {
  report.failure = String(cause?.message || cause).slice(0, 600);
} finally {
  await browser.close();
}
if (!report.ok) report.errors = report.errors.concat(errors).slice(0, 6);
fs.writeFileSync('reports/c1-stop-id.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, verdict: report.verdict, failure: report.failure ?? null, stop: report.stop && { generate: report.stop.generate, stop: report.stop.stop, phase: report.stop.diagnostics?.generationPhase }, before: report.before, after: report.after, second: report.second && { rows: report.second.rows, disk: report.second.disk, status: report.second.status }, errors: report.errors.slice(0, 4) }, null, 2));