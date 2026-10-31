/**
 * P2 验收：真实浏览器里把「本地独立」跑一遍完整闭环。
 *
 * 检查的是产品界面本身（web/index.html + app.mjs），不是夹具：
 *   装载卡内 35 个 UMD → 装配预设提示 → 上游 SSE（本脚本伪造为固定响应）
 *   → 解析正文/选项/状态 → 校验 → 真实 IndexedDB 提交 → 刷新后续接、重抽、检查点。
 *
 * 浏览器固定用系统 Edge（本机 playwright 自带 chromium 缺失，见进度.md 工具链记录）。
 * 用法：node tools/p2-browser-check.mjs
 */

import fs from 'node:fs';
import { chromium } from 'playwright';
import { createLocalServer } from './serve.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const REPLY = [
  '<cxx-story>',
  '霓虹在雨幕里散成一片红。她撑着伞停在涩谷的路口，肩上是被雨打湿的制服。',
  '<cxx-say speaker="丰川祥子" expression="smile">「你终于来了。今晚的委托，只有你能接。」</cxx-say>',
  '</cxx-story>',
  '<ztl>{"location":"涩谷·中央街","time":"夜","characters":[{"name":"丰川祥子","outfit":"制服","thought":"先把他拖进来再说"}]}</ztl>',
  '<xuan>',
  '1. 接过她递来的委托卡',
  '2. 问她为什么偏偏找上自己',
  '3. 先退到屋檐下避开雨',
  '4. 打量她身后的黑色轿车',
  '5. 直接掉头走开',
  '</xuan>',
  '<UpdateVariable>[{"op":"replace","path":"/terminal/wallet/yen","value":1200},{"op":"replace","path":"/terminal/wallet/earned","value":1200}]</UpdateVariable>',
].join('\n');

