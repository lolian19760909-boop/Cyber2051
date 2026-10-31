/** U04 验收：斗罗目录路由（并发/关系/章节/证据）与命定复用·合并·全量（分批/分页/补查）。离线，模型入口是注入的。 */
import fs from 'node:fs';
import { douluoSelect, destinySelect, createDestinyState, mapLimit, chunks, matchItems, normalizePlan, STRATEGY_PARAMS } from '../src/context/agent.mjs';

const rows = [];
const check = (name, pass, detail = null) => rows.push({ name, pass: pass === true, detail });
const item = ({ uid, title, category = 'character', body = '', aliases = [], keywords = [], segments = null }) => ({
  uid, entryId: uid.split(':')[1], bookId: 'card', title, category, categoryLabel: category,
  aliases, keywords, description: body, bodyBytes: body.length,
  segments: segments ?? (body.length > 900 ? [body.slice(0, 900), body.slice(900)] : [body]),
  metaFields: {}, extensions: {},
});

const cast = [
  item({ uid: 'card:1', title: '高松灯', category: 'character', aliases: ['Tomori', '灯'], keywords: ['主唱'], body: '灯在 RiNG 的舞台上第一次开口。' }),
  item({ uid: 'card:2', title: '千早爱音', category: 'character', keywords: ['吉他'], body: '爱音把吉他背在肩上。' }),
  item({ uid: 'card:3', title: '地点：RING', category: 'place', keywords: ['RiNG'], body: 'RiNG 是社区核心场馆。' }),
  item({ uid: 'card:4', title: '乐队：MyGO!!!!!', category: 'org', body: '高松灯是主唱，千早爱音弹吉他。' }),
  item({ uid: 'card:5', title: '[章节资料]盗芯之夜 · 来生的桌边', category: 'chapter', body: '来生的桌边。' }),
  item({ uid: 'card:6', title: '文风强调：平实叙事', category: 'rule', body: '平实，不堆形容词。' }),
];

// ① 并发上限与分批工具
{
  let inFlight = 0, peak = 0;
  const out = await mapLimit(Array.from({ length: 10 }, (_, i) => i), 4, async value => { inFlight += 1; peak = Math.max(peak, inFlight); await new Promise(r => setTimeout(r, 5)); inFlight -= 1; return value * 2; });
  check('分类并发严格不超过 4', peak === 4 && out.length === 10, { peak });
  check('目录 50／条目 45 一批', chunks(Array.from({ length: 120 }, (_, i) => i), 50).length === 3 && chunks(Array.from({ length: 100 }, (_, i) => i), 45).length === 3);
  check('参数只在策略局部作用域', STRATEGY_PARAMS.douluo.classifyConcurrency === 4 && STRATEGY_PARAMS.destiny.lookupsPerTurn === 2);
}

// ② 斗罗：分组判断 + 关系跨组 + 章节 + 历史引用
{
  const calls = [];
  const requestPurpose = async (stage, payload) => {
    calls.push({ stage, payload });
    if (payload.stage === 'judge') return { uids: payload.items.filter(row => row.title === '高松灯').map(row => row.uid), reason: '主角在场' };
    return null;
  };
  const facts = { route: { chapter: '盗芯之夜' }, capsule: '灯在 RiNG' };
  const plan = await douluoSelect({ items: cast, facts, requestPurpose, text: '灯在 RiNG', scene: { area: 'RING' }, historyRefs: ['card:6'] });
  check('斗罗按目录分组判断', calls.filter(row => row.payload.stage === 'judge').length >= 3 && plan.groups.length >= 3, plan.groups.map(row => row.id));
  check('关系扩展把跨组条目带进来', plan.selectedIds.includes('card:4') && plan.relations.some(row => row.to === 'card:4' && row.from === 'card:1'), plan.relations);
  check('章节判断命中历史章节', plan.selectedIds.includes('card:5') && plan.evidence.some(row => /章节判断/.test(row.reason)), plan.evidence.filter(row => /章节判断/.test(row.reason)));
  check('历史明确引用的条目保留', plan.selectedIds.includes('card:6') && plan.evidence.some(row => /历史引用/.test(row.reason)));
  check('类别理由按组分别保存', plan.groups.every(row => typeof row.reason === 'string' && row.reason.length > 0));
  const normalized = normalizePlan(plan, { inputRef: 'u04' });
  check('斗罗输出是合法 SelectionPlan', normalized.managedIds.length === cast.length && normalized.selectedIds.length === plan.selectedIds.length, { managed: normalized.managedIds.length, selected: normalized.selectedIds.length });
  const kinds = new Set(plan.evidence.map(row => row.kind));
  check('身份／能力／章节／引用四类理由分开', ['category', 'relation', 'chapter', 'history'].every(key => kinds.has(key)), [...kinds]);
}

