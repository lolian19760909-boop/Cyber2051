/**
 * 三模式端口合同（蓝图 §4.2 / §5 / §6 / §4.3）。
 *
 * 四种端口必须有且只有一个实现者：
 * - state：持久化权威（独立模式 IndexedDB / 酒馆模式宿主）
 * - model：模型请求（公网 relay / 本地受限适配器 / 宿主连接 / 本机内网直连）
 * - asset：资源加载
 * - host ：宿主能力（无宿主时为 noop 实现，不得伪造 ST API）
 *
 * 本文件只定义形状并做可执行校验，不实现任何后端。
 */

export const STATE_PORT_METHODS = Object.freeze([
  'readHead',
  'readState',
  'readNode',
  'commit',
  'readReceipt',
]);

export const MODEL_PORT_METHODS = Object.freeze(['models', 'chat', 'embeddings', 'rerank']);

export const ASSET_PORT_METHODS = Object.freeze(['resolve', 'load']);

export const HOST_PORT_METHODS = Object.freeze(['describe', 'readChat', 'saveTurn', 'capabilities']);

export class PortContractError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'PortContractError';
    this.code = code;
  }
}

function assertMethods(port, name, methods) {
  if (!port || typeof port !== 'object') {
    throw new PortContractError(`${name}_port_missing`, `缺少 ${name} 端口实现`);
  }
  const missing = methods.filter((m) => typeof port[m] !== 'function');
  if (missing.length) {
    throw new PortContractError(`${name}_port_incomplete`, `${name} 端口缺少方法：${missing.join(', ')}`);
  }
  return true;
}

/**
 * 端口集合必须是"三模式之一 + 四端口齐全"。
 * mode 决定身份来源与提交所有者，不允许同一端口集合声明两种模式。
 */
export function assertPorts(ports, expectedMode) {
  if (!ports || typeof ports !== 'object') throw new PortContractError('ports_missing', '缺少端口集合');
  if (!expectedMode) throw new PortContractError('mode_missing', '必须声明运行模式');
  if (ports.mode !== expectedMode) {
    throw new PortContractError('mode_mismatch', `端口集合模式 ${ports.mode} 与期望 ${expectedMode} 不一致`);
  }
  assertMethods(ports.state, 'state', STATE_PORT_METHODS);
  assertMethods(ports.model, 'model', MODEL_PORT_METHODS);
  assertMethods(ports.asset, 'asset', ASSET_PORT_METHODS);
  assertMethods(ports.host, 'host', HOST_PORT_METHODS);
  return true;
}

/** 独立模式不得装配读取酒馆目录的宿主能力（蓝图 §0.2）。 */
export function assertNoHostLeak(ports) {
  if (ports.mode === 'tavern') return true;
  const caps = ports.host.capabilities();
  if (!caps || caps.mode !== 'none') {
    throw new PortContractError('host_leak', '独立模式装载了非空宿主能力');
  }
  return true;
}

/** 提交结果形状；状态机与 UI 只认这一种结果对象。 */
export function normaliseCommitResult(result) {
  if (!result || typeof result !== 'object') throw new PortContractError('commit_result_missing');
  const status = result.status;
  if (!['committed', 'replayed', 'conflict'].includes(status)) {
    throw new PortContractError('commit_result_bad_status', `未知提交状态：${status}`);
  }
  if (status !== 'conflict' && (!Number.isInteger(result.revision) || !result.nodeId)) {
    throw new PortContractError('commit_result_incomplete', '成功提交缺少 revision 或 nodeId');
  }
  return result;
}
