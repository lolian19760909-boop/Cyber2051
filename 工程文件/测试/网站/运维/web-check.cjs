'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, "../../../网站/gateway/public");
let n = 0;
for (const file of fs.readdirSync(root).filter(x => x.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const ids = new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), m => m[1]));
  for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    new vm.Script(m[1], { filename: file });
    for (const ref of m[1].matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(ref[1]), file + ' 缺 #' + ref[1]);
  }
  n++;
}
for (const file of ['user.js', 'i18n.js']) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'));
console.log('PASS ' + n + ' 个 HTML 脚本语法与固定 ID 引用，2 个外部脚本语法（离线）');
