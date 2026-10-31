const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { chromium } = require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const cardFile = process.argv[2] || path.join(root, '.cache/build/东京都2051-V2.3.10.json');
const bytes = fs.readFileSync(cardFile), card = JSON.parse(bytes);
const out = path.join(root, '.cache/debug223/plugin-gate');
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const report = { card: { file: path.basename(cardFile), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }, checks: [], errors: [] };
const mark = m => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's ' + m);
const rowsOf = page => page.evaluate(() => CxxPlugins.read().rows.map(r => ({ id: r.id, kind: r.kind, installed: r.installedVersion || '', runtime: r.runtimeVersion || '', ext: r.extensionName })));
(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await context.newPage();
    p.setDefaultTimeout(45000);
    p.on('pageerror', e => report.errors.push(String(e.message).slice(0, 300)));
    p.on('console', m => { if (m.type() === 'error') report.errors.push('console:' + m.text().slice(0, 200)); });
    await p.route('**/api/backends/**', r => r.abort());
    const boot = () => p.waitForFunction(() => window.SillyTavern && window.TavernHelper && !document.querySelector('#preloader'));
    await p.goto('http://127.0.0.1:6948'); await boot(); mark('booted');
    const token = (await (await p.request.get('http://127.0.0.1:6948/csrf-token')).json()).token;
    const avatar = 'plugin-gate-' + Date.now() + '.png';
    const imported = await p.request.post('http://127.0.0.1:6948/api/characters/import', { headers: { 'X-CSRF-Token': token }, multipart: { file_type: 'json', preserved_name: avatar, avatar: { name: 'plugin-gate.json', mimeType: 'application/json', buffer: bytes } } });
    assert(imported.ok(), 'import failed ' + imported.status()); mark('imported');
    // 选中角色会因插件门槛而挂起等待，故意不 await
    p.evaluate(async ({ avatar, book, name }) => {
        const c = SillyTavern.getContext(), w = await import('/scripts/world-info.js');
        await w.saveWorldInfo(name, w.convertCharacterBook(book), true);
        await c.getCharacters();
        await c.selectCharacterById(c.characters.findIndex(x => x.avatar === avatar));
        window.__selectDone = true;
    }, { avatar, book: card.data.character_book, name: card.data.extensions.world }).catch(e => report.errors.push('select:' + e.message));
    await p.waitForSelector('#preloader', { state: 'detached' }).catch(() => { });
    // 酒馆的自带确认框（如“角色含有内置正则”）必须先点掉，卡内脚本才会启动
    let gateSeen = false;
    for (let i = 0; i < 90; i++) {
        const s = await p.evaluate(() => {
            const ok = [...document.querySelectorAll('.popup .popup-button-ok, #dialogs .popup-button-ok')].filter(b => b.getClientRects().length);
            ok.forEach(b => b.click());
            const ann = document.querySelector('.cxx-announcement');
            if (ann) ann.querySelector('button')?.click();
            return { gate: !!document.querySelector('.cxx-plugin-dialog[open]'), popped: ok.length };
        });
        if (s.gate) { gateSeen = true; break; }
        await p.waitForTimeout(1000);
    }
    assert(gateSeen, '插件门槛没有出现');
    mark('gate-visible');
    await p.waitForFunction(() => !!window.CxxPlugins, null, { timeout: 60000 });
    report.suiteManifestBefore = (await (await p.request.get('http://127.0.0.1:6948/scripts/extensions/third-party/SillyTavern-Runtime-Suite/manifest.json')).json()).version;
    report.suiteRuntimeBefore = await p.evaluate(() => window.TavernRuntimeSuite?.version || null);
    report.rowsBefore = await rowsOf(p);
    assert.equal(report.suiteManifestBefore, '0.2.0');
    assert(report.rowsBefore.some(r => r.id === 'suite' && r.kind === 'outdated'), 'fixture must start outdated: ' + JSON.stringify(report.rowsBefore));
    assert.equal(await p.evaluate(() => CxxPlugins.startupReady()), true, '旧版 Suite 不应阻断进入');
    report.gate = {
        primary: (await p.locator('.cxx-plugin-primary').innerText()).trim(),
        primaryDisabled: await p.locator('.cxx-plugin-primary').isDisabled(),
        status: (await p.locator('.cxx-plugin-check > [role=status]').innerText()).trim(),
        notice: (await p.locator('.cxx-plugin-check > .cxx-plugin-notice').innerText()).trim(),
        gateReloadVisible: await p.locator('.cxx-plugin-bar.cxx-plugin-gate button', { hasText: '刷新' }).isVisible(),
        back: (await p.locator('.cxx-plugin-dialog > button').last().innerText()).trim(),
    };
    await p.screenshot({ path: path.join(out, '1-gate-suite-outdated.png') });
    mark('gate=' + JSON.stringify(report.gate));
    assert.equal(report.gate.primaryDisabled, false, '进入按钮必须可用');
    assert.match(report.gate.primary, /进入游戏/);
    assert.match(report.gate.back, /退出本卡/);
    report.checks.push('旧版 Suite 不再硬拦：门槛面板的进入按钮可用，返回按钮文案为“退出本卡（回到酒馆）”');
    await p.locator('.cxx-plugin-primary').click(); mark('clicked-enter');
    await p.waitForFunction(() => window.__selectDone === true, null, { timeout: 180000 }); mark('entered');
    assert.equal(await p.locator('.cxx-plugin-dialog[open]').count(), 0, '进入后门槛应关闭');
    report.checks.push('点“进入游戏（Suite待处理）”真的能进：整条开局流程不再被插件门槛挂起');
    await p.evaluate(() => { window.__gate2 = CxxPlugins.ensureStartup(); });
    await p.locator('.cxx-plugin-dialog[open]').waitFor({ state: 'visible' }); mark('gate-reopened');

    await p.locator('.cxx-plugin-check article[data-plugin=suite] button', { hasText: '更新' }).click(); mark('clicked-update');
    await p.waitForFunction(() => CxxPlugins.read().installation.needReload === true || !!CxxPlugins.read().installation.error, null, { timeout: 120000 });
    report.afterUpdate = {
        error: await p.evaluate(() => CxxPlugins.read().installation.error),
        notice: (await p.locator('.cxx-plugin-check > .cxx-plugin-notice').innerText()).trim(),
        status: (await p.locator('.cxx-plugin-check > [role=status]').innerText()).trim(),
        stage: await p.evaluate(() => CxxPlugins.read().installation.results.map(r => r.stage)),
        gatePrimary: (await p.locator('.cxx-plugin-primary').innerText()).trim(),
        gatePrimaryDisabled: await p.locator('.cxx-plugin-primary').isDisabled(),
        panelReloadVisible: await p.locator('.cxx-plugin-bar:not(.cxx-plugin-gate) button', { hasText: '刷新页面以加载' }).isVisible(),
        suiteManifestOnDisk: (await (await p.request.get('http://127.0.0.1:6948/scripts/extensions/third-party/SillyTavern-Runtime-Suite/manifest.json')).json()).version,
    };
    await p.screenshot({ path: path.join(out, '2-updated-awaiting-reload.png') });
    mark('update=' + JSON.stringify(report.afterUpdate));
    assert.equal(report.afterUpdate.error, '', '更新不应失败:' + report.afterUpdate.error);
    assert.equal(report.afterUpdate.suiteManifestOnDisk, '0.3.4', 'git pull 必须把 0.3.4 落到磁盘');
    assert.deepEqual(report.afterUpdate.stage, ['downloaded']);
    assert.equal(report.afterUpdate.panelReloadVisible, true);
    assert.match(report.afterUpdate.gatePrimary, /刷新页面后进入/);
    report.checks.push('卡内“更新”真的把扩展拉到 0.3.4（磁盘 manifest 已变），并给出刷新入口与“刷新页面后进入”');

    await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.locator('.cxx-plugin-bar:not(.cxx-plugin-gate) button', { hasText: '刷新页面以加载' }).click()]);
    mark('reloaded'); await boot();
    // 刷新后酒馆不一定自动续开上次对话，重新选一次角色，并持续点掉酒馆自带确认框
    p.evaluate(async ({ avatar }) => {
        const c = SillyTavern.getContext();
        await c.getCharacters();
        await c.selectCharacterById(c.characters.findIndex(x => x.avatar === avatar));
        window.__selectDone2 = true;
    }, { avatar }).catch(e => report.errors.push('reselect:' + e.message));
    let pluginSeen = false;
    for (let i = 0; i < 60; i++) {
        const s = await p.evaluate(() => {
            const ok = [...document.querySelectorAll('.popup .popup-button-ok, #dialogs .popup-button-ok')].filter(b => b.getClientRects().length);
            ok.forEach(b => b.click());
            const ann = document.querySelector('.cxx-announcement');
            if (ann) ann.querySelector('button')?.click();
            return { plugins: !!window.CxxPlugins };
        });
        if (s.plugins) { pluginSeen = true; break; }
        await p.waitForTimeout(1000);
    }
    assert(pluginSeen, '刷新后卡内脚本未启动');
    await p.waitForTimeout(4000);
    await p.evaluate(() => CxxPlugins.check());
    report.suiteRuntimeAfter = await p.evaluate(() => window.TavernRuntimeSuite?.version || null);
    report.rowsAfter = await rowsOf(p);
    report.dialogAfterReload = await p.locator('.cxx-plugin-dialog[open]').count();
    report.readyAfter = await p.evaluate(() => CxxPlugins.startupReady());
    await p.screenshot({ path: path.join(out, '3-after-reload.png') });
    mark('after=' + JSON.stringify({ runtime: report.suiteRuntimeAfter, dialog: report.dialogAfterReload, ready: report.readyAfter }));
    assert.equal(report.suiteRuntimeAfter, '0.3.4');
    assert(report.rowsAfter.some(r => r.id === 'suite' && r.kind === 'ready'), '刷新后 suite 应为 ready: ' + JSON.stringify(report.rowsAfter));
    assert.equal(report.dialogAfterReload, 0, '就绪后不应再出现门槛');
    report.checks.push('刷新后 Suite 0.3.4 运行时就绪，门槛不再出现');

    await browser.close();
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    mark('PASS');
    console.log(JSON.stringify(report, null, 2));
})().catch(error => {
    report.failure = error.stack;
    fs.writeFileSync(path.join(out, 'report-failure.json'), JSON.stringify(report, null, 2));
    console.error('FAIL', error.message);
    process.exitCode = 1;
});
