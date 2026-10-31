'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require("../../卡片源码/Gal/controller.js");
const parser = require("../../卡片源码/Gal/parser.js");

function message(mes, extra = {}) {
  return { name: '旁白', is_user: false, is_system: false, mes, swipe_id: 0, ...extra };
}

function fixture(t, options = {}) {
  const state = { key: 'card-a/chat-a', messages: [message('第一段。\n\n第二段。')], draft: '', busy: false, ...options.state };
  const calls = { send: 0, stop: 0, draft: [], cover: [], nativeFocus: 0, notify: [], unsubscribe: 0, terminalOpen: 0 };
  const views = [];
  calls.modeOpened = []; calls.modeClosed = [];
  const listeners = new Set();
  let failRender = false;
  const adapter = {
    read: () => state,
    setDraft(text) { calls.draft.push(text); state.draft = text; },
    send() { calls.send++; options.onSend?.(state); },
    stop() { calls.stop++; state.busy = false; },
    cover(value) { calls.cover.push(value); },
    focusNative() { calls.nativeFocus++; },
    notify(text) { calls.notify.push(text); },
    onOpened(key) { calls.modeOpened.push(key); options.onOpened?.(key); },
    onUserClose(key) { calls.modeClosed.push(key); options.onUserClose?.(key); },
    subscribe(fn) { listeners.add(fn); return () => { calls.unsubscribe++; listeners.delete(fn); }; },
    sprite: id => id ? '/sprites/' + id + '.png' : null,
    readHud: options.readHud,
    background: options.background,
    openStatus: options.openStatus,
    openWorkshop: options.openWorkshop,
    ...(options.terminalAvailable === false ? {} : { openTerminal() { calls.terminalOpen++; options.onTerminal?.(); } }),
  };
  const controller = create({ adapter, parser, mount(callbacks) {
    if (options.failMount) throw new Error('mount failed');
    const view = { callbacks, model: null, renders: 0, destroyed: 0, focusCount: 0, terminalFocusCount: 0,
      render(model) { if (failRender) throw new Error('render failed'); this.model = model; this.renders++; },
      destroy() { this.destroyed++; },
      focusInput() { this.focusCount++; },
      focusTerminal() { this.terminalFocusCount++; },
    };
    views.push(view);
    return view;
  } });
  t.after(() => controller.destroy());
  return { state, calls, views, controller, listeners,
    get view() { return views.at(-1); },
    emit(kind) { [...listeners].forEach(fn => fn(kind)); },
    failRendering() { failRender = true; },
  };
}

test('completed story remains readable during extra MVU calculation while sending stays blocked', t => {
  const m=message('祥子：剧情已经写完。');const f=fixture(t,{state:{messages:[m],busy:true,generating:false,canStop:false,status:'MVU正在计算数值'}});
  f.controller.open();assert.equal(f.view.model.messages.length,1);assert.equal(f.view.model.paragraphs[0].text,m.mes);
  assert.equal(f.view.model.busy,true);assert.equal(f.view.model.canStop,false);assert.equal(f.view.model.status,'MVU正在计算数值');
  f.state.draft='新的行动';f.view.callbacks.onSend();assert.equal(f.calls.send,0);
});

test('a user message keeps its author and text without borrowing an NPC portrait', t => {
  const source=message('我先把备用电池放在桌上。\n\n祥子：这是我引用的一句话。',{is_user:true,name:'测试玩家'});
  const f=fixture(t,{state:{messages:[source]}});f.controller.open();
  assert.deepEqual(f.view.model.paragraphs.map(p=>p.speaker),['测试玩家','测试玩家']);
  assert.ok(f.view.model.paragraphs[0].text.includes('我先把备用电池放在桌上。'));
  assert.ok(f.view.model.paragraphs.every(p=>p.characterId===null));
  assert.deepEqual(f.view.model.sprites,[]);
  assert.equal(source.mes,'我先把备用电池放在桌上。\n\n祥子：这是我引用的一句话。');
});

