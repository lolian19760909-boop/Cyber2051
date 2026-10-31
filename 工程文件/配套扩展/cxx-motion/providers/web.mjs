const commands = ['play', 'pause', 'seek', 'setSegment', 'setInput', 'trigger'];

function boot(token) {
  let port, project, handler;
  let closing = false;
  const assets = new Map();
  const urls = new Map();
  const controller = new AbortController();
  const send = value => port?.postMessage(value);
  function resource(path) { const value = assets.get(path); if (!value) throw new Error(`项目资源不存在：${path}`); return value; }
  function url(path) { if (!urls.has(path)) urls.set(path, URL.createObjectURL(resource(path))); return urls.get(path); }
  function release() { controller.abort(); for (const value of urls.values()) URL.revokeObjectURL(value); urls.clear(); assets.clear(); }
  addEventListener('pagehide', release, { once: true });
  addEventListener('error', event => send({ type: 'error', message: event.message }));
  addEventListener('unhandledrejection', event => send({ type: 'error', message: String(event.reason?.message ?? event.reason) }));
  function receive(event) {
    if (event.source !== parent || event.data?.token !== token || event.data.type !== 'initialize' || !event.ports[0]) return;
    removeEventListener('message', receive);
    port = event.ports[0];
    project = event.data.manifest;
    for (const [path, blob] of event.data.assets) assets.set(path, blob);
    globalThis.TavernVisualProject = Object.freeze({
      manifest: project, root: document.getElementById('stage'), signal: controller.signal,
      asset: url, bytes: async path => new Uint8Array(await resource(path).arrayBuffer()),
      onCommand(callback) { if (typeof callback !== 'function') throw new TypeError('需要命令处理函数。'); handler = callback; },
      ready(capabilities = []) { if (!closing) send({ type: 'ready', capabilities }); },
      emit(name, value) { if (!closing && project.events?.includes(name)) send({ type: 'event', name, value }); },
    });
    port.onmessage = async event => {
      const { id, action, args } = event.data ?? {};
      if (closing) return;
      if (action === 'dispose') closing = true;
      try {
        if (action === 'dispose') controller.abort();
        if (handler) await handler(action, args ?? []);
        else if (action !== 'dispose') throw new Error('作品尚未登记命令处理器。');
        send({ type: 'result', id });
      } catch (error) { send({ type: 'result', id, error: error.message }); }
      finally { if (action === 'dispose') { release(); port.close(); } }
    };
    try {
      const script = document.createElement('script');
      script.src = url(project.scene.file);
      if (project.scene.scriptType === 'module') script.type = 'module';
      script.onerror = () => send({ type: 'error', message: '网页作品入口读取失败。' });
      document.body.append(script);
    } catch (error) { send({ type: 'error', message: error.message }); }
  }
  addEventListener('message', receive);
  parent.postMessage({ token, type: 'hello' }, '*');
}

export function mount({ manifest, resources, target, signal, emit, fail }) {
  const view = target.ownerDocument.defaultView;
  const token = crypto.randomUUID();
  const channel = new view.MessageChannel();
  const frame = target.ownerDocument.createElement('iframe');
  frame.title = manifest.title;
  frame.sandbox = 'allow-scripts';
  frame.style.cssText = 'width:100%;height:100%;border:0;display:block';
  if (manifest.scene.interactive === false) { frame.style.pointerEvents = 'none'; frame.tabIndex = -1; }
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  let initialized = false, loaded = false, disposed = false, closePromise;
  let forcedClose = false, nextId = 0;
  const pending = new Map();
  const capabilities = [];
  const allowedInputs = new Map((manifest.inputs ?? []).map(input => [input.id, input]));
  const abortError = () => new DOMException('网页作品已关闭。', 'AbortError');
  const abort = () => { void dispose(); };
  const check = () => { signal.throwIfAborted(); if (disposed) throw abortError(); };

  function hello(event) {
    if (event.source !== frame.contentWindow || event.data?.token !== token || event.data.type !== 'hello' || disposed) return;
    initialized = true;
    view.removeEventListener('message', hello);
    frame.contentWindow.postMessage({ token, type: 'initialize', manifest, assets: manifest.resources.map(resource => [resource.path, resources.blob(resource.path)]) }, '*', [channel.port2]);
  }
  channel.port1.onmessage = event => {
    const data = event.data;
    if (data?.type === 'result') {
      const request = pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(data.id);
      data.error ? request.reject(new Error(data.error)) : request.resolve();
    } else if (!disposed && !loaded && data?.type === 'ready') {
      if (!Array.isArray(data.capabilities) || data.capabilities.some(name => !commands.includes(name))) { rejectReady(new Error('作品声明了不支持的控制命令。')); return; }
      capabilities.splice(0, capabilities.length, ...new Set(data.capabilities));
      loaded = true;
      resolveReady();
    } else if (!disposed && data?.type === 'event') emit(data.name, data.value);
    else if (!disposed && data?.type === 'error') {
      const error = new Error(data.message);
      rejectReady(error);
      if (loaded) fail(error);
    }
  };
  view.addEventListener('message', hello);
  signal.addEventListener('abort', abort, { once: true });
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#stage{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}</style></head><body><div id="stage"></div><script>(${boot.toString()})(${JSON.stringify(token)})<\/script></body></html>`;
  target.append(frame);

  function request(action, args = [], timeout = 10000) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`作品没有响应 ${action}。`)); }, timeout);
      pending.set(id, { resolve, reject, timer });
      channel.port1.postMessage({ id, action, args });
    });
  }
  function input(id, value, trigger = false) {
    const item = allowedInputs.get(id);
    if (!item || (item.type === 'trigger') !== trigger) throw new Error(`作品没有声明此输入：${id}`);
    if (!trigger && !(item.type === 'number' ? typeof value === 'number' && Number.isFinite(value) : item.type === 'color' ? typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value) : typeof value === item.type)) throw new Error(`输入值类型不符：${id}`);
  }
  function dispose() {
    if (closePromise) return closePromise;
    disposed = true;
    rejectReady(abortError());
    signal.removeEventListener('abort', abort);
    view.removeEventListener('message', hello);
    for (const [id, pendingRequest] of pending) { clearTimeout(pendingRequest.timer); pendingRequest.reject(abortError()); pending.delete(id); }
    closePromise = (initialized ? request('dispose', [], 3000).catch(() => { forcedClose = true; }) : Promise.resolve()).finally(() => {
      channel.port1.close(); channel.port2.close(); frame.remove();
    });
    return closePromise;
  }
  return {
    ready, capabilities,
    play() { check(); return request('play'); },
    pause() { check(); return request('pause'); },
    seek(frame) { check(); return request('seek', [frame]); },
    setSegment(start, end) { check(); return request('setSegment', [start, end]); },
    setInput(id, value) { check(); input(id, value); return request('setInput', [id, value]); },
    trigger(id) { check(); input(id, undefined, true); return request('trigger', [id]); },
    diagnostics: () => ({ initialized, loaded, disposed, forcedClose, pendingCommands: pending.size }),
    dispose,
  };
}
