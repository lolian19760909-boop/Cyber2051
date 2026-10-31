// 公告正文发布：notice.txt 是纯文本，随时可改；这里负责预检、原子替换、回读核对。
// 用法：
//   预览：node 工具/发布/notice.cjs --text 公告/公告.txt --out 公告/公告.publish.txt
//   发布：node 工具/发布/notice.cjs --text 公告/公告.txt --publish --write --host root@192.255.152.208 --identity C:/Users/lolian/.ssh/id_ed25519_racknerd
//   复核：node 工具/发布/notice.cjs --verify --host root@192.255.152.208 --identity C:/Users/lolian/.ssh/id_ed25519_racknerd
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const PUBLIC_URL = 'https://cyber2051.top/updates/v3/notice.txt';
const REMOTE_PATH = '/opt/cyber2051/updates/v3/notice.txt';
const LIMIT = 12000;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function run(bin, args, input) {
  const r = spawnSync(bin, args, { input, encoding: input ? 'buffer' : 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(bin + ' failed: ' + (r.error?.message || String(r.stderr).slice(0, 1500)));
  return r.stdout.toString();
}

function canonical(file) {
  const raw = fs.readFileSync(file, 'utf8').split('\r\n').join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  assert.ok(raw.length, '公告正文为空');
  assert.ok(raw.length <= LIMIT, '公告正文超过 ' + LIMIT + ' 字：' + raw.length);
  assert.doesNotMatch(raw, /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/, '公告正文含控制字符');
  const warnings = [];
  if (/<\s*\/?\s*(script|style|iframe|div|p|br|a)\b/i.test(raw)) warnings.push('正文里有类似 HTML 的标签：弹窗按纯文本显示，标签会原样露出。');
  if (raw.startsWith('#')) warnings.push('开头是 # 号：弹窗不会按 Markdown 渲染。');
  if (/TODO|待补|占位/.test(raw)) warnings.push('正文里还有占位词。');
  return { text: raw + '\n', warnings };
}

function sshArgs(o) {
  return ['-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-i', path.resolve(o.identity), o.host];
}

function publish(o, bytes, expected) {
  const code = [
    "const fs=require('fs'),p=require('path'),c=require('crypto'),a=require('assert/strict');",
    'const target=' + JSON.stringify(REMOTE_PATH) + ',expected=' + JSON.stringify(expected) + ';',
    "const hash=b=>c.createHash('sha256').update(b).digest('hex');",
    'const chunks=[];let size=0;',
    "process.stdin.on('data',b=>{size+=b.length;a(size<=524288);chunks.push(b);});",
    "process.stdin.on('end',()=>{const bytes=Buffer.concat(chunks);a.equal(hash(bytes),expected);fs.mkdirSync(p.dirname(target),{recursive:true,mode:0o755});",
    "if(fs.existsSync(target)){const old=fs.readFileSync(target),oldHash=hash(old);if(oldHash===expected){console.log(JSON.stringify({sha256:expected,bytes:bytes.length,changed:false}));return;}const backup=target+'.backup-'+oldHash;if(!fs.existsSync(backup))fs.writeFileSync(backup,old,{flag:'wx',mode:0o600});}",
    "const stage=target+'.next-'+expected;fs.writeFileSync(stage,bytes,{flag:'w',mode:0o644});fs.renameSync(stage,target);",
    "console.log(JSON.stringify({sha256:hash(fs.readFileSync(target)),bytes:bytes.length,changed:true}));});"
  ].join('');
  const payload = Buffer.from(code).toString('base64');
  const answer = run('ssh', sshArgs(o).concat(["node -e 'eval(Buffer.from(\"" + payload + "\",\"base64\").toString())'"]), bytes).trim();
  const result = JSON.parse(answer.split('\n').pop());
  assert.equal(result.sha256, expected, '远端回读哈希不一致');
  return result;
}

async function getPublic() {
  const response = await fetch(PUBLIC_URL + '?t=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  assert(response.ok, '线上读取失败：' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, headers: response.headers };
}

async function main(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].slice(2);
    if (['publish', 'write', 'verify'].includes(key)) o[key] = true;
    else o[key] = argv[++i];
  }
  if (o.verify) {
    assert(o.host && o.identity, '复核需要 --host 与 --identity');
    const remote = run('ssh', sshArgs(o).concat(['sha256sum ' + REMOTE_PATH])).trim().split(/\s+/)[0];
    const live = await getPublic();
    const liveHash = hash(live.bytes);
    const receipt = {
      url: PUBLIC_URL,
      remote,
      liveHash,
      bytes: live.bytes.length,
      matches: remote === liveHash,
      contentType: live.headers.get('content-type'),
      cacheControl: live.headers.get('cache-control'),
      cors: live.headers.get('access-control-allow-origin'),
      firstLine: live.bytes.toString('utf8').split('\n')[0]
    };
    console.log(JSON.stringify(receipt, null, 2));
    assert.equal(receipt.matches, true, '线上字节与磁盘文件不一致');
    return receipt;
  }
  assert(o.text, '需要 --text 指向本地公告正文');
  const { text, warnings } = canonical(path.resolve(o.text));
  const bytes = Buffer.from(text, 'utf8');
  const expected = hash(bytes);
  if (o.expect) assert.equal(expected, o.expect, '正文哈希与 --expect 不一致');
  const preview = { text: path.resolve(o.text), chars: text.trim().length, bytes: bytes.length, sha256: expected, warnings };
  if (o.out) {
    fs.writeFileSync(path.resolve(o.out), bytes);
    preview.out = path.resolve(o.out);
  }
  if (!o.publish) {
    console.log(JSON.stringify(preview, null, 2));
    return preview;
  }
  assert(o.host && o.identity, '发布需要 --host 与 --identity');
  assert.match(o.host, /^[\w.-]+@[\w.-]+$/);
  const remote = o.write ? publish(o, bytes, expected) : null;
  const live = await getPublic();
  const liveHash = hash(live.bytes);
  const receipt = {
    text: preview.text,
    chars: preview.chars,
    sha256: expected,
    written: !!o.write,
    remote,
    liveHash,
    liveMatchesSource: liveHash === expected,
    contentType: live.headers.get('content-type'),
    cacheControl: live.headers.get('cache-control'),
    cors: live.headers.get('access-control-allow-origin'),
    warnings
  };
  console.log(JSON.stringify(receipt, null, 2));
  if (o.write) {
    assert.equal(receipt.liveMatchesSource, true, '线上字节与刚发布的正文不一致');
    assert.match(String(receipt.cacheControl || ''), /no-store/, '线上没有 no-store，缓存会挡住公告修改');
  }
  return receipt;
}

module.exports = { main, canonical, hash, PUBLIC_URL, REMOTE_PATH };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.stack); process.exitCode = 1; });
