/** U05 验收：保护名单、互斥冲突、核心转交、场景回收、预算。全部离线，不读宿主。 */
import fs from 'node:fs';
import { planSelection, explainPlan, skeletonCoverage, conflictGroups, varPathOf, SKELETON_KEYS } from '../src/context/selection.mjs';

const rows = [];
const check = (name, pass, detail = null) => rows.push({ name, pass: pass === true, detail });
const item = ({ uid, title = '', category = 'rule', body = '', meta = {}, position = null, depth = null, role = null, order = 0, constant = false, description = null }) => ({
  uid, entryId: uid.split(':')[1], bookId: 'card', title, category, order, constant, position, depth, role,
  description: description ?? body, bodyBytes: (description ?? body).length, metaFields: meta, extensions: {},
});

// ① 两条互斥规则竞争：同一 exclusiveGroup，有历史引用的那条胜。
{
  const a = item({ uid: 'card:101', title: '玩法定义·歧路司基础义眼', meta: { exclusive: true, exclusiveGroup: 'cyber-eye' }, body: 'A'.repeat(40), order: 1 });
  const b = item({ uid: 'card:102', title: '玩法定义·歧路司进阶义眼', meta: { exclusive: true, exclusiveGroup: 'cyber-eye' }, body: 'B'.repeat(80), order: 2 });
  const out = planSelection({ items: [a, b], historyRefs: ['card:102'], budget: { chars: 0 } });
  check('两条互斥规则竞争只留一个 winner', out.plan.conflicts.length === 1 && out.plan.conflicts[0].winner === 'card:102' && out.plan.removedIds.includes('card:101'), out.conflicts);
  check('落败规则带明确理由', out.trace.some(row => row.uid === 'card:101' && row.action === 'drop' && /冲突落败：family:cyber-eye/.test(row.reason)), out.trace.find(row => row.uid === 'card:101'));
}

// ② 变量同路径冲突：常驻的那条胜，另一条退出。
{
  const x = item({ uid: 'card:111', title: '变量输出格式 · 正文解析', category: 'state', meta: { varPath: 'cxx.scene.area' }, body: 'X'.repeat(20), order: 1 });
  const y = item({ uid: 'card:112', title: '变量输出格式 · 额外解析', category: 'state', constant: true, body: 'Y'.repeat(20), order: 2 });
  y.metaFields = { varPath: 'cxx.scene.area' };
  const out = planSelection({ items: [x, y] });
  check('变量同路径只留一个 winner', out.plan.conflicts.some(row => row.group === 'var:cxx.scene.area' && row.winner === 'card:112') && out.plan.removedIds.includes('card:111'), out.conflicts);
  check('varPathOf 能从 meta 读路径', varPathOf(y) === 'cxx.scene.area');
}

// ③ 核心位切换：原 winner 被历史引用的新候选接管，并记转交流水。
{
  const old = item({ uid: 'card:201', title: '东京都2051 正文显示协议', category: 'rule', meta: { exclusive: true, skeleton: 'session' }, body: 'O'.repeat(30), order: 1 });
  const fresh = item({ uid: 'card:202', title: '状态栏', category: 'rule', meta: { exclusive: true, skeleton: 'session' }, body: 'N'.repeat(30), order: 2 });
  const previous = { selectedIds: ['card:201'], conflicts: [{ group: 'core:session', winner: 'card:201' }] };
  const out = planSelection({ items: [old, fresh], previous, historyRefs: ['card:202'] });
  check('核心位按分数切换', out.plan.conflicts.find(row => row.group === 'core:session')?.winner === 'card:202', out.conflicts);
  check('核心切换写入转交流水', out.transfers.some(row => row.group === 'core:session' && row.from === 'card:201' && row.to === 'card:202' && /转交/.test(row.reason)), out.transfers);
}

// ④ 离开场景：显式场景条目退出，但被历史明确引用的那条留下。
{
  const stale = item({ uid: 'card:301', title: '地点：来生', category: 'place', meta: { scene: '来生' }, body: 'S'.repeat(30), order: 1 });
  const kept = item({ uid: 'card:302', title: '地点：RING', category: 'place', meta: { scene: '来生' }, body: 'K'.repeat(30), order: 2 });
  const out = planSelection({ items: [stale, kept], scene: { area: 'RING' }, historyRefs: ['card:302'] });
  check('离开场景的条目退出（SCENE_STALE）', out.plan.removedIds.includes('card:301') && out.trace.some(row => row.uid === 'card:301' && row.action === 'stale'), out.trace.filter(row => row.action === 'stale'));
  check('历史明确引用的场景资料不被场景回收误删', out.plan.selectedIds.includes('card:302') && out.plan.purposes.history.includes('card:302'), out.plan.purposes);
}

