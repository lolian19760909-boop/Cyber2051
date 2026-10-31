export function createLottieProvider(DotLottie, wasmUrl) {
  DotLottie.setWasmUrl(wasmUrl);
  return { mount({ manifest, resources, target, signal, emit, fail: reportFailure }) {
    const document = target.ownerDocument;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    canvas.setAttribute('aria-label', manifest.title);
    target.append(canvas);
    let player, disposed = false, loaded = false, resolveReady, rejectReady;
    let playing = manifest.scene.autoplay !== false;
    const callbacks = [];
    const missing = new Set();
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const check = () => { signal.throwIfAborted(); if (disposed) throw new DOMException('动画已关闭。', 'AbortError'); };
    const fail = error => rejectReady(error instanceof Error ? error : new Error(String(error)));
    const abort = () => { fail(signal.reason); dispose(); };
    const visibility = () => { if (loaded && !disposed) document.hidden ? player.freeze() : player.unfreeze(); };
    const listen = (name, callback) => { player.addEventListener(name, callback); callbacks.push([name, callback]); };
    signal.addEventListener('abort', abort, { once: true });

    async function start() {
      try {
        const assetBytes = new Map();
        for (const [name, path] of Object.entries(manifest.scene.assets ?? {})) {
          check();
          assetBytes.set(name, await resources.bytes(path));
        }
        const bytes = await resources.bytes(manifest.scene.file);
        check();
        const data = manifest.scene.file.toLowerCase().endsWith('.json') ? new TextDecoder().decode(bytes) : bytes.buffer;
        player = new DotLottie({
          canvas, data, autoplay: false,
          loop: manifest.scene.loop === true,
          animationId: manifest.scene.animationId,
          layout: { fit: 'contain', align: [0.5, 0.5] },
          renderConfig: { autoResize: true, freezeOnOffscreen: true },
          assetResolver(name) {
            const relative = name.replace(/^\/+/, '');
            const asset = assetBytes.get(name) ?? assetBytes.get(relative) ?? (!relative.includes(':') ? assetBytes.get(relative.split('/').at(-1)) : undefined);
            if (!asset) missing.add(name);
            return asset;
          },
        });
        listen('load', () => {
          if (disposed) return;
          if (missing.size) { fail(new Error(`缺少外置素材：${[...missing].join('、')}`)); return; }
          loaded = true;
          document.addEventListener('visibilitychange', visibility);
          if (playing) player.play();
          visibility();
          resolveReady();
        });
        listen('loadError', event => fail(event.error));
        listen('renderError', event => { fail(event.error); reportFailure(event.error); });
        listen('complete', () => { playing = false; emit('complete', {}); });
        listen('loop', event => emit('loop', { count: event.loopCount }));
      } catch (error) { fail(error); }
    }
    void start();

    function frame(value) { if (!Number.isFinite(value) || value < 0 || value > player.totalFrames - 1) throw new Error('动画帧位置超出范围。'); }
    function dispose() {
      if (disposed) return;
      disposed = true;
      signal.removeEventListener('abort', abort);
      document.removeEventListener('visibilitychange', visibility);
      for (const [name, callback] of callbacks) player.removeEventListener(name, callback);
      player?.destroy();
      canvas.remove();
      rejectReady(new DOMException('动画已关闭。', 'AbortError'));
    }
    return {
      ready, capabilities: ['play', 'pause', 'seek', 'setSegment'],
      play() { check(); playing = true; player.play(); },
      pause() { check(); playing = false; player.pause(); },
      seek(value) { check(); frame(value); player.setFrame(value); },
      setSegment(start, end) { check(); frame(start); frame(end); if (start > end) throw new Error('片段起点不能晚于终点。'); player.setSegment(start, end); },
      diagnostics: () => ({ loaded, playing, disposed, frame: player?.currentFrame ?? 0, totalFrames: player?.totalFrames ?? 0, duration: player?.duration ?? 0, missingAssets: [...missing] }),
      dispose,
    };
  } };
}
