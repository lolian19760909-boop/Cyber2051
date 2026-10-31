'use strict';
// Runs installed ST source with fresh workspace-only data/config/browser state.
// All narrative requests are intercepted in the browser; no model service is called.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const YAML = require('D:/SillyTavern/node_modules/yaml');
const root = path.resolve(__dirname, '../..');
const host = 'D:/SillyTavern';
const out = path.join(root, '.cache/context-s0', `run-${Date.now()}`);
const data = path.join(out, 'st-data');
const port = 16961;
const base = `http://127.0.0.1:${port}`;
const withExtensions = process.argv.includes('--existing-extensions');
const report = { scope: 'isolated real ST / synthetic messages / deterministic transport', withExtensions, requests: [], checks: [], errors: [], externalBlocked: [] };
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
let child, browser, page, phase = 'prepare';
function check(id, condition, details) { assert(condition, id); report.checks.push({ id, pass: true, ...(details ? { details } : {}) }); }
function setup() {
  if (fs.existsSync(path.join(host, 'public/characters'))) throw Error('Host has legacy migration inputs; use a separate source copy.');
  for (const name of ['public/css/user.css', 'public/error']) if (fs.existsSync(path.join(host, name))) throw Error('Host has override migration inputs; use a separate source copy.');
  fs.mkdirSync(data, { recursive: true });
  const config = YAML.parse(fs.readFileSync(path.join(host, 'default/config.yaml'), 'utf8'));
  Object.assign(config, { dataRoot: data, port, listen: false, enableServerPlugins: false, enableServerPluginsAutoUpdate: false, enableDownloadableTokenizers: false });
  config.browserLaunch.enabled = false;
  config.extensions.autoUpdate = false;
  config.extensions.models.autoDownload = false;
  fs.writeFileSync(path.join(out, 'config.yaml'), YAML.stringify(config));
  const extRoot = path.join(data, 'default-user/extensions');
  fs.mkdirSync(extRoot, { recursive: true });
  fs.cpSync(path.join(__dirname, 'fixtures/s0-bridge'), path.join(extRoot, 'cxx-context-s0'), { recursive: true });
  report.extensions = {};
  if (withExtensions) for (const name of ['JS-Slash-Runner', 'ST-Prompt-Template', 'shujuku']) {
    const source = path.join(root, '.cache/memory-p0/st-data/default-user/extensions', name);
    fs.cpSync(source, path.join(extRoot, name), { recursive: true });
    report.extensions[name] = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8')).version;
  }
  report.host = { version: JSON.parse(fs.readFileSync(path.join(host, 'package.json'), 'utf8')).version,
    files: Object.fromEntries(['public/script.js', 'public/scripts/openai.js', 'public/scripts/extensions.js', 'public/scripts/world-info.js'].map(p => [p, hash(fs.readFileSync(path.join(host, p)))])) };
}
async function start() {
  const log = fs.openSync(path.join(out, 'host.stdout.log'), 'a');
  const err = fs.openSync(path.join(out, 'host.stderr.log'), 'a');
  child = spawn(process.execPath, [path.join(host, 'server.js'), '--configPath', path.join(out, 'config.yaml'), '--dataRoot', data, '--port', String(port), '--browserLaunchEnabled', 'false', '--listen', 'false'], { cwd: out, windowsHide: true, stdio: ['ignore', log, err] });
  fs.closeSync(log); fs.closeSync(err);
  let loaded = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw Error(`Host exited ${child.exitCode}`);
    try { const response = await fetch(base, { signal: AbortSignal.timeout(900) }); if (response.ok) { loaded = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(loaded, 'host startup');
  browser = await chromium.launchPersistentContext(path.join(out, 'browser-profile'), { headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', viewport: { width: 1400, height: 1000 } });
  page = browser.pages()[0] || await browser.newPage();
  page.on('pageerror', error => report.errors.push({ phase, error: error.message }));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base && !['data:', 'blob:'].includes(url.protocol)) { report.externalBlocked.push(url.origin + url.pathname); return route.abort(); }
    if (url.pathname === '/api/backends/chat-completions/generate') {
      report.requests.push({ phase, body: request.postDataJSON() });
      return route.fulfill({ json: { choices: [{ message: { role: 'assistant', content: 'S0_SYNTHETIC_REPLY' }, finish_reason: 'stop' }] } });
    }
    return route.continue();
  });
  await page.goto(base);
  await page.waitForFunction(() => window.SillyTavern && window.CxxContextS0 && !document.querySelector('#preloader'), null, { timeout: 60000 });
  if (withExtensions) await page.waitForFunction(() => window.TavernHelper && window.EjsTemplate && window.AutoCardUpdaterAPI, null, { timeout: 60000 });
}
async function prepareCharacter() {
  return page.evaluate(async () => {
    const c = SillyTavern.getContext(), form = new FormData();
    form.append('ch_name', 'CXX Context S0');
    form.append('description', 'S0 synthetic request-chain fixture.');
    form.append('first_mes', 'S0 start');
    const r = await fetch('/api/characters/create', { method: 'POST', headers: c.getRequestHeaders({ omitContentType: true }), body: form });
    if (!r.ok) throw Error(`create character ${r.status}`);
    await c.getCharacters();
    await c.selectCharacterById(c.characters.findIndex(x => x.name === 'CXX Context S0'));
    $('#main_api').val('openai').trigger('change');
    const oai = await import('/scripts/openai.js');
    Object.assign(oai.oai_settings, { chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:16962/v1', custom_model: 's0-fixture', stream_openai: false, openai_max_context: 8192, openai_max_tokens: 256, names_behavior: 0, send_if_empty: '' });
    (await import('/script.js')).setOnlineStatus('S0 deterministic fixture');
    const entry = (uid, content, constant, key) => ({ uid, key: key || [], keysecondary: [], comment: `S0-${uid}`, content, constant, selective: false, order: 100, position: 0, disable: false, excludeRecursion: true, preventRecursion: true, useProbability: false, probability: 100, depth: 4, scanDepth: 100 });
    const book = { entries: { 0: entry(0, 'S0_KEYWORD_WORLDINFO', false, ['S0_OLD_KEY']), 1: entry(1, 'S0_PRIVATE_WORLDINFO', true), 2: entry(2, 'S0_PUBLIC_WORLDINFO', true) } };
    const w = await fetch('/api/worldinfo/edit', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({ name: 'S0Book', data: book }) });
    if (!w.ok) throw Error(`write synthetic worldbook ${w.status}`);
    SillyTavern.getContext().chatMetadata.world_info = 'S0Book';
    await c.saveMetadata();
    return { avatar: c.characters[c.characterId]?.avatar, chat: c.getCurrentChatId() };
  });
}
async function seed(lastAssistant = false) {
  return page.evaluate(async last => {
    const c = SillyTavern.getContext();
    const row = (id, mes, is_user) => ({ name: is_user ? 'S0 User' : 'CXX Context S0', mes, is_user, is_system: false, send_date: '2026-10-18T00:00:00.000Z', extra: { cxx_s0_id: id, unknownField: { preserve: 7 }, reasoning: '' }, ...(is_user ? {} : { swipe_id: 0, swipes: [mes], swipe_info: [{ extra: { cxx_s0_id: id } }] }) });
    const rows = [row('m0', 'S0_OLD_KEY old event.', false), { ...row('hidden', 'S0_SYSTEM_HIDDEN', false), is_system: true }, row('m1', 'S0_REPEAT 同一句话。', true), row('m2', 'S0_OLD_ASSISTANT', false), row('m3', 'S0_REPEAT 同一句话。', true), row('m4', 'S0_RECENT_ASSISTANT', false), row('m5', 'S0_CURRENT_REQUEST', true)];
    if (last) { const item = row('m6', 'S0_CURRENT_BRANCH', false); item.swipes = ['S0_OLD_BRANCH', item.mes]; item.swipe_id = 1; item.swipe_info = [{ extra: { cxx_s0_id: 'm6' } }, { extra: { cxx_s0_id: 'm6' } }]; rows.push(item); }
    c.chat.splice(0, c.chat.length, ...rows);
    await c.saveChat();
    $('#send_textarea').val('');
    return structuredClone(c.chat);
  }, lastAssistant);
}
async function generate(config, type = 'normal') {
  await page.evaluate(config => CxxContextS0.configure(config), config);
  const count = report.requests.length;
  await page.evaluate(async type => { await SillyTavern.getContext().generate(type); }, type);
  const state = await page.evaluate(() => ({ ...structuredClone(CxxContextS0.state), chat: structuredClone(SillyTavern.getContext().chat), metadata: structuredClone(SillyTavern.getContext().chatMetadata) }));
  (report.observations ||= {})[phase] = state;
  const request = report.requests.slice(count).find(r => r.phase === phase);
  return { state, request, text: JSON.stringify(request?.body.messages || request?.body.prompt || []) };
}
(async () => {
  try {
    setup(); console.log(JSON.stringify({ phase, out }));
    phase = 'startup'; await start();
    phase = 'character'; report.character = await prepareCharacter();
    phase = 'baseline'; const before = await seed(); const baseline = await generate({});
    check('baseline-request', !!baseline.request);
    check('native-final-source-ids-absent', baseline.state.ready[0].chat.every(m => !('index' in m) && !('extra' in m) && !('identifier' in m)));
    check('duplicate-dialogue-baseline', baseline.text.split('S0_REPEAT').length - 1 === 2);
    check('baseline-worldinfo', baseline.text.includes('S0_KEYWORD_WORLDINFO') && baseline.text.includes('S0_PRIVATE_WORLDINFO') && baseline.text.includes('S0_PUBLIC_WORLDINFO'));
    check('interceptor-floor-after-hidden-message', baseline.state.traces[0].mapped.find(x => x.id === 'm1').floor === 2 && baseline.state.traces[0].mapped.find(x => x.id === 'm1').index === 1);
    phase = 'compacted'; await seed(); const compacted = await generate({ dropIds: ['m0', 'm1', 'm2'], summary: 'S0_COMPACT_SUMMARY verified past events.' });
    check('actual-old-request-cut', compacted.request && !compacted.text.includes('S0_OLD_KEY') && !compacted.text.includes('S0_OLD_ASSISTANT'));
    check('correct-identical-message-retained', compacted.text.split('S0_REPEAT').length - 1 === 1 && compacted.state.traces[0].mapped.find(x => x.id === 'm3').floor === 4);
    check('summary-once', compacted.text.split('S0_COMPACT_SUMMARY').length - 1 === 1);
    check('cut-before-worldinfo-scan', !compacted.text.includes('S0_KEYWORD_WORLDINFO'));
    check('history-compaction-alone-does-not-hide-constant-secret', compacted.text.includes('S0_PRIVATE_WORLDINFO'));
    // EJS initializes empty variable metadata on the last user floor during any generation.
    // Compare against the uncompressed control, and separately protect every original field.
    check('stored-history-matches-uncompressed-control', JSON.stringify(compacted.state.chat.slice(0, before.length)) === JSON.stringify(baseline.state.chat.slice(0, before.length)));
    check('every-original-history-field-preserved', before.every((message, index) => Object.keys(message).every(key => JSON.stringify(compacted.state.chat[index][key]) === JSON.stringify(message[key]))));
    check('ordered-interceptor-worldinfo-final', compacted.state.order.indexOf('interceptor') < compacted.state.order.indexOf('worldinfo') && compacted.state.order.indexOf('worldinfo') < compacted.state.order.indexOf('prompt-ready'), compacted.state.order);
    phase = 'worldinfo-filter'; await seed(); const filtered = await generate({ dropIds: ['m0', 'm1', 'm2'], summary: 'S0_COMPACT_SUMMARY', hiddenWorldIds: ['S0Book:1'] });
    check('worldinfo-scope-filter', !filtered.text.includes('S0_PRIVATE_WORLDINFO') && filtered.text.includes('S0_PUBLIC_WORLDINFO'));
    phase = 'replace-final-property'; await seed(); const replacement = await generate({ replaceFinalProperty: true });
    check('normal-final-property-replacement-ignored', !replacement.text.includes('S0_REPLACEMENT_PROPERTY') && replacement.text.includes('S0_CURRENT_REQUEST'));
    phase = 'swipe'; await seed(true); const swipe = await generate({ dropIds: ['m0', 'm1', 'm2'], summary: 'S0_COMPACT_SUMMARY' }, 'swipe');
    check('swipe-excludes-current-assistant-source', swipe.request && !swipe.state.traces[0].mapped.some(m => m.id === 'm6') && !swipe.text.includes('S0_CURRENT_BRANCH') && !swipe.text.includes('S0_OLD_BRANCH'));
    phase = 'continue'; await seed(true); const continued = await generate({ dropIds: ['m0', 'm1', 'm2'], summary: 'S0_COMPACT_SUMMARY' }, 'continue');
    check('continue-keeps-selected-swipe', continued.request && continued.text.includes('S0_CURRENT_BRANCH') && !continued.text.includes('S0_OLD_BRANCH') && continued.state.traces[0].mapped.find(m => m.id === 'm6').swipe === 1);
    phase = 'raw-auxiliary'; await page.evaluate(() => CxxContextS0.configure({ dropIds: ['m0'], summary: 'S0_BAD_AUX_SUMMARY' }));
    const raw = await page.evaluate(async () => { const data = await SillyTavern.getContext().generateRawData({ prompt: [{ role: 'user', content: 'S0_AUXILIARY' }] }); return { data, traces: CxxContextS0.state.traces }; });
    check('raw-auxiliary-bypasses-history-interceptor', raw.traces.length === 0 && !JSON.stringify(raw.data).includes('S0_BAD_AUX_SUMMARY'));
    phase = 'unmapped-abort'; await seed(); await page.evaluate(() => { delete SillyTavern.getContext().chat[0].extra.cxx_s0_id; }); const unmapped = await generate({ dropIds: ['m0'] });
    check('unmapped-message-stops-test-compaction', !unmapped.request && unmapped.state.traces[0].aborted);
    phase = 'cleanup'; await page.evaluate(async () => { await (await import('/scripts/extensions/third-party/cxx-context-s0/index.js')).clean(); });
    check('clean-removes-probe', await page.evaluate(() => !window.CxxContextS0 && !window.CxxContextS0_intercept));
    report.samples = { baseline: baseline.state, compacted: compacted.state, filtered: filtered.state, swipe: swipe.state, continued: continued.state };
    report.pass = true;
  } catch (error) {
    report.failure = { phase, message: error.stack }; process.exitCode = 1;
    if (page) report.visibleFailure = (await page.locator('body').innerText().catch(() => '')).slice(-12000);
  } finally {
    if (page) await page.screenshot({ path: path.join(out, 'host.png') }).catch(() => {});
    if (browser) await browser.close();
    if (child && child.exitCode === null) child.kill();
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass || false, checks: report.checks.length, requests: report.requests.length, failure: report.failure, errors: report.errors, out }));
  }
})();
