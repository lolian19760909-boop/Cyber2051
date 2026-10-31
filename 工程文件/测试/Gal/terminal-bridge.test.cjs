'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require("../../卡片源码/Gal/terminal-bridge.js");

function fixture({ m18 = false, hidden = !m18 } = {}) {
  const observers = [], outerStyles = [], innerStyles = [], calls = { open: 0, close: 0, returned: 0 };
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(node) { this.node = node; }
    disconnect() { this.disconnected = true; }
  }
  const style = () => ({ textContent: '', remove() { this.removed = true; } });
  const terminal = { hidden };
  const fab = { click() { calls.open++; terminal.hidden = false; chat.scrollTop = 99; } };
  const closeButton = { click() { calls.close++; terminal.hidden = true; } };
  const nodes = { 't2051x-fab': fab, 't2051x-terminal': terminal, 't2051x-close-terminal': closeButton };
  const inner = { head: { append(n) { innerStyles.push(n); } }, createElement: style, getElementById: id => nodes[id] };
  if (m18) {
    for (const key of Object.keys(nodes)) delete nodes[key];
    const element = (tagName, parentElement, target = {}) => Object.assign(target, { tagName, parentElement,
      contains(node) { for (let current = node; current; current = current.parentElement) if (current === this) return true; return false; } });
    inner.body = element('BODY');
    nodes.landing = element('SECTION', inner.body);
    nodes.launch = element('BUTTON', nodes.landing, fab);
    nodes.terminal = element('DIV', inner.body, terminal);
    nodes['close-terminal'] = element('BUTTON', element('HEADER', terminal), closeButton);
    nodes['system-nav'] = element('NAV', terminal);
    nodes.workspace = element('MAIN', terminal);
    nodes['page-city'] = element('SECTION', nodes.workspace);
    const noop = () => {};
    inner.defaultView = { TOKYO_TERMINAL_HOST: { readState: noop, changed: noop },
      TOKYO_TERMINAL_MAP_LINKS: { openQuest: noop, closeTerminal: noop },
      TOKYO_TERMINAL_MAP_CONTROL: { focus: noop, escape: noop } };
  }
  const attrs = new Map(), events = new Map();
  const frame = { isConnected: true, contentDocument: inner, mesid: '4', shown: false,
    closest() { return { getAttribute: () => this.mesid }; },
    getAttribute: key => attrs.has(key) ? attrs.get(key) : null,
    hasAttribute: key => attrs.has(key), setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key),
    matches() { return this.shown; }, showPopover() { this.shown = true; }, hidePopover() { this.shown = false; },
    addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) };
  const frames = [frame];
  const chat = { scrollTop: 12, querySelectorAll: () => frames, contains: node => frames.includes(node) && node.isConnected };
  const doc = { defaultView: { MutationObserver: Observer }, head: { append(n) { outerStyles.push(n); } },
    createElement: style, getElementById: id => id === 'chat' ? chat : null };
  frame.ownerDocument = doc;
  const api = create({ document: doc, onClose() { calls.returned++; } });
  return { api, doc, inner, nodes, frame, frames, chat, terminal, fab, closeButton, attrs, events, calls, observers, outerStyles, innerStyles,
    mutate(node) { for (const observer of observers) if (!observer.disconnected && observer.node === node) observer.callback(); } };
}

