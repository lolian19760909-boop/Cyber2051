import { importProjectFiles } from '../project/import.mjs';

export function mountManager(target, { runtime, store }) {
  const document = target.ownerDocument;
  const controller = new AbortController();
  const node = document.createElement('section');
  node.className = 'tavern-visual-manager';
  node.innerHTML = '<h4>视觉项目</h4><p>导入Rive、Lottie文件及素材，或含project.json的项目文件夹。作品单独保存，播放器按需载入。</p><div class="tavern-visual-actions"><label class="menu_button">导入文件<input type="file" multiple aria-label="导入视觉项目文件"></label><label class="menu_button">导入文件夹<input type="file" multiple webkitdirectory aria-label="导入视觉项目文件夹"></label></div><label>已保存的项目<select aria-label="已保存的视觉项目"></select></label><div class="tavern-visual-actions"><button type="button" class="menu_button" data-open>预览项目</button><button type="button" class="menu_button" data-refresh>刷新列表</button></div><output role="status"></output>';
  const output = node.querySelector('output');
  const select = node.querySelector('select');
  const open = node.querySelector('[data-open]');
  let dialog = null;
  let session = null;
  let revision = 0;
  let importRevision = 0;
  const status = text => { if (!controller.signal.aborted) output.textContent = text; };
  const failure = error => { if (error.name !== 'AbortError') status(error.message); };

  async function refresh(selected = select.value) {
    const records = await store.list();
    if (controller.signal.aborted) return;
    select.replaceChildren(...records.map(record => {
      const option = document.createElement('option');
      option.value = record.key;
      option.textContent = `${record.manifest.title} · ${record.manifest.version} · ${record.manifest.engine.id}`;
      return option;
    }));
    if (records.some(record => record.key === selected)) select.value = selected;
    open.disabled = !records.length;
  }

  async function close() {
    revision++;
    const previous = session;
    session = null;
    const panel = dialog;
    dialog = null;
    panel?.close();
    try { await previous?.dispose(); }
    finally { panel?.remove(); }
  }

  async function preview() {
    const closing = close();
    const stamp = revision;
    await closing;
    if (stamp !== revision || controller.signal.aborted) return;
    const project = await store.get(select.value);
    if (stamp !== revision || controller.signal.aborted) return;
    if (!project) throw new Error('请先导入项目。');
    const checked = runtime.inspect(project);
    if (!checked.available) throw new Error(`此项目需要另装播放器：${checked.engine}`);
    const panel = document.createElement('dialog');
    panel.className = 'tavern-visual-preview';
    panel.setAttribute('aria-label', '视觉项目预览');
    panel.innerHTML = '<header><strong></strong><button type="button" data-close>关闭预览</button></header><div class="tavern-visual-stage"></div><footer><button type="button" data-play>播放</button><button type="button" data-pause>暂停</button><button type="button" data-report>查看运行情况</button><output role="status">正在加载…</output></footer><pre hidden></pre>';
    panel.querySelector('strong').textContent = project.manifest.title;
    dialog = panel;
    document.body.append(panel);
    panel.showModal();
    panel.querySelector('[data-close]').addEventListener('click', () => { void close().catch(failure); });
    panel.addEventListener('cancel', event => { event.preventDefault(); void close().catch(failure); });
    const current = runtime.mount(project, panel.querySelector('.tavern-visual-stage'), {
      signal: controller.signal,
      onError: error => { panel.querySelector('output').textContent = error.message; },
    });
    session = current;
    for (const action of ['play', 'pause']) panel.querySelector(`[data-${action}]`).addEventListener('click', () => { void current[action]().catch(error => { panel.querySelector('output').textContent = error.message; }); });
    panel.querySelector('[data-report]').addEventListener('click', () => {
      const report = panel.querySelector('pre');
      report.hidden = !report.hidden;
      report.textContent = JSON.stringify(current.diagnostics(), null, 2);
    });
    try {
      await current.ready;
      if (current !== session) return;
      panel.querySelector('output').textContent = '已加载';
      const capabilities = current.diagnostics().capabilities;
      for (const action of ['play', 'pause']) panel.querySelector(`[data-${action}]`).disabled = !capabilities.includes(action);
    } catch (error) {
      if (current === session) panel.querySelector('output').textContent = error.message;
      throw error;
    }
  }

  for (const input of node.querySelectorAll('input[type=file]')) input.addEventListener('change', async () => {
    const selection = [...input.files];
    const stamp = ++importRevision;
    input.value = '';
    if (!selection.length) return;
    status('正在核对项目文件…');
    try {
      const project = await importProjectFiles(selection, { signal: controller.signal });
      if (stamp !== importRevision || controller.signal.aborted) return;
      const key = await store.put(project);
      if (stamp !== importRevision || controller.signal.aborted) return;
      await refresh(key);
      status(runtime.inspect(project).available ? `已导入：${project.manifest.title}` : `已保存项目，需要另装 ${project.manifest.engine.id} ${project.manifest.engine.version} 播放器。`);
    } catch (error) { if (stamp === importRevision) failure(error); }
  });
  open.addEventListener('click', () => { void preview().catch(failure); });
  node.querySelector('[data-refresh]').addEventListener('click', () => { void refresh().catch(failure); });
  target.append(node);
  void refresh().catch(failure);
  return { refresh, close, async dispose() { controller.abort(); node.remove(); await close(); } };
}
