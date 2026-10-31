/**
 * 正文解析端口：读模型输出，拆成"正式正文 / 显示投影 / 状态提议"三份（蓝图 §5.1 第 3 步、§7.1）。
 *
 * 复用卡内 `Gal/parser.js`，不重写解析器。解析失败只记录 issues，不抛异常，
 * 由回合协调器决定是拒绝还是降级为纯正文。
 *
 * 装载边界：本文件不 import Node 内置模块。解析器由调用方注入（Node 用
 * `src/reuse/card.mjs`，浏览器用 `src/reuse/browser-chain.mjs` 拿到的全局 `CxxGalParser`）。
 */

const EMPTY_DISPLAY = () => ({ paragraphs: [], choices: [], scene: null, warnings: [] });

/** Trusted tag alias used by the maintained 喵赛亚 preset; raw is retained verbatim. */
export function normalizeThinkingTags(raw) {
  return String(raw ?? '').replace(/<(\/?)think_nya(?:~)?\s*>/gi, '<$1think>');
}

function fallback(raw) {
  return {
    raw,
    display: { ...EMPTY_DISPLAY(), paragraphs: [{ text: raw, speaker: null, characterId: null, expression: 'normal' }] },
    protocol: { patches: [], found: false, issues: ['解析器未加载'] },
    features: [],
    supported: false,
  };
}

/** Shared reading projection; display callers do not rerun settlement parsing. */
export function displayProjection(parsed){
  const result={display:EMPTY_DISPLAY()};
  result.display.paragraphs = parsed.paragraphs || [];
  result.display.choices = parsed.choices || [];
  result.display.scene = parsed.scene || null;
  result.display.warnings = parsed.warnings || [];
  const auxiliary = (parsed.auxiliary || []).map(item => ({ label: item.label, body: String(item.text || '').replace(/^<[^>]+>|<\/[^>]+>$/g, ''), thinking: /^\s*<(?:think|thinking|konatan_planning~)>/i.test(item.text || '') }));
  result.thinking = auxiliary.filter(item => item.thinking).map(({label,body}) => ({label,body}));
  result.auxiliary = auxiliary.filter(item => !item.thinking).map(({label,body}) => ({label,body}));
  result.display.auxiliary = result.auxiliary;
  return result;
}

/**
 * @param {string} raw 模型原始输出
 * @param {{parser?: object, [key: string]: any}} options `parser` 为卡内 `Gal/parser.js` 导出的对象，
 *   其余键原样转给 `parseMessage`。
 */
export function parseReply(raw, options = {}) {
  const text = String(raw ?? '');
  const { parser, ...parseOptions } = options;
  if (!parser || typeof parser.parseMessage !== 'function') return fallback(text);

  const base = {
    raw: text,
    display: EMPTY_DISPLAY(),
    protocol: { patches: [], found: false, issues: [] },
    features: [],
    supported: true,
  };

  const normalized = normalizeThinkingTags(text);
  const parsed = parser.parseMessage(normalized, parseOptions) || {};
  Object.assign(base,displayProjection(parsed));
  if (base.display.choices.length) base.features.push('xuan');
  if (base.display.scene) base.features.push('cxx-story');

  try {
    const updates = typeof parser.variableUpdates === 'function' ? parser.variableUpdates(normalized) : null;
    if (updates) {
      base.protocol.found = Boolean(updates.found);
      base.protocol.patches = updates.patches || [];
      base.protocol.issues = updates.issues || [];
      if (base.protocol.found) base.features.push('ztl');
    }
  } catch (error) {
    base.protocol.issues.push(String(error.message || error));
  }
  for (const item of parsed.diagnostics || []) base.protocol.issues.push(item.message);
  try { parser.settlementParts?.(normalized); } catch(error) { base.protocol.issues.push(error.message); }
  base.protocol.issues = [...new Set(base.protocol.issues)];
  return base;
}

/**
 * 正文与展示必须分开：展示投影可以被主题、正则、Gal 处理，
 * 但提交与下一轮提示永远用 raw/paragraphs，不用美化后的 HTML。
 */
export function displayText(parsed) {
  return (parsed.display.paragraphs || []).map((p) => p.text).join('\n\n');
}
