'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const Guard = require('../../卡片源码/共享/worldbook-editor.js');
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function fixture() {
  const target = {}, other = {}, callbacks = [], calls = [];
  const $ = { fn: {} };
  function original(options, ...rest) {
    calls.push({ receiver: this, options, rest });
    if (typeof options === 'string') return 'command:' + options;
    assert.equal($.fn.pagination.defaults.enabled, true);
    callbacks.push(options.callback);
    return this;
  }
  original.defaults = { enabled: true };
  original.extra = { keep: true };
  $.fn.pagination = original;
  const win = { jQuery: $, document: { getElementById: id => id === 'world_info_pagination' ? target : null } };
  const view = node => ({ 0: node, length: 1 });
  const init = callback => { const receiver = view(target); assert.equal($.fn.pagination.call(receiver, { callback }), receiver); return callbacks.at(-1); };
  return { win, $, target, other, view, calls, init, original };
}
test('worldbook renderer keeps one active callback and only the latest waiting request', async () => {
  const f = fixture(), lease = Guard.acquire(f.win), pause = deferred(), seen = [];
  const first = f.init(async value => { seen.push('start:' + value); await pause.promise; seen.push('finish:' + value); });
  const a = first('A'), waiting = [];
  for (let i = 0; i < 20; i++) waiting.push(f.init(value => { seen.push(value); return value; })(i));
  assert.deepEqual(seen, ['start:A']); assert.equal(lease.read().pending, 1);
  pause.resolve(); await a; assert.equal((await Promise.all(waiting)).at(-1), 19);
  assert.deepEqual(seen, ['start:A', 'finish:A', 19]);
  assert.equal(lease.read().maxActive, 1); assert.equal(lease.read().maxPending, 1); assert.equal(lease.read().skipped, 19);
  lease.release(); assert.equal(f.$.fn.pagination, f.original);
});
test('other pagination, commands, receivers and static properties pass through unchanged', async () => {
  const f = fixture(), lease = Guard.acquire(f.win), callback = () => 4, other = f.view(f.other);
  assert.equal(f.$.fn.pagination.call(other, { callback }), other);
  assert.equal(f.calls.at(-1).options.callback, callback);
  assert.equal(f.$.fn.pagination.call(f.view(f.target), 'getCurrentPageNum', 3), 'command:getCurrentPageNum');
  assert.deepEqual(f.calls.at(-1).rest, [3]);
  assert.equal(f.$.fn.pagination.defaults, f.original.defaults); assert.equal(f.$.fn.pagination.extra, f.original.extra);
  f.$.fn.pagination.extra = { changed: true }; assert.deepEqual(f.original.extra, { changed: true });
  let receiver; const wrapped = f.init(function () { receiver = this; return 8; }), custom = {};
  assert.equal(await wrapped.call(custom), 8); assert.equal(receiver, custom); lease.release();
});
test('an original callback failure releases the queue for the next render', async () => {
  const f = fixture(), lease = Guard.acquire(f.win), pause = deferred();
  const bad = f.init(async () => { await pause.promise; throw Error('fixture failure'); })();
  const rejected = assert.rejects(bad, /fixture failure/), good = f.init(() => 'next')();
  pause.resolve(); await rejected; assert.equal(await good, 'next');
  assert.equal(lease.read().active, 0); assert.equal(lease.read().failed, 1); lease.release();
});
test('two independently loaded modules share the host queue and release only their own leases', async () => {
  const f = fixture(), a = Guard.acquire(f.win), source = fs.readFileSync(require.resolve('../../卡片源码/共享/worldbook-editor.js'), 'utf8');
  const iframe = { module: { exports: {} } }; vm.runInNewContext(source, iframe);
  const b = iframe.module.exports.acquire(f.win), installed = f.$.fn.pagination, pause = deferred(), seen = [];
  const first = f.init(async () => { seen.push('A'); await pause.promise; })();
  const last = f.init(() => seen.push('B'))();
  a.release(); a.release(); assert.equal(b.read().leases, 1); assert.equal(f.$.fn.pagination, installed);
  b.release(); assert.equal(f.$.fn.pagination, installed, 'retain the wrapper while a native render drains');
  const c = Guard.acquire(f.win); assert.equal(f.$.fn.pagination, installed); assert.equal(c.read().leases, 1);
  pause.resolve(); await Promise.all([first, last]); assert.deepEqual(seen, ['A', 'B']); c.release(); assert.equal(f.$.fn.pagination, f.original);
});
test('native pagination callbacks retained after release still render and share a later lease', async () => {
  const f = fixture(), a = Guard.acquire(f.win), pause = deferred(), seen = [];
  const retained = f.init(async () => { seen.push('retained'); await pause.promise; }); a.release();
  const first = retained(), b = Guard.acquire(f.win), next = f.init(() => seen.push('new'))();
  assert.deepEqual(seen, ['retained']); pause.resolve(); await Promise.all([first, next]);
  assert.deepEqual(seen, ['retained', 'new']); b.release();
});
test('release does not overwrite a later extension wrapper; reacquire avoids double-wrapping callbacks', async () => {
  const f = fixture(), a = Guard.acquire(f.win), ours = f.$.fn.pagination;
  function foreign(...args) { return ours.apply(this, args); }
  Object.defineProperty(foreign, 'defaults', { get: () => ours.defaults });
  f.$.fn.pagination = foreign; a.release(); assert.equal(f.$.fn.pagination, foreign);
  const b = Guard.acquire(f.win); assert.equal(await f.init(() => 9)(), 9); assert.equal(b.read().scheduled, 1);
  b.release(); assert.equal(f.$.fn.pagination, foreign);
});
test('missing host pagination capability is a no-op', () => { Guard.acquire({}).release(); Guard.acquire({ jQuery: { fn: {} } }).release(); });
