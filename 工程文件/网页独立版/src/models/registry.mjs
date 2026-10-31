/**
 * 模型接口兼容矩阵（蓝图 §7.2 / 修订三 §2.3）。
 *
 * 冻结版本：SillyTavern 1.19.0（`工程文件/.cache/debug223/host/app/package.json`）。
 * 名单来源为**实测抽取**，不是凭印象补的：
 *   聊天源 `public/scripts/openai.js:177` chat_completion_sources（26 项）
 *   文本源 `public/scripts/textgen-settings.js:31` textgen_types（15 项）
 * 主入口 `public/index.html` 另有 NovelAI / AI Horde / KoboldAI Classic 三套独立接口。
 *
 * 41 个源不是 41 种互不相同的协议，实际收敛为少数几种"协议族 + 认证方式 + 端点参数"。
 * 覆盖状态是显式字段，不是隐含断言：
 *   'frozen' 名单已冻结，协议族已归类，尚未对真实服务探测
 *   'probed' 已对真实/夹具服务跑过生成与流式验证（P2 起逐项补）
 * 任何未探测项都不算已验证；真实模型由作者验收（蓝图 §9.1）。
 */

export const FROZEN_ST_VERSION = '1.19.0';

/** 协议族：决定请求体形状、流式帧格式与取消方式。 */
export const PROTOCOL_FAMILIES = Object.freeze({
  'openai-chat': { stream: 'sse', bodies: 'choices[].delta.content' },
  'claude-messages': { stream: 'sse', bodies: 'content_block_delta' },
  'google-gemini': { stream: 'sse', bodies: 'candidates[].content.parts' },
  cohere: { stream: 'sse', bodies: 'text-generation' },
  'vertex-ai': { stream: 'sse', bodies: 'candidates' },
  'azure-openai': { stream: 'sse', bodies: 'choices[].delta.content' },
  workersai: { stream: 'sse', bodies: 'response' },
  'text-generic': { stream: 'sse', bodies: 'token' },
  'kobold-lite': { stream: 'sse', bodies: 'token' },
  'kobold-classic': { stream: 'sse', bodies: 'results[]' },
  novelai: { stream: 'sse', bodies: 'token' },
  horde: { stream: 'poll', bodies: 'generations[].text' },
});

const F = PROTOCOL_FAMILIES;

function entry(id, label, family, extra = {}) {
  return {
    id,
    label,
    family,
    auth: extra.auth || 'bearer',
    modelList: extra.modelList || 'openai',
    stream: extra.stream !== false,
    status: extra.status || 'frozen',
    notes: extra.notes || '',
  };
}

/** 26 项聊天源。 */
export const CHAT_SOURCES = [
  entry('openai', 'OpenAI', 'openai-chat', { modelList: 'openai' }),
  entry('claude', 'Claude', 'claude-messages', { auth: 'custom-header' }),
  entry('openrouter', 'OpenRouter', 'openai-chat'),
  entry('ai21', 'AI21', 'openai-chat', { auth: 'custom-header' }),
  entry('makersuite', 'Google AI Studio', 'google-gemini', { auth: 'query-key', modelList: 'google' }),
  entry('vertexai', 'Vertex AI', 'vertex-ai', { auth: 'oauth' }),
  entry('mistralai', 'MistralAI', 'openai-chat'),
  entry('custom', 'Custom (OpenAI-compatible)', 'openai-chat'),
  entry('cohere', 'Cohere', 'cohere', { auth: 'custom-header' }),
  entry('perplexity', 'Perplexity', 'openai-chat'),
  entry('groq', 'Groq', 'openai-chat'),
  entry('electronhub', 'ElectronHub', 'openai-chat'),
  entry('chutes', 'Chutes', 'openai-chat'),
  entry('nanogpt', 'NanoGPT', 'openai-chat'),
  entry('deepseek', 'DeepSeek', 'openai-chat'),
  entry('aimlapi', 'AIMLAPI', 'openai-chat'),
  entry('xai', 'xAI', 'openai-chat'),
  entry('pollinations', 'Pollinations', 'openai-chat', { auth: 'none' }),
  entry('moonshot', 'Moonshot', 'openai-chat'),
  entry('fireworks', 'Fireworks', 'openai-chat'),
  entry('cometapi', 'CometAPI', 'openai-chat'),
  entry('azure_openai', 'Azure OpenAI', 'azure-openai', { auth: 'api-key-header' }),
  entry('zai', 'Z.AI', 'openai-chat'),
  entry('siliconflow', 'SiliconFlow', 'openai-chat'),
  entry('workers_ai', 'Cloudflare Workers AI', 'workersai', { auth: 'bearer-account' }),
  entry('minimax', 'MiniMax', 'openai-chat'),
];

/** 15 项文本源（Text Completion）。 */
export const TEXT_SOURCES = [
  entry('ooba', 'Text Generation WebUI', 'text-generic', { auth: 'none', modelList: 'none' }),
  entry('mancer', 'Mancer', 'text-generic'),
  entry('vllm', 'vLLM', 'text-generic', { auth: 'none', modelList: 'none' }),
  entry('aphrodite', 'Aphrodite', 'text-generic', { auth: 'none', modelList: 'none' }),
  entry('tabby', 'Tabby', 'text-generic', { auth: 'custom-header' }),
  entry('koboldcpp', 'KoboldCpp', 'kobold-lite', { auth: 'none' }),
  entry('togetherai', 'TogetherAI', 'text-generic'),
  entry('llamacpp', "Llama.cpp", 'text-generic', { auth: 'none', modelList: 'none' }),
  entry('ollama', 'Ollama', 'text-generic', { auth: 'none', modelList: 'ollama' }),
  entry('infermaticai', 'InfermaticAI', 'text-generic'),
  entry('dreamgen', 'DreamGen', 'text-generic'),
  entry('openrouter', 'OpenRouter', 'text-generic'),
  entry('featherless', 'Featherless', 'text-generic'),
  entry('huggingface', 'HuggingFace', 'text-generic'),
  entry('generic', 'Generic (text)', 'text-generic', { auth: 'optional' }),
];

/** 主入口独立的另外三套接口。 */
export const EXTRA_MAIN_SOURCES = [
  entry('novelai', 'NovelAI', 'novelai', { auth: 'custom-header', modelList: 'none' }),
  entry('aihorde', 'AI Horde', 'horde', { auth: 'apikey-header', stream: false, modelList: 'none' }),
  entry('kobold_classic', 'KoboldAI Classic', 'kobold-classic', { auth: 'none', modelList: 'none' }),
];

export const ALL_SOURCES = [...CHAT_SOURCES, ...TEXT_SOURCES, ...EXTRA_MAIN_SOURCES];

export const SOURCE_COUNTS = Object.freeze({
  chat: CHAT_SOURCES.length,
  text: TEXT_SOURCES.length,
  extra: EXTRA_MAIN_SOURCES.length,
  total: ALL_SOURCES.length,
  families: Object.keys(PROTOCOL_FAMILIES).length,
});

export function findSource(id) {
  return ALL_SOURCES.find((s) => s.id === id) || null;
}

/** 覆盖矩阵摘要：给验收和进度记录直接引用，避免口头断言。 */
export function coverageSummary() {
  const byStatus = {};
  for (const source of ALL_SOURCES) byStatus[source.status] = (byStatus[source.status] || 0) + 1;
  const families = {};
  for (const source of ALL_SOURCES) families[source.family] = (families[source.family] || 0) + 1;
  return { st: FROZEN_ST_VERSION, counts: SOURCE_COUNTS, byStatus, families };
}

export const FAMILY_KEYS = Object.keys(F);
