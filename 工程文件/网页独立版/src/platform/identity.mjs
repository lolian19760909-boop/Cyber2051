/**
 * 构建与运行身份：构建回执、扩展自检、网页启动三处共用同一份指纹定义。
 *
 * 卡片身份只认稳定字段（规范、版本、首句、开场白、提示词四段）。
 * 名字、作者、世界书条数会被合法改动：导入时可以改名，运行期接管会往角色卡里追加
 * 条目（[mvu_plot] 等）。这些单独报告为"漂移"，既不参与一致性判定，也不当成卡被换了。
 */

const TAGS = ['system_prompt', 'post_history_instructions', 'scenario', 'personality', 'mes_example'];
const RUNTIME_BOOK = /^(?:TavernDB-ACU-|\[mvu_plot\]|\[mvu_update\]|\[initvar\])/;

/** UTF-8 文本或字节 → 小写十六进制 sha256。浏览器与 Node 都有 WebCrypto。 */
export async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value ?? ''));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cardData(card) {
  if (!card || typeof card !== 'object') return {};
  return card.data && typeof card.data === 'object' ? card.data : card;
}

function bookEntries(card) {
  const book = cardData(card).character_book?.entries;
  if (Array.isArray(book)) return book;
  if (book && typeof book === 'object') return Object.values(book);
  return [];
}

/** 世界书：总条数与运行期接管条数分开数，避免把宿主写入当成构建差异。 */
export function bookStats(card) {
  const entries = bookEntries(card);
  let runtime = 0;
  let enabled = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (RUNTIME_BOOK.test(String(entry.comment ?? entry.name ?? ''))) runtime++;
    if (entry.enabled !== false) enabled++;
  }
  return { entries: entries.length, enabled, runtimeManaged: runtime };
}

/**
 * 卡片身份透镜。长字段只留 sha256（开场白正文可能上百 KB），
 * 名字/规范/版本/作者留原文，出问题时能直接看出是哪一版。
 */
export async function cardLens(card) {
  if (!card || typeof card !== 'object') return null;
  const data = cardData(card);
  const hash = (value) => sha256Hex(String(value ?? ''));
  const greetings = Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [];
  return {
    name: String(data.name ?? ''),
    spec: String(card.spec ?? data.spec ?? ''),
    characterVersion: String(data.character_version ?? ''),
    creator: String(data.creator ?? ''),
    firstMessageSha256: await hash(data.first_mes),
    greetingSha256: await Promise.all(greetings.map(hash)),
    promptSha256: await Promise.all(TAGS.map((key) => hash(data[key]))),
    book: bookStats(card),
  };
}

/**
 * 透镜的规范文本：扩展侧与构建侧比的就是这一串。
 * 名字、作者不参与比对；spec 也不参与——同一张卡经宿主读出来会报 chara_card_v3，
 * 那只是宿主的封装规范，不是卡的内容。版本与四段正文指纹才是内容身份。
 */
export function lensText(lens) {
  if (!lens || typeof lens !== 'object') return '';
  return JSON.stringify({ characterVersion: lens.characterVersion, firstMessageSha256: lens.firstMessageSha256 ?? '', greetingSha256: lens.greetingSha256 ?? [], promptSha256: lens.promptSha256 ?? [] });
}

/** 会被合法改变的字段：只报告，不算不一致。 */
export function lensDrift(actual, expected) {
  if (!actual || !expected) return null;
  const drift = {};
  if (actual.name !== expected.name) drift.name = { actual: actual.name, expected: expected.name };
  if (actual.creator !== expected.creator) drift.creator = { actual: actual.creator, expected: expected.creator };
  if (actual.book && expected.book && JSON.stringify(actual.book) !== JSON.stringify(expected.book)) drift.book = { actual: actual.book, expected: expected.book };
  return Object.keys(drift).length ? drift : null;
}
