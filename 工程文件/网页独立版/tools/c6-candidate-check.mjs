/** C6: 同一候选三模式复核汇总。本地独立版／ST 接入版／部署候选公网路径，按「已过现场／未完成／作者待测」三列落回执。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WEB } from './workspace-paths.mjs';
import { createWebSession } from '../src/app/session.mjs';
import { createMemoryStatePort } from '../src/store/memory.mjs';
import { cardRuleChain, cardParser, cardModule } from '../src/reuse/card.mjs';

const reports = path.join(WEB, 'reports');
const readJson = name => { const file = path.join(reports, name); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; };
const readText = name => { const file = path.join(reports, name); return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; };
const fail = [];
const rows = [];
const record = (mode, step, ok, evidence, note = '') => {
  rows.push({ mode, step, status: ok ? 'passed' : 'unfinished', evidence: String(evidence || '').slice(0, 240), note: String(note || '').slice(0, 240) });
  if (!ok) fail.push(mode + '／' + step + '：' + evidence);
};

/* 一、本地独立版：取消 → 重发（同一 buildId 的会话代码路径） */
const chain = { ...cardRuleChain(), parser: cardParser(), operations: cardModule('运行时/player-operations.js') };
const card = { data: { name: 'C6 夹具', description: '', character_book: { entries: [{ id: 21, keys: ['月台'], content: 'C6-月台-原始', enabled: true, constant: true, selective: true, insertion_order: 100, extensions: { position: 0 } }] } } };
const preset = { name: 'C6-预设', prompts: [{ identifier: 'worldInfoBefore', marker: true }, { identifier: 'chatHistory', marker: true }], prompt_order: [{ character_id: 100001, order: [{ identifier: 'worldInfoBefore', enabled: true }, { identifier: 'chatHistory', enabled: true }] }] };
const messagesOf = payload => payload?.body?.messages || payload?.messages || [];
const systemOf = payload => messagesOf(payload).filter(row => row?.role === 'system').map(row => String(row?.content || '')).join('\n');

const localCancel = await (async () => {
  const port = createMemoryStatePort({ accountId: 'c6' });
  let phase = 'abort';
  let bodyStarted = 0;
  const chat = async (payload, options = {}) => {
    const system = systemOf(payload);
    if (system.includes('目录挑选助手')) return { text: JSON.stringify({ uids: [], reason: 'C6 夹具不选条目' }), usage: { input_tokens: 500, output_tokens: 8 } };
    bodyStarted += 1;
    if (phase === 'ok') return { text: '<cxx-story>重发之后的正文。</cxx-story>', usage: { input_tokens: 1500, output_tokens: 120 } };
    return await new Promise((resolve, reject) => {
      const signal = options?.signal;
      const stop = () => { const error = new Error('aborted'); error.name = 'AbortError'; reject(error); };
      if (signal?.aborted) return stop();
      signal?.addEventListener('abort', stop, { once: true });
    });
  };
  const app = createWebSession({ mode: 'local', accountId: 'c6', runId: 'c6-cancel', ports: { state: port, model: { chat } }, chain, card, preset, promptOptions: { selection: { strategy: 'destiny' } } });
  await app.restore();
  const before = { nodes: app.nodes.length, revision: app.turn?.revision ?? null };
  const pending = app.runTurn('我在月台等车。');
  for (let index = 0; index < 200 && !bodyStarted; index += 1) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(bodyStarted >= 1, '取消前请求应已发出');
  app.cancel();
  const stopped = await pending;
  assert.equal(stopped.status, 'interrupted', '取消后本轮应停在 interrupted');
  assert.equal(app.nodes.length, before.nodes, '取消不得留下节点');
  phase = 'ok';
  const resent = await app.runTurn('我还在月台等车。');
  assert.equal(resent.status, 'committed', '取消之后应能重发并提交');
  assert.equal(app.nodes.length, before.nodes + 1, '重发只新增一个节点');
  assert.match(String(app.narrativeNode?.message?.raw || ''), /重发之后的正文/, '重发正文已落盘');
  return { before, stopped: stopped.status, resent: resent.status, nodes: app.nodes.length, bodies: bodyStarted };
})().then(value => value).catch(error => ({ error: String(error?.message || error) }));

