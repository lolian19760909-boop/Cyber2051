/* Derived from 卡片源码/数据/applier.js; source SHA256 0b4280be109605c1a82f1ab184d8923db233d65101cb9e34c7e355301b112045. Rebuild with tools/p3a-adapt-views.mjs. */
/*! 东京都2051 · 变量程序应用器（Cxx236Applier / CxxProgramApplier）
 *  作用：取代远端 MVU 的「解析 → 执行 → 落库」三段。卡内自己从正文抽出 <UpdateVariable> 的 JSONPatch，
 *        交给本地校验层（MVU/schema.js + zod-lite）出事务，再按 JSONPointer 写进状态树，最后经
 *        CxxDataWrite / CxxDataSync 落数据库表。执行器归我们，MVU 不再参与。
 *  边界：
 *   - 模型文本只接受 add / replace（与 Gal/parser.js 的 readUpdate 口径一致）；remove / test 只供程序内部
 *     的撤销、回滚与自检使用，绝不放给正文。
 *   - 校验失败、路径未知、类型不符、钱包不守恒都返回可读原因，不抛到界面；只有依赖装错（schema 缺失）才算未就绪。
 *   - 同页幂等沿 apply 票据账本，持久去重沿 CxxDataWrite 的实际票据；
 *     已有票据但状态表同步未完时，web 调用以完整父状态补完 Sync，不重复业务结算。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root, true);
  else root.Cxx236Applier = factory(root, false);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, local) {
  'use strict';

  const VERSION = 'applier/1';
  const cloneOf = value => (local ? require('../共享/data-clone.js') : root.CxxDataClone).clone(value);
  const schemaOf = () => (local ? require('../MVU/schema.js') : root.Cxx236Schema);
  const parserOf = () => (local ? require('../Gal/parser.js') : root.CxxGalParser);
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const own = (value, key) => isObject(value) && Object.hasOwn(value, key);
  const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const EDIT_OPS = ['add', 'replace', 'remove'];
  const engineOnly = new Set(['test', 'move', 'copy']);

  /** 空状态骨架：没有终端时给界面一个能读的形状，而不是 undefined。 */
  function emptyRoot() {
    return {
      terminal: {
        wallet: { yen: 0, earned: 0, spent: 0 },
        quests: {},
        ensemble: { control: { actorId: 'player' }, actors: {} },
        gameplay: { location: { mapId: '', placeId: '' } },
      },
    };
  }

  /** JSON Pointer 分段：优先用 schema.js 的 pathOf，保证与校验层口径完全一致。 */
  function segments(path) {
    const S = schemaOf();
    if (S && typeof S.pathOf === 'function') return S.pathOf(path);
    if (typeof path !== 'string' || !path.startsWith('/') || path === '/' || /~(?![01])/u.test(path)) throw Error('变量路径格式不正确。');
    const parts = path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (parts.some(part => !part || ['__proto__', 'constructor', 'prototype', '$meta', '$internal'].includes(part))) throw Error('该路径不是可更新的状态。');
    return parts;
  }

  function shapeOp(op) {
    if (!isObject(op)) throw Error('变量更新每一项都必须是对象。');
    if (!EDIT_OPS.includes(op.op) && !engineOnly.has(op.op)) throw Error('未知的变量操作：' + String(op.op));
    if (typeof op.path !== 'string' || !op.path) throw Error('变量更新缺少 path。');
    const extra = Object.keys(op).filter(key => !['op', 'path', 'value', 'from'].includes(key));
    if (extra.length) throw Error('变量更新出现多余字段：' + extra.join('、'));
    if (op.op !== 'remove' && !Object.hasOwn(op, 'value')) throw Error('变量更新缺少 value：' + op.path);
  }

  /** 纯 JSONPatch 执行：改的是副本，返回新树，不碰入参。程序内部用它做回滚与自检。 */
  function applyOps(source, ops) {
    let tree;
    try {
      if (!Array.isArray(ops)) throw Error('变量更新必须是数组。');
      tree = cloneOf(source === undefined ? emptyRoot() : source);
      ops.forEach(shapeOp);
      const done = [];
      for (const op of ops) {
        const parts = segments(op.path);
        let parent = tree;
        for (const key of parts.slice(0, -1)) {
          if (!own(parent, key) || !isObject(parent[key])) {
            if (!own(parent, key) && op.op === 'add') throw Error('上级路径不存在：' + op.path);
            if (!own(parent, key)) throw Error('上级路径不存在：' + op.path);
            if (!isObject(parent[key])) throw Error('上级路径不是对象：' + op.path);
          }
          parent = parent[key];
        }
        const key = parts[parts.length - 1];
        const exists = own(parent, key);

        if (op.op === 'test') {
          if (!exists || !sameValue(parent[key], op.value)) throw Error('自检不通过：' + op.path);
        } else if (op.op === 'replace') {
          if (!exists) throw Error('replace 路径不存在：' + op.path);
          parent[key] = cloneOf(op.value);
        } else if (op.op === 'add') {
          parent[key] = cloneOf(op.value);
        } else if (op.op === 'remove') {
          if (!exists) throw Error('remove 路径不存在：' + op.path);
          delete parent[key];
        } else {
          throw Error('本卡不执行该变量操作：' + op.op);
        }
        done.push(op.op + ' ' + op.path);
      }
      return { ok: true, root: tree, reason: '', done };
    } catch (error) {
      return { ok: false, root: source, reason: error && error.message ? error.message : String(error), done: [] };
    }
  }

  /** 正文抽取：优先用 Gal/parser.js 的块解析器（能报标签边界问题），否则退化为最小正则。 */
  function extract(text, parser) {
    const source = String(text === undefined || text === null ? '' : text);
    const P = parser || parserOf();
    if (P && typeof P.variableUpdates === 'function') {
      const decoded = P.variableUpdates(source);
      return { found: !!decoded.found, patches: Array.isArray(decoded.patches) ? decoded.patches : [], issues: Array.isArray(decoded.issues) ? decoded.issues : [] };
    }
    const patches = [];
    const issues = [];
    const blocks = [...source.matchAll(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/gi)];
    if (!blocks.length) return { found: false, patches, issues: ['本轮没有找到 <UpdateVariable> 变量块。'] };
    for (const block of blocks) {
      const body = block[1].replace(/^\s*<(json_?patch)>\s*/i, '').replace(/\s*<\/\1>\s*$/i, '').trim();
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (error) {
        issues.push('变量更新需要完整的 JSON 数组：' + (error && error.message ? error.message : '解析失败'));
        continue;
      }
      if (!Array.isArray(parsed)) {
        issues.push('变量更新必须是 JSON 数组。');
        continue;
      }
      patches.push(...parsed);
    }
    return { found: blocks.length > 0, patches, issues };
  }

  /** 把叙事正文从文本里摘掉，用于事实流水的摘要。 */
  function storyOf(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, '')
      .trim()
      .slice(0, 400);
  }

  function create(deps) {
    const options = deps || {};
    let ended = false;
    const ledger = new Map();
    const notices = new Set();
    let sequence = 0;

    const schema = () => options.schema || null;
    const now = () => (typeof options.now === 'function' ? options.now() : new Date().toISOString());

    function report(message, level) {
      if (typeof options.report === 'function') {
        try {
          options.report({ module: '变量应用', stage: '程序结算', level: level || 'warning', message });
        } catch (_) {
          /* 诊断服务坏掉不能反过来弄坏结算 */
        }
      }
    }

    function notify(message) {
      if (notices.has(message)) return;
      notices.add(message);
      if (options.notify) {
        try {
          options.notify(message);
        } catch (_) {
          /* ignore */
        }
      }
    }

    function stateOf(receipt) {
      if (!receipt) return null;
      const key = String(receipt);
      const mine = ledger.get(key);
      if (mine) return { status: mine.status, at: mine.at, patches: mine.patches, source: 'ledger' };
      const write = options.write;
      if (write && typeof write.state === 'function') {
        try {
          const seen = write.state(key);
          if (seen) return { status: seen.state || '', at: seen.at || '', patches: [], source: 'write' };
        } catch (_) {
          /* 写侧查不到不算失败 */
        }
      }
      return null;
    }

    function remember(receipt, record) {
      if (!receipt) return;
      ledger.set(String(receipt), record);
      while (ledger.size > 32) ledger.delete(ledger.keys().next().value);
    }

    async function persist(plan) {
      const write = options.write;
      const sync = options.sync;
      let persisted = false, duplicate = false;
      // 状态权威在数据库表：写入层缺失时不能假装成功，否则界面在位、数据已丢。
      if (!(write && typeof write.apply === 'function') && !(sync && typeof sync.push === 'function')) {
        return { ok: false, reason: '数据库写入层尚未就绪，本轮变量没有保存。' };
      }
      if (write && typeof write.apply === 'function') {
        let outcome;
        try {
          outcome = await write.apply({
            receipt: plan.receipt,
            kind: plan.kind,
            turn: plan.turn,
            payload: JSON.stringify(plan.patches).slice(0, 2000),
            fact: typeof options.factFor === 'function' ? options.factFor(plan.patches, plan.turn) : undefined,
          });
        } catch (error) {
          return { ok: false, reason: '票据写入失败：' + (error && error.message ? error.message : String(error)) };
        }
        if (outcome && outcome.ok === false) return { ok: false, reason: outcome.reason || '票据写入失败。' };
        if (outcome && outcome.state === 'duplicate') duplicate = true;
        else persisted = true;
      }
      if (sync && typeof sync.push === 'function') {
        let outcome;
        try {
          outcome = await sync.push(plan.root, plan.turn);
        } catch (error) {
          return { ok: false, reason: '表写入失败：' + (error && error.message ? error.message : String(error)) };
        }
        if (outcome && outcome.ok === false) return { ok: false, reason: outcome.reason || '表写入失败。' };
        persisted = true;
      }
      return { ok: true, duplicate, persisted };
    }

    /** 一次完整结算：抽块 → 校验出事务 → 执行 → 自检 → 落库。任何一步失败都只返回原因。 */
    async function apply(input, settings) {
      const plan = settings || {};
      const base = { ok: false, status: '', reason: '', patches: [], transaction: null, root: null, terminal: null, receipt: plan.receipt || null, persisted: false, at: now(), revision: ++sequence };
      if (ended) return Object.assign(base, { status: 'ended', reason: '变量服务已停止。' });

      const key = plan.receipt ? String(plan.receipt) : '';
      const seen = stateOf(key);
      // The fact receipt can precede the state-table sync. Web continuation supplies a verified full
      // parent and can repair that sync; old callers retain their existing write-receipt behavior.
      if (seen && (seen.status === 'applied' || seen.status === 'duplicate') && (seen.source === 'ledger' || !plan.recoverSync)) {
        return Object.assign(base, { ok: true, status: 'duplicate', reason: '', root: seen.root || null, terminal: seen.root ? seen.root.terminal : null, persisted: false });
      }

      const supplied = plan.before !== undefined ? plan.before : plan.state;
      const initialized = supplied !== undefined && supplied !== null && isObject(supplied) && isObject(supplied.terminal);
      const before = initialized ? supplied : emptyRoot();
      const root = cloneOf(before);

      let text = typeof input === 'string' ? input : input && typeof input.text === 'string' ? input.text : '';
      const given = input && Array.isArray(input.patches) ? input.patches : null;
      let patches = given ? given.slice() : [];
      if (!given) {
        const decoded = extract(text, options.parser);
        if (decoded.issues.length) {
          const reason = decoded.issues.slice(0, 3).join('；');
          report(reason);
          notify(reason);
          return Object.assign(base, { status: 'rejected', reason, root, terminal: root.terminal, initialized });
        }
        if (!decoded.found || !decoded.patches.length) {
          return Object.assign(base, { status: 'skipped', reason: '本轮未提供可执行的变量更新。', root, terminal: root.terminal, initialized });
        }
        patches = decoded.patches;
      }
      if (!patches.length) return Object.assign(base, { status: 'skipped', reason: '本轮未提供可执行的变量更新。', root, terminal: root.terminal, initialized });

      if (!initialized) {
        const reason = '状态尚未初始化：当前没有终端数据，已给出空终端，等开局确认后再结算。';
        report(reason);
        return Object.assign(base, { status: 'uninitialized', reason, patches, root, terminal: root.terminal, initialized: false });
      }

      const S = schema();
      if (!S || typeof S.prepare !== 'function') {
        const reason = '变量校验库尚未就绪，本轮变量未应用。';
        report(reason);
        return Object.assign(base, { status: 'failed', reason, patches, root, terminal: root.terminal, initialized });
      }

      let transaction;
      try {
        transaction = S.prepare(patches, root, Object.assign({}, options.policy, plan.policy));
      } catch (error) {
        const reason = error && error.message ? error.message : String(error);
        report(reason);
        notify(reason);
        remember(key, { status: 'rejected', at: base.at, reason, patches });
        return Object.assign(base, { status: 'rejected', reason, patches, root, terminal: root.terminal, initialized });
      }

      const executed = applyOps(root, transaction.patches);
      if (!executed.ok) {
        report(executed.reason);
        notify(executed.reason);
        return Object.assign(base, { status: 'rejected', reason: executed.reason, patches: transaction.patches, transaction, root, terminal: root.terminal, initialized });
      }

      try {
        S.check(transaction, root, executed.root);
      } catch (error) {
        const reason = error && error.message ? error.message : String(error);
        report(reason);
        notify(reason);
        return Object.assign(base, { status: 'rejected', reason, patches: transaction.patches, transaction, root, terminal: root.terminal, initialized });
      }

      const turn = Number.isFinite(plan.turn) ? plan.turn : 0;
      const written = await persist({ receipt: key, kind: plan.kind || 'variable', turn, payload: patches, patches: transaction.patches, root: executed.root });
      const next = Object.assign(base, {
        status: !written.ok ? 'failed' : written.duplicate ? 'duplicate' : 'applied',
        reason: written.ok ? '' : written.reason,
        ok: !!written.ok,
        patches: transaction.patches,
        transaction,
        root: executed.root,
        terminal: executed.root.terminal,
        persisted: !!written.persisted,
        initialized,
        turn,
        story: plan.story !== undefined ? plan.story : storyOf(text),
      });
      remember(key, { status: next.status, at: next.at, reason: next.reason, patches: next.patches, root: executed.root, persisted: next.persisted });
      return next;
    }

    /** 程序内部改写（界面、撤销、回滚）：一次事务 + 一次自检，不抽正文。 */
    function commit(ops, settings) {
      const plan = settings || {};
      const supplied = plan.before !== undefined ? plan.before : plan.state;
      const before = supplied && isObject(supplied) && isObject(supplied.terminal) ? supplied : emptyRoot();
      const executed = applyOps(before, ops);
      if (!executed.ok) return { ok: false, status: 'rejected', reason: executed.reason, root: before };
      const S = schema();
      if (S && typeof S.program === 'function' && plan.before !== undefined) {
        try {
          executed.root = S.program(before, executed.root, Object.assign({}, options.policy, plan.policy));
        } catch (error) {
          return { ok: false, status: 'rejected', reason: error && error.message ? error.message : String(error), root: before };
        }
      }
      return { ok: true, status: 'applied', reason: '', root: executed.root, terminal: executed.root.terminal, patches: ops };
    }

    return {
      ready: () => !ended && !!schema(),
      parse: text => extract(text, options.parser),
      apply,
      commit,
      ops: (source, list) => applyOps(source, list),
      empty: emptyRoot,
      state: stateOf,
      receipts: () => [...ledger.keys()],
      destroy() {
        ended = true;
        ledger.clear();
        notices.clear();
      },
    };
  }

  return { create, applyOps, extract, emptyRoot, segments, VERSION, OPS: EDIT_OPS.slice() };
});
