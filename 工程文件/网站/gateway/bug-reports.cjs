'use strict';
const crypto = require('node:crypto');
const MAX_TEXT = 100000, MAX_IMAGE = 5 * 1024 * 1024, MAX_TOTAL = 12 * 1024 * 1024;
const MAX_REQUEST = 18 * 1024 * 1024;
function hasJpegImage(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let at = 2, inScan = false, sawScan = false;
  while (at < bytes.length) {
    if (bytes[at++] !== 0xff) { if (inScan) continue; return false; }
    while (at < bytes.length && bytes[at] === 0xff) at++;
    if (at >= bytes.length) return false;
    const marker = bytes[at++];
    if (inScan && (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7))) continue;
    if (marker === 0xd9) return sawScan;
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) return false;
    if (marker === 0x01) continue;
    if (at + 2 > bytes.length) return false;
    const length = bytes.readUInt16BE(at);
    if (length < 2 || at + length > bytes.length) return false;
    // Skip whole metadata segments, including any embedded thumbnail's EOI.
    at += length;
    // A JPEG may have multiple scans; DNL can occur inside an existing scan.
    inScan = marker === 0xda || (inScan && marker === 0xdc);
    if (marker === 0xda) sawScan = true;
  }
  return false;
}
function imageType(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.toString('ascii', 12, 16) === 'IHDR') return 'image/png';
  // Main-image EOI may precede padding or additional images/video in phone JPEGs.
  if (hasJpegImage(bytes)) return 'image/jpeg';
  if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) return 'image/webp';
  return null;
}
function createBugReports({ db, send, readRawBody, authorize, pagination, rateLimited }) {
  // Private screenshots stay in SQLite, outside every static/public attachment directory.
  db.exec(`CREATE TABLE IF NOT EXISTS bug_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
    publisher_id TEXT NOT NULL, author_name TEXT NOT NULL, body TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bug_reports_publisher ON bug_reports(publisher_id);
  CREATE TABLE IF NOT EXISTS bug_report_images (
    id TEXT PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES bug_reports(id),
    mime TEXT NOT NULL, bytes INTEGER NOT NULL, data BLOB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bug_report_images_report ON bug_report_images(report_id);`);
  const count = () => db.prepare('SELECT COUNT(*) AS total FROM bug_reports').get();
  function removeForPublisher(id) {
    db.prepare('DELETE FROM bug_report_images WHERE report_id IN (SELECT id FROM bug_reports WHERE publisher_id=?)').run(id);
    db.prepare('DELETE FROM bug_reports WHERE publisher_id=?').run(id);
  }
  function submit(req, res) {
    const auth = authorize(req);
    if (auth.error) { send(res, auth.code || 401, { ok: false, error: auth.error === 'unauthorized' ? 'login_required' : auth.error }); return; }
    readRawBody(req, res, MAX_REQUEST, raw => {
      // Recheck after receiving the upload, including a ban/session expiry during transfer.
      const current = authorize(req);
      if (current.error) return send(res, current.code || 401, { ok: false, error: current.error });
      let input;
      try { input = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, { ok: false, error: 'invalid_json' }); }
      if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(key => !['body','images'].includes(key))) return send(res, 400, { ok: false, error: 'invalid_report' });
      if (typeof input.body !== 'string' || !input.body.trim()) return send(res, 400, { ok: false, error: 'body_required' });
      if (input.body.length > MAX_TEXT) return send(res, 400, { ok: false, error: 'body_too_long', max: MAX_TEXT });
      if (input.images !== undefined && !Array.isArray(input.images)) return send(res, 400, { ok: false, error: 'invalid_images' });
      const images = input.images || [];
      if (images.length > 4) return send(res, 400, { ok: false, error: 'too_many_images' });
      const prepared = []; let total = 0;
      for (const image of images) {
        if (!image || typeof image.data !== 'string' || image.data.length > Math.ceil(MAX_IMAGE / 3) * 4) return send(res, 400, { ok: false, error: 'invalid_image' });
        const data = Buffer.from(image.data, 'base64'), mime = imageType(data);
        if (!mime || data.length > MAX_IMAGE || data.toString('base64') !== image.data) return send(res, 400, { ok: false, error: 'invalid_image' });
        total += data.length;
        if (total > MAX_TOTAL) return send(res, 413, { ok: false, error: 'images_too_large' });
        prepared.push({ id: crypto.randomBytes(16).toString('hex'), mime, data });
      }
      const since = new Date(Date.now() - 86400000).toISOString();
      if (db.prepare('SELECT COUNT(*) AS n FROM bug_reports WHERE created_at>=?').get(since).n >= 100) return send(res, 429, { ok: false, error: 'daily_limit' });
      if (rateLimited('bugs:' + current.row.publisher_id, 3, 600000)) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '600' });
      db.exec('BEGIN IMMEDIATE');
      let id;
      try {
        id = Number(db.prepare('INSERT INTO bug_reports(created_at,publisher_id,author_name,body) VALUES (?,?,?,?)')
          .run(new Date().toISOString(), current.row.publisher_id, String(current.sess.displayName || ''), input.body).lastInsertRowid);
        for (const image of prepared) db.prepare('INSERT INTO bug_report_images(id,report_id,mime,bytes,data) VALUES (?,?,?,?,?)').run(image.id, id, image.mime, image.data.length, image.data);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      send(res, 201, { ok: true, id, private: true });
    });
  }
  function handle(req, res, url, method) {
    const route = url.pathname;
    if (route === '/api/workshop/bugs' && method === 'POST') { submit(req, res); return true; }
    // server.js applies adminOk before dispatching any /api/admin/ route.
    if (route === '/api/admin/bugs' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 120);
      const params = new URLSearchParams(url.searchParams); if (!params.has('pageSize')) params.set('pageSize', '24');
      send(res, 200, pagination.page(db, params, {
        scope: ['admin-bugs', q, 'id-desc'], from: 'bug_reports',
        select: 'id,created_at,author_name,substr(body,1,180) AS summary,(SELECT COUNT(*) FROM bug_report_images WHERE report_id=bug_reports.id) AS imageCount',
        where: q ? '(LOWER(author_name) LIKE ? OR LOWER(body) LIKE ?)' : '1=1', args: q ? ['%' + q + '%', '%' + q + '%'] : [], keys: [{ column: 'id', type: 'number' }],
      })); return true;
    }
    const detail = route.match(/^\/api\/admin\/bugs\/(\d+)$/);
    if (detail && method === 'GET') {
      const item = db.prepare('SELECT id,created_at,author_name,body FROM bug_reports WHERE id=?').get(Number(detail[1]));
      if (!item) { send(res, 404, { ok: false, error: 'not_found' }); return true; }
      item.images = db.prepare('SELECT id,mime,bytes FROM bug_report_images WHERE report_id=? ORDER BY rowid').all(item.id);
      send(res, 200, { ok: true, item }); return true;
    }
    const attachment = route.match(/^\/api\/admin\/bugs\/(\d+)\/images\/([a-f0-9]{32})$/);
    if (attachment && method === 'GET') {
      const image = db.prepare('SELECT mime,bytes,data FROM bug_report_images WHERE report_id=? AND id=?').get(Number(attachment[1]), attachment[2]);
      if (!image) { send(res, 404, { ok: false, error: 'not_found' }); return true; }
      res.writeHead(200, { 'Content-Type': image.mime, 'Content-Length': image.bytes, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
      res.end(Buffer.from(image.data)); return true;
    }
    return false;
  }
  return { handle, count, removeForPublisher };
}
module.exports = { createBugReports };
