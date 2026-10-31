/** U11: read the shipped data files with one retry, and keep the rows for version diagnostics. */
const DEFAULT_RETRIES = 1;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function loadJsonWithRetry(url, { fetchImpl = globalThis.fetch, retries = DEFAULT_RETRIES, backoffMs = 400, record = null, timeoutMs = 20000 } = {}) {
  const rows = [];
  let attempt = 0;
  let lastError = null;
  while (attempt <= retries) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw Object.assign(new Error(url + ' 读取失败（' + response.status + '）'), { status: response.status });
      const value = await response.json();
      rows.push({ url: String(url), ok: true, attempt, ms: Date.now() - started, status: 200 });
      if (record) record.push(...rows);
      return value;
    } catch (error) {
      rows.push({ url: String(url), ok: false, attempt, ms: Date.now() - started, status: Number(error?.status) || 0, error: String(error?.message || error) });
      lastError = error;
      attempt += 1;
      if (attempt <= retries) await wait(backoffMs * attempt);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  if (record) record.push(...rows);
  throw lastError || new Error(url + ' 读取失败');
}

/** What the page loaded, which build it is, and where it came from — for 本局信息. */
export function loaderSummary({ release = null, identity = null, rows = [] } = {}) {
  // A retried read leaves both attempts in the log; only the last attempt per URL decides success.
  const last = new Map();
  for (const row of rows) last.set(String(row.url), row);
  const ok = [...last.values()].filter(row => row.ok);
  const failed = [...last.values()].filter(row => !row.ok);
  const retried = rows.filter(row => row.attempt > 0);
  const buildId = String(release?.buildId || identity?.buildId || 'unknown');
  const sameBuild = !identity?.buildId || !release?.buildId || String(identity.buildId) === String(release.buildId);
  return {
    buildId,
    engineVersion: release?.engineVersion ?? identity?.engineVersion ?? null,
    contentVersion: release?.contentVersion ?? identity?.contentVersion ?? null,
    identityMatch: sameBuild,
    files: ok.length,
    failed: failed.map(row => row.url),
    retries: retried.length,
    remoteOrigins: Array.isArray(identity?.loader?.remoteOrigins) ? identity.loader.remoteOrigins.map(row => row.origin || row) : [],
    template: identity?.loader?.template || null,
    status: failed.length ? 'degraded' : rows.length ? 'ok' : 'unknown',
  };
}

export function loaderLine(summary) {
  if (!summary) return '尚未读取发布身份';
  const parts = ['构建 ' + summary.buildId];
  if (summary.contentVersion) parts.push('内容 ' + String(summary.contentVersion).split('+')[0]);
  parts.push('数据 ' + summary.files + ' 个' + (summary.failed.length ? '（缺 ' + summary.failed.length + '）' : ''));
  if (summary.retries) parts.push('重试 ' + summary.retries + ' 次');
  if (summary.identityMatch === false) parts.push('身份不一致');
  if (summary.remoteOrigins.length) parts.push('外部源 ' + summary.remoteOrigins.join('、'));
  return parts.join(' · ');
}
