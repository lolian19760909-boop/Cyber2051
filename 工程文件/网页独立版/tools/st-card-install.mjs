/**
 * 把重建后的 card JSON 写回隔离现场的角色卡 PNG（只替换 tEXt 里的 chara/ccv3，图像字节不动）。
 * 用法：node tools/st-card-install.mjs [--card=<json>] [--avatar=<name>.png] [--dry]
 * 必须有备份：首次写入前把原 PNG 复制到 .cache/web-host-20261025/chara-backup/。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('../', import.meta.url));
const ROOT = path.resolve(WEB, '..');
const CACHE = path.join(ROOT, '.cache', 'web-host-20261025');
const arg = (name, fallback) => {
  const hit = process.argv.find(value => value.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const cardFile = arg('card', path.join(CACHE, 'test-card.json'));
const avatar = arg('avatar', 'WEB_HOST_TEST_1792928536359.png');
const target = path.join(CACHE, 'data-clean', 'default-user', 'characters', avatar);
const backupDir = path.join(CACHE, 'chara-backup');
const dry = process.argv.includes('--dry');

const table = (() => {
  const list = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    list[n] = c >>> 0;
  }
  return list;
})();
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunks(png) {
  const out = [];
  let at = 8;
  while (at + 8 <= png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    out.push({ type, data });
    at += 12 + length;
    if (type === 'IEND') break;
  }
  return out;
}

function encode(list) {
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  for (const chunk of list) {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(chunk.data.length, 0);
    head.write(chunk.type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(chunk.type, 'ascii'), chunk.data])), 0);
    parts.push(head, chunk.data, crc);
  }
  return Buffer.concat(parts);
}

const card = JSON.parse(fs.readFileSync(cardFile, 'utf8'));
const payload = Buffer.from(Buffer.from(JSON.stringify(card), 'utf8').toString('base64'), 'utf8');
const before = fs.readFileSync(target);
const list = chunks(before);
const seen = new Set();
for (const chunk of list) {
  if (chunk.type !== 'tEXt') continue;
  const zero = chunk.data.indexOf(0);
  const key = chunk.data.toString('ascii', 0, zero);
  if (key === 'chara' || key === 'ccv3') {
    chunk.data = Buffer.concat([Buffer.from(key, 'ascii'), Buffer.from([0]), payload]);
    seen.add(key);
  }
}
if (!seen.has('chara')) throw new Error('原 PNG 里找不到 chara 文本块，拒绝盲改');
const after = encode(list);
const report = {
  at: new Date().toISOString(),
  cardFile,
  target,
  replaced: [...seen],
  pngBefore: before.length,
  pngAfter: after.length,
  cardName: card.name,
  embedsPatch: /writeNames/.test(JSON.stringify(card)),
};
if (dry) {
  console.log(JSON.stringify({ ...report, dry: true }, null, 2));
  process.exit(0);
}
fs.mkdirSync(backupDir, { recursive: true });
const backup = path.join(backupDir, avatar);
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, after);
const check = fs.readFileSync(target);
console.log(JSON.stringify({ ...report, backup, roundTripBytes: check.length, verify: verify(check) }, null, 2));

function verify(png) {
  const list2 = chunks(png);
  const hit = {};
  for (const chunk of list2) {
    if (chunk.type !== 'tEXt') continue;
    const zero = chunk.data.indexOf(0);
    const key = chunk.data.toString('ascii', 0, zero);
    if (key === 'chara' || key === 'ccv3') hit[key] = chunk.data.length;
  }
  return { chunks: list2.length, text: hit };
}
