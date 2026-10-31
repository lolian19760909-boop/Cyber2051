import fs from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const content = Buffer.concat([Buffer.from(name), data]);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); content.copy(result, 4); result.writeUInt32BE(crc32(content), result.length - 4);
  return result;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(2); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6;
const image = Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header),
  chunk('IDAT', deflateSync(Buffer.from([0,255,40,40,255,40,210,130,255,0,50,130,255,255,250,210,40,255]))), chunk('IEND', Buffer.alloc(0)),
]);
const animation = {
  v: '5.7.4', fr: 30, ip: 0, op: 30, w: 100, h: 100, nm: '自制外置图片夹具', ddd: 0,
  assets: [{ id: 'image', w: 2, h: 2, u: 'images/', p: 'checker.png', e: 0 }],
  layers: [{ ddd: 0, ind: 1, ty: 2, refId: 'image', sr: 1, ip: 0, op: 30, st: 0, bm: 0,
    ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [50,50,0] }, a: { a: 0, k: [1,1,0] }, s: { a: 0, k: [5000,5000,100] } },
  }],
};
const directory = new URL('../../.cache/visual-runtime-20261019/fixtures/', import.meta.url);
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(new URL('checker.png', directory), image);
await fs.writeFile(new URL('external.json', directory), JSON.stringify(animation));
