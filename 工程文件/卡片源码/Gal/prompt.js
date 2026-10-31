/* Optional dialogue formatting only. No worldbook, card or message writes. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CxxGalPrompt = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ID = 'cxx_gal_dialogue_v1';
  const CONTENT = [
    '[CXX_GAL_DIALOGUE_V1]',
    '不要把本约定的标题标记或说明输出到正文；只按下面的逐句格式输出台词。',
    '本次新剧情回复仅增加以下可选阅读格式，保留原有设定、剧情和语言风格。',
    '实际故事放入一对 cxx-story 标签。旁白和动作单独成段；台词使用 <cxx-say speaker="角色全名" expression="normal">「台词」</cxx-say>；直接心声增加 kind="thought"，不补造玩家心理，不把动作或神态塞进 speaker。',
    '差分使用 normal（无明显情绪）、smile（微笑）、blush（害羞）、serious（严肃、警惕、普通愤怒）、sadness（明显伤心、委屈、想哭）、regret（以遗憾为核心，也含无奈、叹气、允悲、后悔及较轻悲伤）、shocked（日常吃惊）、constricted_pupils（精神冲击、震撼、失神落魄，也可暴怒；不用于羞耻）、cyberpsychosis（仅明确赛博精神病发作，普通暴怒和精神崩溃不触发）。按本句实际状态选择；没有明显情绪用 normal，不为换图编造情绪。',
    '人物参与战斗时台词加 battle="true"，战斗结束使用 battle="false"；省略表示未声明变化。ztl.characters 中可加布尔值 battle 记录本轮结束时的战斗状态，沉默人物也照实记录。有战斗差分时保持战斗形态至战斗结束，没有战斗差分时照常按情绪选图。',
    '只标明实际明确发言者，不为未发言者补写台词。明确的沉默可以写作 <cxx-say speaker="角色全名" expression="normal">「……」</cxx-say>；没有明确说话人的旁白、引文和代码保持原样，不猜测归属。',
    '保留原本已启用的正文、<ztl>、<xuan>要求及其顺序，遵守当前卡的MVU更新方式：额外模型模式中，主剧情不输出<UpdateVariable>，数值命令只由额外MVU模型生成一次。状态栏描述已发生的场景，不自行结算资产。',
    '不要新增 CG 或任务标签，不要让差分改变变量、任务或 CG 规则，不要用代码围栏包裹正常正文。',
  ].join('\n');

  function create({ injectPrompts } = {}) {
    if (typeof injectPrompts !== 'function') throw Error('酒馆助手提示注入能力不可用，无法启用 Gal 对话格式。');
    let activeKey = '', uninject = null, destroyed = false;

    function clear() {
      const release = uninject;
      uninject = null;
      activeKey = '';
      if (release) release();
    }

    function sync(key) {
      if (destroyed) return;
      const nextKey = key || '';
      if (nextKey === activeKey) return;
      clear();
      if (!nextKey) return;
      const handle = injectPrompts([{
        id: ID, position: 'in_chat', depth: 0, role: 'system', content: CONTENT, should_scan: false,
      }], { once: false });
      if (!handle || typeof handle.uninject !== 'function') {
        throw Error('酒馆助手提示注入未返回有效的撤销函数，Gal 对话格式未能安全启用。');
      }
      uninject = () => handle.uninject();
      activeKey = nextKey;
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      clear();
    }

    return { sync, destroy };
  }

  return Object.freeze({ ID, CONTENT, create });
});
