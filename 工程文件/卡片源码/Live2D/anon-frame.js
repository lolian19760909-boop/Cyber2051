// Maintained Anon renderer; assets arrive from the installed model manifest.
(() => {
  'use strict';
  const expressionMap = {
    normal: ['exp_idle01', 'mtn_idle01_C'],
    smile: ['exp_smile01', 'mtn_smile01_C'],
    blush: ['exp_shy01', 'mtn_smile02_C'],
    serious: ['exp_serious01', 'mtn_serious01_C'],
    sadness: ['exp_sad01', 'mtn_sad01_C'],
    shocked: ['exp_surprised01', 'mtn_surprised01_C'],
    constricted_pupils: ['exp_pale01', 'mtn_surprised02_C'],
    regret: ['exp_sad01', 'mtn_sad01_C'],
    cyberpsychosis: ['exp_shadow01', 'mtn_thinking01_C'],
    yandere_trance: ['exp_pale01', 'mtn_surprised02_C'],
  };
  let app, model, port, observer, timer, disposed = false, ready = false;
  let state = { expression: 'normal', speaking: false, paragraphKey: '', mouth: 0, lowMotion: false };
  let expression = '', pendingState = 0, motionEpoch = 0, appliedLowMotion = null;
  const removers = [];
  const report = (type, extra = {}) => port?.postMessage({ type, ...extra });
  const size = () => {
    if (!app || !model || disposed) return;
    const width = Math.max(1, document.documentElement.clientWidth), height = Math.max(1, document.documentElement.clientHeight);
    app.renderer.resize(width, height);
    const scale = Math.min(width / model.internalModel.width, height / model.internalModel.height) * 1.3;
    model.scale.set(scale); model.anchor.set(.5, .5); model.position.set(width / 2, height / 2);
  };
  async function play(group) {
    clearTimeout(timer); const epoch = ++motionEpoch;
    if (!model || disposed || state.lowMotion) return;
    const owned = model;
    try {
      owned.internalModel.motionManager.stopAllMotions();
      await owned.motion(group, 0, 3);
      if (disposed || owned !== model || epoch !== motionEpoch || state.lowMotion) return;
      await owned.expression(expressionMap[Object.hasOwn(expressionMap, state.expression) ? state.expression : 'normal'][0]);
      // Return to breathing/idle after an expression gesture instead of gesturing forever.
      const file = window.ANON_MODEL_SETTINGS.FileReferences.Motions[group][0].File;
      const motion = await (await fetch(file)).json();
      if (disposed || owned !== model || epoch !== motionEpoch || state.lowMotion) return;
      timer = setTimeout(() => play('mtn_idle01_C'), Math.max(1, motion.Meta.Duration) * 1000 + 180);
    } catch (error) { if (!disposed) report('warning', { message: '动作暂不可用：' + error.message }); }
  }
  async function applyState() {
    if (!ready || disposed) return;
    const next = Object.hasOwn(expressionMap, state.expression) ? state.expression : 'normal';
    document.getElementById('coatSway').checked = !state.lowMotion;
    const resumeMotion = appliedLowMotion === true && !state.lowMotion;
    const stopMotion = appliedLowMotion !== true && state.lowMotion;
    appliedLowMotion = state.lowMotion;
    if (stopMotion) { ++motionEpoch; clearTimeout(timer); model.internalModel.motionManager.stopAllMotions(); }
    if (next !== expression) {
      const revision = ++pendingState;
      expression = next;
      await model.expression(expressionMap[next][0]);
      if (disposed || revision !== pendingState) return;
      void play(expressionMap[next][1]);
    } else if (resumeMotion) void play('mtn_idle01_C');
    document.documentElement.dataset.expression = expression;
    document.documentElement.dataset.speaking = state.speaking ? '1' : '0';
    report('state', { expression, speaking: state.speaking, paragraphKey: state.paragraphKey });
  }
  function dispose() {
    if (disposed) return;
    disposed = true; ready = false; ++pendingState; ++motionEpoch; clearTimeout(timer); observer?.disconnect();
    removers.reverse().forEach(remove => { try { remove(); } catch (_) {} });
    app?.stop();
    app?.destroy(true, { children: true, texture: true, baseTexture: true });
    model = null; app = null; report('disposed'); port?.close(); port = null;
  }
  async function loadLibraries() {
    for (const file of ['vendor/pixi.min.js','vendor/live2dcubismcore.min.js','vendor/live2d.min.js','vendor/live2d-display.min.js']) {
      if (disposed) return;
      const url = window.CxxModelFiles[file];
      if (typeof url !== 'string' || !url.startsWith('blob:')) throw Error('模型缓存缺少播放器：' + file);
      await new Promise((resolve,reject) => {
        const script=document.createElement('script');script.src=url;
        script.onload=()=>resolve();script.onerror=()=>reject(Error('播放器载入失败：'+file));
        document.head.append(script);
      });
    }
  }
  async function boot() {
    try {
      await loadLibraries();
      if (disposed) return;
      if (!window.PIXI?.live2d?.Live2DModel || !window.Live2DCubismCore) throw Error('模型播放器未就绪');
      app = new PIXI.Application({ view: document.getElementById('canvas'), backgroundAlpha: 0, antialias: true,
        autoDensity: true, resolution: Math.min(devicePixelRatio || 1, 1.5) });
      app.ticker.maxFPS = 30;
      const settings=new PIXI.live2d.Cubism4ModelSettings(window.ANON_MODEL_SETTINGS);
      settings.resolveURL=file=>file;
      const next = await PIXI.live2d.Live2DModel.from(settings, { autoInteract: false });
      if (disposed) { next.destroy(); return; }
      model = next; app.stage.addChild(model);
      removers.push(await attachCoat(app, model));
      if (disposed) return;
      removers.push(await attachCollar(app, model));
      if (disposed) return;
      removers.push(await attachDetails(app, model));
      if (disposed) return;
      model.internalModel.on('beforeModelUpdate', () => {
        const mouth = state.speaking ? Math.min(1,Math.max(0,state.mouth||0)) : 0;
        model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', mouth);
      });
      observer = new ResizeObserver(size); observer.observe(document.documentElement);
      size(); ready = true;
      document.documentElement.dataset.modelReady = '1';
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(disposed)return;
      report('ready', { revision: 6 });
      await applyState();
    } catch (error) {
      if (disposed) return;
      console.error('[Anon model]', error);
      report('error', { message: error.message });
      dispose();
    }
  }
  function connect(event) {
    // Tavern Helper runs in a sibling frame, so the sender is not always parent.
    if (disposed || port || (event.source!==parent && event.source?.parent!==parent) || event.data?.type !== 'cxx-anon-connect' || !event.ports?.[0]) return;
    window.CxxModelFiles=event.data.files;
    window.removeEventListener('message', connect);
    port = event.ports[0];
    port.onmessage = ({ data }) => {
      if (data?.type === 'dispose') { dispose(); return; }
      if (data?.type !== 'state' || disposed) return;
      const next = { expression: String(data.expression || 'normal'), speaking: data.speaking === true,
        paragraphKey: String(data.paragraphKey || '').slice(0, 160), mouth: Number(data.mouth) || 0, lowMotion: data.lowMotion === true };
      const changed=['expression','speaking','paragraphKey','lowMotion'].some(key=>next[key]!==state[key]);state=next;
      if(changed)void applyState();
    };
    port.start();void (async()=>{const files=window.CxxModelFiles,settings=await (await fetch(files['model/002_casual_spring_01.model3.json'])).json();const rewrite=value=>{if(typeof value==='string')return files['model/'+value]||value;if(Array.isArray(value))return value.map(rewrite);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));return value;};window.ANON_MODEL_SETTINGS={...rewrite(settings),url:'https://cyber2051.local/model.json'};await boot();})().catch(e=>report('error',{message:e.message}));
  }
  window.addEventListener('message', connect);
  window.addEventListener('pagehide', dispose, { once: true });
})();
