/** 诊断：真实 ST 原生 Generate('normal') 在请求发出前退出的实际原因。只采集，不改产物。 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:22351';
const fixture = JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json', import.meta.url))).fixture;
const reply = '<cxx-story>ST_NATIVE_NORMAL_GENERATED：本轮只核对原生生成通道，不增加收入。</cxx-story>';

const consoleLines = [];
const requests = [];
const errors = [];
const phases = [];
let phase = 'load';
const mark = name => { phase = name; phases.push({ at: new Date().toISOString(), name }); console.log('STEP ' + name); };

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
page.on('console', m => consoleLines.push({ type: m.type(), text: m.text().slice(0, 900) }));
page.on('pageerror', e => consoleLines.push({ type: 'pageerror', text: (e.stack || e.message).slice(0, 1200) }));
page.on('request', r => { const u = r.url(); if (/chat-completions|generate|\/api\//.test(u)) requests.push({ method: r.method(), url: u.replace(origin, '') }); });

await context.route('https://**/*', r => r.abort());
await context.route('**/api/backends/chat-completions/status', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'synthetic-native' }] }) }));
await context.route('**/api/backends/chat-completions/generate', r => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: reply }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
}));

const result = { at: new Date().toISOString(), origin, fixture, phases, preflight: null, cleaned: null, diag: [], requests, console: consoleLines, capture: {}, signature: {}, errors };

