import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareProject, digest } from '../../配套扩展/cxx-motion/project/manifest.mjs';
import { createResources } from '../../配套扩展/cxx-motion/runtime/resources.mjs';
import { createProjectRuntime } from '../../配套扩展/cxx-motion/runtime/projects.mjs';
import { createMotion } from '../../配套扩展/cxx-motion/runtime/motion.mjs';

async function fixture(id = 'sample') {
  const blob = new Blob(['actual bytes']);
  return prepareProject({ format: 'tavern-visual-project', schema: 1, id, version: '1', title: id, engine: { id: 'fixture', version: '1' }, scene: {}, resources: [{ path: 'nested/file.bin', type: 'application/octet-stream', bytes: blob.size, sha256: await digest(await blob.arrayBuffer()) }], events: ['finished'] }, new Map([['nested/file.bin', blob]]));
}
function dom() {
  const nodes = [];
  const document = { createElement: () => ({ style: {}, remove() { const index = nodes.indexOf(this); if (index !== -1) nodes.splice(index, 1); } }) };
  return { nodes, target: { ownerDocument: document, append: node => nodes.push(node) } };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('资源必须来自清单内完整路径，指纹改变不允许导入', async () => {
  const project = await fixture();
  await assert.rejects(prepareProject(project.manifest, new Map([['nested/file.bin', new Blob(['changed byte'])]])), /内容已改变/);
  for (const path of ['../file.bin', 'a/../file.bin', '/file.bin', 'a\\file.bin', 'a/%2f/file.bin']) {
    const manifest = structuredClone(project.manifest);
    manifest.resources[0].path = path;
    await assert.rejects(prepareProject(manifest, project.blobs), /资源路径无效/);
  }
});

test('对象URL按会话复用，关闭后全部撤销', async () => {
  const revoked = [];
  let created = 0;
  const pool = createResources(await fixture(), { createObjectURL: () => `blob:${++created}`, revokeObjectURL: url => revoked.push(url) });
  assert.equal(pool.url('nested/file.bin'), pool.url('nested/file.bin'));
  assert.equal(created, 1);
  pool.dispose(); pool.dispose();
  assert.deepEqual(revoked, ['blob:1']);
  await assert.rejects(pool.bytes('missing'), /项目资源已释放/);
});

test('缺少真实播放器时清楚报告，不将接口视为支持', async () => {
  const runtime = createProjectRuntime();
  const project = await fixture();
  assert.equal(runtime.inspect(project).available, false);
  assert.throws(() => runtime.mount(project, dom().target), /尚未安装播放器/);
});

test('两个独立项目复用播放器，事件限于各自声明，未知控制返回错误', async () => {
  const runtime = createProjectRuntime();
  let loads = 0, destroyed = 0;
  const events = [];
  runtime.register({ id: 'fixture', version: '1', load: async () => {
    loads++;
    return { mount({ emit }) {
      emit('private', { secret: true }); emit('finished', { ok: true });
      return { ready: Promise.resolve(), capabilities: ['pause'], pause() {}, dispose() { destroyed++; } };
    } };
  } });
  const a = runtime.mount(await fixture('one'), dom().target, { onEvent: event => events.push(event) });
  const b = runtime.mount(await fixture('two'), dom().target);
  await Promise.all([a.ready, b.ready]);
  assert.equal(loads, 1);
  assert.deepEqual(events.map(event => event.name), ['finished']);
  await assert.rejects(a.play(), /不支持 play/);
  await runtime.dispose();
  assert.equal(destroyed, 2);
  assert.equal(runtime.diagnostics().sessions.length, 0);
});

test('加载播放器期间关闭，不会在迟到后挂回页面', async () => {
  const runtime = createProjectRuntime(), gate = deferred(), page = dom();
  let mounts = 0;
  runtime.register({ id: 'fixture', version: '1', load: () => gate.promise });
  const session = runtime.mount(await fixture(), page.target);
  await tick(); await session.dispose();
  gate.resolve({ mount() { mounts++; } });
  await assert.rejects(session.ready, { name: 'AbortError' });
  assert.equal(mounts, 0);
  assert.equal(page.nodes.length, 0);
});

test('连续替换同一容器，旧会话销毁完成后再挂新会话', async () => {
  const runtime = createProjectRuntime(), gate = deferred(), page = dom();
  const order = [];
  runtime.register({ id: 'fixture', version: '1', load: async () => ({ mount({ manifest }) {
    order.push(`mount:${manifest.id}`);
    return { ready: Promise.resolve(), capabilities: [], async dispose() { order.push(`dispose:${manifest.id}`); if (manifest.id === 'one') await gate.promise; } };
  } }) });
  const a = runtime.mount(await fixture('one'), page.target);
  await a.ready;
  const b = runtime.mount(await fixture('two'), page.target);
  await tick();
  assert.deepEqual(order, ['mount:one', 'dispose:one']);
  gate.resolve(); await b.ready;
  assert.deepEqual(order, ['mount:one', 'dispose:one', 'mount:two']);
  assert.equal(page.nodes.length, 1);
  await runtime.dispose(); assert.equal(page.nodes.length, 0);
});

test('播放器装载失败后可以重试，错误会话不残留容器', async () => {
  const runtime = createProjectRuntime(), page = dom();
  let attempts = 0;
  runtime.register({ id: 'fixture', version: '1', load: async () => {
    if (++attempts === 1) throw new Error('missing file');
    return { mount: () => ({ ready: Promise.resolve(), dispose() {} }) };
  } });
  const project = await fixture();
  await assert.rejects(runtime.mount(project, page.target).ready, /missing file/);
  assert.equal(page.nodes.length, 0);
  await runtime.mount(project, page.target).ready;
  assert.equal(attempts, 2);
  await runtime.dispose();
});

test('播放开始后的渲染失败会停止会话并清理页面', async () => {
  const runtime = createProjectRuntime(), page = dom();
  let fail, disposed = false;
  const notices = [];
  runtime.register({ id: 'fixture', version: '1', load: async () => ({ mount(options) {
    fail = options.fail;
    return { ready: Promise.resolve(), capabilities: ['play'], play() {}, dispose() { disposed = true; } };
  } }) });
  const session = runtime.mount(await fixture(), page.target, { onError: error => notices.push(error.message) });
  await session.ready;
  fail(new Error('WebGL render failed'));
  await tick();
  assert.equal(session.diagnostics().state, 'failed');
  assert.deepEqual(notices, ['WebGL render failed']);
  assert.equal(disposed, true);
  assert.equal(page.nodes.length, 0);
  await assert.rejects(session.play(), /WebGL render failed/);
  await runtime.dispose();
});

function motionFixture() {
  const animations = [];
  const element = { animate() {
    const animation = { finished: Promise.resolve(), currentTime: 0, pause() {}, play() {}, cancel() { this.oncancel?.(); }, finish() { this.onfinish?.(); } };
    animations.push(animation); return animation;
  } };
  const root = { ownerDocument: { defaultView: {} }, contains: node => node === element };
  return { animations, element, scope: createMotion().mount(root) };
}

test('面板取消后仍能重新打开，连续开合沿同一个动画反向', async () => {
  const { scope, animations, element } = motionFixture();
  const first = scope.open(element);
  scope.cancel();
  assert.equal((await first).status, 'cancelled');
  const reopened = scope.open(element);
  assert.equal(animations.length, 2);
  animations[1].currentTime = 120;
  const closing = scope.close(element);
  assert.equal((await reopened).status, 'superseded');
  assert.equal(animations[1].currentTime, 120);
  assert.equal(animations[1].playbackRate, -1);
  animations[1].finish();
  assert.equal((await closing).status, 'completed');
  scope.dispose();
  assert.equal(scope.diagnostics().active, 0);
});
