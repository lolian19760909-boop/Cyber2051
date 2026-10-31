/**
 * 领域规则端口：卡内真实规则链的网页适配层（蓝图 §5.2）。
 *
 * 复用 `数据/validator.js`（zod-lite）、`MVU/schema.js`（字段策略与 prepare）、
 * `数据/applier.js`（补丁执行与自检），**不重写规则**。
 * 替换的只有宿主侧写入层：原来是数据库插件 / 变量 API，现在是注入的 write 端口。
 *
 * 该模块不信任模型输出：任何补丁都必须先过 schema.prepare，再 applyOps，再自检。
 *
 * 装载边界：本文件**不 import 任何 Node 内置模块**，所以浏览器与 Node 都能用。
 * 规则链由调用方注入（`chain`）：
 *  - Node：`cardRuleChain()`（`src/reuse/card.mjs`，经 require 加载 UMD）；
 *  - 浏览器：`src/reuse/browser-chain.mjs`（按依赖顺序插入 script，读全局 UMD 对象）。
 * 这两条装载路径给的是同一份卡内源码，规则语义因此一致。
 */

export class RuleRejected extends Error {
  constructor(reason, detail) {
    super(reason);
    this.name = 'RuleRejected';
    this.code = 'rule_rejected';
    this.detail = detail || null;
  }
}

const REQUIRED_CHAIN = [
  ['z', 'validator.js 导出的 z'],
  ['schema', 'MVU/schema.js 模块'],
  ['applier', '数据/applier.js 模块'],
];

/**
 * @param {{
 *   chain: {z: object, schema: {build: Function}, applier: {create: Function, applyOps: Function, emptyRoot: Function, VERSION: string}},
 *   writeLayer?: {apply: Function, state: Function},
 *   policy?: object,
 * }} options
 */
export function createRulesEngine(options = {}) {
  const chain = options.chain;
  if (!chain || typeof chain !== 'object') {
    throw new TypeError('createRulesEngine 需要注入卡内规则链（chain: {z, schema, applier}）');
  }
  for (const [key, label] of REQUIRED_CHAIN) {
    if (!chain[key] || typeof chain[key] !== 'object') {
      throw new TypeError(`规则链缺少 ${label}（chain.${key}）`);
    }
  }
  const { z, schema: schemaModule, applier } = chain;
  if (typeof schemaModule.build !== 'function') throw new TypeError('规则链的 schema.build 不可用');
  if (typeof applier.create !== 'function' || typeof applier.applyOps !== 'function') {
    throw new TypeError('规则链的 applier.applyOps / applier.create 不可用');
  }

  const built = schemaModule.build(z, {});
  const policyOf = context => {
    const base=typeof chain.policy==='function'?chain.policy(context):chain.policy||{},extra=typeof options.policy==='function'?options.policy(context):options.policy||{};
    return {...base,...extra,...(base.numericOptions||extra.numericOptions?{numericOptions:{...base.numericOptions,...extra.numericOptions}}:{})};
  };

  const service = applier.create({
    schema: () => built,
    write: options.writeLayer || undefined,
    policy: {},
    report() {},
    notify() {},
  });

  return {
    version: applier.VERSION,
    emptyRoot() {
      const root=applier.emptyRoot();
      // The applier's transport skeleton is not an initialized actor registry.
      // This only constructs a new root; existing saves never pass through it.
      delete root.terminal.ensemble;
      return chain.actors ? chain.actors.initialize(root,{profiles:[]}) : root;
    },

    /**
     * 校验并执行一批补丁；失败抛 RuleRejected，不返回半成品状态。
     * @returns {{state: object, patches: object[], ignored: object[]}}
     */
    settle(context) {
      const {before,patches}=context,policy=policyOf(context);
      if (!before || typeof before !== 'object') throw new RuleRejected('缺少已提交的父状态');
      if (!Array.isArray(patches) || patches.length === 0&&!policy.plot&&!policy.numericOptions?.battleRound&&!policy.numericOptions?.tacticalBase) {
        return { state: before, patches: [], ignored: [] };
      }
      let transaction;
      try {
        transaction = built.prepare(patches, before, policy);
      } catch (error) {
        throw new RuleRejected(error.message || '补丁未通过字段校验', { stage: 'prepare' });
      }
      const executed = applier.applyOps(before, transaction.patches);
      if (!executed.ok) throw new RuleRejected(executed.reason || '补丁执行失败', { stage: 'applyOps' });
      try {
        built.check(transaction, before, executed.root);
      } catch (error) {
        throw new RuleRejected(error.message || '结算自检未通过', { stage: 'check' });
      }
      return { state: executed.root, patches: transaction.patches, ignored: transaction.ignored || [] };
    },

    /**
     * 走 applier 的完整入口：抽块 → 校验 → 执行 → 自检 → 落库（写入层由调用方注入）。
     * 用于需要收据去重与持久化语义的正式回合提交。
     */
    async settleWithReceipt({ text, patches, before, receipt }) {
      const result = await service.apply(
        { ...(text === undefined ? {} : { text }), ...(patches ? { patches } : {}) },
        { before, receipt, policy:policyOf({before,text,patches,receipt}) },
      );
      return result;
    },
  };
}
