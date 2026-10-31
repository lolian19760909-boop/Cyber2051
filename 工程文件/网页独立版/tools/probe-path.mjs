import { join, relative, resolve, normalize } from 'node:path';
import { existsSync } from 'node:fs';

const root = join('D:/deepseek harness Coding/赛博小祥2051/工程文件', '卡片源码');
const inputs = ['/card/%E5%9C%B0%E5%9B%BE/places.json', '/card/地图/places.json'];

function safeJoin(rootDir, urlPath) {
  let decoded = urlPath;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    decoded = urlPath;
  }
  const clean = normalize(decoded).replace(/^[/\\]+/, '');
  if (!clean || clean.includes('..')) return null;
  const full = resolve(rootDir, clean);
  const rel = relative(resolve(rootDir), full);
  if (!rel || rel.startsWith('..')) return null;
  return full;
}

for (const input of inputs) {
  const sliced = input.slice(6);
  const out = safeJoin(root, sliced);
  console.log(JSON.stringify(input), '->', out, out ? existsSync(out) : '(null)');
}
console.log('root=', root, existsSync(root));
