'use strict';
// 预设候选修复：认不出的预设只跳过、不报错；作者已自行改成带内容比对的写法时也不碰它。
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const P = require(path.join(__dirname, '..', '..', '卡片源码', '运行时', 'preset-repair.js'));
const sha256 = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const flat = nodes => (nodes || []).flatMap(n => [n, ...(n && n.type === 'folder' ? flat(n.scripts) : [])]);

function harness(content, { name = '泉此方悬浮窗', data = {} } = {}) {
  const tree = [{ type: 'folder', scripts: [{ id: 's1', name, content, data, type: 'script' }] }];
  let writes = 0;
  const api = {
    getScriptTrees: () => JSON.parse(JSON.stringify(tree)),
    updateScriptTreesWith: fn => { writes += 1; const next = fn(JSON.parse(JSON.stringify(tree))); tree.splice(0, tree.length, ...next); return next; }
  };
  const script = () => flat(tree).find(node => node.type === 'script');
  return { api, writes: () => writes, content: () => script().content, data: () => script().data };
}

// 1) 完全陌生的预设（含该函数、无回执标记）：不抛错，记成 unlisted，内容一字不改。
(async () => {
  const original = 'function restoreIncomingSanitizedTextInChat(messageIndex) {\n  const orig = 1;\n}\n';
  const h = harness(original);
  const result = await P.repair({ api: h.api, sha256 });
  assert.strictEqual(result.changed, 0, '陌生预设不应被改写');
  assert.strictEqual(h.writes(), 0, '陌生预设不应写回');
  assert.strictEqual(h.content(), original, '内容必须原样保留');
  assert.ok(result.skipped.length === 1, '应记录一条跳过');
  assert.strictEqual(result.skipped[0].reason, 'unlisted');
  assert.strictEqual(result.skipped[0].hash, sha256(original));
  console.log('ok 1 陌生预设只跳过');
})().then(async () => {
  // 2) 作者已自己改成 incoming 参数写法（1022 起）：记为 author-updated，同样不改。
  const authorUpdated = `function restoreIncomingSanitizedTextInChat(messageIndex, incoming = false) {
    const a = 1;
  }
  restoreIncomingSanitizedTextInChat(messageId, true);
`;
  const h = harness(authorUpdated);
  const result = await P.repair({ api: h.api, sha256 });
  assert.strictEqual(result.changed, 0);
  assert.strictEqual(h.writes(), 0);
  assert.strictEqual(h.content(), authorUpdated);
  assert.strictEqual(result.skipped[0].reason, 'author-updated');
  console.log('ok 2 作者已改写法不动');
}).then(async () => {
  // 3) 已带本卡回执标记的旧预设：直接跳过，既不报错也不重复改写。
  const patched = `/* ${P.receiptMarker} */ function restoreIncomingSanitizedTextInChat(messageIndex, incoming = false) {}\n`;
  const h = harness(patched);
  const result = await P.repair({ api: h.api, sha256 });
  assert.strictEqual(result.changed, 0);
  assert.strictEqual(result.skipped.length, 0, '带标记的不该进跳过列表');
  assert.strictEqual(h.content(), patched);
  console.log('ok 3 已修过的跳过');
}).then(() => {
  console.log('preset-repair-tolerant: pass');
}).catch(error => {
  console.error('preset-repair-tolerant: FAIL', error.message);
  process.exit(1);
});
