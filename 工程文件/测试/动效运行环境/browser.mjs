import { digest, prepareProject } from '/extension/project/manifest.mjs';
const errors = [];
const listeners = new Map();
const fixtureContext = {
  extensionSettings: {}, saveSettingsDebounced() {}, eventTypes: { CHAT_CHANGED: 'chat_changed' },
  eventSource: { on(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); }, removeListener(name, callback) { listeners.get(name)?.delete(callback); } },
};
globalThis.SillyTavern = { getContext: () => fixtureContext };
globalThis.addEventListener('error', event => { errors.push(event.message); report(); });
globalThis.addEventListener('unhandledrejection', event => { errors.push(String(event.reason)); report(); });
const extension = await import('/extension/index.js');
const stage = document.getElementById('stage');
const status = document.getElementById('status');
const projects = new Map();
let session, cycles = 0;
const events = [];
function report() { document.getElementById('report-output').textContent = JSON.stringify({ cycles, canvases: stage.querySelectorAll('canvas').length, frames: stage.querySelectorAll('iframe').length, settings: document.querySelectorAll('#cxx-motion-settings').length, listeners: [...listeners].map(([name, callbacks]) => [name, callbacks.size]), runtime: globalThis.TavernVisual?.diagnostics(), events, errors }, null, 2); }
async function project(name) {
  if (!projects.has(name)) {
    const response = await fetch(`/assets/${name}.riv`);
    if (!response.ok) throw new Error('样本读取失败');
    const blob = await response.blob();
    const file = new File([blob], `${name}.riv`, { type: 'application/octet-stream' });
    const manifest = {
      format: 'tavern-visual-project', schema: 1, id: `fixture-${name}`, version: '1', title: `Rive ${name}`,
      engine: { id: 'rive-webgl2', version: '2.44.2' }, scene: { file: file.name },
      resources: [{ path: file.name, bytes: file.size, type: file.type, sha256: await digest(await file.arrayBuffer()) }],
      inputs: name === 'data-binding' ? [{ id: 'caption', kind: 'property', name: 'outer', type: 'string' }] : [],
    };
    projects.set(name, await globalThis.TavernVisual.importFiles([file, new File([JSON.stringify(manifest)], 'project.json', { type: 'application/json' })]));
  }
  return projects.get(name);
}
async function show(name) { const selected = await project(name); session = globalThis.TavernVisual.mount(selected, stage); await session.ready; status.textContent = `已加载 ${name}`; report(); }
function task(work) { return async () => { try { await work(); report(); } catch (error) { status.textContent = error.message; errors.push(error.stack ?? error.message); report(); } }; }
for (const button of document.querySelectorAll('[data-sample]')) button.onclick = task(() => show(button.dataset.sample));
for (const button of document.querySelectorAll('[data-lottie]')) button.onclick = task(async () => {
  const kind = button.dataset.lottie;
  const file = new File([await (await fetch(`/lottie/test.${kind === 'lottie' ? 'lottie' : 'json'}`)).blob()], kind === 'lottie' ? 'test.lottie' : 'test.json');
  let selected = await globalThis.TavernVisual.importFiles([file]);
  selected = await prepareProject({ ...selected.manifest, events: ['complete'], engine: { ...selected.manifest.engine, id: kind === 'webgl' ? 'dotlottie-webgl' : 'dotlottie-canvas' } }, selected.blobs);
  session = globalThis.TavernVisual.mount(selected, stage, { onEvent: event => { events.push(event.name); report(); } });
  await session.ready;
  status.textContent = `已加载 ${kind}`;
});
document.getElementById('seek').onclick = task(async () => { await session.pause(); await session.seek(30); status.textContent = '已定位30帧'; });
document.getElementById('segment').onclick = task(async () => { await session.setSegment(10, 40); await session.seek(10); await session.play(); status.textContent = '正在播放10至40帧'; });
for (const id of ['external-image', 'missing-image']) document.getElementById(id).onclick = task(async () => {
  const names = id === 'missing-image' ? ['external.json'] : ['external.json', 'checker.png'];
  const files = await Promise.all(names.map(async name => new File([await (await fetch(`/lottie/${name}`)).blob()], name)));
  const { importProjectFiles } = await import('/extension/project/import.mjs');
  const selected = await importProjectFiles(files);
  session = globalThis.TavernVisual.mount(selected, stage);
  try { await session.ready; status.textContent = '外置图片已加载'; }
  catch (error) {
    if (id !== 'missing-image' || !error.message.includes('缺少外置素材')) throw error;
    events.push({ expectedFailure: error.message }); status.textContent = error.message;
  }
});
document.getElementById('web-project').onclick = task(async () => {
  const files = await Promise.all(['project.json', 'entry.js'].map(async name => new File([await (await fetch(`/web-example/${name}`)).blob()], name)));
  session = globalThis.TavernVisual.mount(await globalThis.TavernVisual.importFiles(files), stage, { onEvent: event => { events.push(event); report(); } });
  await session.ready;status.textContent = '网页图形作品已加载';
});
for (const id of ['reveal', 'dissolve']) document.getElementById(id).onclick = task(async () => { await session.trigger(id);status.textContent = id; });
document.getElementById('narrow').onclick = () => { stage.style.width = stage.style.width === '320px' ? '' : '320px'; };
document.getElementById('isolation').onclick = task(async () => {
  const code = 'let isolated=false;try{parent.document.body}catch{isolated=true}TavernVisualProject.onCommand(()=>{});TavernVisualProject.emit("isolation",{isolated});TavernVisualProject.ready([]);';
  const blob = new Blob([code], { type: 'text/javascript' });
  const selected = await prepareProject({ format: 'tavern-visual-project', schema: 1, id: 'isolation-fixture', version: '1', title: '隔离检查夹具', engine: { id: 'web-bundle', version: '1' }, scene: { file: 'entry.js' }, events: ['isolation'], resources: [{ path: 'entry.js', bytes: blob.size, type: blob.type, sha256: await digest(await blob.arrayBuffer()) }] }, new Map([['entry.js', blob]]));
  session = globalThis.TavernVisual.mount(selected, stage, { onEvent: event => events.push(event) });
  await session.ready;status.textContent = '隔离检查完成';
});
document.getElementById('pause').onclick = task(async () => { await session.pause(); status.textContent = '已暂停'; });
document.getElementById('play').onclick = task(async () => { await session.play(); status.textContent = '已继续'; });
document.getElementById('close').onclick = task(async () => { await session?.dispose(); session = null; status.textContent = '已关闭'; });
document.getElementById('bind').onclick = task(async () => { await session.setInput('caption', document.getElementById('value').value); status.textContent = '绑定文字已提交'; });
document.getElementById('report').onclick = report;
document.getElementById('cycle').onclick = task(async () => {
  await session?.dispose();
  for (let index = 0; index < 20; index++) { const current = globalThis.TavernVisual.mount(await project(index % 2 ? 'rating' : 'data-binding'), stage); await current.ready; await current.dispose(); cycles++; }
  session = null; status.textContent = '20次完成';
});
document.getElementById('switch').onclick = task(async () => { for (const callback of listeners.get('chat_changed') ?? []) callback(); await Promise.resolve(); status.textContent = '聊天切换事件已发送'; });
document.getElementById('disable').onclick = task(async () => { extension.clean(); await Promise.resolve(); extension.onActivate(); status.textContent = '扩展已重新建立'; });
report();