if (localCancel.error) record('本地独立版', '取消→重发（同一会话）', false, localCancel.error);
else record('本地独立版', '取消→重发（同一会话）', localCancel.resent === 'committed', 'interrupted→committed，节点 ' + localCancel.before.nodes + '→' + localCancel.nodes + '，正文请求 ' + localCancel.bodies + ' 次');

/* 二、收口回执 */
const build = readJson('build.json');
assert.ok(build?.buildId, '缺少 reports/build.json');
const c0 = readJson('c0-identity-browser.json');
const u11host = readJson('u11-host-reopen.json');
const p4 = readJson('p4-deploy-check.json');
const site = readJson('site-candidate.json');
const u12 = readJson('u12-scenario.json');
const u10 = readJson('u10-settings-browser.json');
const u11loader = readJson('u11-loader-check.json');
const p3a = readJson('p3a-browser-check.json');
const c1 = readJson('c1-stop-id.json');
const c2 = readJson('c2-chat-attribution.json');
const p2json = readJson('p2-browser.json');
const p2text = readText('p2-browser.txt');

const p2 = p2json ? [null, String(p2json.passed), String(p2json.total)] : /(\d+)\/(\d+)\s*通过/.exec(p2text);
const p2ok = p2 ? Number(p2[1]) === Number(p2[2]) && Number(p2[2]) > 0 : false;
record('本地独立版', '正常一轮＋重抽＋IDB 原子提交', p2ok, p2 ? 'P2 浏览器检查 ' + p2[1] + '/' + p2[2] + ' 通过' + (p2json ? '（正文 ' + p2json.upstreamCalls + ' 次／选择 ' + p2json.selectionCalls + ' 次）' : '') : '缺 p2 回执');
record('本地独立版', '视图与玩法回归（六步创建／Gal／地图／通讯）', Array.isArray(p3a?.checks) && p3a.checks.length > 0 && !(p3a.errors || []).length, p3a ? 'P3A ' + p3a.checks.length + ' 条断言，errors ' + (p3a.errors || []).length : '缺 p3a-browser-check.json');
record('本地独立版', '同一组剧情：选择→写回→请求→提交→下一轮胶囊', Boolean(u12?.ok) && (u12.checks || []).every(row => row.ok !== false), u12 ? 'U12 ' + (u12.checks || []).length + ' 条，轮次 ' + (u12.turns || []).length : '缺 u12-scenario.json');
record('本地独立版', '设置与人工修订（策略／接管／Skill 修补／移动端）', (u10?.checks || []).length >= 12, u10 ? 'U10 ' + (u10.checks || []).length + ' 条断言' : '缺 u10-settings-browser.json');
record('本地独立版', '加载·模板安装与重试', (u11loader?.checks || []).length >= 9 && (u11loader.checks || []).every(row => row.ok !== false), u11loader ? 'U11 加载 ' + (u11loader.checks || []).length + ' 条' : '缺 u11-loader-check.json');
record('ST 接入版', '同一候选装入隔离宿主（并发开合／身份一致）', (u11host?.steps || []).length > 0 && (u11host.steps || []).every(row => row.ok), u11host ? 'U11 宿主 ' + (u11host.steps || []).length + ' 步，verdict ' + (u11host.verdict ?? '-') + '，角色 ' + (u11host.character?.avatar || '-') : '缺 u11-host-reopen.json');
const stopIds = c1?.stop?.stop || [], genIds = c1?.stop?.generate || [];
// 每次中断都要命中“当时正在跑”的那次生成：第 0 次之外还有命中，才排除“永远停第一次”的旧实现。
const stopHits = stopIds.map(id => genIds.indexOf(id));
const stopOk = c1?.ok === true && genIds.length >= 2 && stopIds.length > 1 && stopHits.every((index, position) => index === position);
record('ST 接入版', '取消后重发（宿主侧 generation id）', stopOk, c1 ? 'generate ' + genIds.length + ' 个／stop 依次命中第 ' + stopHits.join('、') + ' 个' : '缺 c1-stop-id.json', 'stop 必须读正在运行的那个 id，不是本轮第一个 id');
const arms = c2?.arms || [];
const armStable = arms.length >= 2 && arms.every(arm => { const steps = arm.steps || []; return steps.length >= 3 && steps[0].rows === steps.at(-1).rows && !String(arm.label || '').includes('unavailable'); });
record('ST 接入版', '切换聊天与节点集合（含插件开／关对照）', armStable, c2 ? 'C2 对照臂 ' + arms.length + ' 支：' + arms.map(arm => arm.label + ' ' + (arm.steps || []).map(step => step.step + ':' + step.rows).join('→')).join('；') + '，verdict ' + c2.verdict : '缺 c2-chat-attribution.json', 'A→B→A 行数首尾相同即节点集合未丢；首楼提示本轮两臂均未复现阻塞，此前归因第三方插件 shujuku 的守卫');
record('公网路径', '部署候选校验（release 逐文件／Caddy／切换回退／网关转发）', (p4?.checks || []).length >= 5, p4 ? 'P4 ' + (p4.checks || []).length + ' 条：' + String((p4.checks || [])[0] || '').slice(0, 40) : '缺 p4-deploy-check.json');
record('公网路径', '站点候选生成（三模式入口＋激活清单）', Boolean(site?.buildId) && Number(site?.files) > 0, site ? '候选 ' + site.buildId + '，文件 ' + site.files + '，字节 ' + site.bytes : '缺 site-candidate.json');

