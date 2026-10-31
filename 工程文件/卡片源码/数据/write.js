/*! 东京都2051 · 数据库写侧（CxxDataWrite）
 *  作用：把一次状态变更做成「票据 → 落表 → 标记 applied」的幂等写入。宿主 API 没有跨表事务，
 *        所以重复投递同一张票据只会被处理一次（按 receipt 去重），失败留 pending 供下次重放。
 *  顺序与真机结论一致：先写数据表，再写票据状态，最后 refreshDataAndWorldbook()。
 *
 *  幂等判据（重要）：宿主不一定给 updateRow，所以「已生效」不靠改票据行来证明 ——
 *  证据是 cxx_fact 里那张带同一 receipt 的事实行。有事实行 = applied，没有但有票据行 = pending。
 *  这样即使 updateCell 不可用，重放同一张票据也不会重复落账。
 *
 *  票据状态列名：模板里这一列叫 status（cxx_pending_tx DDL 是 row_id/tx_key/status/events/…），
 *  而代码语义一直叫 state。不改模板列名，写时 state 与 status 两个键都写、读时两个都认，
 *  避免「按 state 写、按 status 读」造成的假幂等（读不到就当成没写过，于是重复记账）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CxxDataWrite = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TX = 'cxx_pending_tx';
  const FACT = 'cxx_fact';

  function fail(reason) {
    return { ok: false, reason: reason };
  }

  function text(value, fallback) {
    return value === undefined || value === null || value === '' ? fallback : String(value);
  }

  function create(options) {
    const opts = options || {};
    const store = opts.store;
    const now = typeof opts.now === 'function' ? opts.now : function () { return Date.now(); };
    // store.create() 的写接口是 insert(logical, values)；测试里的假仓库是 insert([[key,null]],[[row]])。
    const singleShape = !!(store && (Array.isArray(store.tables) || typeof store.tables === 'function'));
    const statusOf = value => ({ '待处理': 'pending', '已应用': 'applied', '失败': 'failed' })[value] || value;

    function ready() {
      return !!(store && typeof store.insert === 'function' && typeof store.read === 'function');
    }

    function insertRow(table, values) {
      if (singleShape) return store.insert(table, values);
      return store.insert([[table, null]], [[values]]);
    }

    function readRows(table) {
      if (typeof store.readAll === 'function') return store.readAll([[table, null]])?.tables?.[table] || [];
      const read = singleShape ? store.read(table) : store.read([[table, null]]);
      if (!read || read.ok === false) return [];
      const direct = read.rows && read.rows[table];
      if (Array.isArray(direct)) return direct;
      const rows = read.rows;
      if (rows && Array.isArray(rows)) return rows;
      return [];
    }

    function existing(receipt) {
      let hit = null;
      for (const row of readRows(TX)) {
        if (text(row && row.tx_key, '') === receipt) hit = row;
      }
      return hit;
    }

    function appliedFact(receipt) {
      for (const row of readRows(FACT)) {
        if (text(row && row.receipt, '') === receipt) return row;
      }
      return null;
    }

    /** 票据状态查询：pending / applied / null。 */
    function state(receipt) {
      if (!ready()) return fail('缺少数据仓库 CxxDataStore');
      const fact = appliedFact(receipt);
      if (fact) return { ok: true, state: 'applied', row: fact };
      const row = existing(receipt);
      if (!row) return { ok: true, state: null };
      return { ok: true, state: statusOf(text(row.state, text(row.status, 'pending'))), row: row };
    }

    async function markPending(receipt, kind, payload, turn) {
      const status = singleShape ? '待处理' : 'pending';
      const inserted = await insertRow(TX, {
        row_id: 0,
        tx_key: receipt,
        status: status,
        state: status,
        kind: text(kind, 'other'),
        turn_no: Number(turn) || 0,
        payload: String(payload === undefined ? '' : payload).slice(0, 400),
        events: String(payload === undefined ? '' : payload).slice(0, 400),
        updated_turn: Number(turn) || 0,
      });
      return !!(inserted && inserted.ok !== false);
    }

    async function markApplied(receipt, turn, rowIndex) {
      if (singleShape && typeof store.updateRow === 'function') return (await store.updateRow(TX, rowIndex, { status: '已应用' }))?.ok === true;
      if (typeof store.updateCell !== 'function' || rowIndex === undefined || rowIndex === null) return false;
      try {
        if (singleShape) {
          await store.updateCell(TX, rowIndex, 'state', 'applied');
          await store.updateCell(TX, rowIndex, 'status', 'applied');
        } else {
          await store.updateCell([[TX, null]], rowIndex, 'state', 'applied');
          await store.updateCell([[TX, null]], rowIndex, 'status', 'applied');
        }
        return true;
      } catch (error) {
        return false;
      }
    }

    /**
     * 一次写入。
     * req: { receipt, kind:'fact'|'other', turn, payload,
     *        fact:{fact_key,kind,payload,receipt},
     *        rows:[{ table, values }]   ← 可选：同一次票据里要落的其它表行（钱包/委托/效果…） }
     * 返回 { ok, state:'applied'|'pending'|'duplicate', reason?, rows? }
     */
    async function apply(request) {
      const req = request || {};
      const receipt = text(req.receipt, '');
      if (!receipt) return fail('缺少票据 receipt');
      if (!ready()) return fail('缺少数据仓库 CxxDataStore');
      if (typeof store.ensureSchema === 'function') { const ensured = await store.ensureSchema(); if (!ensured?.ok) return { ok: false, state: 'pending', reason: ensured?.reason || '建表尚未确认' }; }
      if (appliedFact(receipt)) return { ok: true, state: 'duplicate' };
      const known = existing(receipt);
      if (known && statusOf(text(known.state, text(known.status, ''))) === 'applied') return { ok: true, state: 'duplicate' };
      if (!known && !await markPending(receipt, req.kind, req.payload, req.turn)) return { ok: false, state: 'pending', reason: '写入失败，票据没能落库' };

      const extra = Array.isArray(req.rows) ? req.rows : [];
      for (const entry of extra) {
        const table = text(entry && entry.table, '');
        if (!table || !entry.values) continue;
        const inserted = await insertRow(table, entry.values);
        if (!inserted || inserted.ok === false) return { ok: false, state: 'pending', reason: '写入失败，票据保留待重放' };
      }

      let wrote = true;
      if (req.fact) {
        const fact = req.fact;
        const inserted = await insertRow(FACT, {
          row_id: 0,
          fact_key: text(fact.fact_key, receipt),
          turn_no: Number(req.turn) || 0,
          kind: text(fact.kind, '其他'),
          payload: String(fact.payload === undefined ? '' : fact.payload).slice(0, 400),
          receipt: receipt,
        });
        wrote = !!(inserted && inserted.ok !== false);
      }
      if (!wrote) return { ok: false, state: 'pending', reason: '写入失败，票据保留待重放' };
      const fresh = existing(receipt);
      if (!await markApplied(receipt, req.turn, fresh ? fresh.row_id : undefined)) return { ok: false, state: 'pending', reason: '票据状态更新尚未确认' };
      if (typeof store.refresh === 'function') { const refreshed = await store.refresh(); if (refreshed?.ok === false) return { ok: false, state: 'pending', reason: refreshed.reason || '刷新尚未确认' }; }
      return { ok: true, state: 'applied', at: now(), rows: extra.length };
    }

    /** 单独落一行（无票据要求，给回合摘要这类可以重复写的小表用）。 */
    async function writeRow(table, values) {
      if (!ready()) return fail('缺少数据仓库 CxxDataStore');
      const name = text(table, '');
      if (!name) return fail('缺少表名');
      if (typeof store.ensureSchema === 'function') { const ensured = await store.ensureSchema(); if (!ensured?.ok) return { ok: false, reason: ensured?.reason || '建表尚未确认' }; }
      const inserted = await insertRow(name, values || {});
      if (!inserted || inserted.ok === false) return { ok: false, reason: (inserted && inserted.reason) || '写行失败' };
      if (typeof store.refresh === 'function') { const refreshed = await store.refresh(); if (refreshed?.ok === false) return { ok: false, reason: refreshed.reason || '刷新尚未确认' }; }
      return { ok: true, at: now() };
    }

    return { apply, state, ready, writeRow, TX, FACT };
  }

  return { create };
});
