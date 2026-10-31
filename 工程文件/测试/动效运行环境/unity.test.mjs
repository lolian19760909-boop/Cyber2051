import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUnityScene, bootUnity } from '../../配套扩展/cxx-motion/providers/unity.mjs';

const project = () => ({
  title: 'Unity接口夹具', version: '1',
  scene: { loader: 'Build/demo.loader.js', framework: 'Build/demo.framework.js', code: 'Build/demo.wasm', data: 'Build/demo.data', commands: { play: { object: 'UI', method: 'Play' }, setSegment: { object: 'UI', method: 'Segment' } } },
  resources: ['loader.js', 'framework.js', 'wasm', 'data'].map(suffix => ({ path: `Build/demo.${suffix}` })),
  inputs: [{ id: 'amount', type: 'number', object: 'UI', method: 'Amount' }, { id: 'enabled', type: 'boolean', object: 'UI', method: 'Enabled' }, { id: 'open', type: 'trigger', object: 'UI', method: 'Open' }],
});

test('Unity接口拒绝缺文件、压缩文件及尚未接入的构建选项', () => {
  validateUnityScene(project());
  for (const change of [
    value => { value.scene.code = 'missing.wasm'; },
    value => { value.scene.code = 'Build/demo.wasm.br'; value.resources.push({ path: value.scene.code }); },
    value => { value.scene.threads = true; },
    value => { value.scene.streamingAssetsUrl = 'StreamingAssets'; },
    value => { delete value.inputs[0].method; },
    value => { value.scene.commands.pause = {}; },
  ]) { const value = project(); change(value); assert.throws(() => validateUnityScene(value)); }
});

test('Unity命令按作品映射发送，退出等待Quit，未声明命令不伪报成功', async t => {
  const controller = new AbortController();
  const saved = new Map(['document', 'TavernVisualProject', 'createUnityInstance'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, descriptor] of saved) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]; });
  const calls = [], events = [];
  let handleCommand, capabilities, config, finishQuit;
  globalThis.document = { createElement: tag => ({ tag, style: {} }), body: { append(script) { queueMicrotask(() => script.onload()); } } };
  globalThis.TavernVisualProject = {
    manifest: project(), signal: controller.signal, root: { append() {} }, asset: path => `blob:fixture/${path}`,
    onCommand(callback) { handleCommand = callback; }, ready(value) { capabilities = value; }, emit: (...args) => events.push(args),
  };
  globalThis.createUnityInstance = async (_, settings, progress) => {
    config = settings; progress(0.5);
    return { SendMessage: (...args) => calls.push(args), Quit: () => new Promise(resolve => { finishQuit = resolve; }) };
  };
  await bootUnity();
  assert.deepEqual(capabilities, ['play', 'setSegment', 'setInput', 'trigger']);
  assert.equal(config.codeUrl, 'blob:fixture/Build/demo.wasm');
  assert.equal(config.matchWebGLToCanvasSize, true);
  assert.deepEqual(events, [['progress', 0.5]]);
  await handleCommand('play', []);
  await handleCommand('setInput', ['amount', 8]);
  await handleCommand('setInput', ['enabled', false]);
  await handleCommand('trigger', ['open']);
  await handleCommand('setSegment', [10, 20]);
  assert.deepEqual(calls, [['UI', 'Play'], ['UI', 'Amount', 8], ['UI', 'Enabled', 0], ['UI', 'Open'], ['UI', 'Segment', '{"start":10,"end":20}']]);
  await assert.rejects(handleCommand('pause', []), /没有提供/);
  await assert.rejects(handleCommand('setSegment', [20, 10]), /区间无效/);
  let closed = false;
  const closing = handleCommand('dispose', []).then(() => { closed = true; });
  await Promise.resolve();
  assert.equal(closed, false);
  finishQuit(); await closing;
  assert.equal(closed, true);
});
