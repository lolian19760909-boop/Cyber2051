import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryStatePort } from '../src/store/memory.mjs';
import { createWebSession } from '../src/app/session.mjs';
import { cardRuleChain, cardParser } from '../src/reuse/card.mjs';
import { CONTINUE_NUDGE } from '../src/app/prompt.mjs';

const chain = { ...cardRuleChain(), parser: cardParser() };
const preset = {
  prompts: [{ identifier: 'journal', role: 'system', content: '记录' }, { identifier: 'chatHistory', marker: true }],
  prompt_order: [{ order: [{ identifier: 'journal', enabled: true }, { identifier: 'chatHistory', enabled: true }] }],
  continue_nudge_prompt: '',
};
const checks = [];
const ok = (name, detail = {}) => checks.push({ name, ok: true, ...detail });
const roleTail = messages => messages.at(-1)?.role;
const userRows = messages => messages.filter(row => row.role === 'user');

function defineSession(state, model, extra = {}) {
  return createWebSession({ mode: 'local', accountId: 'continue-check', ports: { state, model }, chain, preset, ...extra });
}

await (async function continuePromptShape() {
  const state = createMemoryStatePort(), calls = [];
  const model = { chat: async payload => { calls.push(payload); return { text: '<cxx-story>续写正文。</cxx-story>' }; } };
  const app = defineSession(state, model);
  assert.equal((await app.runTurn('先看一眼')).status, 'committed');
  const normalTail = calls.at(-1).body.messages.at(-1);
  assert.deepEqual([normalTail.role, normalTail.content], ['user', '先看一眼']);
  const continued = await app.continueTurn();
  assert.equal(continued.status, 'committed');
  const messages = calls.at(-1).body.messages;
  assert.equal(roleTail(messages), 'system');
  assert.ok(messages.at(-1).content.includes(CONTINUE_NUDGE.slice(0, 40)), '续写必须在末尾带上继续提示语');
  assert.deepEqual(userRows(messages).map(row => row.content), ['先看一眼'], '续写不再追加玩家输入行');
  ok('续写提示形状', { messages: messages.length, tail: 'system Continue nudge' });
})();

await (async function continueCommitShape() {
  const state = createMemoryStatePort(), calls = [];
  const model = { chat: async payload => { calls.push(payload); return { text: calls.length === 1 ? '<cxx-story>开场正文。</cxx-story>' : '<cxx-story>接上一段。</cxx-story>' }; } };
  const app = defineSession(state, model);
  await app.runTurn('开端行动');
  const before = await state.readHead(app.identity.runId), originalId = before.headNodeId;
  const original = await state.readNode(app.identity.runId, originalId);
  await app.continueTurn();
  const head = await state.readHead(app.identity.runId);
  const node = await state.readNode(app.identity.runId, head.headNodeId);
  assert.equal(head.revision, 2);
  assert.notEqual(node.nodeId, originalId, '续写应提交合并后的新节点');
  assert.equal(node.parentId, original.parentId, '合并节点挂在原楼层的 parent 上');
  assert.ok(node.message.raw.includes('开场正文。'), '合并节点保留原正文');
  assert.ok(node.message.raw.includes('接上一段'));
  assert.equal(node.message.input.text, '开端行动', '合并节点沿用原玩家输入');
  assert.equal(node.message.input.generationType, undefined, '合并楼层按普通楼层记录');
  assert.ok(await state.readNode(app.identity.runId, originalId), '旧楼层仍留在原分支');
  ok('续写拼回同一条消息', { revision: head.revision, original: originalId, merged: node.nodeId });
})();

await (async function continuationPreambleStaysInOrder() {
  const state = createMemoryStatePort(), calls = [];
  const model = { chat: async payload => { calls.push(payload); return { text: calls.length === 1 ? '<cxx-story>开场正文。</cxx-story>' : '前置说明。<cxx-story>接上一段。</cxx-story>' }; } };
  const app = defineSession(state, model);
  await app.runTurn('开端行动');
  assert.equal((await app.continueTurn()).status, 'committed');
  const head = await state.readHead(app.identity.runId);
  const node = await state.readNode(app.identity.runId, head.headNodeId);
  const raw = node.message.raw;
  assert.ok(raw.startsWith('<cxx-story>开场正文。'), '合并消息仍从原正文开头');
  assert.ok(raw.indexOf('前置说明。') > raw.indexOf('开场正文。'), '续写前言按时间顺序落在原正文之后');
  assert.ok(raw.indexOf('前置说明。') < raw.indexOf('接上一段。'), '续写前言在续写正文之前');
  ok('续写前言顺序', { head: raw.slice(0, 80) });
})();

