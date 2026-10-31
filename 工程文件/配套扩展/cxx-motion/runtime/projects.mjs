import { createResources } from './resources.mjs';

export function createProjectRuntime({ resources = createResources } = {}) {
  const providers = new Map();
  const loaded = new Map();
  const sessions = new Set();
  const slots = new WeakMap();
  let disposed = false;
  const keyOf = engine => `${engine.id}@${engine.version}`;
  const aborted = () => new DOMException('播放会话已关闭。', 'AbortError');

  function register(descriptor) {
    if (disposed) throw new Error('视觉运行环境已关闭。');
    if (!descriptor?.id || !descriptor.version || typeof descriptor.load !== 'function') throw new TypeError('播放器登记无效。');
    const key = keyOf(descriptor);
    if (providers.has(key)) throw new Error(`播放器已经登记：${key}`);
    providers.set(key, { ...descriptor });
  }

  function inspect(project) {
    const key = keyOf(project.manifest.engine);
    return { project: project.manifest.id, version: project.manifest.version, engine: key, available: providers.has(key) };
  }

  async function provider(key) {
    if (!loaded.has(key)) loaded.set(key, Promise.resolve().then(() => providers.get(key).load()).catch(error => { loaded.delete(key); throw error; }));
    return loaded.get(key);
  }

  function mount(project, target, { binding = {}, onEvent = () => {}, onError = () => {}, signal } = {}) {
    if (disposed) throw new Error('视觉运行环境已关闭。');
    if (!target?.ownerDocument || typeof target.append !== 'function') throw new TypeError('需要页面内的挂载容器。');
    const key = keyOf(project.manifest.engine);
    if (!providers.has(key)) throw new Error(`尚未安装播放器：${key}`);
    const prior = slots.get(target);
    const controller = new AbortController();
    const externalAbort = () => { void session.dispose(); };
    const scope = resources(project);
    const stage = target.ownerDocument.createElement('div');
    stage.style.cssText = 'position:relative;width:100%;height:100%;min-height:0';
    let handle = null;
    let state = 'loading';
    let failure = null;
    let cleanup = null;
    let capabilities = [];
    const metadata = structuredClone(binding);
    function check() { controller.signal.throwIfAborted(); }

    const ready = Promise.resolve().then(async () => {
      if (prior) await prior.dispose();
      check();
      const implementation = await provider(key);
      check();
      target.append(stage);
      handle = implementation.mount({
        manifest: project.manifest, resources: scope, target: stage, signal: controller.signal,
        fail(error) {
          queueMicrotask(() => {
            if (controller.signal.aborted) return;
            failure = { name: error.name ?? 'Error', message: error.message ?? String(error) };
            state = 'failed';
            controller.abort(error);
            void release().catch(error => { failure = { name: error.name, message: error.message }; });
            onError({ ...failure });
          });
        },
        emit(name, value) {
          if (!controller.signal.aborted && project.manifest.events?.includes(name)) onEvent({ name, value: structuredClone(value), binding: structuredClone(metadata) });
        },
      });
      if (!handle || typeof handle.dispose !== 'function' || !handle.ready?.then) throw new Error('播放器没有提供完整的会话接口。');
      await handle.ready;
      check();
      capabilities = [...new Set(handle.capabilities ?? [])];
      state = 'ready';
      return session;
    }).catch(async error => {
      failure ??= { name: error.name, message: error.message };
      if (!controller.signal.aborted) state = 'failed';
      await release();
      throw error;
    });
    ready.catch(() => {});

    function release() {
      if (!cleanup) cleanup = Promise.resolve().then(() => handle?.dispose?.()).finally(() => {
        signal?.removeEventListener('abort', externalAbort);
        scope.dispose();
        stage.remove();
        sessions.delete(session);
        if (slots.get(target) === session) slots.delete(target);
      });
      return cleanup;
    }

    async function command(name, ...args) {
      await ready;
      check();
      if (!capabilities.includes(name) || typeof handle[name] !== 'function') throw new Error(`此播放器不支持 ${name}。`);
      return handle[name](...args);
    }

    const session = Object.freeze({
      ready,
      play: (...args) => command('play', ...args),
      pause: () => command('pause'),
      seek: frame => command('seek', frame),
      setSegment: (start, end) => command('setSegment', start, end),
      setInput: (id, value) => command('setInput', id, value),
      trigger: id => command('trigger', id),
      diagnostics: () => ({ ...inspect(project), state, capabilities: [...capabilities], failure, resources: scope.diagnostics(), player: handle?.diagnostics?.() ?? null }),
      dispose() {
        if (state === 'disposed') return cleanup ?? Promise.resolve();
        state = 'disposed';
        controller.abort(aborted());
        signal?.removeEventListener('abort', externalAbort);
        return release();
      },
    });
    sessions.add(session);
    slots.set(target, session);
    signal?.addEventListener('abort', externalAbort, { once: true });
    if (signal?.aborted) void session.dispose();
    return session;
  }

  return Object.freeze({
    register, inspect, mount,
    closeAll: () => Promise.all([...sessions].map(session => session.dispose())),
    providers: () => [...providers.values()].map(({ id, version, title }) => ({ id, version, title })),
    diagnostics: () => ({ disposed, sessions: [...sessions].map(session => session.diagnostics()), loadedProviders: loaded.size }),
    async dispose() {
      if (disposed) return;
      disposed = true;
      await Promise.allSettled([...sessions].map(session => session.dispose()));
      loaded.clear();
      providers.clear();
    },
  });
}
