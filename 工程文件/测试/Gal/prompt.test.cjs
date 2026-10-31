'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ID, CONTENT, create } = require("../../卡片源码/Gal/prompt.js");

function recorder() {
  const calls = [], active = new Map();
  let serial = 0;
  function injectPrompts(prompts, options) {
    const number = ++serial;
    calls.push({ action: 'inject', number, prompts, options });
    for (const prompt of prompts) active.set(prompt.id, prompt);
    return {
      number,
      uninject() {
        assert.equal(this.number, number, 'cleanup keeps its returned receiver');
        calls.push({ action: 'uninject', number });
        for (const prompt of prompts) active.delete(prompt.id);
      },
    };
  }
  return { calls, active, injectPrompts };
}

test('one active chat installs exactly one stable prompt without worldbook scanning', () => {
  const host = recorder();
  create(host).sync('card-a/chat-a');
  assert.deepEqual(host.calls, [{ action: 'inject', number: 1, prompts: [{
    id: ID, position: 'in_chat', depth: 0, role: 'system', content: CONTENT, should_scan: false,
  }], options: { once: false } }]);
  assert.equal(host.active.size, 1);
  assert.equal(CONTENT.match(/\[CXX_GAL_DIALOGUE_V1\]/g).length, 1);
});

test('same chat key is idempotent, including repeated rendering and send checks', () => {
  const host = recorder();
  const prompt = create(host);
  for (let i = 0; i < 30; i++) prompt.sync('card-a/chat-a');
  assert.equal(host.calls.length, 1);
  assert.equal(host.active.size, 1);
});

test('switching chat keys removes the old prompt before adding the new one', () => {
  const host = recorder();
  const prompt = create(host);
  prompt.sync('card-a/chat-a');
  prompt.sync('card-a/chat-b');
  assert.deepEqual(host.calls.map(call => [call.action, call.number]), [
    ['inject', 1], ['uninject', 1], ['inject', 2],
  ]);
  assert.equal(host.active.size, 1);
});

test('closing clears synchronously once, and reopening can install one fresh prompt', () => {
  const host = recorder();
  const prompt = create(host);
  prompt.sync('card-a/chat-a');
  assert.equal(prompt.sync(''), undefined);
  assert.equal(host.active.size, 0);
  prompt.sync('');
  prompt.sync(undefined);
  prompt.sync(null);
  assert.equal(host.calls.length, 2);
  prompt.sync('card-a/chat-a');
  assert.equal(host.active.size, 1);
  assert.equal(host.calls.length, 3);
});

test('destroy removes the active prompt and permanently prevents reinjection', () => {
  const host = recorder();
  const prompt = create(host);
  prompt.sync('card-a/chat-a');
  prompt.destroy();
  prompt.destroy();
  prompt.sync('card-a/chat-a');
  prompt.sync('card-b/chat-a');
  assert.equal(host.active.size, 0);
  assert.deepEqual(host.calls.map(call => call.action), ['inject', 'uninject']);
});

test('destroy before activation performs no host operation', () => {
  const host = recorder();
  const prompt = create(host);
  prompt.sync('');
  prompt.destroy();
  prompt.sync('card-a/chat-a');
  assert.deepEqual(host.calls, []);
});

test('missing injection capability reports a readable error', () => {
  for (const options of [undefined, {}, { injectPrompts: false }]) {
    assert.throws(() => create(options), /酒馆助手提示注入能力不可用/);
  }
});

test('throwing injection commits no active key and allows a real retry', () => {
  const host = recorder();
  let failed = true;
  const prompt = create({ injectPrompts(...args) {
    if (failed) { failed = false; throw Error('测试注入失败'); }
    return host.injectPrompts(...args);
  } });
  assert.throws(() => prompt.sync('card-a/chat-a'), /测试注入失败/);
  assert.equal(host.active.size, 0);
  prompt.sync('card-a/chat-a');
  assert.equal(host.calls.length, 1);
  assert.equal(host.active.size, 1);
  prompt.destroy();
  assert.equal(host.active.size, 0);
});

test('invalid or asynchronous handles do not commit an active key', () => {
  for (const handle of [null, undefined, {}, { uninject: true }, Promise.resolve({ uninject() {} })]) {
    let attempts = 0;
    const prompt = create({ injectPrompts() { attempts++; return handle; } });
    assert.throws(() => prompt.sync('card-a/chat-a'), /未返回有效的撤销函数/);
    assert.throws(() => prompt.sync('card-a/chat-a'), /未返回有效的撤销函数/);
    assert.equal(attempts, 2);
    prompt.destroy();
  }
});

test('a failed chat switch leaves the prior prompt removed and retries the new chat', () => {
  const host = recorder();
  let attempts = 0;
  const prompt = create({ injectPrompts(...args) {
    if (++attempts === 2) throw Error('第二次注入失败');
    return host.injectPrompts(...args);
  } });
  prompt.sync('card-a/chat-a');
  assert.throws(() => prompt.sync('card-a/chat-b'), /第二次注入失败/);
  assert.equal(host.active.size, 0);
  prompt.sync('card-a/chat-b');
  assert.equal(host.active.size, 1);
  assert.deepEqual(host.calls.map(call => call.action), ['inject', 'uninject', 'inject']);
});

test('the optional contract preserves core output protocols and does not guess unnamed speakers', () => {
  assert.ok(CONTENT.includes('不要把本约定的标题标记或说明输出到正文'));
  assert.ok(CONTENT.includes('<cxx-say speaker="角色全名" expression="normal">「台词」</cxx-say>'));
  for (const tag of ['<UpdateVariable>', '<ztl>', '<xuan>']) assert.ok(CONTENT.includes(tag));
  assert.ok(CONTENT.includes('保留原本已启用'));
  assert.ok(CONTENT.includes('不猜测归属'));
  assert.ok(CONTENT.includes('不要新增 CG 或任务标签'));
  assert.ok(CONTENT.includes('不要让差分改变变量、任务或 CG 规则'));
});

test('the optional prompt uses the nine agreed emotions and no legacy psychosis shortcut', () => {
  assert.deepEqual([...CONTENT.matchAll(/\b([a-z_]+)（[^）]+）/g)].map(match => match[1]),
    ['normal', 'smile', 'blush', 'serious', 'sadness', 'regret', 'shocked', 'constricted_pupils', 'cyberpsychosis']);
  assert.ok(!CONTENT.includes('yandere_trance'));
  assert.ok(CONTENT.includes('普通暴怒和精神崩溃不触发'));
  assert.ok(CONTENT.includes('没有明显情绪用 normal'));
  assert.ok(CONTENT.includes('旁白、引文和代码保持原样'));
  assert.ok(CONTENT.includes('不猜测归属'));
});

test('browser UMD exports the same contract without touching DOM or registering itself', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../卡片源码/Gal/prompt.js"), 'utf8'), sandbox);
  assert.deepEqual(Object.keys(sandbox), ['CxxGalPrompt']);
  assert.equal(sandbox.CxxGalPrompt.ID, ID);
  assert.equal(sandbox.CxxGalPrompt.CONTENT, CONTENT);
  const host = recorder();
  const prompt = sandbox.CxxGalPrompt.create(host);
  prompt.sync('test-chat');
  prompt.destroy();
  assert.equal(host.active.size, 0);
});