await (async function regenerateContinuedNode() {
  const state = createMemoryStatePort(), calls = [];
  const model = { chat: async payload => { calls.push(payload); return { text: '<cxx-story>另一版续写。</cxx-story>' }; } };
  const app = defineSession(state, model);
  await app.runTurn('开端行动');
  const before = await state.readHead(app.identity.runId);
  assert.equal((await app.continueTurn()).status, 'committed');
  const reroll = await app.regenerate();
  assert.equal(reroll.status, 'committed');
  const after = await state.readHead(app.identity.runId);
  assert.notEqual(after.branchId, before.branchId, '重抽合并楼层开新路线');
  const messages = calls.at(-1).body.messages;
  assert.equal(roleTail(messages), 'user', '合并楼层按普通楼层重抽，末尾是玩家输入');
  assert.deepEqual(userRows(messages).map(row => row.content), ['开端行动'], '重抽不伪造玩家输入');
  const node = await state.readNode(app.identity.runId, after.headNodeId);
  assert.equal(node.message.input.text, '开端行动');
  assert.equal(node.message.input.generationType, undefined);
  ok('重抽合并楼层', { branches: 2 });
})();

await (async function emptyInputStillRejected() {
  const state = createMemoryStatePort();
  const app = defineSession(state, { chat: async () => ({ text: '<cxx-story>正文。</cxx-story>' }) });
  await assert.rejects(app.runTurn('   '), error => error instanceof TypeError);
  ok('空输入仍拒绝普通回合');
})();

await (async function interruptedContinueResumes() {
  const state = createMemoryStatePort(), calls = [];
  let fail = false;
  const model = { chat: async payload => {
    calls.push(payload);
    if (fail) { fail = false; throw Object.assign(new Error('玩家中断'), { name: 'AbortError' }); }
    return { text: '<cxx-story>恢复后的续写。</cxx-story>' };
  } };
  const app = defineSession(state, model);
  await app.runTurn('开端行动');
  fail = true;
  const interrupted = await app.continueTurn();
  assert.equal(interrupted.status, 'interrupted');
  const resumed = await app.regenerate();
  assert.equal(resumed.status, 'committed');
  const head = await state.readHead(app.identity.runId);
  const node = await state.readNode(app.identity.runId, head.headNodeId);
  assert.equal(node.message.input.text, '开端行动');
  assert.equal(node.message.input.generationType, undefined);
  assert.equal(roleTail(calls.at(-1).body.messages), 'system');
  ok('中断后续写重抽仍为续写', { calls: calls.length });
})();

await (async function truncatedTurnCommitsAndContinues() {
  const state = createMemoryStatePort(); let calls = 0;
  const model = { chat: async () => (++calls === 1
    ? { text: '<cxx-story>话说到一半', complete: false, finishReason: 'length' }
    : { text: '<cxx-story>，后半句。</cxx-story>' }) };
  const app = defineSession(state, model);
  const first = await app.runTurn('试探');
  assert.equal(first.status, 'committed');
  const head1 = await state.readHead(app.identity.runId), node1 = await state.readNode(app.identity.runId, head1.headNodeId);
  assert.equal(node1.message.complete, false, '截断回复应标记未完整');
  assert.equal(node1.message.completion, 'length');
  assert.ok(node1.message.raw.includes('话说到一半'));
  const continued = await app.continueTurn();
  assert.equal(continued.status, 'committed');
  const head2 = await state.readHead(app.identity.runId), node2 = await state.readNode(app.identity.runId, head2.headNodeId);
  assert.equal(node2.parentId, node1.parentId);
  assert.equal(node2.message.complete, undefined, '续写接上后合并楼层恢复完整');
  assert.ok(node2.message.raw.includes('话说到一半') && node2.message.raw.includes('后半句'));
  ok('截断回复保留并续写接上', { revision: head2.revision, completion: node1.message.completion });
})();

