'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const {chromium} = require('../../独立制卡器/workbench/node_modules/playwright');
const {extract} = require('../../工具/lib/script-modules.cjs');
const globals = require('../../工具/lib/card-global.cjs');
const T = require('../../工具/lib/terminal-preview.cjs'), Memory = require('../lib/memory-visual-fixture.cjs');
const F = require('./fixtures.cjs'), eng = path.resolve(__dirname, '../..');
const file = process.env.CXX_TEST_CARD || path.join(eng, '.cache/build/赛博小祥2051-V2.3.1.json');
const bytes = fs.readFileSync(file), card = JSON.parse(bytes);
const out = process.env.CXX_EVIDENCE || path.join(eng, '.cache/plot-framework-20261018/browser');
const all = card.data.extensions.tavern_helper.scripts.map(s => s.content || '').join('\n;\n');
const names = ['CxxDataClone', 'CxxStoryLineModel', 'CxxStoryLines', 'CxxStoryChapters', 'CxxStoryGraphCompat', 'CxxQuests', 'CxxMemoryPlot', 'CxxMemoryPanel', 'CxxLongMemoryStartup', 'CxxNativeHost', 'CxxGalSprites', 'CxxGalController'];
const modules = new Map(extract(all, names).map(m => [m.name, m.source]));
const code = globals(all, ['CxxThemeCSS', 'CxxMemoryPanelStyle']) + ';\n' + names.map(n => { assert(modules.has(n), n); return modules.get(n); }).join(';\n');
const pack = require('../../工具/lib/offline-resources.cjs')(eng);
const proof = JSON.parse(fs.readFileSync(path.join(eng, pack.profile.provenance)));
const art = proof.assets.find(a => a.sourceSize?.[0] * 9 === a.sourceSize?.[1] * 16);
assert(art, 'existing 16:9 art');
const artEntry = pack.manifest.entries.find(a => a.id === art.id), artBytes = pack.entries.get(artEntry.file);
const chapter = JSON.parse(fs.readFileSync(path.join(eng, '卡片源码/剧情/盗芯之夜.json')));
const detection = JSON.parse(fs.readFileSync(path.join(eng, '卡片源码/长期记忆/detection.json')));
const css = fs.readFileSync(path.join(eng, '卡片源码/原生/prose.css'), 'utf8');
const server = http.createServer((req, res) => {
  if (req.url === '/art.webp') { res.writeHead(200, {'content-type': 'image/webp'}); res.end(artBytes); }
  else res.end('<!doctype html><meta charset="utf-8">');
});
const report = {cardSHA256: crypto.createHash('sha256').update(bytes).digest('hex'),
  scope: 'Actual packaged modules in controlled Edge; synthetic authored nodes and host callbacks; no model or player storage writes', checks: [], screens: [], errors: []};

