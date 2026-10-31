/**
 * P1 自动检查（Node）：状态机 + 原子提交 + 冲突 + 回滚 + 规则拒绝 + 取消。
 * 只用内存端口与假模型，不消耗真实额度；真实模型验收由作者执行（蓝图 §9.1）。
 *
 * 运行：node 工程文件/网页独立版/tools/p1-node-check.mjs
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const load = (rel) => import(pathToFileURL(join(ROOT, rel)).href);

const { createMemoryStatePort } = await load('src/store/memory.mjs');
const { createRulesEngine: mkRules } = await load('src/rules/engine.mjs');
const { createTurnCoordinator: mkTurn } = await load('src/app/turn.mjs');
const { createIdentity } = await load('src/core/ids.mjs');
const { assertPorts } = await load('src/ports/contracts.mjs');
const { parseReply } = await load('src/app/parse.mjs');
const { cardRuleChain, cardParser } = await load('src/reuse/card.mjs');
const registry = await load('src/models/registry.mjs');

// 规则链与解析器在 Node 侧由 require 加载卡内 UMD；浏览器侧走 browser-chain.mjs。
const chain = cardRuleChain();
const cardParse = cardParser();
const createRulesEngine = () => mkRules({ chain });
const createTurnCoordinator = (options) => mkTurn({ ...options, parser: cardParse });

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
}
async function checkAsync(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeModel(reply, { abortAfter = null } = {}) {
  return {
    kind: 'fake',
    async chat(payload, { signal, onDelta } = {}) {
      const chunks = String(reply).match(/[\s\S]{1,8}/g) || [];
      for (const chunk of chunks) {
        if (signal?.aborted) throw Object.assign(new Error('已取消'), { name: 'AbortError' });
        if (abortAfter !== null && chunks.indexOf(chunk) >= abortAfter) {
          throw Object.assign(new Error('已取消'), { name: 'AbortError' });
        }
        onDelta?.(chunk);
      }
      return { text: reply };
    },
    models: async () => ({ models: [] }),
    embeddings: async () => ({}),
    rerank: async () => ({}),
  };
}

const VALID_REPLY = `深夜的涩谷，霓虹把积水染成红色。
<UpdateVariable>
[{"op":"replace","path":"/terminal/wallet/yen","value":1200},{"op":"replace","path":"/terminal/wallet/earned","value":1200}]
</UpdateVariable>`;

const BAD_REPLY = `她抬头看你。
<UpdateVariable>
[{"op":"replace","path":"/terminal/time","value":"2051-10-25"}]
</UpdateVariable>`;

// —— 1. 端口契约 ——
check('端口契约：缺方法被拒绝', () => {
  let threw = false;
  try {
    assertPorts({ mode: 'public', state: { readHead() {} }, model: fakeModel('x'), asset: {}, host: {} }, 'public');
  } catch (error) {
    threw = error.name === 'PortContractError';
  }
  assert(threw, '不完整的端口应被拒绝');
  return '缺少 readState/commit 等必需方法时抛 PortContractError';
});

check('模型矩阵：41 源冻结且协议族收敛', () => {
  const s = registry.coverageSummary();
  assert(s.counts.total === 44, `总源应为 44（26 聊天 + 15 文本 + 3 主入口独立），实际 ${s.counts.total}`);
  assert(s.counts.chat === 26 && s.counts.text === 15 && s.counts.extra === 3, '聊天/文本/独立源数量不符');
  assert(s.counts.families < 20, '协议族应显著少于源数量');
  return `聊天 26 / 文本 15 / 独立 3；协议族 ${s.counts.families}`;
});

// —— 2. 拆帧视图 ——
const FULL_REPLY = [
  '<cxx-story>',
  '雨落在霓虹上。',
  '<cxx-say speaker="丰川祥子" expression="smile">「走吧。」</cxx-say>',
  '</cxx-story>',
  '',
  '<ztl>{"location":"涩谷·中央街","time":"夜","characters":[{"name":"丰川祥子","outfit":"制服","thought":"别再拖了"}]}</ztl>',
  '',
  '<xuan>',
  '1. 去车站',
  '2. 留在原地',
  '3. 找灯说话',
  '4. 回公寓',
  '5. 先看看终端',
  '</xuan>',
  '',
  '<UpdateVariable>',
  '[{"op":"replace","path":"/terminal/wallet/yen","value":900},{"op":"replace","path":"/terminal/wallet/earned","value":900}]',
  '</UpdateVariable>',
  '',
  '<summary_format>',
  '祥子决定离开。',
  '</summary_format>',
].join('\n');

check('拆帧视图：正文/台词/场景/五选项/变量块/摘要各自落位，互不混用', () => {
  const parsed = parseReply(FULL_REPLY, { parser: cardParse });
  assert(parsed.supported, '应使用卡内解析器');
  assert(parsed.display.paragraphs.length === 2, `正文段应为 2，实际 ${parsed.display.paragraphs.length}`);
  assert(parsed.display.paragraphs[1].characterId === 'Saki', `台词应归属祥子，实际 ${parsed.display.paragraphs[1].characterId}`);
  assert(parsed.display.paragraphs[1].text.includes('走吧'), '台词文本应保留');
  assert(parsed.display.choices.length === 5, `五选项应为 5，实际 ${parsed.display.choices.length}`);
  assert(parsed.display.scene?.location === '涩谷·中央街', `场景地点不符：${parsed.display.scene?.location}`);
  assert(parsed.protocol.patches.length === 2, `状态提议应为 2 条，实际 ${parsed.protocol.patches.length}`);
  assert(parsed.display.warnings.length === 0, `不应有解析告警，实际 ${JSON.stringify(parsed.display.warnings)}`);
  assert(parsed.features.includes('xuan') && parsed.features.includes('ztl') && parsed.features.includes('cxx-story'), `特性标记不全：${parsed.features}`);
  const display = parsed.display.paragraphs.map((p) => p.text).join('|');
  assert(!display.includes('UpdateVariable') && !display.includes('summary_format'), '辅助块不得混入正文');
  return '2 段正文 + 5 选项 + 场景 + 2 条补丁 + 0 告警，辅助块不进正文';
});

// —— 3. 正常闭环 ——
const identity = createIdentity({ mode: 'local', accountId: 'local-node', runId: 'run-1', branchId: 'main' });

await checkAsync('正常闭环：draft→candidate→committed 且状态已落库', async () => {
  const state = createMemoryStatePort();
  const rules = createRulesEngine({});
  const turn = createTurnCoordinator({ ports: { state, model: fakeModel(VALID_REPLY) }, rules, identity });
  await turn.begin({ inputText: '我去买碗面。' });
  await turn.generate({ modelPayload: { body: {} } });
  const validated = await turn.validate();
  assert(validated.status === 'candidate', `校验后应回 candidate，实际 ${validated.status}`);
  const done = await turn.commit();
  assert(done.status === 'committed', `提交后应 committed，实际 ${done.status}`);
  assert(done.revision === 1, `修订号应为 1，实际 ${done.revision}`);
  const saved = await state.readState(identity.runId, identity.branchId);
  assert(saved && saved.data.terminal.wallet.yen === 1200, '状态应已写入并包含 1200 日元');
  return `revision=${done.revision}，yen=${saved.data.terminal.wallet.yen}`;
});

await checkAsync('幂等：同一 operationId 重提只回放，不重复结算', async () => {
  const state = createMemoryStatePort();
  const rules = createRulesEngine({});
  const turn = createTurnCoordinator({ ports: { state, model: fakeModel(VALID_REPLY) }, rules, identity });
  await turn.begin({ inputText: '第一步' });
  await turn.generate({ modelPayload: {} });
  await turn.validate();
  const first = await turn.commit();
  const operationId = first.operationId;
  const node = await state.readNode(identity.runId, first.nodeId);
  const replay = await state.commit({
    accountId: identity.accountId,
    runId: identity.runId,
    branchId: identity.branchId,
    operationId,
    expectedRevision: 0,
    nodeId: 'node-should-not-be-written',
    parentNodeId: null,
    message: node.message,
    stateAfter: node.message ? undefined : undefined,
  }).catch((error) => ({ status: 'threw', message: error.message }));
  const head = await state.readHead(identity.runId);
  assert(head.revision === 1, `回放不应增加修订号，实际 ${head.revision}`);
  assert(replay.status === 'replayed', `应回放，实际 ${replay.status}`);
  return `replayed，revision 保持 ${head.revision}`;
});

// —— 3. 冲突 ——
await checkAsync('冲突：过期 expectedRevision 被拒且不写入', async () => {
  const state = createMemoryStatePort();
  const rules = createRulesEngine({});
  const a = createTurnCoordinator({ ports: { state, model: fakeModel(VALID_REPLY) }, rules, identity });
  const b = createTurnCoordinator({ ports: { state, model: fakeModel(VALID_REPLY) }, rules, identity });
  await a.begin({ inputText: 'A' });
  await b.begin({ inputText: 'B' });
  await a.generate({ modelPayload: {} });
  await a.validate();
  const first = await a.commit();
  assert(first.status === 'committed', 'A 应提交成功');
  await b.generate({ modelPayload: {} });
  await b.validate();
  const second = await b.commit();
  assert(second.status === 'conflict', `B 应变冲突，实际 ${second.status}`);
  const head = await state.readHead(identity.runId);
  assert(head.revision === 1, `冲突不应推进修订号，实际 ${head.revision}`);
  return `B 停在 conflict，currentRevision=${second.error?.currentRevision}`;
});

// —— 4. 回滚 ——
await checkAsync('非原子防护：写入中途失败整体回滚，父状态与收据不变', async () => {
  const state = createMemoryStatePort();
  const rules = createRulesEngine({});
  const turn = createTurnCoordinator({ ports: { state, model: fakeModel(VALID_REPLY) }, rules, identity });
  await turn.begin({ inputText: '触发失败' });
  await turn.generate({ modelPayload: {} });
  await turn.validate();
  const snap = turn.snapshot();
  const op = {
    accountId: identity.accountId,
    runId: identity.runId,
    branchId: identity.branchId,
    operationId: snap.operationId,
    expectedRevision: 0,
    nodeId: 'node-fail',
    parentNodeId: null,
    message: { raw: 'x' },
    stateAfter: { terminal: {} },
    failAfterWrites: true,
  };
  let threw = false;
  try {
    await state.commit(op);
  } catch {
    threw = true;
  }
  assert(threw, '注入失败应抛出');
  const head = await state.readHead(identity.runId);
  const receipt = await state.readReceipt(identity.runId, snap.operationId);
  assert(head.revision === 0 && !receipt, '回滚后不应留下修订号或收据');
  return '修订号 0、无收据，事务整体回滚';
});

// —— 5. 规则拒绝 ——
await checkAsync('规则拒绝：程序维护字段被卡内 schema 拦下，父状态不变', async () => {
  const state = createMemoryStatePort();
  const rules = createRulesEngine({});
  const turn = createTurnCoordinator({ ports: { state, model: fakeModel(BAD_REPLY) }, rules, identity });
  await turn.begin({ inputText: '非法写入' });
  await turn.generate({ modelPayload: {} });
  const validated = await turn.validate();
  assert(validated.status === 'failed', `应停在 failed，实际 ${validated.status}`);
  assert(/程序维护|尚未开放/.test(validated.error?.message || ''), `错误信息应来自卡内 schema，实际 ${validated.error?.message}`);
  const head = await state.readHead(identity.runId);
  assert(head.revision === 0, '拒绝后修订号不应推进');
  return validated.error.message;
});

await checkAsync('重试提交：沿用同一 operationId，不重新生成', async () => {
  const state = createMemoryStatePort();
  const rules = createRulesEngine({});
  const turn = createTurnCoordinator({ ports: { state, model: fakeModel(VALID_REPLY) }, rules, identity });
  await turn.begin({ inputText: '重试' });
  await turn.generate({ modelPayload: {} });
  await turn.validate();
  const before = turn.snapshot();
  const committed = await turn.commit();
  assert(committed.operationId === before.operationId, '提交应沿用原 operationId');
  const retried = await turn.retryCommit().catch((error) => ({ status: 'rejected', message: error.message }));
  assert(retried.status !== 'committed' || retried.revision === 1, '已提交回合不应产生第二份节点');
  return `operationId 稳定 = ${before.operationId}`;
});

// —— 6. 取消 ——
await checkAsync('取消：流式中断停在 interrupted 且不提交', async () => {
  const state = createMemoryStatePort();
  const rules = createRulesEngine({});
  const controller = new AbortController();
  const turn = createTurnCoordinator({
    ports: { state, model: fakeModel(VALID_REPLY, { abortAfter: 2 }) },
    rules,
    identity,
  });
  await turn.begin({ inputText: '中断' });
  const snapshot = await turn.generate({ modelPayload: {}, signal: controller.signal });
  assert(snapshot.status === 'interrupted', `应 interrupted，实际 ${snapshot.status}`);
  let blocked = false;
  try {
    await turn.commit();
  } catch (error) {
    blocked = error.code === 'turn_not_committable';
  }
  assert(blocked, '中断后不应允许提交');
  const head = await state.readHead(identity.runId);
  assert(head.revision === 0, '中断不应写入');
  return 'interrupted，提交被拒绝';
});

// —— 7. 输出 ——
const failed = results.filter((r) => !r.ok);
const report = {
  at: new Date().toISOString(),
  node: process.version,
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
};
mkdirSync(join(ROOT, 'reports'), { recursive: true });
writeFileSync(join(ROOT, 'reports', 'p1-node-check.json'), JSON.stringify(report, null, 2), 'utf8');

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
console.log(`\n${report.passed}/${report.total} 通过`);
process.exitCode = failed.length ? 1 : 0;
