/* 「AI 帮写」的取词函数必须穿过嵌套 iframe 找到真正的生成接口。 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const engine = path.resolve(__dirname, '..', '..');
const { resolveGenerator, collectGenerators } = require(path.join(engine, '卡片源码', '运行时', 'creator-ui.js'));

function frame(props = {}) {
  const w = Object.assign({ parent: null }, props);
  return w;
}

test('uses the window own generateRaw when it is there', () => {
  const calls = [];
  const w = frame({ generateRaw: async options => { calls.push(options); return '草稿'; } });
  const gen = resolveGenerator(w);
  assert.equal(typeof gen, 'function');
  return gen({ should_silence: true }).then(text => {
    assert.equal(text, '草稿');
    assert.deepEqual(calls, [{ should_silence: true }]);
  });
});

test('walks up to the assistant frame when the UI frame has no generator', async () => {
  const top = frame({ generateRaw: async () => '来自顶层的草稿' });
  const middle = frame();
  const ui = frame();
  ui.parent = middle;
  middle.parent = top;
  top.parent = top;
  const gen = resolveGenerator(ui);
  assert.equal(typeof gen, 'function');
  assert.equal(await gen({}), '来自顶层的草稿');
});

test('accepts TavernHelper.generateRaw and TavernHelper.generate as fallbacks', async () => {
  const rawTop = frame({ TavernHelper: { generateRaw: async () => 'raw' } });
  rawTop.parent = rawTop;
  assert.equal(await resolveGenerator(frame({ parent: rawTop }))({}), 'raw');
  const plainTop = frame({ TavernHelper: { generate: async () => 'plain' } });
  plainTop.parent = plainTop;
  assert.equal(await resolveGenerator(frame({ parent: plainTop }))({}), 'plain');
});

test('accepts SillyTavern.generateRaw and returns null when nothing is reachable', () => {
  const stTop = frame({ SillyTavern: { generateRaw: async () => 'st' } });
  stTop.parent = stTop;
  assert.equal(typeof resolveGenerator(frame({ parent: stTop })), 'function');
  const lonely = frame();
  lonely.parent = lonely;
  assert.equal(resolveGenerator(frame({ parent: lonely })), null);
});

test('a frame that throws on property access does not break the walk', async () => {
  const top = frame({ generateRaw: async () => 'still reachable' });
  top.parent = top;
  const hostile = new Proxy({}, {
    get(target, key) {
      if (key === 'parent') return top;
      if (key === 'then' || typeof key === 'symbol') return undefined;
      throw new Error('cross origin');
    }
  });
  assert.equal(await resolveGenerator(hostile)({}), 'still reachable');
});

test('collectGenerators returns every candidate along the frame chain so request() can fall back', () => {
  const inner = frame({ generateRaw: async () => 'a' });
  const mid = frame({ TavernHelper: { generate: async () => 'b' }, parent: inner });
  const top = frame({ generateRaw: async () => 'c', parent: mid });
  const gens = collectGenerators(frame({ parent: top }));
  assert.equal(typeof collectGenerators, 'function');
  assert.equal(gens.length, 3);
  return Promise.all(gens.map(g => g({}))).then(values => assert.deepEqual(values, ['c', 'b', 'a']));
});

test('the module declares every helper its request path calls', () => {
  const source = require('node:fs').readFileSync(path.join(engine, '卡片源码', '运行时', 'creator-ui.js'), 'utf8');
  assert.ok(source.includes("function collectGenerators(start){"));
  assert.ok(source.includes("const gens=collectGenerators(win);"));
  assert.ok(source.includes("function resolveGenerator(start){return collectGenerators(start)[0]||null;}"));
  assert.ok(source.includes("return {mount,resolveGenerator,collectGenerators};"));
});
