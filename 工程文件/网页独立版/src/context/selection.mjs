/** U05：保护名单、互斥冲突、预算分配——纯计划计算，不读宿主、不发请求。
 *  输入是 U04 的候选（知识条目/配置条目同形）与 U03 的事实束，输出 SelectionPlan 草稿给 U07 归一化装配。
 *  这里只做一次决策：先保留/退出，再处理冲突，最后排序填预算；不做第二个决策器。 */
export const SELECTION_RULES_SCHEMA = 1;

const text = value => (value === undefined || value === null ? '' : String(value));
const list = value => (Array.isArray(value) ? value : []);

/** 五条骨架映射到 2051 真实规则条目（按标题/分类匹配，不按顺序硬塞）。缺项会进 unmapped，绝不随手拿五条常驻。 */
export const SKELETONS = [
  { key: 'world', label: '世界骨架', test: item => item?.category === 'lore' && /世界观|地区与治安|编年史/.test(text(item.title)) },
  { key: 'power', label: '力量与义体骨架', test: item => (item?.category === 'lore' && /义体与医疗|机偶体系/.test(text(item.title))) || (item?.category === 'rule' && /正文玩法|结算规则/.test(text(item.title))) },
  { key: 'session', label: '会话骨架', test: item => item?.category === 'rule' && /显示协议|状态栏|选项/.test(text(item.title)) },
  { key: 'scene', label: '场景骨架', test: item => item?.category === 'place' || /地点：|地区|场所/.test(text(item.title)) },
  { key: 'style', label: '文风骨架', test: item => item?.category === 'rule' && /文风|叙事|写作/.test(text(item.title)) },
];
export const SKELETON_KEYS = SKELETONS.map(row => row.key);
const SKELETON_LABEL = new Map(SKELETONS.map(row => [row.key, row.label]));

/** 骨架归属：显式 metaFields.skeleton 优先，其次按映射表第一条命中。 */
export function skeletonOf(item) {
  const explicit = text(item?.metaFields?.skeleton);
  if (explicit && SKELETON_LABEL.has(explicit)) return explicit;
  for (const row of SKELETONS) if (row.test(item)) return row.key;
  return null;
}

/** 哪些骨架没有任何真实条目可映射——缺项要补映射表，不允许静默降级。 */
export function skeletonCoverage(items) {
  const rows = SKELETON_KEYS.map(key => ({ key, label: SKELETON_LABEL.get(key), uids: [] }));
  const byKey = new Map(rows.map(row => [row.key, row]));
  for (const item of list(items)) {
    const key = skeletonOf(item);
    if (key) byKey.get(key).uids.push(item.uid);
  }
  return { rows, unmapped: rows.filter(row => !row.uids.length).map(row => row.key) };
}

/** 规则族：显式 familia，或标题 `族·成员` 的点号前缀。 */
export function familyOf(item) {
  const explicit = text(item?.metaFields?.family);
  if (explicit) return explicit;
  const title = text(item?.title);
  if (!title.includes('·')) return null;
  return title.split('·')[0].trim() || null;
}

/** 变量路径：显式声明优先，其次正文里的 `path: x.y`／`变量：x.y` 写法。 */
export function varPathOf(item) {
  const meta = item?.metaFields || {};
  const direct = text(meta.varPath || meta.variablePath || item?.extensions?.cxx?.varPath);
  if (direct) return direct;
  const found = text(item?.description).match(/(?:path|变量路径|变量)\s*[:：]\s*([A-Za-z0-9_.\[\]-]+)/);
  return found ? found[1] : null;
}

const scenicOf = item => text(item?.metaFields?.scene || item?.extensions?.cxx?.scene) || null;
export const isRequired = item => item?.metaFields?.anchor === true || item?.metaFields?.required === true || item?.metaFields?.骨骼 === true;
export const isExclusive = item => item?.metaFields?.exclusive === true || item?.metaFields?.核心 === true;

/** 冲突组：变量同路径、显式互斥族、同一骨架的核心位。 */
export function conflictGroups(items) {
  const rows = list(items);
  const groups = [];
  const byPath = new Map();
  for (const item of rows) {
    const path = varPathOf(item);
    if (!path) continue;
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push(item);
  }
  for (const [path, members] of byPath) {
    if (members.length > 1) groups.push({ key: 'var:' + path, kind: 'variable', label: '变量路径 ' + path, members });
  }
  const byExplicit = new Map();
  for (const item of rows) {
    const key = text(item?.metaFields?.exclusiveGroup || item?.extensions?.cxx?.exclusiveGroup);
    if (!key || !isExclusive(item)) continue;
    if (!byExplicit.has(key)) byExplicit.set(key, []);
    byExplicit.get(key).push(item);
  }
  for (const [key, members] of byExplicit) {
    if (members.length > 1) groups.push({ key: 'family:' + key, kind: 'family', label: '规则族 ' + key, members });
  }
  const bySkeleton = new Map();
  for (const item of rows) {
    const key = skeletonOf(item);
    if (!key || !isExclusive(item)) continue;
    if (!bySkeleton.has(key)) bySkeleton.set(key, []);
    bySkeleton.get(key).push(item);
  }
  for (const [key, members] of bySkeleton) {
    if (members.length > 1) groups.push({ key: 'core:' + key, kind: 'core', label: '核心位 ' + SKELETON_LABEL.get(key), members });
  }
  return groups.sort((a, b) => a.key.localeCompare(b.key, 'en'));
}

