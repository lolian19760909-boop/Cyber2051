const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../卡片源码/MVU/preferences.js');

test('内容尺度默认关闭且未选择', () => {
  const s = P.read({});
  assert.equal(s.nsfw, false);
  assert.equal(s.nsfwChosen, false);
});

test('内容尺度读取已保存的值', () => {
  const s = P.read({ [P.KEY]: { nsfw: true, nsfwChosen: true } });
  assert.equal(s.nsfw, true);
  assert.equal(s.nsfwChosen, true);
});

test('非布尔值按关闭处理，不误开', () => {
  const s = P.read({ [P.KEY]: { nsfw: 'yes', nsfwChosen: 1 } });
  assert.equal(s.nsfw, false);
  assert.equal(s.nsfwChosen, false);
});

test('保存入参校验覆盖内容尺度开关', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../卡片源码/MVU/preferences.js'), 'utf8');
  assert.match(source, /choice\.nsfw!==undefined&&typeof choice\.nsfw!=='boolean'/);
  assert.match(source, /choice\.nsfwChosen!==undefined&&typeof choice\.nsfwChosen!=='boolean'/);
  assert.match(source, /\.\.\.\(choice\.nsfw===undefined\?\:\{nsfw:choice\.nsfw\}\)|\{nsfw:choice\.nsfw\}/);
});
