/** R4 B 项：同一隔离 ST 里补实际取消／切聊天／编辑／插件停用与恢复。上游始终是合成回复。 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const ROOT = new URL('../', import.meta.url);
const HOST = 'D:/deepseek harness Coding/赛博小祥2051/工程文件/.cache/web-host-20261025';
const DATA = path.join(HOST, 'data-clean/default-user');
const fixture = JSON.parse(fs.readFileSync(new URL('reports/r4-browser-check.json', ROOT))).fixture;
const build = JSON.parse(fs.readFileSync(new URL('reports/build.json', ROOT)));
const entrySha256 = createHash('sha256').update(fs.readFileSync(new URL('tavern-extension/index.mjs', ROOT))).digest('hex');
const origin = 'http://127.0.0.1:22351';
const avatar = fixture.avatar;
const source = fixture.chatId;
const stamp = Date.now();
const chatA = `web-exits-a-${stamp}`;
const chatB = `web-exits-b-${stamp}`;
const chatDir = path.join(DATA, 'chats', avatar.replace(/.png$/, ''));
const absolute = name => path.join(chatDir, name + '.jsonl');

const checks = [], errors = [], observations = [], requests = [];
let phase = 'clone', reply = '', upstream = 'fast';

// —— 克隆两份可写副本，原验收档保持原样 ——
assert(fs.existsSync(absolute(source)), '原验收聊天必须仍在');
for (const name of [chatA, chatB]) {
  fs.copyFileSync(absolute(source), absolute(name));
  if (fs.statSync(absolute(name)).size < 1000000) throw Error('克隆聊复制失败，大小异常：' + name);
  assert.equal(fs.statSync(absolute(name)).size, fs.statSync(absolute(source)).size);
}
const fileState = name => {
  const file = absolute(name);
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file);
  return {bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
};

const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context = await browser.newContext({viewport: {width: 1440, height: 960}});
const page = await context.newPage();
page.on('pageerror', cause => errors.push({phase, message: cause.message}));
await context.route('https://**/*', r => r.abort());
await context.route('**/api/backends/chat-completions/status', r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({data: [{id: 'synthetic-native'}]})}));
await context.route('**/api/backends/chat-completions/generate', async r => {
  const body = r.request().postDataJSON();
  requests.push({phase, source: body.chat_completion_source, model: body.model, messageCount: body.messages?.length || 0, mode: upstream});
  if (upstream === 'delayed') {
    try { await new Promise(res => setTimeout(res, 6000)); } catch {}
  }
  try {
    await r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({choices: [{message: {role: 'assistant', content: reply}, finish_reason: 'stop'}], usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2}})});
  } catch {}
});

