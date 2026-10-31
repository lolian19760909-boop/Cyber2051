/** C0：在真实隔离宿主里核对构建身份——扩展文件、内嵌 app、角色卡是不是同一版。 */
import { chromium } from 'playwright';
// 身份核对必须落在“有 2051 正文的聊天”上：空聊天会走人物创建分支，booted 恒为 false，把身份结论带偏。
const DIR = process.argv.find(value => value.startsWith('--dir='))?.slice(6) || 'WEB_HOST_TEST_1792928536359';
const CHAT = process.argv.find(value => value.startsWith('--chat='))?.slice(7) || 'web-controlled-1792928546613';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
const logs = [];
page.on('pageerror', error => errors.push(String(error.message || error)));
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') logs.push(message.type() + ': ' + message.text().slice(0, 300)); });
const report = { resumed: null, host: null, web: null, diagnostics: null, panels: null, errors, logs };
try {
  await page.goto('http://127.0.0.1:22351');
  await page.waitForFunction(() => typeof SillyTavern?.getContext === 'function', null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web') !== null, null, { timeout: 60000 });
  report.resumed = await page.evaluate(async fixture => {
    const context = SillyTavern.getContext();
    await context.getCharacters();
    let index = context.characters.findIndex(row => row.avatar === fixture.dir + '.png');
    if (index < 0) index = context.characters.findIndex(row => /^WEB_HOST_TEST_.*\.png$/.test(row.avatar));
    if (index < 0) return { selected: false };
    await context.selectCharacterById(index);
    const live = SillyTavern.getContext();
    if (live.getCurrentChatId?.() !== fixture.chat) await live.openCharacterChat(fixture.chat);
    await new Promise(resolve => setTimeout(resolve, 800));
    const now = SillyTavern.getContext();
    const character = now.characters[now.characterId];
    return { selected: true, avatar: character.avatar, chatId: fixture.chat, current: now.getCurrentChatId?.() ?? null, messages: now.chat?.length ?? 0 };
  }, { dir: DIR, chat: CHAT });
  await page.waitForFunction(() => { const button = document.querySelector('#cxx2051-open-web'); return !!button && !button.disabled; }, null, { timeout: 90000 });
  report.host = await page.evaluate(async () => {
    const api = globalThis.Cxx2051WebExtension;
    if (!api) return { missing: true };
    const verify = await api.verify();
    const context = SillyTavern.getContext();
    return {
      status: verify.status,
      buildId: verify.buildId,
      engineVersion: verify.engineVersion,
      contentVersion: verify.contentVersion,
      mismatches: verify.mismatches,
      files: (verify.files || []).map(row => ({ path: row.path, ok: row.ok, bytes: row.bytes })),
      app: verify.app && { entry: verify.app.entry && { ok: verify.app.entry.ok, bytes: verify.app.entry.bytes, sha256: verify.app.entry.sha256 }, releaseManifest: verify.app.releaseManifest && { ok: verify.app.releaseManifest.ok, buildId: verify.app.releaseManifest.buildId } },
      card: verify.card && { ok: verify.card.ok, character: verify.card.character, book: verify.card.lens?.book, name: verify.card.lens?.name, version: verify.card.lens?.characterVersion, greetings: verify.card.lens?.greetingSha256?.length, drift: verify.card.drift, lens: verify.card.lens && { spec: verify.card.lens.spec, first: String(verify.card.lens.firstMessageSha256).slice(0, 10), greetings: (verify.card.lens.greetingSha256 || []).map(value => String(value).slice(0, 8)), prompts: (verify.card.lens.promptSha256 || []).map(value => String(value).slice(0, 8)) }, expected: verify.card.expected && { spec: verify.card.expected.spec, first: String(verify.card.expected.firstMessageSha256).slice(0, 10), greetings: (verify.card.expected.greetingSha256 || []).map(value => String(value).slice(0, 8)), prompts: (verify.card.expected.promptSha256 || []).map(value => String(value).slice(0, 8)) } },
      installed: verify.card?.components ?? null,
      avatar: context.characters?.[context.characterId]?.avatar ?? null,
    };
  });
  for (let index = 0; index < 6; index++) {
    await page.evaluate(() => {
      const scopes = [...document.querySelectorAll('dialog[open],.TH-popup')];
      for (const scope of scopes) {
        const buttons = [...scope.querySelectorAll('button,input[type=button]')].filter(node => node.offsetParent !== null);
        const dismiss = buttons.filter(node => /确定|确认|知道了|关闭|好的|OK|继续/i.test(node.textContent || node.value || '')).pop();
        (dismiss || buttons.pop())?.click();
      }
    });
    const nameInput = page.locator('#user_name');
    if (await nameInput.isVisible().catch(() => false)) await nameInput.fill('受控宿主测试', { timeout: 500 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  report.dialogs = await page.evaluate(() => [...document.querySelectorAll('dialog[open],.TH-popup')].map(node => node.innerText.slice(0, 200)));
  report.open = await page.evaluate(async () => {
    try { const extension = await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs'); await extension.openWeb(); return { ok: true }; }
    catch (cause) { return { ok: false, code: cause?.code ?? null, message: String(cause?.message || cause) }; }
  });
  const openedAt = Date.now();
  await page.waitForFunction(() => !!document.getElementById('cxx2051-web-panel'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => {
    const frame = document.getElementById('cxx2051-web-panel')?.querySelector('iframe');
    return !!(frame && frame.contentWindow?.CxxWebApp);
  }, null, { timeout: 90000 }).catch(() => {});
  report.openedMs = Date.now() - openedAt;
  await page.waitForFunction(() => {
    const frame = document.getElementById('cxx2051-web-panel')?.querySelector('iframe');
    return frame?.contentWindow?.CxxWebApp?.read?.()?.booted === true;
  }, null, { timeout: 240000 }).catch(() => {});
  await page.evaluate(() => { const frame = document.getElementById('cxx2051-web-panel')?.querySelector('iframe'); frame?.contentDocument?.getElementById('drawer-btn')?.click(); });
  await page.waitForTimeout(600);
  report.genInfo = await page.evaluate(() => {
    const frame = document.getElementById('cxx2051-web-panel')?.querySelector('iframe');
    const rows = [...(frame?.contentDocument?.querySelectorAll('#gen-info dt') || [])];
    return rows.map(row => [row.textContent, row.nextElementSibling?.textContent]);
  });
  await page.evaluate(() => { const frame = document.getElementById('cxx2051-web-panel')?.querySelector('iframe'); frame?.contentDocument?.getElementById('drawer-close')?.click(); });
  report.web = await page.evaluate(() => {
    const frame = document.getElementById('cxx2051-web-panel')?.querySelector('iframe');
    if (!frame?.contentWindow?.CxxWebApp) return { appMissing: true, html: (frame?.contentDocument?.body?.innerText || '').slice(0, 300) };
    const read = frame.contentWindow.CxxWebApp.read();
    return { mode: read.mode, booted: read.booted, busy: read.busy, phase: read.phase, release: read.release, identity: read.identity, genInfo: [...(frame.contentDocument.querySelectorAll('#gen-info dt') || [])].map(row => [row.textContent, row.nextElementSibling?.textContent || '']) };
  });
  report.diagnostics = await page.evaluate(() => {
    const diag = globalThis.Cxx2051WebHost?.diagnostics?.() ?? null;
    if (!diag) return null;
    return { ready: diag.ready, generationPhase: diag.generationPhase, identity: diag.identity && { status: diag.identity.status, buildId: diag.identity.buildId }, scope: diag.scope ?? null };
  });
  await page.evaluate(() => { document.querySelector('#cxx2051-web-panel > button')?.click(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.getElementById('cxx2051-open-web').click(); });
  await page.waitForTimeout(2500);
  report.panels = await page.evaluate(() => ({ panels: document.querySelectorAll('#cxx2051-web-panel').length, hostPresent: !!globalThis.Cxx2051WebHost }));
  await page.evaluate(() => { document.querySelector('#cxx2051-web-panel > button')?.click(); });
} catch (cause) {
  report.failure = String(cause?.message || cause).slice(0, 600);
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
// 回执落盘：run 完直接写 reports，避免只看 stdout 丢掉当前构建的证据。
await import('node:fs/promises').then(fs => fs.writeFile(new URL('../reports/c0-identity-browser.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'));