// ⑤ 原 winner 退出：上一轮 winner 本轮落败，转交并保留理由。
{
  const prev = item({ uid: 'card:401', title: '文风强调：平实叙事', category: 'rule', meta: { exclusive: true, exclusiveGroup: 'style' }, body: 'P'.repeat(20), order: 1 });
  const next = item({ uid: 'card:402', title: '文风强调：紧凑叙事', category: 'rule', meta: { exclusive: true, exclusiveGroup: 'style' }, body: 'Q'.repeat(20), order: 2 });
  const previous = { selectedIds: ['card:401'], conflicts: [{ group: 'family:style', winner: 'card:401' }] };
  const out = planSelection({ items: [prev, next], previous, historyRefs: ['card:402'] });
  const transfer = out.transfers.find(row => row.group === 'family:style');
  check('原 winner 退出后转交流水保留', Boolean(transfer) && transfer.from === 'card:401' && transfer.to === 'card:402' && /原 winner 退出/.test(transfer.reason), transfer);
  check('原 winner 退出理由可读', out.trace.some(row => row.uid === 'card:401' && /冲突落败/.test(row.reason)));
}

// ⑥ 必需规则占满预算：保护名单全留且不挤，候选让位并记录超额。
{
  const r1 = item({ uid: 'card:501', title: '保护区一', meta: { anchor: true }, body: 'R'.repeat(40), order: 1 });
  const r2 = item({ uid: 'card:502', title: '保护区二', meta: { anchor: true }, body: 'S'.repeat(40), order: 2 });
  const c = item({ uid: 'card:503', title: '普通候选', body: 'C'.repeat(10), order: 3 });
  const out = planSelection({ items: [r1, r2, c], budget: { chars: 30 } });
  check('必需规则占满预算仍然全部保留', out.plan.requiredIds.length === 2 && out.plan.removedIds.length === 0, out.plan.requiredIds);
  check('候选因预算不足让位', out.trace.some(row => row.uid === 'card:503' && /预算不足/.test(row.reason)), out.trace.find(row => row.uid === 'card:503'));
  check('超额如实标记', out.stats.budgetOver === true && out.plan.budget.over === true, out.plan.budget);
}

// ⑦ 骨架映射到 2051 真实规则条目，五项都不许空。
{
  const index = JSON.parse(fs.readFileSync(new URL('../artifacts/st-extension/app/data/knowledge-index.json', import.meta.url), 'utf8'));
  const coverage = skeletonCoverage(index.items);
  check('五条骨架全部映射到真实条目', coverage.unmapped.length === 0 && coverage.rows.every(row => row.uids.length > 0), coverage.rows.map(row => row.key + ':' + row.uids.length));
  check('骨架键固定为五条', SKELETON_KEYS.length === 5 && SKELETON_KEYS.join(',') === 'world,power,session,scene,style');
}

// ⑧ 装配字段与解释输出：placements 保留位置，explain 只读计划不二次裁决。
{
  const a = item({ uid: 'card:601', title: '常驻规则', body: 'A'.repeat(10), position: 1, depth: 4, role: 'system', order: 1 });
  const b = item({ uid: 'card:602', title: '候选规则', body: 'B'.repeat(10), position: 0, order: 2 });
  const out = planSelection({ items: [a, b], budget: { chars: 100 } });
  check('装配位置随计划带出', out.plan.placements.length === 2 && out.plan.placements[0].position === 1 && out.plan.placements[0].depth === 4, out.plan.placements);
  const lines = explainPlan(out);
  check('解释只列选入/保留/退出与理由', lines.length >= 2 && lines.every(line => /^(选入|保留|退出|转交)/.test(line)), lines.slice(0, 4));
}

const passed = rows.filter(row => row.pass).length;
const report = { schema: 1, at: new Date().toISOString(), verdict: passed === rows.length ? 'all ' + rows.length + ' checks passed' : passed + '/' + rows.length + ' checks passed', passed, total: rows.length, checks: rows };
fs.mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../reports/u05-selection-check.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(report.verdict);
for (const row of rows) console.log((row.pass ? 'PASS ' : 'FAIL ') + row.name + (row.pass ? '' : ' :: ' + JSON.stringify(row.detail)?.slice(0, 300)));
process.exit(passed === rows.length ? 0 : 1);
