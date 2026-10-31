/**
 * 资源包缓存检查：断点续传、瞬时故障重试、跨刷新续传、旧版本回收、累计进度、已完成免下载。
 *
 * 为什么必须跑：续传的正确性只能靠真实的 Service Worker + Cache Storage + 真实断流验证；
 * 纯逻辑单测无法覆盖 Range 语义、Cache 落盘时机和 SW 生命周期。
 * 为什么每步都带超时：Service Worker 里的死循环不会抛错，只会把事件循环一起卡住，
 * 所以每次页面求值都必须有上限，卡住时要能说出卡在哪一步。
 * 运行：node 工程文件/网页独立版/tools/cache-resume-check.mjs
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, '..', '..');
const WORKER = join(HERE, '..', 'src', 'assets', 'cache-worker.mjs');
const RECEIPT = join(PROJECT, '.cache', 'play-loading-20261027', 'checks', 'cache-resume.json');
const require = createRequire(import.meta.url);
const { writePack } = require(join(PROJECT, '工具', 'lib', 'resource-pack.cjs'));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => existsSync(p));
if (!EDGE) { console.error('未找到系统 Edge，无法执行浏览器检查'); process.exit(2); }
const CACHE = 'cxx2051-official-media-v1';
const sha = data => createHash('sha256').update(data).digest('hex');
const T0 = Date.now();
const trace = (...args) => console.log('[' + String(Date.now() - T0).padStart(6) + 'ms]', ...args);
const withTimeout = (promise, ms, label) => { let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('超时 ' + ms + 'ms：' + label), { timeout: true })), ms); })]).finally(() => clearTimeout(timer)); };
const evaluate = (tab, fn, arg, label, ms = 90000) => withTimeout(tab.evaluate(fn, arg), ms, label);

const dir = await mkdtemp(join(tmpdir(), 'cxx-cache-'));
/** 造一份资源包夹具：全 stored ZIP，条目 id 是内容摘要，包 id 是条目清单摘要（与 player-pack-build.mjs 同构）。 */
async function makePack(version, count, size) {
  const fixtures = new Map();
  for (let i = 0; i < count; i += 1) { const data = randomBytes(size); const id = sha(data); fixtures.set(id, { id, mime: 'image/png', bytes: data.length, data }); }
  const entries = [...fixtures.values()].map(({ id, mime, bytes }) => ({ id, mime, bytes, file: id + '.png', aliases: [] })).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const id = sha(Buffer.from(JSON.stringify(entries)));
  const manifest = { schema: 1, version, id, baseUrl: '/resources/' + version + '/' + id + '/', entries };
  const file = join(dir, version + '.zip');
  const receipt = await writePack(file, { manifest, files: fixtures });
  const zip = await readFile(file);
  return { entries, manifest, id, zip, config: { ...manifest, download: '/resources/' + version + '/' + id + '/pack.zip', bytes: receipt.bytes, sha256: sha(zip), resourceBytes: entries.reduce((n, e) => n + e.bytes, 0) } };
}
const A = await makePack('9.9.9-a', 30, 48 * 1024);
const B = await makePack('9.9.9-b', 31, 48 * 1024);
const C = await makePack('9.9.9-c', 72, 8 * 1024);
const D = await makePack('9.9.9-d', 64, 48 * 1024);
const zip = A.zip, packId = A.id, COUNT = A.entries.length, config = A.config;
const packs = { 1: A.config, 2: B.config, 3: C.config, 4: D.config };
const workerSource = await readFile(WORKER, 'utf8');
trace('夹具 A ' + COUNT + ' 条 / ' + A.zip.length + ' 字节；夹具 B ' + B.entries.length + ' 条 / ' + B.zip.length + ' 字节；包 id ' + packId.slice(0, 12) + ' / ' + B.id.slice(0, 12));