test('story CG follows the selected source object while scene background and user floors stay separate', t => {
  const previousParent = globalThis.parent, calls = [];
  const picture = {id: 'latest-illustration', url: 'https://cyber2051.top/synthetic.webp', source: {floor: 0, swipe: 0}};
  const story = message('祥子：剧情插图所属的正文。');
  globalThis.parent = {CxxPlot: {illustrationsAt(source, floor) {calls.push({source, floor}); return source === story && floor === 0 ? [picture] : [];}}};
  t.after(() => {globalThis.parent = previousParent;});
  const background = {url: 'https://cyber2051.top/synthetic-scene.webp'};
  const f = fixture(t, {state: {messages: [story]}, background: () => background});
  f.controller.open();
  assert.strictEqual(calls[0].source, story);
  assert.equal(calls[0].floor, 0);
  assert.strictEqual(f.view.model.storyCg, picture);
  assert.strictEqual(f.view.model.background, background);
  assert.deepEqual(f.view.model.sprites, []);
  f.state.messages.push(message('玩家引用这幅图。', {is_user: true, name: '玩家'}));
  f.emit('content');
  assert.equal(calls.length, 1);
  assert.equal(f.view.model.storyCg, null);
  assert.strictEqual(f.view.model.background, background);
});

test('history excerpts refresh with the host list revision without changing message identities', t => {
  const story = message('<cxx-story>旧首句。</cxx-story>');
  const f = fixture(t, {state: {messages: [story], listRevision: 1}});
  f.controller.open();
  const id = f.view.model.messages[0].id;
  assert.equal(f.view.model.messages[0].excerpt, '旧首句。');
  story.mes = '<cxx-story>新首句。</cxx-story>';
  f.state.listRevision++;
  f.emit('content');
  assert.equal(f.view.model.messages[0].id, id);
  assert.equal(f.view.model.messages[0].excerpt, '新首句。');
});

test('reading and choices never rewrite the native transcript or its variables', t => {
  const m = message('祥子：早上好。\n\n街上开始下雨。', {
    extra: Object.freeze({ stat_data: Object.freeze({ wallet: 98765 }) }),
    swipes: Object.freeze(['祥子：早上好。\n\n街上开始下雨。']),
  });
  Object.freeze(m);
  const nativeMessages = Object.freeze([m]);
  const before = JSON.stringify(nativeMessages);
  const f = fixture(t, { state: { messages: nativeMessages, draft: '还没写完' } });
  f.controller.open();
  f.view.callbacks.onSelectParagraph(1);
  f.view.callbacks.onChoice('撑开伞。');
  f.controller.close();
  assert.equal(JSON.stringify(nativeMessages), before);
  assert.equal(f.state.messages, nativeMessages);
  assert.equal(f.calls.send, 0);
  assert.equal(f.calls.stop, 0);
});

test('only a successful manual open and the current user close request preference writes', t => {
  const f = fixture(t, { state: { draft: '保留草稿' } });
  f.controller.open(); f.controller.open();
  assert.deepEqual(f.calls.modeOpened, ['card-a/chat-a']);
  f.controller.close();
  assert.deepEqual(f.calls.modeClosed, [], 'generic cleanup is not a user preference');
  f.controller.open({ remember: false });
  assert.deepEqual(f.calls.modeOpened, ['card-a/chat-a']);
  f.view.callbacks.onClose();
  assert.deepEqual(f.calls.modeClosed, ['card-a/chat-a']);
  assert.equal(f.controller.active, false); assert.equal(f.state.draft, '保留草稿');
});

test('chat changes, rendering failure, failed mount and destruction never clear saved mode', t => {
  const switched = fixture(t); switched.controller.open();
  switched.state.key = 'card-a/chat-b'; switched.emit('chat');
  assert.deepEqual(switched.calls.modeClosed, []);
  const failed = fixture(t); failed.controller.open({ remember: false }); failed.failRendering(); failed.emit('content');
  assert.deepEqual(failed.calls.modeClosed, []); assert.deepEqual(failed.calls.modeOpened, []);
  const mount = fixture(t, { failMount: true }); mount.controller.open();
  assert.deepEqual(mount.calls.modeOpened, []); assert.deepEqual(mount.calls.modeClosed, []);
  const destroyed = fixture(t); destroyed.controller.open(); destroyed.controller.destroy();
  assert.deepEqual(destroyed.calls.modeClosed, []);
});

test('a stale close callback cannot disable a reopened view in either the same or another chat', t => {
  for (const key of ['card-a/chat-a', 'card-a/chat-b']) {
    const f = fixture(t); f.controller.open(); const old = f.view;
    f.controller.close(); f.state.key = key; f.controller.open();
    old.callbacks.onClose();
    assert.equal(f.controller.active, true); assert.deepEqual(f.calls.modeClosed, []);
    f.view.callbacks.onClose(); assert.deepEqual(f.calls.modeClosed, [key]);
  }
});

