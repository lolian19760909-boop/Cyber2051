// 赛博小祥2051 · 切换前资产审计：引用清单 → 旧桶存在性 → VPS 缺口 → 生成同步清单
// 用法（本机）: node audit_card_assets.mjs
// 读 ../manifests/card-refs.json → HEAD 对比 → 写 ../manifests/card-assets-audit.json 与 ../manifests/sync-urls.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const refs = JSON.parse(fs.readFileSync(path.join(here, '..', 'manifests', 'card-refs.json'), 'utf8'));
const OLD_BASE = 'https://pub-e4a0f0c754d9481fabbcb3cf08d1536e.r2.dev/';
const NEW_BASE = process.argv[2] || 'https://cyber2051.top/img/';

// ---------- 汇总去重：全部引用的 e4a0 路径（保持卡内原始编码形态，斜杠=%2F）----------
const paths = new Set();
for (const p of refs.e4a0.literalPaths) paths.add(p); // 卡内原样（整串编码，含 %2F）
for (const raw of refs.e4a0.poolPathsRaw) {
  const dec = (() => { try { return decodeURIComponent(raw); } catch { return null; } })();
  if (!dec) continue;
  if (!/^[^/\s]+\/[^/\s]+$/.test(dec)) continue; // 必须恰好 文件夹/文件名，无空白
  if (/^https?:/i.test(dec) || dec.includes(':')) continue; // 排除误提取
  paths.add(/\.png$/i.test(raw) ? raw : raw + '.png'); // 带扩展名的原样用；裸 stem 由 getCachedImg 运行时补 .png，此处静态补齐
}
const all = [...paths].sort();

const enc = (p) => p.split('/').map(encodeURIComponent).join('/'); // 仅用于把真实斜杠路径转 URL
console.log(`合并后引用路径总数: ${all.length}`);

// ---------- HEAD 检查（并发 8，重试 3）----------
const headSet = async (base, list) => {
  const ok = new Set();
  const queue = [...list];
  const one = async (p) => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(base + p, { method: 'HEAD' }); // p 已是卡内原始编码形态，直接拼
        if (r.status === 200) { ok.add(p); return true; }
        return false;
      } catch { await new Promise((r) => setTimeout(r, 400 * (i + 1))); }
    }
    return false;
  };
  await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await one(queue.shift()); }));
  return ok;
};

console.log('HEAD 检查旧桶（存在性真相源）...');
const onOld = await headSet(OLD_BASE, all);
console.log('HEAD 检查 VPS 现有...');
const onVps = await headSet(NEW_BASE, all);

const stale = all.filter((p) => !onOld.has(p));      // 引用了但旧桶没有 → 卡里本来就是坏的
const missing = [...onOld].filter((p) => !onVps.has(p)); // 旧桶有但 VPS 没有 → 需同步
const audit = {
  auditedAt: new Date().toISOString(),
  totalRefs: all.length,
  onOldBucket: onOld.size,
  staleRefs: stale.sort(),
  missingOnVps: missing.sort(),
  alreadyOnVps: onVps.size,
};
fs.writeFileSync(path.join(here, '..', 'manifests', 'card-assets-audit.json'), JSON.stringify(audit, null, 2));
// 同步清单：全部「旧桶存在」的路径；path=真实斜杠形态（磁盘名），url=旧桶（每段独立编码）
fs.writeFileSync(
  path.join(here, '..', 'manifests', 'sync-urls.json'),
  JSON.stringify([...onOld].sort().map((p) => {
    const dec = (() => { try { return decodeURIComponent(p); } catch { return p; } })();
    return { path: dec, url: OLD_BASE + p };
  }), null, 2),
);

const folderStat = (list) => list.reduce((a, p) => { const f = p.split('/')[0]; a[f] = (a[f] || 0) + 1; return a; }, {});
console.log(`旧桶存在: ${onOld.size}/${all.length} ｜ VPS 已有: ${onVps.size} ｜ 待同步: ${missing.length} ｜ 失效引用: ${stale.length}`);
if (stale.length) {
  console.log('失效引用（旧桶就没有，卡里本来就 404 的）按文件夹:');
  console.log(JSON.stringify(folderStat(stale)));
  console.log('样本:', stale.slice(0, 5).join(' , '));
}
if (missing.length) console.log('待同步样本:', missing.slice(0, 3).join(' , '));
console.log('已写出: card-assets-audit.json + sync-urls.json');
