(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxUpdateHost = api;
})(typeof globalThis === 'object' ? globalThis : window, function (root) {
  'use strict';
  const CryptoCompat=typeof module==='object'&&module.exports?require('./crypto-compat.js'):globalThis.CxxCrypto;
  const Comparison=typeof module==='object'&&module.exports?require('./character-comparison.js'):root.CxxCharacterComparison;
  const NAMESPACE = '__cxx_update_state';
  const SCRIPT_ID = 'cf33c692-7a41-444d-b8b7-6a70163e0104';
  const clone = x => JSON.parse(JSON.stringify(x));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const regexKeys = new Set('id scriptName findRegex replaceString trimStrings placement disabled markdownOnly promptOnly runOnEdit substituteRegex minDepth maxDepth'.split(' '));
  const scriptKeys = new Set('type enabled name id content info button data export_with'.split(' '));
  const folderKeys = new Set('type enabled name id icon color scripts'.split(' '));
  const characterKeys = new Set('name description personality scenario first_mes mes_example creator_notes system_prompt post_history_instructions tags creator character_version alternate_greetings extensions character_book'.split(' '));
  const outerCharacterKeys = new Set('data spec spec_version name description personality scenario first_mes mes_example creatorcomment avatar chat create_date talkativeness fav tags json_data date_added date_last_chat chat_size data_size shallow'.split(' '));
  const bookEntryKeys = new Set('id keys secondary_keys comment content constant selective insertion_order enabled position use_regex extensions'.split(' '));
  const bookExtensionKeys = new Set('position exclude_recursion display_index probability useProbability depth selectiveLogic outlet_name group group_override group_weight prevent_recursion delay_until_recursion scan_depth match_whole_words use_group_scoring case_sensitive automation_id role vectorized sticky cooldown delay match_persona_description match_character_description match_character_personality match_character_depth_prompt match_scenario match_creator_notes triggers ignore_budget'.split(' '));
  const positions = ['before_character_definition', 'after_character_definition', 'before_author_note', 'after_author_note', 'at_depth', 'before_example_messages', 'after_example_messages', 'outlet'];
  // TH 4.11.2, 46ec10df: src/function/worldbook.ts, from/toWorldbookEntry.
  const implicitDefaults = { addMemo: true, matchPersonaDescription: false, matchCharacterDescription: false, matchCharacterPersonality: false, matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false, group: '', groupOverride: false, groupWeight: 100, caseSensitive: null, matchWholeWords: null, useGroupScoring: null, automationId: '', ignoreBudget: false, outletName: '', triggers: [], characterFilter: { isExclude: false, names: [], tags: [] } };
  function keyword(value) { return Object.prototype.toString.call(value) === '[object RegExp]' ? value.toString() : value; }
  function normalizeEntry(entry) {
    const value = { ...clone(implicitDefaults), ...entry,
      uid: entry.uid, name: entry.name ?? '', enabled: entry.enabled ?? true, content: entry.content ?? '', probability: entry.probability ?? 100,
      strategy: { type: entry.strategy?.type ?? 'constant', keys: (entry.strategy?.keys || []).map(keyword), keys_secondary: { logic: entry.strategy?.keys_secondary?.logic ?? 'and_any', keys: (entry.strategy?.keys_secondary?.keys || []).map(keyword) }, scan_depth: entry.strategy?.scan_depth ?? 'same_as_global' },
      position: { type: entry.position?.type ?? 'at_depth', role: entry.position?.role ?? 'system', depth: entry.position?.depth ?? 4, order: entry.position?.order ?? 100 },
      recursion: { prevent_incoming: entry.recursion?.prevent_incoming ?? false, prevent_outgoing: entry.recursion?.prevent_outgoing ?? false, delay_until: entry.recursion?.delay_until ?? null },
      effect: { sticky: entry.effect?.sticky ?? null, cooldown: entry.effect?.cooldown ?? null, delay: entry.effect?.delay ?? null },
    };
    return clone(value);
  }
  // TH 4.11.2 ScriptSchema adds these defaults when replacing script trees.
  // Put them in the planned target before fingerprints and the journal are made.
  function normalizeScript(script) {
    return clone({ info: '', data: {}, ...script,
      button: { enabled: true, buttons: [], ...script.button },
      export_with: { data: true, button: true, ...script.export_with } });
  }
  function rawEntryRuntime(raw) {
    const positive = value => typeof value === 'number' && value > 0 ? value : null;
    // ST 1.19.0 world-info.js parseRegexFromString, used by TH toWorldbookEntry.
    const key = input => {
      const match = input.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);
      if (!match || /(^|[^\\])\//.test(match[1])) return input;
      try { return new RegExp(match[1].replace('\\/', '/'), match[2]).toString(); }
      catch (_) { return input; }
    };
    const value = { uid: raw.uid, name: raw.comment, enabled: !raw.disable, content: raw.content, probability: raw.useProbability ? raw.probability : 100,
      strategy: { type: raw.constant ? 'constant' : raw.vectorized ? 'vectorized' : 'selective', keys: (raw.key || []).map(key), keys_secondary: { logic: ['and_any', 'not_all', 'not_any', 'and_all'][raw.selectiveLogic], keys: (raw.keysecondary || []).map(key) }, scan_depth: raw.scanDepth ?? 'same_as_global' },
      position: { type: positions[raw.position], role: ['system', 'user', 'assistant'][raw.role ?? 0], depth: raw.depth, order: raw.order },
      recursion: { prevent_incoming: raw.excludeRecursion, prevent_outgoing: raw.preventRecursion, delay_until: positive(raw.delayUntilRecursion) },
      effect: { sticky: positive(raw.sticky), cooldown: positive(raw.cooldown), delay: positive(raw.delay) },
    };
    if (raw.extra) value.extra = raw.extra;
    for (const key of Object.keys(implicitDefaults)) if (Object.prototype.hasOwnProperty.call(raw, key)) value[key] = raw[key];
    return normalizeEntry(value);
  }
  function error(code, message) { const e = new Error(message); e.code = code; return e; }
  // TH getWorldbook sorts by displayIndex, while JSON object keys follow numeric UID.
  // Use the same order for fresh disk checks so unchanged books compare equal.
  function rawWorldbookEntries(raw) {
    const order=entry=>typeof entry.displayIndex==='number'?entry.displayIndex:Infinity;
    return Object.values(raw.entries||{}).sort((a,b)=>order(a)-order(b)).map(rawEntryRuntime);
  }
  const rawData = Comparison.rawData;
  function settings(data) {
    const th = data?.extensions?.tavern_helper;
    return Array.isArray(th) ? Object.fromEntries(th) : th || {};
  }
  function guardRaw(data, stage, rawRegex = false) {
    function checkKeys(value, allowed, label) {
      for (const key of Object.keys(value || {})) if (!allowed.has(key)) throw error('unsupported-raw-field', label + '含未支持字段 ' + key + '，已停止该更新以保留原件');
    }
    if (stage === 'regex' && !rawRegex) for (const item of data?.extensions?.regex_scripts || []) {
      checkKeys(item, regexKeys, '正则');
      if (!Array.isArray(item.placement) || item.placement.some(p => p !== 1 && p !== 2)) throw error('unsupported-regex-position', '当前正则含未核定位置，保留原件并停止更新');
      if (item.substituteRegex && item.substituteRegex !== 0) throw error('unsupported-regex-mode', '玩家正则使用宏替换模式，助手接口不能原样保留，已停止更新');
    }
    if (stage === 'scripts') {
      function tree(nodes) {
        for (const node of nodes || []) {
          checkKeys(node, node.type === 'folder' ? folderKeys : scriptKeys, '助手脚本');
          if (node.type === 'folder') tree(node.scripts);
          else {
            checkKeys(node.button, new Set(['enabled', 'buttons']), '脚本按钮');
            for (const b of node.button?.buttons || []) checkKeys(b, new Set(['name', 'visible']), '脚本按钮项');
            checkKeys(node.export_with, new Set(['data', 'button']), '脚本导出设置');
          }
        }
      }
      tree(settings(data).scripts);
    }
  }
  // Apply only changed runtime fields to a copied raw entry. Unknown raw fields survive.
  function mergeRawEntry(oldRaw, before, next, index) {
    const raw = clone(oldRaw || implicitDefaults);
    const differs = key => !before || JSON.stringify(before[key]) !== JSON.stringify(next[key]);
    raw.uid = next.uid;
    const fields = { name: 'comment', content: 'content', enabled: 'disable', probability: 'probability', group: 'group', groupOverride: 'groupOverride', groupWeight: 'groupWeight', caseSensitive: 'caseSensitive', matchWholeWords: 'matchWholeWords', useGroupScoring: 'useGroupScoring', automationId: 'automationId', ignoreBudget: 'ignoreBudget', outletName: 'outletName', triggers: 'triggers', addMemo: 'addMemo', characterFilter: 'characterFilter', matchPersonaDescription: 'matchPersonaDescription', matchCharacterDescription: 'matchCharacterDescription', matchCharacterPersonality: 'matchCharacterPersonality', matchCharacterDepthPrompt: 'matchCharacterDepthPrompt', matchScenario: 'matchScenario', matchCreatorNotes: 'matchCreatorNotes', extra: 'extra' };
    for (const [key, target] of Object.entries(fields)) if (next[key] !== undefined && differs(key)) raw[target] = key === 'enabled' ? !next[key] : clone(next[key]);
    if (differs('probability')) raw.useProbability = true;
    if (differs('strategy')) {
      const s = next.strategy;
      if (![...(s.keys || []), ...(s.keys_secondary?.keys || [])].every(k => typeof k === 'string')) throw error('unsupported-keyword', '世界书关键词必须保持为字符串');
      raw.constant = s.type === 'constant'; raw.vectorized = s.type === 'vectorized'; raw.selective = s.type === 'selective';
      raw.key = clone(s.keys || []); raw.keysecondary = clone(s.keys_secondary?.keys || []);
      raw.selectiveLogic = ['and_any', 'not_all', 'not_any', 'and_all'].indexOf(s.keys_secondary?.logic || 'and_any');
      if (raw.selectiveLogic < 0) throw error('unsupported-keyword', '未支持的世界书次要关键词逻辑');
      raw.scanDepth = s.scan_depth === 'same_as_global' ? null : (s.scan_depth ?? null);
    }
    if (differs('position')) {
      const p = next.position;
      raw.position = positions.indexOf(p.type); raw.role = ['system', 'user', 'assistant'].indexOf(p.role);
      if (raw.position < 0 || raw.role < 0) throw error('unsupported-worldbook-position', '未支持的世界书位置');
      raw.depth = p.depth; raw.order = p.order;
    }
    if (differs('recursion')) {
      raw.excludeRecursion = next.recursion.prevent_incoming; raw.preventRecursion = next.recursion.prevent_outgoing;
      raw.delayUntilRecursion = next.recursion.delay_until ?? false;
    }
    if (differs('effect')) for (const field of ['sticky', 'cooldown', 'delay']) raw[field] = next.effect[field] ?? null;
    // TH reads entries in displayIndex order. Retained historical definitions
    // must occupy their position in the planned array after removals/additions.
    raw.displayIndex = index;
    if (!oldRaw && raw.probability === undefined) raw.probability = 100;
    return raw;
  }
  function create(options = {}) {
    const Core = options.core || root.CxxUpdateCore;
    const api = options.api || root;
    const fetcher = options.fetch || root.fetch.bind(root);
    const context = () => api.SillyTavern.getContext();
    let chatSaveGuard;
    function startChatSaveGuard(){
      if(chatSaveGuard)return chatSaveGuard;
      const win=api.parent||root.parent,Guard=options.chatSaveGuard||(typeof module==='object'&&module.exports?require('./chat-save-guard.js'):root.CxxChatSaveGuard);
      if(win?.document&&win?.fetch&&Guard)chatSaveGuard=Guard.acquire({win,api});
      return chatSaveGuard;
    }
    function resetChatSaveGuard({reuseScope=false}={}){const service=startChatSaveGuard();return service?.reset({reuseScope});}
    async function inspectChatSave(){const guard=startChatSaveGuard();return guard?guard.inspect():{kind:'blocked',code:'chat-save-unavailable',message:'保存服务尚未就绪，请稍后再检查。'};}
    function stopChatSaveGuard(){chatSaveGuard?.release();chatSaveGuard=null;}
    const StateStore = options.stateStore || (typeof module==='object'&&module.exports&&typeof require==='function' ? require('./character-state.js') : root.CxxCharacterState);
    const stateStore = StateStore?.create({root,api,namespace:NAMESPACE,assertContext,fetch:fetcher,hostOrigin:options.hostOrigin,encode:options.encodeStateJSON});
    // Host values are JSON records. Compare their contents without constructing
    // two serialized copies of every embedded script on each save guard.
    const same = (a, b) => a === b || !!(a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && same(a[k], b[k])));
    let scope = 'character', locked = false, lockedContext = null, currentJournal = null, database = null, recoveryOnly = false;
    const activeGenerations = new Set();
    const mvuGenerations = new Map();
    let quietUntil = Date.now() + 2000;
    function mvuProvider() {
      try { return api.Mvu || root.Mvu || root.parent?.Mvu || null; }
      catch (_) { return null; }
    }
    // 宿主可能还有其它“额外解析”提供方；这里只探测接口形状，不假定它一定是 Mvu。
    function mvuBusy(provider) {
      try { return typeof provider?.isDuringExtraAnalysis === 'function' ? provider.isDuringExtraAnalysis() : undefined; }
      catch (_) { return undefined; }
    }
    function generationEnded(id) { activeGenerations.delete(id); quietUntil = Date.now() + 2000; }
    function mvuGenerationRequested(id, kind, config) {
      if (typeof id !== 'string' || !id || id === 'native' || !['generate', 'generateRaw'].includes(kind)
        || config?.user_input !== '遵循<must>指令' || config.generation_id !== id) return;
      const provider = mvuProvider();
      if (mvuBusy(provider) !== true) return;
      const characterKey = api.getCurrentCharacterId(), chatId = context().getCurrentChatId();
      // Fixed MVU source signature, not a public owner tag. Retain no request configuration.
      if (characterKey && chatId && !mvuGenerations.has(id)) mvuGenerations.set(id, { characterKey, chatId, provider });
    }
    function getContext() {
      const c = context();
      const characterKey = api.getCurrentCharacterId();
      const chatId = c.getCurrentChatId();
      const provider = mvuProvider(), extraBusy = mvuBusy(provider), nativeBusy = api.builtin.duringGenerating();
      // ST emits START before checking the connection. With no backend it returns
      // without showing the stop button, so END is never emitted. Reconcile only
      // that explicit idle state; unrelated helper requests remain protected.
      if (activeGenerations.has('native') && c.onlineStatus === 'no_connection' && nativeBusy === false && extraBusy !== true) generationEnded('native');
      if (extraBusy === false) for (const [id, request] of mvuGenerations) {
        if (request.characterKey !== characterKey || request.chatId !== chatId || request.provider !== provider) continue;
        generationEnded(id); mvuGenerations.delete(id);
      }
      return { cardId: 'cyber2051', characterKey: characterKey || '', chatId: chatId || '', busy: !characterKey || !chatId || !!c.groupId || nativeBusy || extraBusy === true || activeGenerations.size > 0 || Date.now() < quietUntil };
    }
    function assertContext(expected, allowBusy = false) {
      const actual = getContext();
      if (lockedContext && ['cardId', 'characterKey', 'chatId'].some(k => actual[k] !== lockedContext[k] || expected[k] !== lockedContext[k])) throw error('context-changed', '角色或聊天已切换，停止当前操作');
      if (['cardId', 'characterKey', 'chatId'].some(k => actual[k] !== expected[k])) throw error('context-changed', '角色或聊天已切换，停止当前操作');
      if (!allowBusy && actual.busy) throw error('host-busy', '正在生成或刚结束写入，更新已排队');
    }
    const operationContext = () => lockedContext || Object.freeze(getContext());
    async function post(endpoint, body, expected = operationContext()) {
      assertContext(expected, true);
      const c = context();
      const origin = options.hostOrigin || root.parent.location.origin;
      const url = new URL('/api/' + endpoint, origin).href;
      const request = { method: 'POST', headers: c.getRequestHeaders(), credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(body) };
      if (endpoint === 'characters/get' && !recoveryOnly && stateStore?.readCharacter) {
        const value = await stateStore.readCharacter(url, request);
        assertContext(expected, true);
        return value;
      }
      const response = await fetcher(url, request);
      assertContext(expected, true);
      if (!response.ok) throw error('persistence-http-error', '宿主保存或读回失败：' + response.status);
      const value = await response.json();
      assertContext(expected, true);
      return value;
    }
    function checkedComponentPackages(value) {
      const isRecord = item => item !== null && typeof item === 'object' && !Array.isArray(item);
      if (!isRecord(value) || Object.values(value).some(item => !isRecord(item))) throw error('invalid-component-ledger', '组件归属账本必须为对象映射，停止保存以保留原件');
      try { Core.canonical(value); } catch (_) { throw error('invalid-component-ledger', '组件归属账本含非 JSON 数据，停止保存以保留原件'); }
      return clone(value);
    }
    function readState(expected = operationContext()) {
      assertContext(expected, true);
      const state = api.getVariables({ type: 'character' })[NAMESPACE] || {};
      if (Object.prototype.hasOwnProperty.call(state, 'componentPackages')) checkedComponentPackages(state.componentPackages);
      return clone(state);
    }
    async function persisted(expected = operationContext()) {
      const raw = await post('characters/get', { avatar_url: expected.characterKey }, expected);
      // ST /get already parses the card into data; json_data repeats its full text.
      return raw.data || rawData(raw);
    }
    const comparableCharacter = Comparison.character;
    async function guardCharacter(data, expected) {
      const unsupported = field => { throw error('unsupported-character-field', '助手存盘不能保留 ' + field + '，停止更新；请先保留原件'); };
      for (const key of Object.keys(data)) if (!characterKeys.has(key)) unsupported('data.' + key);
      for (const key of ['system_prompt', 'post_history_instructions']) if (data[key]) unsupported('data.' + key);
      guardRaw(data, 'scripts');
      const helper = settings(data);
      for (const key of Object.keys(helper)) if (!['scripts', 'variables'].includes(key)) unsupported('extensions.tavern_helper.' + key);
      if (!same(helper.scripts || [], Comparison.normalize(api.getScriptTrees({ type: 'character' })))) unsupported('extensions.tavern_helper.scripts（宿主已转换字段）');
      if (!same(helper.variables || {}, Comparison.normalize(api.getVariables({ type: 'character' })))) unsupported('extensions.tavern_helper.variables（宿主已转换字段）');
      const book = data.character_book;
      if (!book) return;
      // TH 4.11.2 writeExtensionField omits json_data and those prompt fields.
      // ST 1.19.0 convertWorldInfoToCharacterBook only rebuilds these book fields.
      for (const key of Object.keys(book)) if (!['name', 'entries'].includes(key)) unsupported('character_book.' + key);
      const foreign = [];
      for (const entry of book.entries || []) {
        if (entry.use_regex !== undefined && typeof entry.use_regex !== 'boolean') unsupported('character_book.entries.' + entry.id + '.use_regex=' + String(entry.use_regex));
        for (const key of Object.keys(entry)) if (!bookEntryKeys.has(key)) unsupported('character_book.entries.' + entry.id + '.' + key);
        for (const [key, value] of Object.entries(entry.extensions || {})) if (!bookExtensionKeys.has(key)) foreign.push({ id: entry.id, key, value });
      }
      if (foreign.length) {
        const raw = await readRawBook(data.extensions?.world, expected);
        const journal=currentJournal||journalBackup(raw,readState(expected).instanceId,'release')?.journal;
        for (const item of foreign) {
          const saved=journal?.worldbookDeletedRaw?.[String(item.id)];
          const deleted=journal?.installed?.scope==='character'&&journal.attempted?.includes('worldbook')&&journal.before?.worldbook?.entries.some(e=>e.uid===item.id)&&!journal.after?.worldbook?.entries.some(e=>e.uid===item.id);
          if(!raw.entries?.[String(item.id)]&&deleted&&saved&&Object.prototype.hasOwnProperty.call(saved.extensions||{},item.key)&&same(Comparison.normalize(saved.extensions[item.key]),item.value))continue;
          if (!Object.prototype.hasOwnProperty.call(raw.entries?.[String(item.id)]?.extensions || {}, item.key) || !same(Comparison.normalize(raw.entries[String(item.id)].extensions[item.key]), item.value)) unsupported('character_book.entries.' + item.id + '.extensions.' + item.key);
        }
      }
    }
    async function refreshEmbeddedProjection(left,right,expected,name,raw,route,stillCurrent) {
      // getOneCharacter replaces the whole cache after await fetch/json. An
      // edit made during that wait would be lost. Read first, then update only
      // the proven book on the public live character in one synchronous turn.
      const disk=await persisted(expected);
      if(!same(right,comparableCharacter(disk))||!same(raw,await readRawBook(name,expected)))return false;
      assertContext(expected,true);
      const c=context(),live=c.characters?.[c.characterId],cached=api.getCharData('current');
      if(!live?.data||live!==cached||getBookName()!==name||route!==undefined&&(c.chatMetadata?.__cxx_story_v1?.routeId||expected.chatId)!==route||!same(left,comparableCharacter(cached))||stillCurrent&&!stillCurrent())return false;
      const book=clone(disk.character_book),text=cached.json_data;
      let nextText;
      if(typeof text==='string'){
        const outer=JSON.parse(text);
        if(!outer?.data||!same(left,comparableCharacter({data:outer.data})))return false;
        outer.data.character_book=book;nextText=JSON.stringify(outer);
      }
      const doc=options.document||root.parent?.document||root.document,field=doc?.getElementById?.('character_json_data');
      if(nextText!==undefined&&field&&field.value!==text)return false;
      // No await from the final comparisons through the assignments. Keep all
      // other live fields, outer JSON fields and object identities untouched.
      live.data.character_book=book;
      if(nextText!==undefined){live.json_data=nextText;if(field)field.value=nextText;}
      return same(right,comparableCharacter(api.getCharData('current')));
    }
    async function refreshDisplayIndexProjection(left,right,expected) {
      if(!same({...left,character_book:right.character_book},right)||!Array.isArray(left.character_book?.entries)||!Array.isArray(right.character_book?.entries))return false;
      const withoutDisplayIndex=book=>{
        const value=clone(book);
        for(const entry of value.entries)if(entry.extensions)delete entry.extensions.display_index;
        return value;
      };
      // ST may renumber displayIndex while saving its bound worldbook. Accept
      // that projection only: keep entry order, content and every other field.
      if(!same(withoutDisplayIndex(left.character_book),withoutDisplayIndex(right.character_book)))return false;
      const name=getBookName(),route=context().chatMetadata?.__cxx_story_v1?.routeId||expected.chatId;
      const raw=await readRawBook(name,expected);
      if(!same(Comparison.normalize(Comparison.embeddedBook(name,raw.entries||{})),right.character_book))return false;
      return refreshEmbeddedProjection(left,right,expected,name,raw,route);
    }
    async function refreshUpdaterProjection(left, right, expected) {
      // A self-upgrade destroys the old script frame after its content sync has
      // committed. Its journal is no longer currentJournal, but the exact
      // committed before/after and original updater are still on disk.
      if (!same({...left, character_book:right.character_book}, right)) return false;
      const state=readState(expected),record=state.updaterUpgrade;
      const owned=value=>value?.cardId===expected.cardId&&value.characterKey===expected.characterKey&&value.chatId===expected.chatId;
      if(record?.status!=='awaiting-reload'||!owned(record.context)||!/^cxx-updater-backup-[\w-]+$/.test(record.name||'')||!['sourceHash','targetHash'].every(k=>/^[a-f0-9]{64}$/.test(record[k]||'')))return false;
      const name=getBookName(),raw=await readRawBook(name,expected),slots=raw.extensions?.__cxx_update_journals?.[state.instanceId];
      const active=slots?.active,release=slots?.release,j=active?.journal,r=release?.journal;
      if(active?.instanceId!==state.instanceId||release?.instanceId!==state.instanceId||j?.status!=='committed'||!owned(j.context)||!owned(r?.context)||j.installed?.scope!=='character'||r.installed?.scope!=='character'||!['committed','awaiting-verification'].includes(r.status)||!j.completed?.includes('worldbook')||!r.completed?.includes('scripts'))return false;
      if(j.before?.worldbook?.internalName!==name||j.after?.worldbook?.internalName!==name||!Array.isArray(r.after?.scripts?.trees))return false;
      const before=j.before.worldbook.entries,after=j.after.worldbook.entries;
      if(!Array.isArray(before)||!Array.isArray(after))return false;
      const byUid=entries=>entries.map(normalizeEntry).sort((a,b)=>a.uid-b.uid),ids=new Set(before.map(e=>e.uid));
      if(ids.size!==before.length||new Set(after.map(e=>e.uid)).size!==after.length||!same(byUid(after.filter(e=>ids.has(e.uid))),byUid(before))||!same(byUid(rawWorldbookEntries(raw)),byUid(after)))return false;
      const added=after.filter(e=>!ids.has(e.uid)),route=context().chatMetadata?.__cxx_story_v1?.routeId||expected.chatId;
      if(!added.length||!added.every(e=>{const m=e.extra?.__cxx_official_content;return m?.instanceId===state.instanceId&&m.routeId===route&&typeof m.owner==='string'&&!!m.owner&&typeof m.version==='string'&&!!m.version&&(/^gameplay\./.test(m.id||'')||/^quest\./.test(m.id||'')&&Object.hasOwn(state.installed||{},m.owner)&&m.version===state.installed[m.owner]?.version);} ))return false;
      const project=entries=>Comparison.normalize(Comparison.embeddedBook(name,entries));
      const oldRaw=Object.fromEntries(Object.entries(raw.entries||{}).filter(([,e])=>ids.has(e.uid)));
      if(!same(project(oldRaw),left.character_book)||!same(project(raw.entries||{}),right.character_book))return false;
      const backup=await readRawBook(record.name,expected),saved=backup.extensions?.__cxx_updater_upgrade,b=saved?.record;
      if(saved?.format!==1||!b||!owned(b.context)||!['id','name','sourceHash','targetHash'].every(k=>b[k]===record[k])||saved.script?.id!==SCRIPT_ID||await Core.sha256(saved.script.content)!==record.sourceHash)return false;
      const flatten=nodes=>nodes.flatMap(n=>n.type==='folder'?flatten(n.scripts||[]):[n]);
      const current=flatten(right.extensions?.tavern_helper?.scripts||[]).filter(s=>s.id===SCRIPT_ID),original=flatten(r.after.scripts.trees).filter(s=>s.id===SCRIPT_ID);
      if(current.length!==1||original.length!==1||!same(Comparison.normalize(original[0]),Comparison.normalize(saved.script))||!same(current[0],Comparison.normalize({...saved.script,content:current[0].content}))||await Core.sha256(current[0].content)!==record.targetHash)return false;
      const replace=nodes=>nodes.map(n=>n.id===SCRIPT_ID?{...n,content:current[0].content}:n.type==='folder'?{...n,scripts:replace(n.scripts||[])}:n);
      if(!same(Comparison.normalize(replace(r.after.scripts.trees)),right.extensions.tavern_helper.scripts))return false;
      // First content sync also materializes definitions for already owned
      // equipment. cxx_loadout is an item provider, not an installed package.
      // Prove these additions against the current consumer instead of trusting
      // a prefix or broadening the installation ledger exception.
      let stillCurrent;
      const gameplayAdded=added.filter(e=>e.extra.__cxx_official_content.id.startsWith('gameplay.'));
      if(gameplayAdded.length){
        const Gameplay=typeof module==='object'&&module.exports?require('./gameplay.js'):root.CxxGameplay;
        const Content=typeof module==='object'&&module.exports?require('./content.js'):root.CxxContent;
        if(!Gameplay?.promptEntries||!Content?.withMigration||typeof api.getLastMessageId!=='function')return false;
        const inputs=()=>{
          const last=api.getLastMessageId(),vars=api.getVariables({type:'chat'});
          for(let floor=last;floor>=0;floor--){const value=api.getVariables({type:'message',message_id:floor});if(value?.stat_data)return clone({last,floor,branch:context().chat?.[floor]?.swipe_id??null,gameplay:value.stat_data.terminal?.gameplay||{},pins:vars.__cxx_content_pins||{},migration:vars.__cxx_migration||null});}
          const live=(typeof globalThis!=='undefined'&&globalThis.Cxx236State)||(typeof api!=='undefined'&&api.Cxx236State);
          if(live&&typeof live.stat==='function')try{const v=live.stat();if(v&&v.terminal)return clone({last,floor:last,branch:context().chat?.[last]?.swipe_id??null,gameplay:v.terminal?.gameplay||{},pins:vars.__cxx_content_pins||{},migration:vars.__cxx_migration||null});}catch(e){}
          return null;
        };
        const input=inputs();if(!input)return false;
        const effective=Content.withMigration(state,{__cxx_migration:input.migration});
        const seed={...saved.script.data?.__cxx_update_seed,...state.installed?.['cyber2051.core']?.release?.seed};
        const wanted=Gameplay.promptEntries(effective.registry,{mapIndex:seed.mapIndex,subscriptions:effective.subscriptions,pins:input.pins},input.gameplay);
        const seen=new Set();
        for(const entry of gameplayAdded){
          const m=entry.extra.__cxx_official_content,key=m.owner+':'+m.id;
          const candidates=wanted.filter(w=>w.owner===m.owner&&w.id===m.id&&w.version===m.version);
          if(seen.has(key)||candidates.length!==1)return false;seen.add(key);
          const exact=normalizeEntry({...clone(candidates[0].entry),uid:entry.uid});
          if(!/\[mvu_(?:plot|update)\]/i.test(exact.name))exact.name='[mvu_plot][mvu_update]'+exact.name;
          const baseline=(await Core.fingerprints({worldbook:{internalName:'content',entries:[exact]}})).worldbook.entries.records['number:'+entry.uid];
          exact.extra={...exact.extra,__cxx_official_content:{instanceId:state.instanceId,routeId:route,owner:m.owner,id:m.id,version:m.version,baseline}};
          if(!same(normalizeEntry(entry),exact))return false;
        }
        stillCurrent=()=>same(input,inputs());
      }
      return refreshEmbeddedProjection(left,right,expected,name,raw,route,stillCurrent);
    }
    async function assertFreshCharacter(expected, allowPendingRead = false) {
      await context().unshallowCharacter(String(context().characterId)); assertContext(expected, true);
      const disk = await persisted(expected); assertContext(expected, true);
      const cached = api.getCharData('current');
      const cachedText = cached?.json_data;
      let topKeys;
      if (typeof cachedText === 'string' && !recoveryOnly && stateStore?.outerKeys) topKeys = await stateStore.outerKeys(cachedText);
      else { const original = typeof cachedText === 'string' ? JSON.parse(cachedText) : cached; topKeys = original?.data ? Object.keys(original) : []; }
      assertContext(expected, true);
      if (cachedText !== api.getCharData('current')?.json_data) throw error('stale-character-cache', '检查时本地角色再次变化，已停止更新');
      const outer=typeof cachedText==='string'?JSON.parse(cachedText):cached;
      for (const key of topKeys) if (!outerCharacterKeys.has(key)&&!Comparison.mirroredOuterField(outer,key)) throw error('unsupported-character-field', '助手存盘不能保留角色 JSON 顶层字段 ' + key + '，已停止更新');
      let left = comparableCharacter(cached); let right = comparableCharacter(disk);
      if (!same(left, right)) {
        const pending = allowPendingRead && await mirror(expected.characterKey, 'readonly', row => ({ result: row }));
        const journal = pending?.status === 'active' && pending.instanceId === readState(expected).instanceId && pending.journal;
        const projectionJournal=currentJournal||journal;
        // Read-only recovery may inspect exactly the writes already recorded in
        // its own journal. Every actual write still requires full equality.
        if (journal?.attempted?.includes('scripts') && same(left.extensions?.tavern_helper?.scripts, Comparison.normalize(journal.after.scripts.trees)) && same(right.extensions?.tavern_helper?.scripts, Comparison.normalize(journal.before.scripts.trees))) right.extensions.tavern_helper.scripts = clone(left.extensions.tavern_helper.scripts);
        if (journal?.installed?.scope === 'character' && journal.attempted?.includes('worldbook') && left.extensions?.world === journal.after.worldbook.internalName && right.extensions?.world === journal.before.worldbook.internalName) right.extensions.world = left.extensions.world;
        // TH updates its character cache before its asynchronous disk save.
        // Only wait for that frozen snapshot; never replace or chase the cache.
        if (!same(left, right)) for (const delay of [250, 750, 1500]) {
          await wait(delay); assertContext(expected, true);
          if (!same(left, comparableCharacter(api.getCharData('current')))) throw error('stale-character-cache', '等待保存时本地角色再次变化，已停止更新；请先保存本地修改，再刷新该窗口');
          right = comparableCharacter(await persisted(expected));
          if (!same(left, comparableCharacter(api.getCharData('current')))) throw error('stale-character-cache', '等待保存时本地角色再次变化，已停止更新；请先保存本地修改，再刷新该窗口');
          if (same(left, right)) break;
        }
        if (!same(left, right) && projectionJournal?.installed?.scope === 'character' && projectionJournal.attempted?.includes('scripts') && same({...left,character_book:right.character_book},right)) {
          // TH's script writer calls ST /characters/edit. ST regenerates the
          // embedded book from the bound raw book but TH leaves that cache old.
          // Refresh only this proven projection of our active transaction;
          // every other local/disk field must already agree.
          const name=getBookName(),raw=await readRawBook(name,expected);
          const projected=Comparison.normalize(Comparison.embeddedBook(name,raw.entries||{}));
          const byUid=entries=>entries.map(normalizeEntry).sort((a,b)=>a.uid-b.uid);
          if(name===projectionJournal.after?.worldbook?.internalName&&same(byUid(rawWorldbookEntries(raw)),byUid(projectionJournal.after.worldbook.entries))&&same(projected,right.character_book)){
            if(await refreshEmbeddedProjection(left,right,expected,name,raw))left=comparableCharacter(api.getCharData('current'));
          }
        }
        if (!same(left, right) && await refreshDisplayIndexProjection(left,right,expected)) left=comparableCharacter(api.getCharData('current'));
        if (!same(left, right) && await refreshUpdaterProjection(left,right,expected)) left=comparableCharacter(api.getCharData('current'));
        if (!same(left, right)) throw error('stale-character-cache', '当前窗口的角色缓存与磁盘不一致，已停止更新；请先保存本地修改，再刷新该窗口');
      }
      await guardCharacter(left, expected); assertContext(expected, true);
    }
    async function confirm(test, expected, code = 'save-not-confirmed', message = '尚未确认角色已保存到磁盘，保留恢复记录') {
      for (const delay of [0, 250, 500, 1000, 2000, 3000, 4000]) {
        if (delay) await wait(delay);
        assertContext(expected, true);
        if (test(await persisted(expected))) return;
      }
      throw error(code, message);
    }
    async function saveState(value, expected = operationContext(), journalPermit) {
      assertContext(expected, true);
      if (Object.prototype.hasOwnProperty.call(value, 'componentPackages')) checkedComponentPackages(value.componentPackages);
      if (locked) {
        const record = await mirror(expected.characterKey, 'readonly', row => ({ result: row }));
        if (record?.status === 'active' && value.journalName !== record.journalName && journalPermit !== record.id) throw error('stale-journal', '旧脚本不能改写当前安装记录');
        assertContext(expected, true);
      }
      await assertFreshCharacter(expected);
      const scriptsBefore = clone(api.getScriptTrees({type:'character'}));
      // The recovery surface also serves TT's main-thread virtual API. Use the
      // helper writer and ordinary fetch there, not the ST-only worker shortcut.
      if (recoveryOnly || !await stateStore?.write(value,expected)) await api.updateVariablesWith(vars => { vars[NAMESPACE] = clone(value); return vars; }, { type: 'character' });
      assertContext(expected, true);
      await confirm(data => {
        if (!same(settings(data).scripts || [], scriptsBefore)) throw error('script-persistence-mismatch', '角色脚本与保存前不一致，已停止后续写入；请导出诊断，并使用脚本诊断恢复工具。');
        return same(settings(data).variables?.[NAMESPACE] || {}, value);
      }, expected);
      const win=root.parent||root;win.dispatchEvent?.(new win.CustomEvent('cxx-content-changed',{detail:{revision:value.contentRevision}}));
    }
    async function readRawBook(name, expected = operationContext()) { return name ? post('worldinfo/get', { name }, expected) : { entries: {} }; }
    let worldbookRuntimePromise;
    function worldbookRuntime() {
      return worldbookRuntimePromise ||= Promise.resolve().then(() => options.loadWorldInfoRuntime ? options.loadWorldInfoRuntime() : root.document ? import(new URL('/scripts/world-info.js', root.parent.location.href).href) : null).then(runtime => {
        const c=context();
        return runtime?.saveWorldInfo===c.saveWorldInfo && typeof runtime?.worldInfoCache?.set==='function' && typeof c.eventSource?.emit==='function' && c.eventTypes?.WORLDINFO_UPDATED ? runtime : null;
      }).catch(() => null);
    }
    async function writeRawBook(name, value, expected = operationContext(), updateCache = false) {
      const ack = await post('worldinfo/edit', { name, data: value }, expected);
      if (ack.ok !== true) throw error('worldbook-not-saved', '世界书没有返回保存确认');
      if (updateCache) {
        assertContext(expected);
        // ST's public cache is the cache saveWorldInfo itself updates. The POST
        // above already persisted this record; do not upload its full backup twice.
        // Hosts without that verified API retain the existing save/cache path.
        const runtime=await worldbookRuntime();assertContext(expected);
        if(runtime){const c=context();runtime.worldInfoCache.set(name,clone(value));await c.eventSource.emit(c.eventTypes.WORLDINFO_UPDATED,name,clone(value));}
        else await context().saveWorldInfo(name, clone(value), true);
      }
      const actual = await readRawBook(name, expected);
      if (!same(actual, value)) throw error('worldbook-readback-mismatch', '世界书磁盘读回与目标不一致');
    }
    function getBookName() {
      return scope === 'chat' ? api.getChatWorldbookName('current') : api.getCharWorldbookNames('current').primary;
    }
    async function snapshot(expected = operationContext(), fields = ['worldbook', 'regex', 'scripts', 'registry'], {freshWorldbook=false}={}) {
      assertContext(expected, true);
      if (!Array.isArray(fields) || !fields.length || fields.some(field => !['worldbook', 'regex', 'scripts', 'registry'].includes(field))) throw error('invalid-snapshot', '未支持的组件快照范围');
      const result = {};
      if (fields.includes('regex') || fields.includes('scripts')) {
        await context().unshallowCharacter(String(context().characterId));
        assertContext(expected, true);
      }
      if (fields.includes('worldbook')) {
        const name = getBookName();
        const entries = name ? freshWorldbook?rawWorldbookEntries(await readRawBook(name,expected)):(await api.getWorldbook(name)).map(normalizeEntry) : [];
        result.worldbook = { internalName: name || '', entries: clone(entries) };
      }
      assertContext(expected, true);
      if (fields.includes('regex')) result.regex = { scripts: options.rawRegex ? clone(rawData(api.getCharData('current')).extensions?.regex_scripts || []).map(fromRawRegex) : clone(api.getTavernRegexes({ type: 'character' })) };
      if (fields.includes('scripts')) result.scripts = { trees: clone(api.getScriptTrees({ type: 'character' })) };
      if (fields.includes('registry')) { const state = readState(); result.registry = clone(state.pendingRegistry || state.registry || { format: 1, packages: {} }); }
      return result;
    }
    async function writeStage(stage, value, expectedSnapshot) {
      if (!locked) throw error('lock-required', '未取得安装锁');
      if (recoveryOnly && (!currentJournal || !Object.hasOwn(currentJournal.before || {}, stage) || !same(value, currentJournal.before[stage]))) throw error('recovery-write-scope', '恢复模式只能恢复已核对安装记录中的原组件');
      const expected = operationContext(); assertContext(expected);
      if (!Object.hasOwn(expectedSnapshot, stage) || !same(await snapshot(expected, Object.keys(expectedSnapshot),{freshWorldbook:stage==='worldbook'}), expectedSnapshot)) throw error('concurrent-change', '组件已被其他操作修改，停止覆盖');
      if (stage !== 'worldbook' || scope !== 'chat') await assertFreshCharacter(expected);
      if (stage === 'worldbook') {
        const old = expectedSnapshot.worldbook;
        let raw = await readRawBook(old.internalName, expected);
        if (value.internalName !== old.internalName) {
          await context().updateWorldInfoList(); assertContext(expected);
          const names = await api.getWorldbookNames(); assertContext(expected);
          if (names.includes(value.internalName)) {
            if (!currentJournal || currentJournal.before.worldbook.internalName !== value.internalName || !same(currentJournal.before.worldbook, value)) throw error('worldbook-name-collision', '目标世界书名已存在，拒绝覆盖');
            raw = await readRawBook(value.internalName, expected);
            if (!same(Object.values(raw.entries || {}).map(rawEntryRuntime).sort((a, b) => a.uid - b.uid), value.entries.map(normalizeEntry).sort((a, b) => a.uid - b.uid))) throw error('concurrent-change', '原世界书已被其他操作修改，停止恢复覆盖');
          }
        }
        const result = { ...clone(raw), entries: {} };
        const previous = new Map(old.entries.map(e => [e.uid, e]));
        value.entries.forEach((entry, index) => {
          const original=currentJournal?.before?.worldbook?.entries.find(e=>e.uid===entry.uid);
          const restored=original&&same(entry,original)?currentJournal?.worldbookDeletedRaw?.[String(entry.uid)]:null;
          result.entries[String(entry.uid)] = mergeRawEntry(raw.entries?.[String(entry.uid)]||restored, previous.get(entry.uid), entry, index);
        });
        await writeRawBook(value.internalName, result, expected, true);
        if (value.internalName !== old.internalName) { await context().updateWorldInfoList(); assertContext(expected); }
        assertContext(expected);
        if (scope === 'chat') {
          await withChatSave(expected,async()=>{
            if (api.getChatWorldbookName('current') !== (old.internalName || null)) throw error('binding-changed', '聊天世界书绑定已被改动');
            await api.rebindChatWorldbook('current', value.internalName);
            await confirmBinding(value.internalName,expected);
          });
        }
        else if (value.internalName !== old.internalName) {
          const bindings = api.getCharWorldbookNames('current');
          if (bindings.primary !== (old.internalName || null)) throw error('binding-changed', '世界书绑定已被改动');
          // TH 4.11.2 rebindCharWorldbooks schedules ST's full character form
          // save. ST 1.19.0 then recreates an untainted one-message chat.
          // Use its narrow extension-field API instead. Keep the checked hidden
          // form field in sync without events or a scheduled character save.
          const field = (options.document || root.parent?.document || root.document)?.getElementById('character_world');
          if (typeof context().writeExtensionField !== 'function' || typeof context().getOneCharacter !== 'function' || !field || field.type !== 'hidden') throw error('capability-missing', '缺少不会重建开场的世界书绑定接口');
          if (field.value !== (old.internalName || '')) throw error('binding-changed', '世界书表单有未保存修改，停止覆盖');
          await context().writeExtensionField(context().characterId, 'world', value.internalName);
          assertContext(expected);
          if (field.value !== (old.internalName || '')) throw error('binding-changed', '保存期间世界书表单已变化');
          field.value = value.internalName;
        }
        assertContext(expected);
        if(scope!=='chat')await confirmBinding(value.internalName, expected);
        if (scope === 'character' && value.internalName !== old.internalName) {
          // The server also regenerates the embedded character_book. Read the
          // saved card back; getOneCharacter refreshes cache without saving a
          // character form or recreating chat messages (ST 1.19.0 script.js).
          await context().getOneCharacter(expected.characterKey); assertContext(expected);
        }
      } else if (stage === 'regex') {
        guardRaw(clone(rawData(api.getCharData('current'))), 'regex', options.rawRegex);
        if (options.rawRegex) {
          // TH's regex projection drops substituteRegex and unknown fields.
          // ST's narrow field writer preserves the complete regex records.
          await context().writeExtensionField(context().characterId, 'regex_scripts', toRawRegexes(value.scripts));
          assertContext(expected);
          await context().getOneCharacter(expected.characterKey);
        } else await api.replaceTavernRegexes(value.scripts, { type: 'character' });
        assertContext(expected);
        // Disk checks use only fields the checked helper supports.
        await confirm(data => same(data.extensions?.regex_scripts || [], toRawRegexes(value.scripts)), expected);
      } else if (stage === 'registry') {
        const state = readState(); state.pendingRegistry = clone(value);
        await saveState(state, expected);
      } else if (stage === 'scripts') {
        guardRaw(clone(rawData(api.getCharData('current'))), 'scripts');
        // This call can destroy this iframe. Recovery performs the final disk confirmation.
        api.replaceScriptTrees(value.trees, { type: 'character' });
      } else throw error('unsupported-stage', '未支持的安装步骤');
    }
    async function confirmBinding(name, expected) {
      const check = () => { if (getBookName() !== (name || null)) throw error('binding-changed', '当前世界书绑定与目标不一致'); };
      check();
      if (scope === 'character') return confirm(data => { check(); return (data.extensions?.world || '') === (name || ''); }, expected, 'binding-not-persisted', '角色世界书绑定尚未保存，保留恢复记录');
      // ST 1.19.0, 7e8663cd: src/endpoints/chats.js /get; only inspect metadata.
      for (const delay of [0, 250, 500, 1000, 2000, 3000, 4000]) {
        if (delay) await wait(delay);
        const chat = await post('chats/get', { avatar_url: expected.characterKey, file_name: expected.chatId }, expected);
        check();
        if (Array.isArray(chat) && (chat[0]?.chat_metadata?.world_info || '') === (name || '')) return;
      }
      throw error('binding-not-persisted', '聊天世界书绑定尚未保存，保留恢复记录');
    }
    async function verifyDisk(after, expected) {
      if (after.regex || after.scripts) {
        const data = await persisted(expected);
        if (after.regex) { guardRaw(data, 'regex', options.rawRegex); if (!same(data.extensions?.regex_scripts || [], toRawRegexes(after.regex.scripts))) throw error('components-not-persisted', '正则尚未持久保存，等待恢复确认'); }
        if (after.scripts) { guardRaw(data, 'scripts'); if (!same(settings(data).scripts || [], after.scripts.trees)) throw error('components-not-persisted', '脚本尚未持久保存，等待恢复确认'); }
      }
      const name = after.worldbook.internalName;
      await confirmBinding(name, expected);
      if (name) {
        const raw = await readRawBook(name, expected);
        const byUid = values => values.sort((a, b) => a.uid - b.uid);
        if (!same(Object.keys(raw.entries || {}).sort(), after.worldbook.entries.map(e => String(e.uid)).sort()) || !same(byUid(Object.values(raw.entries || {}).map(rawEntryRuntime)), byUid(after.worldbook.entries.map(normalizeEntry)))) throw error('worldbook-not-persisted', '世界书字段的磁盘读回与目标不一致');
      }
      if (getBookName() !== (name || null)) throw error('binding-changed', '核实存盘时世界书绑定已被改动');
      assertContext(expected);
    }
    async function openMirror() {
      if (!database) database = new Promise((resolve, reject) => {
        const idb = options.indexedDB || root.indexedDB;
        if (!idb?.open) { reject(error('storage-unavailable', '当前浏览器不能保存事务编号，只检查并提示更新')); return; }
        let request;
        try { request = idb.open('cxx-update-transactions', 1); } catch (_) { reject(error('storage-unavailable', '当前浏览器拒绝事务存储，只检查并提示更新')); return; }
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('journals')) request.result.createObjectStore('journals'); };
        request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
        request.onerror = request.onblocked = () => reject(error('storage-unavailable', '浏览器事务存储不可用，只检查并提示更新'));
      }).catch(cause => { database = null; throw cause; });
      return database;
    }
    async function mirror(key, mode, update) {
      const state=readState(),instance=state.instanceId;
      if(!instance)return mirrorRaw(key,mode,update);
      // Old avatar-only records remain available to their original instance.
      // A newly imported card must neither adopt nor be blocked by that record.
      const scoped=JSON.stringify([key,instance]);
      const legacy=await mirrorRaw(key,'readonly',row=>({result:row}));
      return mirrorRaw(scoped,mode,row=>update(row||(legacy?.instanceId===instance?legacy:null)));
    }
    async function mirrorRaw(key, mode, update) {
      const db = await openMirror();
      return new Promise((resolve, reject) => {
        let result, cause, transaction;
        try { transaction = db.transaction('journals', mode); } catch (_) { reject(error('storage-unavailable', '浏览器事务存储不可用')); return; }
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = transaction.onabort = () => reject(cause || error('storage-unavailable', '浏览器事务保存失败'));
        const store = transaction.objectStore('journals'), request = store.get(key);
        request.onsuccess = () => {
          try {
            const change = update(request.result || null);
            result = change.result;
            if (change.value !== undefined) store.put(clone(change.value), key);
          } catch (e) { cause = e; transaction.abort(); }
        };
      });
    }
    function journalBackup(book, instanceId, kind='active') {
      const record=book.extensions?.__cxx_update_journals?.[instanceId]?.[kind];
      return record || book.extensions?.__cxx_update_backup;
    }
    async function saveJournalRecord(name, instanceId, journal, kind, expected) {
      const book=await readRawBook(name,expected);
      const all=book.extensions?.__cxx_update_journals||{};
      const slot={...all[instanceId],[kind]:{format:2,instanceId,journal:clone(journal)}};
      await writeRawBook(name,{...book,extensions:{...book.extensions,__cxx_update_journals:{...all,[instanceId]:slot}}},expected,true);
    }
    async function readReleaseBackup(name) { const state=readState();return journalBackup(await readRawBook(name),state.instanceId,'release'); }
    function createStorage() {
      let ownerId = null;
      async function getJournal() {
        const expected = operationContext(), state = readState(expected);
        // The server worldbook is the primary backup; IDB is only an atomic local mirror.
        let row = null;
        if (locked || options.indexedDB || root.indexedDB) {
          try { row = await mirror(expected.characterKey, 'readonly', value => ({ result: value })); }
          catch (cause) { if (locked) throw cause; }
        }
        assertContext(expected, true);
        const name = state.journalName || (row?.status === 'active' && row.instanceId === state.instanceId ? row.journalName : null);
        if (!name) { currentJournal = null; return null; }
        const book = await readRawBook(name, expected);
        const backup = journalBackup(book,state.instanceId);
        if (!backup || backup.instanceId !== state.instanceId) throw error('backup-missing', '安装记录指向的备份不存在，停止自动操作');
        const journal = backup.journal;
        if (!journal?.id || row && (row.id !== journal.id || row.status !== 'active') || ownerId && ownerId !== journal.id) throw error('stale-journal', '旧脚本不能重新接管已结束或已替换的安装');
        if (locked) assertContext(journal.context, true);
        if (locked) {
          const adopted = await mirror(expected.characterKey, 'readwrite', actual => {
            if (actual && (actual.id !== journal.id || actual.status !== 'active')) return { result: false };
            return { result: true, value: { id: journal.id, instanceId: state.instanceId, journalName: name, status: 'active', journal: clone(journal) } };
          });
          if (!adopted) throw error('stale-journal', '当前事务编号已被其他脚本替换');
          if (!state.journalName) {
            // Restore only this verified journal's missing pointer before rollback
            // writes (notably registry writes) need to update the character state.
            if (!same(state, readState(expected))) throw error('recovery-state-changed', '恢复记录检查期间角色状态变化');
            await saveState({ ...state, journalName: name }, expected);
          }
        }
        ownerId = journal.id; currentJournal = clone(journal);
        return clone(journal);
      }
      async function writeJournal(journal, createNew, expectedId) {
        if (!locked) throw error('lock-required', '未取得安装锁');
        if (recoveryOnly && createNew) throw error('recovery-write-scope', '恢复模式不能创建新的安装任务');
        const expected = operationContext(); assertContext(journal.context, true);
        const state = readState(expected);
        if (createNew) journal.previousLedger = { installed: clone(state.installed || {}), baseline: clone(state.baseline || {}), conflicts: clone(state.conflicts || []), componentPackages: clone(state.componentPackages || {}) };
        else if (!journal.previousLedger && currentJournal?.previousLedger) journal.previousLedger = clone(currentJournal.previousLedger);
        if(createNew&&journal.stages.includes('worldbook')){
          const remaining=new Set(journal.after.worldbook.entries.map(e=>e.uid)),removed=journal.before.worldbook.entries.filter(e=>!remaining.has(e.uid));
          if(removed.length){const raw=await readRawBook(journal.before.worldbook.internalName,expected);journal.worldbookDeletedRaw={};for(const e of removed){const row=raw.entries?.[String(e.uid)];if(!row)throw error('worldbook-delete-backup-missing','待移出条目 '+e.uid+' 的原始数据缺失，未开始安装');journal.worldbookDeletedRaw[String(e.uid)]=clone(row);}}
        }else if(!journal.worldbookDeletedRaw&&currentJournal?.id===journal.id&&currentJournal.worldbookDeletedRaw)journal.worldbookDeletedRaw=clone(currentJournal.worldbookDeletedRaw);
        const name = createNew ? api.getCharWorldbookNames('current').primary : state.journalName;
        if(createNew&&!name)throw error('backup-book-missing','角色主世界书尚未绑定，请先恢复绑定后重试。');
        const accepted = await mirror(expected.characterKey, 'readwrite', row => {
          if (createNew ? row?.status === 'active' : !row || row.status !== 'active' || row.id !== (expectedId || ownerId) || row.id !== journal.id) return { result: false };
          if (!createNew && state.journalName && state.journalName !== row.journalName) return { result: false };
          return { result: true, value: { id: journal.id, instanceId: state.instanceId, journalName: createNew ? name : row.journalName, status: 'active', journal: clone(journal) } };
        });
        if (!accepted) return false;
        ownerId = journal.id; currentJournal = clone(journal);
        const record = await mirror(expected.characterKey, 'readonly', row => ({ result: row }));
        assertContext(expected, true);
        try { await saveJournalRecord(record.journalName,state.instanceId,journal,'active',expected); }
        catch (cause) {
          if (createNew) await mirror(expected.characterKey, 'readwrite', row => row?.id === journal.id ? { result: true, value: { ...row, status: 'complete', journal: null } } : { result: false });
          throw cause;
        }
        if (createNew) {
          state.journalName = name;
          await saveState(state, expected);
        }
        return true;
      }
      return {
        get: key => {
          if (!key.endsWith(':installed')) return getJournal();
          const state = readState();
          const result = { installed: state.installed || {}, baseline: state.baseline || {}, conflicts: state.conflicts || [], scope: state.scope || scope, registry: state.registry || { format: 1, packages: {} } };
          if (Object.prototype.hasOwnProperty.call(state, 'componentPackages')) result.componentPackages = checkedComponentPackages(state.componentPackages);
          return clone(result);
        },
        claim: async (key, journal) => { if (await getJournal()) return false; return writeJournal(journal, true); },
        set: async (key, value, compare = {}) => {
          if (!locked) throw error('lock-required', '未取得安装锁');
          if (!key.endsWith(':installed')) return writeJournal(value, false, compare.expectedId);
          const journal = await getJournal();
          if (!journal || !value?.installed || !value?.baseline || !['character', 'chat'].includes(value.scope)) throw error('invalid-installed-state', '安装确认记录缺少包清单、基线或作用范围');
          if (compare.expectedId && compare.expectedId !== journal.id) throw error('stale-journal', '安装确认属于另一条事务，停止保存');
          if (value.scope !== scope || value.scope !== journal.installed.scope) throw error('scope-changed', '恢复时的世界书范围与原安装不同');
          const hasComponents = Object.prototype.hasOwnProperty.call(value, 'componentPackages');
          if (hasComponents !== Object.prototype.hasOwnProperty.call(journal.installed, 'componentPackages')) throw error('component-ledger-mismatch', '组件归属账本与安装记录不一致，停止保存');
          const components = hasComponents ? checkedComponentPackages(value.componentPackages) : null;
          if (hasComponents && !same(components, checkedComponentPackages(journal.installed.componentPackages))) throw error('component-ledger-mismatch', '组件归属账本与安装记录不一致，停止保存');
          const keys = ['installed', 'baseline', 'conflicts', 'scope', 'registry', ...(hasComponents ? ['componentPackages'] : [])];
          if (Object.keys(value).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key)) || !same(value, journal.installed) || !same(value.registry, journal.after.registry)) throw error('installed-target-mismatch', '安装确认必须与日志中的完整目标一致，停止保存');
          await verifyDisk(journal.after, journal.context);
          const state = readState();
          if (hasComponents) state.componentPackages = components;
          state.registry = clone(journal.after.registry); delete state.pendingRegistry;
          state.installed = clone(value.installed); state.baseline = clone(value.baseline);
          state.scope = value.scope; state.contentRevision = CryptoCompat.uuid(); state.conflicts = clone(value.conflicts || []);
          const row = await mirror(journal.context.characterKey, 'readonly', record => ({ result: record }));
          if (row?.id !== journal.id || row.status !== 'active') throw error('stale-journal', '当前安装记录已被替换');
          state.journalName = row.journalName;
          if (value.scope === 'character' && journal.previousLedger && !same(journal.previousLedger.installed['cyber2051.core'] || null, value.installed['cyber2051.core'] || null)) {
            await saveJournalRecord(row.journalName,state.instanceId,journal,'release',journal.context);
            state.lastReleaseBackup = row.journalName;
          }
          await saveState(state, journal.context);
          return true;
        },
        remove: async (key, compare = {}) => {
          if (!locked) throw error('lock-required', '未取得安装锁');
          const journal = await getJournal();
          if (!journal) return false;
          const expectedId = compare.expectedId || ownerId;
          if (expectedId !== journal.id) return false;
          const record = await mirror(journal.context.characterKey, 'readonly', row => ({ result: row }));
          if (record?.id !== expectedId || record.status !== 'active') return false;
          const state = readState(); delete state.journalName; delete state.pendingRegistry;
          await saveState(state, journal.context, expectedId);
          const removed = await mirror(journal.context.characterKey, 'readwrite', row => row?.id === expectedId && row.status === 'active' ? { result: true, value: { ...row, status: 'complete', journal: null } } : { result: false });
          if (removed) { ownerId = null; currentJournal = null; }
          return removed;
        },
      };
    }
    // A reused avatar filename can leave a journal pointer owned by the previous
    // imported instance. Once the mirror record belongs to another instance that
    // pointer is not this save's recovery material: it stays untouched for its
    // owner and never blocks work on this one.
    function foreignRecord(state, record, expected) {
      return !state.pendingRegistry && state.cardId === expected.cardId && state.characterKey === expected.characterKey &&
        !!state.instanceId && !!record?.instanceId && record.instanceId !== state.instanceId;
    }
    async function inspectInstall() {
      const expected = operationContext(), state = readState(expected);
      let record = null, backup = null;
      const result = (kind, code, message) => ({ kind, ...(code ? { code, message } : {}), context: clone(expected), state, record, backup });
      try { record = await mirror(expected.characterKey, 'readonly', row => ({ result: row })); }
      catch (cause) { assertContext(expected, true); return result('blocked', cause.code || 'storage-unavailable', cause.message); }
      assertContext(expected, true);
      if (!same(state, readState(expected))) throw error('recovery-state-changed', '检查期间安装记录变化，请重新检查');
      if (foreignRecord(state, record, expected)) {
        // Keep the old instance's local journal intact. Its payload is not this save's recovery material.
        record = { id: record.id, instanceId: record.instanceId, status: record.status, journalName: record.journalName };
        return result('foreign', null, null);
      }
      const name = state.journalName || (record?.status === 'active' && record.instanceId === state.instanceId ? record.journalName : null);
      if (!name) return state.pendingRegistry || record?.status === 'active' ? result('blocked', 'recovery-owner-unknown', '有未完成记录，但无法核定所属实例；请导出救援文件') : result('none');
      if (await journalOrphan()) return result('orphan', null, '上次更新的恢复记录已不存在，可以直接继续游玩。');
      try { backup = journalBackup(await readRawBook(name, expected),state.instanceId) || null; }
      catch (cause) { assertContext(expected, true); return result('blocked', cause.code || 'backup-unreadable', cause.message); }
      assertContext(expected, true);
      if (!same(state, readState(expected))) throw error('recovery-state-changed', '检查期间安装记录变化，请重新检查');
      if (!backup || backup.instanceId !== state.instanceId) return result('blocked', 'backup-missing', '安装备份缺失或不属于当前实例；请导出救援文件');
      const j = backup.journal;
      if (!j?.id || j.context?.cardId !== expected.cardId || j.context?.characterKey !== expected.characterKey || record && (record.id !== j.id || record.status !== 'active' || record.instanceId !== state.instanceId)) return result('blocked', 'stale-journal', '本地记录与安装备份不一致；保留原记录并导出救援文件');
      return result('pending');
    }
    async function journalForeign() {
      const expected = operationContext(), state = readState(expected);
      const record = await mirror(expected.characterKey, 'readonly', row => ({ result: row }));
      assertContext(expected);
      return foreignRecord(state, record, expected);
    }
    // A pointer can outlive both its mirror row and its worldbook journal, for
    // example after a rescue file or an old-instance import restored the name
    // alone. Nothing is left to restore then, so the pointer must not block work.
    async function journalOrphan() {
      const expected = operationContext(), state = readState(expected);
      if (!state.journalName) return false;
      const record = await mirror(expected.characterKey, 'readonly', row => ({ result: row }));
      assertContext(expected);
      if (record) return false;
      let book = null;
      try { book = await readRawBook(state.journalName, expected); } catch (cause) { if (cause?.code === 'context-changed') throw cause; return false; }
      assertContext(expected);
      return !journalBackup(book, state.instanceId);
    }
    async function assertNoPendingInstall() {
      const expected = operationContext(), state = readState(expected);
      const record = await mirror(expected.characterKey, 'readonly', row => ({ result: row }));
      assertContext(expected);
      if (foreignRecord(state, record, expected)) return;
      if (await journalOrphan()) return;
      if (state.journalName || state.pendingRegistry || record?.status === 'active') throw error('migration-pending-install', '仍有未完成的安装记录，请先恢复后再迁移');
    }
    // Player writes only need the recovery journal, not the content installer lock,
    // its quiet period, full character comparison, or a previous lock's chat scope.
    function playerContext(expected) {
      const actual=getContext();
      if(['characterKey','chatId'].some(k=>actual[k]!==expected[k]))throw error('context-changed','角色或聊天已切换，停止人物保存');
    }
    const samePlayerData=same;
    async function assertPlayerWritable(expected) {
      playerContext(expected);
      const state=api.getVariables({type:'character'})[NAMESPACE]||{};
      const record=await mirror(expected.characterKey,'readonly',row=>({result:row}));
      playerContext(expected);
      const current=api.getVariables({type:'character'})[NAMESPACE]||{};
      if(state.instanceId!==current.instanceId||state.journalName!==current.journalName||(state.pendingRegistry!==undefined)!==(current.pendingRegistry!==undefined))return assertPlayerWritable(expected);
      // A reused avatar filename can retain a journal belonging to the previous
      // imported instance. It remains available to that installer, never erased here.
      const foreign=!current.pendingRegistry&&current.instanceId&&record?.instanceId&&record.instanceId!==current.instanceId;
      if(foreign)return {kind:'other-instance'};
      if(!current.pendingRegistry&&!(record?.status==='active')&&current.journalName&&await journalOrphan())return {kind:'ready'};
      const pending=Boolean(current.journalName||current.pendingRegistry||record?.status==='active');
      if(!pending)return {kind:'ready'};
      const j=record?.status==='active'&&record.instanceId===current.instanceId&&record.journal;
      const ordinary=j&&j.context?.characterKey===expected.characterKey&&j.installed?.scope==='chat'&&!current.pendingRegistry&&
        (!current.journalName||current.journalName===record.journalName)&&Array.isArray(j.stages)&&j.stages.every(s=>s==='worldbook')&&
        j.before?.registry!==undefined&&['scripts','regex','registry'].every(k=>Object.hasOwn(j.before,k)===Object.hasOwn(j.after||{},k)&&(!Object.hasOwn(j.before,k)||samePlayerData(j.before[k],j.after?.[k])));
      if(ordinary)return {kind:'chat-content',chatId:j.context.chatId};
      throw error('migration-pending-install','仍有未完成的安装记录，请先恢复后再保存人物');
    }
    // Chat metadata binding and player persistence share a short commit queue.
    // This queue never reads a character card or acquires the installation lock.
    const chatSaves=new Map();
    function withChatSave(expected,work){
      const key=JSON.stringify([expected.characterKey,expected.chatId]),previous=chatSaves.get(key)||Promise.resolve();
      const result=previous.catch(()=>{}).then(()=>{playerContext(expected);const guard=startChatSaveGuard();return guard?guard.run(expected,work):work();});
      chatSaves.set(key,result);result.finally(()=>{if(chatSaves.get(key)===result)chatSaves.delete(key);}).catch(()=>{});return result;
    }
    async function queuedLock(locks,key,mode,work){
      const control=new AbortController(),timer=setTimeout(()=>control.abort(),5000);
      try{return await locks.request(key,{mode,signal:control.signal},lock=>{clearTimeout(timer);if(!lock)throw error('update-already-running','内容检查仍在占用存档，请稍后重试。');return work(lock);});}
      catch(e){if(e?.name==='AbortError')throw Object.assign(error('update-already-running','内容检查仍在占用存档，请稍后重试。'),{details:{phase:mode==='shared'?'read-lock':'restore-lock',waitMs:5000}});throw e;}
      finally{clearTimeout(timer);}
    }
    async function withLock(work,{waitForIdle=false}={}) {
      if (locked&&!waitForIdle) throw error('update-already-running', '当前脚本已有安装操作');
      const locks = options.locks || root.navigator?.locks;
      if (!locks?.request) throw error('lock-unavailable', '当前浏览器不支持安装锁，只检查并提示更新');
      const captured = Object.freeze(getContext()); assertContext(captured);
      const key = 'cxx-update:' + captured.characterKey;
      const acquire=waitForIdle?fn=>queuedLock(locks,key,'exclusive',fn):fn=>locks.request(key,{mode:'exclusive',ifAvailable:true},fn);
      return acquire(async lock => {
        if (!lock) throw error('update-already-running', '另一个窗口正在更新');
        locked = true; lockedContext = captured; currentJournal = null;
        try { assertContext(captured); await openMirror(); await assertFreshCharacter(captured, true); assertContext(captured); return await work(); }
        finally { locked = false; lockedContext = null; currentJournal = null; }
      });
    }
    async function readLock(work, allowUnresolved){
      const expected=Object.freeze(getContext());assertContext(expected);
      const run=async()=>{assertContext(expected);if(!allowUnresolved)await assertNoPendingInstall();const result=await work();assertContext(expected);if(!allowUnresolved)await assertNoPendingInstall();return result;};
      const locks=options.locks||root.navigator?.locks;
      if(!locks?.request)return run();
      // Queue behind short background content checks; only the acquisition has
      // a deadline. Once acquired, a long archive read keeps its shared lock.
      return queuedLock(locks,'cxx-update:'+expected.characterKey,'shared',run);
    }
    const withReadLock=work=>readLock(work,false),withRescueReadLock=work=>readLock(work,true);
    function capabilities(operation='install') {
      if(!['export','import','install','recover'].includes(operation))return {operation,ok:false,missing:['unknown-operation']};
      const reading=['export','import'].includes(operation), missing=[];
      const names=reading?['getCurrentCharacterId','getVariables']:['getCurrentCharacterId','getCharData','getVariables','updateVariablesWith','getWorldbook','getWorldbookNames','getCharWorldbookNames','rebindCharWorldbooks','getChatWorldbookName','rebindChatWorldbook','getTavernRegexes','replaceTavernRegexes','getScriptTrees','replaceScriptTrees'];
      for(const name of names)if(typeof api[name]!=='function')missing.push(name);
      const c=context();if(typeof api.builtin?.duringGenerating!=='function')missing.push('builtin.duringGenerating');
      for(const name of ['getCurrentChatId','getRequestHeaders',...(!reading?['saveWorldInfo','updateWorldInfoList','unshallowCharacter']:[])])if(typeof c[name]!=='function')missing.push(name);
      if(operation==='import'){if(typeof api.updateVariablesWith!=='function')missing.push('updateVariablesWith');if(typeof c.saveChat!=='function')missing.push('saveChat');}
      if(!reading&&options.rawRegex)for(const name of ['writeExtensionField','getOneCharacter'])if(typeof c[name]!=='function')missing.push(name);
      return {operation,ok:missing.length===0,missing};
    }
    return { getContext, assertContext, snapshot, capabilities, writeStage, readState, saveState, persisted, readRawBook, readReleaseBackup, writeRawBook, createStorage, withLock, withReadLock, withRescueReadLock, withChatSave, startChatSaveGuard, resetChatSaveGuard, stopChatSaveGuard, inspectChatSave, inspectInstall, assertNoPendingInstall, journalForeign, journalOrphan, assertPlayerWritable,
      confirmUpdaterWrite:expected=>assertFreshCharacter(expected),
      worldbookEntries: Object.freeze({ normalizeEntry, rawEntryRuntime, mergeRawEntry }),
      setScope: value => { if (!['character', 'chat'].includes(value)) throw error('invalid-scope', '未支持的世界书作用范围'); scope = value; }, getScope: () => scope,
      generationStarted: id => activeGenerations.add(id), generationEnded, mvuGenerationRequested,
      ready: async (operation='install') => {
        if(!['export','import','install','recover'].includes(operation))throw error('invalid-operation','未知更新操作');
        const available=capabilities(operation);
        if(!available.ok)throw Object.assign(error('capability-missing','此操作缺少接口：'+available.missing.join('、')),{details:available});
        const version=async name=>{try{return typeof api[name]==='function'?String(await api[name]()):'unknown';}catch{return 'unknown';}};
        const st=await version('getTavernVersion'),helper=await version('getTavernHelperVersion');
        if(['install','recover'].includes(operation))recoveryOnly=operation==='recover';
        return {st,helper,...(operation==='install'?{}:{operation})};
      },
    };
  }
  function toRawRegexes(items) {
    return items.map(r => {
      if (r.raw) return clone(r.raw);
      return { id: r.id, scriptName: r.script_name, findRegex: r.find_regex, replaceString: r.replace_string, trimStrings: r.trim_strings,
        placement: [r.source.user_input && 1, r.source.ai_output && 2, r.source.slash_command && 3, r.source.world_info && 5, r.source.reasoning && 6].filter(Boolean),
        disabled: !r.enabled, markdownOnly: r.destination.display, promptOnly: r.destination.prompt, runOnEdit: r.run_on_edit, substituteRegex: 0, minDepth: r.min_depth, maxDepth: r.max_depth };
    });
  }
  function fromRawRegex(raw) {
    return {id:raw.id,script_name:raw.scriptName,enabled:!raw.disabled,find_regex:raw.findRegex,replace_string:raw.replaceString,trim_strings:raw.trimStrings||[],source:{user_input:raw.placement.includes(1),ai_output:raw.placement.includes(2),slash_command:raw.placement.includes(3),world_info:raw.placement.includes(5),reasoning:raw.placement.includes(6)},destination:{display:!!raw.markdownOnly,prompt:!!raw.promptOnly},run_on_edit:!!raw.runOnEdit,min_depth:raw.minDepth??null,max_depth:raw.maxDepth??null,raw:clone(raw)};
  }
  return { create, guardRaw, mergeRawEntry, rawEntryRuntime, rawWorldbookEntries, normalizeEntry, normalizeScript, rawData, toRawRegexes, fromRawRegex, NAMESPACE, SCRIPT_ID };
});
