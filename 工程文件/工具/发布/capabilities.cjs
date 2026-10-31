'use strict';
// 发布能力清单的唯一读取入口。发版脚本不要再各写一份 marker 列表。
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'capabilities.json');

function load() {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  return {
    required: Array.isArray(data.required) ? data.required.slice() : [],
    forbidden: Array.isArray(data.forbidden) ? data.forbidden.slice() : [],
    suite: typeof data.suite === 'string' ? data.suite : null
  };
}

// 返回 {ok, missing[], leaking[]}；missing＝应有而没有，leaking＝不该有却有。
function check(text) {
  const { required, forbidden } = load();
  const body = String(text || '');
  const missing = required.filter((marker) => !body.includes(marker));
  const leaking = forbidden.filter((marker) => body.includes(marker));
  return { ok: missing.length === 0 && leaking.length === 0, missing, leaking };
}

module.exports = { FILE, load, check };
