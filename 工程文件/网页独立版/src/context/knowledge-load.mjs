/** U02: read the built knowledge index in the browser bundle and check its digest before anyone trusts it. */
import {verifyKnowledgeIndex} from './knowledge.mjs';

export async function loadKnowledgeBrowser(base = './data/') {
  const url = new URL('knowledge-index.json', new URL(base, globalThis.location?.href || 'http://localhost/'));
  const response = await fetch(url);
  if (!response.ok) return { status: 'missing', reason: '知识目录未随本次构建发布（' + response.status + '）', url: String(url) };
  const index = await response.json();
  const verify = verifyKnowledgeIndex(index);
  return { status: verify.ok ? 'ok' : 'mismatch', index, verify, url: String(url) };
}
