/** U12: 同一组剧情走完 选择→写回→请求→提交→下一轮胶囊，留下可与原路径对照的逐段落痕。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createWebSession } from '../src/app/session.mjs';
import { createMemoryStatePort } from '../src/store/memory.mjs';
import { cardRuleChain, cardParser, cardModule } from '../src/reuse/card.mjs';

const chain = { ...cardRuleChain(), parser: cardParser(), operations: cardModule('运行时/player-operations.js') };
const presetA = { name: 'U12-预设甲', prompts: [{ identifier: 'worldInfoBefore', marker: true }, { identifier: 'chatHistory', marker: true }], prompt_order: [{ character_id: 100001, order: [{ identifier: 'worldInfoBefore', enabled: true }, { identifier: 'chatHistory', enabled: true }] }] };
const presetB = { name: 'U12-预设乙', prompts: [{ identifier: 'u12-prefix', name: 'U12 乙段', role: 'system', content: 'U12-PRESET-B' }, { identifier: 'worldInfoBefore', marker: true }, { identifier: 'chatHistory', marker: true }], prompt_order: [{ character_id: 100001, order: [{ identifier: 'u12-prefix', enabled: true }, { identifier: 'worldInfoBefore', enabled: true }, { identifier: 'chatHistory', enabled: true }] }] };
const card = { data: { name: 'U12 夹具', description: '', character_book: { entries: [
  { id: 11, keys: ['诊所'], content: 'U12-诊所-原始', enabled: true, constant: true, selective: true, insertion_order: 100, extensions: { position: 0 } },
  { id: 12, keys: ['委托人'], content: 'U12-委托人-原始', enabled: true, constant: false, selective: true, insertion_order: 101, extensions: { position: 0 } },
] } } };
const catalog = { schema: 1, indexHash: 'u12-index', stats: { items: 2, groups: 2 }, items: [
  { uid: '11', entryId: 11, title: '诊所旧档', hash: 'h11', segments: 1, keywords: ['诊所'], category: 'place', enabled: true },
  { uid: '12', entryId: 12, title: '委托人档案', hash: 'h12', segments: 1, keywords: ['委托人'], category: 'character', enabled: true },
], groups: [{ id: 'g-place', label: '地点', itemUids: ['11'] }, { id: 'g-char', label: '人物', itemUids: ['12'] }] };

const packOf = fields => Object.entries(fields).map(([key, value]) => '<' + key + '>' + value + '</' + key + '>').join('\n');
const story = [
  { input: '我走进诊所，把纸袋放在柜台上。', marker: 'U12-写回-第一轮：柜台上有一只写了红线的纸袋。', fields: { chapter_baseline: '第一章 · 诊所', scene_state: '诊所 · 候诊区', runtime_state: '日光灯嗡嗡响', progression_guidance: '让玩家注意到纸袋', situation_assessment: '安全', recall: '高松灯在场' } },
  { input: '我问高松灯有没有见过委托人。', marker: 'U12-写回-第二轮：高松灯否认见过委托人。', fields: { chapter_baseline: '第一章 · 诊所', scene_state: '诊所 · 走廊', runtime_state: '走廊只剩应急灯', progression_guidance: '给出否认的迟疑', situation_assessment: '轻微紧张', recall: '高松灯避开了视线' } },
  { input: '我离开诊所，走向车站。', marker: 'U12-写回-第三轮：月台广告屏在放义体广告。', fields: { chapter_baseline: '第二章 · 车站', scene_state: '车站 · 月台', runtime_state: '末班车还有十分钟', progression_guidance: '把玩家推向月台广播', situation_assessment: '人流稀少', recall: '纸袋还在手上' } },
  { input: '我在月台等车。', marker: 'U12-写回-第四轮：月台广播报站。', fields: { chapter_baseline: '第二章 · 车站', scene_state: '车站 · 月台', runtime_state: '广播报站', progression_guidance: '让广播引来陌生人', situation_assessment: '有视线', recall: '有人在看' } },
];

const results = [];
const test = async (name, fn) => { try { await fn(); results.push({ name, ok: true }); console.log('PASS ' + name); } catch (error) { results.push({ name, ok: false, error: String(error?.message || error).slice(0, 500) }); console.log('FAIL ' + name + ' :: ' + String(error?.message || error).slice(0, 400)); } };
const messagesOf = payload => payload?.body?.messages || payload?.messages || [];
const textOf = payload => messagesOf(payload).map(row => String(row?.content || '')).join('\n');
const systemOf = payload => messagesOf(payload).filter(row => row?.role === 'system').map(row => String(row?.content || '')).join('\n');
const userJsonOf = payload => { const rows = messagesOf(payload).filter(row => row?.role === 'user'); const raw = String(rows.at(-1)?.content || ''); try { return JSON.parse(raw.slice(raw.indexOf('{'))); } catch { return null; } };

function fixture({ preset = presetA, catalogIndex = null, selectionFor = null } = {}) {
  const port = createMemoryStatePort({ accountId: 'u12' });
  const calls = [];
  const seen = { selection: 0, advance: 0, recall: 0, repair: 0, body: 0 };
  const capsules = [];
  let reply = 0;
  const chat = async payload => {
    const system = systemOf(payload);
    const kind = system.includes('目录挑选助手') ? 'selection' : system.includes('标签修复器') ? 'repair' : system.includes('准备下一轮演出') ? 'advance' : system.includes('召回') ? 'recall' : 'body';
    calls.push({ kind, messages: messagesOf(payload).map(row => ({ role: row.role, chars: String(row?.content || '').length, content: String(row?.content || '') })) });
    if (kind === 'selection') {
      seen.selection += 1;
      const ask = userJsonOf(payload) || {};
      return { text: JSON.stringify({ uids: ask.stage === 'catalog' ? ['g-place'] : ['11'], reason: '诊所线' }), usage: { input_tokens: 900, output_tokens: 16 } };
    }
    if (kind === 'repair') { seen.repair += 1; return { text: packOf(story[0].fields), usage: { input_tokens: 300, output_tokens: 60 } }; }
    if (kind === 'advance') { seen.advance += 1; const ask = userJsonOf(payload); if (ask && typeof ask.capsule === 'string') capsules.push(ask.capsule); return { text: '<cxx_memory_direction>让玩家在月台等到广播报站。</cxx_memory_direction>', usage: { input_tokens: 400, output_tokens: 40 } }; }
    if (kind === 'recall') { seen.recall += 1; return { text: '', usage: { input_tokens: 200, output_tokens: 0 } }; }
    const row = story[Math.min(reply, story.length - 1)]; reply += 1; seen.body += 1;
    const said = String(messagesOf(payload).filter(item => item?.role === 'user').at(-1)?.content || '').trim();
    return { text: '<cxx-story>' + (said || row.input) + '（第' + reply + '轮正文）</cxx-story>\n' + packOf(row.fields), usage: { input_tokens: 2500, output_tokens: 220 } };
  };
  const make = () => createWebSession({ mode: 'local', accountId: 'u12', runId: 'u12-' + Math.random().toString(16).slice(2, 7), ports: { state: port, model: { chat } }, chain, card, preset, catalog: catalogIndex, selectionFor, promptOptions: { selection: { strategy: 'destiny' } } });
  const boot = async () => { const app = make(); await app.restore(); if (app.memory?.configure) await app.memory.configure({ enabled: true, advanceModel: true }); return app; };
  return { port, calls, seen, capsules, make, boot };
}
const rawText = app => String(app.narrativeNode?.message?.raw || '');
const digest = text => { let hash = 2166136261; const value = String(text || ''); for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); };
const bodyCall = calls => calls.filter(call => call.kind === 'body').at(-1);
const writebackPlan = marker => () => ({ managedIds: ['11'], selectedIds: ['11'], bookChanges: [{ bookId: 'card', entryId: 11, fields: { content: marker } }] });

const trace = { schema: 1, at: new Date().toISOString(), scenario: 'U12 同一组剧情四轮（写回＋胶囊＋分支）', turns: [] };

await test('每轮：选择→写回→请求→提交，四轮都留痕', async () => {
  const f = fixture({ selectionFor: writebackPlan('U12-写回-逐轮统一') });
  const app = await f.boot();
  for (const [index, row] of story.entries()) {
    const turn = await app.runTurn(row.input, {});
    assert.equal(turn.status, 'committed', '第' + (index + 1) + '轮应提交：' + JSON.stringify(turn.error || null).slice(0, 200));
    assert.ok(rawText(app).includes('第' + (index + 1) + '轮正文'), '提交后读回本轮正文');
    assert.equal(app.applied.status, 'applied', '写回应成功');
    const body = bodyCall(f.calls);
    trace.turns.push({
      index: index + 1, input: row.input,
      state: { revisionAfter: turn.revision ?? null, nodeId: turn.nodeId ?? null, branchId: app.describe().identity?.branchId || null },
      model: { stages: f.calls.map(call => call.kind) },
      plan: { strategy: app.plan?.strategy || null, mode: app.plan?.mode || null, selected: (app.plan?.selected || []).map(row2 => row2.uid), excluded: (app.plan?.excluded || []).map(row2 => row2.uid), calls: (app.plan?.calls || []).map(row2 => row2.stage) },
      applied: { status: app.applied.status, persisted: app.applied.persisted ?? null, books: (app.applied.books || []).map(book => ({ bookId: book.bookId, entryIds: (book.patches || []).map(patch => String(patch.entryId)), fields: (book.patches || []).flatMap(patch => Object.keys(patch.fields || {})) })) },
      capsule: (f.capsules.at(-1) || '').slice(0, 500),
      prompt: { bodyChars: body ? textOf(body).length : 0, bodyDigest: body ? digest(textOf(body)) : null, systemRoles: body ? body.messages.map(row2 => row2.role) : [] },
    });
  }
  assert.equal(f.seen.body, 4, '四轮＝四次正文调用');
});

await test('写回内容替换卡内原文，且只注入一次', async () => {
  const f = fixture({ selectionFor: writebackPlan('U12-写回-统一正文') });
  const app = await f.boot();
  await app.runTurn('我先看看柜台。', {});
  const body = textOf(bodyCall(f.calls));
  assert.ok(body.includes('U12-写回-统一正文'), 'messages 使用写回正文 :: ' + JSON.stringify(body.slice(0, 400)) + ' :: applied=' + JSON.stringify(app.applied?.books || []) .slice(0, 300));
  assert.ok(!body.includes('U12-诊所-原始'), '旧正文不再出现');
  assert.equal(body.split('U12-写回-统一正文').length - 1, 1, '同一内容只注入一次');
  assert.equal(app.applied.persisted, true, '写回落盘到本故事设置');
});

await test('下一轮胶囊带上轮章节与场景，长线换章后不残留旧章', async () => {
  const f = fixture({ selectionFor: writebackPlan('U12-写回-链条') });
  const app = await f.boot();
  for (const row of story) await app.runTurn(row.input, {});
  assert.ok(f.capsules.length >= 4, '每轮都有推进请求：' + f.capsules.length);
  assert.ok(f.capsules[1].includes('第一章 · 诊所'), '第二轮胶囊带上第一轮章节');
  assert.ok(f.capsules[1].includes('诊所 · 候诊区'), '第二轮胶囊带上第一轮场景');
  assert.ok(f.capsules[3].includes('第二章 · 车站'), '第四轮胶囊读到换章后的第二章');
  assert.ok(f.capsules[3].includes('车站 · 月台'), '第四轮胶囊带上场景');
  assert.ok(!f.capsules[3].includes('第一章 · 诊所'), '旧章节不残留');
});

await test('生产选择器（命定两段）真实发起并落进本轮计划', async () => {
  const f = fixture({ catalogIndex: catalog });
  const app = await f.boot();
  await app.runTurn('我在诊所里问委托人。', {});
  const selectionCalls = f.calls.filter(call => call.kind === 'selection').length;
  assert.ok(selectionCalls >= 2, '目录批次 + 条目批次各有一次判断');
  assert.equal(app.plan.strategy, 'destiny');
  assert.deepEqual(app.plan.selected.map(row => row.uid), ['11'], '目录选中地点组后条目细判选中 11');
  assert.equal(app.plan.counts.selected, 1);
  assert.deepEqual(app.plan.calls.map(row => row.stage), ['catalog', 'entry']);
});

await test('换预设后同一轮请求的系统段不同', async () => {
  const a = fixture(); const appA = await a.boot();
  await appA.runTurn('我走向柜台。', {});
  const textA = textOf(bodyCall(a.calls));
  const b = fixture({ preset: presetB }); const appB = await b.boot();
  await appB.runTurn('我走向柜台。', {});
  const textB = textOf(bodyCall(b.calls));
  assert.ok(textB.includes('U12-PRESET-B'), '预设乙的固定内容进请求 :: ' + JSON.stringify(textB.slice(0, 500)));
  assert.ok(!textA.includes('U12-PRESET-B'), '预设甲没有这段内容');
  assert.notEqual(textA, textB, '两套预设的请求不同（语义对照而非逐字比较）');
});

await test('分支：从第一轮之后另起一条路，旧节点保留', async () => {
  const f = fixture({ selectionFor: writebackPlan('U12-写回-分支') });
  const app = await f.boot();
  await app.runTurn('我先坐下。', {});
  const firstNode = app.narrativeNode.nodeId;
  const firstBranch = app.describe().identity?.branchId;
  const nodesAfterFirst = app.nodes.length;
  const fork = await app.runTurn('我改口，先问柜台。', { parentNodeId: firstNode });
  assert.equal(fork.status, 'committed', '分支回合提交：' + JSON.stringify(fork.error || null).slice(0, 200));
  assert.equal(app.nodes.length, nodesAfterFirst + 1, '旧节点保留，新节点追加');
  assert.notEqual(app.describe().identity?.branchId, firstBranch, '另起一条分支');
  assert.ok(rawText(app).includes('我改口'), '新分支读回新正文');
});

const parity = [
  { requirement: '输入状态与场景事实进请求', legacy: '待作者实模', p2051: 'ok（trace.turns[].capsule）' },
  { requirement: '模型阶段可见', legacy: '待作者实模', p2051: 'ok（selection/advance/body 分类与计划阶段）' },
  { requirement: '候选／入选 ID', legacy: '待作者实模', p2051: 'ok（plan.selected／plan.excluded）' },
  { requirement: '保护／退出原因', legacy: '待作者实模', p2051: 'ok（U05 计划 counts.excluded + U09 计划视图）' },
  { requirement: '世界书字段写回', legacy: '待作者实模', p2051: 'ok（applied.books[].patches）' },
  { requirement: '实际 messages', legacy: '待作者实模', p2051: 'ok（bodyChars/bodyDigest/roles）' },
  { requirement: '正文提交与读回', legacy: '待作者实模', p2051: 'ok（commit + narrativeNode.raw）' },
  { requirement: '下一轮胶囊', legacy: '待作者实模', p2051: 'ok（四轮胶囊断言章节／场景传递与换章）' },
  { requirement: '两套正式预设', legacy: '作者待测', p2051: '夹具两套已等价验证；正式预设由 C7 作者实模' },
  { requirement: '三模式（本地／ST／公网）', legacy: '待作者实模', p2051: '本地本脚本与 p2；ST 见 u11-host-reopen；公网由 C4/C6 交付' },
];

const report = { ...trace, parity, checks: results, ok: results.every(row => row.ok) };
fs.mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../reports/u12-scenario.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log('U12=' + (report.ok ? 0 : 1));
process.exit(report.ok ? 0 : 1);
