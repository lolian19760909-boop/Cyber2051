'use strict';
// 回归：成卡里每个角色脚本必须自带它引用的共享模块。
// 酒馆助手把每个角色脚本放在各自的 iframe/globalThis 里执行，
// 所以「先加载脚本里已有正本、后加载脚本只留告警」的跨脚本去重会 ReferenceError：
// 2.3.17 引入、2.3.20 现场炸出 CxxUpdateCore is not defined，2.3.21 撤销。
// 这里直接查构建产物：任何脚本里都不该再出现「共享模块 … 缺失」的占位告警。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const buildDir = path.join(root, '.cache/build');

function newestCard() {
  const files = fs.existsSync(buildDir)
    ? fs.readdirSync(buildDir).filter(name => /^东京都2051-V2\.3\.\d+\.json$/.test(name))
    : [];
  if (!files.length) return null;
  files.sort((a, b) => fs.statSync(path.join(buildDir, b)).mtimeMs - fs.statSync(path.join(buildDir, a)).mtimeMs);
  return path.join(buildDir, files[0]);
}

test('成卡里没有跨脚本共享模块占位（每个脚本自带正本）', () => {
  const file = newestCard();
  if (!file) {
    assert.ok(true, '没有构建产物，跳过（门禁在构建之后运行）');
    return;
  }
  const card = JSON.parse(fs.readFileSync(file, 'utf8'));
  const scripts = card.data.extensions.tavern_helper.scripts;
  const offenders = [];
  for (const script of scripts) {
    const content = script.content || '';
    if (content.includes('共享模块 ') && content.includes('缺失：请保持「更新与存档」脚本启用')) offenders.push(script.id);
  }
  assert.deepEqual(offenders, [], '这些脚本只留了告警占位而没有正本：' + offenders.join(', '));
});

test('核心脚本自带 CxxUpdateCore 定义', () => {
  const file = newestCard();
  if (!file) return;
  const card = JSON.parse(fs.readFileSync(file, 'utf8'));
  const core = card.data.extensions.tavern_helper.scripts.find(script => script.id === 'cxx-business-core-241');
  assert.ok(core, '缺少核心脚本');
  const content = core.content || '';
  assert.ok(content.includes('root.CxxUpdateCore = api'), '核心脚本里没有 CxxUpdateCore 的正本');
  assert.ok(!content.includes('共享模块 CxxUpdateCore'), '核心脚本里仍有 CxxUpdateCore 的告警占位');
});
