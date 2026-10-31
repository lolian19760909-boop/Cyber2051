'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parse, findNodes, applyEdits, replaceSlot, fillScriptSlots} = require('../../工具/lib/source-edits.cjs');
const {withoutAuto, modulePrefix} = require('../../工具/lib/updater.cjs');
const instrument = require('../../工具/lib/startup-instrument.cjs');
const {reportStartupErrors} = instrument;
const {extract} = require('../../工具/lib/script-modules.cjs');

test('module extraction survives formatted wrappers and long comments before the real export', () => {
  const code = `(function /* wrapper */ (root , factory) {
    /* ${'comment '.repeat(300)} */
    const bait = 'root.CxxFake = factory()'; root['CxxReal'] = factory();
  })(globalThis, function () { return {value: 42}; });`;
  const modules = extract(code, ['CxxFake', 'CxxReal']);
  assert.deepEqual(modules.map(m => m.name), ['CxxReal']);
  const sandbox = {};
  vm.runInNewContext(modules[0].source, sandbox);
  assert.equal(sandbox.CxxReal.value, 42);
});

test('module extraction rejects ambiguous exports and ignores a nested function export', () => {
  const wrapper = body => `(function(root, factory){${body}})(globalThis, function(){});`;
  assert.throws(() => extract(wrapper('root.CxxA=factory();root.CxxB=factory();'), ['CxxA', 'CxxB']), /Ambiguous/);
  assert.deepEqual(extract(wrapper('function other(){root.CxxA=factory();}'), ['CxxA']), []);
});

test('script slots accept formatting changes and preserve surrounding statements', () => {
  const code = `const note = '__cxxBuildSlot("runtime")';
    result.push('before'); __cxxBuildSlot /* author comment */ (
      'runtime'
    ); result.push('after');`;
  const result = [];
  vm.runInNewContext(fillScriptSlots(code, {runtime: 'result.push("installed");'}), {result});
  assert.deepEqual(result, ['before', 'installed', 'after']);
});

test('missing, duplicate and unknown script slots fail before output', () => {
  assert.throws(() => fillScriptSlots('', {runtime: ''}), /Missing build slot: runtime/);
  assert.throws(() => fillScriptSlots('__cxxBuildSlot("runtime");'.repeat(2), {runtime: ''}), /Duplicate/);
  assert.throws(() => fillScriptSlots('__cxxBuildSlot("typo");', {runtime: ''}), /Unknown.*typo/);
});

test('template content is inserted literally, including dollar replacement sequences', () => {
  const value = '$& $$ $` $\' $1\nconst unchanged = true;';
  assert.equal(replaceSlot('before/*SLOT*/after', '/*SLOT*/', value), 'before' + value + 'after');
  assert.throws(() => replaceSlot('/*SLOT*//*SLOT*/', '/*SLOT*/', value), /one template slot/);
  assert.throws(() => replaceSlot('missing', '/*SLOT*/', value), /one template slot/);
});

test('overlapping source patches fail rather than overwrite another module', () => {
  assert.throws(() => applyEdits('0123456789', [
    {start: 2, end: 7, value: 'outer'}, {start: 4, end: 5, value: 'inner'}
  ]), /Overlapping/);
});

function controller(branch) {
  return `(function (root, factory) {
    const api = factory(); root.CxxUpdateController = api;
    ${branch}
    root.kept = true;
  })(globalThis, function () { return {create() { return {start() { starts++; }}; }}; });`;
}
const branch = `if (typeof root.getVariables === "function") {
  api.create().start();
}`;

test('controller automatic startup is removed with spaces, comments, alternate quotes and CRLF', () => {
  const code = controller(branch.replace('typeof root.getVariables', 'typeof /* host */ root . getVariables'))
    .replace(/\n/g, '\r\n');
  const sandbox = {starts: 0, getVariables() {}};
  vm.runInNewContext(withoutAuto(code), sandbox);
  assert.equal(sandbox.starts, 0);
  assert.equal(sandbox.kept, true);
  sandbox.CxxUpdateController.create().start();
  assert.equal(sandbox.starts, 1, 'Explicit startup remains available');
});

test('a controller with missing or duplicate automatic-start branches is rejected', () => {
  assert.throws(() => withoutAuto(controller('')), /One controller automatic startup branch/);
  assert.throws(() => withoutAuto(controller(branch + branch)), /One controller automatic startup branch/);
});

