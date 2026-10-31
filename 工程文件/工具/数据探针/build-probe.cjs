/*
 * 生成 数据探针.html（把 probe-core.js 与我们的 8 表模板内联进一个单文件页面）。
 * 用法：node 工具/数据探针/build-probe.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const here = __dirname;
const engine = path.resolve(here, '../..');
const core = fs.readFileSync(path.join(here, 'probe-core.js'), 'utf8');
const template = fs.readFileSync(path.join(engine, '数据/表格模板-cxx8.json'), 'utf8');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>东京都2051 · 数据探针（P0）</title>
<style>
  :root { color-scheme: dark; --bg: #0b0a0c; --panel: #16131a; --line: #3a3040; --ink: #ece7f0; --dim: #9c93a8; --hot: #f0c020; --ok: #46d18b; --bad: #ff6b6b; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: var(--bg); color: var(--ink); font: 14px/1.6 "Microsoft YaHei", system-ui, sans-serif; }
  main { max-width: 900px; margin: 0 auto; display: grid; gap: 16px; }
  h1 { margin: 0; font-size: 20px; letter-spacing: .04em; }
  h1 span { color: var(--hot); }
  .panel { border: 1px solid var(--line); background: var(--panel); padding: 14px 16px; display: grid; gap: 10px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  button { border: 1px solid var(--line); background: #1d1822; color: var(--ink); padding: 8px 14px; cursor: pointer; font: inherit; }
  button:hover { border-color: var(--hot); }
  button.hot { border-color: var(--hot); color: var(--hot); }
  pre { margin: 0; padding: 10px; background: #0e0c11; border: 1px solid var(--line); overflow: auto; max-height: 320px; font-size: 12px; }
  .ok { color: var(--ok); } .bad { color: var(--bad); } .dim { color: var(--dim); }
  ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
</style>
</head>
<body>
<main>
  <h1>东京都2051 · <span>数据探针</span>（P0，不改产品码）</h1>
  <div class="panel">
    <div id="cap" class="dim">正在探测数据库接口…</div>
    <ol id="steps"></ol>
    <div class="row">
      <button class="hot" id="run">跑一轮（建表→写行→读回→删探针）</button>
      <button id="read">只读一次（看当前表与行数）</button>
      <button id="save">下载回执</button>
      <button id="copy">复制回执</button>
    </div>
  </div>
  <div class="panel">
    <div class="dim">手动两步（P0 第 4／5 项）：①在酒馆里切到别的 swipe／删掉一层楼；②回到这里点下面的按钮，对比指纹是否跟着变。</div>
    <div class="row">
      <button id="mark">记下当前指纹</button>
      <button id="diff">和上次记下的对比</button>
    </div>
    <pre id="state">（还没有记录）</pre>
  </div>
  <div class="panel">
    <div class="dim">原始回执</div>
    <pre id="log">（空白）</pre>
  </div>
</main>
<script>${core}</script>
<script type="application/json" id="cxx-template">${template}</script>
<script>
(function () {
  const P = window.CxxDataProbe;
  const tpl = JSON.parse(document.getElementById('cxx-template').textContent);
  const capEl = document.getElementById('cap');
  const stepsEl = document.getElementById('steps');
  const logEl = document.getElementById('log');
  const stateEl = document.getElementById('state');
  const KEY = 'cxx-probe-receipt';

  function line(step) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="' + (step.ok ? 'ok' : 'bad') + '">' + (step.ok ? '✔' : '✘') + '</span> '
      + step.id + ' <span class="dim">' + String(step.detail || '') + '</span>';
    return li;
  }
  function paint(report) {
    stepsEl.innerHTML = '';
    (report.steps || []).forEach(step => stepsEl.appendChild(line(step)));
    logEl.textContent = JSON.stringify(report, null, 2);
    try { localStorage.setItem(KEY, JSON.stringify(report)); } catch (e) {}
  }
  const found = P.detect(window);
  function paintCap() {
    const now = P.detect(window);
    capEl.innerHTML = now.available
      ? '<span class="ok">✔ 找到数据库接口</span>（' + (now.depth ? '向上 ' + now.depth + ' 层窗口' : '就在本页') + '）· ' + JSON.stringify(now.capability)
      : '<span class="bad">✘ 没找到数据库接口</span>：确认数据库插件已安装并刷新；卡内 iframe 里遇到这句属于预期，请把本页放在酒馆主界面打开一次。';
  }
  paintCap();
  document.getElementById('run').onclick = () => { paint(P.run(window, tpl)); paintCap(); };
  document.getElementById('read').onclick = () => {
    const api = P.hostOf(window).api;
    if (!api) { capEl.className = 'bad'; return; }
    const tables = P.tablesOf(api);
    stateEl.textContent = JSON.stringify({ fingerprint: P.fingerprint(tables), tables }, null, 2);
  };
  document.getElementById('mark').onclick = () => {
    const api = P.hostOf(window).api;
    if (!api) return;
    localStorage.setItem('cxx-probe-mark', P.fingerprint(P.tablesOf(api)));
    stateEl.textContent = '已记下：' + localStorage.getItem('cxx-probe-mark');
  };
  document.getElementById('diff').onclick = () => {
    const api = P.hostOf(window).api;
    if (!api) return;
    const mark = localStorage.getItem('cxx-probe-mark') || '（没有记过）';
    const now = P.fingerprint(P.tablesOf(api));
    stateEl.textContent = '上次：' + mark + '\\n现在：' + now + '\\n' + (mark === now ? '完全一致（说明这次操作没有改表）' : '有变化（分支/楼层切换确实换了表内容）');
  };
  document.getElementById('copy').onclick = async () => {
    const text = logEl.textContent;
    try { await navigator.clipboard.writeText(text); } catch (e) { stateEl.textContent = '复制失败，请手动选中上面的文本'; }
  };
  document.getElementById('save').onclick = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([logEl.textContent], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cxx-data-probe-' + stamp + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  // 刷新后对比：上一次回执存着，这次进来先看一眼指纹变没变
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (prev && prev.fingerprint) stateEl.textContent = '上次回执指纹：' + prev.fingerprint;
  } catch (e) {}
})();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(here, '数据探针.html'), html, 'utf8');
console.log(JSON.stringify({ out: path.join(here, '数据探针.html'), bytes: Buffer.byteLength(html) }, null, 2));