const app = createLocalServer();

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const port = app.address().port;
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true, executablePath: EDGE });
  const context = await browser.newContext({ viewport: { width: 900, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.stack || error.message).split('\n').slice(0, 3).join(' | ')));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });

  let upstreamCalls = 0, selectionCalls = 0;
  const selectionFrame = `data: ${JSON.stringify({ choices: [{ delta: { content: '{"uids":[],"reason":"夹具不选任何条目"}' } }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`;
  const answer = async (route) => {
    if (String(route.request().postData() || '').includes('目录挑选助手')) {
      selectionCalls += 1;
      if (process.env.P2_TRACE) { try { const body = JSON.parse(route.request().postData() || '{}'); const row = JSON.parse(body?.body?.messages?.[1]?.content || '{}'); console.log('SEL', row.stage, Array.isArray(row.items) ? row.items.length : -1, String(row.items?.[0]?.uid || '')); } catch (error) { console.log('SEL parse', String(error.message)); } }
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: selectionFrame });
      return;
    }
    upstreamCalls += 1;
    const frames = REPLY.match(/[\s\S]{1,40}/g) || [];
    const body = frames.map((piece) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body });
  };
  // 本地模式走网页自己的 /api/play/connect 代理；直连上游的路径也一起接住。
  await page.route('**/api/play/connect', answer);
  await page.route('https://upstream.test/**', answer);

  await page.goto(`${base}/?mode=local&adapter=openai-chat&baseUrl=https://upstream.test/v1/chat/completions&model=test-model`, { waitUntil: 'domcontentloaded' });

  // 本地模式开局先走原六步人物创建（与 p3a 同一真实交互），再进入游戏界面。
  await page.locator('.cxx-opening-flow').waitFor();
  const next = async (step) => {
    await page.locator('.opening-next').click();
    if (step) await page.locator(`.cxx-opening-flow[data-step="${step}"]`).waitFor();
  };
  await next('origin'); await next('profile');
  await page.getByLabel('姓名', { exact: true }).fill('P2 闭环');
  await next('growth'); await next('loadout'); await next('scenario');
  await page.getByRole('button', { name: /街头/ }).last().click();
  await next('review'); await next();
  await page.waitForFunction(() => CxxWebApp.read().booted && CxxWebApp.ui, null, { timeout: 45000 });
  check('六步创建后进入游戏界面', true);

  const readDb = () => page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('cxx2051-web');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const read = (store) => new Promise((res) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
    });
    const [runs, nodes, states, receipts] = await Promise.all([read('runs'), read('nodes'), read('states'), read('receipts')]);
    db.close();
    return { runs, nodes, states, receipts };
  });
  const base0 = await readDb();
  const rev0 = base0.runs[0]?.revision || 0;
  const nodes0 = base0.nodes.length;
  check('创建开局已落库（1 个周目）', base0.runs.length === 1 && rev0 >= 1, `revision=${rev0} nodes=${nodes0}`);

  await page.waitForFunction(() => document.getElementById('send') && !document.getElementById('send').disabled, null, { timeout: 20000 });
  const startup = await page.textContent('#status-line');
  check('状态行显示就绪', /就绪/.test(startup || ''), startup || '');

  // 1. 一轮完整闭环（输入框只在阅读视图可见，先切原生视图）
  await page.locator('.cxx-boot-overlay').waitFor({ state: 'detached' }).catch(() => {});
  await page.locator('#native-btn').click();
  await page.locator('.cxx-native-reading .mes_text').waitFor();
  await page.fill('#input', '我走向她');
  await page.click('#send');
  await page.waitForFunction(() => /已提交/.test(document.getElementById('status-line')?.textContent || ''), null, { timeout: 30000 });

  const committed = await page.evaluate(() => ({ raw: CxxWebApp.session.narrativeNode?.message?.raw || '' }));
  const choices = await page.$$eval('#choices .choice', (nodes) => nodes.map((n) => n.textContent.replace(/^\s*\d+\s*/, '').trim()));
  check('正文渲染出旁白与台词', /丰川祥子/.test(committed.raw) && committed.raw.length > 20, `raw=${committed.raw.slice(0, 40)}`);
  const renderedText = await page.locator('.cxx-native-reading .mes_text').last().innerText();
  check('已提交正文在阅读视图可见', /丰川祥子/.test(renderedText));

  check('选项渲染出五条', choices.length === 5, `choices=${choices.length}`);
  check('选项内容正确', /接过她递来的委托卡/.test(choices.join('|')));

  // 2. IndexedDB 真的写进去了（以创建开局为基线，按增量断言）
  const stored = await readDb();
  check('提交后 revision 前进 1', stored.runs[0]?.revision === rev0 + 1, `revision=${stored.runs[0]?.revision}（基线 ${rev0}）`);
  const narrativeHits = stored.nodes.filter((n) => /丰川祥子/.test(n.message?.raw || '')).length;
  check('nodes 追加 1 条并带正文', stored.nodes.length === nodes0 + 1 && narrativeHits === 1, `nodes=${nodes0}→${stored.nodes.length}，带正文 ${narrativeHits} 条`);
  check('states 写入后余额 1200', stored.states.at(-1)?.data.terminal.wallet.yen === 1200, `yen=${stored.states.at(-1)?.data?.terminal?.wallet?.yen}`);
  check('receipts 记录补丁（含钱包路径）', (stored.receipts.at(-1)?.receipt.patches || []).some((p) => p === '/terminal/wallet/yen' || p?.path === '/terminal/wallet/yen') && stored.receipts.at(-1).receipt.patches.length >= 2, JSON.stringify(stored.receipts.at(-1)?.receipt?.patches));

  // 3. 提交后视图仍显示已保存内容（不是候选）
  const toneAfter = await page.getAttribute('#status-line', 'data-tone');
  check('状态行 ok 色调', toneAfter === 'ok', toneAfter || '');

  // 4. 刷新后从 IndexedDB 续接
  await page.reload();
  await page.waitForFunction(() => /就绪/.test(document.getElementById('status-line')?.textContent || ''), null, { timeout: 30000 });
  const afterReload = await page.evaluate(() => CxxWebApp.session.narrativeNode?.message?.raw || '');
  check('刷新后读回已提交正文', /丰川祥子/.test(afterReload), `raw=${afterReload.slice(0, 40)}`);

  // 5. 重抽：换 attempt 再生成一次，修订号前进到 2
  await page.click('#regen');
  await page.waitForTimeout(1500);
  console.log('重抽后状态=', await page.textContent('#status-line'));
  await page.waitForFunction(() => /已提交/.test(document.getElementById('status-line')?.textContent || ''), null, { timeout: 30000 });
  const revisionText = await page.textContent('#status-line');
  const runs2 = await page.evaluate(async () => {
    const db = await new Promise((res) => {
      const req = indexedDB.open('cxx2051-web');
      req.onsuccess = () => res(req.result);
    });
    const runs = await new Promise((res) => {
      const req = db.transaction('runs').objectStore('runs').getAll();
      req.onsuccess = () => res(req.result);
    });
    db.close();
    return runs;
  });
  check('重抽后 revision 再前进 1（新 attempt 提交）', runs2[0]?.revision === rev0 + 2, `${revisionText} / revision=${runs2[0]?.revision}（基线 ${rev0}）`);

  // 6. 上游只被调用 2 次（第一轮 + 重抽），没有自动重试或重复请求
  check('正文上游调用次数=2（无自动重试）', upstreamCalls === 2, `calls=${upstreamCalls}`);
  check('目录选择在生产回合真实发起', selectionCalls >= 1, `selection=${selectionCalls}`);

  check('无控制台/网络错误', errors.length === 0, errors.slice(0, 3).join(' ;; '));

  await browser.close();
  app.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n== P2 浏览器检查：${results.length - failed.length}/${results.length} 通过 ==`);
  // 回执：C6 汇总按通过计数判本地模式的正常一轮／取消后重发，别再让旧文本冒充本轮结果。
  const receipt = { at: new Date().toISOString(), mode: 'local', passed: results.length - failed.length, total: results.length, upstreamCalls, selectionCalls, checks: results, errors };
  fs.writeFileSync('reports/p2-browser.json', JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync('reports/p2-browser.txt', `== P2 浏览器检查：${results.length - failed.length}/${results.length} 通过 ==\n` + results.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.name + ' — ' + String(r.detail || '')).join('\n') + '\n');
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('检查崩溃：', error);
  process.exitCode = 1;
});
