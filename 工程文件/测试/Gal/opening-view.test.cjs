'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { mount } = require("../../卡片源码/Gal/opening-view.js");

// Small DOM fixture with real event bubbling and disabled-button semantics; no host APIs.
function documentFixture() {
  const document = { createElement: tag => new Element(tag) };
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.ownerDocument = document; this.children = []; this.attrs = new Map(); this.listeners = new Map(); this.className = ''; this.value = ''; this.disabled = false; this.text = ''; }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    replaceChildren(...children) { this.children.forEach(child => { child.parentElement = null; }); this.children = []; this.append(...children); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    matches(selector) {
      if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1));
      const attr = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
      return attr ? this.attrs.has(attr[1]) && (attr[2] === undefined || this.attrs.get(attr[1]) === attr[2]) : this.tagName === selector.toUpperCase();
    }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    contains(value) { return value === this || this.children.some(child => child.contains(value)); }
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
    removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
    emit(name, data = {}) { const event = { target: this, ...data }; for (let at = this; at; at = at.parentElement) for (const fn of at.listeners.get(name) || []) fn(event); }
    click() { if (!this.disabled) this.emit('click'); }
  }
  document.body = document.createElement('body'); return document;
}
const manifest = { version: 'fixture-1', identities: ['corpo', 'street', 'student', 'custom'].map(id => ({ id, label: id, body: '【工程夹具】' + id })),
  timelines: ['2050-12', '2051-04'].map(id => ({ id, label: id, initialState: { story: { date: id } }, timelineEvents: [] })) };
const flush = () => new Promise(resolve => setImmediate(resolve));


function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(t, options = {}) {
  const doc = documentFixture(), calls = { inspected: [], started: [], destroyed: 0 };
  const session = options.session === null ? null : options.session || {
    async inspect(value) { calls.inspected.push(value); return { canStart: true, code: 'ready', reason: '可以确认。' }; },
    async start(value) { calls.started.push(value); return { ok: true, token: 'fixture-token', reason: '这份设置已保存；没有生成剧情。' }; },
    status() { return { phase: 'idle' }; }, destroy() { calls.destroyed++; },
  };
  const view = mount({ document: doc, parent: doc.body, manifest, ...options, session });
  t.after(() => view.destroy());
  const query = selector => doc.body.querySelector(selector);
  return { doc, view, calls, session, query, pick(id, era = '2050-12') { query('[data-identity-id="' + id + '"]').click(); query('[data-era-id="' + era + '"]').click(); },
    button: query('.cxx-opening-start'), note: query('.cxx-opening-note'), custom: query('.cxx-opening-description') };
}

