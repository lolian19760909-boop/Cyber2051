'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('../../独立制卡器/workbench/node_modules/playwright');
const F = require('../lib/menu-fixture.cjs');
const eng = path.resolve(__dirname, '../..');
const bytes = fs.readFileSync(process.env.CXX_TEST_CARD || path.join(eng, '.cache/build/东京都2051-V2.3.30.json'));
const card = JSON.parse(bytes);
const out = process.env.CXX_EVIDENCE || path.join(eng, '.cache/diagnostics/2331-flicker');
const { code, settings } = require('../lib/menu-candidate.cjs')(card, eng);
const suite = path.join(eng, '配套扩展/tavern-runtime-suite');
const url = (text) => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
let source = fs.readFileSync(path.join(suite, 'visual/runtime/motion.mjs'), 'utf8');
for (const name of ['graphic', 'interface']) source = source.replace(`'../recipes/${name}.mjs'`, JSON.stringify(url(fs.readFileSync(path.join(suite, `visual/recipes/${name}.mjs`), 'utf8'))));
const server = http.createServer((q, r) => r.end('<!doctype html>'));
const report = { cardSHA256: require('crypto').createHash('sha256').update(bytes).digest('hex'), samples: {}, shots: [], errors: [] };

const sampler = () => {
  window.__frames = [];
  window.__sampling = false;
  window.__start = () => {
    window.__frames = [];
    window.__sampling = true;
    const t0 = performance.now();
    const tick = () => {
      if (!window.__sampling) return;
      const el = document.querySelector('.cxx-game-menu');
      const body = el?.querySelector('.game-shell');
      const ghost = el ? [...el.querySelectorAll('[aria-hidden="true"][inert]')].find((n) => n.shadowRoot === null && getComputedStyle(n).position === 'absolute') : null;
      window.__frames.push({
        t: Math.round(performance.now() - t0),
        page: el?.dataset.page || '',
        ghost: !!ghost,
        ghostOpacity: ghost ? Number(getComputedStyle(ghost).opacity) : null,
        ghostTop: ghost ? Math.round(ghost.getBoundingClientRect().top) : null,
        bodyOpacity: body ? Number(getComputedStyle(body).opacity) : null,
        bodyTransform: body ? getComputedStyle(body).transform : '',
        bodyHeight: body ? Math.round(body.getBoundingClientRect().height) : null
      });
      if (performance.now() - t0 < 400) requestAnimationFrame(tick);
      else window.__sampling = false;
    };
    requestAnimationFrame(tick);
  };
  window.__stop = () => { window.__sampling = false; return window.__frames; };
};

(async () => {
  let browser;
  fs.mkdirSync(out, { recursive: true });
  try {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.setDefaultTimeout(15000);
    await page.route('https://**/*', (r) => r.abort());
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.setContent('<meta charset="utf-8"><style>body{margin:0;background:#08080b}#chat{height:90vh}</style><div id="chat"><div class="mes" mesid="0"><div data-cxx-opening></div></div></div>');
    await page.addScriptTag({ content: code });
    await page.evaluate(async (src) => { const { createMotion } = await import(src); window.TavernMotion = createMotion(); }, url(source));
    await page.addScriptTag({ content: fs.readFileSync(path.join(eng, '卡片源码/共享/motion.js'), 'utf8') });
    await page.evaluate(() => localStorage.setItem('cxx2051-announcement:' + CxxEntryExperience.announcementId, 'read'));
    await page.evaluate(() => { window.CxxPlugins = { ensureStartup: async () => true, panel: () => () => {}, check: async () => {}, open() {}, read: () => ({ rows: [] }), subscribe(fn) { fn({ rows: [], installation: {} }); return () => {}; } }; });
    await page.evaluate(F.setup, { ...settings, css: undefined });
    const dismiss=page.getByRole('button',{name:'我知道了',exact:true});
    if(await dismiss.count())await dismiss.click().catch(()=>{});
    await page.waitForFunction(() => document.querySelector('.game-status')?.textContent === '');
    await page.evaluate(() => {
      window.CxxResources = { source: (v) => v, acquire: async (u) => ({ url: u, release() {} }), check: async () => {}, read: () => ({ active: 0, error: '', verification: { state: 'checked', missing: 0, corrupt: 0 } }), subscribe(fn) { fn(this.read()); return () => {}; }, panel() { return () => {}; } };
      window.Cxx236Preferences = { read: () => ({ level: 'medium' }), save: async () => {}, device: () => 'desktop', resolveDevice: () => 'desktop', preview() {}, clearPreview() {} };
      window.Cxx233Runtime = { persona: () => ({ name: '旅人' }), invokeScriptButton: () => {} };
      dispatchEvent(new Event('cxx-resources-ready'));
    });
    await page.evaluate(sampler);

    const caseName = async (label, click) => {
      await page.evaluate(() => window.__start());
      await click();
      await page.waitForTimeout(70);
      await page.screenshot({ path: path.join(out, label + '-mid.png') });
      report.shots.push(label + '-mid.png');
      await page.waitForTimeout(150);
      const frames = await page.evaluate(() => window.__stop());
      report.samples[label] = frames;
      await page.evaluate(() => { for (const a of document.getAnimations()) if (Number.isFinite(a.effect.getComputedTiming().endTime)) a.finish(); });
      await page.screenshot({ path: path.join(out, label + '-settled.png') });
      report.shots.push(label + '-settled.png');
    };

    // 主菜单 → 新游戏（slots）
    await caseName('home-to-slots', async () => { await page.getByRole('button', { name: '新游戏', exact: true }).click(); });
    await page.getByRole('button', { name: '返回主菜单', exact: true }).click();
    await page.waitForTimeout(260);
    // 主菜单 → 设置
    await caseName('home-to-settings', async () => { await page.getByRole('button', { name: '设置', exact: true }).click(); });

    const summarize = (label) => {
      const f = report.samples[label] || [];
      const ghostFrames = f.filter((x) => x.ghost);
      return {
        label,
        frames: f.length,
        ghostFrames: ghostFrames.length,
        ghostMs: ghostFrames.length ? ghostFrames.at(-1).t - ghostFrames[0].t : 0,
        firstGhost: ghostFrames[0] || null,
        pageSeen: [...new Set(f.map((x) => x.page))],
        bodyOpacityRange: [Math.min(...f.map((x) => x.bodyOpacity)), Math.max(...f.map((x) => x.bodyOpacity))],
        transforms: [...new Set(f.map((x) => x.bodyTransform))]
      };
    };
    report.summary = [summarize('home-to-slots'), summarize('home-to-settings')];
    report.pass = !report.errors.length;
  } catch (e) {
    report.failure = e.stack; process.exitCode = 1;
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
    fs.writeFileSync(path.join(out, 'flicker.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, failure: report.failure, summary: report.summary, errors: report.errors }, null, 2));
  }
})();
