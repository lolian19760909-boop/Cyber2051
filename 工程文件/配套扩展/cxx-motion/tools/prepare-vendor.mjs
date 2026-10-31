import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules/@rive-app/webgl2');
const version = '2.44.2';
const metadata = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
if (metadata.version !== version || metadata.license !== 'MIT') throw new Error('本地Rive版本或许可证与构建锁不符。');
const files = new Map([
  [`rive-${version}.mjs`, Buffer.from(`const module = { exports: {} };\nconst exports = module.exports;\n${await fs.readFile(path.join(source, 'rive.js'), 'utf8')}\nexport default module.exports;\n`)],
  [`rive-${version}.wasm`, await fs.readFile(path.join(source, 'rive.wasm'))],
  ['RIVE-LICENSE.txt', await fs.readFile(path.join(root, 'licenses/RIVE-LICENSE.txt'))],
]);
const lottieRoot = path.join(root, 'node_modules/@lottiefiles/dotlottie-web');
const lottie = JSON.parse(await fs.readFile(path.join(lottieRoot, 'package.json'), 'utf8'));
if (lottie.version !== '0.81.0' || lottie.license !== 'MIT') throw new Error('dotLottie版本或许可证与构建锁不符。');
for (const backend of ['canvas', 'webgl']) {
  const directory = backend === 'canvas' ? 'dist' : 'dist/webgl';
  files.set(`dotlottie-${backend}-0.81.0.mjs`, await fs.readFile(path.join(lottieRoot, directory, 'index.js')));
  files.set(`dotlottie-${backend}-0.81.0.wasm`, await fs.readFile(path.join(lottieRoot, directory, 'dotlottie-player.wasm')));
}
files.set('DOTLOTTIE-LICENSE.txt', await fs.readFile(path.join(lottieRoot, 'LICENSE')));
const receipt = { packages: [metadata, lottie].map(({ name, version, license }) => ({ name, version, license })), files: [...files].map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })) };
if (process.argv.includes('--write')) {
  await fs.mkdir(path.join(root, 'vendor'), { recursive: true });
  for (const [name, bytes] of files) await fs.writeFile(path.join(root, 'vendor', name), bytes);
  await fs.writeFile(path.join(root, 'vendor/receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
}
console.log(JSON.stringify({ root, write: process.argv.includes('--write'), ...receipt }, null, 2));
