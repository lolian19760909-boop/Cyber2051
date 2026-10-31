#!/usr/bin/env node
// 只碰夹具聊天：报告 cxx2051_web 队列状态；--clear 先备份再清 tasks/drafts（不动玩家数据里的正文行）。
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback = null) => {
  const hit = process.argv.find(row => row.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const root = path.resolve('..', '.cache/web-host-20261025/data-clean/default-user/chats');
const dir = arg('dir', 'WEB_HOST_TEST_1792927112818');
const chat = arg('chat', 'c1-clean-1793014453118');
const file = path.join(root, dir, chat + '.jsonl');
if (!fs.existsSync(file)) {
  console.log(JSON.stringify({ ok: false, reason: 'chat_missing', file }, null, 1));
  process.exit(1);
}
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(row => row.trim().length > 0);
const meta = JSON.parse(lines[0]);
const state = meta?.chat_metadata?.cxx2051_web ?? null;
const brief = state ? {
  revision: state.revision ?? null,
  rows: Array.isArray(state.records?.rows) ? state.records.rows.length : null,
  tasks: Array.isArray(state.records?.tasks) ? state.records.tasks.length : null,
  drafts: Array.isArray(state.records?.drafts) ? state.records.drafts.length : null,
  pendingTx: Array.isArray(state.pendingTx) ? state.pendingTx.length : null,
} : null;
const report = { ok: true, file, lines: lines.length, bytes: fs.statSync(file).size, cxx: brief };
if (arg('clear', 'false') === 'true' && state) {
  const backup = file + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(file, backup);
  state.records = state.records ?? {};
  state.records.tasks = [];
  state.records.drafts = [];
  lines[0] = JSON.stringify(meta);
  fs.writeFileSync(file, lines.join('\n') + '\n');
  report.cleared = { backup: path.basename(backup), after: { tasks: 0, drafts: 0 } };
}
console.log(JSON.stringify(report, null, 1));