test('preference failures do not strand the overlay or prevent returning to native chat', t => {
  const f = fixture(t, { onOpened() { throw Error('save open failed'); }, onUserClose() { throw Error('save close failed'); } });
  f.controller.open(); assert.equal(f.controller.active, true);
  assert.match(f.calls.notify.at(-1), /save open failed/);
  assert.doesNotThrow(() => f.view.callbacks.onClose());
  assert.equal(f.controller.active, false); assert.equal(f.calls.cover.at(-1), false);
  assert.match(f.calls.notify.at(-1), /save close failed/);
});

test('HUD rereads the selected floor and paragraph speaker; status opens without moving the reading cursor', t => {
  const reads = []; let statusCalls = 0;
  const f = fixture(t, { state: { messages: [message('祥子：早上好。\n\n爱音：你好。'), message('灯：晚上好。')] },
    readHud(value) { reads.push(value); return { scope: String(value.messageId), fields: [] }; },
    openStatus() { statusCalls++; },
  });
  f.controller.open();
  assert.equal(reads.at(-1).messageId, 1);
  f.view.callbacks.onSelectMessage(f.view.model.messages[0].id);
  assert.equal(reads.at(-1).messageId, 0);
  assert.equal(reads.at(-1).characterId, 'Saki');
  assert.equal(reads.at(-1).history, true);
  f.view.callbacks.onSelectParagraph(1);
  assert.equal(reads.at(-1).characterId, 'Anon');
  f.view.callbacks.onStatus();
  assert.equal(statusCalls, 1);
  assert.equal(f.view.model.paragraphIndex, 1);
  assert.equal(f.view.model.hud.scope, '0');
  const before = reads.length;
  f.emit('content');
  assert.equal(reads.length, before + 1, 'rerender events must reread variables even with unchanged text');
});

test('player quotations never select a character affection and deleted history resumes following', t => {
  const a = message('祥子：第一层。'), b = message('爱音：第二层。'), c = message('灯：第三层。');
  const reads = [];
  const f = fixture(t, { state: { messages: [a, b, c] }, readHud(value) { reads.push(value); } });
  f.controller.open();
  f.view.callbacks.onSelectMessage(f.view.model.messages[1].id);
  f.state.messages.splice(1, 1); f.emit('content');
  assert.equal(f.view.model.history, false);
  f.state.messages.push(message('祥子：玩家引用', { is_user: true })); f.emit('content');
  assert.equal(f.view.model.history, false);
  assert.equal(reads.at(-1).messageId, 2);
  assert.equal(reads.at(-1).characterId, null);
});

test('opening HTML stays outside dialogue and ends only when host reports a real user floor', t => {
  const opening = message('<html>data-opening-fixture</html>');
  const f = fixture(t, { state: { messages: [opening], openingMessage: opening, opening: true } });
  f.controller.open();
  assert.equal(f.view.model.opening, true);
  assert.equal(f.view.model.messages.length, 0);
  assert.deepEqual(f.view.model.paragraphs, []);
  assert.equal(f.calls.send, 0);
  f.state.messages.push(message('开始剧情', { is_user: true }));
  f.state.opening = false;
  f.emit('sent');
  assert.equal(f.view.model.opening, false);
  assert.equal(f.view.model.messages.length, 1);
  assert.equal(f.view.model.paragraphs[0].text, '开始剧情');
  assert.equal(f.calls.send, 0, 'bridge does not repeat the original opening send');
});

for (const [label, change, changedField] of [
  ['first-message replacement', f => {
    const replacement = message(f.state.openingMessage.mes, { swipe_id: f.state.openingMessage.swipe_id });
    f.state.messages[0] = replacement; f.state.openingMessage = replacement;
  }, 'openingMessage'],
  ['swipe change with identical prose', f => {
    f.state.openingMessage.swipe_id = 1; f.state.swipeId = 1;
  }, 'openingSwipe'],
  ['edited opening prose on the same swipe', f => {
    f.state.openingMessage.mes = '<html>开场正文 B</html>';
  }, 'openingRaw'],
]) {
  test('opening context reaches the UI after ' + label + ' while the opening flag stays true', t => {
    const opening = message('<html>开场正文 A</html>');
    const f = fixture(t, { state: { messages: [opening], openingMessage: opening, opening: true, swipeId: 0, draft: '保留草稿' } });
    f.controller.open();
    const prior = f.view.model, chatKey = f.state.key, initialView = f.view;
    assert.equal(prior.openingMessage, opening);
    assert.equal(prior.openingSwipe, 0);
    assert.equal(prior.openingRaw, '<html>开场正文 A</html>');
    change(f); f.emit('content');
    const current = f.view.model;
    assert.equal(f.state.key, chatKey); assert.equal(current.opening, true);
    assert.notEqual(current[changedField], prior[changedField], 'UI must receive the specific changed opening context');
    assert.equal(current.openingMessage, f.state.openingMessage);
    assert.equal(current.openingSwipe, f.state.openingMessage.swipe_id);
    assert.equal(current.openingRaw, f.state.openingMessage.mes);
    assert.deepEqual(current.messages, []); assert.deepEqual(current.paragraphs, []);
    assert.equal(f.view, initialView, 'only the opening child needs remounting, not the whole Gal overlay');
    assert.equal(f.calls.send, 0); assert.equal(f.state.draft, '保留草稿');
  });
}