// 夹具页面：和 src/assets/prepare.mjs 走同一套 register / MessageChannel / prepare 协议。
const pageScript = [
  'window.__report = { events: [], error: null, done: false };',
  'window.__trace = [];',
  'const mark = step => window.__trace.push(step + "@" + Math.round(performance.now()));',
  'const CACHE_NAME = ' + JSON.stringify(CACHE) + ';',
  'window.runPrepare = index => new Promise(async resolve => {',
  '  window.__report = { events: [], error: null, done: false };',
  '  window.__trace = [];',
  '  try {',
  '    mark("fetch-config");',
  '    const config = await (await fetch("/data/player-pack-" + index + ".json", { cache: "no-store" })).json();',
  '    mark("register");',
  '    const registration = await navigator.serviceWorker.register("/resource-worker.js", { scope: "/" });',
  '    mark("awaiting-ready");',
  '    await navigator.serviceWorker.ready;',
  '    mark("ready");',
  '    if (!navigator.serviceWorker.controller) {',
  '      mark("awaiting-controller");',
  '      await new Promise(r => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));',
  '      mark("controller");',
  '    }',
  '    const channel = new MessageChannel();',
  '    channel.port1.onmessage = ({ data }) => {',
  '      mark("msg:" + data.stage + (data.error ? ":" + data.error : ""));',
  '      if (data.stage === "done") { window.__report.done = true; resolve(window.__report); }',
  '      else if (data.stage === "error") { window.__report.error = { message: data.message, retryable: Boolean(data.retryable) }; resolve(window.__report); }',
  '      else window.__report.events.push(data);',
  '    };',
  '    mark("postMessage");',
  '    registration.active.postMessage({ type: "prepare", config: { ...config, baseUrl: new URL("/", location.href).href } }, [channel.port2]);',
  '  } catch (error) { mark("threw"); window.__report.error = { message: String((error && error.message) || error), crash: true }; resolve(window.__report); }',
  '});',
  'window.cacheState = async () => {',
  '  const cache = await caches.open(CACHE_NAME), out = { blob: 0, complete: [], progress: [], config: 0 };',
  '  for (const request of await cache.keys()) {',
  '    const path = new URL(request.url).pathname, at = path.indexOf("__cxx_media__/");',
  '    if (at < 0) continue;',
  '    const parts = path.slice(at + 14).split("/"), kind = parts[0], id = decodeURIComponent(parts.slice(1).join("/"));',
  '    if (kind === "blob") out.blob += 1;',
  '    else if (kind === "complete") out.complete.push(id);',
  '    else if (kind === "progress") out.progress.push(id);',
  '    else out.config += 1;',
  '  }',
  '  return out;',
  '};',
  'window.checkpointOf = async id => {',
  '  const cache = await caches.open(CACHE_NAME), root = new URL("/", location.href).href;',
  '  const saved = await cache.match(new URL("__cxx_media__/progress/" + id, root).href);',
  '  return saved ? await saved.json() : null;',
  '};',
  'window.seedStale = async id => {',
  '  const cache = await caches.open(CACHE_NAME), root = new URL("/", location.href).href;',
  '  await cache.put(new URL("__cxx_media__/blob/" + id, root).href, new Response(new Uint8Array(16)));',
  '  await cache.put(new URL("__cxx_media__/complete/" + id, root).href, Response.json({ version: "0.0.1" }));',
  '  await cache.put(new URL("__cxx_media__/progress/" + id, root).href, Response.json({ manifestId: id, offset: 30 }));',
  '  return true;',
  '};',
  // 与 prepare.mjs 相同的暂停／继续消息：第一路收到首个保存进度后，同一任务内先发 cancel-prepare，再立即发新的 prepare。
  'window.runPauseResume = index => new Promise(async resolve => {',
  '  const out = { first: null, second: null, events: [] };',
  '  try {',
  '    const config = await (await fetch("/data/player-pack-" + index + ".json", { cache: "no-store" })).json();',
  '    const worker = (await navigator.serviceWorker.ready).active, full = { ...config, baseUrl: new URL("/", location.href).href };',
  '    const listen = (key, after) => { const channel = new MessageChannel(); channel.port1.onmessage = ({ data }) => {',
  '      if (data.stage === "done" || data.stage === "error") { out[key] = data.stage === "done" ? { done: true } : { error: data.message, name: data.name }; if (out.first && out.second) resolve(out); }',
  '      else { out.events.push({ port: key, stage: data.stage, loaded: data.loaded }); after && after(data); }',
  '    }; return channel; };',
  '    let paused = false;',
  '    const first = listen("first", data => { if (paused || data.stage !== "install") return; paused = true;',
  '      worker.postMessage({ type: "cancel-prepare", id: config.id });',
  '      const second = listen("second"); worker.postMessage({ type: "prepare", config: full }, [second.port2]); });',
  '    worker.postMessage({ type: "prepare", config: full }, [first.port2]);',
  '  } catch (error) { out.crash = String((error && error.message) || error); resolve(out); }',
  '});',
].join('\n');
const pageHtml = '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>cache residence</title><body><script>' + pageScript + '</scr' + 'ipt>';