const factUidSet = facts => {
  const set = new Set();
  for (const fact of list(facts?.facts)) for (const id of list(fact?.sourceIds)) set.add(String(id));
  for (const entry of list(facts?.tables?.cxx_actor)) set.add('character:' + text(entry.actor_key));
  return set;
};

/** 单条打分：保护 > 引用 > 事实 > 场景 > 常驻；离开场景扣分但不硬删（硬删在计划阶段统一处理）。 */
export function scoreEntry(item, ctx = {}) {
  const reasons = [];
  let score = 0;
  const uid = text(item?.uid);
  if (ctx.required?.has(uid)) { score += 1000; reasons.push('保护名单'); }
  if (ctx.historyRefs?.has(uid)) { score += 60; reasons.push('历史引用'); }
  if (ctx.factUids?.has(uid)) { score += 40; reasons.push('事实证据'); }
  const scenic = scenicOf(item);
  if (ctx.scene?.area && scenic) {
    if (scenic === ctx.scene.area) { score += 30; reasons.push('当前场景'); }
    else { score -= 400; reasons.push('场景已离开'); }
  }
  if (item?.constant) { score += 25; reasons.push('常驻'); }
  if (ctx.nextBeat?.has(uid)) { score += 20; reasons.push('下一拍候选'); }
  return { score, reasons };
}