test('removed choice callbacks cannot edit a reopened view or another chat', t => {
  const f = fixture(t, { state: { draft: '保留' } });
  f.controller.open(); const old = f.view;
  f.controller.close(); f.controller.open();
  old.callbacks.onChoice('旧选项');
  assert.equal(f.state.draft, '保留');
  f.state.key = 'card-b/chat-b'; f.view.callbacks.onChoice('跨聊选项');
  assert.equal(f.state.draft, '保留');
});

test('blank or busy input cannot generate, and rapid send clicks dispatch once', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  f.controller.open();
  f.view.callbacks.onSend();
  assert.equal(f.calls.send, 0);
  f.state.draft = '发一条真实消息';
  f.state.busy = true;
  f.view.callbacks.onSend();
  assert.equal(f.calls.send, 0);
  f.state.busy = false;
  f.view.callbacks.onSend();
  f.view.callbacks.onSend();
  assert.equal(f.calls.send, 1);
  assert.equal(f.view.model.busy, true);
  assert.equal(f.state.draft, '发一条真实消息');
  f.state.messages.push(message('发一条真实消息', { is_user: true }));
  f.state.draft = '';
  f.emit('sent');
  t.mock.timers.tick(4001);
  assert.equal(f.view.model.error, '');
  assert.equal(f.view.model.draft, '');
});

test('native send error unlocks the view without deleting text or retrying', t => {
  const f = fixture(t, { state: { draft: '保留这段' }, onSend() { throw new Error('native send unavailable'); } });
  f.controller.open();
  f.view.callbacks.onSend();
  assert.equal(f.view.model.busy, false);
  assert.match(f.view.model.error, /native send unavailable/);
  assert.equal(f.state.draft, '保留这段');
  assert.equal(f.calls.send, 1);
});

test('slash commands reveal native dialogs, dispatch once and retain the saved Gal preference', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t, { state: { draft: '  /chat-manager' } });
  const before = JSON.stringify(f.state.messages);
  f.controller.open(); const old = f.view;
  old.callbacks.onSend(); old.callbacks.onSend();
  assert.equal(f.controller.active, false);
  assert.equal(old.destroyed, 1);
  assert.equal(f.calls.cover.at(-1), false);
  assert.equal(f.calls.send, 1);
  assert.deepEqual(f.calls.modeClosed, []);
  assert.equal(f.state.draft, '  /chat-manager');
  assert.equal(JSON.stringify(f.state.messages), before);
  t.mock.timers.tick(5000);
  assert.equal(f.calls.notify.length, 0, 'commands do not wait for a message acknowledgement');
  f.controller.open(); assert.equal(f.controller.active, true);
});

test('busy or switched chats cannot hand off slash input', t => {
  for (const changed of ['busy', 'chat']) {
    const f = fixture(t, { state: { draft: '/newchat' } }); f.controller.open();
    if (changed === 'busy') f.state.busy = true;
    else f.state.key = 'card-a/chat-b';
    f.view.callbacks.onSend();
    assert.equal(f.calls.send, 0); assert.equal(f.view.destroyed, 0);
    assert.equal(f.state.draft, '/newchat');
  }
});

test('command dispatch errors leave native draft visible without retry or preference deletion', t => {
  const f = fixture(t, { state: { draft: '/chat-manager' }, onSend() { throw Error('native unavailable'); } });
  f.controller.open(); f.view.callbacks.onSend();
  assert.equal(f.controller.active, false); assert.equal(f.calls.send, 1);
  assert.equal(f.state.draft, '/chat-manager'); assert.deepEqual(f.calls.modeClosed, []);
  assert.match(f.calls.notify.at(-1), /酒馆指令未能提交.*native unavailable.*草稿保留/);
});

