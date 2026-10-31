// 赛博小祥2051 · 工坊网关 v0.5.0（工坊 C1：Discord OAuth 登录链）
// 契约来源：E5 §10（鉴权/隐私）+ 参考架构 login-handoff 模式（reference-dmrh 对照分析）。
// 新增：login-handoff 四端点 + HMAC 会话 token + publishers 身份表（隐私最小化）+ 投稿绑定作者身份。
// 隐私红线：身份表只存 加盐哈希(discordId)+随机 publisherId+时间；不存昵称/邮箱/头像/原始 ID。
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createPagination, PaginationError } = require('./pagination.cjs');

const PORT = Number(process.env.CXX_GATEWAY_PORT || 8787);
const HOST = '127.0.0.1';
const ADMIN_TOKEN = String(process.env.CXX_ADMIN_TOKEN || '');
const IP_SALT = String(process.env.CXX_IPSALT || '');
const DB_PATH = process.env.CXX_DB_PATH || path.join(__dirname, "data/workshop.db");
const STORAGE_ROOT = process.env.CXX_STORAGE || path.join(__dirname, "storage");
// OAuth（未配置时登录端点返回 503 oauth_not_configured，其余功能不受影响）
const DISCORD_CLIENT_ID = String(process.env.DISCORD_CLIENT_ID || '');
const DISCORD_CLIENT_SECRET = String(process.env.DISCORD_CLIENT_SECRET || '');
const DISCORD_REDIRECT_URI = String(process.env.DISCORD_REDIRECT_URI || ''); // 建议显式配置: https://cyber2051.top/api/workshop/oauth/callback
const OAUTH_SALT = String(process.env.OAUTH_SALT || IP_SALT); // discordId 加盐哈希用
const SESSION_SECRET = String(process.env.SESSION_SECRET || '');
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;           // 会话 token 30 天
const HANDOFF_TTL_MS = 10 * 60 * 1000;                   // handoff 有效期 10 分钟
const HANDOFF_READY_TTL_MS = 5 * 60 * 1000;              // 回调完成后领取窗口

const SUB_MAX_BYTES = 50 * 1024;
const TITLE_MAX = 60;
const DESC_MAX = 2000;
const BODY_KEY_MAX = 40000;
const REQ_MAX_BYTES = 64 * 1024;
const ATT_MAX_BYTES = 10 * 1024 * 1024;   // 附件上限 10MB
const ATT_EXT = { png: 'image/png', json: 'application/json', txt: 'text/plain', js: 'text/javascript' };
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 10;               // 投稿/改稿/附件每小时上限（校验失败的请求不占名额）
// 与投稿契约同源；代码提案仅供下一版卡集成，绝不生成安装包。
const ALLOWED_TYPES = require('./workshop-contract.cjs').TYPES;
const TAGS_MAX = 8;
const pagination = createPagination(SESSION_SECRET || ADMIN_TOKEN);

if (!ADMIN_TOKEN || !IP_SALT) { console.error('[gateway] 缺 CXX_ADMIN_TOKEN/CXX_IPSALT —— 拒绝启动'); process.exit(1); }
if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET && !SESSION_SECRET) { console.error('[gateway] OAuth 已配置但缺 SESSION_SECRET —— 拒绝启动'); process.exit(1); }

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL, nickname TEXT, body TEXT NOT NULL,
  ip_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status, id);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, summary TEXT DEFAULT '',
  author_name TEXT, tags TEXT DEFAULT '[]',
  payload TEXT NOT NULL, content_hash TEXT NOT NULL,
  edit_key_hash TEXT NOT NULL, ip_hash TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  review_note TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions (status, id);
