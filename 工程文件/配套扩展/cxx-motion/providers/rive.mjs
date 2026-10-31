import library from '../vendor/rive-2.44.2.mjs';

let initialized;
async function initialize() {
  if (!initialized) initialized = fetch(new URL('../vendor/rive-2.44.2.wasm', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error('Rive运行文件读取失败。');
    library.RuntimeLoader.setWasmBinary(await response.arrayBuffer());
    library.RuntimeLoader.setWasmFallbackUrl(null);
  }).catch(error => { initialized = null; throw error; });
  return initialized;
}

const inputType = type => type === library.StateMachineInputType.Boolean ? 'boolean' : type === library.StateMachineInputType.Number ? 'number' : 'trigger';

export function mount({ manifest, resources, target, signal, emit }) {
  let player;
  let disposed = false;
  let loaded = false;
  let playing = manifest.scene.autoplay !== false;
  let observer;
  let inventory = null;
  let eventCount = 0;
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const document = target.ownerDocument;
  const view = document.defaultView;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block';
  canvas.setAttribute('aria-label', manifest.title);
  target.append(canvas);
  const external = [];
  const bindings = new Map((manifest.inputs ?? []).map(input => [input.id, input]));
  const check = () => { signal.throwIfAborted(); if (disposed) throw new DOMException('Rive会话已关闭。', 'AbortError'); };
  const fail = error => rejectReady(error instanceof Error ? error : new Error(String(error)));
  const abort = () => { fail(signal.reason); dispose(); };
  signal.addEventListener('abort', abort, { once: true });

  function sync() {
    if (!loaded || disposed) return;
    player.resizeDrawingSurfaceToCanvas();
    if (playing && !document.hidden) player.play(); else player.pause();
  }

  function loadAsset(asset, embedded) {
    if (embedded?.length) return false;
    const file = manifest.scene.assets && Object.hasOwn(manifest.scene.assets, asset.uniqueFilename) ? manifest.scene.assets[asset.uniqueFilename] : null;
    const decode = asset.isImage ? library.decodeImage : asset.isFont ? library.decodeFont : asset.isAudio ? library.decodeAudio : null;
    const task = Promise.resolve().then(async () => {
      check();
      if (!file || !decode) throw new Error(`缺少外置素材映射：${asset.uniqueFilename}`);
      const decoded = await decode(await resources.bytes(file));
      try {
        check();
        if (asset.isImage) asset.setRenderImage(decoded);
        else if (asset.isFont) asset.setFont(decoded);
        else asset.setAudioSource(decoded);
      } finally { decoded.unref(); }
    });
    external.push(task);
    task.catch(fail);
    return true;
  }

  const event = data => { eventCount++; emit(data.data?.name ?? 'event', data.data); };

  function binding(id, trigger) {
    check();
    const item = bindings.get(id);
    if (!item || (item.type === 'trigger') !== trigger) throw new Error(`没有声明此${trigger ? '触发器' : '输入'}：${id}`);
    let value;
    if (item.kind === 'property') value = player.viewModelInstance?.[item.type]?.(item.name);
    else value = player.stateMachineInputs(item.machine ?? manifest.scene.stateMachine ?? player.stateMachineNames[0])?.find(input => input.name === item.name);
    if (!value || (item.kind !== 'property' && inputType(value.type) !== item.type)) throw new Error(`动画内没有匹配的输入：${item.name}`);
    return { item, value };
  }

  const start = async () => {
    try {
      const bytes = await resources.bytes(manifest.scene.file);
      await initialize();
      check();
      player = new library.Rive({
        buffer: bytes.buffer, canvas,
        artboard: manifest.scene.artboard || undefined,
        stateMachine: manifest.scene.stateMachine || undefined,
        animations: manifest.scene.animation || undefined,
        autoplay: false, autoBind: false, enableRiveAssetCDN: false,
        automaticallyHandleEvents: false, isTouchScrollEnabled: true, useOffscreenRenderer: true,
        layout: new library.Layout({ fit: library.Fit.Contain }), assetLoader: loadAsset,
        onLoad: () => queueMicrotask(async () => {
          try {
            check();
            await Promise.all(external);
            check();
            if (player.viewModelCount > 0) {
              const model = manifest.scene.viewModel ? player.viewModelByName(manifest.scene.viewModel) : player.defaultViewModel();
              const instance = model?.defaultInstance();
              if (instance) player.setViewModelInstance(instance);
              for (const name of player.globalViewModelNames()) {
                const globalInstance = player.viewModelByName(name)?.defaultInstance();
                if (globalInstance) player.setGlobalViewModelInstance(name, globalInstance);
              }
              player.bind();
            }
            const machine = manifest.scene.stateMachine ?? player.stateMachineNames[0];
            if (machine) player.play(machine);
            else if (manifest.scene.animation) player.play(manifest.scene.animation);
            await Promise.resolve();
            check();
            inventory = {
              artboards: player.contents?.artboards ?? [],
              animations: [...player.animationNames],
              machines: player.stateMachineNames.map(name => ({ name })),
              properties: player.viewModelInstance?.properties ?? [],
            };
            loaded = true;
            observer = new view.ResizeObserver(sync);
            observer.observe(target);
            document.addEventListener('visibilitychange', sync);
            sync();
            resolveReady();
          } catch (error) { fail(error); }
        }),
        onLoadError: data => fail(new Error(`Rive项目载入失败：${String(data.data)}`)),
      });
      if (manifest.events?.length) player.on(library.EventType.RiveEvent, event);
    } catch (error) { fail(error); }
  };
  void start();

  function dispose() {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', abort);
    document.removeEventListener('visibilitychange', sync);
    observer?.disconnect();
    if (manifest.events?.length) player?.off(library.EventType.RiveEvent, event);
    player?.cleanup();
    canvas.remove();
    rejectReady(new DOMException('Rive会话已关闭。', 'AbortError'));
  }

  return {
    ready, capabilities: ['play', 'pause', 'setInput', 'trigger'],
    play() { check(); playing = true; sync(); },
    pause() { check(); playing = false; sync(); },
    setInput(id, next) {
      const { item, value } = binding(id, false);
      const valid = item.type === 'number' ? typeof next === 'number' && Number.isFinite(next) : item.type === 'boolean' ? typeof next === 'boolean' : item.type === 'color' ? typeof next === 'string' && /^#[a-f0-9]{6}$/i.test(next) : typeof next === 'string';
      if (!valid) throw new Error(`输入值类型不符：${id}`);
      value.value = item.type === 'color' ? (0xff000000 | Number.parseInt(next.slice(1), 16)) >>> 0 : next;
    },
    trigger(id) { const { item, value } = binding(id, true); if (item.kind === 'property') value.trigger(); else value.fire(); },
    diagnostics: () => ({ loaded, playing, disposed, eventCount, inventory }),
    dispose,
  };
}
