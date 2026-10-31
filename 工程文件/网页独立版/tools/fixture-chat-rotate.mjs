/**
 * 把一个跑脏的原生测试聊天裁成干净基线：只保留 header + 开场行（第一条助手楼），
 * 清掉 chat_metadata 里的网页投影（cxx2051_web）与酒馆侧残留，写成新的 chatId，
 * 再把 reports/r4-browser-check.json 的 fixture.chatId 指过去。
 * 用法：node tools/fixture-chat-rotate.mjs [--avatar=WEB_HOST_TEST_*.png] [--dry]
 * 不删除任何旧聊天文件；只新建。
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const WEB = fileURLToPath(new URL('../', import.meta.url));
const ROOT = path.resolve(WEB, '..');
const CACHE = path.join(ROOT, '.cache', 'web-host-20261025');
const arg = (name, fallback) => {
  const hit = process.argv.find(value => value.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const reports = path.join(WEB, 'reports');
const check = JSON.parse(fs.readFileSync(path.join(reports, 'r4-browser-check.json'), 'utf8'));
const avatar = arg('avatar', check.fixture.avatar);
const dry = process.argv.includes('--dry');
const chatDir = path.join(CACHE, 'data-clean', 'default-user', 'chats', avatar.replace(/\.png$/, ''));
const sourceChat = arg('chatid', check.fixture.chatId);
const source = path.join(chatDir, sourceChat + '.jsonl');
const lines = fs.readFileSync(source, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
const header = lines[0];
const opening = lines.slice(1).find(row => row.is_user !== true && row.is_system !== true && String(row.mes || '').includes('OpeningForm')) || lines[1];
if (!header || !opening) throw new Error('源聊天缺少 header 或开场行');
const metadata = {...(header.chat_metadata || {})};
for (const key of Object.keys(metadata)) if (/^cxx/i.test(key)) delete metadata[key];
delete metadata.tainted;
const nextHeader = {...header, chat_metadata: metadata};
const nextOpening = {...opening};
delete nextOpening.extra?.cxx_context;
const chatId = 'web-controlled-' + Date.now();
const rows = [nextHeader, nextOpening].map(row => JSON.stringify(row)).join('\n') + '\n';
console.log(JSON.stringify({
  mode: dry ? 'dry' : 'write',
  source, sourceChat, sourceRows: lines.length, sourceBytes: fs.statSync(source).size,
  chatId, rows: 2, bytes: Buffer.byteLength(rows),
  droppedMetadataKeys: Object.keys(header.chat_metadata || {}).filter(key => !(key in metadata))
}));
if (dry) process.exit(0);
fs.writeFileSync(path.join(chatDir, chatId + '.jsonl'), rows);
fs.writeFileSync(path.join(reports, 'r4-browser-check.json'), JSON.stringify({...check, fixture: {...check.fixture, chatId, rotatedAt: new Date().toISOString()}}, null, 2) + '\n');
console.log('rotated -> ' + chatId);
