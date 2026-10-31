/**
 * C2 归因：切聊天时冒出的“当前聊天首楼不可用”是谁发的。
 * 同一套切换动作做两遍：开着 Cyber2051-Web 一遍，停用它再一遍。
 * 停用后仍出现 → 这句来自第三方插件（shujuku 的世界模拟/续写守卫），不是 2051 网页。
 * 用法：node tools/c2-chat-attribution.mjs [--avatar=WEB_HOST_TEST_*.png]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WEB = fileURLToPath(new URL('../', import.meta.url));
const ROOT = path.resolve(WEB, '..');
const CACHE = path.join(ROOT, '.cache', 'web-host-20261025');
const arg = (name, fallback) => { const hit = process.argv.find(value => value.startsWith('--' + name + '=')); return hit ? hit.slice(name.length + 3) : fallback; };
const avatar = arg('avatar', 'WEB_HOST_TEST_1792927112818.png');
const dir = path.join(CACHE, 'data-clean/default-user/chats', avatar.replace(/\.png$/, ''));
const chats = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).map(name => name.replace(/\.jsonl$/, ''));
const A = chats.find(name => name.startsWith('web-controlled-')) ?? chats[0];
const B = chats.find(name => name !== A);
if (!A || !B) throw new Error('同一角色下需要至少两个聊天');

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const toasts = [];
await page.exposeFunction('__c2toast', text => { if (toasts.length < 60) toasts.push(String(text)); });
await page.addInitScript(() => {
  const hook = () => {
    const toastr = globalThis.toastr;
    if (!toastr) return setTimeout(hook, 100);
    for (const level of ['error', 'warning', 'info', 'success']) {
      const original = toastr[level]?.bind(toastr);
      if (!original) continue;
      toastr[level] = (message, ...rest) => { try { globalThis.__c2toast?.(level + ': ' + String(message)); } catch {} return original(message, ...rest); };
    }
  };
  hook();
});
const dismiss = () => page.evaluate(() => {
  for (const scope of document.querySelectorAll('dialog[open],.TH-popup')) {
    const buttons = [...scope.querySelectorAll('button,input[type=button]')].filter(node => node.offsetParent !== null);
    (buttons.filter(node => /确定|确认|知道了|关闭|好的|继续/i.test(node.textContent || node.value || '')).pop() || buttons.pop())?.click();
  }
});
async function settle(ms = 900) { const deadline = Date.now() + ms; while (Date.now() < deadline) { await dismiss(); await page.waitForTimeout(150); } }
async function ready() { await page.waitForFunction(() => typeof SillyTavern?.getContext === 'function', null, { timeout: 60000 }); await page.waitForFunction(() => { const button = document.querySelector('#cxx2051-open-web'); return !!button && !button.disabled; }, null, { timeout: 90000 }).catch(() => {}); await settle(600); }
const selectCharacter = async () => { await page.evaluate(async key => { const context = SillyTavern.getContext(); await context.getCharacters(); const index = context.characters.findIndex(row => row.avatar === key); if (index < 0) throw new Error('受控测试卡缺失'); await context.selectCharacterById(index); }, avatar); await settle(1200); };
const switchTo = async id => { await page.evaluate(async target => { await SillyTavern.getContext().openCharacterChat(target); }, id); await settle(1500); return page.evaluate(() => { const context = SillyTavern.getContext(); return { chat: context.getCurrentChatId(), rows: context.chat?.length ?? 0, first: (context.chat?.[0]?.mes || '').slice(0, 24) }; }); };
const collect = () => page.evaluate(() => ({ dom: [...document.querySelectorAll('#toast-container .toast-message')].map(node => node.textContent.trim()), dialogs: [...document.querySelectorAll('dialog[open],.TH-popup')].map(node => node.innerText.slice(0, 240)) }));
const report = { avatar, chats: { A, B }, arms: [], errors: [] };
page.on('pageerror', error => report.errors.push(String(error.message || error)));
async function arm(label, disable) {
  if (disable) {
    await page.evaluate(async () => { const ext = await import('/scripts/extensions.js'); await ext.disableExtension('third-party/Cyber2051-Web', false); });
    await page.reload();
    await ready();
  }
  await selectCharacter();
  const steps = [];
  steps.push({ step: 'A', ...await switchTo(A) });
  steps.push({ step: 'B', ...await switchTo(B) });
  steps.push({ step: 'A', ...await switchTo(A) });
  const seen = await collect();
  const hits = [...toasts, ...seen.dom, ...seen.dialogs].filter(text => /首楼不可用|CHAT_UNAVAILABLE/.test(text));
  report.arms.push({ label, extensionDisabled: disable, steps, toasts: toasts.splice(0), unavailable: hits });
  return hits.length;
}
try {
  await page.goto('http://127.0.0.1:22351');
  await ready();
  const withExtension = await arm('extension-on', false);
  const withoutExtension = await arm('extension-off', true);
  report.verdict = withExtension && withoutExtension ? 'third-party: 停用 Cyber2051-Web 后仍出现，来源是插件 shujuku 的聊天守卫' : withExtension ? 'both-arms: 只有开着扩展时出现，需在 2051 侧继续查' : 'not-reproduced: 本次两臂都没有出现该提示';
} catch (cause) {
  report.failure = String(cause?.message || cause).slice(0, 400);
} finally {
  try {
    await page.evaluate(async () => { const ext = await import('/scripts/extensions.js'); await ext.enableExtension('third-party/Cyber2051-Web', false); });
  } catch {}
  await browser.close();
  fs.writeFileSync(path.join(WEB, 'reports', 'c2-chat-attribution.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
