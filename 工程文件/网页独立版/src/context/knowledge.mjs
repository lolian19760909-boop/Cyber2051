/** U02: one unified knowledge item model over the maintained worldbook, plus the prompts that consume it.
 *  Pure data: no fs, no DOM, safe for both the build and the browser bundle. */
export const KNOWLEDGE_SCHEMA = 1;

export const CATEGORIES = [
  { id: 'character', label: '人物' },
  { id: 'org', label: '组织' },
  { id: 'place', label: '地点' },
  { id: 'item', label: '物品' },
  { id: 'quest', label: '委托' },
  { id: 'chapter', label: '章节' },
  { id: 'lore', label: '世界设定' },
  { id: 'rule', label: '规则' },
  { id: 'state', label: '状态与变量' },
  { id: 'persona', label: '人设' },
  { id: 'database', label: '数据库' },
  { id: 'generic', label: '通用' },
];

const META_KEYS = ['DOULUO_AGENT_SKILL_V2', 'ACU_SKILL_META', 'dm_agent_skill'];
const text = value => (value === undefined || value === null ? '' : String(value));

/** Small stable string hash; only used to build deterministic ids and invalidation keys. */
export function hash32(value) {
  let h = 0x811c9dc5;
  const s = text(value);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const digestish = value => hash32(value).toString(36).padStart(7, '0');

/** Short id that round-trips to exactly one book entry: same book + same entry id always the same, different books never collide. */
export function shortId(bookId, entryId, existing = null) {
  const base = digestish(bookId + '#' + text(entryId));
  if (!existing) return base;
  for (let length = 1; length <= 8; length++) {
    const candidate = length === 1 ? base : base.slice(0, -length) + digestish(bookId + '#' + text(entryId) + '#' + length).slice(-length);
    if (!existing.has(candidate)) return candidate;
  }
  return base + '_' + text(entryId);
}

export function uidOf(bookId, entryId) {
  return text(bookId) + ':' + text(entryId);
}

/** Original skill metadata, when a book actually carries it. Absent on 2051 today, so callers fall back to derived fields. */
export function skillMeta(entry) {
  const ext = entry?.extensions || {};
  for (const key of META_KEYS) {
    const raw = ext[key];
    if (raw && typeof raw === 'object') return { origin: key, fields: structuredClone(raw) };
  }
  const comment = text(entry?.comment);
  const marker = comment.match(/(DOULUO_AGENT_SKILL_V2|ACU_SKILL_META)\s*[:：]\s*(\{[\s\S]*\})\s*$/);
  if (!marker) return null;
  try {
    return { origin: marker[1], fields: JSON.parse(marker[2]), trailing: comment.slice(0, marker.index) };
  } catch {
    return null;
  }
}

/** Category for one entry. Original metadata wins; otherwise the rules follow how the 2051 book is actually written
 *  (bracket tags, `企业：/地点：` prefixes, quest stage vocabulary, body section markers), and anything unseen stays 通用. */
const QUEST_STAGES = ['了解现场与协助意愿', '核对线索与实际处置', '结果与交接', '确认委托范围'];
const firstLine = body => (text(body).split('\n').find(line => line.trim()) || '').trim();
const plainTitle = value => text(value).replace(/^【[^】]*】/, '').replace(/（[^）]*）$/, '').trim();
export function categoryOf(entry) {
  const meta = skillMeta(entry);
  const declared = text(meta?.fields?.category || meta?.fields?.分类);
  if (declared) {
    const hit = CATEGORIES.find(row => row.label === declared || row.id === declared);
    if (hit) return { id: hit.id, label: hit.label, reason: 'metadata' };
    return { id: 'generic', label: '通用', reason: 'metadata-unknown', declared };
  }
  const comment = text(entry?.comment);
  const body = text(entry?.content);
  const head = firstLine(body);
  const has = (...needles) => needles.some(needle => comment.includes(needle));
  if (/^\[?(?:mvu_update|initvar|数据库当前状态|数据库更新格式)\]?|^mvu变量|^变量|^旧变量|^\[config_override\]|^\[已停用\]/.test(comment)) return { id: 'state', label: '状态与变量', reason: 'comment-tag' };
  if (has('物品目录', '物品：')) return { id: 'item', label: '物品', reason: 'comment-prefix' };
  if (comment.startsWith('[章节资料]') || /^主线[一二三四五六七八九十]/.test(comment) || comment.startsWith('剧情：')) return { id: 'chapter', label: '章节', reason: 'comment-prefix' };
  if (QUEST_STAGES.some(stage => comment.includes(stage))) return { id: 'quest', label: '委托', reason: 'quest-stage' };
  if (comment.startsWith('user人设')) return { id: 'persona', label: '人设', reason: 'comment-prefix' };
  if (comment.startsWith('人物：') || comment.startsWith('角色：')) return { id: 'character', label: '人物', reason: 'comment-prefix' };
  if (/^(姓名|年龄|身份|住所|代号)[:：]/.test(plainTitle(head)) || (head.startsWith('<') && body.includes('姓名：')) || (head.startsWith('<') && /【(?:身份与活动范围|外貌识别特征|性格与行为动机|关键经历)】/.test(body))) return { id: 'character', label: '人物', reason: 'body-person' };
  if (comment.startsWith('地点：') || comment.includes('：地点与设施') || /^【地点】/.test(head) || head.startsWith('地点详情：')) return { id: 'place', label: '地点', reason: 'place-marker' };
  if (/^(企业|乐队|偶像组合|街头势力|组织|集团|帮派)[:：]/.test(comment) || head.startsWith('乐队详情：')) return { id: 'org', label: '组织', reason: 'comment-prefix' };
  if (has('状态栏', '选项', '协议', '文风', '玩法', '游玩', '委托日志', '委托系统', '推进', '变量')) return { id: 'rule', label: '规则', reason: 'rule-keyword' };
  if (has('世界观', '编年史', '常识', '治安', '名词解释', '义体与医疗', '机偶体系')) return { id: 'lore', label: '世界设定', reason: 'lore-keyword' };
  const stripped = plainTitle(comment);
  if (stripped.length >= 2 && !/[：:·]/.test(stripped) && plainTitle(head).startsWith(stripped.slice(0, 6)) && body.length >= 120) return { id: 'lore', label: '世界设定', reason: 'titled-narrative' };
  return { id: 'generic', label: '通用', reason: 'default' };
}
/** Split one long body into recoverable segments: joining the slices reproduces the original exactly. */
export function splitSegments(body, limit = 900) {
  const source = text(body);
  if (!source) return [];
  if (source.length <= limit) return [{ index: 0, start: 0, end: source.length, sha256: digestish(source) }];
  const rows = [];
  let start = 0;
  while (start < source.length) {
    let end = Math.min(source.length, start + limit);
    if (end < source.length) {
      const slice = source.slice(start, end);
      const cut = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'));
      if (cut > limit * 0.4) end = start + cut + 1;
    }
    rows.push({ index: rows.length, start, end, sha256: digestish(source.slice(start, end)) });
    start = end;
  }
  return rows;
}

/** Rebuild the exact body from its segments. */
export function joinSegments(body, segments) {
  const source = text(body);
  return (segments || []).map(row => source.slice(row.start, row.end)).join('');
}

/** Read aliases / keywords / era / chapter from the entry itself; 2051 keeps them in keys and comment tails. */
function facets(entry) {
  const meta = skillMeta(entry)?.fields || {};
  const keys = Array.isArray(entry?.keys) ? entry.keys.map(text).filter(Boolean) : [];
  const aliases = [...new Set([...(meta.aliases || meta.别名 || []).map(text), ...keys].filter(Boolean))];
  const comment = text(entry?.comment);
  const named = comment.match(/^[^\s(（]{2,12}[（(]([^）)]{1,24})[）)]/);
  const era = text(meta.era || meta.时代 || '');
  const chapter = text(meta.chapter || meta.章节 || (comment.startsWith('[章节资料]') ? comment.slice(6) : ''));
  return { aliases, named: named ? [named[1]] : [], era: era || '通用', chapter, keys, meta };
}

export function knowledgeItem(entry, { bookId = 'card', bookName = '', index = 0, taken = null } = {}) {
  const body = text(entry?.content);
  const found = facets(entry);
  const category = categoryOf(entry);
  const meta = skillMeta(entry);
  const item = {
    uid: uidOf(bookId, entry?.id),
    shortId: shortId(bookId, entry?.id, taken),
    bookId,
    bookName,
    entryId: entry?.id ?? index,
    order: index,
    title: text(entry?.comment) || text(entry?.name) || text(entry?.keys?.[0]) || '条目 ' + (entry?.id ?? index),
    aliases: [...new Set([...found.aliases, ...found.named])],
    category: category.id,
    categoryLabel: category.label,
    categoryReason: category.reason,
    era: found.era,
    chapter: found.chapter,
    description: body,
    descriptionOrigin: body ? 'body' : 'empty',
    bodyBytes: body.length,
    bodySha256: digestish(body),
    segments: splitSegments(body),
    keywords: found.keys,
    metaOrigin: meta ? meta.origin : 'derived',
    metaFields: meta ? structuredClone(meta.fields) : null,
    extensions: entry?.extensions ? structuredClone(entry.extensions) : {},
    enabled: entry?.enabled !== false,
    constant: entry?.constant === true,
    position: entry?.position ?? null,
    depth: entry?.depth ?? null,
    role: entry?.role ?? null,
  };
  item.hash = itemHash(item);
  return item;
}

/** Everything that can invalidate an item, and nothing that merely re-renders it. */
export function itemHash(item) {
  return digestish(JSON.stringify([item.uid, item.description, JSON.stringify(item.metaFields), item.enabled, item.keywords, item.position, item.depth, item.role, item.extensions]));
}

/** Write selected fields back onto the original entry without dropping anything we did not touch. */
export function entryFromItem(item, entry = {}) {
  const next = structuredClone(entry);
  if (item.description !== undefined) next.content = item.description;
  if (item.title !== undefined) next.comment = item.title;
  if (Array.isArray(item.keywords)) next.keys = [...item.keywords];
  if (item.enabled !== undefined) next.enabled = item.enabled;
  if (item.position !== undefined && item.position !== null) next.extensions = { ...(next.extensions || {}), position: item.position };
  if (item.metaOrigin && item.metaOrigin !== 'derived' && item.metaFields) next.extensions = { ...(next.extensions || {}), [item.metaOrigin]: structuredClone(item.metaFields) };
  if (item.extensions && Object.keys(item.extensions).length) next.extensions = { ...(next.extensions || {}), ...structuredClone(item.extensions) };
  return next;
}

/** Directory groups: one per category and one per book, each with its own invalidation hash. */
export function groupsOf(items) {
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }
  const rows = [];
  for (const row of CATEGORIES) {
    const members = (byCategory.get(row.id) || []).slice().sort((a, b) => a.uid.localeCompare(b.uid, 'en'));
    if (!members.length) continue;
    rows.push({ id: 'category:' + row.id, kind: 'category', label: row.label, itemUids: members.map(item => item.uid), hash: digestish(JSON.stringify(members.map(item => [item.uid, item.hash]))) });
    byCategory.delete(row.id);
  }
  for (const [id, members] of byCategory) {
    const sorted = members.slice().sort((a, b) => a.uid.localeCompare(b.uid, 'en'));
    rows.push({ id: 'category:' + id, kind: 'category', label: id, itemUids: sorted.map(item => item.uid), hash: digestish(JSON.stringify(sorted.map(item => [item.uid, item.hash]))) });
  }
  const byBook = new Map();
  for (const item of items) {
    if (!byBook.has(item.bookId)) byBook.set(item.bookId, []);
    byBook.get(item.bookId).push(item);
  }
  for (const [bookId, members] of byBook) {
    const sorted = members.slice().sort((a, b) => a.uid.localeCompare(b.uid, 'en'));
    rows.push({ id: 'book:' + bookId, kind: 'book', label: members[0]?.bookName || bookId, itemUids: sorted.map(item => item.uid), hash: digestish(JSON.stringify(sorted.map(item => [item.uid, item.hash]))) });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

/** Build the whole index from one or more books. Deterministic: same input, same hashes, no timestamps inside. */
export function buildKnowledgeIndex(books, { sourceHash = null } = {}) {
  const list = Array.isArray(books) ? books : [books];
  const taken = new Set();
  const items = [];
  const booksOut = [];
  for (const book of list) {
    if (!book) continue;
    const bookId = text(book.bookId || book.id || 'card');
    const entries = book.entries || book.character_book?.entries || [];
    booksOut.push({ bookId, name: text(book.name || book.bookName || ''), entries: entries.length });
    entries.forEach((entry, index) => {
      const item = knowledgeItem(entry, { bookId, bookName: text(book.name || book.bookName || ''), index, taken });
      taken.add(item.shortId);
      items.push(item);
    });
  }
  const groups = groupsOf(items);
  const indexHash = digestish(JSON.stringify(items.map(item => [item.uid, item.hash]).concat(groups.map(group => [group.id, group.hash]))));
  return {
    schema: KNOWLEDGE_SCHEMA,
    sourceHash,
    indexHash,
    books: booksOut,
    items,
    groups,
    stats: { items: items.length, books: booksOut.length, groups: groups.length, longItems: items.filter(item => item.segments.length > 1).length, derivedMeta: items.filter(item => item.metaOrigin === 'derived').length },
  };
}

/** Query surface shared by the build, the extension and the browser app. */
export function knowledgeQuery(index) {
  const items = index?.items || [];
  const byUid = new Map(items.map(item => [item.uid, item]));
  const byShort = new Map(items.map(item => [item.shortId, item]));
  const byEntry = new Map(items.map(item => [text(item.bookId) + '#' + text(item.entryId), item]));
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }
  const groups = new Map((index?.groups || []).map(group => [group.id, group]));
  return {
    index,
    size: items.length,
    get(uid) { return byUid.get(uid) || null; },
    byShortId(id) { return byShort.get(id) || null; },
    entry(bookId, entryId) { return byEntry.get(text(bookId) + '#' + text(entryId)) || null; },
    category(id) { return (byCategory.get(id) || []).slice(); },
    group(id) { return groups.get(id) || null; },
    /** Title/alias/keyword search; different books stay apart because items, not titles, are returned. */
    search(term, limit = 20) {
      const needle = text(term).toLowerCase();
      if (!needle) return [];
      const out = [];
      for (const item of items) {
        const hay = [item.title, ...item.aliases, ...item.keywords].map(value => text(value).toLowerCase());
        const score = hay.reduce((best, value) => (value === needle ? 3 : value.includes(needle) ? Math.max(best, 2) : best), 0);
        if (score) out.push({ item, score });
      }
      return out.sort((a, b) => b.score - a.score || a.item.bookId.localeCompare(b.item.bookId, 'en') || a.item.order - b.item.order).slice(0, limit).map(row => row.item);
    },
    /** Which groups an item change invalidates. */
    affected(uid) {
      if (!byUid.has(uid)) return [];
      return (index?.groups || []).filter(group => group.itemUids.includes(uid)).map(group => group.id);
    },
  };
}

/** Prompt material for regenerating descriptions and merging them back, with the reusable-fragment list. */
export function agentPrompts(index = { items: [] }, { missing = null } = {}) {
  return {
    schema: KNOWLEDGE_SCHEMA,
    purpose: 'skill',
    source: '2051-derived',
    missing,
    skillPrompt: [
      '你在为东京都2051维护一份可被检索的条目说明。',
      '输出 JSON：{"items":[{"uid":"<原样回填>","description":"<说明正文>","aliases":["<别名>"],"keywords":["<触发词>"],"era":"<时代或通用>","chapter":"<章节或空>"}]}',
      '规则：1) 只用给定条目正文与已有元数据，不引入未出现的人名、物品与设定；2) description 保留原文事实，写清这条资料在故事里解决什么问题、与谁相关；3) 正文过长时按给定片段逐段概述，最后合并成一段完整说明，不丢片段；4) uid 必须原样回填，便于写回原条目；5) 拿不准的字段留空，不要编造。',
    ].join('\n'),
    segmentRules: '长正文按 900 字符切段，优先在段落/换行处断开；逐段生成后按 index 顺序合并，合并结果必须覆盖全部分段，缺段即视为失败。',
    mergeRules: '合并只覆盖 description／aliases／keywords／era／chapter 五个字段，其余字段与 extensions 原样保留；写回按 uid 定位原条目，不改条目 id、不改世界书顺序。',
    manualPatch: '人工修补直接改 description／aliases／keywords；修补后重算该条 bodySha256 与 hash，只失效该条与所属目录组。',
    processedFragments: (index.items || []).filter(item => item.description).map(item => ({ uid: item.uid, bodySha256: item.bodySha256, segments: item.segments.length })),
  };
}

/** Apply a model answer back onto the index items; returns the changed items and their invalidation groups. */
export function applySkillAnswer(index, answer) {
  const query = knowledgeQuery(index);
  const rows = Array.isArray(answer?.items) ? answer.items : [];
  const changed = [];
  for (const row of rows) {
    const item = row?.uid ? query.get(text(row.uid)) : null;
    if (!item) continue;
    const next = { ...item };
    if (row.description) next.description = text(row.description);
    if (Array.isArray(row.aliases)) next.aliases = [...new Set(row.aliases.map(text).filter(Boolean))];
    if (Array.isArray(row.keywords)) next.keywords = [...new Set(row.keywords.map(text).filter(Boolean))];
    if (row.era) next.era = text(row.era);
    if (row.chapter !== undefined) next.chapter = text(row.chapter);
    next.bodySha256 = digestish(next.description);
    next.segments = splitSegments(next.description);
    next.hash = itemHash(next);
    changed.push({ item: next, groups: query.affected(item.uid) });
  }
  return changed;
}


/** Digest over exactly the fields that decide invalidation; stored as index.indexHash. */
export function knowledgeDigest(index) {
  return digestish(JSON.stringify((index.items || []).map(item => [item.uid, item.hash]).concat((index.groups || []).map(group => [group.id, group.hash]))));
}

/** Recompute and compare with the stored digest, so a tampered or stale file fails loudly instead of silently. */
export function verifyKnowledgeIndex(index) {
  const digest = knowledgeDigest(index);
  return { ok: !!index && digest === index.indexHash, digest, indexHash: index?.indexHash ?? null, items: index?.items?.length || 0, groups: index?.groups?.length || 0 };
}
export const knowledgeInternal = { digestish };