test('unrelated getVariables checks and controller names in strings are preserved', () => {
  const code = `const name = 'CxxUpdateController';
    if (typeof root.getVariables === 'function') { unrelated(); }`;
  assert.equal(withoutAuto(code), code);
});

const marker = '\n/* CXX_UPDATER_MODULES */\n';
const launch = `; ( async () => {
  const engine = CxxUpdateController . create();
  await engine.start();
})().catch(failure => console.error(failure));`;

test('updater module boundary uses syntax even when a later string resembles the old delimiter', () => {
  const prefix = `globalThis.CxxUpdateController = {create() { return {}; }};\n`;
  const withDecoy = launch.replace('await engine.start();', 'const note = ";(async()=>{"; await engine.start();');
  assert.equal(modulePrefix('ignored prelude' + marker + prefix + withDecoy), prefix);
});

test('updater boundary rejects missing, duplicate, or non-final launch statements', () => {
  assert.throws(() => modulePrefix('no marker'), /boundary must occur once/);
  assert.throws(() => modulePrefix(marker + 'const value = 1;'), /One updater launch/);
  assert.throws(() => modulePrefix(marker + launch + launch), /One updater launch/);
  assert.throws(() => modulePrefix(marker + launch + 'afterLaunch();'), /must follow all modules/);
});

function diagnostics() {
  const reports = [], logs = [], marks = [];
  return {
    reports, logs, marks,
    sandbox: {
      parent: {CxxDiagnostics: {report: row => reports.push(row)}, CxxStartup: {mark: (...args) => marks.push(args)}},
      console: {error: (...args) => logs.push(args)}
    }
  };
}

test('stage error slots support renamed caught errors and keep console plus diagnostic output', async () => {
  const code = `(async () => { throw new Error('failure'); })().catch(caught => {
    __cxxStageError /* stage */ ('creation', caught);
  });`;
  const {reports, logs, marks, sandbox} = diagnostics();
  const compiled = reportStartupErrors(code, {name: 'core'});
  await vm.runInNewContext(instrument(compiled, {id: 'core-id', name: 'core'}), sandbox);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].module, 'core');
  assert.equal(reports[0].stage, 'creation');
  assert.equal(reports[0].message, 'failure');
  assert.equal(logs[0][0], 'creation');
  assert.equal(marks.length, 0, 'Stage handling is not also reported as outer startup failure');
});

test('diagnostic-looking strings do not suppress real startup failure reports', async () => {
  const code = `(async () => { throw new Error('failure'); })().catch(err => {
    const note = 'CxxDiagnostics?.report'; console.error('startup', err);
  });`;
  const {reports, marks, sandbox} = diagnostics();
  await vm.runInNewContext(instrument(code, {id: 'core-id', name: 'core'}), sandbox);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].stage, '脚本异步任务');
  assert.equal(marks.length, 1);
});

test('malformed stage error slots fail with the field that needs correction', () => {
  assert.throws(() => reportStartupErrors('__cxxStageError(label, error);', {name: 'core'}), /label must be a string/);
  assert.throws(() => reportStartupErrors('__cxxStageError("stage", makeError());', {name: 'core'}), /caught error/);
});

test('current packaged scripts contain no unresolved assembly calls', () => {
  const file = process.env.CXX_TEST_CARD || path.join(__dirname, '../../.cache/build/赛博小祥2051-V2.3.0.json');
  const card = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const script of card.data.extensions.tavern_helper.scripts) {
    const unresolved = findNodes(parse(script.content), n => n.type === 'CallExpression' &&
      ['__cxxBuildSlot', '__cxxStageError'].includes(n.callee.name));
    assert.equal(unresolved.length, 0, script.id);
  }
});

test('map ASCII library and backdrop precede the shell once in its installation scope',()=>{
 const file=process.env.CXX_TEST_CARD||require('../../工具/构建/当前/build.cjs').output,card=JSON.parse(fs.readFileSync(file,'utf8')),native=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-native-ui-231').content;
 const a=native.indexOf('window.CxxAsciiMagic='),b=native.indexOf('window.CxxAsciiBackdrop='),c=native.indexOf('window.TOKYO_ATLAS_SHELL=');assert(a>=0&&a<b&&b<c);assert.equal(native.split('window.CxxAsciiMagic=').length,2);assert.equal(native.split('window.CxxAsciiBackdrop=').length,2);
});
