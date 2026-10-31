/*
 * 数据库探针核心（P0）
 *
 * 作用：在不改产品码的前提下，把「卡内脚本能不能用酒馆数据库插件」这件事
 * 变成一串可以复跑、可以留回执的检查。浏览器里给 数据探针.html 用，
 * Node 里给 测试/当前/data-probe.test.cjs 用（注入假宿主）。
 *
 * 不依赖任何库；不写产品状态（探针行写完会自己删掉）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CxxDataProbe = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TABLES = ['cxx_actor', 'cxx_actor_stat', 'cxx_inventory', 'cxx_equipment', 'cxx_item_def', 'cxx_fact', 'cxx_pending_tx', 'cxx_turn_index'];
  var PROBE_TABLE = 'cxx_fact';
  var PROBE_LIMIT = 8;

  function text(value) {
    return typeof value === 'string' ? value : '';
  }

  function chainOf(scope) {
    var chain = [];
    var frame = scope;
    for (var depth = 0; frame && depth < PROBE_LIMIT; depth++) {
      if (chain.indexOf(frame) >= 0) break;
      chain.push(frame);
      var next = null;
      try { next = frame.parent; } catch (error) { next = null; }
      if (!next || next === frame) {
        try { next = frame.top; } catch (error) { next = null; }
        if (!next || next === frame) break;
      }
      frame = next;
    }
    return chain;
  }

  function usable(api) {
    return !!api && typeof api.exportTableAsJson === 'function';
  }

  // 宿主窗口：卡内 iframe → parent → top，逐层找可用 API
  function hostOf(scope) {
    var chain = chainOf(scope || root);
    for (var i = 0; i < chain.length; i++) {
      var frame = chain[i];
      try {
        if (usable(frame.AutoCardUpdaterAPI)) return { host: frame, api: frame.AutoCardUpdaterAPI, depth: i };
      } catch (error) { /* 跨域，跳过 */ }
      try {
        var nested = frame.parent && frame.parent.AutoCardUpdaterAPI;
        if (usable(nested)) return { host: frame.parent, api: nested, depth: i + 1 };
      } catch (error) { /* 跨域，跳过 */ }
    }
    return { host: null, api: null, depth: -1 };
  }

  function detect(scope) {
    var found = hostOf(scope);
    var api = found.api;
    return {
      available: usable(api),
      depth: found.depth,
      capability: {
        export: typeof api?.exportTableAsJson === 'function',
        importTemplate: typeof api?.importTemplateFromData === 'function',
        insert: typeof api?.insertRow === 'function',
        update: typeof api?.updateRow === 'function',
        remove: typeof api?.deleteRow === 'function',
        restore: typeof api?.restoreTableAsJson === 'function'
      }
    };
  }

  function rawSheets(api) {
    var raw = api.exportTableAsJson();
    var list = [];
    if (!raw || typeof raw !== 'object') return list;
    Object.keys(raw).forEach(function (key) {
      if (!/^sheet_/.test(key)) return;
      var sheet = raw[key] || {};
      list.push({ key: key, name: text(sheet.name), sheet: sheet });
    });
    return list;
  }

  // 逻辑名（cxx_actor）→ 真实 sheet 键。优先级：模板中文名同名 → 逻辑名直出 sheet_cxx_* → uid 同名。
  function resolveKey(list, template, logical) {
    var sheet = (template || {})['sheet_' + logical] || {};
    var wanted = text(sheet.name);
    var hit = null;
    if (wanted) hit = list.find(function (item) { return item.name === wanted; });
    if (!hit) hit = list.find(function (item) { return item.key === 'sheet_' + logical; });
    if (!hit && wanted) hit = list.find(function (item) { return item.sheet && text(item.sheet.uid) === 'sheet_' + logical; });
    if (!hit) {
      var order = TABLES.indexOf(logical);
      if (order >= 0 && list[order]) hit = list[order];
    }
    return hit || null;
  }

  function tablesOf(api, template) {
    var list = rawSheets(api);
    var out = {};
    TABLES.forEach(function (logical) {
      var hit = resolveKey(list, template, logical);
      if (!hit) return;
      var sheet = hit.sheet || {};
      var content = Array.isArray(sheet.content) ? sheet.content : [];
      var source = (template || {})['sheet_' + logical] || {};
      var labels = (Array.isArray(source.content) && source.content[0]) || (source.sourceData && Array.isArray(source.sourceData.content) && source.sourceData.content[0]) || [];
      out[logical] = {
        key: hit.key,
        name: hit.name,
        header: labels.length ? labels.slice() : (Array.isArray(content[0]) ? content[0] : []),
        content: content,
        rows: Math.max(0, content.length - 1)
      };
    });
    return out;
  }

  function fingerprint(tables) {
    var parts = TABLES.map(function (name) {
      var table = tables[name];
      return name + ':' + (table ? table.rows + '/' + table.header.length : 'absent');
    });
    return parts.join(';');
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // 插件把导入异步落到聊天元数据上：导入后要轮询几次才能读到全部表。
  async function ensure(api, template) {
    if (!template || template.mate?.type !== 'chatSheets') return { ok: false, reason: '模板不是 chatSheets' };
    if (typeof api.importTemplateFromData !== 'function') return { ok: false, reason: '宿主没有 importTemplateFromData' };
    api.importTemplateFromData(template, { scope: 'chat', dataMode: 'merge', conflictPolicy: 'overwrite' });
    var tables = {};
    var missing = TABLES.slice();
    var empty = [];
    for (var attempt = 0; attempt < 12; attempt += 1) {
      await sleep(200);
      tables = tablesOf(api, template);
      missing = TABLES.filter(function (name) { return !tables[name]; });
      empty = TABLES.filter(function (name) { return tables[name] && !tables[name].header.length; });
      if (!missing.length && !empty.length) return { ok: true, attempts: attempt + 1, missing: [], emptyHeader: [] };
    }
    return { ok: false, attempts: 12, missing: missing, emptyHeader: empty };
  }

  function findHeader(tables, table) {
    return tables[table] ? tables[table].header : [];
  }

  function ddlNames(ddl) {
    var names = [];
    if (!ddl) return names;
    var body = ddl.slice(ddl.indexOf('(') + 1, ddl.lastIndexOf(')'));
    body.split('\n').forEach(function (line) {
      var code = line.split('--')[0];
      var match = code.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z]/);
      if (match) names.push(match[1]);
    });
    return names;
  }

  // 表头是中文显示名，DDL 里才是字段名；两边都填上，宿主用哪套都能落库
  function rowFor(template, table, values, tables) {
    var sheet = template['sheet_' + table] || {};
    var labels = findHeader(tables, table);
    var names = ddlNames(sheet.sourceData && sheet.sourceData.ddl);
    var row = {};
    names.forEach(function (name, index) {
      if (index === 0) return;
      if (values[name] === undefined) return;
      row[name] = values[name];
      if (labels[index]) row[labels[index]] = values[name];
    });
    return row;
  }

  // 写一行探针数据：宿主可能异步落盘，写完轮询到读回为止；键与中文表名都试一遍。
  async function insertProbeRow(api, target, row) {
    var candidates = [target.key, target.name].filter(Boolean);
    var lastError = '';
    for (var i = 0; i < candidates.length; i += 1) {
      try {
        if (typeof api.insertRow === 'function') api.insertRow(candidates[i], row);
        else api.updateCell(candidates[i], target.rows, 'fact_key', row.fact_key);
      } catch (error) {
        lastError = String((error && error.message) || error);
      }
    }
    return lastError;
  }

  function probeRowIndex(tables, stamp) {
    var table = tables[PROBE_TABLE];
    if (!table) return -1;
    var needle = 'cxx-probe-' + stamp;
    for (var i = 1; i < table.content.length; i += 1) {
      var cells = table.content[i];
      if (Array.isArray(cells) && cells.indexOf(needle) >= 0) return i - 1;
    }
    return -1;
  }

  async function writeProbe(api, template, tables, stamp) {
    var sheet = template['sheet_' + PROBE_TABLE] || {};
    var names = ddlNames(sheet.sourceData && sheet.sourceData.ddl);
    if (names.indexOf('fact_key') < 0) return { ok: false, reason: 'DDL 里没有 fact_key' };
    var target = tables[PROBE_TABLE];
    if (!target) return { ok: false, reason: '没有事实流水表' };
    var row = rowFor(template, PROBE_TABLE, { fact_key: 'cxx-probe-' + stamp, turn_no: 0, kind: '其他', payload: '探针写入' }, tables);
    var lastError = await insertProbeRow(api, target, row);
    if (typeof api.triggerUpdate === 'function') {
      try { api.triggerUpdate(); } catch (error) { lastError = String((error && error.message) || error); }
    }
    for (var attempt = 0; attempt < 15; attempt += 1) {
      await sleep(200);
      var fresh = tablesOf(api, template);
      if (probeRowIndex(fresh, stamp) >= 0) return { ok: true, rows: fresh[PROBE_TABLE].rows, attempts: attempt + 1 };
    }
    var settle = tablesOf(api, template);
    return { ok: false, reason: '写入后读不回探针行' + (lastError ? '（' + lastError + '）' : ''), rows: settle[PROBE_TABLE] ? settle[PROBE_TABLE].rows : 0 };
  }

  async function clearProbe(api, template, tables, stamp) {
    if (typeof api.deleteRow !== 'function') return { ok: false, reason: '宿主没有 deleteRow' };
    var current = tablesOf(api, template);
    if (!current[PROBE_TABLE]) return { ok: false, reason: '没有事实流水表' };
    var index = probeRowIndex(current, stamp);
    if (index < 0) return { ok: true, reason: '没有残留探针行', rows: current[PROBE_TABLE].rows };
    var table = current[PROBE_TABLE];
    var names = [table.key, table.name].filter(Boolean);
    var positions = [index, index + 1];
    for (var n = 0; n < names.length; n += 1) {
      for (var p = 0; p < positions.length; p += 1) {
        try { api.deleteRow(names[n], positions[p]); } catch (error) { /* 换下一个候选 */ }
        if (typeof api.refreshDataAndWorldbook === 'function') {
          try { await api.refreshDataAndWorldbook(); } catch (error) { /* 刷新失败就继续轮询 */ }
        }
        for (var attempt = 0; attempt < 8; attempt += 1) {
          await sleep(200);
          var after = tablesOf(api, template);
          if (probeRowIndex(after, stamp) < 0) {
            return { ok: true, rows: after[PROBE_TABLE] ? after[PROBE_TABLE].rows : 0, via: names[n] + '#' + positions[p], attempts: attempt + 1 };
          }
        }
      }
    }
    return { ok: false, reason: '删除后仍然读得到探针行（键/名 × 行号 index、index+1 都试过）' };
  }

  async function run(scope, template, options) {
    var opts = options || {};
    var stamp = opts.stamp || String(Date.now());
    var steps = [];
    var push = function (id, ok, detail) { steps.push({ id: id, ok: !!ok, detail: detail === undefined ? '' : detail }); return ok; };

    var found = detect(scope);
    push('capability', found.available, found.available ? (found.depth ? '向上第 ' + found.depth + ' 层窗口找到数据库接口' : '本页就有数据库接口') : '没有找到 AutoCardUpdaterAPI（插件未装或不可达）');
    if (!found.available) return { stamp: stamp, steps: steps, pass: false, fingerprint: '' };

    var api = hostOf(scope).api;
    var before = tablesOf(api, template);
    var fingerprintBefore = fingerprint(before);
    push('read-first', true, Object.keys(before).length + ' 张表');

    var ensured = await ensure(api, template);
    push('ensure', ensured.ok, ensured.ok ? '8 张表就位（第 ' + ensured.attempts + ' 次读到）' : JSON.stringify(ensured));

    var tables = tablesOf(api, template);
    var wrote = await writeProbe(api, template, tables, stamp);
    push('write', wrote.ok, wrote.ok ? '写入 1 行' : JSON.stringify(wrote));

    var afterWrite = tablesOf(api, template);
    push('read-back', afterWrite[PROBE_TABLE] && afterWrite[PROBE_TABLE].rows >= 1, 'fact 行数 ' + (afterWrite[PROBE_TABLE] || {}).rows);

    var cleared = await clearProbe(api, template, tables, stamp);
    push('cleanup', cleared.ok, cleared.ok ? '探针行已删除' : JSON.stringify(cleared));

    var afterAll = fingerprint(tablesOf(api, template));
    push('fingerprint', true, afterAll);
    return {
      stamp: stamp,
      steps: steps,
      pass: steps.every(function (step) { return step.ok; }),
      fingerprint: afterAll
    };
  }

  return { TABLES: TABLES, PROBE_TABLE: PROBE_TABLE, chainOf: chainOf, hostOf: hostOf, detect: detect, tablesOf: tablesOf, fingerprint: fingerprint, ensure: ensure, writeProbe: writeProbe, clearProbe: clearProbe, rowFor: rowFor, ddlNames: ddlNames, run: run };
});