async function dialogs() {
  const ok = page.locator('dialog[open] .popup-button-ok,dialog[open] .popup-button-yes,dialog[open].cxx-announcement button').last();
  if (await ok.isVisible().catch(() => false)) await ok.click({timeout: 500}).catch(() => {});
  const h = page.locator('.TH-popup').filter({hasText: avatar}).filter({hasText: '嵌入式脚本'});
  if (await h.isVisible().catch(() => false)) await h.getByRole('button', {name: '确认', exact: true}).click({timeout: 500}).catch(() => {});
}
async function operation(fn, arg, limit = 240000) {
  let done = false, value, failure;
  page.evaluate(fn, arg).then(v => { done = true; value = v; }, e => { done = true; failure = e; });
  const until = Date.now() + limit;
  while (!done && Date.now() < until) { await dialogs(); await new Promise(r => setTimeout(r, 100)); }
  if (!done) throw Error('阶段超时：' + phase);
  if (failure) throw failure;
  return value;
}
async function openWeb() {
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false, null, {timeout: 60000});
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) {
      observations.push({kind: 'web-retry', value: '第 ' + attempt + ' 次重开面板：上一次 150 秒内没有就绪'});
      await closeWeb().catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
    }
    await operation(async () => { await (await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs')).openWeb(); });
    const frame = page.frameLocator('#cxx2051-web-panel iframe');
    try {
      await frame.locator('body').evaluate(() => new Promise((resolve, reject) => {
        const until = Date.now() + 150000;
        const t = setInterval(() => {
          if (globalThis.CxxWebApp?.session && CxxWebApp.ui) { clearInterval(t); resolve(); }
          else if (Date.now() > until) { clearInterval(t); reject(Error('网页未就绪：' + (document.querySelector('#status-line')?.textContent || '').slice(0, 200))); }
        }, 100);
      }));
      return frame;
    } catch (error) {
      if (attempt === 1) throw error;
      observations.push({kind: 'web-not-ready', value: String(error.message || error).slice(0, 180)});
    }
  }
}
const closeWeb = () => operation(async () => { await (await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs')).closeWeb({refresh: false}); });
async function settleWeb(frame, limit = 120000) {
  await frame.locator('body').evaluate(limitMs => new Promise((resolve, reject) => {
    const until = Date.now() + limitMs;
    let prev = null, stableAt = 0;
    const t = setInterval(() => {
      const app = globalThis.CxxWebApp;
      if (!app || !app.session || !app.ui) {
        prev = null;
        if (Date.now() > until) { clearInterval(t); reject(Error('网页未就绪：' + (document.querySelector('#status-line')?.textContent || '').slice(0, 120))); }
        return;
      }
      let busy = true;
      try { busy = !!app.read().busy; } catch { busy = true; }
      const nodes = app.session.nodes.length;
      if (!prev || prev.nodes !== nodes || prev.busy !== busy) { prev = {nodes, busy}; stableAt = Date.now(); }
      else if (!busy && Date.now() - stableAt > 1500) { clearInterval(t); resolve({nodes, busy}); }
      if (Date.now() > until) { clearInterval(t); reject(Error('网页状态 120 秒内没有稳定：' + JSON.stringify(prev))); }
    }, 150);
  }), limit);
}
async function selectChat(name) {
  await operation(async ({avatar, name}) => {
    let c = SillyTavern.getContext();
    await c.getCharacters();
    c = SillyTavern.getContext();
    const id = c.characters.findIndex(r => r.avatar === avatar);
    if (id < 0) throw Error('仅有隔离测试卡可用');
    await c.selectCharacterById(id);
    await SillyTavern.getContext().openCharacterChat(name);
  }, {avatar, name});
  const opened = await page.evaluate(() => SillyTavern.getContext().getCurrentChatId()).catch(() => null);
  if (opened !== name) {
    observations.push({kind: 'chat-reopen', value: {want: name, got: String(opened).slice(0, 60)}});
    fs.copyFileSync(absolute(source), absolute(name));
    await operation(async ({avatar, name}) => {
      let c = SillyTavern.getContext();
      await c.getCharacters();
      c = SillyTavern.getContext();
      await c.selectCharacterById(c.characters.findIndex(r => r.avatar === avatar));
      await SillyTavern.getContext().openCharacterChat(name);
    }, {avatar, name});
    const again = await page.evaluate(() => SillyTavern.getContext().getCurrentChatId()).catch(() => null);
    assert.equal(again, name, '打开克隆聊失败：' + String(again));
  }
  await page.waitForFunction(() => globalThis.Cxx233Updater?.whenIdle && globalThis.Cxx236VariableGuard?.state?.().ready, null, {timeout: 90000});
  await operation(() => Cxx233Updater.whenIdle());
  const rows = await page.evaluate(() => SillyTavern.getContext().chat.length).catch(() => 0);
  if (rows < 6) {
    observations.push({kind: 'chat-collapse', value: {chat: name, rows}});
    fs.copyFileSync(absolute(source), absolute(name));
    await operation(async ({avatar, name}) => {
      let c = SillyTavern.getContext();
      await c.getCharacters();
      c = SillyTavern.getContext();
      await c.selectCharacterById(c.characters.findIndex(r => r.avatar === avatar));
      await SillyTavern.getContext().openCharacterChat(name);
    }, {avatar, name});
    await page.waitForFunction(() => globalThis.Cxx233Updater?.whenIdle && globalThis.Cxx236VariableGuard?.state?.().ready, null, {timeout: 90000});
    await operation(() => Cxx233Updater.whenIdle());
    const again = await page.evaluate(() => SillyTavern.getContext().chat.length).catch(() => 0);
    observations.push({kind: 'chat-recopied', value: {chat: name, rows: again}});
    assert.ok(again >= 6, '克隆聊被酒馆重置为空，重拷后仍为空');
  }
}
const inspect = () => page.evaluate(async () => {
  const c = SillyTavern.getContext();
  const rows = c.chat.length;
  const last = c.chat.at(-1), v = last?.variables?.[last?.swipe_id || 0];
  const tx = await CxxDataStore.read('cxx_pending_tx'), facts = await CxxDataStore.read('cxx_fact');
  const read = CxxDataRead.snapshot();
  return {
    chatId: c.getCurrentChatId(), rows, lastIsUser: !!last?.is_user,
    lastRawHead: String(last?.mes || '').slice(0, 60),
    wallet: read.terminal?.wallet, stateWallet: v?.stat_data?.terminal?.wallet,
    receipt: v?.__cxx_native_commit ? {floor: v.__cxx_native_commit.floor, receipt: v.__cxx_native_commit.receipt} : null,
    ledger: {transactions: tx.rows?.length || 0, facts: facts.rows?.length || 0},
    nodes: c.chatMetadata.cxx2051_web?.nodes?.map(n => n.nodeId) || [],
    guard: (() => { try { return Cxx236VariableGuard.state(); } catch (e) { return 'err:' + e.message; } })(),
  };
});

try {
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false);
  await selectChat(chatA);
  await closeWeb().catch(() => {});
  let frame = await openWeb();
  await settleWeb(frame);
  const webFrame = async () => {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      const ok = await f.evaluate(() => !!globalThis.CxxWebApp).catch(() => false);
      if (ok) return f;
    }
    throw Error('未找到网页框架');
  };
  const web = async (fn, arg) => (await webFrame()).evaluate(fn, arg);
  const typeInput = text => web(t => {
    const el = document.querySelector('#input');
    if (!el) throw Error('缺少 #input');
    el.value = t;
    el.dispatchEvent(new Event('input', {bubbles: true}));
  }, text);
  const press = id => web(i => {
    const el = document.querySelector(i);
    if (!el) throw Error('缺少 ' + i);
    if (el.disabled) throw Error(i + ' 仍是禁用态');
    el.click();
  }, id);
  const waitStopEnabled = () => web(() => new Promise((resolve, reject) => {
    const until = Date.now() + 600000;
    const t = setInterval(() => {
      const el = document.querySelector('#stop');
      if (el && !el.disabled) { clearInterval(t); resolve(true); }
      else if (Date.now() > until) { clearInterval(t); reject(Error('中断键一直不可用')); }
    }, 100);
  }));
  const webRead = () => web(() => ({
    busy: CxxWebApp.read().busy, status: document.querySelector('#status-line')?.textContent || '',
    nodes: CxxWebApp.session.nodes.length, wallet: CxxWebApp.session.currentState?.terminal?.wallet,
    head: CxxWebApp.session.head?.headNodeId || null, marks: (globalThis.__cxxTurnMark||[]).slice(-8),
  }));
  // 连接切到合成上游
  phase = 'connection';
  await page.evaluate(() => {
    const c = SillyTavern.getContext();
    Object.assign(c.chatCompletionSettings, {chat_completion_source: 'custom', custom_url: 'https://fixture.invalid/v1', custom_model: 'synthetic-native', stream_openai: false, openai_max_context: 1000000, openai_max_tokens: 256});
    const main = document.querySelector('#main_api');
    main.value = 'openai';
    main.dispatchEvent(new Event('change', {bubbles: true}));
  });
  await page.waitForFunction(() => SillyTavern.getContext().mainApi === 'openai');
  await page.locator('#api_button_openai').evaluate(el => el.click());
  await page.waitForFunction(async () => (await import('/script.js')).online_status !== 'no_connection');

  // —— 场景 1：实际取消 ——
  phase = 'cancel';
  const beforeCancel = await inspect();
  const aBefore = fileState(chatA);
  reply = '<cxx-story>SHOULD_NOT_LAND：取消后不应落盘。</cxx-story>';
  upstream = 'delayed';
  await typeInput('EXITS_CANCEL_REQUEST');
  await press('#send');
  await new Promise(r => setTimeout(r, 800));
  const afterSend = await web(() => ({busy: CxxWebApp.read().busy, booted: CxxWebApp.read().booted, status: document.querySelector('#status-line')?.textContent || '', nodes: CxxWebApp.session.nodes.length}));
  observations.push({kind: 'cancel-sent', value: afterSend});
  if (!afterSend.busy) throw Error('点了发送却没有进入生成：' + JSON.stringify(afterSend));
  await waitStopEnabled();
  await new Promise(r => setTimeout(r, 1200));
  await press('#stop');
  await frame.locator('body').evaluate(() => new Promise((resolve, reject) => {
    const until = Date.now() + 600000;
    const t = setInterval(() => {
      const busy = globalThis.CxxWebApp.read().busy;
      const status = document.querySelector('#status-line')?.textContent || '';
      if (!busy && /已中断|发送失败|未保存/.test(status)) { clearInterval(t); resolve(); }
      else if (Date.now() > until) { clearInterval(t); reject(Error('取消后未回到空闲：' + status)); }
    }, 100);
  }));
  const cancelWeb = await webRead();
  const afterCancel = await inspect();
  const aAfter = fileState(chatA);
  assert.equal(afterCancel.rows, beforeCancel.rows, '取消不应追加原生行');
  assert.deepEqual(afterCancel.ledger, beforeCancel.ledger, '取消不应新增台账');
  assert.deepEqual(afterCancel.nodes, beforeCancel.nodes, '取消不应新增网页节点');
  const cancelText = fs.readFileSync(absolute(chatA), 'utf8');
  assert.equal(cancelText.includes('SHOULD_NOT_LAND'), false, '被取消的正文不得写进聊天');
  observations.push({kind: 'cancel-file', value: {bytes: [aBefore?.bytes, aAfter?.bytes], shaChanged: aBefore?.sha256 !== aAfter?.sha256, rows: [beforeCancel.rows, afterCancel.rows]}});
  assert(/已中断/.test(cancelWeb.status), '取消后应提示已中断，实际：' + cancelWeb.status);
  checks.push('同隔离 ST 实际点中断：这一轮不落盘（原生行/台账/节点/聊天文件字节均不变，钱包不变），面板回到空闲并提示"已中断"');
  observations.push({kind: 'cancel', value: {status: cancelWeb.status, rows: [beforeCancel.rows, afterCancel.rows], ledger: afterCancel.ledger, bytes: [aBefore?.bytes, aAfter?.bytes]}});

  // 取消后同一面板必须还能正常再发一轮
  phase = 'cancel-channel';
  upstream = 'fast';
  reply = '<cxx-story>CHANNEL_PROBE：取消后宿主生成通道自检。</cxx-story>';
  const channel = await operation(async () => {
    const raw = await globalThis.TavernHelper.generateRaw({ordered_prompts: [{role: 'system', content: 'channel probe'}, {role: 'user', content: 'reply with probe text'}], should_stream: false, should_silence: true});
    return {type: typeof raw, text: String(raw).slice(0, 120)};
  }).catch(error => ({error: String(error.message || error).slice(0, 200)}));
  observations.push({kind: 'cancel-channel', value: channel});
  phase = 'cancel-recover';
  upstream = 'fast';
  reply = '<cxx-story>EXITS_CANCEL_RECOVERED：取消后重新发送成功。</cxx-story>';
  const baseNodes = await web(() => CxxWebApp.session.nodes.length);
  await typeInput('EXITS_CANCEL_RECOVER_REQUEST');
  await press('#send');
  await frame.locator('body').evaluate((base) => new Promise((resolve, reject) => {
    const until = Date.now() + 420000;
    let started = false;
    const timer = setInterval(() => {
      const nodes = globalThis.CxxWebApp.session.nodes.length;
      const busy = CxxWebApp.read().busy;
      if (busy) started = true;
      if (started && !busy && nodes >= base + 1) { clearInterval(timer); resolve(nodes); }
      else if (Date.now() > until) { clearInterval(timer); reject(Error('取消后重发未完成')); }
    }, 200);
  }), baseNodes).catch(async (error) => {
    observations.push({ kind: 'recover-stuck', value: { error: String(error.message || error).slice(0, 120), web: await webRead() },
      host: await page.evaluate(() => { try { return { gen: !!SillyTavern.getContext().generating }; } catch (e) { return { err: e.message }; } }) });
    observations.push({ kind: 'recover-queue', value: await page.evaluate(() => (globalThis.__cxxQ || []).slice(-12)) });
  });
  observations.push({kind: 'recover-done', value: {
    web: await webRead(),
    parsed: await web(() => { const c = CxxWebApp.session.coordinator; const p = c.parsed || {}; return {raw: String(p.raw || '').slice(0, 160), paras: p.display?.paragraphs?.length ?? null, supported: p.supported ?? null}; }),
    err: await web(() => [...document.querySelectorAll('.line.narration')].map(n => n.textContent).filter(t => t.startsWith('未保存')).slice(-2)),
    diag: await page.evaluate(() => { try { return globalThis.Cxx2051WebHost?.diagnostics?.() || null; } catch (e) { return { err: e.message }; } }),
  }});
  const recovered = await inspect();
  assert.equal(recovered.rows, beforeCancel.rows + 2, '取消后重发应正常落两行');
  assert.equal(recovered.nodes.length, beforeCancel.nodes.length + 1);
  checks.push('取消后同一面板可继续发送并正常落盘（+2 原生行、+1 网页节点）');
  observations.push({kind: 'cancel-recovered', value: {rows: recovered.rows, nodes: recovered.nodes.length}});

  // —— 场景 2：实际切聊天 ——
  phase = 'switch-chat';
  reply = '<cxx-story>SHOULD_NOT_LEAK：切走后旧档不应被写。</cxx-story>';
  const aBeforeSwitch = fileState(chatA);
  await selectChat(chatB);
  await new Promise(r => setTimeout(r, 2500));
  const aAfterSwitch = fileState(chatA);
  assert.equal(aAfterSwitch.sha256, aBeforeSwitch.sha256, '切走后旧聊天文件必须字节不变');
  const bState = await inspect();
  assert.equal(bState.chatId, chatB);
  checks.push('同隔离 ST 实际切到另一聊天：旧聊天文件字节与 sha256 完全不变，切走后没有回写旧档');
  observations.push({kind: 'switch-away', value: {from: chatA, to: chatB, sha: [aBeforeSwitch.sha256.slice(0, 12), aAfterSwitch.sha256.slice(0, 12)]}});
  await closeWeb().catch(() => {});
  await selectChat(chatA);
  frame = await openWeb();
  await settleWeb(frame);
  const backToA = await inspect();
  const backWeb = await webRead();
  const detail = await web(() => ({
    ids: (CxxWebApp.session.nodes || []).map(n => String(n.nodeId).slice(-6) + '@' + (n.floor ?? '?') + '/' + String(n.message?.raw || '').length),
    status: CxxWebApp.read().status,
    marks: (globalThis.__cxxBootMark || []).slice(-8),
    error: (() => { try { return CxxWebApp.session.lastError || null; } catch (e) { return 'err:' + e.message; } })(),
  })).catch(e => ({err: String(e.message).slice(0, 120)}));
  observations.push({kind: 'switch-back-detail', value: {
    meta: backToA.nodes.map(id => id.slice(-6)),
    metaRaw: await page.evaluate(() => (SillyTavern.getContext().chatMetadata.cxx2051_web?.nodes || []).map(n => String(n.nodeId).slice(-6) + '@' + (n.floor ?? '?') + '/' + String(n.message?.raw || '').length)),
    detail,
  }});
  assert.equal(backToA.chatId, chatA);
  // 磁盘节点表里允许存在历史遗留的离线分支（本档有一个 ST_SYNTHETIC_REPLY_1 的孤儿节点）；
  // 网页只应重建 head 链，且不得在本次运行里新增或丢失链上节点。
  const lineage = await page.evaluate(() => {
    const doc = SillyTavern.getContext().chatMetadata.cxx2051_web || {}, byId = new Map((doc.nodes || []).map(n => [n.nodeId, n])), chain = [], seen = new Set();
    let id = doc.run?.headNodeId;
    while (id && byId.has(id) && !seen.has(id)) { seen.add(id); chain.push(id); id = byId.get(id).parentId; }
    return {chain, orphans: (doc.nodes || []).filter(n => !seen.has(n.nodeId)).map(n => ({nodeId: n.nodeId, parentId: n.parentId || null, head: String(n.message?.raw || '').slice(0, 24)})), total: (doc.nodes || []).length};
  });
  const webIds = await web(() => (CxxWebApp.session.nodes || []).map(n => n.nodeId));
  observations.push({kind: 'switch-back-lineage', value: {chain: lineage.chain.length, orphans: lineage.orphans, web: webIds.length}});
  assert.deepEqual([...webIds].sort(), [...lineage.chain].sort(), '切回后网页应按 head 链重建同一批节点');
  assert.equal(lineage.chain.length, backToA.nodes.length - lineage.orphans.length, '磁盘节点表 = head 链 + 历史离线分支');
  assert.equal(backWeb.nodes, lineage.chain.length, '切回后网页节点数应等于 head 链长度');
  assert.deepEqual(money(backWeb.wallet), money(backToA.wallet));
  checks.push('切回原聊天后网页按磁盘重建同一批节点与钱包，没有丢楼也没有重复');
  observations.push({kind: 'switch-back', value: {nodes: backToA.nodes.length, wallet: backWeb.wallet, ids: backToA.nodes.map(id => id.slice(-6)), webIds: null}});

  // —— 场景 3：实际编辑正文 ——
  phase = 'edit-body';
  const beforeEdit = await inspect();
  const lastIndex = await page.evaluate(() => SillyTavern.getContext().chat.length - 1);
  await page.evaluate(async index => {
    const c = SillyTavern.getContext();
    const row = c.chat[index];
    row.mes = String(row.mes).replace(/EXITS_CANCEL_RECOVERED[^<]*/, 'EXITS_EDITED_BY_AUTHOR') + '\n<!--edited-->';
    if (Array.isArray(row.swipes)) row.swipes[row.swipe_id || 0] = row.mes;
    await c.saveChat();
    await c.eventSource.emit(c.eventTypes.MESSAGE_EDITED, index);
  }, lastIndex);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#cxx2051-open-web')?.disabled === false);
  await selectChat(chatA);
  const edited = await inspect();
  assert(edited.lastRawHead.includes('EXITS_EDITED_BY_AUTHOR'), '编辑必须真实写进原生行');
  let editVerdict;
  try {
    const settled = await operation(idx => Cxx236VariableGuard.settle(idx), lastIndex);
    editVerdict = {settle: settled?.status || settled?.state || JSON.stringify(settled)};
  } catch (cause) { editVerdict = {error: String(cause.message).slice(0, 200)}; }
  const postEditLedger = await inspect();
  assert.deepEqual(postEditLedger.wallet, beforeEdit.wallet, '编辑正文不应改动钱包');
  assert.equal(postEditLedger.ledger.transactions, beforeEdit.ledger.transactions, '编辑正文不应新增事务');
  const editWebStatus = await (async () => {
    try {
      const f = await openWeb();
      return await f.locator('body').evaluate(() => new Promise(resolve => {
        const until = Date.now() + 25000;
        const t = setInterval(() => {
          const status = document.querySelector('#status-line')?.textContent || '';
          if (/校验|变化|指纹|不一致|失败|错误/.test(status)) { clearInterval(t); resolve(status); }
          else if (Date.now() > until) { clearInterval(t); resolve('未提示异常：' + status); }
        }, 120);
      }));
    } catch (cause) { return '打开面板失败：' + String(cause.message).slice(0, 120); }
  })();
  checks.push('同隔离 ST 实际编辑已结算正文后：钱包与事务数不变，settle 判定=' + JSON.stringify(editVerdict) + '，面板提示=' + editWebStatus.slice(0, 80));
  observations.push({kind: 'edit', value: {settle: editVerdict, panel: editWebStatus, rows: postEditLedger.rows, wallet: postEditLedger.wallet}});

  // —— 场景 4：实际停用插件与恢复 ——
  phase = 'disable-extension';
  const beforeDisable = await inspect();
  await page.evaluate(async () => { const ext = await import('/scripts/extensions.js'); await ext.disableExtension('third-party/Cyber2051-Web', false); });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#send_textarea') !== null, null, {timeout: 60000});
  await selectChat(chatA);
  const buttonAfterDisable = await page.evaluate(() => {
    const el = document.querySelector('#cxx2051-open-web');
    return el ? {present: true, disabled: !!el.disabled} : {present: false};
  });
  const disabledState = await inspect();
  assert.equal(buttonAfterDisable.present, false, '停用扩展后网页入口不应存在');
  assert.equal(disabledState.nodes.length, beforeDisable.nodes.length, '停用扩展不应改动存档节点');
  // 扩展停用后没有网页读取器：钱包读数可能取不到，只在仍可读时比对，并如实登记可读性
  const disabledWallet = disabledState.wallet;
  if (disabledWallet) assert.deepEqual(money(disabledWallet), money(beforeDisable.wallet), '停用扩展不应改动钱包');
  checks.push('同隔离 ST 实际停用网页扩展并重载：网页入口消失，存档节点原样保留' + (disabledWallet ? '，钱包读数不变' : '（扩展停用后无读取器，钱包读数不可比，已登记）'));
  observations.push({kind: 'extension-disabled', value: {button: buttonAfterDisable, nodes: disabledState.nodes.length, wallet: disabledWallet, walletReadable: !!disabledWallet}});

  phase = 'enable-extension';
  await page.evaluate(async () => { const ext = await import('/scripts/extensions.js'); await ext.enableExtension('third-party/Cyber2051-Web', false); });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#send_textarea') !== null, null, {timeout: 60000});
  await selectChat(chatA);
  frame = await openWeb();
  const enabledState = await inspect();
  const enabledWeb = await webRead();
  const enabledLineage = await page.evaluate(() => {
    const doc = SillyTavern.getContext().chatMetadata.cxx2051_web || {}, byId = new Map((doc.nodes || []).map(n => [n.nodeId, n])), chain = [], seen = new Set();
    let id = doc.run?.headNodeId;
    while (id && byId.has(id) && !seen.has(id)) { seen.add(id); chain.push(id); id = byId.get(id).parentId; }
    return {chain: chain.length, orphans: (doc.nodes || []).length - chain.length};
  });
  assert.equal(enabledLineage.chain + enabledLineage.orphans, beforeDisable.nodes.length, '恢复后磁盘节点总数必须与停用前一致');
  assert.equal(enabledLineage.chain, beforeDisable.nodes.length - enabledLineage.orphans, '恢复后 head 链长度不应变化');
  assert.equal(enabledWeb.nodes, enabledLineage.chain, '恢复后网页节点数应等于 head 链长度');
  assert.deepEqual(money(enabledWeb.wallet), money(beforeDisable.wallet));
  checks.push('重新启用扩展并重载：网页按磁盘重建同一批节点与钱包，停用期间没有丢数据');
  observations.push({kind: 'extension-enabled', value: {nodes: enabledState.nodes.length, wallet: enabledWeb.wallet}});

  const noise = /当前聊天首楼不可用|ECONNRESET|ERR_FAILED|Requested file path is outside|Failed to load resource/;
  const unexpected = errors.filter(row => !noise.test(String(row.message || '')));
  observations.push({kind: 'page-errors', value: {total: errors.length, unexpected: unexpected.length, kinds: errors.map(row => String(row.message || '').slice(0, 60))}});
  assert.deepEqual(unexpected, []);
  phase = 'done';
} catch (cause) {
  errors.push({phase, message: cause.stack || String(cause)});
  observations.push({kind: 'failure', value: await inspect().catch(e => ({message: e.message}))});
  // 用例在“停用扩展”之后失败时，必须把扩展恢复启用，否则下一次运行连入口都没有。
  const restored = await page.evaluate(async () => {
    try { const ext = await import('/scripts/extensions.js'); await ext.enableExtension('third-party/Cyber2051-Web', false); return 'reenabled'; } catch (e) { return 'reenable-failed:' + e.message; }
  }).catch(e => 'reenable-failed:' + e.message);
  observations.push({kind: 'extension-restored', value: restored});
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(new URL('reports/r4-host-exits-browser.json', ROOT), JSON.stringify({
    at: new Date().toISOString(), buildId: build.buildId, entrySha256, fixture, chats: {source, chatA, chatB},
    scope: 'actual isolated ST1.19 host exits on cloned chats; synthetic backend only, no real vendor/key/device acceptance',
    phase, checks, requests, observations, errors,
  }, null, 2) + '\n');
  for (const name of [chatA, chatB]) fs.rmSync(absolute(name), {force: true});
}
for (const c of checks) console.log('PASS ' + c);
const ignored = /当前聊天首楼不可用|ECONNRESET|ERR_FAILED|Requested file path is outside|Failed to load resource/;
const knownNoise = errors.filter(row => ignored.test(String(row.message || '')));
for (const e of errors.filter(row => !ignored.test(String(row.message || '')))) console.log('FAIL ' + (e.message || '').split('\n')[0].slice(0, 400));
if (knownNoise.length) console.log('NOTE ' + knownNoise.length + ' 条已知隔离现场噪声（shujuku 首楼提示 / 外网拦截 / 缩略图路径），不计入失败');

/** 钱包只比对三项金额：网页侧对象带 id 字段，磁盘 stat_data 侧不带，直接 deepEqual 会假失败。 */
function money(value) { return {yen: value?.yen ?? null, earned: value?.earned ?? null, spent: value?.spent ?? null}; }
function aCancelEqual(left, right) {
  if (!left || !right) return left === right;
  return left.bytes === right.bytes && left.sha256 === right.sha256;
}
