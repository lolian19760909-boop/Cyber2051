/** U02 acceptance: one index over the maintained worldbook, with invalidation, segment rebuild, field round-trip,
 *  same-name-different-book separation, and readability of the built artifacts in local / extension / release copies. */
import fs from 'node:fs';
import path from 'node:path';
import {buildKnowledgeIndex,knowledgeQuery,agentPrompts,applySkillAnswer,entryFromItem,joinSegments,splitSegments,verifyKnowledgeIndex} from '../src/context/knowledge.mjs';

const WEB = path.resolve(import.meta.dirname, '..');
const checks = [];
const record = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
const card = JSON.parse(fs.readFileSync(path.join(WEB, 'generated/card.json'), 'utf8'));
const entries = card.data.character_book.entries;
const base_ = { bookId: 'card', name: '东京都2051', entries };

const baseIndex = buildKnowledgeIndex(base_);
const q = knowledgeQuery(baseIndex);
record('索引覆盖世界书全部条目', baseIndex.stats.items === entries.length && baseIndex.stats.books === 1, { items: baseIndex.stats.items, entries: entries.length, groups: baseIndex.stats.groups, longItems: baseIndex.stats.longItems });

// 1) one changed entry only invalidates itself plus its directory groups
const target = entries.find(e => e.comment === '[章节资料]盗芯之夜 · 303酒店') || entries[0];
const mutated = entries.map(e => (e === target ? { ...e, content: e.content + '\nU02 追加一句用于失效测试。' } : e));
const nextIndex = buildKnowledgeIndex({ ...base_, entries: mutated });
const before = new Map(baseIndex.items.map(i => [i.uid, i.hash]));
const changedItems = nextIndex.items.filter(i => before.get(i.uid) !== i.hash).map(i => i.uid);
const targetUid = 'card:' + target.id;
const beforeGroups = new Map(baseIndex.groups.map(g => [g.id, g.hash]));
const changedGroups = nextIndex.groups.filter(g => beforeGroups.get(g.id) !== g.hash).map(g => g.id);
record('改一条只失效该条及其目录', changedItems.length === 1 && changedItems[0] === targetUid && changedGroups.every(id => id === 'category:chapter' || id === 'book:card') && changedGroups.length === 2, { changedItems, changedGroups });

// 2) long bodies rebuild exactly from their segments
const longItems = baseIndex.items.filter(i => i.segments.length > 1);
const rebuilt = longItems.filter(i => joinSegments(i.description, i.segments) === i.description);
const shaOk = longItems.every(i => i.segments.every(s => splitSegments(i.description).find(x => x.index === s.index)?.sha256 === s.sha256));
record('长条目全片段可重建完整正文', longItems.length > 0 && rebuilt.length === longItems.length && shaOk, { long: longItems.length, rebuilt: rebuilt.length, maxSegments: Math.max(...longItems.map(i => i.segments.length)) });

// 3) original metadata and untouched fields survive the round trip
const fixture = { id: 9001, comment: '人物：往返样例', keys: ['往返样例', 'roundtrip'], content: '<Sample>\n姓名：往返样例\n身份：测试用', enabled: true, constant: false, position: 1, depth: 4, role: 1,
  extensions: { position: 1, depth: 4, role: 1, DOULUO_AGENT_SKILL_V2: { category: '人物', era: '2051', aliases: ['别名甲'], keep: { nested: [1, 2, 3] } }, custom: ' untouched ' } };
const fixtureIndex = buildKnowledgeIndex({ bookId: 'card', name: '夹具', entries: [fixture] });
const fixtureItem = fixtureIndex.items[0];
const roundTripped = entryFromItem(fixtureItem, fixture);
const kept = JSON.stringify(roundTripped) === JSON.stringify(fixture);
const answered = applySkillAnswer(fixtureIndex, { items: [{ uid: fixtureItem.uid, description: '改写后的说明' }] })[0];
const written = entryFromItem(answered.item, roundTripped);
const onlyBody = written.content === '改写后的说明' && JSON.stringify({ ...written, content: fixture.content }) === JSON.stringify(fixture);
record('原字段往返不丢且写回只改目标字段', kept && onlyBody && fixtureItem.metaOrigin === 'DOULUO_AGENT_SKILL_V2' && fixtureItem.category === 'character', { kept, onlyBody, metaOrigin: fixtureItem.metaOrigin, category: fixtureItem.category, groups: answered.groups });

