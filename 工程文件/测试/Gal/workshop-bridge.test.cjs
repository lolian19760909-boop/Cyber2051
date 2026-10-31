'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { create } = require("../../卡片源码/Gal/workshop-bridge.js");
const ID = '9a9d6e73-5111-4c64-89c7-98717bbbdf3b';
const UPDATE = 'section[role="dialog"][aria-label="内容更新"]';

function node(tagName, ownerDocument) {
  const attrs = new Map(), listeners = new Map();
  return { tagName: tagName.toUpperCase(), ownerDocument, attrs, listeners, children: [], parentElement: null,
    textContent: '', shown: false, baseConnected: false,
    get isConnected() { return this.baseConnected || Boolean(this.parentElement?.isConnected); },
    append(child) { this.children.push(child); child.parentElement = this; },
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(item => item !== this); this.parentElement = null; this.removed = true; },
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, event = {}) { [...(listeners.get(name) || [])].forEach(fn => fn(event)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    hasAttribute: name => attrs.has(name), setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name),
    querySelectorAll(selector) { return this.children.flatMap(child => [...(selector === 'button' && child.tagName === 'BUTTON' ? [child] : []), ...child.querySelectorAll(selector)]); },
    querySelector() { return null; },
    matches(selector) { return selector === ':popover-open' ? this.shown : selector === UPDATE && this.tagName === 'SECTION' && attrs.get('role') === 'dialog' && attrs.get('aria-label') === '内容更新'; },
    showPopover() { this.shown = true; }, hidePopover() { this.shown = false; },
    focus() { this.focused = true; if (ownerDocument) ownerDocument.activeElement = this; },
    click() { this.emit('click'); },
  };
}
function fixture(t) {
  let valid = true, bottom = 80, emitAction;
  const observers = [], styles = [], calls = { events: [], closed: [], workshopClosed: 0, updateClosed: 0 };
  class Observer {
    constructor(fn) { this.fn = fn; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  const win = Object.assign(node('window'), { MutationObserver: Observer, setTimeout: fn => setTimeout(fn, 0), clearTimeout });
  const doc = Object.assign(node('document'), { defaultView: win,
    createElement(tag) { const value = node(tag, doc); if (tag === 'style') styles.push(value); return value; },
    querySelector(selector) { return selector === '#cxx-galgame-root .cxx-gal-header' ? { getBoundingClientRect: () => ({ bottom }) } : null; },
    querySelectorAll(selector) {
      if (selector === UPDATE) return this.body.children.filter(child => child.matches(UPDATE));
      return this.body.children.filter(child => child.tagName === 'IFRAME' && child.id === 'TH-script--创意工坊--' + ID);
    },
  });
  doc.body = node('body', doc); doc.body.baseConnected = true; doc.head = node('head', doc); doc.head.baseConnected = true;
  const opener = node('button', doc); doc.body.append(opener); doc.activeElement = opener;
  const inner = Object.assign(node('document'), { readyState: 'complete', defaultView: node('window') });
  inner.body = node('body', inner); inner.body.baseConnected = true;
  const frame = node('iframe', doc); frame.id = 'TH-script--创意工坊--' + ID; frame.contentDocument = inner;
  frame.setAttribute('style', 'display:none'); doc.body.append(frame);
  let shell;
  function makeWorkshop(scope = inner) {
    const root = node('div', scope), panel = node('div', scope), head = node('div', scope), title = node('div', scope), close = node('button', scope), tabs = node('div', scope);
    title.textContent = '创意工坊'; close.textContent = '✕';
    head.append(title); head.append(close);
    for (const label of ['目录', '投稿', '我的']) { const button = node('button', scope); button.textContent = label; tabs.append(button); }
    panel.append(head); panel.append(tabs); panel.append(node('div', scope)); panel.append(node('div', scope)); root.append(panel); scope.body.append(root);
    close.addEventListener('click', () => { calls.workshopClosed++; root.remove(); });
    shell = { root, panel, head, title, close, tabs }; return shell;
  }
  function makeUpdate() {
    const panel = node('section', doc); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '内容更新'); panel.businessState = { pendingChoice: 3 }; doc.body.append(panel);
    function redraw() {
      [...panel.children].forEach(child => child.remove());
      const close = node('button', doc); close.textContent = '关闭'; panel.append(close);
      close.addEventListener('click', () => { calls.updateClosed++; panel.remove(); }); return close;
    }
    return { panel, redraw, close: redraw() };
  }
  const buttons = { [ID]: [{ button_name: '创意工坊', button_id: 'verified-helper-button-id' }] };
  emitAction = () => makeWorkshop();
  const api = create({ document: doc, isCurrent: () => valid, getAllEnabledScriptButtons: () => buttons,
    eventEmit: async id => { calls.events.push(id); await emitAction(); }, onClose: reason => calls.closed.push(reason) });
  t.after(() => api.destroy());
  return { api, doc, frame, inner, opener, win, calls, styles, observers, buttons, makeWorkshop, makeUpdate,
    get shell() { return shell; }, current(value) { valid = value; }, header(value) { bottom = value; }, emitter(fn) { emitAction = fn; },
    mutate() { for (const observer of [...observers]) if (!observer.disconnected) observer.fn(); },
  };
}

test('uses the enabled helper button and promotes the exact original hidden script frame', async t => {
  const f = fixture(t); f.frame.setAttribute('popover', 'auto');
  assert.equal(await f.api.open(), true); assert.equal(f.api.mode, 'workshop'); assert.equal(f.api.active, true);
  assert.deepEqual(f.calls.events, ['verified-helper-button-id']); assert.equal(f.frame.parentElement, f.doc.body);
  assert.equal(f.shell.root.parentElement, f.inner.body); assert.equal(f.frame.getAttribute('style'), 'display:none');
  assert.match(f.styles[0].textContent, /display:block!important/); assert.match(f.styles[0].textContent, /inset:80px 0 0!important/);
  assert.equal(f.shell.close.focused, true); await f.api.open(); assert.equal(f.calls.events.length, 1);
  f.api.close(); assert.equal(f.calls.workshopClosed, 1); assert.equal(f.frame.shown, false);
  assert.equal(f.frame.getAttribute('popover'), 'auto'); assert.equal(f.frame.hasAttribute('data-cxx-gal-workshop'), false);
  assert.equal(f.frame.getAttribute('style'), 'display:none'); assert.equal(f.api.active, false);
  assert.ok(f.styles.every(style => style.removed)); assert.ok(f.observers.every(observer => observer.disconnected));
  assert.deepEqual(f.calls.closed, []);
});

test('rejects disabled buttons and unrelated frames or unrecognized workshop shells', async t => {
  const f = fixture(t); f.buttons[ID] = [];
  await assert.rejects(f.api.open(), /启用/); assert.equal(f.calls.events.length, 0);
  f.buttons[ID] = [{ button_name: '创意工坊', button_id: 'enabled' }];
  f.frame.id = 'TH-script--other--' + ID; await assert.rejects(f.api.open(), /没有找到/);
  assert.equal(f.frame.shown, false); f.frame.id = 'TH-script--创意工坊--' + ID;
  f.emitter(() => { [...f.inner.body.children].forEach(child => child.remove()); const shell = f.makeWorkshop(); shell.title.textContent = '其他界面'; });
  await assert.rejects(f.api.open(), /没有找到/); assert.equal(f.styles.length, 0);
});

test('checks chat identity and cancellation again after awaiting the real button event', async t => {
  const f = fixture(t); let resolve;
  f.emitter(() => new Promise(done => { resolve = done; }));
  const first = f.api.open(); f.current(false); resolve(); await assert.rejects(first, /已切换/);
  assert.equal(f.frame.shown, false); assert.equal(f.api.active, false);
  f.current(true); const second = f.api.open(); f.api.close(); resolve(); await assert.rejects(second, /已切换/);
  assert.equal(f.frame.shown, false); assert.equal(f.api.active, false);
});

test('closing while the original button promise resolves removes only its already-created shell', async t => {
  const f = fixture(t); let resolve;
  f.emitter(() => { f.makeWorkshop(); return new Promise(done => { resolve = done; }); });
  const opening = f.api.open(); assert.equal(f.shell.root.isConnected, true);
  f.api.close(); assert.equal(f.shell.root.isConnected, false); assert.equal(f.calls.workshopClosed, 1);
  resolve(); await assert.rejects(opening, /已切换/); assert.equal(f.frame.shown, false);
});

test('opening workshop closes an existing ordinary update panel using its native close action', async t => {
  const f = fixture(t), update = f.makeUpdate();
  await f.api.open(); assert.equal(update.panel.isConnected, false); assert.equal(f.calls.updateClosed, 1);
  assert.equal(f.api.mode, 'workshop'); assert.deepEqual(update.panel.businessState, { pendingChoice: 3 });
});

test('native close, Escape and resized header preserve the Gal return path', async t => {
  const f = fixture(t); await f.api.open(); f.header(54); f.win.emit('resize');
  assert.match(f.styles[0].textContent, /inset:54px 0 0!important/);
  f.inner.emit('keydown', { key: 'Escape', isComposing: true }); assert.equal(f.api.active, true);
  let prevented = 0; f.inner.emit('keydown', { key: 'Escape', preventDefault() { prevented++; } });
  assert.equal(prevented, 1); assert.equal(f.calls.workshopClosed, 1); assert.deepEqual(f.calls.closed, ['escape']);
  await f.api.open(); f.shell.close.click(); f.mutate(); assert.equal(f.api.active, false);
  assert.deepEqual(f.calls.closed, ['escape', 'closed']);
});

test('update handoff promotes the existing host panel and follows its newly rendered native close button', async t => {
  const f = fixture(t); await f.api.open(); const update = f.makeUpdate();
  f.mutate(); assert.equal(f.api.mode, 'update'); assert.equal(f.frame.shown, false); assert.equal(f.calls.workshopClosed, 1);
  assert.equal(update.panel.shown, true); assert.equal(update.panel.parentElement, f.doc.body);
  assert.deepEqual(update.panel.businessState, { pendingChoice: 3 }); assert.deepEqual(f.calls.closed, []);
  assert.match(f.styles.at(-1).textContent, /top:88px!important/);
  update.redraw(); f.api.close(); assert.equal(f.calls.updateClosed, 1); assert.equal(f.api.active, false);
  assert.deepEqual(update.panel.businessState, { pendingChoice: 3 }); assert.equal(update.panel.hasAttribute('popover'), false);
});

test('terminal may pass a known update panel directly; removal or Escape releases it once', t => {
  const f = fixture(t), update = f.makeUpdate();
  assert.equal(f.api.openUpdate(update.panel), true); assert.equal(f.api.openUpdate(update.panel), true);
  assert.equal(f.calls.events.length, 0); assert.equal(f.api.mode, 'update');
  update.close.click(); f.mutate(); f.mutate(); assert.deepEqual(f.calls.closed, ['closed']);
  const next = f.makeUpdate(); f.api.openUpdate(next.panel);
  f.doc.querySelector = () => null;
  f.doc.emit('keydown', { key: 'Escape', preventDefault() {} }); assert.equal(f.api.active, false);
  assert.equal(f.calls.updateClosed, 2); assert.deepEqual(f.calls.closed, ['closed', 'escape']);
});

test('chat switch and frame reload clean up without touching the replacement document', async t => {
  const f = fixture(t); await f.api.open(); f.current(false); f.mutate();
  assert.equal(f.api.active, false); assert.deepEqual(f.calls.closed, ['context']);
  f.current(true); await f.api.open(); const before = f.calls.workshopClosed;
  f.frame.contentDocument = {}; f.frame.emit('load');
  assert.equal(f.calls.workshopClosed, before); assert.equal(f.api.active, false);
  assert.equal(f.inner.listeners.get('keydown').size, 0); assert.deepEqual(f.calls.closed, ['context', 'unloaded']);
});

test('failed promotion rolls back temporary state and destroy forbids another open', async t => {
  const f = fixture(t); f.frame.showPopover = () => { throw Error('promotion failed'); };
  await assert.rejects(f.api.open(), /promotion failed/); assert.equal(f.api.active, false);
  assert.equal(f.calls.workshopClosed, 1); assert.ok(f.styles.every(style => style.removed));
  assert.equal(f.frame.getAttribute('style'), 'display:none'); assert.equal(f.frame.hasAttribute('popover'), false);
  f.api.destroy(); await assert.rejects(f.api.open(), /不可用/); assert.deepEqual(f.calls.closed, []);
});

test('unsupported promotion also closes the original hidden shell without any style mutation', async t => {
  const f = fixture(t); f.frame.showPopover = undefined;
  await assert.rejects(f.api.open(), /不支持/); assert.equal(f.calls.workshopClosed, 1);
  assert.equal(f.styles.length, 0); assert.equal(f.frame.getAttribute('style'), 'display:none');
});

test('new parent shell is promoted in place with flex layout and panel height below the Gal header', async t => {
  const f = fixture(t); f.emitter(() => {
    const shell = f.makeWorkshop(f.doc);
    shell.root.setAttribute('style', 'display:flex;background:rgba(0,0,0,.55)');
    shell.root.setAttribute('popover', 'auto'); shell.panel.setAttribute('style', 'max-height:86vh;overflow:auto');
  });
  await f.api.open(); const shell = f.shell;
  assert.equal(f.frame.shown, false); assert.equal(shell.root.shown, true);
  assert.equal(shell.root.parentElement, f.doc.body); assert.equal(f.api.mode, 'workshop');
  assert.match(f.styles[0].textContent, /display:flex!important/);
  assert.match(f.styles[0].textContent, /height:calc\(100dvh - 80px\)!important/);
  assert.match(f.styles[0].textContent, />div\{max-height:100%!important/);
  assert.doesNotMatch(f.styles[0].textContent, /background:transparent/);
  assert.equal(f.observers.length, 1); f.header(54); f.win.emit('resize');
  assert.match(f.styles[0].textContent, /height:calc\(100dvh - 54px\)!important/);
  await f.api.open(); assert.equal(f.calls.events.length, 1);
  f.api.close(); assert.equal(f.calls.workshopClosed, 1); assert.equal(shell.root.shown, false);
  assert.equal(shell.root.getAttribute('style'), 'display:flex;background:rgba(0,0,0,.55)');
  assert.equal(shell.root.getAttribute('popover'), 'auto'); assert.equal(shell.root.hasAttribute('data-cxx-gal-workshop'), false);
  assert.equal(shell.panel.getAttribute('style'), 'max-height:86vh;overflow:auto');
  assert.equal(f.frame.getAttribute('style'), 'display:none'); assert.equal(f.frame.hasAttribute('popover'), false);
  assert.equal(f.opener.focused, true); assert.ok(f.styles.every(style => style.removed));
});

test('parent native close and Escape respect IME, handled keys and an open native dialog', async t => {
  const f = fixture(t); f.emitter(() => f.makeWorkshop(f.doc)); await f.api.open();
  for (const fields of [{ isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }]) {
    f.doc.emit('keydown', { key: 'Escape', ...fields }); assert.equal(f.api.active, true);
  }
  const originalQuery = f.doc.querySelector;
  f.doc.querySelector = selector => selector === 'dialog[open]' ? {} : originalQuery(selector);
  f.doc.emit('keydown', { key: 'Escape' }); assert.equal(f.api.active, true); f.doc.querySelector = originalQuery;
  f.doc.emit('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(f.api.active, false); assert.deepEqual(f.calls.closed, ['escape']);
  await f.api.open(); f.shell.close.click(); f.mutate(); f.mutate();
  assert.deepEqual(f.calls.closed, ['escape', 'closed']); assert.equal(f.doc.listeners.get('keydown').size, 0);
});

test('late parent panel can appear after the button event has settled', async t => {
  const f = fixture(t); let timer;
  f.emitter(() => { timer = setTimeout(() => f.makeWorkshop(f.doc), 5); });
  t.after(() => clearTimeout(timer)); await f.api.open();
  assert.equal(f.shell.root.shown, true); assert.equal(f.frame.shown, false);
});

test('pending duplicate open is refused, and a cancelled late parent shell is closed by its native button', async t => {
  const f = fixture(t); let resolve;
  f.emitter(() => new Promise(done => { resolve = done; }));
  const opening = f.api.open(); await assert.rejects(f.api.open(), /正在打开/);
  assert.equal(f.calls.events.length, 1); f.api.close(); f.makeWorkshop(f.doc); resolve();
  await assert.rejects(opening, /已切换/); assert.equal(f.calls.workshopClosed, 1);
  assert.equal(f.shell.root.isConnected, false); assert.equal(f.styles.length, 0);
});

test('an older cancelled promise cannot close or promote the next successful parent workshop', async t => {
  const f = fixture(t); let resolve;
  f.emitter(() => new Promise(done => { resolve = done; })); const old = f.api.open(); f.api.close();
  f.emitter(() => f.makeWorkshop(f.doc)); await f.api.open(); const next = f.shell;
  resolve(); await assert.rejects(old, /已切换/);
  assert.equal(f.api.active, true); assert.equal(next.root.shown, true); assert.equal(f.calls.workshopClosed, 0);
  f.api.close(); assert.equal(f.calls.workshopClosed, 1);
});

test('ambiguous parent or cross-document workshop shells are refused without choosing or deleting any', async t => {
  for (const mixed of [false, true]) {
    const f = fixture(t); let first, second;
    f.emitter(() => { first = f.makeWorkshop(f.doc); second = f.makeWorkshop(mixed ? f.inner : f.doc); });
    await assert.rejects(f.api.open(), /多个工坊/);
    assert.equal(first.root.isConnected, true); assert.equal(second.root.isConnected, true);
    assert.equal(f.calls.workshopClosed, 0); assert.equal(f.styles.length, 0);
  }
});

test('parent lookalikes still require one exact script frame and a newly emitted business shell', async t => {
  const f = fixture(t), previous = f.makeWorkshop(f.doc);
  f.frame.id = 'unrelated'; await assert.rejects(f.api.open(), /没有找到/);
  assert.equal(f.calls.events.length, 0); assert.equal(previous.root.isConnected, true);
  f.frame.id = 'TH-script--创意工坊--' + ID; f.emitter(() => {});
  await assert.rejects(f.api.open(), /没有找到/); assert.equal(previous.root.isConnected, true);
  assert.equal(f.calls.workshopClosed, 0); assert.equal(previous.root.shown, false);
  previous.root.setAttribute('data-cxx-gal-workshop', 'other');
  await assert.rejects(f.api.open(), /其他界面/); assert.equal(f.calls.events.length, 1);
});

test('parent chat change and script pagehide close business, while frame replacement is never invoked', async t => {
  const f = fixture(t); f.emitter(() => f.makeWorkshop(f.doc)); await f.api.open();
  f.current(false); f.mutate(); assert.equal(f.calls.workshopClosed, 1); assert.equal(f.api.active, false);
  f.current(true); await f.api.open(); f.inner.defaultView.emit('pagehide');
  assert.equal(f.calls.workshopClosed, 2); assert.deepEqual(f.calls.closed, ['context', 'unloaded']);
  await f.api.open(); const oldShell = f.shell; f.frame.contentDocument = {}; f.frame.emit('load');
  assert.equal(f.calls.workshopClosed, 2); assert.equal(f.api.active, false);
  assert.equal(oldShell.root.shown, false); assert.equal(oldShell.root.hasAttribute('popover'), false);
  assert.equal(f.inner.defaultView.listeners.get('pagehide').size, 0);
});

test('host pagehide destroys the bridge and restores all parent presentation listeners', async t => {
  const f = fixture(t); f.emitter(() => f.makeWorkshop(f.doc)); await f.api.open(); f.win.emit('pagehide');
  assert.equal(f.calls.workshopClosed, 1); assert.equal(f.api.active, false);
  assert.equal(f.win.listeners.get('pagehide').size, 0); assert.equal(f.win.listeners.get('resize').size, 0);
  assert.equal(f.frame.listeners.get('load').size, 0); assert.equal(f.doc.listeners.get('keydown').size, 0);
  assert.ok(f.observers.every(observer => observer.disconnected)); assert.ok(f.styles.every(style => style.removed));
  await assert.rejects(f.api.open(), /不可用/);
});

test('new parent panel hands off to the existing update panel once and preserves business state', async t => {
  const f = fixture(t); f.emitter(() => f.makeWorkshop(f.doc)); await f.api.open(); const shell = f.shell, update = f.makeUpdate();
  f.mutate(); f.mutate(); assert.equal(f.api.mode, 'update'); assert.equal(f.calls.workshopClosed, 1);
  assert.equal(shell.root.shown, false); assert.equal(shell.root.hasAttribute('popover'), false);
  assert.equal(update.panel.shown, true); assert.deepEqual(update.panel.businessState, { pendingChoice: 3 });
  assert.equal(f.api.openUpdate(update.panel), true); assert.equal(f.styles.length, 2);
  f.api.close(); assert.equal(f.calls.updateClosed, 1); assert.deepEqual(f.calls.closed, []);
});

test('duplicate update roots are refused, and parent promotion failure restores original attributes', async t => {
  const f = fixture(t), first = f.makeUpdate(), second = f.makeUpdate();
  assert.throws(() => f.api.openUpdate(first.panel), /没有找到/);
  assert.equal(first.panel.shown, false); assert.equal(second.panel.shown, false);
  first.panel.remove(); second.panel.remove();
  f.emitter(() => { const shell = f.makeWorkshop(f.doc); shell.root.showPopover = () => { throw Error('parent promotion failed'); }; });
  await assert.rejects(f.api.open(), /parent promotion failed/);
  assert.equal(f.calls.workshopClosed, 1); assert.equal(f.shell.root.hasAttribute('popover'), false);
  assert.equal(f.api.active, false); assert.ok(f.styles.every(style => style.removed));
});
