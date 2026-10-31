// 赛博小祥2051 · 图床迁移清单生成 + R2 公开桶全量 HEAD 审计
// 用法（本机）: node audit_bucket.mjs
// 输入 : ../manifests/bucket-manifest.json（桶清单快照）
// 输出 : ../manifests/urls.json       —— 153 条 {path,url}，同步与验证共用的唯一事实源
//        ../manifests/size-audit.json —— 全量 HEAD 结果与总大小收据
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(here, '..', 'manifests', 'bucket-manifest.json');
const outUrls = path.join(here, '..', 'manifests', 'urls.json');
const outSizes = path.join(here, '..', 'manifests', 'size-audit.json');

// ---------- 清单 → URL（每段独立 encodeURIComponent，与卡内 encodeURIComponent(name+'/'+stem) 等价）----------
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!manifest.bucket) throw new Error('清单缺 bucket 字段');
const base = manifest.bucket.replace(/\/+$/, '');
const entries = [];
for (const [folder, files] of Object.entries(manifest.files)) {
  for (const f of files) {
    if (!f.toLowerCase().endsWith('.png')) throw new Error(`清单出现非 png 条目: ${folder}/${f}`);
    if (entries.some((e) => e.path === `${folder}/${f}`)) throw new Error(`清单重复条目: ${folder}/${f}`);
    entries.push({
      folder,
      file: f,
      path: `${folder}/${f}`,
      url: `${base}/${encodeURIComponent(folder)}/${encodeURIComponent(f)}`,
    });
  }
}
if (entries.length === 0) throw new Error('清单为空');
fs.writeFileSync(outUrls, JSON.stringify(entries, null, 2));
console.log(`urls.json 写入: ${entries.length} 条（10 个角色文件夹）`);

// ---------- 全量 HEAD（并发 8，失败重试 3 次）----------
const headOne = async (e) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(e.url, { method: 'HEAD' });
      return { ...e, status: r.status, bytes: Number(r.headers.get('content-length') ?? -1), type: r.headers.get('content-type') ?? '' };
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return { ...e, status: -1, bytes: -1, type: '' };
};
const queue = [...entries];
const results = [];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) results.push(await headOne(queue.shift()));
  }),
);
results.sort((a, b) => a.path.localeCompare(b.path, 'zh'));

const failed = results.filter((r) => r.status !== 200);
const totalBytes = results.reduce((s, r) => s + Math.max(r.bytes, 0), 0);
const receipt = {
  auditedAt: new Date().toISOString(),
  bucket: base,
  count: results.length,
  okCount: results.length - failed.length,
  failedCount: failed.length,
  totalBytes,
  totalMiB: Math.round((totalBytes / 1024 / 1024) * 10) / 10,
  results,
};
fs.writeFileSync(outSizes, JSON.stringify(receipt, null, 2));

console.log(`HEAD 200: ${receipt.okCount} / ${results.length}`);
console.log(`总大小: ${receipt.totalMiB} MiB（${totalBytes} 字节）`);
// 内容类型异常也要报（r2.dev 应统一给 image/png）
const wrongType = results.filter((r) => r.status === 200 && !r.type.startsWith('image/'));
if (wrongType.length) console.log(`内容类型异常: ${wrongType.map((r) => `${r.path}→${r.type}`).join(', ')}`);
if (failed.length) {
  console.log('失败条目:');
  for (const f of failed) console.log(`  status=${f.status} ${f.path}`);
  process.exitCode = 1;
} else {
  console.log('审计通过 ✔');
}
