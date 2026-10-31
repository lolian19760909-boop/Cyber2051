// Public reads and tiny unauthenticated rejection checks only. No login identity or publishing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const vps = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const receiptDir = path.join(vps, 'official-publish-20261003');
const candidate = JSON.parse(fs.readFileSync(path.join(receiptDir, 'candidate-receipt.json'), 'utf8'));
const origin = 'https://cyber2051.top';
const results = [];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function check(name, route, options, accept) {
  try {
    const response = await fetch(origin + route, { ...options, signal: AbortSignal.timeout(15000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const headers = Object.fromEntries(['access-control-allow-origin', 'access-control-allow-headers', 'cache-control'].map(key => [key, response.headers.get(key)]));
    results.push({ name, route, status: response.status, headers, ok: accept(response, bytes, headers) });
  } catch (error) { results.push({ name, route, ok: false, error: error.code || error.name }); }
}
const jobs = [
  check('gateway health', '/api/workshop/health', {}, (response, bytes) => response.status === 200 && JSON.parse(bytes).ok === true && JSON.parse(bytes).version === '0.8.1'),
  check('original login me rejects anonymous', '/api/workshop/me', {}, response => response.status === 401),
  check('original owner submissions rejects anonymous', '/api/workshop/me/submissions', {}, response => response.status === 401),
  check('official me rejects anonymous', '/api/official/me', {}, response => response.status === 401),
  check('official preview authenticates before parsing', '/api/official/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }, response => response.status === 401),
  check('official publish authenticates before parsing', '/api/official/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }, response => response.status === 401),
  check('ordinary admin accounts rejects anonymous', '/api/admin/accounts', {}, response => response.status === 401),
  check('official grant rejects anonymous', '/api/admin/publishers/0000000000000000/official-release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"enabled":true}' }, response => response.status === 401),
  check('official audit rejects anonymous', '/api/admin/official/releases', {}, response => response.status === 401),
  check('official CORS stays same origin', '/api/official/me', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:8000', 'Access-Control-Request-Method': 'GET' } }, (response, bytes, headers) => !headers['access-control-allow-origin']),
  check('admin CORS stays same origin', '/api/admin/accounts', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:8000', 'Access-Control-Request-Method': 'GET' } }, (response, bytes, headers) => response.status === 401 && !headers['access-control-allow-origin']),
  check('original workshop catalog public CORS', '/api/workshop/submissions', { headers: { Origin: 'http://127.0.0.1:8000' } }, (response, bytes, headers) => response.status === 200 && headers['access-control-allow-origin'] === '*'),
  check('original workshop Bearer preflight', '/api/workshop/submissions', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:8000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } }, (response, bytes, headers) => response.status === 204 && headers['access-control-allow-origin'] === '*' && /Authorization/i.test(headers['access-control-allow-headers'])),
  check('original announcements public', '/api/workshop/announcements', {}, response => response.status === 200),
  check('v3 not published and no error caching', '/updates/v3/manifest.json', {}, (response, bytes, headers) => response.status === 404 && /no-store/.test(headers['cache-control']) && headers['access-control-allow-origin'] === '*'),
  check('old update manifest no regression', '/updates/manifest.json', {}, (response, bytes, headers) => response.status === 404 && /no-store/.test(headers['cache-control'])),
  check('old download manifest no regression', '/download/manifest.json', {}, (response, bytes, headers) => response.status === 404 && /no-store/.test(headers['cache-control'])),
  check('private key absent from public update root', '/updates/v3/private.pem', { method: 'HEAD' }, response => response.status === 404),
  check('website home reachable', '/', {}, response => response.status === 200),
  check('original submit page reachable', '/workshop/submit.html', {}, response => response.status === 200)
];
for (const [route, relative] of [['/publish.html', 'gateway/public/publish.html'], ['/publish.js', 'gateway/public/publish.js'], ['/workshop/admin.html', 'gateway/public/admin.html'], ['/my.html', 'gateway/public/my.html']]) {
  const expected = candidate.files.find(file => file.destination === relative).sha256;
  jobs.push(check('public file matches candidate: ' + relative, route + '?official=' + candidate.manifestSha256.slice(0, 12), {}, (response, bytes) => response.status === 200 && digest(bytes) === expected));
}
await Promise.all(jobs);
const evidence = { checkedAt: new Date().toISOString(), origin, scope: 'public reads and unauthenticated rejection checks; real OAuth and role grant not performed', manifestSha256: candidate.manifestSha256, passed: results.filter(result => result.ok).length, failed: results.filter(result => !result.ok).length, results };
fs.writeFileSync(path.join(receiptDir, 'production-public-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
for (const result of results) console.log((result.ok ? 'PASS ' : 'FAIL ') + result.name + ' status=' + result.status + (result.error ? ' ' + result.error : ''));
console.log('RESULT ' + evidence.passed + ' passed / ' + evidence.failed + ' failed');
if (evidence.failed) process.exitCode = 1;
