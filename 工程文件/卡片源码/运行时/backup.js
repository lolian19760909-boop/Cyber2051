(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxUpdateBackup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const CryptoCompat=typeof module==='object'&&module.exports?require('./crypto-compat.js'):globalThis.CxxCrypto;
  const PhoneCore=typeof module==='object'&&module.exports?require('../通讯/phone-core.js'):globalThis.CxxPhoneCore;
  const TYPE = 'cyber2051.local-backup', MARKER = '__cxx_local_backup', MAX_IMPORT_BYTES = 64 * 1024 * 1024;
  const MIGRATION_TYPE = 'cyber2051.migration', MIGRATION_KEY = '__cxx_migration';
  const RESCUE_TYPE = 'cyber2051.recovery';
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
  // Read legacy pretty-printed exports without holding their padding in memory.
  // Only JSON whitespace outside strings is removed; separators between primitive
  // tokens remain, so malformed input such as `1 2` never becomes valid `12`.
  async function readImportFile(file) {
    if (!file || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.slice !== 'function') fail('backup-file-invalid', '未取得可读取的存档文件。');
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }), parts = [];
    const boundary = b => b === 34 || b === 123 || b === 125 || b === 91 || b === 93 || b === 44 || b === 58;
    let quoted = false, escaped = false, space = false, last = 0, total = 0;
    for (let offset = 0; offset < file.size; offset += 256 * 1024) {
      const chunk = file.slice(offset, Math.min(file.size, offset + 256 * 1024));
      if (typeof chunk.arrayBuffer !== 'function') fail('backup-file-unavailable', '当前页面缺少分块文件读取接口，请更新浏览器后导入；原文件保持不变。');
      const bytes = new Uint8Array(await chunk.arrayBuffer()), out = new Uint8Array(bytes.length + 1); let length = 0;
      // Match File.text(): consume only an initial UTF-8 BOM, never one after whitespace.
      const start = offset === 0 && bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191 ? 3 : 0;
      for (let i = start; i < bytes.length; i++) { const b = bytes[i];
        if (!quoted && (b === 32 || b === 9 || b === 10 || b === 13)) { space = true; continue; }
        if (!quoted && space) { if (last && !boundary(last) && !boundary(b)) out[length++] = 32; space = false; }
        out[length++] = b; last = b;
        if (quoted) { if (escaped) escaped = false; else if (b === 92) escaped = true; else if (b === 34) quoted = false; }
        else if (b === 34) quoted = true;
      }
      total += length;
      if (total > MAX_IMPORT_BYTES) fail('backup-too-large', '存档去除格式空白后仍超过 64 MiB，未导入；请保留原文件。');
      try { parts.push(decoder.decode(out.subarray(0, length), { stream: true })); }
      catch (_) { fail('backup-invalid-json', '存档文件不是有效的 UTF-8 JSON，原文件保持不变。'); }
    }
    try { parts.push(decoder.decode()); }
    catch (_) { fail('backup-invalid-json', '存档文件含不完整的 UTF-8 字符，原文件保持不变。'); }
    return parts.join('');
  }
  // Native ST also serializes these records as JSON. No projection of known fields.
  const copy = value => JSON.parse(JSON.stringify(value));
  const identity = value => ({ cardId: value.cardId, characterKey: value.characterKey, chatId: value.chatId });
  const texts = message => message.swipes || [message.mes || ''];
  const branch = (message, swipe) => message.variables?.[swipe] || {};
  function inheritMemory(metadata,from,to){
    const state=metadata?.variables?.__cxx_long_memory;if(!state||state.schema!==1)return;
    const owner=[from.characterKey,from.chatId],same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(state.owner&&!same(state.owner,owner))return;
    state.origins=[owner,...(state.origins||[])].filter((s,i,a)=>a.findIndex(x=>same(x,s))===i);
    if(metadata.world_info===state.book)delete metadata.world_info;
    state.owner=[to.characterKey,to.chatId];state.book='';state.needsRestore=true;
    if(state.history)state.history={...state.history,status:'inherited',error:'续玩副本保留补建材料；需在本故事重新选择范围才能继续未完成的补建。'};
  }
  function jsonlRows(text) {
    try {
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/); while (lines.at(-1) === '') lines.pop();
      const rows = lines.map(line => JSON.parse(line));
      if (!rows.length || rows.some(row => !object(row))) throw new Error('incomplete rows');
      return rows;
    } catch (_) { fail('backup-disk-invalid', '磁盘聊天含损坏记录，不能当作完整备份'); }
  }

  // Rescue material can include third-party script settings and journal copies.
  // Filter only the exported copy; normal local backups remain lossless.
  function redactRescue(input) {
    const secrets = new Set(), hidden = '[已移除凭据]';
    const credential = name => /^(?:[a-z0-9]*api(?:key|token)(?:[a-z0-9]*)|authorization|proxyauthorization|proxypassword|password|passwd|accesstoken|refreshtoken|clientsecret|secretkey|privatekey|cookie|setcookie)$/i.test(name.replace(/[-_\s]/g, ''));
    // A credential carried in a URL query parameter (proxy, relay, compatible API).
    const queryCredential = name => credential(name) || /^(?:key|token|secret|auth|sig|signature)$/i.test(name.replace(/[-_\s]/g, ''));
    // Session parts of a cookie or query string; ordinary preferences such as
    // `theme=dark` stay out of the known-secret set.
    const partCredential = name => queryCredential(name) || /^(?:session|sessionid|sid|jwt|bearer|phpsessid|csrf|csrftoken|xsrf)$/i.test(name.replace(/[-_\s]/g, ''));
    const remember = value => {
      if (typeof value === 'string' && value && value !== hidden) {
        secrets.add(value); const auth = /^(?:Bearer|Basic)\s+(.+)$/i.exec(value); if (auth) secrets.add(auth[1]);
        for (const part of value.matchAll(/(?:^|[;,&?\s])([A-Za-z_][\w.-]*)=([^;,&?\s]+)/g)) if (partCredential(part[1])) secrets.add(part[2]);
      }
      else if (value && typeof value === 'object') Object.values(value).forEach(remember);
    };
    const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // URLs keep their host, path and non-credential parameters; only the userinfo
    // password and credential-named query values are removed.
    function scrubUrl(text) {
      return text.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>\\]+/gi, url => {
        const parts = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)([\s\S]*)$/i.exec(url); if (!parts) return url;
        let authority = parts[2]; const at = authority.lastIndexOf('@');
        if (at >= 0) {
          const info = authority.slice(0, at), host = authority.slice(at + 1), colon = info.indexOf(':');
          if (colon >= 0) { const secret = info.slice(colon + 1); if (secret && secret !== hidden) { secrets.add(secret); authority = info.slice(0, colon) + ':' + hidden + '@' + host; } }
        }
        const rest = parts[3].replace(/([?&])([A-Za-z_][\w.-]*)=([^&#]*)/g, (all, separator, name, value) => {
          if (!value || value === hidden || !queryCredential(name)) return all;
          secrets.add(value); return separator + name + '=' + hidden;
        });
        return parts[1] + authority + rest;
      });
    }
    function walk(value, replaceKnown) {
      if (Array.isArray(value)) return value.map(v => walk(v, replaceKnown));
      if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, v]) => {
        if (credential(key)) { remember(v); return [key, '']; }
        return [key, walk(v, replaceKnown)];
      }));
      if (typeof value !== 'string') return value;
      // Settings are sometimes JSON inside strings. Preserve unrelated text and
      // whitespace unless the parsed contents actually require redaction.
      if (/^\s*[\[{]/.test(value)) {
        try { const parsed = JSON.parse(value), next = walk(parsed, replaceKnown); return JSON.stringify(next) === JSON.stringify(parsed) ? value : JSON.stringify(next); } catch (_) {}
      }
      let text = value;
      if (text.includes('://')) text = scrubUrl(text);
      // A field whose whole value is an auth header is a credential even when the
      // key is unrelated; short schemes are handled here, not by the wide inline rule.
      const header = /^(Bearer|Basic)\s+(\S+)$/i.exec(text);
      if (header && header[2] !== hidden) { secrets.add(header[2]); text = header[1] + ' ' + hidden; }
      text = text.replace(/((?:["']?)([A-Za-z_][\w-]*)(?:["']?)\s*[:=]\s*)(["'`])([^"'`\r\n]*)\3/g, (all, prefix, key, quote, secret) => {
        if (!credential(key) || !secret || secret === hidden) return all;
        remember(secret); return prefix + quote + hidden + quote;
      }).replace(/\b(Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{16,})/gi, (all, scheme, secret) => { remember(secret); return scheme + ' ' + hidden; });
      if (replaceKnown) {
        // An equal copy of a known credential in another field is not data.
        if (text.length >= 2 && secrets.has(text)) return hidden;
        for (const secret of secrets) {
          if (!secret || secret === hidden) continue;
          // Long values are unmistakable; short ones only at token boundaries so
          // narrative text and short ordinary words keep their spelling.
          if (secret.length >= 8) text = text.split(secret).join(hidden);
          else if (secret.length >= 3) text = text.replace(new RegExp('(^|[^A-Za-z0-9_])' + escape(secret) + '(?![A-Za-z0-9_])', 'g'), '$1' + hidden);
        }
      }
      return text;
    }
    const doc = copy(input), disk = doc.payload?.diskJSONL, rows = typeof disk === 'string' ? jsonlRows(disk) : null;
    if (rows) doc.payload.diskJSONL = rows;
    // Collect first, then remove echoed credentials in other fields regardless
    // of their traversal order (e.g. an HTTP error before character settings).
    const clean = walk(walk(doc, false), true);
    if (rows) clean.payload.diskJSONL = JSON.stringify(clean.payload.diskJSONL) === JSON.stringify(rows) ? disk : clean.payload.diskJSONL.map(row => JSON.stringify(row)).join('\n');
    clean.payload.recovery.credentialsRemoved = true;
    return clean;
  }

  function create(options = {}) {
    const Core = options.core || root.CxxUpdateCore, host = options.host;
    const crypto = CryptoCompat.create(options.crypto || root.crypto), api = options.api || root;
    if (!Core || !host) fail('backup-capability', '本地备份缺少核心或上下文，请重新加载卡内脚本。');
    const hash = value => Core.sha256(value, bytes => crypto.digest(bytes));
    const same = (a, b) => Core.canonical(a) === Core.canonical(b);
    const wait = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const checkSize = text => { const bytes=text.length>MAX_IMPORT_BYTES?text.length:new TextEncoder().encode(text).byteLength;if(bytes>MAX_IMPORT_BYTES)fail('backup-too-large', '本地备份超过64 MiB，停止安装或恢复；请先保留原聊天');return bytes; };
    const adapters = options.adapters || nativeAdapters({ api, host, fetch: options.fetch || root.fetch.bind(root), root });
    const exportChecks=new WeakMap(),captureChecks=new WeakMap();
    function exportSignature(expected){
      assert(expected);const value=copy((adapters.liveSnapshot||adapters.snapshot)());assert(expected);
      return Core.canonical({messages:value.messages,metadata:value.metadata});
    }
    function checkCapture(check,code='backup-source-changed'){
      if(exportSignature(check.context)!==check.signature)fail(code,'聊天、变量或消息附加内容已变化，请重新准备存档。');
    }
    async function validatePlayerArt(metadata,messages){
      const profile=metadata?.__cxx_story_profile,ref=profile?.portrait,table=metadata?.__cxx_item_art;
      const label='人物“'+String(profile?.name||'未命名')+'”';
      if(ref!=null){
        if(ref.schema!==1||!['asset','gallery'].includes(ref.kind)||typeof ref.id!=='string'||(ref.kind==='asset'&&!/^art_[a-f0-9]{64}$/.test(ref.id)))fail('migration-portrait-invalid',label+'的立绘引用无效。');
        if(ref.kind==='asset'&&!table?.assets?.[ref.id])fail('migration-art-missing',label+'的立绘资源缺失：'+ref.id+'。请在原故事恢复图片后重新导出；原存档已保留。');
      }
      for(const vars of tables(messages))for(const item of Object.values(vars.stat_data?.terminal?.gameplay?.itemDefinitions||{})){
        const image=item?.appearance;if(image?.kind==='asset'&&!table?.assets?.[image.id])fail('migration-art-missing','物品“'+String(item.name||item.id)+'”的图片资源缺失：'+image.id);
      }
      if(table!=null){
        const Art=options.art||(typeof module==='object'&&module.exports?require('./item-art.js'):root.CxxItemArt);
        if(!Art?.validate)fail('migration-art-capability','图片校验服务未就绪，请重新加载新版更新器。');
        try{await Art.validate(table);}catch(e){fail('migration-art-invalid',(ref?.kind==='asset'?label+'的立绘／':'')+'故事图片校验失败：'+e.message);}
      }
    }
    const assert = expected => host.assertContext(expected);
    const readLive = expected => { assert(expected); const value = copy(adapters.snapshot()); assert(expected); Core.canonical(value); return value; };
    const liveHash = live => hash({ messages: live.messages, metadata: live.metadata, updateState: live.updateState });
    const capturedHash = doc => liveHash({ messages: doc.payload.messages, metadata: doc.payload.header.chat_metadata, updateState: doc.payload.updateState });

    function validateMessages(messages) {
      if (!Array.isArray(messages) || !messages.length) fail('backup-invalid-chat', '备份没有聊天楼层');
      for (const m of messages) {
        if (!object(m) || typeof m.mes !== 'string' || m.swipes !== undefined && (!Array.isArray(m.swipes) || !m.swipes.length || m.swipes.some(t => typeof t !== 'string'))) fail('backup-invalid-chat', '聊天正文或备用回复不是完整文本');
        const swipe = m.swipe_id ?? 0;
        if (!Number.isInteger(swipe) || swipe < 0 || swipe >= texts(m).length) fail('backup-invalid-chat', '聊天分支编号无效');
        if (m.variables !== undefined && !Array.isArray(m.variables) && !object(m.variables)) fail('backup-invalid-chat', '聊天变量表格式无效');
      }
    }
    function diskRows(doc){
      if(typeof doc.payload.diskJSONL==='string')return jsonlRows(doc.payload.diskJSONL);
      if(doc.payload.diskMatchesPayload===true&&object(doc.payload.header)&&Array.isArray(doc.payload.messages))return [copy(doc.payload.header),...copy(doc.payload.messages)];
      fail('backup-disk-invalid','备份缺少可核对的完整磁盘记录');
    }
    async function seal(kind, context, versions, payload, compactDisk=false) {
      const doc = { format: 1, type: TYPE, kind, createdAt: new Date().toISOString(), context: identity(context), versions: copy(versions || {}), payload: copy(payload) };
      // A settled chat otherwise appears twice: structured rows and escaped JSONL.
      // Deduplicate only exact semantic equality, retaining every header/message field.
      const bytes=new TextEncoder().encode(JSON.stringify(doc)).byteLength;
      if(kind==='chat'&&(compactDisk||bytes+96>MAX_IMPORT_BYTES)&&typeof doc.payload.diskJSONL==='string'){
        const rows=jsonlRows(doc.payload.diskJSONL);
        // 消息逐行相同即可用 header+messages 重建磁盘行：酒馆写 chat_metadata 有自己的节流，
        // 内存头通常比文件头新，恢复时要写回的正是新的那份。旧头只留一个摘要作为审计痕迹，
        // 否则几十 MB 的聊天会因为头不一致而整份存两遍，直接撞上 64 MiB 上限。
        if(same(rows.slice(1),doc.payload.messages)){
          if(!same(rows[0],doc.payload.header))doc.payload.diskHeaderDigest=await hash(rows[0]);
          delete doc.payload.diskJSONL;doc.payload.diskMatchesPayload=true;
        }
      }
      doc.sha256 = await hash(doc); checkSize(JSON.stringify(doc)); return doc;
    }
    async function parse(input) {
      let doc;
      if (typeof input === 'string') checkSize(input);
      try { doc = typeof input === 'string' ? JSON.parse(input) : copy(input); Core.canonical(doc); }
      catch (_) { fail('backup-invalid-json', '备份文件不是受支持的完整 JSON'); }
      checkSize(JSON.stringify(doc));
      if (doc.format !== 1 || doc.type !== TYPE || !['chat', 'progress'].includes(doc.kind) || !object(doc.payload) || !object(doc.context)
        || ['cardId', 'characterKey', 'chatId'].some(k => typeof doc.context[k] !== 'string' || !doc.context[k]) || !/^[a-f0-9]{64}$/.test(doc.sha256 || '')) fail('backup-invalid-format', '备份文件类型、归属或校验记录无效');
      const original = doc.sha256; delete doc.sha256;
      if (await hash(doc) !== original) fail('backup-hash-mismatch', '备份文件内容已变化，停止恢复');
      doc.sha256 = original;
      if (!object(doc.payload.header) || !object(doc.payload.header.chat_metadata) || !object(doc.payload.updateState)) fail('backup-invalid-format', '备份缺少聊天设置或内容版本记录');
      if (doc.kind === 'chat') validateMessages(doc.payload.messages);
      else if (!object(doc.payload.variables) || !Number.isInteger(doc.payload.floor) || doc.payload.floor < 0 || !Number.isInteger(doc.payload.swipe) || doc.payload.swipe < 0) fail('backup-invalid-format', '进度备份缺少完整变量表或分支编号');
      await validatePlayerArt(doc.payload.header.chat_metadata,doc.kind==='chat'?doc.payload.messages:[{variables:[doc.payload.variables]}]);
      if(doc.payload.diskMatchesPayload!==undefined){if(doc.payload.diskMatchesPayload!==true||doc.payload.diskJSONL!==undefined)fail('backup-invalid-format','备份磁盘去重标记无效');diskRows(doc);}
      return doc;
    }
    // Called only by the explicit reopen flow while its original memory is intact.
    // The guard hydrates cold branches into a copy; no save of the old window is needed.
    async function captureReopenDraft(draft) {
      await host.ready?.('export');
      const expected=identity(host.getContext()),current=copy((adapters.liveSnapshot||adapters.snapshot)());assert(expected);
      if(draft?.format!==1||draft.type!=='cxx-chat-reopen-draft'||draft.scope?.characterKey!==expected.characterKey||draft.scope?.chatId!==expected.chatId||!same(draft.loaded,{messages:current.messages,metadata:current.metadata}))fail('backup-source-changed','重新打开前的内容已经改变，请重新保全。');
      const full=copy(draft.completeLoaded),disk=copy(draft.disk);
      if(!object(full?.metadata)||!same(full.metadata,draft.loaded.metadata)||!Array.isArray(disk)||!object(disk[0]))fail('backup-invalid-format','重新打开备份缺少原始文件头或完整设置。');
      validateMessages(full.messages);
      for(const message of full.messages)if(message.tt_swipe_cold||['swipes','swipe_info'].some(key=>Array.isArray(message[key])&&message[key].some(value=>value==null)))fail('backup-branches-incomplete','重新打开备份仍有未展开的分支，当前内容保持原位。');
      const version=async name=>{try{return typeof api[name]==='function'?String(await api[name]()):'unknown';}catch{return'unknown';}};
      const versions={st:await version('getTavernVersion'),helper:await version('getTavernHelperVersion')};
      const document=await seal('chat',expected,versions,{header:{...disk[0],chat_metadata:copy(full.metadata)},messages:full.messages,updateState:copy(host.readState()),diskJSONL:disk.map(row=>JSON.stringify(row)).join('\n'),
        reopenDraft:{format:1,composer:String(draft.composer||''),characterVariables:copy(draft.characterVariables),originalLoaded:copy(draft.loaded)}});
      await parse(document);assert(expected);
      const after=copy((adapters.liveSnapshot||adapters.snapshot)());if(!same(draft.loaded,{messages:after.messages,metadata:after.metadata}))fail('backup-source-changed','保全期间聊天又有变化，请重新操作。');
      return document;
    }

    async function captureFull({completeDisk=false,compactDisk=false}={}) {
      await host.ready?.('export');
      await (api.parent?.CxxLongMemory||api.CxxLongMemory)?.prepareExport?.();
      if(completeDisk&&adapters.completeSnapshot){
        const expected=identity(host.getContext()),check={context:expected,signature:exportSignature(expected)};
        const value=await adapters.completeSnapshot(expected);assert(expected);validateMessages(value.messages);checkCapture(check);
        const doc=await seal('chat',expected,value.versions,{header:value.header,messages:value.messages,updateState:value.updateState,diskJSONL:value.diskJSONL},compactDisk);
        checkCapture(check);captureChecks.set(doc,check);return doc;
      }
      const expected = identity(host.getContext()), live = readLive(expected); validateMessages(live.messages);
      const beforeHash = await liveHash(live); assert(expected);
      // Raw JSONL preserves unknown header fields and detects malformed disk rows;
      // current raw memory supplies edits not yet saved by ST's debounced writer.
      const persisted = await adapters.readCurrent(expected); assert(expected);
      if (!object(persisted.header) || persisted.header.mes !== undefined || persisted.header.chat_metadata !== undefined && !object(persisted.header.chat_metadata)
        || !['chat_metadata', 'user_name', 'character_name', 'name'].some(key => Object.prototype.hasOwnProperty.call(persisted.header, key))) fail('backup-disk-unavailable', '当前聊天的完整文件头尚未读到，停止安装');
      if (await liveHash(readLive(expected)) !== beforeHash) fail('backup-source-changed', '捕捉备份期间聊天或内容设置变化，请重新操作');
      const header = { ...copy(persisted.header), chat_metadata: copy(live.metadata) };
      const doc = await seal('chat', expected, live.versions, { header, messages: live.messages, updateState: live.updateState, diskJSONL: persisted.jsonl },compactDisk);
      assert(expected);
      if (await liveHash(readLive(expected)) !== beforeHash) fail('backup-source-changed', '备份完成前聊天又有变化，请重新操作');
      const check={context:expected,signature:Core.canonical({messages:live.messages,metadata:live.metadata})};
      checkCapture(check);captureChecks.set(doc,check);
      return doc;
    }
    function currentBranch(messages, floor, swipe) {
      if (floor === undefined) {
        floor = messages.length - 1;
        while (floor >= 0 && !branch(messages[floor], messages[floor].swipe_id ?? 0).stat_data) floor--;
      }
      if (!Number.isInteger(floor) || floor < 0 || floor >= messages.length) fail('backup-invalid-floor', '没有可导出的 MVU 楼层');
      swipe = swipe ?? messages[floor].swipe_id ?? 0;
      if (!Number.isInteger(swipe) || swipe < 0 || swipe >= texts(messages[floor]).length || !object(branch(messages[floor], swipe))) fail('backup-invalid-swipe', '请选择真实存在的聊天分支');
      return { floor, swipe };
    }
    async function captureProgress(target = {}) {
      const full = await captureFull(), at = currentBranch(full.payload.messages, target.floor, target.swipe);
      const variables = branch(full.payload.messages[at.floor], at.swipe);
      if (!object(variables.stat_data)) fail('backup-mvu-missing', '该分支尚无 MVU 数据，不补造初始化');
      return seal('progress', full.context, full.versions, { header: full.payload.header, ...at, variables, updateState: full.payload.updateState });
    }
    function checkDefinitions(doc, state) {
      const archived = doc.payload.updateState.registry?.packages || {}, current = state.registry?.packages || {};
      for (const [id, record] of Object.entries(archived)) {
        for (const [version, content] of Object.entries({ ...(record.history || {}), [record.version]: record.content })) {
          const existing = current[id], actual = existing && (existing.version === version ? existing.content : existing.history?.[version]);
          if (!actual) fail('backup-definition-missing', '当前卡缺少备份内容版本 ' + id + '@' + version + '；不会自动覆盖共享内容');
          if (!same(actual, content)) fail('backup-definition-conflict', '当前卡的同版本内容与备份不同：' + id + '@' + version);
        }
      }
      const tables = doc.kind === 'chat' ? doc.payload.messages.flatMap(m => Array.from({ length: texts(m).length }, (_, i) => branch(m, i))) : [doc.payload.variables];
      for (const variables of tables) for (const progress of Object.values(variables.stat_data?.terminal?.quests || {})) {
        const ref = progress?.definitionRef; if (!ref) continue;
        const record = current[ref.packageId], content = record && (record.version === ref.version ? record.content : record.history?.[ref.version]);
        if (!content?.quests?.some(q => q.id === ref.questId)) fail('backup-definition-missing', '已接任务的原定义缺失：' + String(ref.questId));
      }
      for (const [id, version] of Object.entries(doc.payload.header.chat_metadata.variables?.__cxx_content_pins || {})) {
        const record = current[id];
        if (!record || record.version !== version && !record.history?.[version]) fail('backup-definition-missing', '该聊天固定的内容版本缺失：' + id + '@' + version);
      }
    }
    function restoreDefinitions(current) {
      const vars = current.payload.header.chat_metadata.variables || {}, Content = options.content || root.CxxContent;
      if (vars[MIGRATION_KEY]?.format === 1 && vars[MIGRATION_KEY].archive?.packages && !Content?.withMigration) fail('backup-migration-capability', '当前卡缺少迁移归档读取能力，停止恢复');
      // Only the current saved chat supplies historical definitions; never the imported backup.
      return Content?.withMigration ? Content.withMigration(current.payload.updateState, vars) : current.payload.updateState;
    }
    function checkOwner(doc, expected) {
      if (doc.context.cardId !== expected.cardId || doc.context.characterKey !== expected.characterKey) fail('backup-wrong-character', '这份备份属于另一张角色卡，不能直接恢复');
    }
    function counts(messages) {
      return { floors: messages.length, branches: messages.reduce((n, m) => n + texts(m).length, 0) };
    }
    async function previewRestore(input, target = {}) {
      const doc = await parse(input), current = await captureFull(), expected = current.context;
      checkOwner(doc, expected); checkDefinitions(doc, restoreDefinitions(current));
      const at = doc.kind === 'progress' ? currentBranch(current.payload.messages, target.floor, target.swipe) : {};
      return { format: 1, backupHash: doc.sha256, currentHash: await hash(current.payload), targetContext: expected, kind: doc.kind,
        counts: doc.kind === 'chat' ? counts(doc.payload.messages) : { floors: 1, branches: 1 }, ...at,
        warnings: ['恢复将创建新聊天副本，原聊天保留；副本不会自动打开。', ...(doc.kind === 'progress' ? ['此文件只恢复指定分支的完整当前变量表，不能还原旧对话历史。'] : []),
          ...(!same(doc.payload.updateState.installed || {}, current.payload.updateState.installed || {}) ? ['当前安装版本不同；保留现有角色内容，不自动降版或迁移结构。'] : [])] };
    }
    async function saveCopy(doc, expected, reason, expectedLiveHash) {
      assert(expected);
      const chatId = 'cxx-' + (reason === 'restored' ? 'restored-' : 'backup-') + crypto.randomUUID();
      if (!/^cxx-(backup|restored)-[a-f0-9-]{36}$/i.test(chatId)) fail('backup-random-unavailable', '无法生成独立的安全副本名称');
      const exists = adapters.copyExists ? await adapters.copyExists(expected, chatId) : await adapters.readCopy(expected, chatId);
      assert(expected);
      if (adapters.copyExists ? exists !== false : !Array.isArray(exists) || exists.length) fail('backup-name-collision', '备份目标已存在或无法确认，拒绝覆盖');
      const header = copy(doc.payload.header);
      header.chat_metadata = { ...header.chat_metadata, integrity: crypto.randomUUID() };
      inheritMemory(header.chat_metadata,doc.context,{...expected,chatId});
      header[MARKER] = { format: 1, type: TYPE, reason, documentHash: doc.sha256, sourceContext: copy(doc.context), createdAt: doc.createdAt,
        sourceHeader: copy(doc.payload.header), updateState: copy(doc.payload.updateState), versions: copy(doc.versions), ...(doc.payload.diskMatchesPayload?{diskMatchesPayload:true}:{diskJSONL:doc.payload.diskJSONL}) };
      const rows = [header, ...copy(doc.payload.messages)];
      if (await liveHash(readLive(expected)) !== expectedLiveHash) fail('backup-source-changed', '写副本前原聊天已变化，停止操作');
      assert(expected);
      await adapters.writeCopy(expected, chatId, copy(rows)); assert(expected);
      const actual = await adapters.readCopy(expected, chatId); assert(expected);
      if (!same(actual, rows)) fail('backup-readback-mismatch', '副本存盘读回不完整，停止安装或恢复；副本名：' + chatId);
      if (await liveHash(readLive(expected)) !== expectedLiveHash) fail('backup-source-changed', '副本保存期间原聊天变化，停止后续操作；副本名：' + chatId);
      return { backupId: chatId, context: identity(expected), sha256: await hash(rows), documentHash: doc.sha256 };
    }
    async function beforeContentInstall({ alreadyLocked = false } = {}) {
      const work = async () => {
        const expected = identity(host.getContext()); let doc;
        // Only observe ST's existing debounced saves. Never save the active chat
        // to make an old window's cache win over another window's newer history.
        for (const delay of [0, 200, 500, 1000]) {
          if (delay) await wait(delay); assert(expected);
          doc = await captureFull(); assert(expected);
          const disk = diskRows(doc);
          if (same(disk.slice(1), doc.payload.messages) && same(disk[0].chat_metadata || {}, doc.payload.header.chat_metadata)) {
            return saveCopy(doc, expected, 'before-content-install', await capturedHash(doc));
          }
        }
        fail('backup-chat-not-persisted', '当前窗口的聊天与磁盘不一致，已停止安装；请先确认其他窗口的记录，再保存本地编辑或刷新，不能强行覆盖旧存档');
      };
      return alreadyLocked ? work() : host.withLock(work);
    }
    async function restoreCopy(input, { preview, confirm } = {}) {
      if (confirm !== 'restore-copy' || !object(preview)) fail('backup-confirmation-required', '请先预览，再明确点击恢复为新副本');
      return host.withLock(async () => {
        const doc = await parse(input), current = await captureFull(), expected = current.context;
        checkOwner(doc, expected); checkDefinitions(doc, restoreDefinitions(current));
        if (!same(identity(preview.targetContext || {}), expected) || preview.backupHash !== doc.sha256 || preview.kind !== doc.kind || preview.currentHash !== await hash(current.payload)) fail('backup-preview-stale', '预览后聊天、内容或备份已变化，请重新预览');
        const currentHash = await capturedHash(current);
        const safety = await saveCopy(current, expected, 'before-restore', currentHash);
        let restored = doc;
        if (doc.kind === 'progress') {
          const at = currentBranch(current.payload.messages, preview.floor, preview.swipe), payload = copy(current.payload), m = payload.messages[at.floor];
          if (!m.variables) m.variables = texts(m).map(() => ({}));
          m.variables[at.swipe] = copy(doc.payload.variables);
          const vars = payload.header.chat_metadata.variables || {};
          const oldVars = doc.payload.header.chat_metadata.variables || {};
          payload.header.chat_metadata.variables = { ...vars };
          for (const key of ['__cxx_content_pins', '__cxx_content_origin']) if (Object.prototype.hasOwnProperty.call(oldVars, key)) payload.header.chat_metadata.variables[key] = copy(oldVars[key]);
          if(vars[PhoneCore.KEY]||oldVars[PhoneCore.KEY])payload.header.chat_metadata.variables[PhoneCore.KEY]=PhoneCore.restore(vars[PhoneCore.KEY],oldVars[PhoneCore.KEY]);
          restored = await seal('chat', expected, current.versions, payload);
        }
        const result = await saveCopy(restored, expected, 'restored', currentHash);
        return { ...result, chatId: result.backupId, preRestoreBackupId: safety.backupId, sourceKind: doc.kind, opened: false };
      });
    }
    async function prepareExportFile(input) {
      let doc;
      if (input?.type === RESCUE_TYPE) {
        doc=copy(input);const digest=doc.sha256;delete doc.sha256;
        if(doc.format!==1||doc.kind!=='rescue'||doc.payload?.recovery?.needsReview!==true||await hash(doc)!==digest)fail('backup-hash-mismatch','救援文件校验失败');
        doc=redactRescue(doc);doc.sha256=await hash(doc);checkSize(JSON.stringify(doc));
      } else doc = input?.type === MIGRATION_TYPE ? await parseMigration(input) : await parse(input);
      const urlAPI = options.urlAPI || root.URL, BlobClass = options.Blob || root.Blob;
      if (!urlAPI?.createObjectURL || !BlobClass) fail('backup-download-unavailable', '当前页面无法下载备份，请保留完整 JSON');
      const filename = 'cyber2051-' + (doc.type === MIGRATION_TYPE ? 'migration' : doc.kind + '-backup') + '-' + doc.createdAt.replace(/[^0-9TZ]/g, '-') + '.json';
      let text=JSON.stringify(doc);const bytes=checkSize(text);
      // Formatting a large archive can multiply its size before the old fallback
      // even runs. Small documents remain readable; large ones use compact JSON.
      if(bytes<=1024*1024){const pretty=JSON.stringify(doc,null,2);if(new TextEncoder().encode(pretty).byteLength<=MAX_IMPORT_BYTES)text=pretty;}
      const url = urlAPI.createObjectURL(new BlobClass([text], { type: 'application/json;charset=utf-8' }));
      return { filename, sha256: doc.sha256, url, revoke: () => urlAPI.revokeObjectURL(url) };
    }
    async function captureRescue() {
      return (host.withRescueReadLock || host.withReadLock || host.withLock)(async () => {
        const full=await captureFull(),expected=full.context,signature=await capturedHash(full),issues=[];
        let inspection=null,sourceSeed=null,character=null,playerStores={};
        try { inspection=await host.inspectInstall?.(); } catch(e) { assert(expected);issues.push({code:e.code||'inspection-failed',message:e.message}); }
        try { sourceSeed=copy(seed()||null); } catch(e) { issues.push({code:e.code||'seed-unavailable',message:e.message}); }
        try { if(typeof api.getCharData==='function')character=copy(api.getCharData('current')); } catch(e) { issues.push({code:'character-unavailable',message:e.message}); }
        const stores=sourceSeed?.migration?.playerStores||[];
        try { if(stores.length){if(!adapters.capturePlayerStores)fail('migration-store-adapter-missing','角色或脚本存档读取接口缺失');playerStores=await adapters.capturePlayerStores(copy(stores),expected);} }
        catch(e) { assert(expected);issues.push({code:e.code||'player-stores-unavailable',message:e.message}); }
        assert(expected);if(await liveHash(readLive(expected))!==signature)fail('backup-source-changed','准备救援文件期间聊天或状态变化，请重试');
        const doc=redactRescue({...full,type:RESCUE_TYPE,kind:'rescue',payload:{...full.payload,recovery:{needsReview:true,inspection,sourceSeed,character,playerStores,issues}}});delete doc.sha256;doc.sha256=await hash(doc);checkSize(JSON.stringify(doc));assert(expected);return doc;
      });
    }
    async function exportFile(input) {
      const document = options.document || root.parent?.document || root.document;
      if (!document) fail('backup-download-unavailable', '当前页面无法下载备份，请保留完整 JSON');
      const prepared = await prepareExportFile(input), a = document.createElement('a'); a.href = prepared.url; a.download = prepared.filename;
      try { document.body.append(a); a.click(); } finally { a.remove(); setTimeout(prepared.revoke, 1000); }
      return { filename: prepared.filename, sha256: prepared.sha256, downloadRequested: true };
    }
    const seed = () => options.getSeed?.() || options.seed || api.getVariables({ type: 'script' }).__cxx_update_seed;
    const safeKey = key => typeof key === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key);
    const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    async function settled(state) {
      if (state.pendingRegistry) fail('migration-pending-install', '仍有未完成的内容安装，请先完成恢复再迁移');
      // A pointer left by a previous import no longer blocks this save once the
      // mirror record belongs to another instance.
      if (state.journalName && !(host.journalOrphan ? await host.journalOrphan() : false) && !(host.journalForeign ? await host.journalForeign() : false)) fail('migration-pending-install', '仍有未完成的内容安装，请先完成恢复再迁移');
      await host.assertNoPendingInstall?.();
    }
    async function buildIdentity() {
      const s = seed();
      if (s?.cardId !== 'cyber2051' || !s.baseline) fail('migration-build-missing', '缺少可识别的作品编号和构建基线');
      return { workId: s.cardId, buildId: s.migration?.buildId || 'legacy:' + await hash(s.baseline), saveSchema: s.migration?.saveSchema || 1, baseVersion: s.baseVersion, ...(s.migration?.contract ? { contract:s.migration.contract } : {}) };
    }
    function tables(messages) {
      // Include even orphaned/unknown variable slots, not just currently selectable swipes.
      return messages.flatMap(m => Object.values(m.variables || {}).filter(object));
    }
    function validateArchive(archive, messages, metadata) {
      if (!object(archive) || !object(archive.packages) || !Array.isArray(archive.legacyQuests)) fail('migration-definitions-missing', '迁移文件缺少历史内容定义');
      const art=metadata?.__cxx_item_art;
      for(const vars of tables(messages))for(const definition of Object.values(vars.stat_data?.terminal?.gameplay?.itemDefinitions||{})){
        const ref=definition?.appearance;if(ref?.kind!=='asset')continue;
        const asset=art?.schema===1&&art.assets?.[ref.id];
        if(!asset||asset.id!==ref.id||asset.mime!=='image/webp'||!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(asset.src||''))fail('migration-art-missing','物品上传图片资源缺失：'+definition.name+'。请保留原聊天，恢复图片资源后再导出完整存档。');
      }
      // The transport keeps future business records opaque. Their meanings belong
      // to the replaceable business scripts, not the frozen installer.
      for(const vars of tables(messages)){const game=vars.stat_data?.terminal?.gameplay;if(!game)continue;for(const table of ['inventory','equipment'])for(const record of Object.values(game[table]||{})){const ref=record?.definitionRef;if(ref?.kind==='items'&&['cxx_loadout','cxx_custom_items','cxx_official_items'].includes(ref.packageId)&&!game.itemDefinitions?.[ref.id])fail('migration-definitions-missing','物品定义缺失：'+ref.id+'。请保留旧聊天，联系作者核对后再导出。');}}
      if(seed().migration?.contract==='cyber2051.raw-save.v1'){
        Core.canonical(archive);
        for(const [id,r]of Object.entries(archive.packages)){
          if(!safeKey(id)||!object(r)||!object(r.content)||!object(r.history))fail('migration-invalid-content','历史内容归档不完整');
          Core.compareVersions(r.version,r.version);for(const v of Object.keys(r.history))Core.compareVersions(v,v);
        }
        return archive;
      }
      const s = seed(), config = { mapIndex: s.mapIndex || {}, characterIds: s.characterIds,
        questIds: Object.values(archive.packages).flatMap(r => [r.content, ...Object.values(r.history || {})]).flatMap(c => (c?.quests || []).map(q => q.id)) };
      const content = value => Core.validateContent(value, config);
      for (const [id, r] of Object.entries(archive.packages)) {
        if (!safeKey(id) || !object(r) || typeof r.optional !== 'boolean' || !['compatible', 'opt_in', 'new_chat'].includes(r.activation)) fail('migration-invalid-content', '历史包归属或启用范围不完整');
        Core.compareVersions(r.version, r.version); content(r.content);
        if (!object(r.history)) fail('migration-invalid-content', '历史版本清单不完整');
        for (const [v, c] of Object.entries(r.history)) { Core.compareVersions(v, v); content(c); }
      }
      if (archive.legacyQuests.length) content({ quests: archive.legacyQuests, gallery: [], worldbook: [] });
      const lookup = (id, version) => { const r = archive.packages[id]; return r && (r.version === version ? r.content : r.history[version]); };
      for (const vars of tables(messages)) for (const [id, progress] of Object.entries(vars.stat_data?.terminal?.quests || {})) {
        const ref = progress?.definitionRef;
        const q = ref ? lookup(ref.packageId, ref.version)?.quests.find(q => q.id === ref.questId) : archive.legacyQuests.find(q => q.id === id);
        if (!q) fail('migration-definitions-missing', '已接任务的原定义缺失：' + id);
        if (ref?.localOverride) content({ quests: [{ ...q, ...ref.localOverride }], gallery: [], worldbook: [] });
      }
      for (const vars of tables(messages)) {
        const gameplay=vars.stat_data?.terminal?.gameplay;
        if (!gameplay) continue;
        if (gameplay.schema !== 1) fail('migration-save-schema','正文玩法存档结构尚未支持');
          if(gameplay.origin?.definitionRef){const ref=gameplay.origin.definitionRef,entry=lookup(ref.packageId,ref.version)?.worldbook?.find(e=>e.uid===ref.uid);if(ref.kind!=='worldbook' || !entry?.extra?.__cxx_player_start)fail('migration-definitions-missing','玩家出身的原版本资料缺失');}
        for (const [table,kind] of Object.entries({inventory:'items',blueprints:'blueprints',skills:'skills',equipment:'items',events:'encounters'})) {
          for (const [id,record] of Object.entries(gameplay[table] || {})) {
            if (id==='$meta' || record===null) continue;
            const ref=record.definitionRef, key=table==='equipment'?record.itemId:id;
            if (!ref || ref.kind!==kind || ref.id!==key || !lookup(ref.packageId,ref.version)?.gameplay?.[kind]?.some(d=>d.id===key)) fail('migration-definitions-missing','玩家玩法记录缺少原始定义：'+table+'.'+id);
          }
        }
      }
      for (const [id, version] of Object.entries(metadata.variables?.__cxx_content_pins || {})) if (!lookup(id, version)) fail('migration-dependency-missing', '聊天启用的内容版本缺失：' + id + '@' + version);
      return archive;
    }
    function archiveOf(doc) {
      const state = doc.payload.updateState, inherited = doc.payload.header.chat_metadata.variables?.[MIGRATION_KEY]?.archive;
      const packages = copy(inherited?.packages || {});
      for (const [id, r] of Object.entries(state.registry?.packages || seed().registry?.packages || {})) {
        const old = packages[id], history = { ...(old?.history || {}), ...(old ? { [old.version]: old.content } : {}), ...(r.history || {}) };
        if (old) for (const [version, c] of Object.entries({ ...old.history, [old.version]: old.content })) {
          const current = r.version === version ? r.content : r.history?.[version];
          if (current && !same(current, c)) fail('migration-definition-conflict', '相同版本的内容定义发生冲突：' + id + '@' + version);
        }
        delete history[r.version];
        packages[id] = { version: r.version, optional: r.optional === true, activation: r.activation || 'compatible', content: copy(r.content), history, historyActivation: copy(r.historyActivation || {}) };
      }
      const legacyQuests = copy(inherited?.legacyQuests || state.initialContent?.quests || seed().initialContent?.quests || []);
      if (legacyQuests.length && !packages['migration.legacy']) packages['migration.legacy'] = { version: '1.0.0', optional: true, activation: 'opt_in', content: { quests: legacyQuests, gallery: [], worldbook: [] }, history: {} };
      return validateArchive({ packages, legacyQuests }, doc.payload.messages, doc.payload.header.chat_metadata);
    }
    async function captureSettled(completeDisk=false) {
      for (const delay of [0, 200, 500, 1000]) {
        if (delay) await wait(delay);
        const doc = await captureFull({completeDisk}), rows = diskRows(doc);
        await settled(doc.payload.updateState);
        if (same(rows.slice(1), doc.payload.messages) && same(rows[0].chat_metadata || {}, doc.payload.header.chat_metadata)) return doc;
      }
      fail('backup-chat-not-persisted', '聊天尚未完整保存，暂不能导出迁移存档；请等待保存完成');
    }
    async function captureMigration({completeDisk=false}={}) {
      const win=api.parent||api;
      await win.CxxStoryProfile?.selected?.(win,{api});
      return (host.withReadLock||host.withLock)(async () => {
        const full = await captureSettled(completeDisk), s = seed(), archive = archiveOf(full), source = await buildIdentity();
        const registration = s.migration?.playerStores || [];
        if (registration.length && !adapters.capturePlayerStores) fail('migration-store-adapter-missing', '已登记的角色或脚本存档尚无完整读取接口，停止导出');
        const playerStores = registration.length ? await adapters.capturePlayerStores(copy(registration), full.context) : {};
        const state = full.payload.updateState, old = full.payload.header.chat_metadata.variables?.[MIGRATION_KEY];
        const header = copy(full.payload.header); delete header[MARKER];
        if (header.chat_metadata.variables) delete header.chat_metadata.variables[MIGRATION_KEY];
        const doc = { format: 1, type: MIGRATION_TYPE, createdAt: new Date().toISOString(), source, sourceContext: full.context,
          payload: { header, messages: full.payload.messages, archive, playerStores,
            preferences: { subscriptions: { ...(old?.preferences?.subscriptions || {}), ...(state.subscriptions || {}) }, mediaPreferences: { ...(old?.preferences?.mediaPreferences || {}), ...(state.mediaPreferences || {}) } },
            dependencies: Object.entries(archive.packages).map(([id, r]) => ({ id, versions: [r.version, ...Object.keys(r.history)].sort() })) } };
        doc.sha256 = await hash(doc); await parseMigration(doc);
        exportChecks.set(doc,captureChecks.get(full));assertExportCurrent(doc);
        const backup = options.readOnlyExport ? null : await saveCopy(full, full.context, 'before-migration', await capturedHash(full));
        assertExportCurrent(doc);
        return { document: doc, backup };
      });
    }
    async function parseMigration(input) {
      let doc;
      if (typeof input === 'string') checkSize(input);
      try { doc = typeof input === 'string' ? JSON.parse(input) : copy(input); Core.canonical(doc); } catch (_) { fail('migration-invalid-json', '不是完整的迁移 JSON 文件'); }
      checkSize(JSON.stringify(doc));
      if (doc?.type !== MIGRATION_TYPE || doc.format !== 1 || !object(doc.source) || !object(doc.payload) || !/^[a-f0-9]{64}$/.test(doc.sha256 || '')) fail('migration-format', '迁移文件格式不受支持；普通聊天TXT不能恢复完整进度');
      if(!object(doc.sourceContext)||['cardId','characterKey','chatId'].some(key=>typeof doc.sourceContext[key]!=='string'||!doc.sourceContext[key].trim()))fail('migration-format','迁移文件缺少有效的来源角色或聊天标识，未创建副本。');
      const digest = doc.sha256; delete doc.sha256;
      if (await hash(doc) !== digest) fail('migration-hash-mismatch', '迁移文件校验失败，原文件保留，未创建副本');
      doc.sha256 = digest;
      if (doc.source.workId !== 'cyber2051' || !Number.isInteger(doc.source.saveSchema) || typeof doc.source.buildId !== 'string' || !doc.source.buildId.trim()) fail('migration-work-mismatch', '迁移文件不属于本作品或缺少构建版本');
      if (!object(doc.payload.header?.chat_metadata) || !object(doc.payload.preferences) || !object(doc.payload.playerStores) || !Array.isArray(doc.payload.dependencies)) fail('migration-format', '迁移文件缺少设置、依赖或存档登记');
      if(doc.payload.header.chat_metadata.__cxx_story_v1?.stage==='creating')fail('migration-creation-pending','此故事尚未完成开局创建。请回原故事选择“继续创建”并完成恢复后再导出；无法恢复时可导出救援文件。');
      validateMessages(doc.payload.messages); validateArchive(doc.payload.archive, doc.payload.messages, doc.payload.header.chat_metadata);
      await validatePlayerArt(doc.payload.header.chat_metadata,doc.payload.messages);
      const deps = Object.entries(doc.payload.archive.packages).map(([id, r]) => ({ id, versions: [r.version, ...Object.keys(r.history)].sort() }));
      if (!same(doc.payload.dependencies, deps)) fail('migration-dependency-missing', '迁移依赖清单与附带内容不一致');
      return doc;
    }
    async function migrationPlan(doc) {
      const target = await buildIdentity(), manifest = seed().migration;
      if (!manifest || !Number.isInteger(manifest.saveSchema) || !Array.isArray(manifest.accepts)) fail('migration-compatibility-missing', '这张卡尚未声明迁移兼容表，请使用支持换卡迁移的新版卡');
      const contractMatch=manifest.contract==='cyber2051.raw-save.v1'&&doc.source.contract===manifest.contract&&doc.source.saveSchema===target.saveSchema&&Core.compareVersions(doc.source.baseVersion,target.baseVersion)<=0;
      if (!contractMatch && ![target, ...manifest.accepts].some(r => r.buildId === doc.source.buildId && r.saveSchema === doc.source.saveSchema)) fail('migration-incompatible', '新版卡未声明支持此来源构建与存档结构，停止迁移');
      const expected = identity(host.getContext()), state = host.readState(); assert(expected); await settled(state);
      for (const [id, r] of Object.entries(doc.payload.archive.packages)) for (const [version, c] of Object.entries({ ...r.history, [r.version]: r.content })) {
        const current = state.registry?.packages?.[id], other = current && (current.version === version ? current.content : current.history?.[version]);
        if (other && !same(other, c)) fail('migration-definition-conflict', '新版卡与存档使用了同一编号但不同内容：' + id + '@' + version);
      }
      const books = adapters.initializationBooks ? await adapters.initializationBooks(expected) : [...api.getGlobalWorldbookNames(), ...(() => { const b = api.getCharWorldbookNames('current'); return [b.primary, ...b.additional]; })()];
      if (!Array.isArray(books) || books.some(b => b !== null && typeof b !== 'string')) fail('migration-init-unavailable', '无法核对新版卡的初始化世界书');
      const initBooks = [...new Set(books.filter(Boolean))].sort();
      if (!initBooks.length || !tables(doc.payload.messages).some(v => object(v.stat_data))) fail('migration-init-unavailable', '缺少已有MVU进度或新版初始化世界书，停止迁移以免重置进度');
      let storePlan = null;
      if (Object.keys(doc.payload.playerStores).length || (manifest.playerStores || []).length) {
        if (!adapters.planPlayerStores || !adapters.applyPlayerStores) fail('migration-store-adapter-missing', '已登记的角色或脚本存档尚无经过验证的迁移接口');
        storePlan = await adapters.planPlayerStores(copy(doc.payload.playerStores), copy(manifest.playerStores || []), expected);
      }
      assert(expected);
      return { target, expected, initBooks, storePlan, instanceId: state.instanceId??null, manifestHash: await hash(manifest) };
    }
    async function previewMigration(input,{completeDisk=false}={}) {
      return (host.withReadLock||host.withLock)(async()=>{
      const doc = await parseMigration(input), plan = await migrationPlan(doc), current = await captureSettled(completeDisk);
      const vars = [...doc.payload.messages].reverse().map(m => branch(m, m.swipe_id ?? 0)).find(v => object(v.stat_data));
      if (!vars) fail('migration-active-state-missing', '当前选中的回复分支没有可核对的玩家进度，停止迁移');
      return { documentHash: doc.sha256, targetContext: plan.expected, planHash: await hash(plan), currentHash: await hash({ messages: current.payload.messages, metadata: current.payload.header.chat_metadata }),
        source: doc.source, sourceChat:doc.sourceContext.chatId, target: plan.target, counts: counts(doc.payload.messages), playerState: copy(vars.stat_data), missing: [],
        warnings: ['原角色卡和原聊天保留；确认后另建续玩副本。', '仅调整新副本的世界书绑定、MVU初始化识别及提示词模板已处理标记，不重新执行历史内容或计算既有数值。', '本聊天继续使用来源存档已启用的内容版本；安装新版内容后可主动切换。', '存档附带的历史内容只在续玩聊天使用，不登记为新版卡已安装代码。'] };
      });
    }
    function migratedRows(doc, plan, record) {
      const header = copy(doc.payload.header), metadata = header.chat_metadata;
      inheritMemory(metadata,doc.sourceContext,{...host.getContext(),chatId:record.chatId});
      if(record.story)metadata.__cxx_story_v1=copy(record.story);
      delete header[MARKER]; metadata.integrity = record.integrity; delete metadata.world_info;
      const vars = metadata.variables || (metadata.variables = {});
      // An implicit compatible version in the old card must become explicit in
      // the new copy, otherwise its new baseline silently changes the catalogue.
      const activeVersions = { ...(vars.__cxx_content_pins || {}) };
      for (const [id, entry] of Object.entries(doc.payload.archive.packages)) {
        if (!Object.hasOwn(activeVersions, id) && (entry.activation || 'compatible') === 'compatible'
          && (!entry.optional || doc.payload.preferences.subscriptions?.[id] === true)) activeVersions[id] = entry.version;
      }
      vars.__cxx_content_pins = activeVersions;
      vars.__cxx_content_origin = { instanceId: plan.instanceId, initialized: true, newChat: false };
      vars[MIGRATION_KEY] = { format: 1, documentHash: doc.sha256, source: doc.source, target: plan.target, archive: copy(doc.payload.archive), preferences: copy(doc.payload.preferences) };
      const messages = copy(doc.payload.messages);
      // Prompt Template 1.17.9 otherwise replays old message templates and clones
      // previous-floor variables on first viewing. These are recognition flags,
      // not player data. Mark every saved branch before the copy can be opened.
      for (const message of messages) for (const key of ['is_ejs_processed', 'variables_initialized']) {
        if (message[key] !== undefined && (!Array.isArray(message[key]) || message[key].some(v => v !== null && typeof v !== 'boolean'))) fail('migration-template-format', '旧提示词模板初始化标记格式不受支持，停止迁移');
        const flags = message[key] || (message[key] = []);
        for (let swipe = 0; swipe < texts(message).length; swipe++) flags[swipe] = true;
      }
      for (const v of tables(messages)) if (object(v.stat_data)) {
        if (v.initialized_lorebooks !== undefined && !object(v.initialized_lorebooks)) fail('migration-init-format', '旧初始化识别格式不受支持，停止迁移');
        const initialized = v.initialized_lorebooks || (v.initialized_lorebooks = {});
        for (const name of plan.initBooks) if (!has(initialized, name)) Object.defineProperty(initialized, name, { value: [], enumerable: true, configurable: true, writable: true });
      }
      return [header, ...messages];
    }
    async function importMigration(input, { preview, confirm,completeDisk=false } = {}) {
      if (confirm !== 'migrate-copy' || !object(preview)) fail('migration-confirmation-required', '请先查看兼容检查，再确认创建续玩副本');
      await host.ready?.('import');
      return host.withLock(async () => {
        const doc = await parseMigration(input), plan = await migrationPlan(doc), current = await captureSettled(completeDisk);
        if (preview.documentHash !== doc.sha256 || preview.planHash !== await hash(plan) || !same(preview.targetContext, plan.expected)
          || preview.currentHash !== await hash({ messages: current.payload.messages, metadata: current.payload.header.chat_metadata })) fail('migration-preview-stale', '预览后存档、聊天或新版卡配置变化，请重新检查');
        const key = await hash({ document: doc.sha256, target: plan.target.buildId }), state = host.readState();
        let record = state.migrations?.[key];
        if (record && (record.manifestHash !== plan.manifestHash || record.documentHash !== doc.sha256)) fail('migration-record-conflict', '迁移记录与当前兼容设置不一致，保留副本供检查');
        if (!record) {
          record = { status: 'pending', chatId: 'cxx-migrated-' + crypto.randomUUID(), integrity: crypto.randomUUID(), documentHash: doc.sha256, manifestHash: plan.manifestHash };
          const prior=copy(doc.payload.header.chat_metadata.__cxx_story_v1||{});
          if(prior.schema!==undefined&&prior.schema!==1)fail('migration-story-schema','此故事登记版本尚不支持，原文件保留');
          const restored=!!prior.parentPointId,createdAt=new Date().toISOString();
          record.story={...prior,schema:1,indexVersion:1,kind:'route',storyId:prior.storyId||crypto.randomUUID(),routeId:crypto.randomUUID(),name:prior.name||'旧版续玩',createdAt,lastPlayedAt:createdAt,slot:restored?prior.slot:1,stage:'playing',quickPoint:null,importedFrom:doc.sha256,...(!restored&&prior.routeId?{parentRouteId:prior.routeId}:{})};
          for(const key of ['pointId','pointKind','rowsHash','exportContext','sourceChatId','cleanupWarning'])delete record.story[key];
          record.rowsHash = await hash(migratedRows(doc, plan, record));
          state.migrations = { ...(state.migrations || {}), [key]: record }; await host.saveState(state, plan.expected);
          assert(plan.expected);
          if (!same(host.readState().migrations?.[key], record)) fail('migration-record-unconfirmed', '迁移记录尚未保存，未开始创建聊天');
        }
        if (!/^cxx-migrated-[a-f0-9-]{36}$/i.test(record.chatId)) fail('migration-record-conflict', '迁移副本名称无效');
        const rows = migratedRows(doc, plan, record);
        if (await hash(rows) !== record.rowsHash) fail('migration-record-conflict', '迁移目标已变化，请保留原迁移记录检查');
        const exists = adapters.copyExists ? await adapters.copyExists(plan.expected, record.chatId) : (await adapters.readCopy(plan.expected, record.chatId)).length > 0;
        assert(plan.expected);
        if (!exists) {
          if (record.status === 'complete') fail('migration-copy-missing', '已完成的续玩副本被移走或删除，不自动再建');
          let saveError;
          try { await adapters.writeCopy(plan.expected, record.chatId, copy(rows)); } catch (e) { saveError = e; }
          assert(plan.expected);
          const actual = await adapters.readCopy(plan.expected, record.chatId); assert(plan.expected);
          if (!same(actual, rows)) { if (saveError) throw saveError; fail('migration-save-unconfirmed', '副本保存后读回不一致，保留迁移记录，请用同一文件重试'); }
        } else if (!same(await adapters.readCopy(plan.expected, record.chatId), rows)) fail('migration-copy-changed', '已有续玩副本已改变，不能覆盖或重复创建');
        assert(plan.expected);
        if (plan.storePlan) await adapters.applyPlayerStores(plan.storePlan, plan.expected);
        const final = host.readState(); await settled(final);
        final.migrations = { ...(final.migrations || {}), [key]: { ...record, status: 'complete' } };
        await host.saveState(final, plan.expected); assert(plan.expected);
        if (!same(host.readState().migrations?.[key], final.migrations[key])) fail('migration-record-unconfirmed', '副本已保存，完成记录尚未核实；请用同一文件重试');
        return { chatId: record.chatId, sha256: record.rowsHash, documentHash: doc.sha256, opened: false, status: 'complete' };
      },{waitForIdle:true});
    }
    function assertExportCurrent(doc){
      const check=exportChecks.get(doc);if(!check)fail('migration-export-stale','请重新准备续玩存档');
      checkCapture(check,'migration-export-stale');
    }
    return { captureFull, captureReopenDraft, captureRescue, captureProgress, parse, previewRestore, restoreCopy, beforeContentInstall, exportFile, prepareExportFile,readImportFile,assertExportCurrent,
      captureMigration, parseMigration, previewMigration, importMigration };
  }

  function nativeAdapters({ api, host, fetch, root: surface = root }) {
    const context = () => api.SillyTavern.getContext();
    const stable=v=>Array.isArray(v)?v.map(stable):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
    async function post(path, body, expected) {
      host.assertContext(expected); const c = context(), origin = surface.parent.location.origin;
      const endpoint = path === 'characters/chats' ? path : 'chats/' + path;
      const response = await fetch(new URL('/api/' + endpoint, origin).href, { method: 'POST', headers: c.getRequestHeaders(), credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(body) });
      host.assertContext(expected);
      if (!response.ok) {
        const detail = await response.json().catch(() => null); host.assertContext(expected);
        const reason = [detail?.message, detail?.details, detail?.error].find(value => typeof value === 'string' && value);
        fail('backup-host-http-error', '本地聊天备份接口返回 ' + response.status + (reason ? ' · ' + reason.slice(0, 500) : ''));
      }
      const result = await response.json(); host.assertContext(expected); return result;
    }
    return {
      async completeSnapshot(expected){
        const c=context();if(c.groupId||typeof c.saveChat!=='function')fail('backup-capability','完整故事存档需要单角色聊天保存接口。');
        const stamp=()=>JSON.stringify(stable(copy([context().chat,context().chatMetadata])));
        const before=stamp();if(host.withChatSave)await host.withChatSave(expected,()=>c.saveChat());else await c.saveChat();host.assertContext(expected);
        const data=await post('export',{avatar_url:expected.characterKey,is_group:false,file:expected.chatId+'.jsonl',format:'jsonl',exportfilename:'story.jsonl'},expected);
        if(typeof data.result!=='string')fail('backup-disk-unavailable','未取得完整聊天文件。');
        // Compare the JSON ST actually saves: Date objects in swipe_info become
        // strings on disk. Keep the live chat untouched while normalizing types.
        const rows=jsonlRows(data.result),messages=rows.slice(1),live=copy(context().chat);
        if(stamp()!==before||messages.length!==live.length||JSON.stringify(rows[0].chat_metadata)!==JSON.stringify(context().chatMetadata)){
          // Compare metadata by content, since TT may reorder object fields.
          const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
          if(stamp()!==before||messages.length!==live.length||JSON.stringify(canonical(rows[0].chat_metadata))!==JSON.stringify(canonical(context().chatMetadata)))fail('backup-chat-not-persisted','聊天正在变化或尚未完整保存，请重试。');
        }
        const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
        for(let i=0;i<live.length;i++){
          const a=live[i],b=messages[i],swipe=a.swipe_id||0;
          if(a.mes!==b.mes||swipe!==(b.swipe_id||0)||a.is_user!==b.is_user||a.is_system!==b.is_system||a.variables?.[swipe]!==undefined&&JSON.stringify(canonical(a.variables[swipe]))!==JSON.stringify(canonical(b.variables?.[swipe])))fail('backup-chat-not-persisted','当前回复或变量尚未保存，不能建立完整存档。');
          if(b.tt_swipe_cold)fail('backup-branches-incomplete','导出仍含延迟加载标记，不能报告完整存档成功。');
          for(const key of ['swipes','swipe_info'])if(Array.isArray(a[key])){if(!Array.isArray(b[key])||a[key].length!==b[key].length||a[key].some((v,j)=>v!=null&&JSON.stringify(canonical(v))!==JSON.stringify(canonical(b[key][j]))))fail('backup-branches-incomplete','备用回复或回复元数据尚未完整保存。');}
          for(const [branch,value]of Object.entries(a.variables||{}))if(value!=null&&JSON.stringify(canonical(value))!==JSON.stringify(canonical(b.variables?.[branch])))fail('backup-branches-incomplete','未选中回复的变量尚未保存，不能建立完整存档。');
        }
        return {header:rows[0],messages,updateState:host.readState(),diskJSONL:data.result,versions:{st:api.getTavernVersion(),helper:api.getTavernHelperVersion()}};
      },
      liveSnapshot(){const c=context();return {messages:copy(c.chat),metadata:copy(c.chatMetadata)};},
      snapshot() {
        const c = context();
        if (c.groupId || !Array.isArray(c.chat) || !object(c.chatMetadata) || typeof api.getChatMessages !== 'function') fail('backup-capability', '本地完整备份仅支持已核对的单角色聊天接口');
        const messages = copy(c.chat), complete = api.getChatMessages('0-{{lastMessageId}}', { include_swipes: true, role: 'all', hide_state: 'all' });
        if (complete.length !== messages.length || complete.some((m, i) => m.message_id !== i || m.swipe_id !== (messages[i].swipe_id ?? 0)
          || JSON.stringify(m.swipes) !== JSON.stringify(texts(messages[i])) || JSON.stringify(m.swipes_data) !== JSON.stringify(texts(messages[i]).map((_, j) => branch(messages[i], j))))) fail('backup-branch-mismatch', '原始聊天与助手分支读取不一致，停止备份');
        return { messages, metadata: copy(c.chatMetadata), updateState: host.readState(), versions: { st: api.getTavernVersion(), helper: api.getTavernHelperVersion() } };
      },
      async readCurrent(expected) {
        // ST 1.19.0 chats.js:679–709: JSONL export returns the raw file, not a text transcript.
        const data = await post('export', { avatar_url: expected.characterKey, is_group: false, file: expected.chatId + '.jsonl', format: 'jsonl', exportfilename: 'local-backup.jsonl' }, expected);
        if (typeof data.result !== 'string') fail('backup-disk-unavailable', '尚未取得完整聊天 JSONL');
        const rows = jsonlRows(data.result);
        return { header: rows[0], jsonl: data.result };
      },
      readCopy: (expected, chatId) => post('get', { avatar_url: expected.characterKey, file_name: chatId }, expected),
      async copyExists(expected, chatId) {
        // ST 1.19 and TT 2.3 simple listings enumerate filenames without parsing
        // their contents, so empty/damaged copies are still protected. TT export
        // maps a missing file to HTTP 500 and cannot serve as an existence probe.
        const files = await post('characters/chats', { avatar_url: expected.characterKey, simple: true }, expected);
        if (!Array.isArray(files) || files.some(row => !object(row) || typeof row.file_name !== 'string' || !row.file_name))
          fail('backup-existence-unconfirmed', '未取得完整聊天文件列表，停止写入副本');
        return files.some(row => row.file_name === chatId + '.jsonl');
      },
      async writeCopy(expected, chatId, rows) {
        // Native save is not an atomic create-only endpoint. Internal UUID names,
        // an existence check, force:false and readback never target the original chat.
        const result = await post('save', { avatar_url: expected.characterKey, file_name: chatId, chat: rows, force: false }, expected);
        if (result.ok !== true) fail('backup-save-unconfirmed', '聊天副本没有返回保存确认');
      },
    };
  }
  return { TYPE, MIGRATION_TYPE, MAX_IMPORT_BYTES, readImportFile, create, nativeAdapters };
});
