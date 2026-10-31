'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require("../../卡片源码/Gal/status-bridge.js");

function node() {
  const listeners = new Map(), attrs = new Map();
  return {
    listeners, attrs, children: [], isConnected: true,
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, event = {}) { [...(listeners.get(name) || [])].forEach(fn => fn(event)); },
    getAttribute: name => attrs.has(name) ? attrs.get(name) : null,
    hasAttribute: name => attrs.has(name), setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name),
    append(child) { this.children.push(child); child.parent = this; },
    remove() { this.removed = true; this.isConnected = false; },
    focus() { this.focused = true; },
  };
}

function fixture(t) {
  const observers = [], outer = [], innerNodes = [], calls = { returned: 0, terminalClosed: 0, originalFocus: 0 };
  let frames = [], headerBottom = 80, modalOpen = false;
  class Observer {
    constructor(fn) { this.fn = fn; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  const win = Object.assign(node(), { MutationObserver: Observer });
  const chat = { scrollTop: 30, querySelectorAll: () => frames, contains: frame => frames.includes(frame) };
  const terminal = { hidden: true }, terminalClose = { click() { calls.terminalClosed++; terminal.hidden = true; } };
  const ids = new Map(['diary', 'vList', 'vDetail'].map(id => [id, {}]));
  ids.set('t2051x-terminal', terminal); ids.set('t2051x-close-terminal', terminalClose);
  const inner = Object.assign(node(), { readyState: 'complete', body: node(), head: node(),
    getElementById: id => ids.get(id), querySelector: () => modalOpen ? {} : null,
    createElement() { const n = node(); innerNodes.push(n); return n; },
  });
  const doc = { defaultView: win, head: node(), activeElement: { isConnected: true, focus() { calls.originalFocus++; } },
    getElementById: id => id === 'chat' ? chat : null,
    querySelector: () => ({ getBoundingClientRect: () => ({ bottom: headerBottom }) }),
    createElement() { const n = node(); outer.push(n); return n; },
  };
  const frame = Object.assign(node(), { contentDocument: inner, mesid: '4', swipe: '0', user: 'false', shown: false,
    closest() { return { getAttribute: key => ({ mesid: this.mesid, swipeid: this.swipe, is_user: this.user })[key] ?? null }; },
    matches() { return this.shown; }, showPopover() { this.shown = true; }, hidePopover() { this.shown = false; },
  });
  frames = [frame];
  const api = create({ document: doc, onClose() { calls.returned++; } });
  t.after(() => api.destroy());
  return { api, frame, inner, ids, terminal, terminalClose, doc, win, chat, outer, innerNodes, calls, observers,
    returnButton: () => innerNodes.find(n => n.id === 'cxx-gal-status-return'),
    mutate() { for (const o of observers) if (!o.disconnected) o.fn(); },
    setFrames(value) { frames = value; }, header(value) { headerBottom = value; }, modal(value) { modalOpen = value; },
  };
}

