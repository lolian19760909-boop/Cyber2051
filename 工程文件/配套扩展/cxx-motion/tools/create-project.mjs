import fs from 'node:fs/promises';
import path from 'node:path';
import { prepareProject, resourcePath } from '../project/manifest.mjs';
import { createHash } from 'node:crypto';

const arguments_ = process.argv.slice(2);
const rootArgument = arguments_.find(value => !value.startsWith('--'));
if (!rootArgument || arguments_.some(value => value.startsWith('--') && value !== '--write')) throw new Error('用法：node tools/create-project.mjs <作品目录> [--write]');
const root = await fs.realpath(path.resolve(rootArgument));
const source = JSON.parse(await fs.readFile(path.join(root, 'project.source.json'), 'utf8'));
const { files, ...metadata } = source;
if (!Array.isArray(files) || !files.length) throw new Error('project.source.json需要files文件路径数组。');
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const resources = [], blobs = new Map();
for (const name of files) {
  resourcePath(name);
  const filename = await fs.realpath(path.join(root, name));
  if (!filename.startsWith(root + path.sep)) throw new Error(`资源不在作品目录内：${name}`);
  const bytes = await fs.readFile(filename);
  const type = types[path.extname(name).toLowerCase()] ?? 'application/octet-stream';
  resources.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), type });
  blobs.set(name, new Blob([bytes], { type }));
}
const project = await prepareProject({ ...metadata, resources }, blobs);
if (arguments_.includes('--write')) await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(project.manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify({ written: arguments_.includes('--write'), root, project: project.manifest.id, version: project.manifest.version, files: resources.length, bytes: resources.reduce((sum, resource) => sum + resource.bytes, 0), fingerprint: project.fingerprint }, null, 2) + '\n');
