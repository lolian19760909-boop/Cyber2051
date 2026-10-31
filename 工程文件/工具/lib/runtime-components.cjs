'use strict';
// 固定核对 JS-Slash-Runner 4.11.2 / 46ec10df；卡格式与运行时格式分开保存。
const positions = ['before_character_definition', 'after_character_definition', 'before_author_note', 'after_author_note', 'at_depth', 'before_example_messages', 'after_example_messages', 'outlet'];
function worldbookEntry(raw) {
  const e = raw.extensions || {};
  const position = e.position ?? (raw.position === 'after_char' ? 1 : 0);
  if (!positions[position]) throw Error('不支持的世界书位置 ' + position);
  const logic = ['and_any', 'not_all', 'not_any', 'and_all'][e.selectiveLogic ?? 0];
  if (!logic) throw Error('不支持的次要关键词规则');
  return {
    uid: raw.id, name: raw.comment || '', enabled: raw.enabled !== false,
    strategy: { type: e.vectorized ? 'vectorized' : raw.constant ? 'constant' : 'selective', keys: raw.keys || [], keys_secondary: { logic, keys: raw.secondary_keys || [] }, scan_depth: e.scan_depth ?? 'same_as_global' },
    position: { type: positions[position], role: ['system', 'user', 'assistant'][e.role ?? 0], depth: e.depth ?? 4, order: raw.insertion_order ?? 100 },
    content: raw.content, probability: e.probability ?? 100,
    recursion: { prevent_incoming: !!e.exclude_recursion, prevent_outgoing: !!e.prevent_recursion, delay_until: e.delay_until_recursion || null },
    effect: { sticky: e.sticky || null, cooldown: e.cooldown || null, delay: e.delay || null },
    group: e.group || '', groupOverride: !!e.group_override, groupWeight: e.group_weight ?? 100,
    caseSensitive: e.case_sensitive ?? null, matchWholeWords: e.match_whole_words ?? null, useGroupScoring: e.use_group_scoring ?? null,
    automationId: e.automation_id || '', ignoreBudget: !!e.ignore_budget, outletName: e.outlet_name || '', triggers: e.triggers || [],
    matchPersonaDescription: !!e.match_persona_description, matchCharacterDescription: !!e.match_character_description,
    matchCharacterPersonality: !!e.match_character_personality, matchCharacterDepthPrompt: !!e.match_character_depth_prompt,
    matchScenario: !!e.match_scenario, matchCreatorNotes: !!e.match_creator_notes,
    extra: { ...(e.extra || {}), __cxx_card_extensions: e },
  };
}
function regexScript(raw) {
  if ((raw.placement || []).some(x => x !== 1 && x !== 2) || (raw.substituteRegex ?? 0) !== 0) throw Error('正则包含未核对的位置或宏替换模式，停止转换');
  return { id: raw.id, script_name: raw.scriptName, enabled: !raw.disabled, find_regex: raw.findRegex, replace_string: raw.replaceString, trim_strings: raw.trimStrings || [], source: { user_input: raw.placement.includes(1), ai_output: raw.placement.includes(2), slash_command: false, world_info: false, reasoning: false }, destination: { display: !!raw.markdownOnly, prompt: !!raw.promptOnly }, run_on_edit: !!raw.runOnEdit, min_depth: raw.minDepth ?? null, max_depth: raw.maxDepth ?? null };
}
function componentsOf(d) {
  return { worldbook: { internalName: d.character_book.name, entries: d.character_book.entries.map(worldbookEntry) }, regex: { scripts: d.extensions.regex_scripts.map(regexScript) }, scripts: { trees: d.extensions.tavern_helper.scripts } };
}
module.exports = { worldbookEntry, regexScript, componentsOf };
