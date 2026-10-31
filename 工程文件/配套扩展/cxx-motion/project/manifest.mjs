const identifier = /^[a-z0-9][a-z0-9._-]*$/i;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function resourcePath(path) {
  if (typeof path !== 'string' || !path || /[\\:%?#\x00-\x1f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`资源路径无效：${String(path)}`);
  }
  return path;
}

export function validateManifest(source) {
  if (!object(source) || source.format !== 'tavern-visual-project' || source.schema !== 1) throw new Error('需要 tavern-visual-project 第1版项目清单。');
  for (const key of ['id', 'version']) if (typeof source[key] !== 'string' || !identifier.test(source[key])) throw new Error(`项目${key}无效。`);
  if (typeof source.title !== 'string' || !source.title.trim()) throw new Error('项目缺少名称。');
  if (!object(source.engine) || typeof source.engine.id !== 'string' || typeof source.engine.version !== 'string' || !identifier.test(source.engine.id) || !identifier.test(source.engine.version)) throw new Error('项目必须指定播放器及其确切版本。');
  if (!object(source.scene) || !Array.isArray(source.resources) || !source.resources.length) throw new Error('项目缺少场景或资源清单。');
  const paths = new Set();
  for (const resource of source.resources) {
    if (!object(resource)) throw new Error('资源记录无效。');
    resourcePath(resource.path);
    if (paths.has(resource.path)) throw new Error(`重复资源：${resource.path}`);
    paths.add(resource.path);
    if (!Number.isSafeInteger(resource.bytes) || resource.bytes < 0 || !/^[a-f0-9]{64}$/.test(resource.sha256)) throw new Error(`资源大小或指纹无效：${resource.path}`);
    if (typeof resource.type !== 'string' || !/^[\w.+-]+\/[\w.+-]+$/.test(resource.type)) throw new Error(`资源类型无效：${resource.path}`);
  }
  if (source.inputs !== undefined && !Array.isArray(source.inputs)) throw new Error('输入绑定必须是数组。');
  const inputs = new Set();
  for (const input of source.inputs ?? []) {
    if (!object(input) || typeof input.id !== 'string' || !identifier.test(input.id) || inputs.has(input.id) || !['number', 'boolean', 'string', 'color', 'trigger'].includes(input.type)) throw new Error('输入绑定编号或类型无效。');
    inputs.add(input.id);
  }
  if (source.events !== undefined && (!Array.isArray(source.events) || source.events.some(name => typeof name !== 'string' || !name) || new Set(source.events).size !== source.events.length)) throw new Error('事件名称必须是不重复的字符串。');
  return structuredClone(source);
}

export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');

export async function prepareProject(source, files, { signal } = {}) {
  const manifest = validateManifest(source);
  const blobs = new Map();
  for (const resource of manifest.resources) {
    signal?.throwIfAborted();
    const file = files.get(resource.path);
    if (!(file instanceof Blob) || file.size !== resource.bytes) throw new Error(`缺少资源或大小不符：${resource.path}`);
    if (await digest(await file.arrayBuffer()) !== resource.sha256) throw new Error(`资源内容已改变：${resource.path}`);
    blobs.set(resource.path, file.slice(0, file.size, resource.type));
  }
  signal?.throwIfAborted();
  const fingerprint = await digest(new TextEncoder().encode(canonicalJSON(manifest)));
  return { manifest, fingerprint, blobs };
}
