'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { create, isOpeningSource } = require("../../卡片源码/Gal/opening-bridge.js");

function events(target = {}) {
  const listeners = new Map();
  return Object.assign(target, {
    listeners,
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    emit(name, value = {}) { [...(listeners.get(name) || [])].forEach(callback => callback(value)); },
  });
}

function fixture(t) {
  let valid = true, headerBottom = 80, frames = [];
  const calls = { close: [], status: [], focused: 0, moved: 0 };
  const observers = [], styles = [];
  const style = () => { const node = { textContent: '', remove() { this.removed = true; } }; styles.push(node); return node; };
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(node) { this.node = node; }
    disconnect() { this.disconnected = true; }
  }
  const win = events({ MutationObserver: Observer });
  const chat = { scrollTop: 37, querySelectorAll: () => frames };
  const opener = { isConnected: true, focus() { calls.focused++; } };
  const doc = {
    defaultView: win, head: { append() {} }, activeElement: opener, createElement: style,
    getElementById: id => id === 'chat' ? chat : null,
    querySelector: () => ({ getBoundingClientRect: () => ({ bottom: headerBottom }) }),
  };
  const api = create({ document: doc, isCurrent: () => valid,
    onClose: reason => calls.close.push(reason), onStatus: value => calls.status.push(value) });
  t.after(() => api.destroy());
  function frame(swipeId = 0, marks = ['.di-wrap', '.di-start-btn']) {
    const attrs = new Map([['loading', 'lazy']]);
    const inner = events({ readyState: 'complete', body: {}, head: { append() {} }, createElement: style,
      marks: new Set(marks), querySelector(selector) { return this.marks.has(selector) ? {} : null; } });
    const mes = { getAttribute: key => key === 'mesid' ? node.mesid : key === 'swipeid' ? String(node.swipeId) : null };
    const node = events({ id: 'TH-message--0--0', contentDocument: inner, mesid: '0', swipeId, attrs, shown: false,
      getAttribute: key => attrs.has(key) ? attrs.get(key) : null,
      hasAttribute: key => attrs.has(key), setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key),
      closest: () => mes, matches() { return this.shown; }, showPopover() { this.shown = true; }, hidePopover() { this.shown = false; },
      append() { calls.moved++; }, appendChild() { calls.moved++; },
    });
    return node;
  }
  return { api, calls, doc, chat, win, styles, observers, frame,
    setFrames(value) { frames = value; }, current(value) { valid = value; }, header(value) { headerBottom = value; },
    mutate() { for (const observer of observers) if (!observer.disconnected) observer.callback(); },
  };
}