// ③ 命定：全量分批 → 复用 → 合并 + 补查上限
{
  const many = Array.from({ length: 100 }, (_, index) => item({ uid: 'card:' + (100 + index), title: (index % 7 === 0 ? '关键' : '普通') + '条目 ' + index, category: index % 2 ? 'place' : 'character', body: 'B'.repeat(20) }));
  many.push(item({ uid: 'card:999', title: '长条目', category: 'lore', body: 'L'.repeat(2000), segments: ['s1', 's2', 's3'] }));
  const calls = [];
  const requestPurpose = async (stage, payload) => { calls.push(payload); if (payload.stage === 'catalog') return { uids: payload.items.filter(row => row.title.startsWith('关键')).map(row => row.uid) }; if (payload.stage === 'entry') return { uids: payload.items.filter(row => row.title === '长条目').map(row => row.uid) }; return null; };
  const state = createDestinyState();
  const first = await destinySelect({ items: many, facts: { capsule: '第一轮' }, requestPurpose, state, text: '关键' });
  const catalogCalls = calls.filter(row => row.stage === 'catalog'), entryCalls = calls.filter(row => row.stage === 'entry');
  check('命定全量按 50 分批覆盖目录', catalogCalls.length === Math.ceil(many.length / 50) && catalogCalls.length === 3, catalogCalls.length);
  check('命定条目按 45 分批覆盖', entryCalls.length === Math.ceil(many.length / 45) && entryCalls.length === 3, entryCalls.length);
  check('超 45 候选也不遗漏后面批次', first.selectedIds.includes('card:999') && first.pages.some(row => row.uid === 'card:999' && row.segments === 3), first.pages);
  check('长条目按段分页记录', first.evidence.some(row => /长条目分页 3 段/.test(row.reason)));

  const reused = await destinySelect({ items: many, facts: { capsule: '第一轮' }, requestPurpose, state, text: '关键' });
  check('事实与目录不变时复用上一轮选择', reused.mode === 'reuse' && reused.selectedIds.length === first.selectedIds.length && reused.calls.some(row => row.stage === 'reuse'), { mode: reused.mode });

  const merged = await destinySelect({ items: many, facts: { capsule: '第二轮', facts: [{ sourceIds: ['card:105', 'card:150', 'card:151', 'card:152'] }] }, requestPurpose, state, text: '关键' });
  check('事实变化后走合并而不是全丢重来', merged.mode === 'merge' && merged.selectedIds.includes('card:105') && merged.selectedIds.includes('card:999'), { mode: merged.mode, selected: merged.selectedIds.length });
  check('补查超额留下未完成查询', merged.pendingQueries.length >= 1 && /额度/.test(merged.pendingQueries[0].reason), merged.pendingQueries);
  check('复用／合并都写进决定历史', state.decisions.length === 2 && state.revision === 2 && reused.calls.some(row => row.stage === 'reuse'));
}

// ④ 无模型时的确定性路径（对照原完整路径结果）
{
  const plan = await douluoSelect({ items: cast, text: '灯在 RiNG', facts: null });
  const fallback = matchItems(cast, '灯在 RiNG').map(row => row.uid);
  check('无模型时走确定性关键词命中', fallback.length >= 2 && fallback.every(uid => plan.selectedIds.includes(uid)), { fallback, selected: plan.selectedIds });
}

// ⑤ 两套策略都能直接喂给选择层
{
  const destiny = await destinySelect({ items: cast, facts: { capsule: 'x' }, state: createDestinyState(), text: '灯' });
  const normalized = normalizePlan(destiny, { inputRef: 'u04-destiny' });
  check('命定输出也是合法 SelectionPlan', normalized.managedIds.length === cast.length && normalized.calls.length === destiny.calls.length, { calls: normalized.calls.length });
}

// Changed scene/input/catalog must invalidate a decision made from real capsule-style facts.
{
 const items=[item({uid:'card:1',title:'甲地'}),item({uid:'card:2',title:'乙地'})],state=createDestinyState();let calls=0,wanted='甲地';
 const requestPurpose=async(_,payload)=>{calls++;return{uids:payload.items.filter(row=>row.title===wanted).map(row=>row.uid)}};
 await destinySelect({items,facts:{capsule:'甲'},text:'甲',state,requestPurpose});wanted='乙地';const changed=await destinySelect({items,facts:{capsule:'乙'},text:'乙',state,requestPurpose});
 check('真实胶囊变化重新判断并移除旧场景选择',changed.selectedIds.length===1&&changed.selectedIds[0]==='card:2');const previousCalls=calls;
 const reused=await destinySelect({items,facts:{capsule:'乙'},text:'乙',state,requestPurpose});check('相同输入继续复用且不发模型调用',reused.mode==='reuse'&&calls===previousCalls);
 wanted='甲地';const inputChanged=await destinySelect({items,facts:{capsule:'乙'},text:'改输入',state,requestPurpose});check('只有玩家输入变化也使旧决定失效',inputChanged.selectedIds.length===1&&inputChanged.selectedIds[0]==='card:1'&&calls>previousCalls);const beforeCatalog=calls;
 await destinySelect({items:[...items,item({uid:'card:3',title:'丙地'})],facts:{capsule:'乙'},text:'改输入',state,requestPurpose,deps:'catalog2'});check('目录变更重新执行有限批次判断',calls>beforeCatalog);
}
const passed = rows.filter(row => row.pass).length;
const report = { schema: 1, at: new Date().toISOString(), verdict: passed === rows.length ? 'all ' + rows.length + ' checks passed' : passed + '/' + rows.length + ' checks passed', passed, total: rows.length, checks: rows };
fs.writeFileSync(new URL('../reports/u04-strategy-check.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(report.verdict);
for (const row of rows) console.log((row.pass ? 'PASS ' : 'FAIL ') + row.name + (row.pass ? '' : ' :: ' + JSON.stringify(row.detail)?.slice(0, 260)));
process.exit(passed === rows.length ? 0 : 1);
