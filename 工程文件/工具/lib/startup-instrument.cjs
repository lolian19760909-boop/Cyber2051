'use strict';
const {walk} = require('./card-ast.cjs');
const {parse, findNodes, applyEdits} = require('./source-edits.cjs');
const assert = require('node:assert/strict');
function reportStartupErrors(code, {name}) {
  const edits = [];
  const slots = findNodes(parse(code), n =>
    n.type === 'ExpressionStatement' && n.expression.callee?.name === '__cxxStageError');
  for (const node of slots) {
    const [label, parameter] = node.expression.arguments;
    assert.equal(node.expression.arguments.length, 2, 'Stage error needs label and error');
    assert.equal(typeof label?.value, 'string', 'Stage error label must be a string');
    assert.equal(parameter?.type, 'Identifier', 'Stage error must name the caught error');
    const error = parameter.name;
    const stage = code.slice(label.start, label.end);
    edits.push({
      ...node,
      value: 'parent.CxxDiagnostics?.report({module:' + JSON.stringify(name) + ',stage:' + stage +
        ',message:' + error + '.message||String(' + error + '),detail:' + error + '.stack||""});' +
        'console.error(' + stage + ',' + error + ');'
    });
  }
  return applyEdits(code, edits);
}
module.exports = function instrument(code, {id, name}) {
  const edits = [];
  const identity = JSON.stringify(id) + ',' + JSON.stringify(name);
  walk(parse(code), n => {
    if (n.type === 'CallExpression' && n.callee.name === 'waitGlobalInitialized') {
      const args = n.arguments.map(a => code.slice(a.start, a.end)).join(',');
      const original = code.slice(n.start, n.end);
      edits.push({
        start: n.start,
        end: n.end,
        value: `(parent.CxxStartup?parent.CxxStartup.wait(${ identity },${ args },()=>${ original }):${ original })`
      });
    }
    if (n.type === 'CallExpression' && n.callee.property?.name === 'catch') {
      const fn = n.arguments[0];
      const param = fn?.params?.[0]?.name;
      if (!param || fn.body?.type !== 'BlockStatement')
        return;
      const logged = fn.body.body.some(s => s.type === 'ExpressionStatement' &&
        s.expression.callee?.object?.name === 'console' && s.expression.callee?.property?.name === 'error');
      const reported = fn.body.body.some(s => {
        const call = s.expression?.type === 'ChainExpression' ? s.expression.expression : s.expression;
        return call?.callee?.object?.property?.name === 'CxxDiagnostics' && call.callee.property?.name === 'report';
      });
      if (logged && !reported)
        edits.push({
          start: fn.body.start + 1,
          end: fn.body.start + 1,
          value: `parent.CxxStartup?.mark(${identity},'启动失败','',${param});` +
            `parent.CxxDiagnostics?.report({module:${JSON.stringify(name)},stage:'脚本异步任务',` +
            `message:${param}.message||String(${param}),detail:${param}.stack||'',` +
            `context:{floor:-1,code:${param}.code||''}});`
        });
    }
  });
  return applyEdits(code, edits);
};
module.exports.reportStartupErrors = reportStartupErrors;
