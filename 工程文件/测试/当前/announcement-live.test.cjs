'use strict';
// 2.3.22: 公告改读线上 notice.txt；已读键按正文哈希；未读点；内容变化后重弹一次。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Entry = require('../../卡片源码/运行时/entry-experience.js');

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', disabled: false, type: '', style: {}, dataset: {}, children: [], removed: false, open: false, focused: 0,
    attributes: new Map(),
    append(...items) { node.children.push(...items); },
    setAttribute(name, value) { node.attributes.set(name, String(value)); },
    getAttribute(name) { return node.attributes.get(name) ?? null; },
    querySelector(selector) { return selector === '[data-cxx-announcement-text]' ? node.children.find(child => child.dataset && child.dataset.cxxAnnouncementText) || null : null; },
    showModal() { node.open = true; },
    close() { node.open = false; },
    remove() { node.removed = true; },
    focus() { node.focused++; },
    addEventListener() {},
  };
  return node;
}

function fixture({ fetchText = '' } = {}) {
  const storage = new Map();
  const dialogs = [];
  const doc = {
    body: { appended: [], append(node) { this.appended.push(node); dialogs.push(node); } },
    createElement: element,
    querySelector() { return null; },
  };
  const win = {
    document: doc,
    localStorage: { getItem: key => (storage.has(key) ? storage.get(key) : null), setItem: (key, value) => storage.set(key, String(value)) },
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    fetch: async () => ({ ok: true, text: async () => fetchText }),
  };
  win.parent = win;
  return { win, storage, dialogs, setFetch(text) { win.fetch = async () => ({ ok: true, text: async () => text }); }, failFetch() { win.fetch = async () => { throw new Error('offline'); }; } };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('首次进入会弹一次，正文是卡内兜底（1000 赞版）', async () => {
  const box = fixture({ fetchText: '' });
  const notice = Entry.announcements(box.win);
  assert.equal(notice.unread(), true, '首次进入应为未读');
  const opening = notice.open();
  assert.equal(box.dialogs.length, 1, '应当立即出现弹窗');
  const text = box.dialogs[0].querySelector('[data-cxx-announcement-text]');
  assert.match(text.textContent, /1000 赞了/, '兜底文案应是 1000 赞版');
  assert.doesNotMatch(text.textContent, /2\.3\.9/, '不应再出现 2.3.9 的旧更新细节');
  box.dialogs[0].children.find(node => node.textContent === '我知道了').onclick();
  await opening;
  assert.equal(notice.unread(), false, '关闭后应记为已读');
  await notice.open();
  assert.equal(box.dialogs.length, 1, '同一条内容不应再次自动弹出');
});

test('拉到远端正文后替换，并记住这份内容', async () => {
  const box = fixture({ fetchText: '远端公告正文 v2' });
  const notice = Entry.announcements(box.win);
  const opening = notice.open();
  await tick(); await tick();
  const text = box.dialogs[0].querySelector('[data-cxx-announcement-text]');
  assert.equal(text.textContent, '远端公告正文 v2', '正文应替换为远端内容');
  box.dialogs[0].children.find(node => node.textContent === '我知道了').onclick();
  await opening;
  const again = Entry.announcements(box.win);
  await tick();
  assert.equal(again.unread(), false, '同一份远端内容不应重复打扰');
  assert.equal(box.dialogs.length, 1, '不应开出第二个弹窗');
});

test('远端内容变化后，下次进入会重新弹一次', async () => {
  const box = fixture({ fetchText: '第一版公告' });
  const first = Entry.announcements(box.win);
  const opening = first.open();
  await tick(); await tick();
  box.dialogs[0].children.find(node => node.textContent === '我知道了').onclick();
  await opening;
  const second = Entry.announcements(box.win);
  assert.equal(second.unread(), false, '内容没变时是已读');
  box.setFetch('第二版公告');
  assert.equal(await second.refresh(), true, '检测到变化应返回 true');
  assert.equal(box.dialogs.length, 2, '内容变化应再弹一次');
  assert.equal(box.dialogs[1].querySelector('[data-cxx-announcement-text]').textContent, '第二版公告');
  box.dialogs[1].children.find(node => node.textContent === '我知道了').onclick();
  assert.equal(second.unread(), false, '弹过之后应记为已读');
});

test('远端不可用时仍弹出兜底，不抛错、不阻塞', async () => {
  const box = fixture();
  box.failFetch();
  const notice = Entry.announcements(box.win);
  const opening = notice.open();
  assert.equal(box.dialogs.length, 1, '断网也要弹');
  await tick(); await tick();
  assert.match(box.dialogs[0].querySelector('[data-cxx-announcement-text]').textContent, /1000 赞了/);
  assert.equal(await notice.refresh(), false, '断网时 refresh 返回 false');
  box.dialogs[0].children.find(node => node.textContent === '我知道了').onclick();
  await opening;
});

test('远端正文按纯文本渲染，不解析 HTML', async () => {
  const box = fixture({ fetchText: '<script>alert(1)</script> 公告正文' });
  const notice = Entry.announcements(box.win);
  notice.open();
  await tick(); await tick();
  const text = box.dialogs[0].querySelector('[data-cxx-announcement-text]');
  assert.equal(text.textContent, '<script>alert(1)</script> 公告正文');
  assert.equal(text.children.length, 0, '不应生成任何子节点');
});

test('未读点：订阅者能收到状态变化', async () => {
  const box = fixture({ fetchText: '' });
  const notice = Entry.announcements(box.win);
  const seen = [];
  const stop = notice.subscribe(state => seen.push(state.unread));
  assert.deepEqual(seen, [true], '订阅时立刻回一次状态');
  const opening = notice.open();
  box.dialogs[0].children.find(node => node.textContent === '我知道了').onclick();
  await opening;
  assert.equal(seen.at(-1), false, '点掉后应变为已读');
  stop();
});
