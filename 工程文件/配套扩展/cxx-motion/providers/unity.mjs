import { mount as mountWeb } from './web.mjs';

export function validateUnityScene(manifest) {
  const scene = manifest.scene;
  const paths = new Set(manifest.resources.map(resource => resource.path));
  for (const key of ['loader', 'framework', 'code', 'data']) {
    if (!paths.has(scene[key])) throw new Error(`Unity作品缺少 ${key} 文件。`);
    if (/\.(?:gz|br|unityweb)$/i.test(scene[key])) throw new Error('Unity本地项目接口目前需要未压缩的Web导出文件；请在导出时将Compression Format设为Disabled。');
  }
  if (scene.threads || scene.streamingAssets || scene.streamingAssetsUrl) throw new Error('当前Unity接口尚未接入多线程与独立StreamingAssets目录。');
  const mapping = value => value && typeof value.object === 'string' && value.object.trim() && typeof value.method === 'string' && value.method.trim();
  for (const input of manifest.inputs ?? []) if (!mapping(input)) throw new Error(`Unity输入缺少object或method：${input.id}`);
  for (const [command, value] of Object.entries(scene.commands ?? {})) {
    if (!['play', 'pause', 'seek', 'setSegment'].includes(command) || !mapping(value)) throw new Error(`Unity控制映射无效：${command}`);
  }
}

export async function bootUnity() {
  const api = globalThis.TavernVisualProject;
  const { scene, inputs = [] } = api.manifest;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;background:transparent';
  canvas.tabIndex = scene.interactive === false ? -1 : 0;
  api.root.append(canvas);
  let instance;
  const send = (mapping, value) => {
    if (!instance) throw new Error('Unity作品尚未完成加载。');
    if (value === undefined) instance.SendMessage(mapping.object, mapping.method);
    else instance.SendMessage(mapping.object, mapping.method, typeof value === 'boolean' ? Number(value) : value);
  };
  api.onCommand(async (command, args) => {
    if (command === 'dispose') { await instance?.Quit(); return; }
    if (command === 'setInput' || command === 'trigger') {
      const input = inputs.find(input => input.id === args[0]);
      if (!input || (input.type === 'trigger') !== (command === 'trigger')) throw new Error('Unity输入没有对应方法。');
      send(input, command === 'trigger' ? undefined : args[1]);
      return;
    }
    const mapping = scene.commands?.[command];
    if (!mapping) throw new Error(`Unity作品没有提供 ${command}。`);
    if (command === 'seek' && (!Number.isFinite(args[0]) || args[0] < 0)) throw new Error('定位帧必须是非负数。');
    if (command === 'setSegment' && (!args.every(Number.isFinite) || args[0] < 0 || args[1] < args[0])) throw new Error('播放区间无效。');
    send(mapping, command === 'setSegment' ? JSON.stringify({ start: args[0], end: args[1] }) : args[0]);
  });
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = api.asset(scene.loader);
    script.onload = resolve;
    script.onerror = () => reject(new Error('Unity loader读取失败。'));
    document.body.append(script);
  });
  api.signal.throwIfAborted();
  if (typeof globalThis.createUnityInstance !== 'function') throw new Error('导出包没有提供createUnityInstance；需要Unity Web的loader.js。');
  instance = await globalThis.createUnityInstance(canvas, {
    dataUrl: api.asset(scene.data), frameworkUrl: api.asset(scene.framework), codeUrl: api.asset(scene.code),
    companyName: scene.companyName ?? '', productName: scene.productName ?? api.manifest.title,
    productVersion: scene.productVersion ?? api.manifest.version,
    matchWebGLToCanvasSize: true, cacheControl: () => 'no-store',
    showBanner(message, type) { if (type === 'error') throw new Error(message); console.warn(message); },
  }, value => api.emit('progress', value));
  if (api.signal.aborted) { await instance.Quit(); api.signal.throwIfAborted(); }
  const capabilities = Object.keys(scene.commands ?? {});
  if (inputs.some(input => input.type !== 'trigger')) capabilities.push('setInput');
  if (inputs.some(input => input.type === 'trigger')) capabilities.push('trigger');
  api.ready(capabilities);
}

export function mount(options) {
  validateUnityScene(options.manifest);
  const path = `__tavern_visual_unity_${crypto.randomUUID()}.js`;
  const script = new Blob([`(${bootUnity.toString()})();`], { type: 'text/javascript' });
  const manifest = {
    ...options.manifest,
    scene: { ...options.manifest.scene, file: path, scriptType: 'classic' },
    resources: [...options.manifest.resources, { path }],
  };
  const types = new Map([
    [manifest.scene.loader, 'text/javascript'], [manifest.scene.framework, 'text/javascript'],
    [manifest.scene.code, 'application/wasm'], [manifest.scene.data, 'application/octet-stream'],
  ]);
  const resources = {
    blob(name) {
      if (name === path) return script;
      const blob = options.resources.blob(name);
      return types.has(name) ? blob.slice(0, blob.size, types.get(name)) : blob;
    },
  };
  return mountWeb({ ...options, manifest, resources });
}
