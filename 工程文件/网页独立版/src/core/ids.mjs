/**
 * 身份与操作标识。三模式共用形状，命名空间不同，
 * 模式切换不得沿用其他模式的提交凭据（蓝图 §5.1 / §4.3）。
 */

let counter = 0;

/** 随机 id：用于 node / run / branch / checkpoint 等持久标识。 */
export function newId(prefix) {
  const rand = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 20)
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}

/** 单进程内单调递增的操作序号：只用于调试与排序，不承担唯一性。 */
export function nextSeq() {
  counter += 1;
  return counter;
}

export const MODES = Object.freeze(['public', 'local', 'tavern']);

/**
 * 身份命名空间。accountId 由模式决定来源：
 * - public：本站会话校验出的 publisherId
 * - local ：本机生成并持久化的本机身份
 * - tavern：宿主用户 / 角色 / 聊天
 * 不允许未知模式，也不允许空 accountId。
 */
export function createIdentity({ mode, accountId, runId, branchId }) {
  if (!MODES.includes(mode)) throw new Error(`未知运行模式：${mode}`);
  if (!accountId || typeof accountId !== 'string') throw new Error('accountId 必填');
  return Object.freeze({
    mode,
    accountId,
    runId: runId || newId('run'),
    branchId: branchId || newId('branch'),
  });
}

/** 每次会改变状态的操作必须带齐的字段；缺一即拒绝。 */
export function assertOperation(op) {
  const required = ['accountId', 'runId', 'branchId', 'operationId', 'expectedRevision'];
  const missing = required.filter((k) => op == null || op[k] === undefined || op[k] === '');
  if (missing.length) throw new Error(`操作缺少字段：${missing.join(', ')}`);
  if (!Number.isInteger(op.expectedRevision) || op.expectedRevision < 0) {
    throw new Error('expectedRevision 必须是 >=0 的整数');
  }
  return true;
}

/** 页面上下文代号：账号、周目、分支或模式变化都会使旧异步结果失效。 */
export function createEpoch() {
  let value = newId('epoch');
  return {
    get current() {
      return value;
    },
    rotate() {
      value = newId('epoch');
      return value;
    },
    matches(candidate) {
      return candidate === value;
    },
  };
}