/** 主入口：一次算完保留、冲突、预算，返回 {plan, trace, transfers, stats, unmapped}。 */
export function planSelection({
  items = [],
  previous = null,
  facts = null,
  scene = null,
  historyRefs = [],
  nextBeat = [],
  requiredUids = [],
  budget = { chars: 0 },
  limits = { chars: 0 },
} = {}) {
  const rows = list(items).filter(item => item && item.uid !== undefined);
  const byUid = new Map(rows.map(item => [text(item.uid), item]));
  const history = new Set(list(historyRefs).map(String));
  const next = new Set(list(nextBeat).map(String));
  const required = new Set(list(requiredUids).map(String));
  for (const item of rows) if (isRequired(item) && !required.has(text(item.uid))) required.add(text(item.uid));
  const ctx = { required, historyRefs: history, nextBeat: next, factUids: factUidSet(facts), scene };
  const trace = [];
  const dropped = new Set();
  const scoreOf = new Map(rows.map(item => [text(item.uid), scoreEntry(item, ctx)]));

  // ① 保护与退出：必须保留的永不因场景/冲突退出；离开场景且无历史引用的显式场景条目退出。
  for (const item of rows) {
    const uid = text(item.uid);
    if (required.has(uid)) { trace.push({ uid, action: 'keep', reason: '保护名单', ...scoreOf.get(uid) }); continue; }
    const scenic = scenicOf(item);
    if (scenic && scene?.area && scenic !== scene.area && !history.has(uid)) {
      dropped.add(uid);
      trace.push({ uid, action: 'stale', reason: 'SCENE_STALE：离开 ' + scenic, ...scoreOf.get(uid) });
    }
  }

  // ② 冲突：每组按分数取唯一 winner，其余退出并记理由。
  const conflicts = [];
  const transfers = [];
  const groups = conflictGroups(rows.filter(item => !dropped.has(text(item.uid))));
  const prevSelected = new Set(list(previous?.selectedIds).map(String));
  for (const group of groups) {
    const ranked = group.members
      .filter(item => !dropped.has(text(item.uid)))
      .sort((a, b) => (scoreOf.get(text(b.uid)).score - scoreOf.get(text(a.uid)).score) || (a.order ?? 0) - (b.order ?? 0));
    if (!ranked.length) continue;
    const winner = ranked[0];
    const winnerUid = text(winner.uid);
    for (const loser of ranked.slice(1)) {
      const uid = text(loser.uid);
      if (required.has(uid)) { trace.push({ uid, action: 'keep', reason: '保护名单压过冲突 ' + group.label, ...scoreOf.get(uid) }); continue; }
      dropped.add(uid);
      trace.push({ uid, action: 'drop', reason: '冲突落败：' + group.key + ' · 胜者 ' + winnerUid, ...scoreOf.get(uid) });
    }
    conflicts.push({ group: group.key, winner: winnerUid, members: group.members.map(item => text(item.uid)) });
    const prevWinner = list(previous?.conflicts).find(row => row.group === group.key)?.winner ?? null;
    if (prevWinner && prevWinner !== winnerUid) {
      transfers.push({ group: group.key, from: prevWinner, to: winnerUid, reason: prevSelected.has(winnerUid) ? '新候选接管核心位' : '原 winner 退出，转交 ' + winnerUid });
    }
  }

  // ③ 排序与预算：保护名单先占额度但不受预算限制，其余按分数填入。
  const competitive = rows
    .filter(item => !dropped.has(text(item.uid)) && !required.has(text(item.uid)))
    .sort((a, b) => (scoreOf.get(text(b.uid)).score - scoreOf.get(text(a.uid)).score) || (a.order ?? 0) - (b.order ?? 0));
  const charsOf = item => Number(item.bodyBytes ?? text(item.description).length) || 0;
  const cap = Number(budget?.chars ?? limits?.chars) || 0;
  let used = 0;
  for (const uid of required) {
    const item = byUid.get(uid);
    if (!item) continue;
    used += charsOf(item);
    trace.push({ uid, action: 'select', reason: '保护名单（免预算挤占）', purpose: 'required', ...scoreOf.get(uid) });
  }
  const selected = new Set([...required].filter(uid => byUid.has(uid)));
  for (const item of competitive) {
    const uid = text(item.uid), cost = charsOf(item);
    if (cap > 0 && used + cost > cap) {
      trace.push({ uid, action: 'drop', reason: '预算不足（' + (used + cost) + ' / ' + cap + ' 字符）', ...scoreOf.get(uid) });
      continue;
    }
    selected.add(uid);
    used += cost;
    const purpose = next.has(uid) ? 'next-beat' : history.has(uid) ? 'history' : scenicOf(item) && scene?.area === scenicOf(item) ? 'scene' : 'candidate';
    trace.push({ uid, action: 'select', reason: scoreOf.get(uid).reasons.join('／') || '候选排序', purpose, ...scoreOf.get(uid) });
  }

  const placements = [];
  const evidence = [];
  const purposes = { scene: [], history: [], nextBeat: [], required: [] };
  for (const uid of selected) {
    const item = byUid.get(uid);
    if (!item) continue;
    if (item.position !== undefined && item.position !== null) {
      const placement = { entryId: String(item.entryId), position: Number(item.position) };
      if (item.depth !== undefined && item.depth !== null) placement.depth = Number(item.depth);
      if (item.role) placement.role = String(item.role);
      if (item.order !== undefined && item.order !== null) placement.order = Number(item.order);
      placements.push(placement);
    }
    const scored = scoreOf.get(uid);
    evidence.push({ entryId: String(item.entryId), sourceIds: list(item.sourceIds).length ? list(item.sourceIds).map(String) : [uid], reason: scored.reasons.join('／') });
    if (required.has(uid)) purposes.required.push(uid);
  }
  for (const row of trace) {
    if (row.action !== 'select') continue;
    if (row.purpose === 'next-beat') purposes.nextBeat.push(row.uid);
    else if (row.purpose === 'history') purposes.history.push(row.uid);
    else if (row.purpose === 'scene') purposes.scene.push(row.uid);
  }

  const plan = {
    schema: SELECTION_RULES_SCHEMA,
    managedIds: rows.map(item => text(item.uid)),
    selectedIds: [...selected].filter(uid => !required.has(uid)),
    requiredIds: [...required].filter(uid => byUid.has(uid)),
    removedIds: [...dropped],
    evidence,
    conflicts,
    placements,
    bookChanges: [],
    calls: [],
    purposes,
    budget: { estimatedInputTokens: Math.round(used / 3), actualUsage: null, chars: used, cap, over: cap > 0 && used > cap },
  };
  const stats = {
    items: rows.length,
    required: plan.requiredIds.length,
    selected: selected.size,
    dropped: dropped.size,
    chars: used,
    cap,
    budgetOver: cap > 0 && used > cap,
    groups: groups.length,
    unmapped: skeletonCoverage(rows).unmapped,
  };
  return { plan, trace, transfers, stats, unmapped: stats.unmapped };
}

/** 只打印选入/保留/退出及理由，方便作者核对，不再做任何二次裁决。 */
export function explainPlan(result) {
  const rows = [];
  for (const row of list(result?.trace)) {
    const verb = row.action === 'select' ? '选入' : row.action === 'keep' ? '保留' : row.action === 'stale' ? '退出(场景)' : '退出';
    rows.push(verb + ' ' + row.uid + ' — ' + row.reason + (row.score !== undefined ? '（' + row.score + '）' : ''));
  }
  for (const row of list(result?.transfers)) rows.push('转交 ' + row.group + '：' + row.from + ' → ' + row.to + ' — ' + row.reason);
  return rows;
}
