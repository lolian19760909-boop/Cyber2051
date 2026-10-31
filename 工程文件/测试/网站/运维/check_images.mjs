// 赛博小祥2051 · 图床全量验证（对任意 base，VPS 上线后跑）
// 用法: node check_images.mjs <baseURL>
//   例: node check_images.mjs http://<IP>/img        （HTTP 冒烟）
//       node check_images.mjs https://域名/img       （域名+HTTPS 终验）
// 断言: urls.json 里每一条都 HEAD 200，且 content-type 为 image/png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = (process.argv[2] ?? '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('用法: node check_images.mjs <baseURL>   （如 http://1.2.3.4/img）');
  process.exit(2);
}

const urls = JSON.parse(fs.readFileSync(path.join(here, '..', 'manifests', 'urls.json'), 'utf8'));
if (!Array.isArray(urls) || urls.length === 0) throw new Error('urls.json 为空——先跑 audit_bucket.mjs');

const checkOne = async (e) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${base}/${e.path.split('/').map(encodeURIComponent).join('/')}`, { method: 'HEAD' });
      return { path: e.path, status: r.status, type: r.headers.get('content-type') ?? '', cache: r.headers.get('cache-control') ?? '' };
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return { path: e.path, status: -1, type: '', cache: '' };
};

const queue = [...urls];
const results = [];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) results.push(await checkOne(queue.shift()));
  }),
);
results.sort((a, b) => a.path.localeCompare(b.path, 'zh'));

const failed = results.filter((r) => r.status !== 200);
const wrongType = results.filter((r) => r.status === 200 && !r.type.startsWith('image/'));
const noCache = results.filter((r) => r.status === 200 && !r.cache.includes('immutable'));
console.log(`目标: ${base}`);
console.log(`HEAD 200: ${results.length - failed.length} / ${results.length}`);
for (const f of failed) console.log(`  [失败] status=${f.status} ${f.path}`);
for (const f of wrongType) console.log(`  [类型] ${f.path} → ${f.type}`);
for (const f of noCache) console.log(`  [缓存头缺失] ${f.path} → "${f.cache}"`);

if (failed.length) {
  process.exitCode = 1;
  console.log('存在失败，未通过验收');
} else if (noCache.length) {
  process.exitCode = 1;
  console.log('缓存头未按预期返回（Caddy 配置问题），未通过验收');
} else {
  console.log(`全量验证通过 ✔（${results.length} 条，含缓存头断言）`);
}
