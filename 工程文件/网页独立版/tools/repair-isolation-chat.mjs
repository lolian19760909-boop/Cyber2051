/**
 * 隔离测试聊天的污染修复（不是产品代码）。
 *
 * 背景：早期测试脚本曾在 `extra.cxx_context` 手写 `{binding:...}` 这类非产品格式，
 * 角色卡的来源登记会 fail-closed 抛 `source-schema`，导致此后每次生成都在请求前中止。
 * 本工具只做两件事，且必须先看 dry-run：
 *   1) 移除无法识别的 `cxx_context` 值（正文、swipe、变量一律不动）；
 *   2) 可选删掉末尾待回复的 user 行（失败尝试留下的残行）。
 * 用法：
 *   node repair-isolation-chat.mjs                 # dry-run，只报告
 *   node repair-isolation-chat.mjs --write         # 落盘（先写同目录 .bak）
 *   node repair-isolation-chat.mjs --write --drop-pending-tail
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = 'cxx_context';
const root = fileURLToPath(new URL('../../', import.meta.url));
const chatFile = path.join(root, '.cache', 'web-host-20261025', 'data-clean', 'default-user', 'chats',
  'WEB_HOST_TEST_1792928536359', 'web-controlled-1792928546613.jsonl');
const write = process.argv.includes('--write');
const dropTail = process.argv.includes('--drop-pending-tail');

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const identifier = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
function foreign(value, variant) {
  if (value === undefined) return null;
  if (!object(value)) return '非对象：' + typeof value;
  if (value.schema !== 1) return 'schema≠1：' + JSON.stringify(value.schema);
  if (!identifier(value.messageId)) return 'messageId 非法：' + JSON.stringify(value.messageId);
  if (variant && !identifier(value.variantId)) return 'variantId 非法：' + JSON.stringify(value.variantId);
  if (variant && !Object.hasOwn(value, 'binding')) return '缺少 binding 键：' + Object.keys(value).join(',');
  return null;
}

const raw = fs.readFileSync(chatFile, 'utf8');
const lines = raw.split('\n').filter(Boolean);
const header = JSON.parse(lines[0]);
const rows = lines.slice(1).map(line => JSON.parse(line));
const report = { file: chatFile, write, dropTail, rowsBefore: rows.length, removals: [], droppedTail: null };

for (let floor = 0; floor < rows.length; floor++) {
  const row = rows[floor];
  const reasonRow = foreign(row[KEY], false);
  if (reasonRow) { delete row[KEY]; report.removals.push({ floor, where: KEY, reason: reasonRow }); }
  const reasonExtra = foreign(row.extra?.[KEY], true);
  if (reasonExtra) { delete row.extra[KEY]; report.removals.push({ floor, where: 'extra.' + KEY, reason: reasonExtra }); }
  for (const [swipe, info] of (row.swipe_info || []).entries()) {
    const reason = foreign(info?.extra?.[KEY], true);
    if (reason) { delete info.extra[KEY]; report.removals.push({ floor, where: `swipe_info[${swipe}].extra.${KEY}`, reason }); }
  }
}

if (dropTail && rows.at(-1)?.is_user) {
  const removed = rows.pop();
  report.droppedTail = { text: String(removed.mes).slice(0, 80), sendDate: removed.send_date };
}

report.rowsAfter = rows.length;
console.log(JSON.stringify(report, null, 2));

if (!write) { console.log('\n[dry-run] 未改动文件；确认后加 --write。'); process.exit(0); }
if (!report.removals.length && !report.droppedTail) { console.log('\n无需修复，文件未改动。'); process.exit(0); }

const backup = chatFile + '.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(chatFile, backup);
const tmp = chatFile + '.tmp';
fs.writeFileSync(tmp, [JSON.stringify(header), ...rows.map(row => JSON.stringify(row))].join('\n') + '\n');
fs.renameSync(tmp, chatFile);
report.backup = backup;
console.log('\n已写入。备份：' + backup);
