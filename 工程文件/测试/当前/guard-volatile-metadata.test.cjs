const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../../卡片源码/运行时/chat-save-guard.js'), 'utf8');

test('比对前剔除宿主注入的运行时元数据，避免新开局被判成不一致', () => {
  assert.match(source, /for\(const key of \['timedWorldInfo','timedEffects','lastInContextMessageId','chat_id_hash','pick_reroll_seed'\]\)delete value\.metadata\[key\];/);
  // chat_id_hash 由 {{pick::}} 首次求值时算出来写进内存，酒馆注释明确说明不落盘（macros.js:519），
  // pick_reroll_seed 也只在当前会话生成；两者都不能当成玩家的改动。
  assert.ok(source.includes("'chat_id_hash'"));
  assert.ok(source.includes("'pick_reroll_seed'"));
});

test('剔除只发生在 normalize 里，写入磁盘的元数据不被改写', () => {
  const normalizeBlock = source.slice(source.indexOf('async function normalize('), source.indexOf('async function load('));
  assert.ok(normalizeBlock.includes('delete value.metadata[key]'));
  assert.ok(!/disk\[0\]\.chat_metadata\.timedWorldInfo/.test(source));
});
