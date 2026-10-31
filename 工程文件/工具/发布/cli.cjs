#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const api = require('./packages.cjs');
const RuntimeCore = require("../../卡片源码/运行时/core.js");
const usage = `离线更新包工具（默认只检查，不写文件）
  build --card 新卡.json --content 内容定义.json --out 显式目录 [--content 第二份.json]
        [--previous 旧manifest.json] [--registry 新卡或既有registry.json] [--map-index 地点索引.json]
        [--characters 角色编号.json] [--quest-ids 任务编号.json]
        [--private-key 外部Ed25519私钥.pem --key-id 官方公钥编号] [--write]
  verify --package 包.json --public-key 公钥.pem --key-id 官方公钥编号 [--catalog manifest.json]
         [--map-index 地点索引.json] [--characters 角色编号.json]
  verify --catalog manifest.json --public-key 公钥.pem --key-id 官方公钥编号
--write 只写本地输出目录；本工具没有部署或发布命令，不生成任何真实密钥。`;
const readJson = filename => JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
function main(argv) {
  if (!argv.length || argv.includes('--help')) { console.log(usage); return; }
  const command = argv.shift(), args = { content: [] };
  const values = new Set(['card', 'content', 'out', 'previous', 'registry', 'map-index', 'characters', 'quest-ids', 'private-key', 'public-key', 'key-id', 'package', 'catalog']);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--write' || flag === '--dry-run') {
      if (args.mode) throw Error('不能重复或混用 --write/--dry-run');
      args.mode = flag; args.write = flag === '--write'; continue;
    }
    const name = flag.startsWith('--') && flag.slice(2);
    if (!values.has(name) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('未知参数或缺少参数值: ' + flag);
    const value = argv[++i];
    if (name === 'content') args.content.push(value);
    else { if (args[name] !== undefined) throw Error('重复参数: ' + flag); args[name] = value; }
  }
  const validation = {};
  if (args['map-index']) validation.mapIndex = readJson(args['map-index']);
  if (args.characters) validation.characterIds = readJson(args.characters);
  if (args['quest-ids']) validation.questIds = readJson(args['quest-ids']);
  if (args.registry) validation.existingRegistry = readJson(args.registry);
  if (command === 'verify') {
    if (args.write || !args['public-key'] || !args['key-id'] || (!args.package && !args.catalog)) throw Error('verify 必须显式提供文件、公钥和 key-id');
    const trustedKeys = { [args['key-id']]: fs.readFileSync(args['public-key'], 'utf8') };
    const catalog = args.catalog ? api.validateCatalog(readJson(args.catalog), { trustedKeys }) : null;
    if (args.package) {
      const bytes = fs.readFileSync(args.package), pkg = api.validatePackage(JSON.parse(bytes), { ...validation, trustedKeys });
      if (catalog) {
        const entry = catalog.packages.find(e => e.id === pkg.id && e.version === pkg.version);
        if (!entry || entry.sha256 !== api.sha256(bytes) || entry.bytes !== bytes.length || api.canonical(entry.requires) !== api.canonical(pkg.requires) || entry.kind !== pkg.kind || entry.optional !== pkg.optional || (entry.activation || 'compatible') !== (pkg.activation || 'compatible')) throw Error('包与签名清单不一致');
      }
    }
    console.log('签名、数据格式及指定清单校验通过（离线）'); return;
  }
  if (command !== 'build' || !args.out || (!args.card && !args.content.length)) throw Error('build 必须提供显式输入和 --out');
  const packages = [];
  if (args.card) packages.push(api.createCorePackage(readJson(args.card)));
  packages.push(...args.content.map(file => api.createContentPackage(readJson(file), validation)));
  api.validateOwnership(packages, validation.existingRegistry);
  const summary = { mode: args.write ? 'local-write' : 'dry-run', output: path.resolve(args.out), packages: packages.map(pkg => ({ id: pkg.id, version: pkg.version, kind: pkg.kind, optional: pkg.optional })) };
  if (!args['private-key']) {
    if (args.write || args.previous) throw Error('签名构建/旧清单检查必须显式提供外部 Ed25519 私钥和 key-id');
    const engineVersion = packages.reduce((version, pkg) => api.compareVersion(pkg.requires.engine, version) > 0 ? pkg.requires.engine : version, api.ENGINE_VERSION);
    if (api.compareVersion(engineVersion, RuntimeCore.ENGINE_VERSION) > 0) throw Error('当前程序版本不足以生成此能力清单');
    api.validateCatalog({ format: 3, cardId: api.CARD_ID, engineVersion, packages: packages.map(pkg => ({ id: pkg.id, version: pkg.version, kind: pkg.kind, optional: pkg.optional, requires: pkg.requires, url: api.packageUrl(pkg), sha256: api.sha256(api.canonical(pkg)), bytes: Buffer.byteLength(api.canonical(pkg)) })) });
    summary.signing = '尚未提供官方密钥，只做结构预检查，不生成可安装产物';
  } else {
    const release = api.buildRelease({ packages, privateKey: fs.readFileSync(args['private-key'], 'utf8'), keyId: args['key-id'], previousCatalog: args.previous ? readJson(args.previous) : null, ...validation });
    summary.signing = 'Ed25519'; summary.files = release.files.map(file => ({ path: file.relativePath, bytes: file.bytes.length, sha256: file.entry.sha256 }));
    if (args.write) summary.written = api.writeRelease(release, args.out);
  }
  console.log(JSON.stringify(summary, null, 2));
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error('[停止] ' + error.message); process.exitCode = 1; } }
module.exports = { main };