test('stop delegates to native stop without creating or rewriting a turn', t => {
  const f = fixture(t, { state: { busy: true, draft: '下一轮草稿' } });
  const before = JSON.stringify(f.state.messages);
  f.controller.open();
  f.view.callbacks.onStop();
  assert.equal(f.calls.stop, 1);
  assert.equal(f.calls.send, 0);
  assert.equal(f.view.model.busy, false);
  assert.equal(f.state.draft, '下一轮草稿');
  assert.equal(JSON.stringify(f.state.messages), before);
});

test('changing chat closes the cover and stale input callbacks cannot touch the new draft', t => {
  const f = fixture(t);
  f.controller.open();
  const old = f.view;
  f.state.key = 'card-a/chat-b';
  f.state.messages = [message('新聊天')];
  f.state.draft = '新聊天的草稿';
  f.emit('chat');
  old.callbacks.onDraft('旧页面迟到输入');
  old.callbacks.onSend();
  old.callbacks.onChoice('旧页面迟到选项');
  assert.equal(f.controller.active, false);
  assert.equal(old.destroyed, 1);
  assert.equal(f.calls.cover.at(-1), false);
  assert.equal(f.state.draft, '新聊天的草稿');
  assert.equal(f.calls.send, 0);
});

test('a late stop callback from the previous chat cannot cancel a new chat generation', t => {
  const f = fixture(t, { state: { busy: true } });
  f.controller.open();
  const old = f.view;
  // A chat switch may be visible in read() before its UI event reaches us.
  f.state.key = 'card-b/chat-b';
  f.state.busy = true;
  old.callbacks.onStop();
  assert.equal(f.calls.stop, 0, 'old chat must not issue native stop in the new chat');
  assert.equal(f.state.busy, true);
});

test('history keeps the selected native message after earlier deletion and follows if it is removed', t => {
  const a = message('开头'), b = message('要回看的内容'), c = message('最新内容');
  const f = fixture(t, { state: { messages: [a, b, c] } });
  f.controller.open();
  f.view.callbacks.onSelectMessage(f.view.model.messages[1].id);
  assert.equal(f.view.model.history, true);
  f.state.messages.splice(0, 1);
  f.emit('deleted');
  assert.equal(f.view.model.paragraphs[0].text, '要回看的内容');
  assert.match(f.view.model.messages[0].label, /^0 ·/);
  f.state.messages.splice(0, 1);
  f.emit('deleted');
  assert.equal(f.view.model.paragraphs[0].text, '最新内容');
  assert.equal(f.view.model.history, false);
});

test('swipe and edit refresh visible text and keep the cursor within real paragraphs', t => {
  const m = message('旧第一段\n\n旧第二段\n\n旧第三段');
  const f = fixture(t, { state: { messages: [m] } });
  f.controller.open();
  f.view.callbacks.onSelectParagraph(2);
  m.mes = '另一个回复'; m.swipe_id = 1;
  f.emit('swiped');
  assert.equal(f.view.model.paragraphs[0].text, '另一个回复');
  assert.equal(f.view.model.paragraphIndex, 0);
  m.mes = '编辑后的第一段\n\n编辑后的第二段';
  f.emit('edited');
  f.view.callbacks.onSelectParagraph(1);
  m.mes = '编辑后仅剩一段';
  f.emit('updated');
  assert.equal(f.view.model.paragraphIndex, 0);
  assert.equal(f.view.model.paragraphs[0].text, '编辑后仅剩一段');
});

test('opening the terminal keeps Gal, its selected paragraph and draft intact', t => {
  const f = fixture(t, { state: { draft: '未发送的终端计划' } });
  f.controller.open();
  f.view.callbacks.onSelectParagraph(1);
  const view = f.view;
  f.view.callbacks.onTerminal();
  assert.equal(f.calls.terminalOpen, 1);
  assert.equal(f.controller.active, true);
  assert.equal(f.view, view);
  assert.equal(view.destroyed, 0);
  assert.equal(f.views.length, 1);
  assert.deepEqual(f.calls.cover, [true]);
  assert.equal(f.calls.nativeFocus, 0);
  assert.equal(f.view.model.paragraphIndex, 1);
  assert.equal(f.state.draft, '未发送的终端计划');
  assert.equal(f.view.model.draft, f.state.draft);
  f.controller.focusTerminal();
  assert.equal(view.terminalFocusCount, 1);
  delete view.focusTerminal;
  assert.doesNotThrow(() => f.controller.focusTerminal(), 'terminal focus is optional');
});

