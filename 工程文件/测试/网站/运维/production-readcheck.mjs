// 只读页面/API及无凭据鉴权探针，不登录、不创建内容、不操作真实账号。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const vps = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://cyber2051.top';
const results = [];
async function check(name, url, options, accept) {
  try {
    const response = await fetch(origin + url, { ...options, signal: AbortSignal.timeout(15000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const headers = Object.fromEntries(['access-control-allow-origin', 'access-control-allow-headers', 'cache-control'].map(key => [key, response.headers.get(key)]));
    const ok = accept(response, bytes, headers);
    results.push({ name, url, status: response.status, headers, ok });
  } catch (error) { results.push({ name, url, ok: false, error: error.message }); }
}
const jobs = [
  check('健康版本0.8.1', '/api/workshop/health', {}, (r, b) => r.status === 200 && JSON.parse(b).version === '0.8.1'),
  check('匿名账号列表拒绝', '/api/admin/accounts', {}, r => r.status === 401),
  check('管理跨域不开放', '/api/admin/accounts', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8000', 'Access-Control-Request-Method': 'GET' } }, (r, b, h) => r.status === 401 && !h['access-control-allow-origin']),
  check('我的投稿必须登录', '/api/workshop/me/submissions', {}, r => r.status === 401),
  check('公开目录跨域', '/api/workshop/submissions', { headers: { Origin: 'http://localhost:8000' } }, (r, b, h) => r.status === 200 && h['access-control-allow-origin'] === '*'),
  check('Bearer预检', '/api/workshop/submissions', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } }, (r, b, h) => r.status === 204 && h['access-control-allow-origin'] === '*' && /Authorization/i.test(h['access-control-allow-headers'])),
  check('公开公告', '/api/workshop/announcements', {}, r => r.status === 200),
  check('未发布更新清单仍404且不缓存', '/updates/manifest.json', {}, (r, b, h) => r.status === 404 && /no-store/.test(h['cache-control'])),
  check('未发布下载清单仍404且不缓存', '/download/manifest.json', {}, (r, b, h) => r.status === 404 && /no-store/.test(h['cache-control']))
];
for (const action of ['ban', 'unban', 'delete']) jobs.push(check('匿名' + action + '拒绝', '/api/admin/accounts/00000000000000000000000000000000/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, r => r.status === 401));
for (const [url, file] of [['/workshop/admin.html', 'admin.html'], ['/my.html', 'my.html'], ['/workshop/submit.html', 'submit.html'], ['/user.js', 'user.js'], ['/i18n.js', 'i18n.js']]) {
  const expected = crypto.createHash('sha256').update(fs.readFileSync(path.join(vps, 'repair-20261003/deployment/vps/gateway/public', file))).digest('hex');
  jobs.push(check('网页与候选字节一致：' + file, url + '?repair=20261003', {}, (r, b) => r.status === 200 && crypto.createHash('sha256').update(b).digest('hex') === expected));
}
await Promise.all(jobs);
const evidence = { checkedAt: new Date().toISOString(), origin, scope: 'public read-only and unauthenticated rejection checks; no real OAuth or SillyTavern acceptance', passed: results.filter(x => x.ok).length, failed: results.filter(x => !x.ok).length, results };
fs.writeFileSync(path.join(vps, 'repair-20261003/production-public-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
for (const result of results) console.log((result.ok ? 'PASS ' : 'FAIL ') + result.name + ' status=' + result.status + (result.error ? ' ' + result.error : ''));
console.log('RESULT ' + evidence.passed + ' passed / ' + evidence.failed + ' failed');
if (evidence.failed) process.exitCode = 1;
