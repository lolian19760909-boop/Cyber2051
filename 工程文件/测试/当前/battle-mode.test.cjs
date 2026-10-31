const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../../卡片源码/MVU/preferences.js');

const source = file => fs.readFileSync(path.join(__dirname, '..', '..', '卡片源码', file), 'utf8');

test('战斗结算方式默认速决', () => {
  assert.equal(P.read({}).battleMode, 'fast');
});

test('战斗结算方式读回已保存的档位，非法值退回速决', () => {
  assert.equal(P.read({ [P.KEY]: { battleMode: 'tactical' } }).battleMode, 'tactical');
  assert.equal(P.read({ [P.KEY]: { battleMode: 'text' } }).battleMode, 'text');
  assert.equal(P.read({ [P.KEY]: { battleMode: 'instant' } }).battleMode, 'fast');
});

test('设置保存会校验并写入战斗结算方式', () => {
  const prefs = source('MVU/preferences.js');
  assert.match(prefs, /const modes=\['tactical','fast','text'\]/);
  assert.match(prefs, /choice\.battleMode!==undefined&&!modes\.includes\(choice\.battleMode\)/);
  assert.match(prefs, /battleMode:choice\.battleMode/);
});

test('开局偏好页与设置页都能切换战斗结算方式', () => {
  assert.match(source('运行时/opening-ui.js'), /战斗结算方式/);
  assert.match(source('运行时/opening-ui.js'), /battleMode/);
  assert.match(source('运行时/settings-ui.js'), /战斗结算方式/);
  assert.match(source('运行时/settings-ui.js'), /battleMode/);
});

test('战斗条按档位分流：速决与纯文本自动结算，即时战术保留面板', () => {
  const surface = source('运行时/battle-surface.js');
  assert.match(surface, /function battleMode\(\)/);
  assert.match(surface, /autoResolve\(state\)/);
  assert.match(surface, /mode==='tactical'\|\|!state\.game\?\.tactical\?\.enabled/);
  assert.match(surface, /tactical\.operation\('tactical-resolve'/);
  assert.match(surface, /function showReport\(\)/);
  assert.match(surface, /cxx-battle-report-lines/);
});

test('旧版数值战斗仍然走原来的面板，不会被速决抢走', () => {
  const surface = source('运行时/battle-surface.js');
  assert.match(surface, /if\(battleMode\(\)!=='tactical'&&!current\(\)\.game\?\.numeric\?\.combat\?\.active\)return true;/);
});
