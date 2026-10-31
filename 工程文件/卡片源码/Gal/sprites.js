/* Explicit per-line expressions only. Names are exact card aliases; no emotion inference. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../正文/dialogue.js') : root.Cxx238Dialogue);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxGalSprites = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dialogue) {
  'use strict';
  const characters = dialogue.portraits;
  // Authored heights come from each character's maintained worldbook; new anchors default to center.
  const byId = new Map(characters.map(character => [character.id, character]));
  const expressions = dialogue.expressions;
  const expressionOf = dialogue.expression;

  function sprite(id, baseUrl = '', expression = 'normal', media = [], options = {}) {
    if (!byId.has(id) || typeof baseUrl !== 'string') return null;
    let base = '';
    if (baseUrl) {
      try {
        const url = new URL(baseUrl);
        if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
            !(url.origin === 'https://cyber2051.top' || (url.protocol === 'http:' &&
              ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))) return null;
        base = url.origin;
      } catch (_) { return null; }
    }
    const assets = Array.isArray(media) ? media : media?.files;
    const rules = media?.characters?.[id] || {};
    const requested = options.fallback ? 'normal' : expressionOf(expression);
    const battle = options.battle === true && rules.battle;
    const selected = battle
      ? (!options.fallback && battle.expressions?.[requested] || battle.defaultAsset)
      : (rules.fallbacks?.[requested] || (requested === 'normal' ? rules.defaultExpression || 'normal' : requested));
    if (base === 'https://cyber2051.top') {
      if (!Array.isArray(assets)) return null;
      const matches = assets.filter(asset => asset?.characterId === id && asset.expressionId === selected);
      const asset = matches.length === 1 ? matches[0] : null;
      const prefix = byId.get(id).filePrefix;
      if (!asset || asset.filePrefix !== prefix || !asset.file.startsWith(prefix + '_tachi_') ||
          !/^[A-Za-z0-9_ -]+\.png$/.test(asset.file) || !/^[0-9a-f]{64}$/.test(asset.sha256)) return null;
      return base + '/img/galgame/standing/' + asset.sha256.slice(0, 16) + '/' + encodeURIComponent(asset.file);
    }
    return base + '/assets/' + id + '_' + selected + '.png';
  }

  // Replay explicit marks only. End-of-reply ztl facts apply at the last paragraph,
  // so a later battle end never rewrites the earlier paragraphs of that reply.
  function battleState(parsed, paragraphIndex, initial = {}) {
    const state = { ...initial };
    for (const paragraph of (parsed?.paragraphs || []).slice(0, paragraphIndex + 1)) {
      if (byId.has(paragraph.characterId) && typeof paragraph.battle === 'boolean') state[paragraph.characterId] = paragraph.battle;
    }
    if (paragraphIndex >= (parsed?.paragraphs?.length || 0) - 1 && parsed?.scene?.charactersValid) {
      for (const person of parsed.scene.characters) {
        const id = characters.find(p => p.name === person.name || p.aliases.includes(person.name))?.id;
        if (id && typeof person.battle === 'boolean') state[id] = person.battle;
      }
    }
    return state;
  }

  function select(parsed, paragraphIndex, resolveUrl, initialBattle = {}) {
    if (!Array.isArray(parsed?.paragraphs) || !Array.isArray(parsed.dialogueRanking) ||
        !Number.isInteger(paragraphIndex) || paragraphIndex < 0 || paragraphIndex >= parsed.paragraphs.length) return [];
    const ranked = [], seen = new Set();
    const roster = parsed.scene?.charactersValid === true ? new Set(parsed.scene.characters.map(item =>
      characters.find(character => character.name === item.name || character.aliases.includes(item.name))?.id).filter(Boolean)) : null;
    for (const entry of parsed.dialogueRanking) {
      const character = byId.get(entry?.id);
      if (!character || seen.has(character.id) || !Number.isInteger(entry.lastParagraph) ||
          entry.lastParagraph >= parsed.paragraphs.length || (roster && !roster.has(character.id))) continue;
      seen.add(character.id);
      ranked.push(character);
    }
    if (roster) for (const id of roster) if (!seen.has(id)) { seen.add(id); ranked.push(byId.get(id)); }
    const chosen = new Map();
    const battles = battleState(parsed, paragraphIndex, initialBattle);
    const lastExpressions = new Map();
    for (const paragraph of parsed.paragraphs.slice(0, paragraphIndex + 1)) {
      if (byId.has(paragraph?.characterId)) lastExpressions.set(paragraph.characterId, expressionOf(paragraph.expression));
    }
    function resolve(character) {
      const expression = lastExpressions.get(character.id) || 'normal';
      const options = { battle: battles[character.id] === true };
      const url = resolveUrl?.(character.id, expression, options);
      const fallback = expression === 'normal' ? url : resolveUrl?.(character.id, 'normal', { ...options, fallback: true });
      if (typeof url === 'string' && url.trim()) chosen.set(character.id, {
        id: character.id, name: character.name, anchorX: character.anchorX, heightCm: character.heightCm, expression, battle: options.battle, url,
        fallbackUrl: typeof fallback === 'string' && fallback.trim() ? fallback : null,
      });
    }
    const speaker = ranked.find(character => character.id === parsed.paragraphs[paragraphIndex]?.characterId);
    // Reserve a visible slot for this paragraph's speaker before filling by rank.
    if (speaker) resolve(speaker);
    for (const character of ranked) {
      if (chosen.size >= 3) break;
      if (character !== speaker) resolve(character);
    }
    return ranked.filter(character => chosen.has(character.id)).map(character => chosen.get(character.id));
  }

  return Object.freeze({ characters, expressions, sprite, select, battleState });
});
