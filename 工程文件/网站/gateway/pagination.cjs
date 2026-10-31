'use strict';
// Optional keyset pagination: legacy callers keep their existing limits and response shape.
const crypto = require('node:crypto');
class PaginationError extends Error {
  constructor(code) { super(code); this.code = code; this.status = 400; }
}
function createPagination(secret) {
  const sign = text => crypto.createHmac('sha256', secret).update(text).digest('base64url');
  function page(db, searchParams, { scope, from, select = '*', where = '1=1', args = [], keys, map = row => row }) {
    if (!searchParams.has('pageSize')) return null;
    const rawSize = searchParams.get('pageSize');
    if (!/^(?:[1-9]\d?|100)$/.test(rawSize)) throw new PaginationError('invalid_page_size');
    const size = Number(rawSize), binding = JSON.stringify(scope), cursor = searchParams.get('cursor');
    let after;
    if (cursor) {
      try {
        if (cursor.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cursor)) throw Error();
        const [encoded, signature] = cursor.split('.'), wanted = sign(encoded);
        const a = Buffer.from(signature), b = Buffer.from(wanted);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw Error();
        const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (decoded.v !== 1 || decoded.scope !== binding || !Array.isArray(decoded.keys) || decoded.keys.length !== keys.length) throw Error();
        if (!decoded.keys.every((value, i) => keys[i].type === 'number' ? Number.isSafeInteger(value) : typeof value === 'string')) throw Error();
        after = decoded.keys;
      } catch { throw new PaginationError('invalid_cursor'); }
    }
    const total = Number(db.prepare('SELECT COUNT(*) AS n FROM ' + from + ' WHERE ' + where).get(...args).n);
    let condition = where, queryArgs = [...args];
    if (after) {
      const branches = keys.map((key, i) => {
        const terms = keys.slice(0, i).map((prior, j) => { queryArgs.push(after[j]); return prior.column + '=?'; });
        terms.push(key.column + '<?'); queryArgs.push(after[i]);
        return '(' + terms.join(' AND ') + ')';
      });
      condition += ' AND (' + branches.join(' OR ') + ')';
    }
    const rows = db.prepare('SELECT ' + select + ' FROM ' + from + ' WHERE ' + condition + ' ORDER BY ' + keys.map(key => key.column + ' DESC').join(', ') + ' LIMIT ?').all(...queryArgs, size + 1);
    const hasMore = rows.length > size; if (hasMore) rows.pop();
    let nextCursor = null;
    if (hasMore) {
      const last = rows[rows.length - 1];
      const encoded = Buffer.from(JSON.stringify({ v: 1, scope: binding, keys: keys.map(key => last[key.field || key.column.split('.').pop()]) })).toString('base64url');
      nextCursor = encoded + '.' + sign(encoded);
    }
    return { ok: true, items: rows.map(map), total, nextCursor };
  }
  return { page };
}
module.exports = { createPagination, PaginationError };