try {
  mark('load');
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false, null, { timeout: 120000 });

  mark('select');
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

  mark('preflight');
  result.preflight = await page.evaluate(async () => {
    const c = SillyTavern.getContext();
    const safe = (fn) => { try { return fn(); } catch (e) { return { error: String(e && e.message || e) }; } };
    return {
      rows: c.chat.length,
      chatId: c.getCurrentChatId(),
      lastIsUser: !!c.chat.at(-1)?.is_user,
      lastMes: String(c.chat.at(-1)?.mes || '').slice(0, 80),
      mainApi: c.mainApi,
      onlineStatus: c.onlineStatus,
      suitePresent: typeof globalThis.TavernRuntimeSuite,
      suiteStatus: safe(() => globalThis.TavernRuntimeSuite?.status?.()),
      bridgePresent: typeof globalThis.CxxContextBridge,
      bridgeStatus: safe(() => globalThis.CxxContextBridge?.status?.()),
      contextApiPresent: typeof globalThis.TavernContext,
      interceptors: {
        suite: typeof globalThis.TavernRuntimeSuite_intercept,
        mirror: typeof globalThis.JingyiTranslator_interceptGeneration,
      },
      generating: safe(() => ({ isSendPress: globalThis.is_send_press ?? null })),
      extensionIds: safe(() => Object.keys(c.extensionSettings || {})),
    };
  });

  mark('clean-pending');
  result.cleaned = await page.evaluate(async () => {
    const c = SillyTavern.getContext();
    const before = c.chat.length;
    const lastUser = !!c.chat.at(-1)?.is_user;
    if (lastUser) await (await import('/script.js')).deleteLastMessage();
    const after = SillyTavern.getContext().chat.length;
    return { before, lastUser, after };
  });

  mark('instrument');
  await page.evaluate(() => {
    const c = SillyTavern.getContext();
    globalThis.__diag = [];
    const simple = a => {
      if (a === null) return null;
      const t = typeof a;
      if (t === 'string' || t === 'number' || t === 'boolean') return a;
      if (Array.isArray(a)) return 'array:' + a.length;
      if (t === 'object') { try { return 'object:' + Object.keys(a).slice(0, 10).join('|'); } catch { return 'object'; } }
      return t;
    };
    const push = (kind, detail) => {
      const stack = String(new Error().stack || '').split('\n').slice(1, 9).join(' <- ');
      globalThis.__diag.push({ at: Date.now(), kind, detail, stack });
    };
    const names = ['GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'GENERATION_AFTER_DATA', 'GENERATION_STOPPED', 'GENERATION_ENDED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY'];
    for (const name of names) {
      const type = c.eventTypes[name];
      if (typeof type === 'string') c.eventSource.on(type, (...args) => push(name, args.slice(0, 2).map(simple)));
    }
    // 直接包裹两个已安装的生成拦截器，记录是否被调用以及是否 abort
    for (const key of ['TavernRuntimeSuite_intercept', 'JingyiTranslator_interceptGeneration']) {
      const original = globalThis[key];
      if (typeof original !== 'function') continue;
      globalThis[key] = function (...args) {
        const abort = args[2];
        let aborted = null;
        push('interceptor-enter', [key, typeof args[1], typeof args[3], (args[0] || []).length]);
        const spy = typeof abort === 'function' ? (immediate) => { aborted = { immediate: immediate === true }; push('interceptor-abort', [key, immediate === true]); return abort(immediate); } : abort;
        const out = original.apply(this, [args[0], args[1], spy, args[3]]);
        return Promise.resolve(out).then(value => { push('interceptor-exit', [key, aborted, value === true]); return value; }, error => { push('interceptor-throw', [key, String(error && error.message || error)]); throw error; });
      };
    }
    // 捕获 toast 与套件 notice
    globalThis.__text = () => ({
      toast: (document.querySelector('#toast-container')?.innerText || '').slice(0, 600),
      notices: Array.from(document.querySelectorAll('.trs-notice,[class*="trs-"][class*="notice"],#trs-notice')).slice(0, 4).map(e => (e.innerText || '').slice(0, 300)),
    });
  });

  mark('connection');
  await page.evaluate(() => {
    const c = SillyTavern.getContext();
    Object.assign(c.chatCompletionSettings, { chat_completion_source: 'custom', custom_url: 'https://fixture.invalid/v1', custom_model: 'synthetic-native', stream_openai: false, openai_max_context: 1000000, openai_max_tokens: 256 });
    const main = document.querySelector('#main_api');
    main.value = 'openai';
    main.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => SillyTavern.getContext().mainApi === 'openai', null, { timeout: 30000 });
  await page.locator('#api_button_openai').evaluate(el => el.click());
  await page.waitForFunction(async () => { const s = await import('/script.js'); return s.online_status !== 'no_connection'; }, null, { timeout: 60000 });

  mark('normal-generate');
  await page.evaluate(() => {
    const box = document.querySelector('#send_textarea');
    box.value = 'ST_NATIVE_NORMAL_REQUEST';
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const requestedAt = requests.length;
  // 网页面板覆盖聊天区，#send_textarea 处于隐藏态；改用其 click 绑定调用的同一函数。
  await page.evaluate(() => {
    globalThis.__sendDone = 'pending';
    (async () => {
      const s = await import('/script.js');
      await s.sendTextareaMessage();
      globalThis.__sendDone = 'resolved';
    })().catch(e => { globalThis.__sendDone = 'rejected:' + String(e && e.message || e); });
  });

  const deadline = Date.now() + 45000;
  let settled = false;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const c = SillyTavern.getContext();
      const last = c.chat.at(-1);
      const kinds = (globalThis.__diag || []).map(e => e.kind);
      return {
        rows: c.chat.length,
        lastIsUser: !!last?.is_user,
        done: !!last && !last.is_user && String(last.mes || '').includes('ST_NATIVE_NORMAL_GENERATED'),
        ended: kinds.includes('GENERATION_ENDED') || kinds.includes('GENERATION_STOPPED'),
        aborted: kinds.includes('interceptor-abort'),
        sendDone: globalThis.__sendDone,
        text: globalThis.__text?.(),
      };
    });
    await page.waitForTimeout(200);
    if (state.done) { settled = true; break; }
    if (state.ended && state.aborted) { settled = true; break; }
    if (state.ended && !state.aborted) { await page.waitForTimeout(1200); settled = true; break; }
  }
  result.capture.settled = settled;
  result.capture.newRequests = requests.slice(requestedAt);
  result.capture.after = await page.evaluate(async () => {
    const c = SillyTavern.getContext();
    const last = c.chat.at(-1);
    const safe = (fn) => { try { return fn(); } catch (e) { return { error: String(e && e.message || e) }; } };
    return {
      rows: c.chat.length,
      lastIsUser: !!last?.is_user,
      lastMes: String(last?.mes || '').slice(0, 200),
      suiteStatus: safe(() => globalThis.TavernRuntimeSuite?.status?.()),
      bridgeStatus: safe(() => globalThis.CxxContextBridge?.status?.()),
      toast: globalThis.__text?.() || null,
    };
  });
  result.diag = await page.evaluate(() => globalThis.__diag || []);

  mark('console-signature');
  const interesting = consoleLines.filter(l => /Generate entered|interceptor|abort|Abort|error|Error|warn|stop|guard|凭据|上下文|Generating|generate/i.test(l.text));
  result.signature = {
    totalConsole: consoleLines.length,
    interesting: interesting.slice(0, 120),
    hasGenerateEntered: consoleLines.some(l => /Generate entered/.test(l.text)),
    hasInterceptorAbort: consoleLines.some(l => /Generation aborted by extension interceptors/.test(l.text)),
  };
} catch (cause) {
  errors.push({ phase, message: cause.stack || String(cause) });
  try { result.capture.page = await page.evaluate(() => ({ url: location.href, body: (document.body?.innerText || '').slice(0, 400) })); } catch { /* 页面已不可用 */ }
} finally {
  await browser.close();
  fs.writeFileSync(new URL('../reports/r4-native-generation-diag.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log('报告已写入 reports/r4-native-generation-diag.json');
  if (errors.length) for (const e of errors) console.log('FAIL ' + JSON.stringify(e).slice(0, 400));
}
