'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.CXX_GAL_HOST_SOURCE || path.join(__dirname, "../../卡片源码/Gal/host.js"), 'utf8');

function hostFixture(t, mediaOrigin = 'http://127.0.0.1:6911', modeOptions = {}) {
  const events = new Map(), pageEvents = new Map(), documentEvents = new Map();
  const timers = new Map(), nodes = [], delivered = [], observers = [];
  let adapter, runtime, terminalOptions, statusOptions, workshopMode = null, now = 0, sequence = 0, generating = Boolean(modeOptions.busy), extraBusy = false, stopDisplay = 'none';
  const promptCalls = [], activePrompts = new Map();
  const calls = { nativeSend: 0, destroy: 0, terminalOpen: [], terminalClose: 0, terminalDestroy: 0, terminalFocus: 0, openingOpen: [], openingRefresh: [], openingClose: 0, openingDestroy: 0 };
  Object.assign(calls, { statusOpen: [], statusClose: 0, statusDestroy: 0, statusFocus: 0, refresh: 0 });
  Object.assign(calls, { workshopOpen: 0, workshopClose: 0, workshopDestroy: 0 });
  Object.assign(calls, { modeWrites: [], metadataSaves: [], runtimeOpen: [], notify: [] });
  const variables = new Map([['isolated-chat', structuredClone(modeOptions.variables || {})]]);
  function element() {
    const listeners = new Map(), attributes = new Map();
    const node = { removed: false, isConnected: true, append() {}, addEventListener(name, fn) { listeners.set(name, fn); }, setAttribute(name, value) { attributes.set(name, value); }, getAttribute(name) { return attributes.get(name) ?? null; },
      click(event = { type: 'click' }) { listeners.get('click')?.(event); },
      removeAttribute(name) { attributes.delete(name); }, focus() {}, remove() { this.removed = true; this.isConnected = false; } };
    nodes.push(node);
    return node;
  }
  const stop = element(), field = { ...element(), value: '尚未发送' };
  const send = { ...element(), disabled: false, getClientRects: () => [{}], display: 'flex', visibility: 'hidden', click() { calls.nativeSend++; } };
  const doc = { head: element(), body: element(), createElement: element,
    querySelector: selector => ({ '#mes_stop': stop, '#send_textarea': field, '#send_but': send })[selector] || null,
    addEventListener(name, fn) { documentEvents.set(name, fn); },
    removeEventListener(name, fn) { if (documentEvents.get(name) === fn) documentEvents.delete(name); },
    dispatchEvent(event) { documentEvents.get(event.type)?.(event); },
  };
  const eventTypes = Object.fromEntries([
    'CHAT_CHANGED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED',
    'MESSAGE_DELETED', 'MESSAGE_UPDATED', 'CHARACTER_MESSAGE_RENDERED', 'STREAM_TOKEN_RECEIVED',
    'GENERATION_STARTED', 'GENERATION_STOPPED', 'GENERATION_ENDED', 'GENERATION_AFTER_COMMANDS',
  ].map(name => [name, name.toLowerCase()]));
  const context = { characters: [{ avatar: 'isolated.png' }], characterId: 0, groupId: null, onlineStatus: 'connected',
    extensionSettings: {mvu_settings:{额外模型解析配置:{请求方式:'依次请求，失败后重试',请求次数:3}}},
    getCurrentChatId: () => 'isolated-chat', chat: [], eventTypes,
    saveMetadata() { calls.metadataSaves.push(this.getCurrentChatId()); return modeOptions.saveMetadata?.(); } };
  const readVariables = () => structuredClone(variables.get(context.getCurrentChatId()) || {});
  const updateVariables = updater => {
    const id = context.getCurrentChatId(), next = updater(readVariables());
    variables.set(id, next); calls.modeWrites.push({ id, variables: structuredClone(next) }); return next;
  };
  const parent = { document: doc, getComputedStyle: node => node === send ? { display: send.display, visibility: send.visibility } : { display: stopDisplay },
    CustomEvent: class { constructor(type) { this.type=type; } },
    Mvu: {isDuringExtraAnalysis:()=>extraBusy,events:{COMMAND_PARSED:'mvu-command-parsed'}},
    toastr: { info: text => calls.notify.push(text) },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
      observe(target, options) { this.target = target; this.options = options; this.active = true; }
      disconnect() { this.active = false; }
    },
  };
  const child = { parent,
    addEventListener(name, fn) { pageEvents.set(name, fn); },
    removeEventListener(name, fn) { if (pageEvents.get(name) === fn) pageEvents.delete(name); },
  };
  const sandbox = {
    window: child, SillyTavern: { getContext: () => context }, builtin: { duringGenerating: () => generating },
    Date: class extends Date { static now() { return now; } },
    iframe_events: { GENERATION_REQUESTED: 'helper-generation-requested' },
    CXX_GAL_STYLE: '', CXX_GAL_SAMPLE_SPRITE: '', CXX_GAL_REVISION: 'isolated-host-test',
    CxxGalParser: require("../../卡片源码/Gal/parser.js"), CxxGalUI: {}, CxxGalPrompt: require("../../卡片源码/Gal/prompt.js"),
    CxxGalMode: require("../../卡片源码/Gal/mode.js"),
    CxxContent: modeOptions.content,
    getVariables: modeOptions.missingVariables ? undefined : readVariables,
    updateVariablesWith: modeOptions.missingVariables ? undefined : updateVariables,
    CxxGalHud: require("../../卡片源码/Gal/hud.js"), CxxGalOpeningSession: require("../../卡片源码/Gal/opening-session.js"),
    CXX_GAL_OPENING_MANIFEST: require("../../卡片源码/Gal/opening-manifest.json"),
    CxxGalBackgrounds: require("../../卡片源码/Gal/backgrounds.js"), CxxGalSprites: require("../../卡片源码/Gal/sprites.js"),
    CXX_GAL_MEDIA: [], CXX_GAL_STANDING: require("../../卡片源码/Gal/standing-media.json").files, CXX_GAL_MEDIA_BASE: mediaOrigin,
    CxxGalWorkshop: { create() { return {
      open: async () => { calls.workshopOpen++; workshopMode = 'workshop'; return true; },
      openUpdate: () => { workshopMode = 'update'; return true; },
      close() { calls.workshopClose++; workshopMode = null; },
      destroy() { calls.workshopDestroy++; workshopMode = null; },
      get mode() { return workshopMode; },
    }; } },
    CxxGalStatusBridge: { create(options) {
      statusOptions = options; let messageId = null;
      return { get active() { return messageId !== null; }, get messageId() { return messageId; },
        open(value) { if (value.messageId < 0) throw Error('没有状态楼层'); messageId = value.messageId; calls.statusOpen.push(value); },
        close() { messageId = null; calls.statusClose++; },
        destroy() { messageId = null; calls.statusDestroy++; } };
    } },
    CxxGalOpeningBridge: { isOpeningSource: text => typeof text === 'string' && text.includes('data-opening-fixture'),
      create() { let active = false; return {
        get active() { return active; },
        open(value) { active = true; calls.openingOpen.push(value); },
        refresh(value) { calls.openingRefresh.push(value); },
        close() { active = false; calls.openingClose++; },
        destroy() { active = false; calls.openingDestroy++; },
      }; } },
    injectPrompts(prompts, options) {
      promptCalls.push({ prompts, options });
      for (const prompt of prompts) activePrompts.set(prompt.id, prompt);
      return { uninject() { for (const prompt of prompts) activePrompts.delete(prompt.id); } };
    },
    CxxGalTerminal: { create(options) {
      terminalOptions = options; let active = false;
      return {
        open(value) { active = true; calls.terminalOpen.push(value); },
        close() { calls.terminalClose++; if (active) { active = false; options.onClose(); } },
        destroy() { active = false; calls.terminalDestroy++; },
      };
    } },
    CxxGalController: { create(options) {
      adapter = options.adapter;
      const unsubscribe = adapter.subscribe(kind => {
        delivered.push({ kind, time: now, busy: adapter.read().busy });
        if (runtime?.active && runtime.key !== adapter.read().key) { runtime.active = false; adapter.cover(false); }
      });
      runtime = { active: false, open(options = {}) {
        calls.runtimeOpen.push(options);
        if (modeOptions.failOpen) return;
        this.active = true; this.key = adapter.read().key;
        if (options.remember !== false) adapter.onOpened?.(this.key);
      }, focusTerminal() { calls.terminalFocus++; },
        focusStatus() { calls.statusFocus++; }, refresh() { calls.refresh++; },
        destroy() { this.active = false; calls.destroy++; unsubscribe(); } };
      return runtime;
    } },
    getButtonEvent(name) { return 'test-button:' + name; },
    eventOn(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
    eventRemoveListener(name, fn) { events.get(name)?.delete(fn); },
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(source, sandbox, { filename: 'galgame/host.js' });
  const instance = parent.__cxx_gal_g1__;
  t.after(() => instance.destroy());
  return { adapter, runtime, calls, delivered, events, pageEvents, documentEvents, timers, nodes, parent, instance, observers, context, promptCalls, activePrompts, variables, send, field,
    provideVariables() { sandbox.getVariables = readVariables; sandbox.updateVariablesWith = updateVariables; },
    get workshopMode() { return workshopMode; },
    nativeDraft(text) { field.value = text; documentEvents.get('input')?.({ target: field }); },
    terminalClosed() { terminalOptions.onClose(); },
    statusClosed() { statusOptions.onClose(); },
    generating(value) { generating = value; },
    mvuBusy(value) { extraBusy = value; },
    requested(id, kind, config) { [...(events.get('helper-generation-requested') || [])].forEach(fn=>fn(id,kind,config)); },
    mvuCommands(commands, source=context.chat.at(-1)?.mes) { [...(events.get('mvu-command-parsed') || [])].forEach(fn=>fn({},commands,source)); },
    stopDisplay(value) { stopDisplay = value; },
    emit(name, ...args) { [...(events.get(eventTypes[name]) || [])].forEach(fn => fn(...args)); },
    clickScriptButton() { [...(events.get('test-button:Gal 模式') || [])].forEach(fn => fn()); },
    bodyAttribute(name) {
      observers.filter(observer => observer.active && observer.target === doc.body &&
        observer.options.attributes && observer.options.attributeFilter.includes(name))
        .forEach(observer => observer.callback([{ type: 'attributes', target: doc.body, attributeName: name }]));
    },
    tick(ms) {
      const end = now + ms;
      while (true) {
        const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); now = due[1].at; due[1].fn();
      }
      now = end;
    },
  };
}