// hold：断流前保持连接若干毫秒，让浏览器读完并处理已写出的字节，断点位置可重复。
// throttle：完整响应按 64 KiB 分片、每片间隔若干毫秒送出，让 Worker 在页面操作时仍在校验和保存。
const state = { cuts: [], cutAll: null, requests: [], hold: 0, throttle: 0 };
const send = (res, status, body, type) => { res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/control') { let body = ''; for await (const chunk of req) body += chunk; const parsed = JSON.parse(body || '{}'); state.cuts = parsed.cuts || []; state.cutAll = parsed.cutAll ?? null; state.hold = Number(parsed.hold) || 0; state.throttle = Number(parsed.throttle) || 0; state.requests = []; return send(res, 200, 'ok', 'text/plain'); }
  if (url.pathname === '/stats') return send(res, 200, JSON.stringify(state.requests), 'application/json');
  if (url.pathname === '/page.html') return send(res, 200, pageHtml, 'text/html; charset=utf-8');
  if (url.pathname === '/resource-worker.js') return send(res, 200, workerSource, 'text/javascript; charset=utf-8');
  const packFileMatch = /^\/data\/player-pack-(\d+)\.json$/.exec(url.pathname);
  if (packFileMatch) return send(res, 200, JSON.stringify(packs[packFileMatch[1]] || {}), 'application/json');
  const active = [A, B, C, D].find(row => row.config.download === url.pathname);
  if (!active) return send(res, 404, 'missing', 'text/plain');
  const source = active.zip;
  const range = /bytes=(\d+)-(\d*)/.exec(String(req.headers.range || ''));
  const start = range ? Number(range[1]) : 0, end = range && range[2] ? Number(range[2]) : source.length - 1;
  const body = source.subarray(start, end + 1), cut = state.cuts.length ? state.cuts.shift() : state.cutAll;
  state.requests.push({ pack: active.id.slice(0, 8), range: req.headers.range || null, start, cut });
  res.writeHead(range ? 206 : 200, { 'content-type': 'application/zip', 'accept-ranges': 'bytes', 'content-length': String(body.length), ...(range ? { 'content-range': 'bytes ' + start + '-' + end + '/' + source.length } : {}) });
  if (cut === null) {
    if (!state.throttle) return res.end(body);
    let at = 0;
    const step = () => { if (res.destroyed) return; if (at >= body.length) return res.end(); res.write(body.subarray(at, at += 64 * 1024)); setTimeout(step, state.throttle); };
    return step();
  }
  const sent = Math.min(Number(cut) || 0, body.length);
  if (sent > 0) res.write(body.subarray(0, sent));
  setTimeout(() => res.destroy(), state.hold || 20);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const control = async body => { await fetch(base + '/control', { method: 'POST', body: JSON.stringify(body) }); };
const stats = async () => (await fetch(base + '/stats')).json();

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: Boolean(ok), detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

const browser = await chromium.launch({ headless: true, executablePath: EDGE });
trace('浏览器已启动');
let tab = null, errors = [];
try {
  const context = await browser.newContext();
  tab = await context.newPage();
  tab.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  tab.on('pageerror', error => errors.push('pageerror: ' + String(error && error.message || error)));
  await tab.goto(base + '/page.html');
  trace('页面已载入');

  // A. 单次断流 + 自动续传
  await control({ cuts: [900000] });
  trace('A 段开始：单次断流');
  const first = await evaluate(tab, () => window.runPrepare(1), null, 'A runPrepare');
  trace('A 段 prepare 返回', JSON.stringify({ done: first.done, error: first.error, events: first.events.length }));
  const firstStats = await stats();
  const downloads = first.events.filter(e => e.stage === 'download');
  const installs = first.events.filter(e => e.stage === 'install');
  const retries = first.events.filter(e => e.stage === 'retry');
  check('A1 中断后自动续传并完成', first.done === true && !first.error, first.error ? first.error.message : 'done');
  check('A2 中断被识别为可重试', retries.length >= 1, 'retry 事件 ' + retries.length + ' 次');
  check('A3 续传使用 Range 请求', firstStats.some(r => r.range && r.start > 0), firstStats.map(r => r.start).join(','));
  check('A4 未从 0 重下整包', firstStats.length > 1 && firstStats.slice(1).every(r => r.start > 0), '请求起点 ' + firstStats.map(r => r.start).join('/'));
  const progress = first.events.filter(e => Number.isFinite(e.fraction));
  check('A5 累计进度不倒退，整体完成前不到 100%', downloads.length > 0 && installs.length > 0 && progress.every((e,i) => (!i || e.fraction >= progress[i-1].fraction) && (e.fraction < 1 || (e.stage === 'ready' && !e.layerKey))) && progress.at(-1)?.fraction === 1 && installs.at(-1).loaded === COUNT, 'download ' + downloads.length + ' / install ' + installs.length);
  check('A6 保存阶段带 loaded/total 供界面显示', installs.length > 0 && installs.every(e => Number.isFinite(e.loaded) && e.total === COUNT), JSON.stringify(installs[installs.length - 1] || null));
  const snapshot = await evaluate(tab, () => window.cacheState(), null, 'A cacheState');
  check('A7 全部资源落盘并写完成标记', snapshot.blob === COUNT && snapshot.complete.includes(packId) && snapshot.progress.length === 0, JSON.stringify(snapshot));

  // B. 已完成版本直接复用，不再下载
  trace('B 段开始：已完成版本复用');
  const before = (await stats()).length;
  const second = await evaluate(tab, () => window.runPrepare(1), null, 'B runPrepare');
  const after = (await stats()).length;
  check('B1 已完成版本免下载', second.done === true && after === before, '新增请求 ' + (after - before));
  check('B2 ready 标记命中缓存', JSON.stringify(second.events[second.events.length - 1] || {}).includes('"cached":true'), JSON.stringify(second.events[second.events.length - 1] || null));

  // C. 未完成版本中途彻底断网，关掉页面再进来从检查点续传（换新版本，否则会直接命中已完成标记）
  trace('C 段开始：连续中断 -> 刷新续传（包 B）');
  await control({ cuts: [900000], cutAll: 0 });
  const failed = await evaluate(tab, () => window.runPrepare(2), null, 'C runPrepare');
  const failedStats = await stats();
  trace('C 连续中断结果', JSON.stringify({ done: failed.done, error: failed.error, starts: failedStats.map(r => r.start) }));
  check('C1 连续中断后报错且可重试', failed.done === false && failed.error && failed.error.retryable === true, JSON.stringify(failed.error));
  check('C2 重试次数有上限', failedStats.length > 0 && failedStats.length <= 5, '请求 ' + failedStats.length + ' 次');
  const checkpoint = await evaluate(tab, () => window.cacheState(), null, 'C cacheState');
  const savedCheckpoint = await evaluate(tab, id => window.checkpointOf(id), B.id, 'C checkpointOf');
  trace('检查点', JSON.stringify(savedCheckpoint));
  check('C3 检查点保留在缓存里', checkpoint.progress.includes(B.id) && savedCheckpoint && savedCheckpoint.offset > 0 && savedCheckpoint.manifestId === B.id, JSON.stringify(savedCheckpoint));
  const staleId = randomBytes(32).toString('hex');
  await evaluate(tab, id => window.seedStale(id), staleId, 'C seedStale');
  await control({ cuts: [] });
  await tab.reload();
  trace('已刷新页面，准备从检查点续传');
  const resumed = await evaluate(tab, () => window.runPrepare(2), null, 'C resume runPrepare');
  const resumedStats = await stats();
  trace('C 续传结果', JSON.stringify({ done: resumed.done, error: resumed.error, starts: resumedStats.map(r => r.start) }));
  const resumeStart = Math.max(0, ...resumedStats.map(r => r.start));
  const resumedBytes = resumedStats.reduce((n, r) => n + (B.zip.length - r.start), 0);
  check('C4 刷新后从检查点继续', resumed.done === true && resumeStart > 0, '续传起点 ' + resumeStart);
  check('C5 只补齐剩余字节', resumedBytes < B.zip.length, '本次读取 ' + resumedBytes + ' / ' + B.zip.length);
  const afterResume = await evaluate(tab, () => window.cacheState(), null, 'C cacheState after resume');
  check('C6 旧版本与废弃检查点被回收', !afterResume.complete.includes(staleId) && !afterResume.progress.includes(staleId) && afterResume.complete.includes(B.id) && !afterResume.complete.includes(packId) && afterResume.blob === B.entries.length, JSON.stringify(afterResume));
  check('C7 页面无脚本错误', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');

  // D. 续传后的保存计数：断点之前已保存的条目仍算在 loaded 里，界面计数不能往回掉。
  trace('D 段开始：续传后的保存计数（包 C）');
  await control({ cuts: [Math.floor(C.zip.length * 0.55)], hold: 1500 });
  const counted = await evaluate(tab, () => window.runPrepare(3), null, 'D runPrepare');
  const countedStats = await stats();
  const saves = counted.events.filter(e => e.stage === 'install').map(e => e.loaded);
  trace('D 结果', JSON.stringify({ done: counted.done, error: counted.error, starts: countedStats.map(r => r.start), saves }));
  check('D1 断流后从检查点续传完成', counted.done === true && countedStats.length >= 2 && countedStats.slice(1).every(r => r.start > 0), '请求起点 ' + countedStats.map(r => r.start).join('/'));
  check('D2 续传后保存计数不往回掉', saves.length > 2 && saves.every((n, i) => !i || n >= saves[i - 1]) && saves.at(-1) === C.entries.length, '计数 ' + saves.join(','));

  // E. 暂停后立即继续：新的 prepare 不能接到仍在退出的旧任务上。每轮清空缓存，重复三次。
  trace('E 段开始：暂停后立即继续（包 D）');
  const rounds = [];
  for (let round = 0; round < 3; round += 1) {
    await evaluate(tab, name => caches.delete(name), CACHE, 'E clear cache');
    await control({ throttle: 5 });
    const outcome = await evaluate(tab, () => window.runPauseResume(4), null, 'E runPauseResume ' + round);
    rounds.push(outcome);
    trace('E 第 ' + (round + 1) + ' 轮', JSON.stringify({ first: outcome.first, second: outcome.second, crash: outcome.crash || null }));
  }
  await control({});
  check('E1 暂停的那一路收到暂停结果', rounds.every(r => r.first && r.first.name === 'AbortError'), JSON.stringify(rounds.map(r => r.first)));
  check('E2 暂停后立即继续能完成下载', rounds.every(r => r.second && r.second.done === true), JSON.stringify(rounds.map(r => r.second)));
  const finalState = await evaluate(tab, () => window.cacheState(), null, 'E cacheState');
  check('E3 继续后资源完整落盘', finalState.blob === D.entries.length && finalState.complete.includes(D.id) && finalState.progress.length === 0, JSON.stringify(finalState));
  check('E4 页面无脚本错误', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
} catch (error) {
  trace('检查中断：' + (error && error.stack || error));
  results.push({ name: '检查未能跑完', ok: false, detail: String(error && error.message || error) });
  if (tab) {
    try { const dump = await evaluate(tab, () => ({ trace: window.__trace, report: window.__report }), null, 'dump', 10000); trace('页面轨迹：' + JSON.stringify(dump).slice(0, 1200)); } catch (inner) { trace('页面轨迹不可读：' + String(inner && inner.message || inner)); }
  }
} finally {
  try { await withTimeout(browser.close(), 20000, 'browser.close'); } catch (error) { trace('关闭浏览器超时'); }
  await new Promise(resolve => server.close(resolve));
  const cleanupTarget = resolve(dir), cleanupRoot = resolve(tmpdir());
  if (relative(cleanupRoot, cleanupTarget).startsWith('..') || !basename(cleanupTarget).startsWith('cxx-cache-')) throw Error('Unexpected fixture cleanup path');
  await rm(cleanupTarget, { recursive: true, force: true });
}
await mkdir(dirname(RECEIPT), { recursive: true });
await writeFile(RECEIPT, JSON.stringify({ at: new Date().toISOString(), pack: { main: { id: packId, entries: COUNT, bytes: zip.length }, resume: { id: B.id, entries: B.entries.length, bytes: B.zip.length }, counter: { id: C.id, entries: C.entries.length, bytes: C.zip.length }, pause: { id: D.id, entries: D.entries.length, bytes: D.zip.length } }, results }, null, 2));
const failedCount = results.filter(r => !r.ok).length;
console.log('\n' + (results.length - failedCount) + '/' + results.length + ' 通过（' + EDGE.split('/').pop() + '）');
if (failedCount) process.exitCode = 1;
