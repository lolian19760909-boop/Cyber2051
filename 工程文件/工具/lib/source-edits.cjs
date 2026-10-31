'use strict';
const assert = require('node:assert/strict');
const {acorn, walk} = require('./card-ast.cjs');

const parse = code => acorn.parse(code, {ecmaVersion: 'latest', sourceType: 'module'});

function findNodes(tree, predicate) {
  const found = [];
  walk(tree, node => { if (predicate(node)) found.push(node); });
  return found;
}

function applyEdits(code, edits) {
  let boundary = code.length;
  for (const {start, end, value} of [...edits].sort((a, b) => b.start - a.start || b.end - a.end)) {
    assert(start >= 0 && end >= start && end <= boundary, 'Overlapping or invalid source edits');
    code = code.slice(0, start) + value + code.slice(end);
    boundary = start;
  }
  return code;
}

function replaceSlot(code, marker, value) {
  assert.equal(code.split(marker).length, 2, 'Expected one template slot: ' + marker);
  return code.replace(marker, () => value);
}

// Slots are statements, so quotes, indentation and comments do not affect lookup.
function fillScriptSlots(code, values) {
  const seen = new Set();
  const slots = findNodes(parse(code), node =>
    node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression' &&
    node.expression.callee.name === '__cxxBuildSlot');
  const edits = slots.map(node => {
    const args = node.expression.arguments, name = args[0]?.value;
    assert.equal(args.length, 1, 'Build slot needs one name');
    assert(Object.hasOwn(values, name), 'Unknown build slot: ' + name);
    assert(!seen.has(name), 'Duplicate build slot: ' + name);
    seen.add(name);
    return {...node, value: values[name]};
  });
  for (const name of Object.keys(values)) assert(seen.has(name), 'Missing build slot: ' + name);
  return applyEdits(code, edits);
}

module.exports = {parse, findNodes, applyEdits, replaceSlot, fillScriptSlots};