// 4) same title in two books never collides
const twoBooks = buildKnowledgeIndex([
  { bookId: 'bookA', name: '甲书', entries: [{ id: 1, comment: '同名条目', content: '甲的正文', keys: [], extensions: {} }] },
  { bookId: 'bookB', name: '乙书', entries: [{ id: 1, comment: '同名条目', content: '乙的正文', keys: [], extensions: {} }] },
]);
const twoQ = knowledgeQuery(twoBooks);
const hits = twoQ.search('同名条目');
record('同名不同书不串', hits.length === 2 && twoQ.get('bookA:1').description === '甲的正文' && twoQ.get('bookB:1').description === '乙的正文' && twoQ.get('bookA:1').shortId !== twoQ.get('bookB:1').shortId && hits[0].bookId !== hits[1].bookId, { hits: hits.map(i => i.uid + '/' + i.shortId) });

// 5) prompts carry the reusable fragment list and the known gap
const prompts = agentPrompts(baseIndex, { missing: 'K27' });
const withBody = baseIndex.items.filter(i => String(i.description || '').length > 0).length;
record('生成提示带可复用片段与缺口', prompts.processedFragments.length === withBody && prompts.processedFragments.every(row => row.bodySha256 && row.segments >= 1) && prompts.missing === 'K27', { fragments: prompts.processedFragments.length, withBody, empty: baseIndex.stats.items - withBody, missing: prompts.missing });

// 6) built artifacts readable in local build, release copy and extension app copy
function readBuilt(file) {
  if (!fs.existsSync(file)) return { file: path.relative(WEB, file), status: 'missing' };
  const index = JSON.parse(fs.readFileSync(file, 'utf8'));
  const verify = verifyKnowledgeIndex(index);
  return { file: path.relative(WEB, file), status: verify.ok ? 'ok' : 'mismatch', indexHash: verify.indexHash, items: verify.items, groups: verify.groups };
}
const generated = readBuilt(path.join(WEB, 'generated/knowledge-index.json'));
const distData = readBuilt(path.join(WEB, 'dist/data/knowledge-index.json'));
const extData = readBuilt(path.join(WEB, 'artifacts/st-extension/app/data/knowledge-index.json'));
let release = { file: '(未找到 dist/releases)', status: 'missing' };
const releasesDir = path.join(WEB, 'dist/releases');
if (fs.existsSync(releasesDir)) {
  const ids = fs.readdirSync(releasesDir).sort();
  for (const id of ids.reverse()) {
    const candidate = readBuilt(path.join(releasesDir, id, 'data/knowledge-index.json'));
    if (candidate.status !== 'missing') { release = candidate; break; }
  }
}
const manifest = JSON.parse(fs.readFileSync(path.join(WEB, 'generated/manifest.json'), 'utf8'));
const sameHash = [generated, distData, extData, release].every(row => row.status === 'ok' && row.indexHash === manifest.knowledge?.indexHash);
record('新产物在生成物／本地／扩展／发布四处可读且摘要一致', sameHash && manifest.knowledge?.items === baseIndex.stats.items, { generated, distData, extData, release, manifestHash: manifest.knowledge?.indexHash, manifestItems: manifest.knowledge?.items });

const failed = checks.filter(row => !row.ok);
const report = { schema: 1, at: new Date().toISOString(), scope: 'U02 knowledge index and prompts; build outputs only, no deployment', stats: baseIndex.stats, checks, verdict: failed.length ? 'failed: ' + failed.map(row => row.name).join(' / ') : 'all ' + checks.length + ' checks passed' };
fs.mkdirSync(path.join(WEB, 'reports'), { recursive: true });
fs.writeFileSync(path.join(WEB, 'reports/u02-knowledge-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ verdict: report.verdict, stats: report.stats, checks: checks.map(row => (row.ok ? 'PASS ' : 'FAIL ') + row.name) }, null, 2));
if (failed.length) process.exitCode = 1;
