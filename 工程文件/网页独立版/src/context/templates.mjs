/** U11: install and repair the shipped Skill template without touching author edits. */
export const TEMPLATE_VERSION = '2051.skill.1';

const CORE_FIELDS = ['skillPrompt', 'segmentRules', 'mergeRules', 'manualPatch'];

export function templateDigest(prompt = {}) {
  return digest(JSON.stringify(CORE_FIELDS.map(key => [key, String(prompt?.[key] ?? '')])));
}

function digest(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Only states we have actually shipped and later fixed; anything else counts as author customization. */
export const KNOWN_BROKEN = [
  {
    id: 'skill-prompt-truncated-1',
    why: '导出时把 skillPrompt 截成半段，uid 回填那条规则整条丢了',
    fields: ['skillPrompt'],
    when: prompt => !!prompt?.skillPrompt && !String(prompt.skillPrompt).includes('uid 必须原样回填'),
  },
  {
    id: 'segment-rules-missing-0',
    why: 'K27 分段说明还没写进模板，长条目无法按段生成',
    fields: ['segmentRules'],
    when: prompt => !prompt?.segmentRules,
  },
];

export function detectKnownBroken(prompt) {
  for (const row of KNOWN_BROKEN) {
    let hit = false;
    try { hit = row.when(prompt); } catch { hit = false; }
    if (hit) return row;
  }
  return null;
}

/**
 * stored: whatever is currently published (may be null on first install).
 * official: the freshly generated template for this build.
 * Returns the template to publish plus a receipt; author wording that is not a known broken state is kept.
 */
export function installOrRepair({ stored = null, official, templateVersion = TEMPLATE_VERSION } = {}) {
  if (!official || typeof official !== 'object') throw new Error('official template required');
  const next = { ...official, templateVersion };
  if (!stored || typeof stored !== 'object') {
    return { prompt: next, action: 'installed', reason: 'first-install', signature: null, changedFields: [], templateVersion };
  }
  const broken = detectKnownBroken(stored);
  if (broken) {
    const prompt = { ...stored };
    const changedFields = [];
    for (const field of broken.fields) {
      if (String(prompt[field] ?? '') !== String(official[field] ?? '')) { prompt[field] = official[field]; changedFields.push(field); }
    }
    prompt.templateVersion = templateVersion;
    return { prompt, action: 'repaired', reason: broken.why, signature: broken.id, changedFields, templateVersion };
  }
  const sameCore = CORE_FIELDS.every(key => String(stored[key] ?? '') === String(official[key] ?? ''));
  if (sameCore) {
    const drifted = stored.templateVersion !== templateVersion;
    return { prompt: drifted ? { ...stored, templateVersion } : stored, action: drifted ? 'upgraded' : 'kept', reason: drifted ? 'template-version-bumped' : 'same-template', signature: null, changedFields: [], templateVersion };
  }
  const previousVersion = String(stored.templateVersion ?? '');
  if (previousVersion && previousVersion !== templateVersion) {
    return { prompt: stored, action: 'kept', reason: 'author-customized', signature: null, changedFields: [], templateVersion: previousVersion, officialVersion: templateVersion };
  }
  return { prompt: stored, action: 'kept', reason: 'author-customized', signature: null, changedFields: [], templateVersion: previousVersion || templateVersion, officialVersion: templateVersion };
}

/** One-line status for settings and diagnostics. */
export function templateStatus(prompt = {}, receipt = null) {
  const broken = detectKnownBroken(prompt);
  return {
    templateVersion: String(prompt?.templateVersion || 'unknown'),
    digest: templateDigest(prompt),
    broken: broken ? broken.id : null,
    action: receipt?.action || 'unknown',
    signature: receipt?.signature || null,
    changedFields: receipt?.changedFields || [],
  };
}