test('missing or failed terminal bridge displays an error while keeping Gal and draft', t => {
  for (const options of [{ terminalAvailable: false }, { onTerminal() { throw Error('此楼没有终端'); } }]) {
    const f = fixture(t, { ...options, state: { draft: '终端不可用也保留' } });
    f.controller.open();
    f.view.callbacks.onSelectParagraph(1);
    f.view.callbacks.onTerminal();
    assert.equal(f.controller.active, true);
    assert.equal(f.view.destroyed, 0);
    assert.deepEqual(f.calls.cover, [true]);
    assert.equal(f.view.model.paragraphIndex, 1);
    assert.equal(f.state.draft, '终端不可用也保留');
    assert.match(f.view.model.error, /终端/);
    assert.equal(f.calls.nativeFocus, 0);
    assert.equal(f.calls.send, 0);
  }
});

test('a rejected workshop request from a closed view cannot add its error to a reopened view in the same chat', async t => {
  const pending = [];
  const f = fixture(t, { state: { draft: '保留工坊打开前的草稿' },
    openWorkshop: () => new Promise((resolve, reject) => pending.push(reject)),
  });
  f.controller.open();
  const oldView = f.view, chatKey = f.state.key;
  const oldRequest = oldView.callbacks.onWorkshop();
  f.controller.close();
  f.controller.open();
  const newView = f.view, renders = newView.renders;
  assert.notEqual(newView, oldView);
  assert.equal(f.state.key, chatKey, 'same-chat reopening must still isolate the old view');
  assert.equal(oldView.destroyed, 1);
  pending.shift()(Error('旧工坊请求迟到失败'));
  await oldRequest;
  assert.equal(newView.model.error, '');
  assert.equal(newView.renders, renders, 'the stale rejection must not rerender the new view');
  assert.equal(f.state.draft, '保留工坊打开前的草稿');
  assert.equal(f.controller.active, true);
  const currentRequest = newView.callbacks.onWorkshop();
  pending.shift()(Error('当前工坊请求失败'));
  await currentRequest;
  assert.equal(newView.model.error, '当前工坊请求失败', 'the current view still reports its own failures');
});

test('render failure releases native chat and does not leave a live broken overlay', t => {
  const f = fixture(t, { state: { draft: '故障也要保留' } });
  f.controller.open();
  const old = f.view;
  f.failRendering();
  f.emit('updated');
  assert.equal(f.controller.active, false);
  assert.equal(old.destroyed, 1);
  assert.equal(f.calls.cover.at(-1), false);
  assert.equal(f.calls.nativeFocus, 1);
  assert.match(f.calls.notify.at(-1), /恢复原生聊天/);
  assert.equal(f.state.draft, '故障也要保留');
});

test('mount failure leaves native chat available', t => {
  const f = fixture(t, { failMount: true });
  f.controller.open();
  assert.equal(f.controller.active, false);
  assert.equal(f.calls.cover.includes(true), false);
  assert.equal(f.calls.cover.at(-1), false);
  assert.match(f.calls.notify.at(-1), /未能打开/);
});

test('destroy cancels pending work, unsubscribes once and prevents reopening', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t, { state: { draft: '只发一次' } });
  f.controller.open();
  const old = f.view;
  old.callbacks.onSend();
  f.controller.destroy();
  const renders = old.renders;
  t.mock.timers.tick(5000);
  f.emit('sent');
  f.controller.destroy();
  f.controller.open();
  assert.equal(old.destroyed, 1);
  assert.equal(old.renders, renders);
  assert.equal(f.calls.unsubscribe, 1);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.views.length, 1);
  assert.equal(f.controller.active, false);
  assert.equal(f.calls.send, 1);
});

test('callbacks left by a removed overlay cannot stop or send after destroy', t => {
  const f = fixture(t, { state: { draft: '原生草稿', busy: true } });
  f.controller.open();
  const old = f.view;
  f.controller.destroy();
  old.callbacks.onStop();
  old.callbacks.onSend();
  old.callbacks.onDraft('无效输入');
  assert.equal(f.calls.stop, 0);
  assert.equal(f.calls.send, 0);
  assert.equal(f.state.draft, '原生草稿');
});

test('player text never drives the AI cast', t => {
  const f = fixture(t, { state: { messages: [message('祥子：这是玩家输入的引用。', { is_user: true })] } });
  f.controller.open();
  assert.deepEqual(f.view.model.sprites, []);
});

