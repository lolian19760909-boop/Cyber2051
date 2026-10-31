/**
 * 浏览器侧卡内规则链装载器。
 *
 * 为什么不用 ESM import：卡内几百个文件是 UMD 经典脚本，`src/reuse/card.mjs` 那条 Node 路径
 * 依赖 `node:module` / `node:fs`，浏览器里必然失败（P1 实测过）。所以浏览器改成
 * 按依赖拓扑序插入 `<script>`，装载完成后从全局对象取模块。
 *
 * 这条路径与 Node 路径读的是同一批卡内源码，因此规则语义一致；区别只在"怎么把文件变成对象"。
 */
import { CARD_LOAD_ORDER, CARD_GLOBALS, CARD_DATA_GLOBALS } from './card-load-order.mjs';
import {appUrl} from '../platform/paths.mjs';

function injectScript(url) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = url;
    el.async = false;
    el.onload = () => resolve(url);
    el.onerror = () => reject(new Error(`卡内模块装载失败：${url}`));
    document.head.appendChild(el);
  });
}

function pick(names) {
  for (const name of names || []) {
    const value = globalThis[name];
    if (value && typeof value === 'object') return value;
  }
  return null;
}

/**
 * @param {{baseUrl?: string, order?: string[], onProgress?: (info: {index: number, total: number, url: string}) => void}} options
 */
export async function loadCardChainInBrowser(options = {}) {
  const baseUrl = (options.baseUrl || '/card/').replace(/\/?$/, '/');
  const scriptBaseUrl=(options.scriptBaseUrl||appUrl('src/ui/card/')).replace(/\/?$/, '/');
  const order = [...new Set(options.order || CARD_LOAD_ORDER)];

  // 先挂 JSON 数据全局：schema/city/police/chapter 在工厂执行时就会读它们。
  const dataLoaded = [];
  await Promise.all(CARD_DATA_GLOBALS.map(async item => {
    const url = baseUrl + item.path.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`卡内数据装载失败：${item.path}（HTTP ${response.status}）`);
    globalThis[item.global] = await response.json();
    dataLoaded.push(item.path);
    options.onProgress?.({index:dataLoaded.length,total:CARD_DATA_GLOBALS.length+order.length,url});
  }));

  const seen = new Set();
  const loaded = [];
  await Promise.all(order.map(async rel => {
    const url = scriptBaseUrl + rel.split('/').map(encodeURIComponent).join('/');
    if (seen.has(url)) return; // 同一文件在拓扑序里出现两次时只装一次
    seen.add(url);
    await injectScript(url);
    loaded.push(rel);
    options.onProgress?.({index:dataLoaded.length+loaded.length,total:CARD_DATA_GLOBALS.length+order.length,url});
  }));

  const zModule = pick(CARD_GLOBALS.z);
  const schema = pick(CARD_GLOBALS.schema);
  const applier = pick(CARD_GLOBALS.applier);
  const parser = pick(CARD_GLOBALS.parser);

  const missing = [];
  if (!zModule) missing.push('z(validator.js)');
  if (!schema) missing.push('schema(MVU/schema.js)');
  if (!applier) missing.push('applier(数据/applier.js)');
  if (missing.length) {
    throw new Error(`卡内规则链全局对象缺失：${missing.join('、')}（已装载 ${loaded.length} 个文件）`);
  }

  // validator 导出的是 { z, VERSION, ZodLiteError, describe }，schema.build 要的是其中的 z。
  const z = zModule.z || zModule;
  return { z, schema, applier, parser, actors: globalThis.CxxEnsembleState, loaded, dataLoaded };
}

/** 单独取一个已装载的卡内全局对象（如 `CxxGalParser`）。 */
export function cardGlobal(names) {
  return pick(Array.isArray(names) ? names : [names]);
}