/* 三、身份一致性：同一候选三处 buildId 必须相同 */
const identities = [['构建', build.buildId], ['身份核对', c0?.host?.buildId || c0?.buildId || c0?.web?.release?.buildId], ['ST 宿主', (u11host?.steps || []).find(row => /身份/.test(row.name))?.detail], ['部署候选', p4?.buildId], ['站点候选', site?.buildId]];
const mismatched = identities.filter(([, value]) => String(value || '').trim() !== build.buildId).map(([name, value]) => name + '=' + (value || '缺失'));
record('全部模式', '同一 buildId 在构建／身份核对／宿主／部署候选／站点候选一致', mismatched.length === 0, mismatched.length ? mismatched.join('，') : identities.map(([name, value]) => name + '=' + value).join('，'));
const c0mismatch = c0?.host?.mismatches || c0?.web?.identity?.mismatches || [];
const c0card = c0?.web?.identity?.card ?? c0?.card?.ok;
record('全部模式', '身份核对无 mismatch、卡片 lens 一致、页面无错误', c0?.host?.status === 'ok' && !c0mismatch.length && c0card === true && c0?.web?.booted === true && !(c0?.errors || []).length, c0 ? 'status ' + c0.host?.status + '，mismatches ' + c0mismatch.length + '，card ' + c0card + '，booted ' + c0.web?.booted + '，phase ' + c0.web?.phase + '，errors ' + (c0.errors || []).length : '缺 c0-identity-browser.json');

const authorPending = [
  '作者实模跑两套正式预设（本回执用受控模型响应，非真实模型）',
  '作者在真机 ST 里点取消／重发、切换、编辑与投影恢复（隔离宿主已过，真机待作者）',
  '正式服务器上传 release、切 current、重启网关与公网回读（本轮只验候选与本地 staging 网关）',
  '设备媒体（语音／Live2D／图库资源）与真实存档旧档、长线样本',
];
const unfinished = fail.length ? fail : ['无未完成项（本轮范围内）'];

const report = { schema: 1, at: new Date().toISOString(), buildId: build.buildId, contentVersion: build.contentVersion, localCancel, rows, columns: { passed: rows.filter(row => row.status === 'passed'), unfinished, authorPending }, identities, verdict: fail.length ? 'fail' : 'ok' };
fs.writeFileSync(path.join(reports, 'c6-candidate.json'), JSON.stringify(report, null, 2) + '\n');
console.log('候选 ' + build.buildId + ' · ' + rows.filter(row => row.status === 'passed').length + '/' + rows.length + ' 条已过现场');
for (const row of rows) console.log((row.status === 'passed' ? 'PASS ' : 'FAIL ') + row.mode + '｜' + row.step + ' — ' + row.evidence);
if (fail.length) console.log('未完成：\n- ' + fail.join('\n- '));
console.log('C6=' + (fail.length ? 1 : 0));
