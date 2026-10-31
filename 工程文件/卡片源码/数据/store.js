(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxDataStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 数据库存储层：把「酒馆数据库插件」包成卡内唯一的表访问入口。
  // 铁律（真机实测得出的，别改）：
  // 1) 插件导入模板是异步落盘的，读表必须轮询；
  // 2) 插件会把中文表名转拼音成 sheet_* 键，所以表要按「中文名 → 逻辑键 → uid → 模板顺序」解析；
  // 3) 写/删之后要 refreshDataAndWorldbook()，否则同会话里读到的还是旧数据；
  // 4) 任何读不到都返回可读 reason，绝不静默当空。

  const TABLES = ['cxx_actor', 'cxx_actor_stat', 'cxx_inventory', 'cxx_equipment', 'cxx_item_def', 'cxx_fact', 'cxx_pending_tx', 'cxx_turn_index', 'cxx_actor_flag', 'cxx_wallet', 'cxx_roster', 'cxx_scene', 'cxx_effect', 'cxx_pref', 'cxx_battle', 'cxx_tactical', 'cxx_quest', 'cxx_quest_meta'];
  const DEFAULT_WAIT = 12;
  const DEFAULT_STEP = 200;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function text(value) {
    return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  }

  function chainOf(scope) {
    const chain = [];
    let frame = scope;
    for (let depth = 0; frame && depth < 8; depth += 1) {
      if (chain.includes(frame)) break;
      chain.push(frame);
      let next = null;
      try {
        next = frame.parent;
      } catch (error) {
        next = null;
      }
      if (!next || next === frame) break;
      frame = next;
    }
    return chain;
  }

  function usable(api) {
    return !!api && typeof api.exportTableAsJson === 'function' && typeof api.importTemplateFromData === 'function';
  }

  function hostOf(scope) {
    const chain = chainOf(scope);
    for (let i = 0; i < chain.length; i += 1) {
      let api = null;
      try {
        api = chain[i].AutoCardUpdaterAPI;
      } catch (error) {
        api = null;
      }
      if (usable(api)) return { api, host: chain[i], depth: i, chain };
    }
    return { api: null, host: null, depth: -1, chain };
  }

  function detect(scope) {
    const found = hostOf(scope);
    const api = found.api;
    return {
      available: usable(api),
      depth: found.depth,
      capability: {
        export: !!(api && api.exportTableAsJson),
        importTemplate: !!(api && api.importTemplateFromData),
        insert: !!(api && api.insertRow),
        update: !!(api && api.updateRow),
        remove: !!(api && api.deleteRow),
        refresh: !!(api && api.refreshDataAndWorldbook)
      }
    };
  }

  function rawSheets(api) {
    let raw = null;
    try {
      raw = api.exportTableAsJson();
    } catch (error) {
      return [];
    }
    if (!raw || typeof raw !== 'object') return [];
    return Object.keys(raw)
      .filter(key => /^sheet_/.test(key))
      .map(key => ({ key, name: text((raw[key] || {}).name), sheet: raw[key] || {} }));
  }

  // 逻辑名（cxx_actor）→ 真实 sheet 键。四级：模板中文名 → sheet_cxx_* → uid → 模板顺序。
  function resolveKey(list, template, logical) {
    const sheet = (template || {})['sheet_' + logical] || {};
    const wanted = text(sheet.name);
    let hit = null;
    if (wanted) hit = list.find(item => item.name === wanted);
    if (!hit) hit = list.find(item => item.key === 'sheet_' + logical);
    if (!hit && wanted) hit = list.find(item => item.sheet && text(item.sheet.uid) === 'sheet_' + logical);
    if (!hit) {
      // 兜底按模板顺序取第 N 张表：只有导出的表数和逻辑表数一致时才敢用，
      // 否则表被改名/缺表时会把别的表错认成这张（写错表比读不到更糟）。
      const order = TABLES.indexOf(logical);
      if (order >= 0 && list.length === TABLES.length && list[order]) hit = list[order];
    }
    return hit || null;
  }

  function tablesOf(api, template) {
    const list = rawSheets(api);
    const out = {};
    TABLES.forEach(logical => {
      const hit = resolveKey(list, template, logical);
      if (!hit) return;
      const sheet = hit.sheet || {};
      const content = Array.isArray(sheet.content) ? sheet.content : [];
      const source = (template || {})['sheet_' + logical] || {};
      const labels = (Array.isArray(source.content) && source.content[0]) || [];
      out[logical] = {
        key: hit.key,
        name: hit.name || text(sheet.name),
        header: labels.length ? labels.slice() : (Array.isArray(content[0]) ? content[0] : []),
        content,
        rows: Math.max(0, content.length - 1)
      };
    });
    return out;
  }

  function ddlNames(ddl) {
    const names = [];
    if (!ddl) return names;
    const body = ddl.slice(ddl.indexOf('(') + 1, ddl.lastIndexOf(')'));
    body.split('\n').forEach(line => {
      const code = line.split('--')[0];
      const match = code.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z]/);
      if (match) names.push(match[1]);
    });
    return names;
  }

  // 表头是中文显示名，DDL 里才是字段名：两边都填，宿主用哪套都能落库。
  function rowFor(template, logical, values, tables) {
    const sheet = (template || {})['sheet_' + logical] || {};
    const table = tables && tables[logical];
    const labels = table ? table.header : [];
    const names = ddlNames(sheet.sourceData && sheet.sourceData.ddl);
    const row = {};
    names.forEach((name, index) => {
      if (index === 0 || values[name] === undefined) return;
      row[name] = values[name];
      if (labels[index]) row[labels[index]] = values[name];
    });
    return row;
  }

  async function ensureSchema(api, template, options) {
    if (!template || template.mate?.type !== 'chatSheets') return { ok: false, reason: '模板不是 chatSheets' };
    if (typeof api.importTemplateFromData !== 'function') return { ok: false, reason: '宿主没有 importTemplateFromData' };
    const wait = (options && options.wait) || DEFAULT_WAIT;
    const step = (options && options.step) || DEFAULT_STEP;
    let imported;
    try {
      // ACU's dataMode merges rows, but absent template sheets become hidden.
      // Keep this chat's existing schemas/keys unchanged and add only our missing tables.
      const exported = api.exportTableAsJson?.();
      const existing = tablesOf({ exportTableAsJson: () => exported }, template);
      if (TABLES.every(logical => existing[logical]?.content[0]?.length)) return { ok: true, attempts: 0, tables: existing };
      const current = typeof api.getTableTemplate === 'function' ? await api.getTableTemplate({ scope: 'chat' }) : exported;
      const target = JSON.parse(JSON.stringify(current && Object.keys(current).some(key => /^sheet_/.test(key)) ? current : template));
      target.mate ||= JSON.parse(JSON.stringify(template.mate));
      for (const [key, sheet] of Object.entries(exported || {})) if (/^sheet_/.test(key) && !target[key]) target[key] = JSON.parse(JSON.stringify(sheet));
      for (const key of Object.keys(template).filter(key => /^sheet_/.test(key))) {
        const wanted = template[key];
        const exists = Object.entries(target).some(([savedKey, saved]) => /^sheet_/.test(savedKey) && (savedKey === key || saved?.uid === wanted.uid || saved?.name === wanted.name));
        if (!exists) target[key] = JSON.parse(JSON.stringify(wanted));
      }
      imported = await api.importTemplateFromData(target, { scope: 'chat', dataMode: 'merge', conflictPolicy: 'overwrite' });
    }
    catch (error) { return { ok: false, reason: '建表失败：' + String(error?.message || error) }; }
    if (imported === false || imported?.success === false) return { ok: false, reason: '建表失败：' + (imported?.error || imported?.message || '数据库未确认模板导入') };
    let missing = TABLES.slice();
    let empty = [];
    for (let attempt = 0; attempt < wait; attempt += 1) {
      await sleep(step);
      const tables = tablesOf(api, template);
      missing = TABLES.filter(logical => !tables[logical]);
      empty = TABLES.filter(logical => tables[logical] && !tables[logical].header.length);
      if (!missing.length && !empty.length) return { ok: true, attempts: attempt + 1, tables };
    }
    return { ok: false, attempts: wait, missing, emptyHeader: empty, reason: '建表后读不全：缺 ' + missing.join('/') };
  }

  async function refresh(api) {
    if (typeof api.refreshDataAndWorldbook !== 'function') return { ok: false, reason: '宿主没有 refreshDataAndWorldbook' };
    try {
      await api.refreshDataAndWorldbook();
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: String((error && error.message) || error) };
    }
  }

  function create(options) {
    const config = options || {};
    const template = config.template || null;
    const scope = config.scope;
    const wait = config.wait || DEFAULT_WAIT;
    const step = config.step || DEFAULT_STEP;
    let api = null;

    function bind() {
      if (api) return api;
      const found = hostOf(scope);
      api = found.api;
      return api;
    }

    function readAll(pairs) {
      const host = bind();
      if (!usable(host)) return { ok: false, reason: '没有找到数据库接口（插件未装或不可达）', tables: {} };
      const tables = tablesOf(host, template);
      if (!Array.isArray(pairs)) return { ok: true, tables };
      const named = {};
      for (const [logical, alias] of pairs) {
        const names = ddlNames(template?.['sheet_' + logical]?.sourceData?.ddl);
        named[alias || logical] = (tables[logical]?.content.slice(1) || []).map(cells => Object.fromEntries(names.map((name, index) => [name, cells[index]])));
      }
      return { ok: true, tables: named };
    }

    async function read(logical) {
      if (!TABLES.includes(logical)) return { ok: false, reason: '未知表：' + logical };
      const host = bind();
      if (!usable(host)) return { ok: false, reason: '没有找到数据库接口（插件未装或不可达）' };
      const tables = tablesOf(host, template);
      const table = tables[logical];
      if (!table) return { ok: false, reason: '没有这张表：' + logical + '（先 ensureSchema）' };
      const rows = table.content.slice(1).map((cells, index) => ({ index, cells }));
      return { ok: true, key: table.key, name: table.name, header: table.header, rows };
    }

    async function insert(logical, values) {
      if (!TABLES.includes(logical)) return { ok: false, reason: '未知表：' + logical };
      const host = bind();
      if (!usable(host)) return { ok: false, reason: '没有找到数据库接口（插件未装或不可达）' };
      const tables = tablesOf(host, template);
      const table = tables[logical];
      if (!table) return { ok: false, reason: '没有这张表：' + logical };
      // ACU resolves SQL names itself. Sending both SQL and display aliases would repeat columns.
      const names = ddlNames(template['sheet_' + logical]?.sourceData?.ddl);
      const row = Object.fromEntries(Object.entries(rowFor(template, logical, values || {}, tables)).filter(([key]) => names.includes(key)));
      try {
        if (typeof host.insertRow !== 'function') return { ok: false, reason: '宿主没有 insertRow' };
        const used = table.name, ack = await host.insertRow(used, row);
        if (ack === false || ack === -1 || ack?.success === false) return { ok: false, reason: '数据库拒绝新增行（回执 ' + JSON.stringify(ack) + '）' };
        for (let attempt = 0; attempt < wait; attempt += 1) {
          await sleep(step);
          const after = tablesOf(host, template)[logical];
          if (after && after.rows > table.rows) return { ok: true, rows: after.rows, attempts: attempt + 1, via: used };
        }
        return { ok: false, reason: '写入后读不回新增行', rows: table.rows, via: used };
      } catch (error) {
        return { ok: false, reason: String((error && error.message) || error) };
      }
    }

    async function updateRow(logical, rowId, values) {
      const host = bind(), table = usable(host) && tablesOf(host, template)[logical];
      if (!table || typeof host.updateRow !== 'function') return { ok: false, reason: '数据库缺少表或 updateRow：' + logical };
      const index = table.content.findIndex((cells, position) => position > 0 && text(cells[0]) === text(rowId));
      if (index < 1) return { ok: false, reason: '没有对应行：' + rowId };
      try {
        const via = table.name, ack = await host.updateRow(via, index, values);
        if (ack !== true) return { ok: false, reason: '数据库未确认更新行（回执 ' + JSON.stringify(ack) + '）' };
        const names = ddlNames(template['sheet_' + logical]?.sourceData?.ddl);
        for (let attempt = 0; attempt < wait; attempt += 1) {
          const row = tablesOf(host, template)[logical]?.content.find((cells, position) => position > 0 && text(cells[0]) === text(rowId));
          if (row && Object.entries(values).every(([key, value]) => names.includes(key) && text(row[names.indexOf(key)]) === text(value))) return { ok: true, via };
          await sleep(step);
        }
        return { ok: false, reason: '更新后读回不一致' };
      } catch (error) { return { ok: false, reason: String(error?.message || error) }; }
    }

    // ACU 1.3 exposes one persisted import for a whole data document. Full-state mirrors
    // otherwise perform hundreds of separate chat saves and worldbook refreshes.
    async function replaceTables(projected, list, options = {}) {
      const host = bind(), check = options.assertCurrent || (() => {});
      if (typeof host?.importTableAsJson !== 'function') return { ok: false, unsupported: true };
      check();
      const target = JSON.parse(JSON.stringify(host.exportTableAsJson()));
      const tables = tablesOf({ exportTableAsJson: () => target }, template), expected = {};
      for (const logical of list) {
        const table = tables[logical];
        if (!TABLES.includes(logical) || !table) return { ok: false, reason: '没有这张表：' + logical };
        const sheet = target[table.key], header = sheet.content[0], names = ddlNames(template['sheet_' + logical]?.sourceData?.ddl);
        const content = [header, ...(projected[logical] || []).map((values, index) => {
          const row = rowFor(template, logical, values, tables);
          return header.map((label, column) => column === 0 ? index + 1 : row[label] ?? row[names[column]] ?? '');
        })];
        sheet.content = content;
        expected[logical] = content;
      }
      check();
      let saved;
      try { const prepared=options.prepareTables?options.prepareTables(target):target;saved = await host.importTableAsJson(JSON.stringify(prepared),options.persist===false?{mode:'restore',persist:false}:undefined); }
      catch (error) { return { ok: false, reason: '整库镜像提交失败：' + error.message }; }
      check();
      if (saved !== true) return { ok: false, reason: '数据库未确认整库镜像提交。' };
      const actual = tablesOf(host, template);
      for (const logical of list) {
        const a = actual[logical]?.content, b = expected[logical];
        if (!a || a.length !== b.length || b.some((row, index) => index > 0 && row.some((cell, column) => column > 0 && text(a[index]?.[column]) !== text(cell)))) {
          return { ok: false, reason: '整库镜像读回不一致：' + logical };
        }
      }
      return { ok: true, refreshed: true, results: list.map(table => ({ table, ok: true, rows: expected[table].length - 1 })) };
    }

    async function remove(logical, rowIndex) {
      if (!TABLES.includes(logical)) return { ok: false, reason: '未知表：' + logical };
      const host = bind();
      if (!usable(host)) return { ok: false, reason: '没有找到数据库接口（插件未装或不可达）' };
      if (typeof host.deleteRow !== 'function') return { ok: false, reason: '宿主没有 deleteRow' };
      const table = tablesOf(host, template)[logical];
      if (!table) return { ok: false, reason: '没有这张表：' + logical };
      try {
        const position = rowIndex + 1, ack = await host.deleteRow(table.name, position);
        if (ack !== true) return { ok: false, reason: '数据库未确认删除行' };
        await refresh(host);
        for (let attempt = 0; attempt < wait; attempt += 1) {
          await sleep(step);
          const after = tablesOf(host, template)[logical];
          if (after && after.rows < table.rows) return { ok: true, rows: after.rows, via: table.name + '#' + position };
        }
        return { ok: false, reason: '删除后行数没减少' };
      } catch (error) { return { ok: false, reason: String(error?.message || error) }; }
    }

    return { detect: () => detect(scope), ensureSchema: options2 => ensureSchema(bind(), template, options2), read, readAll, insert, updateRow, remove, replaceTables, refresh: () => refresh(bind()), tables: TABLES, template };
  }

  return { TABLES, chainOf, hostOf, detect, tablesOf, resolveKey, ddlNames, rowFor, ensureSchema, refresh, create };
});
