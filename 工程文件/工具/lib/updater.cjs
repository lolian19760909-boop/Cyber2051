'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const E = path.resolve(__dirname, "../..");
const R = path.join(E, "卡片源码/运行时");
const {inlineSource} = require("./inline-source.cjs");
const {parse, findNodes, applyEdits} = require('./source-edits.cjs');
const Host = require("../../卡片源码/运行时/host.js");
const {worldbookEntry} = require("./runtime-components.cjs");
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const modules = [
  'item-definitions.js',
  'loadout.js',
  'gameplay.js',
  'core.js',
  'content.js',
  'character-comparison.js',
  'host.js',
  'backup.js',
  'release-safety.js',
  'release.js',
  'discovery.js',
  'panel.js',
  'unified-update.js',
  'plugin-check.js',
  'upgrader.js',
  'controller.js'
];
function withoutAuto(code) {
  if (!code.includes('CxxUpdateController'))
    return code;
  const tree = parse(code);
  const wrappers = findNodes(tree, n => n.type === 'FunctionExpression' &&
    n.params[0]?.name === 'root' && n.params[1]?.name === 'factory' &&
    findNodes(n.body, x => x.type === 'AssignmentExpression' && x.left.object?.name === 'root' &&
      x.left.property?.name === 'CxxUpdateController').length > 0);
  if (!wrappers.length)
    return code;
  assert.equal(wrappers.length, 1, 'One controller module wrapper');
  const branches = findNodes(wrappers[0].body, n => n.type === 'IfStatement' &&
    n.test.type === 'BinaryExpression' && n.test.operator === '===' && n.test.left.operator === 'typeof' &&
    n.test.left.argument?.object?.name === 'root' && n.test.left.argument?.property?.name === 'getVariables' &&
    n.test.right.value === 'function');
  assert.equal(branches.length, 1, 'One controller automatic startup branch');
  const node = branches[0];
  const line = code.lastIndexOf('\n', node.start - 1) + 1;
  const start = /^[ \t]*$/.test(code.slice(line, node.start)) ? line : node.start;
  const trailing = /^[ \t]*\r?\n/.exec(code.slice(node.end));
  return applyEdits(code, [{
      start,
      end: node.end + (trailing?.[0].length || 0),
      value: ''
    }]);
}
function componentsOf(data) {
  return {
    worldbook: {
      internalName: data.character_book.name,
      entries: data.character_book.entries.map(worldbookEntry).map(Host.normalizeEntry)
    },
    regex: { scripts: data.extensions.regex_scripts.map(Host.fromRawRegex) },
    scripts: { trees: data.extensions.tavern_helper.scripts }
  };
}
function standalone() {
  return require('./runtime-prelude.cjs').prepend(inlineSource(require('./crypto-compat.cjs').source() + '\n;\n' +
    modules.map(name => withoutAuto(read(path.join(R, name)))).join('\n;\n') +
    `
;(async()=>{
  const previous=parent.Cxx233Updater;previous?.stop();
  const engine=CxxUpdateController.create();
  initializeGlobal('Cxx233Updater',engine);
  window.addEventListener('pagehide',()=>{engine.stop();if(parent.Cxx233Updater===engine)delete parent.Cxx233Updater;},{once:true});
  await engine.start();
})().catch(e=>{console.error('[独立更新器]',e);parent.toastr?.error(e.message,'更新与存档');});
`));
}
function modulePrefix(content) {
  const marker = '\n/* CXX_UPDATER_MODULES */\n';
  const parts = content.split(marker);
  assert.equal(parts.length, 2, 'Updater module boundary must occur once');
  const code = parts[1];
  const body = parse(code).body;
  const launches = body.filter(node => {
    if (node.type !== 'ExpressionStatement')
      return false;
    const call = node.expression;
    const invocation = call.callee?.object;
    const task = invocation?.callee;
    return call.type === 'CallExpression' && call.callee.property?.name === 'catch' &&
      invocation?.type === 'CallExpression' && task?.type === 'ArrowFunctionExpression' && task.async &&
      task.body.type === 'BlockStatement' && task.body.body.some(s => s.type === 'VariableDeclaration' &&
        s.declarations.some(d => d.init?.callee?.object?.name === 'CxxUpdateController' &&
          d.init.callee.property?.name === 'create'));
  });
  assert.equal(launches.length, 1, 'One updater launch statement');
  const launch = launches[0];
  const index = body.indexOf(launch);
  assert.equal(index, body.length - 1, 'Updater launch must follow all modules');
  const separator = body[index - 1];
  return code.slice(0, separator?.type === 'EmptyStatement' ? separator.start : launch.start);
}
module.exports = {
  componentsOf,
  standalone,
  withoutAuto,
  modulePrefix
};
