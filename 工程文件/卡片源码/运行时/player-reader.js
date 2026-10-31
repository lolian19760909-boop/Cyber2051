(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports)
    module.exports = api;
  else
    root.CxxPlayerReader = api;
}(globalThis, function (root) {
  'use strict';
  const structuredClone = (typeof module === 'object' && module.exports ? require('../共享/data-clone.js') : globalThis.CxxDataClone).clone;
  const copy = v => structuredClone(v);
  const same = (a, b) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object'
      || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
  };
  const failure = (code, message) => Object.assign(Error(message), { code });
  const descriptors = messages => messages.map(m => ({
    is_user: m.is_user === true,
    is_system: m.is_system === true,
    swipe_id: m.swipe_id || 0,
    mes: m.mes
  }));
  function sameMessages(a, b) {
    if (a.length !== b.length)
      return false;
    for (let i = 0; i < a.length; i++) {
      const left = a[i];
      const right = b[i];
      if ((left.is_user === true) !== (right.is_user === true)
        || (left.is_system === true) !== (right.is_system === true)
        || (left.swipe_id || 0) !== (right.swipe_id || 0) || left.mes !== right.mes)
        return false;
    }
    return true;
  }
  function priorGrowth(messages, floor) {
    for (let i = 0; i < floor; i++)
      if (messages[i].variables?.[messages[i].swipe_id || 0]?.stat_data?.terminal?.gameplay?.growth)
        return true;
    return false;
  }
  function createReader({api = root, hostWindow = root.parent || root, readDisk}) {
    const Art = typeof module === 'object' && module.exports ? require('./item-art.js') : root.CxxItemArt;
    const context = () => api.SillyTavern.getContext();
    let flight = null;
    let confirmed = null;
    const location = () => {
      const c = context();
      return {
        characterKey: c.characters?.[c.characterId]?.avatar,
        chatId: c.getCurrentChatId(),
        group: c.groupId || null
      };
    };
    function assertContext(expected) {
      const now = location();
      if (!now.characterKey || !now.chatId || now.group || !same(now, expected))
        throw failure('context-changed', '角色或聊天已切换，停止人物保存。');
    }
    const persisted = readDisk || async function (expected) {
      assertContext(expected);
      const c = context();
      const response = await hostWindow.fetch('/api/chats/get', {
          method: 'POST',
          signal: AbortSignal.timeout(30000),
          headers: c.getRequestHeaders(),
          credentials: 'same-origin',
          cache: 'no-cache',
          body: JSON.stringify({
            avatar_url: expected.characterKey,
            file_name: expected.chatId,
            ch_name: c.characters[c.characterId]?.name
          })
        });
      assertContext(expected);
      if (!response.ok)
        throw Error('人物存档读回失败（HTTP ' + response.status + '）。');
      const text = await response.text();
      assertContext(expected);
      if (/^\s*</.test(text))
        throw Error('酒馆存档接口返回了网页，请检查登录或代理连接。');
      try {
        const rows = JSON.parse(text);
        if (!Array.isArray(rows) || !rows[0]?.chat_metadata)
          throw Error();
        return rows;
      } catch {
        throw Error('人物存档读回格式异常，请保留当前聊天。');
      }
    };
    function local() {
      const c = context();
      const expected = location();
      assertContext(expected);
      let floor = c.chat.length - 1;
      while (floor >= 0 && !c.chat[floor].variables?.[c.chat[floor].swipe_id || 0]?.stat_data)
        floor--;
      if (floor < 0)
        throw failure('action-mvu-missing', '当前分支的 MVU 基础变量尚未就绪。');
      const vars = api.getVariables({ type: 'chat' });
      return {
        storyProfile: copy(c.chatMetadata?.__cxx_story_profile),
        itemArt: copy(c.chatMetadata?.[Art.key] || {
          schema: 1,
          assets: {}
        }),
        expected,
        floor,
        stat: copy(c.chat[floor].variables[c.chat[floor].swipe_id || 0].stat_data),
        growthIdentity: copy(vars.__cxx_identity),
        preferences: copy({
          ui: vars.__cxx_ui_preferences,
          gal: vars.__cxx_gal_mode
        }),
        messages: descriptors(c.chat),
        priorGrowth: priorGrowth(c.chat, floor)
      };
    }
    const relevant = s => ({
      storyProfile: s.storyProfile,
      itemArt: s.itemArt,
      expected: s.expected,
      floor: s.floor,
      identity: s.growthIdentity,
      preferences: s.preferences,
      stat: s.stat
    });
    const sameSnapshot = (a, b) => sameMessages(a.messages, b.messages) && same(relevant(a), relevant(b));
    function readPlayer({
      reuse = false
    } = {}) {
      let before;
      try {
        before = local();
      } catch (e) {
        return Promise.reject(e);
      }
      if (flight && sameSnapshot(flight.before, before))
        return flight.promise;
      if (reuse && confirmed && sameSnapshot(confirmed, before))
        return Promise.resolve(before);
      const entry = {
        before,
        promise: null
      };
      entry.promise = (async () => {
        const rows = await persisted(before.expected);
        assertContext(before.expected);
        const messages = rows.slice(1);
        const message = messages[before.floor];
        const identity = rows[0]?.chat_metadata?.variables?.__cxx_identity;
        const stat = message?.variables?.[message.swipe_id || 0]?.stat_data;
        const metadata = rows[0]?.chat_metadata?.variables || {};
        const preferences = {
            ui: metadata.__cxx_ui_preferences,
            gal: metadata.__cxx_gal_mode
          };
        if (!sameSnapshot(local(), before) || !sameMessages(messages, before.messages)
          || !same(identity, before.growthIdentity) || !same(preferences, before.preferences)
          || !same(stat, before.stat) || !same(rows[0]?.chat_metadata?.__cxx_story_profile, before.storyProfile)
          || !same(rows[0]?.chat_metadata?.[Art.key] || { schema: 1, assets: {} }, before.itemArt))
          throw failure('player-read-pending', '人物存档尚未读回确认；配置已保留，可重试保存。');
        confirmed = before;
        return before;
      })().finally(() => {
        if (flight === entry)
          flight = null;
      });
      flight = entry;
      return entry.promise;
    }
    return Object.assign(readPlayer, {
      local,
      location,
      assertContext
    });
  }
  return { create: createReader };
}));
