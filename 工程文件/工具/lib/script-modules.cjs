'use strict';
const assert = require('node:assert/strict');
const {walk} = require('./card-ast.cjs');
const {parse} = require('./source-edits.cjs');

function extract(source, names = []) {
  const found = [], wanted = new Set(names);
  walk(parse(source), node => {
    if (node.type !== 'ExpressionStatement' || node.expression.type !== 'CallExpression') return;
    const wrapper = node.expression.callee;
    if (wrapper.type !== 'FunctionExpression' || wrapper.params[0]?.name !== 'root' ||
        wrapper.params[1]?.name !== 'factory') return;
    const exports = new Set();
    walk(wrapper.body, child => {
      if (['FunctionExpression', 'FunctionDeclaration', 'ArrowFunctionExpression'].includes(child.type)) return false;
      if (child.type !== 'AssignmentExpression' || child.operator !== '=' || child.left.object?.name !== 'root') return;
      const member = child.left;
      const name = member.computed ? member.property.value : member.property.name;
      if (wanted.has(name)) exports.add(name);
    });
    assert(exports.size <= 1, 'Ambiguous module exports: ' + [...exports].join(', '));
    if (!exports.size) return;
    found.push({name: [...exports][0], source: source.slice(node.start, node.end), start: node.start, end: node.end});
    return false;
  });
  return found;
}

module.exports = {extract};