CREATE TABLE IF NOT EXISTS publishers (
  publisher_id    TEXT PRIMARY KEY,
  discord_id_hash TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL,
  last_login_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publishers_ext_ready (id INTEGER); -- 占位表确保本段执行
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'site' CHECK (kind IN ('card','site','event')),
  pinned INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_handoffs (
  handoff_id  TEXT PRIMARY KEY,
  challenge   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','redeemed')),
  publisher_id TEXT,
  display_name TEXT,
  session_token TEXT,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
`);
try { db.exec("ALTER TABLE submissions ADD COLUMN publisher_id TEXT"); } catch {}
try { db.exec("ALTER TABLE publishers ADD COLUMN display_name_last TEXT"); } catch {}
try { db.exec("ALTER TABLE publishers ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch {}
try { db.exec("ALTER TABLE publishers ADD COLUMN banned_reason TEXT"); } catch {}
try { db.exec("ALTER TABLE publishers ADD COLUMN banned_at TEXT"); } catch {}
try { db.exec("ALTER TABLE feedback ADD COLUMN publisher_id TEXT"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_sub_publisher ON submissions (publisher_id)"); } catch {}
const submissionHistory = require('./submission-history.cjs').createHistory(db);

const nowIso = () => new Date().toISOString();
const ipHashOf = (ip) => crypto.createHash('sha256').update(IP_SALT + ip).digest('hex').slice(0, 16);
const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
const encKey = (k) => crypto.createHash('sha256').update('editkey:' + k).digest('hex');

function send(res, code, body, extra) {
  if (res.writableEnded || res.headersSent) return;
  const text = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store', ...(extra || {}) });
  res.end(text);
}
const cleanText = (s) => String(s).replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\r/g, '');
function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '');
  const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || req.socket.remoteAddress || 'unknown';
}
function readBody(req, res, cb) {
  return readRawBody(req, res, REQ_MAX_BYTES, (buf) => {
    const raw = buf.toString('utf8');
    let data;
    try { data = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return send(res, 400, { ok: false, error: 'body_must_be_object' });
    return cb(raw);
  });
}
// 附件专用：原始字节，独立大小帽（流式截断，超帽即断）
function readRawBody(req, res, maxBytes, cb) {
  let size = 0, done = false; const chunks = [];
  req.on('data', (c) => {
    if (done) return;
    size += c.length;
    if (size > maxBytes) { done = true; send(res, 413, { ok: false, error: 'file_too_large', maxBytes }); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    if (done) return; done = true;
    try { Promise.resolve(cb(Buffer.concat(chunks))).catch(() => send(res, 500, { ok: false, error: 'internal_error' })); }
    catch { send(res, 500, { ok: false, error: 'internal_error' }); }
  });
  req.on('error', () => { done = true; send(res, 400, { ok: false, error: 'bad_request' }); });
}
// 附件元数据：storage/<id>/meta.json {origName, ext, size, uploadedAt}
function attDir(id) { return path.join(STORAGE_ROOT, String(id)); }
function attReadMeta(id) {
  try { return JSON.parse(fs.readFileSync(path.join(attDir(id), 'meta.json'), 'utf8')); } catch { return null; }
}
function attWriteMeta(id, meta) {
  fs.mkdirSync(attDir(id), { recursive: true });
  fs.writeFileSync(path.join(attDir(id), 'meta.json'), JSON.stringify(meta));
}
function attDelete(id) { fs.rmSync(attDir(id), { recursive: true, force: true }); }
function attachmentMeta(id) {
  const m = attReadMeta(id);
  if (!m) return null;
  return { fileName: m.origName, fileExt: m.ext, fileSize: m.size, downloadUrl: `/api/workshop/submissions/${id}/download` };
}

// ---------- C1: 会话 token（无状态 HMAC，E5 §10.2 形态） ----------
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (s) => crypto.createHmac('sha256', SESSION_SECRET).update(s).digest('base64url');
const equalSignature = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function issueSessionToken(publisherId, displayName, avatarUrl) {
  const payload = b64u(JSON.stringify({ v: 2, pid: publisherId, n: String(displayName || ''), exp: Date.now() + SESSION_TTL_MS }));
  return payload + '.' + hmac(payload);
}
function verifySessionToken(token) {
  if (!SESSION_SECRET || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.'); if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    // 保留上一版已发会话到既定迁移截止日；不再返回其头像 URL（其中含原始 Discord ID）。
    const legacy = !data.v && Date.now() < Date.parse('2026-11-02T00:00:00Z');
    const signature = legacy ? crypto.createHash('sha256').update(SESSION_SECRET + '.' + payload).digest('base64url') : hmac(payload);
    if ((!legacy && data.v !== 2) || !equalSignature(signature, sig)) return null;
    if (!data.pid || !Number.isFinite(data.exp) || Date.now() > data.exp || data.exp > Date.now() + SESSION_TTL_MS) return null;
    return { publisherId: String(data.pid), displayName: String(data.n || ''), avatarUrl: '' };
  } catch { return null; }
}
function bearerToken(req) {
  const h = String(req.headers['authorization'] || '');
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
const oauthConfigured = () => !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);function upsertPublisher(discordId, displayName) {
  const hash = sha256hex(OAUTH_SALT + String(discordId));
  const now = nowIso();
  const found = db.prepare('SELECT publisher_id FROM publishers WHERE discord_id_hash=?').get(hash);
  if (found) {
    db.prepare('UPDATE publishers SET last_login_at=?, display_name_last=COALESCE(?, display_name_last) WHERE publisher_id=?').run(now, displayName || null, found.publisher_id);
    return found.publisher_id;
  }
  const pid = crypto.randomBytes(8).toString('hex');
  db.prepare('INSERT INTO publishers (publisher_id, discord_id_hash, created_at, last_login_at, display_name_last, status) VALUES (?, ?, ?, ?, ?, ?)').run(pid, hash, now, now, displayName || null, 'active');
  return pid;
}
// C3: 会话 → 身份行（含封禁状态）
function sessionPublisherRow(req) {
  const sess = verifySessionToken(bearerToken(req));
  if (!sess) return { error: 'unauthorized', code: 401 };
  const row = db.prepare('SELECT publisher_id, status, banned_reason, display_name_last FROM publishers WHERE publisher_id=?').get(sess.publisherId);
  if (!row) return { error: 'unauthorized', code: 401 };
  if (row.status === 'banned') return { error: 'banned', code: 403, reason: row.banned_reason || '', row, sess };
  return { row, sess };
}

// C2: 投稿操作鉴权——编辑密钥 或 所有者会话（二选一）
function editKeyOk(req, s) {
  const got = Buffer.from(encKey(String(req.headers['x-edit-key'] || '')));
  const want = Buffer.from(s.edit_key_hash);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
function editKeyOkHeader(data, s) {
  const got = Buffer.from(encKey(String(data.editKey || '')));
  const want = Buffer.from(s.edit_key_hash);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
function ownerSession(req, s) {
  const authz = sessionPublisherRow(req);
  return !authz.error && s.publisher_id && authz.sess.publisherId === s.publisher_id ? authz.sess : null;
}
function publisherMayEdit(res, s) {
  if (!s.publisher_id) return true; // 兼容早期未绑定身份的编辑密钥
  const row = db.prepare('SELECT status FROM publishers WHERE publisher_id=?').get(s.publisher_id);
  if (row && row.status === 'active') return true;
  send(res, 403, { ok: false, error: row ? 'banned' : 'publisher_unavailable' }); return false;
}
function authorized(req, res, s) {
  if (!publisherMayEdit(res, s)) return false;
  if (editKeyOk(req, s)) return true;
  if (ownerSession(req, s)) return true;
  send(res, 403, { ok: false, error: 'unauthorized_for_submission' });
  return false;
}
function isAdmin(req) {
  const got = Buffer.from(String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(ADMIN_TOKEN);
  return want.length > 0 && got.length === want.length && crypto.timingSafeEqual(got, want);
}
function adminOk(req, res) {
  if (isAdmin(req)) return true;
  send(res, 401, { ok: false, error: 'unauthorized' }); return false;
}
const officialRelease = require('./official-release.cjs').createOfficialRelease({
  db, authorize: sessionPublisherRow, isAdmin, send, readRawBody,
  config: {
    modulePath: process.env.CXX_FORMAT3_PACKAGES_MODULE,
    outputDirectory: process.env.CXX_OFFICIAL_RELEASE_DIR,
    privateKeyFile: process.env.CXX_OFFICIAL_SIGNING_KEY_FILE,
    keyId: process.env.CXX_OFFICIAL_KEY_ID,
  },
  beforeCommit: ({ db: transactionDb, packages }) => {
    if (transactionDb !== db) throw new Contract.ContractError('来源检查必须使用同一事务数据库', 'source_transaction_mismatch', 409);
    workshopBridge.assertSources(packages);
  },
});
const Contract = require('./workshop-contract.cjs');
const workshopBridge = require('./workshop-bridge.cjs').createWorkshopBridge({
  db, send, readBody, ownerSession, officialRelease, modulePath: process.env.CXX_FORMAT3_PACKAGES_MODULE,
});
const rateMap = new Map();
const bugReports = require('./bug-reports.cjs').createBugReports({ db, send, readRawBody, authorize: sessionPublisherRow, pagination, rateLimited });
const playConnect = require('./play-connect.cjs').createPlayConnect({ send, readRawBody, authorize: sessionPublisherRow });
const temporarySaves = require('./temporary-saves.cjs').createTemporarySaves({ db, send, readRawBody, authorize: sessionPublisherRow });
const siteAccounts = require('./site-accounts.cjs').createSiteAccounts({db,send,readRawBody,authorize:sessionPublisherRow,issueSessionToken,configured:()=>!!SESSION_SECRET,rateLimited,ipKey:req=>ipHashOf(clientIp(req))});
function rateLimited(ipHash, max, windowMs = RATE_WINDOW_MS) {
  const now = Date.now();
  for (const [key, times] of rateMap) if (times.every((t) => now - t >= RATE_WINDOW_MS)) rateMap.delete(key);
  if (!rateMap.has(ipHash) && rateMap.size >= 10000) return true;
  const arr = (rateMap.get(ipHash) || []).filter((t) => now - t < windowMs);
  if (arr.length >= (max || RATE_MAX)) { rateMap.set(ipHash, arr); return true; }
  arr.push(now); rateMap.set(ipHash, arr); return false;
}
function publicSub(s) {
  const att = attachmentMeta(s.id);
  const packageRef = workshopBridge.packageRef(s);
  return { id: s.id, type: s.type, title: s.title, summary: s.summary, authorName: s.author_name, tags: JSON.parse(s.tags || '[]'), revision: s.revision, updatedAt: s.updated_at, hasFile: !!att, fileSize: att ? att.fileSize : 0, fileExt: att ? att.fileExt : null, verified: !!s.publisher_id, ...(packageRef ? { packageRef } : {}) };
}
function parseSubInput(data, res) {
  const type = String(data.type || '');
  if (!ALLOWED_TYPES.includes(type)) { send(res, 400, { ok: false, error: 'type_not_allowed', allowed: ALLOWED_TYPES }); return null; }
  const title = cleanText(String(data.title ?? '')).trim();
  if (!title || title.length > TITLE_MAX) { send(res, 400, { ok: false, error: 'title_invalid', max: TITLE_MAX }); return null; }
  const summary = cleanText(String(data.summary ?? '')).trim();
  if (summary.length > DESC_MAX) { send(res, 400, { ok: false, error: 'summary_too_long', max: DESC_MAX }); return null; }
  const authorName = cleanText(String(data.authorName ?? '')).trim().slice(0, 24) || null;
  let tags = data.tags;
  if (!Array.isArray(tags)) tags = [];
  tags = tags.map((t) => cleanText(String(t)).trim()).filter(Boolean).slice(0, TAGS_MAX);
  let payload = data.payload;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { send(res, 400, { ok: false, error: 'payload_not_json' }); return null; } }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) { send(res, 400, { ok: false, error: 'payload_must_be_object' }); return null; }
  try {
    if ((type === 'contract' || payload.templateKind) && Object.keys(data).some(key => !['type','title','summary','authorName','tags','payload','baseRevision','editKey'].includes(key))) throw new Contract.ContractError('投稿不接受客户端权威字段');
    payload = Contract.validateIncoming(type,payload,{ title, summary, authorName, tags });
  }
  catch (e) { send(res, e.status || 400, { ok: false, error: e.code || 'invalid_contract', message: e.message }); return null; }
  const payloadText = JSON.stringify(payload);
  if (Buffer.byteLength(payloadText, 'utf8') > BODY_KEY_MAX) { send(res, 400, { ok: false, error: 'payload_too_big', maxBytes: BODY_KEY_MAX }); return null; }
  return { type, title, summary, authorName, tags, payloadText };
}

const server = http.createServer(async (req, res) => {
  try {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return send(res, 400, { ok: false, error: 'bad_request' }); }
  const p = url.pathname; const m = req.method;
  // 防御：压缩入站请求体一律 415，且在读取任何字节之前判定。
  // 依据：SillyTavern 自 v1.12.13（2025-03）起的请求体解析存在预认证资源耗尽（解压炸弹）漏洞，
  // 截至 2026-10-24 官方未修；任何公网可达的 ST 或透传压缩体的代理都可能被打到进程崩溃。
  // 本站前端与酒馆客户端都不压缩请求体，故不接受编码后的入站体即为无损加固。
  const contentEncoding = String(req.headers['content-encoding'] || '').trim().toLowerCase();
  if (contentEncoding && contentEncoding !== 'identity') {
    return send(res, 415, { ok: false, error: 'content_encoding_not_supported', contentEncoding }, { 'Accept-Encoding': 'identity', Connection: 'close' });
  }
  // 卡内客户端来自玩家自己的酒馆域名；仅公共/玩家 API 支持无 cookie 的 Bearer 跨域。
  if (p.startsWith('/api/workshop/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (m === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Edit-Key, X-Filename', 'Access-Control-Max-Age': '600', 'Cache-Control': 'no-store' });
      return res.end();
    }
  }
  if (p.startsWith('/api/admin/') && !adminOk(req, res)) return;
  if (siteAccounts.handle(req, res, url, m)) return;
  if (playConnect.handle(req, res, url, m)) return;
  if (temporarySaves.handle(req, res, url, m)) return;
  if (bugReports.handle(req, res, url, m)) return;
  if (workshopBridge.handle(req, res, p, m)) return;
  if (officialRelease.handle(req, res, p, m)) return;

  if (m === 'GET' && p === '/api/admin/overview') {
    const feedback = db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(status='pending'),0) AS pending FROM feedback").get();
    const submissions = db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(status='pending'),0) AS pending FROM submissions").get();
    const announcements = db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(active=1),0) AS active FROM announcements').get();
    const accounts = db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(status='active'),0) AS active FROM publishers").get();
    return send(res, 200, { ok: true, counts: { feedback, submissions, announcements, accounts, bugs: bugReports.count() } });
  }

  // ---------- 健康 ----------
  if (m === 'GET' && p === '/api/workshop/health') {
    return send(res, 200, { ok: true, service: 'cxx-workshop-gateway', version: '0.8.2', stage: '压缩体加固', startedAt: STARTED });
  }

  // ================= 工坊 A：留言墙（原契约不变）=================
  if (m === 'GET' && p === '/api/workshop/feedback') {
    const rows = db.prepare("SELECT id, nickname, body, created_at FROM feedback WHERE status='approved' ORDER BY id DESC LIMIT 100").all();
    return send(res, 200, { ok: true, items: rows });
  }
  if (m === 'POST' && p === '/api/workshop/feedback') {
    return readBody(req, res, (raw) => {
      let data; try { data = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }); }
      const body = cleanText(String(data.body ?? '')).trim();
      let nickname = cleanText(String(data.nickname ?? '')).trim();
      if (!body) return send(res, 400, { ok: false, error: 'body_required' });
      if (body.length > 500) return send(res, 400, { ok: false, error: 'body_too_long', max: 500 });
      const authz = sessionPublisherRow(req);
      if (authz.error === 'unauthorized') return send(res, 401, { ok: false, error: 'login_required' });
      if (authz.error === 'banned') return send(res, 403, { ok: false, error: 'banned', reason: authz.reason });
      if (db.prepare('SELECT COUNT(*) AS n FROM feedback WHERE created_at>=?').get(new Date(Date.now() - 24 * 3600 * 1000).toISOString()).n >= 500) return send(res, 429, { ok: false, error: 'daily_limit' }, { 'Retry-After': '3600' });
      if (rateLimited('feedback:' + authz.row.publisher_id, 3, 600000)) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '600' });
      if (!nickname) nickname = authz.sess.displayName || null;
      const info = db.prepare('INSERT INTO feedback (created_at, nickname, body, ip_hash, status, publisher_id) VALUES (?, ?, ?, ?, ?, ?)').run(nowIso(), nickname, body, ipHashOf(clientIp(req)), 'pending', authz.row.publisher_id);
      return send(res, 201, { ok: true, id: Number(info.lastInsertRowid), status: 'pending', notice: '留言已提交，审核通过后展示' });
    });
  }

  // ================= 工坊 B：内容目录 =================
  // 公开目录（只含 approved）
  if (m === 'GET' && p === '/api/workshop/submissions') {
    const type = url.searchParams.get('type');
    const q = cleanText(url.searchParams.get('q') || '').trim().toLowerCase();
    let sql = "SELECT id, type, title, summary, author_name, tags, revision, updated_at, publisher_id, status FROM submissions WHERE status='approved'";
    const args = [];
    if (type && ALLOWED_TYPES.includes(type)) { sql += ' AND type=?'; args.push(type); }
    if (q) { sql += ' AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)'; args.push('%' + q + '%', '%' + q + '%'); }
    const paged = pagination.page(db, url.searchParams, {
      scope: ['public-submissions', ALLOWED_TYPES.includes(type) ? type : '', q, 'id-desc'],
      from: 'submissions', select: 'id, type, title, summary, author_name, tags, revision, updated_at, publisher_id, status',
      where: sql.split(' WHERE ')[1], args, keys: [{ column: 'id', type: 'number' }], map: publicSub,
    });
    if (paged) return send(res, 200, paged);
    sql += ' ORDER BY id DESC LIMIT 200';
    const rows = db.prepare(sql).all(...args).map(publicSub);
    return send(res, 200, { ok: true, items: rows });
  }
  // 公开详情（只含 approved；含 payload 与附件元数据）
  const mPub = p.match(/^\/api\/workshop\/submissions\/(\d+)$/);
  if (m === 'GET' && mPub) {
    const s = db.prepare("SELECT * FROM submissions WHERE id=? AND status='approved'").get(Number(mPub[1]));
    if (!s) return send(res, 404, { ok: false, error: 'not_found' });
    return send(res, 200, { ok: true, item: { ...publicSub(s), payload: JSON.parse(s.payload), attachment: attachmentMeta(s.id), presentation:Contract.presentation(s) } });
  }
  // 附件上传（凭编辑密钥；白名单 ext；10MB 帽；重传覆盖；withdrawn 不可传）
  const mAtt = p.match(/^\/api\/workshop\/submissions\/(\d+)\/attachment$/);
  if (m === 'POST' && mAtt) {
    const id = Number(mAtt[1]);
    const s = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
    if (!s || s.status === 'withdrawn') return send(res, 404, { ok: false, error: 'not_found' });
    if (!authorized(req, res, s)) return;
    try { Contract.assertOpen(s.type,JSON.parse(s.payload)); } catch(e) { return send(res,e.status,{ok:false,error:e.code,message:e.message}); }
    let origName = '';
    try { origName = decodeURIComponent(String(req.headers['x-filename'] || '')); } catch { origName = ''; }
    const ext = (origName.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';
    if (!ATT_EXT[ext]) return send(res, 400, { ok: false, error: 'ext_not_allowed', allowed: Object.keys(ATT_EXT) });
    if (/[\\/\x00-\x1f]/.test(origName)) return send(res, 400, { ok: false, error: 'bad_filename' });
    // 校验全部通过才计限频（失败请求不占名额）
    const ih = ipHashOf(clientIp(req));
    if (rateLimited('submission:' + (s.publisher_id || s.id))) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '3600' });
    return readRawBody(req, res, ATT_MAX_BYTES, (buf) => {
      if (buf.length === 0) return send(res, 400, { ok: false, error: 'empty_file' });
      const latest = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
      if (!latest || latest.status === 'withdrawn' || latest.revision !== s.revision) return send(res, 409, { ok: false, error: 'revision_conflict' });
      if (!authorized(req, res, latest)) return;
      // 先撤下公开入口，再触碰字节；磁盘失败时也不能暴露未经审核的替换内容。
      db.prepare("UPDATE submissions SET status='pending', revision=revision+1, updated_at=? WHERE id=?").run(nowIso(), id);
      fs.mkdirSync(attDir(id), { recursive: true });
      const tmp = path.join(attDir(id), `.tmp-${Date.now()}`);
      fs.writeFileSync(tmp, buf);
      for (const e of Object.keys(ATT_EXT)) { try { fs.unlinkSync(path.join(attDir(id), `att.${e}`)); } catch {} }
      fs.renameSync(tmp, path.join(attDir(id), `att.${ext}`));
      attWriteMeta(id, { origName: origName.slice(0, 120), ext, size: buf.length, uploadedAt: nowIso() });
      console.log(`[attachment] upload id=${id} ext=${ext} size=${buf.length} outcome=ok`);
      return send(res, 201, { ok: true, id, revision: s.revision + 1, status: 'pending', attachment: attachmentMeta(id) });
    });
  }
  // 附件下载（仅 approved；流式 + 原文件名）
  const mDl = p.match(/^\/api\/workshop\/submissions\/(\d+)\/download$/);
  if (m === 'GET' && mDl) {
    const id = Number(mDl[1]);
    const s = db.prepare("SELECT id FROM submissions WHERE id=? AND status='approved'").get(id);
    const meta = attReadMeta(id);
    if (!s || !meta) return send(res, 404, { ok: false, error: 'not_found' });
    const fp = path.join(attDir(id), `att.${meta.ext}`);
    let stat; try { stat = fs.statSync(fp); } catch { return send(res, 404, { ok: false, error: 'not_found' }); }
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.origName)}`,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(fp).pipe(res);
    return;
  }
  // 投稿（匿名 + 编辑密钥；可选 Discord 身份绑定）
  if (m === 'POST' && p === '/api/workshop/submissions') {
    return readBody(req, res, (raw) => {
      let data; try { data = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }); }
      const parsed = parseSubInput(data, res); if (!parsed) return;
      const ih = ipHashOf(clientIp(req));
      // 权限 v0.8：投稿必须登录；封禁拒绝
      const authz = sessionPublisherRow(req);
      if (authz.error === 'unauthorized') return send(res, 401, { ok: false, error: 'login_required' });
      if (authz.error === 'banned') return send(res, 403, { ok: false, error: 'banned', reason: authz.reason });
      const publisherId = authz.row.publisher_id;
      if (rateLimited('submission:' + publisherId)) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '3600' });
      if (!parsed.authorName && authz.sess.displayName) parsed.authorName = authz.sess.displayName;
      const editKey = crypto.randomBytes(24).toString('base64url');
      const t = nowIso();
      const info = db.prepare(`INSERT INTO submissions (created_at, updated_at, type, title, summary, author_name, tags, payload, content_hash, edit_key_hash, ip_hash, revision, status, publisher_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?)`)
        .run(t, t, parsed.type, parsed.title, parsed.summary, parsed.authorName, JSON.stringify(parsed.tags), parsed.payloadText, sha256hex(parsed.payloadText), encKey(editKey), ih, publisherId);
      console.log(`[submission] create id=${info.lastInsertRowid} iph=${ih} publisher=${publisherId || 'anon'} outcome=ok`);
      // 编辑密钥只在本次响应出现
      return send(res, 201, { ok: true, id: Number(info.lastInsertRowid), revision: 1, status: 'pending', editKey, notice: '投稿已提交待审。编辑密钥只显示这一次，请立即保存！' });
    });
  }
  // 改稿/撤回（凭 id + 编辑密钥）
  const mOwn = p.match(/^\/api\/workshop\/submissions\/(\d+)\/(update|withdraw)$/);
  if (m === 'POST' && mOwn) {
    return readBody(req, res, (raw) => {
      const id = Number(mOwn[1]); const action = mOwn[2];
      let data; try { data = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }); }
      const s = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
      if (!s || s.status === 'withdrawn') return send(res, 404, { ok: false, error: 'not_found' });
      if (!publisherMayEdit(res, s)) return;
      // 双通道：编辑密钥 或 所有者会话
      const keyOk = editKeyOkHeader(data, s);
      const sess = keyOk ? null : ownerSession(req, s);
      if (!keyOk && !sess) return send(res, 403, { ok: false, error: 'unauthorized_for_submission' });
      if (sess) { const az = sessionPublisherRow(req); if (az.error === 'banned') return send(res, 403, { ok: false, error: 'banned', reason: az.reason }); }
      const ih = ipHashOf(clientIp(req));
      if (rateLimited('submission:' + (s.publisher_id || s.id))) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '3600' });
      if (action === 'withdraw') {
        db.prepare("UPDATE submissions SET status='withdrawn', updated_at=? WHERE id=?").run(nowIso(), id);
        console.log(`[submission] withdraw id=${id} outcome=ok`);
        return send(res, 200, { ok: true, id, status: 'withdrawn', notice: '投稿已撤下；已签名发行的包还需发行者在发布页撤回目录。历史已装内容保留。' });
      }
      if (s.status === 'approved' && data.title === undefined && data.payload === undefined) return send(res, 400, { ok: false, error: 'nothing_to_update' });
      try { Contract.assertOpen(s.type,JSON.parse(s.payload)); } catch(e) { return send(res,e.status,{ok:false,error:e.code,message:e.message}); }
      const merged = {
        type: data.type ?? s.type, title: data.title ?? s.title, summary: data.summary ?? s.summary,
        authorName: data.authorName ?? s.author_name, tags: data.tags ?? JSON.parse(s.tags || '[]'),
        payload: data.payload ?? JSON.parse(s.payload),
      };
      const parsed = parseSubInput(merged, res); if (!parsed) return;
      const clientRev = Number(data.baseRevision);
      if (!Number.isInteger(clientRev) || clientRev !== s.revision) return send(res, 409, { ok: false, error: 'revision_conflict', currentRevision: s.revision });
      const newRev = s.revision + 1;
      db.prepare("UPDATE submissions SET updated_at=?, type=?, title=?, summary=?, author_name=?, tags=?, payload=?, content_hash=?, revision=?, status='pending' WHERE id=?")
        .run(nowIso(), parsed.type, parsed.title, parsed.summary, parsed.authorName, JSON.stringify(parsed.tags), parsed.payloadText, sha256hex(parsed.payloadText), newRev, id);
      console.log(`[submission] update id=${id} rev=${newRev} outcome=ok`);
      return send(res, 200, { ok: true, id, revision: newRev, status: 'pending', notice: '改稿已提交，重新进入待审' });
    });
  }

  // ---------- C1: Discord 登录链 ----------
  // start：客户端生成 handoffId+secret（challenge=sha256(secret)），换 OAuth 跳转地址
  if (m === 'POST' && p === '/api/workshop/login-handoff/start') {
    return readBody(req, res, (raw) => {
      let data; try { data = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }); }
      const handoffId = String(data.handoffId || '');
      const challenge = String(data.challenge || '');
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(handoffId)) return send(res, 400, { ok: false, error: 'bad_handoff_id' });
      if (!/^[a-f0-9]{64}$/.test(challenge)) return send(res, 400, { ok: false, error: 'bad_challenge' });
      if (!oauthConfigured()) return send(res, 503, { ok: false, error: 'oauth_not_configured' });
      db.prepare("DELETE FROM login_handoffs WHERE expires_at < ?").run(nowIso());
      if (db.prepare('SELECT handoff_id FROM login_handoffs WHERE handoff_id=?').get(handoffId)) return send(res, 409, { ok: false, error: 'handoff_exists' });
      if (db.prepare('SELECT COUNT(*) AS n FROM login_handoffs').get().n >= 1000 || rateLimited('login:' + ipHashOf(clientIp(req)), 20, HANDOFF_TTL_MS)) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '600' });
      const now = Date.now();
      db.prepare("INSERT INTO login_handoffs (handoff_id, challenge, status, created_at, expires_at) VALUES (?, ?, 'pending', ?, ?)")
        .run(handoffId, challenge, nowIso(), new Date(now + HANDOFF_TTL_MS).toISOString());
      const origin = DISCORD_REDIRECT_URI || 'https://cyber2051.top/api/workshop/oauth/callback';
      const state = handoffId + '.' + hmac(handoffId);
      const loginUrl = 'https://discord.com/api/oauth2/authorize?client_id=' + encodeURIComponent(DISCORD_CLIENT_ID) +
        '&redirect_uri=' + encodeURIComponent(origin) + '&response_type=code&scope=identify&state=' + encodeURIComponent(state);
      console.log(`[login] start handoff=${handoffId} outcome=ok`);
      return send(res, 200, { ok: true, loginUrl, expiresInMs: HANDOFF_TTL_MS });
    });
  }
  // OAuth 回调（Discord 跳回）：换 token → 拉身份 → 建/更新 publisher → handoff 置 ready
  if (m === 'GET' && p === '/api/workshop/oauth/callback') {
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const html = (msg, ok) => '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>工坊登录</title>' +
      '<link rel="stylesheet" href="/site.css?v=visual20261005"><script src="/i18n.js?v=visual20261005"><\/script><script defer src="/workshop/site-ui.js?v=visual20261005"><\/script></head><body class="site">' +
      '<header class="site-header"><div class="bar"><a class="logo" href="/"><span class="cube"></span>东京都2051</a><nav class="nav"><a href="/" data-i18n="nav.home">首页</a><a href="/workshop.html" data-i18n="nav.ws">创意工坊</a></nav></div></header>' +
      '<main class="wrap narrow"><section class="panel" style="margin-top:40px"><div class="kicker" data-i18n="auth.title">工坊登录</div><h1 class="page-title" data-i18n="auth.' + (ok ? 'ok' : 'fail') + '">' + (ok ? '登录成功' : '登录失败') + '</h1>' +
      '<p class="page-sub" data-i18n="auth.' + (ok ? 'okHint' : 'failHint') + '">' + (ok ? '身份已确认，请回到原来的酒馆或网页，登录会自动完成。' : '本次登录未完成。请回到原来的页面重新登录。') + '</p>' +
      '<details><summary data-i18n="auth.details">原因详情</summary><p>' + String(msg).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])) + '</p></details>' +
      '<p><a class="btn" href="/workshop.html" data-i18n="auth.return">回到创意工坊</a></p></section></main>' +
      '<footer class="site-footer"><div class="wrap"><span data-i18n="footer.line">CYBER2051.TOP · 同人二次创作作品，与官方品牌无关</span><a href="/workshop/admin.html" data-i18n="nav.admin">管理员</a></div></footer></body></html>';
    const fail = (msg) => { console.log(`[login] callback outcome=fail reason=${msg}`); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html(msg, false)); };
    const dot = state.lastIndexOf('.');
    if (dot < 1) return fail('state 格式错误');
    const handoffId = state.slice(0, dot);
    if (!equalSignature(hmac(handoffId), state.slice(dot + 1))) return fail('state 校验失败');
    const row = db.prepare("SELECT * FROM login_handoffs WHERE handoff_id=?").get(handoffId);
    if (!row || row.status !== 'pending' || new Date(row.expires_at) < new Date()) return fail('登录会话不存在或已过期，请重新发起');
    if (!code) return fail('Discord 未返回授权码');
    // 用授权码换 access_token（固定 redirect_uri 与 start 一致）
    const redirectUri = DISCORD_REDIRECT_URI || `https://cyber2051.top/api/workshop/oauth/callback`;
    let tokenResp, me;
    try {
      tokenResp = await (await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
        signal: AbortSignal.timeout(15000),
      })).json();
      if (!tokenResp.access_token) throw new Error('no access_token');
      me = await (await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: 'Bearer ' + tokenResp.access_token }, signal: AbortSignal.timeout(15000),
      })).json();
      if (!me.id) throw new Error('no user id');
    } catch (e) { return fail('与 Discord 交换身份失败：' + e.message); }
    const displayName = String(me.global_name || me.username || '旅行者').slice(0, 32);
    const publisherId = upsertPublisher(me.id, displayName);
    const sessionToken = issueSessionToken(publisherId, displayName);
    db.prepare("UPDATE login_handoffs SET status='ready', publisher_id=?, display_name=?, session_token=?, expires_at=? WHERE handoff_id=?")
      .run(publisherId, displayName, sessionToken, new Date(Date.now() + HANDOFF_READY_TTL_MS).toISOString(), handoffId);
    console.log(`[login] callback outcome=ok handoff=${handoffId}`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html('Discord 身份已确认：' + displayName + '。请回到酒馆/网页，登录会自动完成。', true));
  }
  // 轮询领取（secret 对题、一次性作废）
  if ((m === 'GET' || m === 'POST') && p === '/api/workshop/login-handoff') {
    const redeem = (data) => {
    const handoffId = String(data.handoffId || '');
    const secret = String(data.secret || '');
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(handoffId) || !/^[A-Za-z0-9_-]{20,}$/.test(secret)) return send(res, 400, { ok: false, error: 'bad_request' });
    const row = db.prepare("SELECT * FROM login_handoffs WHERE handoff_id=?").get(handoffId);
    if (!row || sha256hex(secret) !== row.challenge) return send(res, 404, { ok: false, error: 'not_found' });
    if (new Date(row.expires_at) < new Date()) { db.prepare('DELETE FROM login_handoffs WHERE handoff_id=?').run(handoffId); return send(res, 410, { ok: false, error: 'expired' }); }
    if (row.status === 'pending') {
      if (new Date(row.expires_at) < new Date()) { db.prepare("DELETE FROM login_handoffs WHERE handoff_id=?").run(handoffId); return send(res, 410, { ok: false, error: 'expired' }); }
      return send(res, 200, { ok: true, status: 'waiting' });
    }
    if (row.status === 'ready') {
      const publisher = db.prepare('SELECT status FROM publishers WHERE publisher_id=?').get(row.publisher_id);
      if (!publisher || publisher.status !== 'active') { db.prepare('DELETE FROM login_handoffs WHERE handoff_id=?').run(handoffId); return send(res, 403, { ok: false, error: 'publisher_unavailable' }); }
      db.prepare("UPDATE login_handoffs SET status='redeemed', session_token=NULL WHERE handoff_id=?").run(handoffId); // 一次性
      return send(res, 200, { ok: true, status: 'ready', token: row.session_token, publisherId: row.publisher_id, displayName: row.display_name });
    }
    return send(res, 410, { ok: false, error: 'already_redeemed' });
    };
    if (m === 'POST') return readBody(req, res, (raw) => redeem(JSON.parse(raw || '{}')));
    return redeem(Object.fromEntries(url.searchParams)); // 旧卡兼容；代理日志必须屏蔽领取凭据
  }
  // 验活
  if (m === 'GET' && p === '/api/workshop/me') {
    const authz = sessionPublisherRow(req);
    if (authz.error === 'unauthorized') return send(res, 401, { ok: false, error: 'unauthorized' });
    if (authz.error === 'banned') return send(res, 403, { ok: false, error: 'banned', reason: authz.reason });
    return send(res, 200, { ok: true, loggedIn: true, publisherId: authz.row.publisher_id, displayName: authz.sess.displayName, avatarUrl: authz.sess.avatarUrl || null });
  }
  // ---------- 公告系统（公开只读；管理端 CRUD） ----------
  if (m === 'GET' && p === '/api/workshop/announcements') {
    const rows = db.prepare('SELECT id, kind, pinned, title, body, created_at, updated_at FROM announcements WHERE active=1 ORDER BY pinned DESC, id DESC LIMIT 20').all();
    return send(res, 200, { ok: true, items: rows });
  }
  // 我的投稿（登录者按 publisher 查自己的全部投稿，含 payload 供改稿）
  if (m === 'GET' && p === '/api/workshop/me/submissions') {
    const authz = sessionPublisherRow(req);
    if (authz.error) return send(res, authz.code, { ok: false, error: authz.error });
    const sess = authz.sess;
    if (url.searchParams.has('pageSize')) {
      const status = url.searchParams.get('status'), type = url.searchParams.get('type'), q = cleanText(url.searchParams.get('q') || '').trim().toLowerCase();
      let where = 'publisher_id=?'; const args = [sess.publisherId];
      if (['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) { where += ' AND status=?'; args.push(status); }
      if (ALLOWED_TYPES.includes(type)) { where += ' AND type=?'; args.push(type); }
      if (q) { where += ' AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)'; args.push('%' + q + '%', '%' + q + '%'); }
      const result = pagination.page(db, url.searchParams, {
        scope: ['my-submissions', sess.publisherId, ['pending', 'approved', 'rejected', 'withdrawn'].includes(status) ? status : '', ALLOWED_TYPES.includes(type) ? type : '', q, 'id-desc'],
        from: 'submissions', where, args, keys: [{ column: 'id', type: 'number' }],
        map: r => ({ ...publicSub(r), payload: JSON.parse(r.payload), status: r.status, createdAt: r.created_at }),
      });
      return send(res, 200, { ...result, publisherId: sess.publisherId, displayName: sess.displayName });
    }
    const rows = db.prepare('SELECT * FROM submissions WHERE publisher_id=? ORDER BY id DESC LIMIT 200').all(sess.publisherId)
      .map((r) => ({ ...publicSub(r), payload: JSON.parse(r.payload), status: r.status, createdAt: r.created_at }));
    return send(res, 200, { ok: true, items: rows, publisherId: sess.publisherId, displayName: sess.displayName });
  }
  // 登出（无状态 token：服务端无账本，客户端丢弃即可；此端点仅作语义与未来扩展位）
  if (m === 'POST' && p === '/api/workshop/logout') return send(res, 200, { ok: true, notice: '客户端应删除本地 token' });
    // ---------- 账号管理（admin） ----------
  if (m === 'GET' && p === '/api/admin/accounts') {
    if (url.searchParams.has('pageSize')) {
      const status = url.searchParams.get('status'), q = cleanText(url.searchParams.get('q') || '').trim().toLowerCase();
      let where = '1=1'; const args = [];
      if (['active', 'banned'].includes(status)) { where += ' AND p.status=?'; args.push(status); }
      if (q) { where += ' AND (LOWER(p.display_name_last) LIKE ? OR LOWER(p.publisher_id) LIKE ?)'; args.push('%' + q + '%', '%' + q + '%'); }
      return send(res, 200, pagination.page(db, url.searchParams, {
        scope: ['admin-accounts', ['active', 'banned'].includes(status) ? status : '', q, 'last-login-id-desc'], from: 'publishers p', where, args,
        select: `p.publisher_id, p.display_name_last, p.created_at, p.last_login_at, p.status, p.banned_reason, p.banned_at, p.can_publish_official,
          (SELECT COUNT(*) FROM submissions s WHERE s.publisher_id=p.publisher_id) AS submissions,
          (SELECT COUNT(*) FROM feedback f WHERE f.publisher_id=p.publisher_id) AS feedback`,
        keys: [{ column: 'p.last_login_at', type: 'string' }, { column: 'p.publisher_id', type: 'string' }],
        map: row => ({ ...row, canPublishOfficial: row.can_publish_official === 1 }),
      }));
    }
    const rows = db.prepare(`SELECT p.publisher_id, p.display_name_last, p.created_at, p.last_login_at, p.status, p.banned_reason, p.banned_at, p.can_publish_official,
      (SELECT COUNT(*) FROM submissions s WHERE s.publisher_id=p.publisher_id) AS submissions,
      (SELECT COUNT(*) FROM feedback f WHERE f.publisher_id=p.publisher_id) AS feedback
      FROM publishers p ORDER BY p.last_login_at DESC LIMIT 500`).all().map(row => ({ ...row, canPublishOfficial: row.can_publish_official === 1 }));
    return send(res, 200, { ok: true, items: rows });
  }
  const mAcc = p.match(/^\/api\/admin\/accounts\/([a-f0-9]+)\/(ban|unban|delete)$/);
  if (m === 'POST' && mAcc) {
    const pid = mAcc[1]; const act = mAcc[2];
    const row = db.prepare('SELECT publisher_id, status FROM publishers WHERE publisher_id=?').get(pid);
    if (!row) return send(res, 404, { ok: false, error: 'not_found' });
    if (act === 'ban') {
      return readBody(req, res, (raw) => {
        let d; try { d = JSON.parse(raw || '{}'); } catch { d = {}; }
        const reason = cleanText(String(d.reason || '违规')).slice(0, 200);
        db.prepare("UPDATE publishers SET status='banned', banned_reason=?, banned_at=? WHERE publisher_id=?").run(reason, nowIso(), pid);
        console.log('[account] ban ' + pid + ' outcome=ok');
        return send(res, 200, { ok: true, publisherId: pid, status: 'banned' });
      });
    }
    if (act === 'unban') {
      db.prepare("UPDATE publishers SET status='active', banned_reason=NULL, banned_at=NULL WHERE publisher_id=?").run(pid);
      return send(res, 200, { ok: true, publisherId: pid, status: 'active' });
    }
    if (act === 'delete') {
      return readBody(req, res, (raw) => {
        if (JSON.parse(raw || '{}').confirmPublisherId !== pid) return send(res, 400, { ok: false, error: 'confirmation_required' });
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('DELETE FROM submissions WHERE publisher_id=?').run(pid);
          db.prepare('DELETE FROM feedback WHERE publisher_id=?').run(pid);
          bugReports.removeForPublisher(pid);
          db.prepare('DELETE FROM login_handoffs WHERE publisher_id=?').run(pid);
          db.prepare('DELETE FROM publishers WHERE publisher_id=?').run(pid);
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
        // 附件留在非公开存储，等待备份后专项清理；不把磁盘删除与数据库提交混在一起。
        console.log('[account] delete ' + pid + ' outcome=ok');
        return send(res, 200, { ok: true, publisherId: pid, deleted: true });
      });
    }
  }
  // 公告管理（admin token 保护）
  if (m === 'GET' && p === '/api/admin/announcements') {
    if (url.searchParams.has('pageSize')) {
      const status = url.searchParams.get('status'), kind = url.searchParams.get('kind'), q = cleanText(url.searchParams.get('q') || '').trim().toLowerCase();
      let where = '1=1'; const args = [];
      if (status === 'active' || status === 'archived') { where += ' AND active=?'; args.push(status === 'active' ? 1 : 0); }
      if (['card', 'site', 'event'].includes(kind)) { where += ' AND kind=?'; args.push(kind); }
      if (q) { where += ' AND (LOWER(title) LIKE ? OR LOWER(body) LIKE ?)'; args.push('%' + q + '%', '%' + q + '%'); }
      return send(res, 200, pagination.page(db, url.searchParams, {
        scope: ['admin-announcements', ['active', 'archived'].includes(status) ? status : '', ['card', 'site', 'event'].includes(kind) ? kind : '', q, 'pinned-id-desc'],
        from: 'announcements', where, args, keys: [{ column: 'pinned', type: 'number' }, { column: 'id', type: 'number' }],
      }));
    }
    return send(res, 200, { ok: true, items: db.prepare('SELECT * FROM announcements ORDER BY pinned DESC, id DESC LIMIT 100').all() });
  }
  if (m === 'POST' && p === '/api/admin/announcements') {
    return readBody(req, res, (raw) => {
      let d; try { d = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }); }
      const title = cleanText(String(d.title || '')).trim();
      const body = cleanText(String(d.body || '')).trim();
      const kind = ['card', 'site', 'event'].includes(d.kind) ? d.kind : 'site';
      const pinned = d.pinned ? 1 : 0;
      if (!title || title.length > 120) return send(res, 400, { ok: false, error: 'title_invalid', max: 120 });
      if (!body || body.length > 4000) return send(res, 400, { ok: false, error: 'body_invalid', max: 4000 });
      const t = nowIso();
      if (pinned) db.prepare('UPDATE announcements SET pinned=0 WHERE pinned=1').run();
      const info = db.prepare('INSERT INTO announcements (created_at, updated_at, kind, pinned, active, title, body) VALUES (?, ?, ?, ?, 1, ?, ?)').run(t, t, kind, pinned, title, body);
      console.log('[announce] create id=' + info.lastInsertRowid + ' kind=' + kind + ' outcome=ok');
      return send(res, 201, { ok: true, id: Number(info.lastInsertRowid) });
    });
  }
  const mAnn = p.match(/^\/api\/admin\/announcements\/(\d+)\/(update|delete|pin|archive|restore)$/);
  if (m === 'POST' && mAnn) {
    const id = Number(mAnn[1]); const act = mAnn[2];
    const row = db.prepare('SELECT id FROM announcements WHERE id=?').get(id);
    if (!row) return send(res, 404, { ok: false, error: 'not_found' });
    if (act === 'delete') { db.prepare('DELETE FROM announcements WHERE id=?').run(id); return send(res, 200, { ok: true, id }); }
    if (act === 'pin') { db.prepare('UPDATE announcements SET pinned=CASE WHEN pinned=1 THEN 0 ELSE 1 END, updated_at=? WHERE id=?').run(nowIso(), id); db.prepare('UPDATE announcements SET pinned=0 WHERE pinned=1 AND id<>?').run(id); return send(res, 200, { ok: true, id }); }
    if (act === 'archive') { db.prepare('UPDATE announcements SET active=0, pinned=0, updated_at=? WHERE id=?').run(nowIso(), id); return send(res, 200, { ok: true, id }); }
    if (act === 'restore') { db.prepare('UPDATE announcements SET active=1, updated_at=? WHERE id=?').run(nowIso(), id); return send(res, 200, { ok: true, id }); }
    return readBody(req, res, (raw) => {
      let d; try { d = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }); }
      const title = cleanText(String(d.title || '')).trim();
      const body = cleanText(String(d.body || '')).trim();
      if (!title || title.length > 120) return send(res, 400, { ok: false, error: 'title_invalid' });
      if (!body || body.length > 4000) return send(res, 400, { ok: false, error: 'body_invalid' });
      if (Object.hasOwn(d, 'pinned') && typeof d.pinned !== 'boolean') return send(res, 400, { ok: false, error: 'pinned_must_be_boolean' });
      db.exec('BEGIN IMMEDIATE');
      try {
        if (d.pinned === true) db.prepare('UPDATE announcements SET pinned=0 WHERE pinned=1 AND id<>?').run(id);
        db.prepare('UPDATE announcements SET title=?, body=?, kind=COALESCE(?, kind), pinned=COALESCE(?, pinned), updated_at=? WHERE id=?')
          .run(title, body, ['card', 'site', 'event'].includes(d.kind) ? d.kind : null, Object.hasOwn(d, 'pinned') ? Number(d.pinned) : null, nowIso(), id);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return send(res, 200, { ok: true, id });
    });
  }
  // 管理测试钩子：电池用（admin token 保护），模拟"Discord 已授权"把 handoff 置 ready
  if (m === 'POST' && p === '/api/admin/dev/approve-handoff') {
    if (process.env.CXX_ENABLE_DEV !== '1') return send(res, 404, { ok: false, error: 'not_found' });
    return readBody(req, res, (raw) => {
      let data; try { data = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }); }
      const handoffId = String(data.handoffId || '');
      const displayName = String(data.displayName || '测试作者').slice(0, 32);
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(handoffId)) return send(res, 400, { ok: false, error: 'bad_handoff_id' });
      const pid = upsertPublisher('test-' + handoffId, displayName);
      const sessionToken = issueSessionToken(pid, displayName, '');
      const now = Date.now();
      db.prepare("INSERT INTO login_handoffs (handoff_id, challenge, status, publisher_id, display_name, session_token, created_at, expires_at) VALUES (?, ?, 'ready', ?, ?, ?, ?, ?) " +
        'ON CONFLICT(handoff_id) DO UPDATE SET status=\'ready\', publisher_id=excluded.publisher_id, display_name=excluded.display_name, session_token=excluded.session_token, expires_at=excluded.expires_at')
        .run(handoffId, sha256hex('battery-placeholder-2026'), pid, displayName, sessionToken, nowIso(), new Date(now + HANDOFF_READY_TTL_MS).toISOString());
      console.log(`[login] dev-approve handoff=${handoffId} outcome=ok`);
      return send(res, 200, { ok: true, handoffId });
    });
  }

  // ================= 管理端 =================
  if (p.startsWith('/api/admin/')) {
    if (m === 'GET' && p === '/api/admin/feedback') {
      const st = url.searchParams.get('status');
      if (url.searchParams.has('pageSize')) {
        const q = cleanText(url.searchParams.get('q') || '').trim().toLowerCase();
        let where = '1=1'; const args = [];
        if (['pending', 'approved', 'rejected'].includes(st)) { where += ' AND status=?'; args.push(st); }
        if (q) { where += ' AND (LOWER(nickname) LIKE ? OR LOWER(body) LIKE ?)'; args.push('%' + q + '%', '%' + q + '%'); }
        return send(res, 200, pagination.page(db, url.searchParams, {
          scope: ['admin-feedback', ['pending', 'approved', 'rejected'].includes(st) ? st : '', q, 'id-desc'],
          from: 'feedback', select: 'id, nickname, body, created_at, ip_hash, status', where, args, keys: [{ column: 'id', type: 'number' }],
        }));
      }
      const where = ['pending', 'approved', 'rejected'].includes(st) ? `WHERE status='${st}'` : '';
      return send(res, 200, { ok: true, items: db.prepare(`SELECT id, nickname, body, created_at, ip_hash, status FROM feedback ${where} ORDER BY id DESC LIMIT 200`).all() });
    }
    const mFb = p.match(/^\/api\/admin\/feedback\/(\d+)\/(approve|reject|delete)$/);
    if (m === 'POST' && mFb) {
      const id = Number(mFb[1]); const action = mFb[2];
      const row = db.prepare('SELECT id, status FROM feedback WHERE id=?').get(id);
      if (!row) return send(res, 404, { ok: false, error: 'not_found' });
      if (action === 'delete') { db.prepare('DELETE FROM feedback WHERE id=?').run(id); return send(res, 200, { ok: true, id, action }); }
      if (row.status !== 'pending') return send(res, 409, { ok: false, error: 'not_pending', status: row.status });
      db.prepare('UPDATE feedback SET status=? WHERE id=?').run(action === 'approve' ? 'approved' : 'rejected', id);
      return send(res, 200, { ok: true, id, action });
    }
    if (m === 'GET' && p === '/api/admin/submissions') {
      const st = url.searchParams.get('status');
      if (url.searchParams.has('pageSize')) {
        const type = url.searchParams.get('type'), q = cleanText(url.searchParams.get('q') || '').trim().toLowerCase();
        let where = '1=1'; const args = [];
        if (['pending', 'approved', 'rejected', 'withdrawn'].includes(st)) { where += ' AND status=?'; args.push(st); }
        if (ALLOWED_TYPES.includes(type)) { where += ' AND type=?'; args.push(type); }
        if (q) { where += ' AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(author_name) LIKE ?)'; args.push('%' + q + '%', '%' + q + '%', '%' + q + '%'); }
        return send(res, 200, pagination.page(db, url.searchParams, {
          scope: ['admin-submissions', ['pending', 'approved', 'rejected', 'withdrawn'].includes(st) ? st : '', ALLOWED_TYPES.includes(type) ? type : '', q, 'id-desc'],
          from: 'submissions', select: 'id, created_at, updated_at, type, title, summary, author_name, tags, content_hash, revision, status, review_note, publisher_id',
          where, args, keys: [{ column: 'id', type: 'number' }], map: r => ({ ...r, attachment: attachmentMeta(r.id) }),
        }));
      }
      const where = ['pending', 'approved', 'rejected', 'withdrawn'].includes(st) ? `WHERE status='${st}'` : '';
      const rows = db.prepare(`SELECT id, created_at, updated_at, type, title, summary, author_name, tags, content_hash, revision, status, review_note, publisher_id FROM submissions ${where} ORDER BY id DESC LIMIT 200`).all()
        .map((r) => ({ ...r, attachment: attachmentMeta(r.id) }));
      return send(res, 200, { ok: true, items: rows });
    }
    const mAdm = p.match(/^\/api\/admin\/submissions\/(\d+)\/(approve|reject|delete)$/);
    if (m === 'DELETE' && p.match(/^\/api\/admin\/submissions\/\d+\/attachment$/)) {
      const id = Number(p.split('/')[4]);
      return readBody(req, res, (raw) => {
      const row = db.prepare('SELECT id, revision FROM submissions WHERE id=?').get(id);
      if (!row) return send(res, 404, { ok: false, error: 'not_found' });
      if (Number(JSON.parse(raw || '{}').baseRevision) !== row.revision) return send(res, 409, { ok: false, error: 'revision_conflict' });
      db.prepare("UPDATE submissions SET status='pending', revision=revision+1, updated_at=? WHERE id=? AND status<>'withdrawn'").run(nowIso(), id);
      attDelete(id);
      console.log(`[attachment] admin-delete id=${id} outcome=ok`);
      return send(res, 200, { ok: true, id });
      });
    }
    if (m === 'GET' && p.match(/^\/api\/admin\/submissions\/\d+$/)) {
      const s = db.prepare('SELECT * FROM submissions WHERE id=?').get(Number(p.split('/').pop()));
      if (!s) return send(res, 404, { ok: false, error: 'not_found' });
      return send(res, 200, { ok: true, item: { ...publicSub(s), payload: JSON.parse(s.payload), contentHash: s.content_hash, ipHash: s.ip_hash, status: s.status, reviewNote: s.review_note, publisherId: s.publisher_id }, presentation:Contract.presentation(s), comparison:submissionHistory.compare(s) });
    }
    if (m === 'POST' && mAdm) {
      const id = Number(mAdm[1]); const action = mAdm[2];
      return readBody(req, res, (raw) => {
      const data = JSON.parse(raw || '{}');
      const row = db.prepare('SELECT id, status, revision FROM submissions WHERE id=?').get(id);
      if (!row) return send(res, 404, { ok: false, error: 'not_found' });
      if (Number(data.baseRevision) !== row.revision) return send(res, 409, { ok: false, error: 'revision_conflict', currentRevision: row.revision });
      if (action === 'delete') { db.prepare('DELETE FROM submissions WHERE id=?').run(id); attDelete(id); return send(res, 200, { ok: true, id, action }); }
      if (row.status !== 'pending') return send(res, 409, { ok: false, error: 'not_pending', status: row.status });
      let artifact;
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
        if (!current || current.status !== 'pending' || current.revision !== Number(data.baseRevision)) { db.exec('ROLLBACK'); return send(res, 409, { ok: false, error: 'revision_conflict' }); }
        if (action === 'approve' && current.type !== 'code_component') artifact = workshopBridge.ensureArtifact(current);
        db.prepare('UPDATE submissions SET status=? WHERE id=?').run(action === 'approve' ? 'approved' : 'rejected', id);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        return send(res, e.status || 500, { ok: false, error: e.code || 'contract_error', ...(e instanceof Contract.ContractError ? { message: e.message } : {}) });
      }
      console.log(`[submission] admin-${action} id=${id} outcome=ok`);
      return send(res, 200, { ok: true, id, action, ...(artifact ? { artifact } : {}) });
      });
    }
    return send(res, 404, { ok: false, error: 'not_found' });
  }

  if (m !== 'GET' && m !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed', method: m });
  return send(res, 404, { ok: false, error: 'not_found', path: p });
  } catch (e) { send(res, e instanceof PaginationError ? 400 : 500, { ok: false, error: e instanceof PaginationError ? e.code : 'internal_error' }); }
});

const STARTED = nowIso();
server.listen(PORT, HOST, () => console.log(`[gateway] v0.8.2 listening on http://${HOST}:${PORT}`));
server.on('clientError', (_err, socket) => socket.destroy());
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
