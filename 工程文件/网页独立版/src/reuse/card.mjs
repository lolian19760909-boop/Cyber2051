/**
 * 唯一内容维护源加载器。
 *
 * 网页内核不复制剧情、规则与解析器：直接 require `工程文件/卡片源码/` 下的
 * 有效模块（A 类复用，见蓝图 §2.2 / §2.3）。构建期把它们打进内容包，
 * 运行期只读索引；文件路径由构建登记 `工具/构建/当前/module-sources.json` 决定。
 *
 * 这里只做"解析出绝对路径并加载"，不在这里改任何卡内语义。
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** 工程文件/网页独立版 → 工程文件 → 卡片源码 */
export const PROJECT_DIR = resolve(HERE, '..', '..', '..');
export const CARD_SOURCE_DIR = join(PROJECT_DIR, '卡片源码');
export const BUILD_DIR = join(PROJECT_DIR, '工具', '构建', '当前');

const requireFromCard = createRequire(join(CARD_SOURCE_DIR, 'noop.cjs'));

const CACHE = new Map();

export function cardModule(relativePath) {
  if (CACHE.has(relativePath)) return CACHE.get(relativePath);
  const full = join(CARD_SOURCE_DIR, relativePath);
  if (!existsSync(full)) throw new Error(`维护源缺少模块：${relativePath}`);
  const loaded = requireFromCard(full);
  CACHE.set(relativePath, loaded);
  return loaded;
}

/** 卡内真实规则链：zod-lite 校验 → schema 编译 → 补丁应用。 */
export function cardRuleChain() {
  const validator = cardModule('数据/validator.js');
  const schema = cardModule('MVU/schema.js');
  const applier = cardModule('数据/applier.js');
  return { z: validator.z, schema, applier, actors: cardModule('运行时/ensemble-state.js') };
}

export function cardParser() {
  return cardModule('Gal/parser.js');
}

export function cardDialogue() {
  return cardModule('正文/dialogue.js');
}
