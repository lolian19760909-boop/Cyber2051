/** U09：可复用的签名与版本化缓存。
 *  只做“同输入同版本命中、依赖变了就失效”，不猜版本、不做后台预取调度。 */
export function digestValue(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 0x811c9dc5 >>> 0;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** 目录签名：条目集合、条目正文摘要与分段数共同决定；换书、改正文、重切分段都会换签名。 */
export function catalogSignature(index = null) {
  const items = Array.isArray(index?.items) ? index.items : [];
  return digestValue([
    'catalog',
    index?.sourceHash ?? null,
    index?.indexHash ?? null,
    items.length,
    items.map(item => [String(item?.uid ?? ''), String(item?.hash ?? ''), (item?.segments || []).length]),
  ]);
}

/** 决策签名：本轮原文、现场胶囊、人物、分支、策略设置版本、书版本与目录签名。 */
export function decisionSignature({ inputText = '', capsule = '', actorId = '', branchId = '', policyRevision = null, books = null, catalog = null } = {}) {
  return digestValue(['decision', String(inputText), String(capsule), String(actorId), String(branchId), policyRevision ?? null, books ?? null, catalog ?? null]);
}

/** 版本化缓存：read 命中要求依赖签名完全一致，否则丢旧值并记一次 drop。 */
export function createVersionedCache({ limit = 24 } = {}) {
  const store = new Map();
  const stats = { hits: 0, misses: 0, drops: 0, writes: 0 };
  function read(key, deps) {
    const row = store.get(key);
    if (!row) { stats.misses++; return null; }
    if (row.deps !== deps) { store.delete(key); stats.drops++; stats.misses++; return null; }
    stats.hits++;
    return row.value;
  }
  function write(key, deps, value) {
    stats.writes++;
    if (store.size >= limit) {
      const oldest = store.keys().next().value;
      store.delete(oldest);
    }
    store.set(key, { deps, value, at: Date.now() });
    return value;
  }
  function clear() { store.clear(); stats.hits = stats.misses = stats.drops = stats.writes = 0; }
  return { read, write, clear, get stats() { return { ...stats, size: store.size }; } };
}
