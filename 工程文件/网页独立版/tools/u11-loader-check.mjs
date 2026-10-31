/** U11 acceptance: template install/repair, load retry, version visibility, running build self-check. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createLocalServer } from './serve.mjs';
import { installOrRepair, templateStatus, detectKnownBroken, TEMPLATE_VERSION } from '../src/context/templates.mjs';
import { loadJsonWithRetry, loaderSummary, loaderLine } from '../src/platform/loader.mjs';

const WEB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const checks = [];
const network = [];
function pass(name, detail) { checks.push({ name, ok: true, detail }); console.log('PASS ' + name + (detail ? ' :: ' + detail : '')); }
function fail(name, error) { checks.push({ name, ok: false, error: String(error?.message || error) }); console.log('FAIL ' + name + ' :: ' + String(error?.message || error)); }

const official = {
  skillPrompt: '你是东京都2051的条目整理器。规则一：uid 必须原样回填。',
  segmentRules: '长条目按 900 字一段切分，段序号从 1 开始。',
  mergeRules: '合并同 uid 段，保留原正文顺序。',
  manualPatch: '作者手工修补优先于自动生成。',
};

// 1. 首装
let step = installOrRepair({ stored: null, official });
try { assert.equal(step.action, 'installed'); assert.equal(step.prompt.templateVersion, TEMPLATE_VERSION); assert.ok(step.prompt.skillPrompt); pass('首装写入官方模板', step.action); } catch (e) { fail('首装写入官方模板', e); }

// 2. 同版本重开
const installed = step.prompt;
step = installOrRepair({ stored: installed, official });
try { assert.equal(step.action, 'kept'); assert.equal(step.reason, 'same-template'); assert.equal(templateStatus(step.prompt, step).digest, templateStatus(installed).digest); pass('同版本重开保持原样', step.reason); } catch (e) { fail('同版本重开保持原样', e); }

// 3. 升级：核心字段没变，只有版本号落后
const older = { ...installed, templateVersion: '2051.skill.0' };
step = installOrRepair({ stored: older, official });
try { assert.equal(step.action, 'upgraded'); assert.equal(step.prompt.templateVersion, TEMPLATE_VERSION); assert.equal(step.prompt.skillPrompt, older.skillPrompt); pass('升级只前进版本号', step.reason); } catch (e) { fail('升级只前进版本号', e); }

// 4. 已知坏模板修复：skillPrompt 被截断，丢掉 uid 回填规则
const broken = { ...installed, skillPrompt: '你是东京都2051的条目整理器。规则一：' };
try { assert.equal(detectKnownBroken(broken)?.id, 'skill-prompt-truncated-1'); } catch (e) { fail('识别已知损坏', e); }
step = installOrRepair({ stored: broken, official });
try {
  assert.equal(step.action, 'repaired');
  assert.equal(step.signature, 'skill-prompt-truncated-1');
  assert.deepEqual(step.changedFields, ['skillPrompt']);
  assert.equal(step.prompt.skillPrompt, official.skillPrompt);
  assert.equal(step.prompt.segmentRules, broken.segmentRules);
  pass('已知损坏只补坏掉那段', step.changedFields.join(','));
} catch (e) { fail('已知损坏只补坏掉那段', e); }

// 5. 作者定制模板不动
const custom = { ...installed, skillPrompt: installed.skillPrompt + '\n作者追加：本局只整理诊所线。' };
step = installOrRepair({ stored: custom, official });
try { assert.equal(step.action, 'kept'); assert.equal(step.reason, 'author-customized'); assert.equal(step.prompt.skillPrompt, custom.skillPrompt); pass('作者定制模板不被覆盖', step.reason); } catch (e) { fail('作者定制模板不被覆盖', e); }

// 6. 远端读取失败一次后恢复，以及一直失败时的降级
const rows = [];
let attempts = 0;
const value = await loadJsonWithRetry('https://cdn.test/data/manifest.json', { fetchImpl: async () => { attempts += 1; if (attempts === 1) throw new Error('network down'); return { ok: true, json: async () => ({ ok: 1 }) }; }, backoffMs: 5, record: rows });
try {
  assert.equal(attempts, 2); assert.equal(value.ok, 1); assert.equal(rows.length, 2); assert.equal(rows[0].ok, false); assert.equal(rows[1].ok, true);
  const summary = loaderSummary({ release: { buildId: 'b1', contentVersion: '2.3.33+x' }, rows });
  assert.equal(summary.status, 'ok'); assert.equal(summary.retries, 1); assert.equal(summary.files, 1);
  pass('远端失败后重试恢复', 'attempts=' + attempts + ' retries=' + summary.retries);
} catch (e) { fail('远端失败后重试恢复', e); }

const bad = [];
let hardError = null;
try { await loadJsonWithRetry('https://cdn.test/data/missing.json', { fetchImpl: async () => { throw new Error('still down'); }, backoffMs: 5, record: bad }); } catch (error) { hardError = error; }
try {
  assert.ok(hardError); assert.equal(bad.length, 2);
  const summary = loaderSummary({ release: { buildId: 'b1' }, identity: { buildId: 'b2' }, rows: bad });
  assert.equal(summary.status, 'degraded'); assert.deepEqual(summary.failed, ['https://cdn.test/data/missing.json']); assert.equal(summary.identityMatch, false);
  const line = loaderLine(summary);
  assert.ok(line.includes('缺 1'), line); assert.ok(line.includes('身份不一致'), line);
  pass('远端持续失败可见且版本不一致可见', line);
} catch (e) { fail('远端持续失败可见且版本不一致可见', e); }

// 7. 构建回执里的模板与外部源
try {
  const identity = JSON.parse(await fs.readFile(path.join(WEB, 'artifacts/st-extension/identity.json'), 'utf8'));
  assert.ok(identity.loader, 'identity.loader 存在');
  assert.ok(Array.isArray(identity.loader.remoteOrigins), 'remoteOrigins 是数组');
  const action = identity.loader.template?.action;
  assert.ok(['installed', 'repaired', 'upgraded', 'kept'].includes(action), 'template.action=' + action);
  assert.equal(identity.loader.template.version, TEMPLATE_VERSION);
  pass('构建回执带模板与外部源', 'action=' + action + ' origins=' + identity.loader.remoteOrigins.length);
} catch (e) { fail('构建回执带模板与外部源', e); }

// 8. 运行中的网页确实显示版本（真浏览器）
if (!process.argv.includes('--no-browser')) {
  const app = createLocalServer();
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + app.address().port;
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error.message || error)));
  page.on('response', response => { if (response.status() >= 400) network.push(response.status() + ' ' + response.url()); });
  const isSelection = route => String(route.request().postData() || '').includes('目录挑选助手');
  const answer = route => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' }, body: isSelection(route) ? 'data: ' + JSON.stringify({ choices: [{ delta: { content: '{"uids":[],"reason":"夹具不选任何条目"}' } }] }) + '\n\ndata: [DONE]\n\n' : 'data: ' + JSON.stringify({ choices: [{ delta: { content: '<cxx-story>雨停了。</cxx-story>' } }] }) + '\n\ndata: [DONE]\n\n' });
  await page.route('**/api/play/connect', answer);
  await page.route('https://upstream.test/**', answer);
  try {
    await page.goto(origin + '/?mode=local&adapter=openai-chat&baseUrl=https://upstream.test/v1/chat/completions&model=test-model', { waitUntil: 'domcontentloaded' });
    await page.locator('.cxx-opening-flow').waitFor();
    const next = async (step) => { await page.locator('.opening-next').click(); if (step) await page.locator('.cxx-opening-flow[data-step="' + step + '"]').waitFor(); };
    await next('origin'); await next('profile');
    await page.getByLabel('姓名', { exact: true }).fill('U11 版本');
    await next('growth'); await next('loadout'); await next('scenario');
    await page.getByRole('button', { name: /街头/ }).last().click();
    await next('review'); await next();
    await page.waitForFunction(() => globalThis.CxxWebApp?.read?.().booted && globalThis.CxxWebApp.ui, null, { timeout: 60000 });
    const read = await page.evaluate(() => globalThis.CxxWebApp.read());
    const line = await page.evaluate(() => { const dt = [...document.querySelectorAll('#gen-info dt')].find(row => row.textContent === '加载与版本'); return dt?.nextElementSibling?.textContent || ''; });
    assert.ok(read.loader, 'read().loader 存在');
    assert.equal(read.loader.status, 'ok', 'loader.status');
    assert.ok(/^[0-9a-f]{20}$/.test(read.loader.buildId), 'buildId=' + read.loader.buildId);
    assert.ok(line.includes('构建 ' + read.loader.buildId), line);
    assert.equal(errors.length, 0, errors.join(' | '));
    pass('运行中的网页显示实际构建与加载状态', line);
  } catch (e) { fail('运行中的网页显示实际构建与加载状态', e); }
  await browser.close();
  await new Promise(resolve => app.close(resolve));
}

const report = { at: new Date().toISOString(), checks, network, errors: network.filter(row => /404/.test(row)) };
await fs.mkdir(path.join(WEB, 'reports'), { recursive: true });
await fs.writeFile(path.join(WEB, 'reports/u11-loader-check.json'), JSON.stringify(report, null, 2) + '\n');
const failed = checks.filter(row => !row.ok).length;
console.log('U11=' + (failed ? 1 : 0) + ' (' + (checks.length - failed) + '/' + checks.length + ')');
process.exit(failed ? 1 : 0);