async function setup(data) {
  panel.destroy();
  const {line, initial, body, chapter, detection, url, css} = data;
  line.nodes[1].illustrations[0].url = url;
  const handlers = new Map(), context = memoryContext;
  context.chat.splice(0, context.chat.length, {mes: body, swipe_id: 0, is_user: false, name: '旁白', variables: [{stat_data: initial}]});
  Object.assign(memory, {start: () => memory, destroy() {}, story: raw => raw});
  window.Cxx233Runtime = {parser: {}};
  const api = {SillyTavern: {getContext: () => context}, waitGlobalInitialized: async () => {},
    addEventListener: (...args) => window.addEventListener(...args), removeEventListener: (...args) => window.removeEventListener(...args),
    eventOn: (name, fn) => handlers.set(name, fn), eventRemoveListener: name => handlers.delete(name), getButtonEvent: name => name,
    CxxLongMemoryAdapter: {create: () => memory}, CxxMemoryPlot, CxxMemoryPanel};
  await CxxLongMemoryStartup.install({host: window, api, bundle: {}, chapter, quests: [], detection, lines: [line]});
  let hash = 2166136261; for (const ch of body.trim()) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  const source = {floor: 0, swipe: 0, story: (hash >>> 0).toString(16)};
  window.storyInitial = structuredClone(initial);
  window.stat = () => context.chat[0].variables[0].stat_data;
  window.setStat = value => { context.chat[0].variables[0].stat_data = structuredClone(value); };
  window.advance = events => {
    const before = stat();
    before.terminal.quests[line.id] = CxxPlot.advance(before, line.id, events, {source, storyText: body, Q: CxxQuests});
  };
  window.prepareOpenings = () => Object.assign(stat().terminal.quests, CxxPlot.openings(stat(), source));
  window.uiCommits = [];
  window.__cxx_player__ = {commit: async request => {
    uiCommits.push(request);
    setStat(CxxQuests.plan(stat(), request, {questDefinitions: CxxPlot.definitions, questSource: source}));
  }};
  document.querySelector('#opener').onclick = () => memory.openPanel('剧情');
  window.native = CxxNativeHost.mount({window, context: () => context, subscribe: () => () => {}, messageFeed: () => () => {},
    prose: {mount(node, options) { node.textContent = options.raw(); return {refresh() {}, destroy() {}}; }},
    terminalFactory: {create: () => ({close() {}, destroy() {}})}, css, notify: message => { throw Error(message); }});
  const adapter = {read: () => ({key: 'fixture', messages: context.chat, draft: '', busy: false}), subscribe: () => () => {},
    cover() {}, focusNative() {}, notify: message => { throw Error(message); }, background: () => ({url: '/normal.webp'})};
  window.gal = CxxGalController.create({adapter, parser: {parseMessage: raw => ({paragraphs: [{text: raw}], warnings: [], choices: [], scene: null})},
    mount(callbacks) { window.galCallbacks = callbacks; return {render: model => { window.galModel = model; }, destroy() {}}; }});
  window.fixture = {line, source, handlers};
}
async function screenshot(page, id, width) {
  const metrics = await page.evaluate(() => ({overflow: document.documentElement.scrollWidth > innerWidth + 2}));
  assert(!metrics.overflow, id + ' document overflow');
  await page.screenshot({path: path.join(out, id + '-' + width + '.png')});
  report.screens.push({id, width, ...metrics});
}
async function assertTerminalLayout(frame, width, height) {
  const layout = await frame.evaluate(() => {
    const rect = node => { const box = node.getBoundingClientRect(); return {left: box.left, right: box.right, top: box.top, bottom: box.bottom}; };
    const library = rect(document.querySelector('.terminal-library-tabs'));
    const headings = [...document.querySelectorAll('[data-module="media"] .page-head .eyebrow,[data-module="media"] .page-head h1')].map(rect);
    const overlap = box => Math.max(0, Math.min(box.right, library.right) - Math.max(box.left, library.left)) * Math.max(0, Math.min(box.bottom, library.bottom) - Math.max(box.top, library.top));
    const nav = document.querySelector('.nav-item[aria-current="page"]') || document.querySelector('.nav-item.is-active') || document.querySelector('.nav-item[aria-pressed="true"]');
    const box = rect(nav), text = [...nav.querySelectorAll('strong,small')].flatMap(node => {
      const range = document.createRange(); range.selectNodeContents(node); return [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0).map(r => ({left: r.left, right: r.right, top: r.top, bottom: r.bottom}));
    });
    const before = getComputedStyle(nav, '::before'), color = getComputedStyle(nav).color;
    const rgb = value => {
      const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      if (srgb) return srgb.slice(1, 4).map(Number);
      const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      return match ? match.slice(1, 4).map(value => Number(value) / 255) : null;
    };
    const luminance = rgb => rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = rgb(color), background = rgb(before.backgroundImage);
    const light = foreground && luminance(foreground), dark = background && luminance(background);
    return {library, headings, intersections: headings.map(overlap), nav: box, text, beforeZ: Number(before.zIndex), foreground: color, background: before.backgroundImage,
      contrast: foreground && background ? (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05) : null};
  });
  assert.equal(layout.headings.length, 2); assert(layout.intersections.every(area => area === 0), 'library tabs do not cover media headings');
  assert(layout.text.every(rect => rect.left >= layout.nav.left - 0.5 && rect.right <= layout.nav.right + 0.5 && rect.top >= layout.nav.top - 0.5 && rect.bottom <= layout.nav.bottom + 0.5), 'selected navigation labels fit their button');
  assert(layout.beforeZ < 0); assert(layout.contrast >= 4.5, 'selected navigation gradient preserves text contrast');
  report.layout ||= []; report.layout.push({width, height, ...layout});
}
async function main() {
  let browser;
  fs.mkdirSync(out, {recursive: true});
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({channel: 'msedge', headless: true});
    for (const [width,height] of [[1280,844], [390,844], [844,390]]) {
      const page = await browser.newPage({viewport: {width, height}});
      page.on('pageerror', e => report.errors.push(e.message)); page.setDefaultTimeout(10000);
      await page.goto(origin); await page.setContent('<style>body{margin:16px;background:#0b1020;color:#e8e8ec}#chat{max-width:850px;margin:auto}</style><button id="opener">剧情</button><div id="chat"><div class="mes" mesid="0"><div class="mes_text"></div></div></div>');
      await page.addScriptTag({content: code}); await page.evaluate(Memory.setup);
      await page.evaluate(setup, {line: F.line, initial: F.state(), body: F.body, chapter, detection, url: origin + '/art.webp', css});
      const initial = await page.evaluate(() => stat());
      await page.locator('#opener').click();
      const dialog = page.getByRole('dialog'), plotCard = dialog.locator('article').filter({has: page.getByRole('heading', {name: /隔离样例·包裹/})});
      await plotCard.getByText('答应调查 · 可开启 · 0 / 1 项事实', {exact: true}).waitFor();
      assert.deepEqual(await page.evaluate(() => stat()), initial, 'browsing is read-only');
      await plotCard.getByRole('button', {name: '追踪', exact: true}).click();
      assert.equal(await page.evaluate(() => stat().terminal.questJournal.tracked), F.line.id);
      await dialog.getByRole('button', {name: '关闭', exact: true}).click();
      await page.evaluate(events => { advance(events); prepareOpenings(); stat().terminal.wallet.yen = 1000; memory.openPanel('剧情'); }, [F.event('P1', ['agreed'])]);
      await plotCard.getByText('调查与取回 · 进行中 · 0 / 2 项事实', {exact: true}).waitFor();
      await screenshot(page, 'nodes-active', width);
      await dialog.getByRole('button', {name: '暂离', exact: true}).last().click();
      await plotCard.getByRole('button', {name: '继续', exact: true}).click();
      assert.equal(await page.evaluate(() => stat().terminal.quests.sample_parcel.state), '进行中');
      await dialog.getByRole('button', {name: '关闭', exact: true}).click();
      await page.evaluate(events => { advance(events); native.refresh(); gal.open(); }, [F.event('P2', ['found', 'recovered'])]);
      const artImage = page.locator('.cxx-story-illustrations img');
      await artImage.waitFor(); await page.waitForFunction(() => document.querySelector('.cxx-story-illustrations img')?.naturalWidth > 0);
      assert.equal(await page.evaluate(() => galModel.storyCg.url), origin + '/art.webp');
      assert.equal(await page.evaluate(() => galModel.background.url), '/normal.webp');
      assert.equal(await page.evaluate(() => galModel.sprites.length), 0);
      await screenshot(page, 'native-art', width);
      await page.getByRole('button', {name: '查看剧情插图：取回包裹'}).click();
      await screenshot(page, 'native-fullscreen', width);
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), '查看剧情插图：取回包裹');
      const unlocked = await page.evaluate(() => stat());
      await page.evaluate(() => { const row = memoryContext.chat[0]; row.variables[1] = {stat_data: storyInitial}; row.swipe_id = 1; native.refresh(); gal.refresh(); });
      assert.equal(await artImage.count(), 0); assert.equal(await page.evaluate(() => galModel.storyCg), null);
      assert.equal(await page.evaluate(() => galModel.background.url), '/normal.webp');
      await page.evaluate(() => { memoryContext.chat[0].swipe_id = 0; memoryContext.chat[0].mes += '修改正文'; native.refresh(); gal.refresh(); });
      assert.equal(await artImage.count(), 0); assert.equal(await page.evaluate(() => galModel.storyCg), null);
      await page.evaluate(body => { memoryContext.chat[0].mes = body; native.refresh(); gal.refresh(); }, F.body);
      assert.equal(await artImage.count(), 1); assert.equal(await page.evaluate(() => galModel.storyCg.url), origin + '/art.webp');
      await page.evaluate(events => { advance(events); memory.openPanel('剧情'); }, [F.event('Good', ['returned'])]);
      await plotCard.getByText('达成结局：物归原主', {exact: true}).waitFor();
      assert.equal(await plotCard.getByRole('button', {name: '继续', exact: true}).count(), 0);
      assert.equal(await plotCard.getByText(/说明损失/).count(), 0);
      await screenshot(page, 'ending', width);
      await dialog.getByRole('button', {name: '关闭', exact: true}).click();
      await page.evaluate(() => { gal.destroy(); native.destroy(); memory.destroy(); });
      assert.equal(await artImage.count(), 0); assert.equal(await page.locator('[data-cxx-memory-panel]').count(), 0);
      assert.equal(await page.evaluate(() => fixture.handlers.size), 0);
      report.checks.push({width, checks: ['read-only browsing', 'track/pause/resume', 'paid gate remains open', 'ending panel', 'native image and focus', 'Gal background and sprites', 'swipe/body-source invalidation', 'teardown']});
      await page.close();

      const terminal = await T.environment(browser, origin, card, width, height);
      report.errors.push(...terminal.errors);
      await terminal.page.addScriptTag({content: code});
      await terminal.page.evaluate(({line, chapter, detection, url}) => {
        line.nodes[1].illustrations[0].url = url;
        line.nodes[3].illustrations = [{id: 'unvisited', file: 'sample/unvisited.webp', url, caption: '未走分支的隐藏插图'}];
        const other = {schema: 1, id: 'album_other', title: '另一条剧情线', summary: '隔离画廊分组样例', track: 'relationship', nodes: [
          {id: 'Only', title: '另一条线的终点', content: '独立隔离正文', conditions: {arrived: '实际到达终点'},
            ending: {id: 'arrived', title: '抵达'}, illustrations: [{id: 'other', file: 'sample/other.webp', url, caption: '另一条线的隐藏插图'}]}]};
        window.CxxPlot = CxxMemoryPlot.create({chapter, quests: [], detection, lines: [line, other]});
        terminal.openPage('media');
      }, {line: F.line, chapter, detection, url: origin + '/art.webp'});
      await terminal.frame.getByRole('group', {name: '影像分类'}).getByRole('button', {name: /剧情插图/}).click();
      const tabs = await terminal.frame.getByRole('group', {name: '影像分类'}).locator('button').evaluateAll(buttons => buttons.map(button => {
        const range = document.createRange(); range.selectNodeContents(button.querySelector('span'));
        const text = range.getBoundingClientRect(), box = button.getBoundingClientRect();
        return {height: box.height, fits: text.left >= box.left && text.right <= box.right, text: button.textContent, width: box.width,
          layout: getComputedStyle(button.parentElement).display, columns: getComputedStyle(button.parentElement).gridTemplateColumns,
          roots: [...document.querySelectorAll('.t2051x')].length};
      }));
      report.tabs ||= []; report.tabs.push({width, tabs});
      assert.equal(tabs.length, 4); assert(tabs.every(tab => tab.height >= 44 && tab.fits), 'album tab labels fit');
      await terminal.frame.getByLabel('剧情插图 01，未解锁', {exact: true}).waitFor();
      await assertTerminalLayout(terminal.frame, width, height);
      assert.equal(await terminal.frame.locator('.story-art-group').count(), 2, 'pictures remain grouped by story line');
      assert.deepEqual(await terminal.frame.locator('.story-art-code').allTextContents(), ['01', '02', '03'], 'locked slot numbers stay global');
      assert.equal(await terminal.frame.getByText(/隐藏插图/).count(), 0, 'locked captions stay hidden');
      assert.equal(await terminal.frame.locator('.event-panel img').count(), 0);
      await terminal.page.evaluate(saved => { c.chat[1].variables[0].stat_data.terminal.quests = structuredClone(saved.terminal.quests); }, unlocked);
      await terminal.frame.evaluate(() => CxxTerminalApp.invalidate({topic: 'quests'}));
      await terminal.frame.getByText('取回包裹', {exact: true}).waitFor();
      await terminal.frame.waitForFunction(() => document.querySelector('.event-panel img')?.naturalWidth > 0);
      const imageShape = await terminal.frame.locator('.story-art-card img').evaluate(img => {
        const box = img.getBoundingClientRect(); return {width: box.width, height: box.height};
      });
      assert(Math.abs(imageShape.width / imageShape.height - 16 / 9) < 0.02, 'story thumbnail remains 16:9');
      assert.deepEqual(await terminal.frame.locator('.story-art-code').allTextContents(), ['02', '03']);
      await screenshot(terminal.page, 'album', width);
      await terminal.frame.getByRole('button', {name: '取回包裹'}).click();
      await terminal.frame.locator('#t2051x-gallery-viewer').waitFor({state: 'visible'});
      await terminal.frame.locator('#t2051x-close-viewer').click();
      assert.equal(await terminal.frame.evaluate(() => document.activeElement.getAttribute('aria-label')), '取回包裹');
      await terminal.page.evaluate(() => { c.chat[1].variables[0].stat_data.terminal.quests = {}; });
      await terminal.frame.evaluate(() => CxxTerminalApp.invalidate({topic: 'quests'}));
      await terminal.frame.getByLabel('剧情插图 01，未解锁', {exact: true}).waitFor();
      assert.equal(await terminal.frame.locator('.story-art-card img').count(), 0, 'an open album follows the saved branch back to locked');
      await terminal.page.evaluate(() => {
        c.chat[1].variables[0].stat_data.terminal.quests = {sample_parcel: {state: '进行中',
          graph: {schema: 1, nodes: {P1: {status: 'complete', since: 0, floor: 0}, P2: {status: 'complete', since: 0, floor: 0}}, unlocked: []}}};
      });
      await terminal.frame.evaluate(() => CxxTerminalApp.invalidate({topic: 'quests'}));
      await terminal.frame.getByRole('button', {name: '取回包裹'}).waitFor();
      assert.equal(await terminal.frame.locator('.story-art-card img').count(), 1, 'an imported legacy graph refreshes an already-open album');
      await terminal.page.evaluate(saved => { c.chat[1].variables[0].stat_data.terminal.quests = structuredClone(saved.terminal.quests); }, unlocked);
      await terminal.frame.evaluate(() => CxxTerminalApp.invalidate({topic: 'quests'}));
      await terminal.frame.getByRole('button', {name: '取回包裹'}).click();
      await terminal.frame.locator('#t2051x-gallery-viewer').waitFor({state: 'visible'});
      assert.equal(await terminal.page.evaluate(() => metrics.writes), 0, 'gallery navigation never writes game state');
      await terminal.page.evaluate(() => terminal.destroy());
      assert.equal(await terminal.page.locator('#cxx-shared-terminal-233').count(), 0, 'destroy removes the open album and viewer frame');
      report.errors.push(...terminal.errors);
      report.checks.push({width, checks: ['grouped global locked slots', 'hidden locked captions', 'live unlock and relock refresh', '16:9 image', 'viewer and focus return', 'read-only browsing', 'destroy with open viewer']});
      await terminal.page.close();
    }
    assert.deepEqual(report.errors, []); report.pass = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    await browser?.close(); await new Promise(r => server.close(r));
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({pass: report.pass, checks: report.checks.length, screens: report.screens.length, failure: report.failure, errors: report.errors}));
  }
}
main();
