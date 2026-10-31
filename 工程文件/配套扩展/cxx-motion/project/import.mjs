import { digest, prepareProject, resourcePath } from './manifest.mjs';

export async function importProjectFiles(selection, { signal } = {}) {
  const files = new Map();
  for (const file of selection) {
    const path = resourcePath(file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name);
    if (files.has(path)) throw new Error(`存在同名文件：${path}`);
    files.set(path, file);
  }
  if (files.has('project.json')) return prepareProject(JSON.parse(await files.get('project.json').text()), files, { signal });
  const rive = [...files.keys()].filter(path => path.toLowerCase().endsWith('.riv'));
  const lottie = [...files.keys()].filter(path => /\.(json|lottie)$/i.test(path));
  const main = rive.length === 1 && !lottie.length ? rive[0] : !rive.length && lottie.length === 1 ? lottie[0] : null;
  if (!main) throw new Error('请选择一个Rive、Lottie作品及其素材，或选择根目录含project.json的项目文件夹。');
  if (main.toLowerCase().endsWith('.json')) {
    const animation = JSON.parse(await files.get(main).text());
    if (!Array.isArray(animation.layers) || !Number.isFinite(animation.fr) || !Number.isFinite(animation.op)) throw new Error('此JSON不是Lottie动画或视觉项目清单。');
  }
  const resources = [];
  const assets = Object.create(null);
  for (const [path, file] of files) {
    signal?.throwIfAborted();
    resources.push({ path, bytes: file.size, sha256: await digest(await file.arrayBuffer()), type: file.type || 'application/octet-stream' });
    if (path !== main) {
      const name = path.split('/').at(-1);
      if (Object.hasOwn(assets, name)) throw new Error(`外置素材同名，请用project.json指定映射：${name}`);
      assets[name] = path;
      if (path !== name) assets[path] = path;
    }
  }
  const fingerprint = resources.find(resource => resource.path === main).sha256;
  const engine = rive.length ? { id: 'rive-webgl2', version: '2.44.2' } : { id: 'dotlottie-canvas', version: '0.81.0' };
  return prepareProject({
    format: 'tavern-visual-project', schema: 1, id: `${engine.id}-${fingerprint.slice(0, 20)}`, version: '1',
    title: main.split('/').at(-1), engine,
    scene: { file: main, assets }, resources,
  }, files, { signal });
}
