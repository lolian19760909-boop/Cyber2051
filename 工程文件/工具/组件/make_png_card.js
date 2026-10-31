// 发布卡打包：card.json → PNG tEXt 嵌入（SillyTavern V2/V3 标准读取方式）
// 嵌入关键字：chara（V2 通用）+ ccv3（V3，ST 优先读取）；二者内容相同。
// 先断言、后写盘；写盘后回读校验（提取→base64 解码→与源 JSON 逐字节比对）。
// 用法: node make_png_card.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '../..');
if (!process.argv[2] || !process.argv[3]) throw Error('用法: node make_png_card.js <card.json> <cover.png> [output.png]');
const CARD = path.resolve(process.argv[2]), COVER = path.resolve(process.argv[3]);
const OUT = path.resolve(process.argv[4] || path.join(ROOT,'.cache/card.png'));
fs.mkdirSync(path.dirname(OUT),{recursive:true});

let fails = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ 断言失败: ' + msg); fails++; }
}

// ── 读入 ─────────────────────────────────────────────────────
const jsonBuf = fs.readFileSync(CARD);
assert(jsonBuf.length > 1_000_000, '卡 JSON 大小合理: ' + jsonBuf.length);
JSON.parse(jsonBuf.toString('utf8')); // 语法校验
const png = fs.readFileSync(COVER);
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
assert(png.subarray(0, 8).equals(SIG), 'PNG 签名合法');
assert(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0, 'IHDR 尺寸字段存在');

// ── 解析块结构，找 IHDR 结束位置 ─────────────────────────────
let off = 8, ihdrEnd = -1, iendPos = -1, chunks = 0;
while (off + 8 <= png.length) {
  const len = png.readUInt32BE(off);
  const type = png.toString('ascii', off + 4, off + 8);
  chunks++;
  if (type === 'IHDR') ihdrEnd = off + 8 + len + 4;
  if (type === 'IEND') { iendPos = off; break; }
  off += 12 + len;
}
assert(ihdrEnd > 0, '找到 IHDR');
assert(iendPos > ihdrEnd, '找到 IEND');
assert(chunks >= 3, 'PNG 块结构完整');
const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
console.log('封面尺寸: ' + width + 'x' + height + '，块数: ' + chunks + '，JSON: ' + jsonBuf.length + ' B');

// ── 构造 tEXt 块 ─────────────────────────────────────────────
function makeTextChunk(keyword, text) {
  const data = Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), Buffer.from(text, 'latin1')]);
  const type = Buffer.from('tEXt', 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([type, data])) >>> 0, 0);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  return Buffer.concat([len, type, data, crc]);
}
const b64 = jsonBuf.toString('base64');
const chunkChara = makeTextChunk('chara', b64);
const chunkCcv3 = makeTextChunk('ccv3', b64);
console.log('base64 长度: ' + b64.length + ' B，chara 块: ' + chunkChara.length + ' B，ccv3 块: ' + chunkCcv3.length + ' B');

// ── 拼装（插在 IHDR 之后）────────────────────────────────────
const out = Buffer.concat([png.subarray(0, ihdrEnd), chunkChara, chunkCcv3, png.subarray(ihdrEnd)]);

// ── 回读校验：重新解析，提取两个关键字，比对源 JSON ───────────
function extractText(buf, keyword) {
  let o = 8;
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    if (type === 'tEXt') {
      const data = buf.subarray(o + 8, o + 8 + len);
      const z = data.indexOf(0);
      if (data.toString('latin1', 0, z) === keyword) return data.toString('latin1', z + 1);
    }
    if (type === 'IEND') break;
    o += 12 + len;
  }
  return null;
}
const backChara = extractText(out, 'chara');
const backCcv3 = extractText(out, 'ccv3');
assert(backChara === b64, 'chara 回读一致');
assert(backCcv3 === b64, 'ccv3 回读一致');
assert(Buffer.compare(Buffer.from(backChara, 'base64'), jsonBuf) === 0, 'chara 解码与源 JSON 逐字节一致');
assert(Buffer.compare(Buffer.from(backCcv3, 'base64'), jsonBuf) === 0, 'ccv3 解码与源 JSON 逐字节一致');
// 原像素数据不变：输出 = 封面前段 + 两个新块 + 封面剩余段
assert(out.length === png.length + chunkChara.length + chunkCcv3.length, '输出长度守恒');
assert(out.subarray(0, ihdrEnd).equals(png.subarray(0, ihdrEnd)) && out.subarray(out.length - (png.length - ihdrEnd)).equals(png.subarray(ihdrEnd)), '封面像素数据未被改动');
assert(fails === 0, '校验未全过，未写盘');
if (fails) process.exit(1);

fs.writeFileSync(OUT, out);
console.log('✅ 已写盘:', OUT);
console.log('   大小:', out.length, 'B (' + (out.length / 1024 / 1024).toFixed(2) + ' MB)');
