// 卡线 UI 闪烁回归（A 类）：退场完成即提交隐藏，旧画面不得在新页之上复显。
// 只读工程文件，不改任何产物；用真实 Edge 跑真实 Web Animations。
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 4319;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const server = spawn(process.execPath, [resolve(WEB_ROOT, 'tools/serve.mjs'), '--port', String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
const stopServer = () => server.kill();
await new Promise((done, fail) => {
  const timer = setTimeout(() => fail(new Error('本地服务器启动超时')), 15000);
  server.stdout.on('data', (chunk) => {
    if (String(chunk).includes('http://127.0.0.1')) {
      clearTimeout(timer);
      setTimeout(done, 300);
    }
  });
  server.stderr.on('data', (chunk) => process.stderr.write(`[serve] ${chunk}`));
});

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EDGE });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error).split('\n').slice(0, 3).join(' | ')));

  await page.goto(`http://127.0.0.1:${PORT}/web/fixtures/motion.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
  check('motion 运行时装载', true);

  // ---- 1. navigate：旧页的隐藏发生在它自己的退场结束，而不是整段过渡结束 ----
  const navigate = await page.evaluate(async () => {
    const motion = window.__motion;
    const a = document.getElementById('pageA');
    const b = document.getElementById('pageB');
    const samples = [];
    const t0 = performance.now();
    const done = motion.navigate(a, b);
    samples.push({ t: 0, aHidden: a.hidden, bHidden: b.hidden, active: motion.diagnostics().active });
    let settledAt = null;
    const timer = setInterval(() => {
      samples.push({ t: Math.round(performance.now() - t0), aHidden: a.hidden, bHidden: b.hidden });
    }, 8);
    const status = await done;
    clearInterval(timer);
    settledAt = Math.round(performance.now() - t0);
    return { samples, status, settledAt, diagnostics: motion.diagnostics() };
  });

  check('navigate 进入了真实过渡（非 instant）', navigate.samples[0].active > 0, `active=${navigate.samples[0].active}`);
  const firstHidden = navigate.samples.find((s) => s.aHidden);
  check(
    '旧页在退场结束后就隐藏，而不是等整段过渡结束',
    Boolean(firstHidden) && firstHidden.t < navigate.settledAt - 8,
    `firstHidden t=${firstHidden?.t ?? 'never'}ms / 过渡结束 ${navigate.settledAt}ms`,
  );
  const reappeared = (() => {
    let seen = false;
    for (const s of navigate.samples) {
      if (s.aHidden) seen = true;
      else if (seen) return s.t;
    }
    return null;
  })();
  check('旧页隐藏后没有再次复显', reappeared === null, reappeared === null ? '无复显采样' : `在 ${reappeared}ms 复显`);
  check('过渡完成后新页可见、旧页隐藏', navigate.samples.at(-1).bHidden === false && navigate.samples.at(-1).aHidden === true);

  // ---- 2. update：旧副本（ghost）退场结束后必须立刻收起 ----
  const update = await page.evaluate(async () => {
    const motion = window.__motion;
    const upd = document.getElementById('upd');
    const host = upd.parentElement;
    const findGhost = () => [...host.children].find((node) => node !== upd && node.hasAttribute?.('aria-hidden'));
    const samples = [];
    const t0 = performance.now();
    const done = motion.update(upd, () => {
      upd.textContent = '新文本：已经被替换';
    });
    samples.push({ t: 0, ghost: Boolean(findGhost()), active: motion.diagnostics().active });
    const timer = setInterval(() => {
      const ghost = findGhost();
      samples.push({
        t: Math.round(performance.now() - t0),
        ghost: Boolean(ghost),
        ghostHidden: !ghost || ghost.style.display === 'none',
        text: upd.textContent,
      });
    }, 8);
    const status = await done;
    clearInterval(timer);
    const ghostAfter = Boolean(findGhost());
    return { samples, status, ghostAfter, settledAt: Math.round(performance.now() - t0) };
  });

  check('update 进入了真实过渡（非 instant）', update.samples[0].active > 0, `active=${update.samples[0].active}`);
  check('update 产生了旧副本并最终被清理', update.samples.some((s) => s.ghost) && update.ghostAfter === false, `ghostSeen=${update.samples.some((s) => s.ghost)} ghostAfter=${update.ghostAfter}`);
  const ghostRetired = update.samples.find((s) => s.ghostHidden);
  check(
    '旧副本在退场结束后就收起',
    Boolean(ghostRetired) && ghostRetired.t < update.settledAt - 8,
    `firstHidden t=${ghostRetired?.t ?? 'never'}ms / 过渡结束 ${update.settledAt}ms`,
  );
  check('update 后容器显示新内容', update.samples.at(-1).text === '新文本：已经被替换', update.samples.at(-1).text);
  check('无控制台错误', errors.length === 0, errors.slice(0, 3).join(' ／ '));

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n== 闪烁回归：${passed}/${results.length} 通过 ==`);
  process.exitCode = passed === results.length ? 0 : 1;
} catch (error) {
  console.log(`检查崩溃： ${error?.message || error}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  stopServer();
}
