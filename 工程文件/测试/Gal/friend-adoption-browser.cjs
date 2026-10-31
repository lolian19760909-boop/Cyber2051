'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.CXX_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../../独立制卡器/workbench/node_modules/playwright'));
const root = path.resolve(__dirname, '../../..');
const maintained = true;
const suffix = maintained ? 'maintained' : 'friend';
const evidenceDir = path.resolve(process.env.CXX_EVIDENCE || path.join(root, '工程文件/.cache/friend-adoption-browser'));
fs.mkdirSync(evidenceDir, {recursive: true});
const out = path.join(evidenceDir, 'browser-' + suffix + '.json');
const uiPath = maintained ? path.join(root, '工程文件/卡片源码/Gal/ui.js') : path.join(__dirname, 'CxxGalUI.js');
const landscapePath = maintained ? path.join(root, '工程文件/卡片源码/Gal/landscape.js') : path.join(__dirname, 'CxxGalLandscape.js');
const cssPath = maintained ? path.join(root, '工程文件/卡片源码/Gal/style.css') : path.join(__dirname, 'friend-gal.css');
const cssSource = (maintained ? fs.readFileSync(path.join(root, '工程文件/卡片源码/主题/tokens.css'), 'utf8') + '\n' : '') + fs.readFileSync(cssPath, 'utf8');
const sourceHash = file => require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const waitLayout = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true, args: ['--no-proxy-server']});
  const evidence = {scope: 'Actual maintained source in isolated synthetic browser documents; no real host, player data, network or model calls.', maintained, sources: [uiPath, landscapePath, cssPath, path.join(root, '工程文件/卡片源码/主题/tokens.css')].map(file => ({file, sha256: sourceHash(file)})), browser: browser.version(), checks: [], requestsBlocked: []};
  try {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
    await context.route('**/*', route => { evidence.requestsBlocked.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function setup({mobile = false, width = 1280, height = 900, asyncHistory = false} = {}) {
      await page.setViewportSize({width, height});
      await page.setContent('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body></body></html>');
      await page.addStyleTag({content: cssSource});
      await page.evaluate(mobile => { window.Cxx236Preferences = {read: () => ({device: mobile ? 'mobile' : 'desktop'})}; }, mobile);
      await page.addScriptTag({path: landscapePath});
      await page.addScriptTag({path: uiPath});
      await page.evaluate(({asyncHistory}) => {
        window.calls = {choices: [], messages: [], drafts: [], selectEvents: []};
        window.model = {
          opening: false, messages: [1, 2, 3].map(n => ({id: String(n), label: (n + 3) + ' · 旁白', excerpt: '楼层 ' + n + ' 的首段。'})),
          selectedId: '3', selectedFloor: 6, paragraphs: [{speaker: '祥子', text: '当前正文第一段。'}, {speaker: '祥子', text: '当前正文最后一段。'}],
          paragraphIndex: 1, choices: ['调查终端', '询问祥子', '前往楼顶', '检查装备', '稍作休息'], scene: {location: '测试机房', date: '2051-01-01', time: '12:00'},
          hud: {scope: '合成楼层', fields: [], details: [{label: '委托', items: [{label: '目标', value: '合成内容'}]}]}, sprites: [], draft: '', busy: false, history: false
        };
        window.view = CxxGalUI.mount({document, parent: document.body,
          onSelectMessage(id) {
            calls.messages.push(id);
            const update = () => {
              model = {...model, selectedId: String(id), history: String(id) !== '3', paragraphs: [{speaker: '祥子', text: '合成楼层 ' + id + ' 的正文。'}], paragraphIndex: 0};
              view.render(model);
            };
            if (asyncHistory) queueMicrotask(update); else update();
          },
          onSelectParagraph(index) {model = {...model, paragraphIndex: index}; view.render(model);},
          onChoice(text) {calls.choices.push(text);},
          onDraft(text) {calls.drafts.push(text); model.draft = text;},
          onClose() {}, onTerminal() {}, onStatus() {}, onPlayer() {}, onWorkshop() {}
        });
        view.render(model);
        const root = document.getElementById('cxx-galgame-root');
        root.addEventListener('click', e => {if (e.target.matches('.cxx-gal-history-row')) calls.selectEvents.push({connected: e.target.isConnected, contained: document.getElementById('cxx-gal-history-panel').contains(e.target), pathIncludesHistory: e.composedPath().includes(document.getElementById('cxx-gal-history-panel')), hidden: document.getElementById('cxx-gal-history-panel').hidden});});
      }, {asyncHistory});
      await waitLayout(page);
    }
    async function record(id, expected, actual, extra = {}) {evidence.checks.push({id, expected, actual, pass: JSON.stringify(expected) === JSON.stringify(actual), ...extra});}
    await setup();
    await page.locator('.cxx-gal-history-button').click();
    await page.locator('.cxx-gal-history-row[data-message="1"]').click();
    await record('history-row-sync-keeps-panel', false, await page.locator('#cxx-gal-history-panel').evaluate(n => n.hidden), {details: await page.evaluate(() => calls.selectEvents)});
    await page.screenshot({path: path.join(evidenceDir, 'history-sync-' + suffix + '.png')});
    await setup({asyncHistory: true});
    await page.locator('.cxx-gal-history-button').click();
    await page.locator('.cxx-gal-history-row[data-message="1"]').click();
    await record('history-row-async-keeps-panel', false, await page.locator('#cxx-gal-history-panel').evaluate(n => n.hidden));
    if (await page.locator('#cxx-gal-history-panel').evaluate(n => n.hidden)) await page.locator('.cxx-gal-history-button').click();
    await page.locator('.cxx-gal-history-row[data-message="1"]').focus();
    await page.keyboard.press('1');
    await record('history-does-not-pick-choice', [], await page.evaluate(() => calls.choices));
    await page.locator('.cxx-gal-history-resume').click();
    await record('history-resume-selects-latest', '3', await page.evaluate(() => model.selectedId));
    await setup();
    await page.locator('.cxx-gal-dialogue:not(.cxx-gal-dialogue-probe)').focus();
    await page.keyboard.press('1');
    await record('normal-number-key-picks-choice', ['调查终端'], await page.evaluate(() => calls.choices));
    await page.evaluate(() => {calls.choices = []; view.focusInput();});
    await page.keyboard.type('12345');
    await record('draft-number-input-keeps-text', {draft: '12345', choices: []}, await page.evaluate(() => ({draft: document.getElementById('cxx-gal-draft').value, choices: calls.choices})));
    await setup();
    await page.evaluate(() => {document.getElementById('cxx-gal-audio-panel').parentElement.open = true;});
    await page.getByRole('button', {name: '阅读字号', exact: true}).click();
    await page.locator('.cxx-gal-font-panel button').first().focus();
    await page.keyboard.press('2');
    await record('font-dialog-number-does-not-pick-choice', [], await page.evaluate(() => calls.choices));
    await page.screenshot({path: path.join(evidenceDir, 'font-key-' + suffix + '.png')});
    await setup();
    await page.locator('.cxx-gal-stats-toggle').click();
    await page.getByRole('button', {name: '详情', exact: true}).click();
    await page.locator('.cxx-gal-hud-detail button').focus();
    await page.keyboard.press('3');
    await record('hud-dialog-number-does-not-pick-choice', [], await page.evaluate(() => calls.choices));
    await setup();
    await page.evaluate(() => {view.renderStream({paragraphs: model.paragraphs, paragraphIndex: 1, busy: true, canStop: true, status: '合成流式生成中'});});
    await record('stream-hides-choices', true, await page.locator('.cxx-gal-choices').evaluate(n => n.hidden));
    await page.evaluate(() => {view.render({...model, busy: false});});
    await record('stream-end-restores-same-choices', {hidden: false, count: 5, disabled: false}, await page.locator('.cxx-gal-choices').evaluate(n => ({hidden: n.hidden, count: n.querySelectorAll('button').length, disabled: [...n.querySelectorAll('button')].some(b => b.disabled)})));
    for (const dimensions of [[390, 844], [320, 640], [844, 390]]) {
      await setup({mobile: true, width: dimensions[0], height: dimensions[1]});
      await page.evaluate(() => view.focusInput());
      await waitLayout(page);
      const actual = await page.evaluate(() => {
        const rect = selector => {const n = document.querySelector(selector), r = n.getBoundingClientRect(); return {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, hidden: n.hidden};};
        const viewport = rect('#cxx-galgame-root'), draft = rect('.cxx-gal-composer'), nav = rect('.cxx-gal-navigator'), choices = rect('.cxx-gal-choices');
        return {viewport, draft, nav, choices, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, readableDraft: draft.top >= 0 && draft.bottom <= viewport.bottom + 1, readableNav: nav.top >= 0 && nav.bottom <= viewport.bottom + 1};
      });
      await record('mobile-composer-' + dimensions.join('x'), {horizontalOverflow: false, readableDraft: true, readableNav: true}, {horizontalOverflow: actual.horizontalOverflow, readableDraft: actual.readableDraft, readableNav: actual.readableNav}, {geometry: actual});
      await page.screenshot({path: path.join(evidenceDir, 'mobile-' + dimensions.join('x') + '-' + suffix + '.png')});
    }
    await setup({mobile: true, width: 390, height: 844});
    await page.evaluate(() => {view.focusInput(); Object.defineProperty(window.visualViewport, 'height', {configurable: true, get: () => 440}); window.visualViewport.dispatchEvent(new Event('resize'));});
    await waitLayout(page);
    const keyboard = await page.evaluate(() => {const root = document.getElementById('cxx-galgame-root'), draft = document.getElementById('cxx-gal-draft').getBoundingClientRect(), nav = document.querySelector('.cxx-gal-navigator').getBoundingClientRect(); return {keyboard: root.dataset.keyboard, rootHeight: root.clientHeight, draftVisible: draft.top >= 0 && draft.bottom <= 440, navVisible: nav.top >= 0 && nav.bottom <= 440, draftRect: draft.toJSON(), navRect: nav.toJSON()};});
    await record('mobile-visual-viewport-keyboard', {keyboard: '1', rootHeight: 440, draftVisible: true, navVisible: true}, {keyboard: keyboard.keyboard, rootHeight: keyboard.rootHeight, draftVisible: keyboard.draftVisible, navVisible: keyboard.navVisible}, {geometry: keyboard, scope: 'Synthetic visualViewport contraction; not a physical keyboard or mobile-host acceptance'});
    await page.screenshot({path: path.join(evidenceDir, 'mobile-keyboard-' + suffix + '.png')});
    await page.evaluate(() => {delete window.visualViewport.height;});
    await page.setViewportSize({width: 900, height: 750});
    await page.setContent('<!doctype html><html><body><textarea id="send_textarea">已有草稿</textarea><iframe id="native-options" data-cxx-ready="1" style="width:500px;height:550px"></iframe></body></html>');
    const nativeOptions = fs.readFileSync(path.join(root, '工程文件/卡片源码/MVU/templates/options.html'), 'utf8').replace(/<script type="text\/template" id="options-data">[\s\S]*?<\/script>/, '<script>window.Cxx236InitialValue="1. 调查终端\\n2. 询问祥子";</script><script type="text/template" id="options-data"></script>');
    await page.locator('#native-options').evaluate((frame, html) => {frame.srcdoc = html;}, nativeOptions);
    const native = page.frameLocator('#native-options');
    await native.locator('.option-btn').first().waitFor({state: 'attached'});
    await native.locator('#optionsCard').evaluate(n => {n.open = true;});
    await native.locator('.option-btn').first().click();
    await record('native-option-has-key-and-appends-draft', {count: 2, key: '1', draft: '已有草稿\n调查终端'}, {count: await native.locator('.option-btn').count(), key: await native.locator('.option-key').first().textContent(), draft: await page.locator('#send_textarea').inputValue()});
    const F = require('../剧情/fixtures.cjs'), fixture = structuredClone(F.line), raw = F.body;
    fixture.nodes[1].illustrations[0].url = 'https://cyber2051.top/synthetic/one.webp';
    fixture.nodes[1].illustrations.push({id: 'parcel-second', file: 'sample/second.webp', url: 'https://cyber2051.top/synthetic/two.webp', caption: '同楼第二幅插图', trigger: 'complete'});
    let storyHash = 2166136261; for (const ch of raw.trim()) storyHash = Math.imul(storyHash ^ ch.charCodeAt(0), 16777619);
    const source = {floor: 0, swipe: 0, story: (storyHash >>> 0).toString(16)}, initial = F.state();
    const plot = require('../../卡片源码/长期记忆/plot.js').create({chapters: [], quests: [], detection: {}, lines: [fixture]});
    initial.terminal.quests = plot.openings(initial, source);
    for (const event of [F.event('P1', ['agreed']), F.event('P2', ['found', 'recovered'])]) initial.terminal.quests[fixture.id] = plot.advance(initial, fixture.id, [event], {source, storyText: raw});
    const nativeSources = ['共享/data-clone.js', '剧情/line-model.js', '剧情/line-engine.js', '剧情/chapter-engine.js', '剧情/graph-compat.js', '长期记忆/plot.js', '长期记忆/startup.js', '原生/host.js', 'Gal/sprites.js', 'Gal/controller.js'];
    for (const width of [1280, 390]) {
      await page.setViewportSize({width, height: 844});
      await page.setContent('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body><div id="chat"><div class="mes" mesid="0"><div class="mes_text"></div></div></div></body></html>');
      await page.addStyleTag({content: cssSource});
      for (const relative of nativeSources) {
        const file = path.join(root, '工程文件/卡片源码', relative);
        await page.addScriptTag({path: file});
        if (!evidence.sources.some(s => s.file === file)) evidence.sources.push({file, sha256: sourceHash(file)});
      }
      await page.evaluate(async ({fixture, initial, raw, nativeCss}) => {
        window.artLeases = {acquired: 0, released: 0};
        const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#182b3a"/><text x="180" y="480" fill="white" font-size="90">SYNTHETIC STORY CG</text></svg>');
        window.CxxResources = {acquire: async () => {artLeases.acquired++; return {url: svg, release() {artLeases.released++;}};}};
        window.artRaw = raw;
        window.artContext = {characters: [{avatar: 'synthetic.png'}], characterId: 0, groupId: null, getCurrentChatId: () => 'synthetic-chat', chat: [{name: '祥子', mes: raw, swipe_id: 0, is_user: false, variables: [{stat_data: initial}]}]};
        window.Cxx233Runtime = {parser: {}};
        const memory = {destroy() {}, state: () => ({story: true, plots: true}), story: value => value, start() {return this;}};
        const api = {SillyTavern: {getContext: () => artContext}, waitGlobalInitialized: async () => {}, addEventListener: (...a) => window.addEventListener(...a), removeEventListener: (...a) => window.removeEventListener(...a), eventOn() {}, eventRemoveListener() {}, getButtonEvent: value => value, CxxLongMemoryAdapter: {create: () => memory}, CxxMemoryPlot, CxxMemoryPanel: {create: () => ({open() {}, destroy() {}})}};
        window.artMemory = await CxxLongMemoryStartup.install({host: window, api, bundle: {}, chapters: [], quests: [], detection: {}, lines: [fixture]});
        window.nativeArt = CxxNativeHost.mount({window, context: () => artContext, subscribe: () => () => {}, messageFeed: () => () => {}, prose: {mount(node) {node.textContent = '祥子：插图与来源校验的合成原生正文。'; return {refresh() {}, destroy() {}};}}, terminalFactory: {create: () => ({close() {}, destroy() {}})}, css: nativeCss, notify: text => {throw Error(text);}});
      }, {fixture, initial, raw, nativeCss: fs.readFileSync(path.join(root, '工程文件/卡片源码/主题/tokens.css'), 'utf8') + '\n' + fs.readFileSync(path.join(root, '工程文件/卡片源码/原生/prose.css'), 'utf8')});
      await page.locator('.cxx-story-figure[data-ready="1"]').first().waitFor();
      await page.locator('.cxx-story-figure[data-ready="1"]').nth(1).waitFor();
      await record('native-source-multi-art-' + width, 2, await page.locator('.cxx-story-figure').count());
      await page.screenshot({path: path.join(evidenceDir, 'native-story-figure-' + width + '.png')});
      await page.locator('.cxx-story-figure-open').first().click();
      await record('native-viewer-opens-' + width, true, await page.locator('dialog.cxx-story-viewer').evaluate(n => n.open));
      await page.screenshot({path: path.join(evidenceDir, 'native-story-viewer-' + width + '.png')});
      await page.keyboard.press('Escape');
      await record('native-viewer-focus-returns-' + width, true, await page.evaluate(() => document.activeElement.classList.contains('cxx-story-figure-open')));
      await page.evaluate(() => {artContext.chat[0].variables[1] = {stat_data: {terminal: {quests: {}}}}; artContext.chat[0].swipe_id = 1; nativeArt.refresh();});
      await record('native-swipe-hides-and-releases-' + width, {count: 0, released: 2}, {count: await page.locator('.cxx-story-figure').count(), released: await page.evaluate(() => artLeases.released)});
      await page.evaluate(() => {artContext.chat[0].swipe_id = 0; artContext.chat[0].mes += '修订'; nativeArt.refresh();});
      await record('native-edited-source-stays-hidden-' + width, 0, await page.locator('.cxx-story-figure').count());
      await page.evaluate(() => {artContext.chat[0].mes = artRaw; nativeArt.refresh();});
      await page.locator('.cxx-story-figure[data-ready="1"]').first().waitFor();
      await page.locator('.cxx-story-figure-open').first().click();
      await page.evaluate(() => nativeArt.destroy());
      await record('native-unmount-closes-viewer-and-releases-' + width, {count: 0, dialogs: 0, released: 4}, {count: await page.locator('.cxx-story-figure').count(), dialogs: await page.locator('dialog.cxx-story-viewer').count(), released: await page.evaluate(() => artLeases.released)});
      await page.addScriptTag({path: landscapePath});
      await page.addScriptTag({path: uiPath});
      await page.evaluate(() => {
        const adapter = {read: () => ({key: 'synthetic', messages: artContext.chat, draft: '', busy: false}), subscribe: () => () => {}, cover() {}, focusNative() {}, notify: text => {throw Error(text);}, background: () => null};
        window.artGal = CxxGalController.create({adapter, parser: {parseMessage: text => ({paragraphs: [{speaker: '祥子', text}], warnings: [], choices: [], scene: null})}, mount: callbacks => CxxGalUI.mount({document, ...callbacks})});
        artGal.open();
      });
      await page.locator('.cxx-gal-story-cg').waitFor();
      await record('gal-story-cg-uses-source-bound-last-picture-' + width, '同楼第二幅插图', await page.locator('.cxx-gal-story-cg').getAttribute('alt'));
      await page.evaluate(() => {artContext.chat[0].mes += '修订'; artGal.refresh();});
      await record('gal-story-cg-removes-stale-source-' + width, 0, await page.locator('.cxx-gal-story-cg').count());
      await page.evaluate(() => {artGal.destroy(); artMemory.destroy();});
      await record('gal-native-teardown-' + width, {roots: 0, leasesBalanced: true}, await page.evaluate(() => ({roots: document.querySelectorAll('#cxx-galgame-root,.cxx-story-viewer,.cxx-story-figure').length, leasesBalanced: artLeases.acquired === artLeases.released})));
    }
    evidence.pageErrors = errors;
    evidence.counts = {total: evidence.checks.length, passed: evidence.checks.filter(c => c.pass).length, failed: evidence.checks.filter(c => !c.pass).length};
    console.log(JSON.stringify({out, ...evidence.counts, failures: evidence.checks.filter(c => !c.pass), pageErrors: errors}, null, 2));
    if (evidence.counts.failed || errors.length) process.exitCode = 1;
  } finally {fs.writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n'); await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