await (async function unknownMacroStaysWarning() {
  const state = createMemoryStatePort(), calls = [];
  const model = { chat: async payload => { calls.push(payload); return { text: '<cxx-story>照常生成。</cxx-story>' }; } };
  const custom = { ...preset, prompts: [{ identifier: 'journal', role: 'system', content: '记录 {{no_such_macro}}' }, { identifier: 'chatHistory', marker: true }] };
  const app = createWebSession({ mode: 'local', accountId: 'continue-check', ports: { state, model }, chain, preset: custom });
  const result = await app.runTurn('继续玩');
  assert.equal(result.status, 'committed', '未知宏不再让整轮失败');
  assert.ok((app.promptReport.warnings || []).some(row => String(row).includes('未识别的宏')), '未知宏保留警告');
  assert.ok(calls.at(-1).body.messages.some(row => String(row.content).includes('{{no_such_macro}}')), '未知宏按酒馆行为原样保留');
  ok('未知宏降级为警告');
})();

await (async function openingContinueSplices() {
  const state = createMemoryStatePort();
  const model = { chat: async () => ({ text: '<cxx-story>开场之后。</cxx-story>' }) };
  const app = defineSession(state, model);
  await state.commit({ accountId: 'continue-check', runId: app.identity.runId, nodeId: 'opening', operationId: 'open', branchId: 'main', parentNodeId: null, expectedRevision: 0, stateAfter: app.rules.emptyRoot(), message: { kind: 'opening', raw: '<cxx-story>开场。</cxx-story>' }, profile: { name: '检查旅人' } });
  await app.restore();
  const result = await app.continueTurn();
  assert.equal(result.status, 'committed');
  const head = await state.readHead(app.identity.runId), node = await state.readNode(app.identity.runId, head.headNodeId);
  assert.equal(head.revision, 2);
  assert.equal(node.parentId, null);
  assert.ok(node.message.raw.includes('开场。') && node.message.raw.includes('开场之后。'));
  assert.ok(await state.readNode(app.identity.runId, 'opening'), '原开场仍留在旧分支');
  ok('开场白续写拼回', { revision: head.revision });
})();

await (async function formalPresetsCarryNudge() {
  const web = JSON.parse(fs.readFileSync(new URL('../generated/presets.json', import.meta.url), 'utf8'));
  const rows = [];
  for (const row of web) {
    const state = createMemoryStatePort();
    const app = createWebSession({ mode: 'local', accountId: 'continue-check', runId: 'preset-' + row.id, ports: { state, model: { chat: async () => ({ text: '<cxx-story>正文。</cxx-story>' }) } }, chain, preset: row.preset });
    await state.commit({ accountId: 'continue-check', runId: app.identity.runId, nodeId: 'opening', operationId: 'open', branchId: 'main', parentNodeId: null, expectedRevision: 0, stateAfter: app.rules.emptyRoot(), message: { kind: 'opening', raw: '<cxx-story>今天也是一个人。</cxx-story>' }, profile: { name: '检查旅人' } });
    await app.restore();
    const normal = app.buildPrompt('停下来查看四周');
    const continued = app.buildPrompt('', { generationType: 'continue' });
    const tail = continued.prompt.messages.at(-1);
    assert.equal(tail.role, 'system');
    assert.ok(tail.content.includes('Continue the following message'), row.id + ' 续写提示缺失');
    assert.ok(!continued.prompt.messages.some(message => message.role === 'user' && !String(message.content).trim()), row.id + ' 出现空的玩家输入行');
    assert.equal(continued.report.historyMessages, normal.report.historyMessages);
    rows.push({ preset: row.id, normalMessages: normal.prompt.messages.length, continueMessages: continued.prompt.messages.length, nudgeFromPreset: Boolean(row.preset.continue_nudge_prompt) });
    app.dispose();
  }
  ok('两份正式预设的续写提示', { rows });
})();

await (async function composerWiring() {
  const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../web/app.mjs', import.meta.url), 'utf8');
  assert.ok(html.includes('id="continue"'), '发送区缺少继续按钮');
  assert.ok(js.includes("els.continueBtn.addEventListener('click',()=>sendTurn('',{continues:true}))"), '继续按钮未接线');
  assert.ok(js.includes('session.continueTurn(hooks)'), '继续按钮未调用续写接口');
  ok('发送区接线', { button: 'id="continue"', binding: 'sendTurn continues' });
})();

const receipt = { at: new Date().toISOString(), scope: '续写提示、提交节点、重抽、中断恢复、两份正式预设、发送区接线', checks };
const out = fileURLToPath(new URL('../../.cache/play-loading-20261027/checks/play-continue.json', import.meta.url));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
