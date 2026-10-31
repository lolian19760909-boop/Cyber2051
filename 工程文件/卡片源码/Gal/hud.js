/* Read-only HUD snapshot. Fields come from maintained worldbook 015/002/052/053.
 * Read one explicit message floor and its selected swipe; never inherit a floor.
 * scene is accepted by the host contract, but never used to guess a speaker.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CxxGalHud = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const UNKNOWN = '未记录';
  const states = new Set(['已发布', '进行中', '完成', '失败', '搁置']);
  const object = value => Object.prototype.toString.call(value) === '[object Object]';
  const own = (value, key) => object(value) && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  // 状态统一入口：业务核心把 Cxx236State 挂在父窗口。HUD 不自己认 MVU，
  // 本楼读数优先问统一入口，历史楼层仍用该楼层自己的快照。
  const liveState236 = () => {
    try {
      const api = globalThis.Cxx236State || globalThis.parent?.Cxx236State;
      return api && typeof api === 'object' ? api : null;
    } catch (_) { return null; }
  };
  const liveStat236 = () => {
    const api = liveState236();
    if (!api || typeof api.stat !== 'function') return null;
    try { const value = api.stat(); return own(value, 'terminal') ? value : null; }
    catch (_) { return null; }
  };

  function read({ messageId, characterId, history, getVariables, receipt=null } = {}) {
    const validId = Number.isInteger(messageId) && messageId >= 0;
    let scope = validId ? (history ? '历史楼层 #' : '本楼记录 #') + messageId : '楼层未确定';
    let variables;
    if (validId && typeof getVariables === 'function') {
      try { variables = getVariables({ type: 'message', message_id: messageId }); }
      catch (_) { scope += ' · 读取失败'; }
    } else if (validId) scope += ' · 状态读取不可用';

    const stat = own(variables, 'stat_data') || (history ? null : liveStat236());
    const terminal = own(stat, 'terminal');
    const quests = own(terminal, 'quests');
    const actorId=terminal?.ensemble?.control?.actorId||'player',game=actorId==='player'?terminal?.gameplay:terminal?.ensemble?.actors?.[actorId]?.gameplay;
    // 数值以数据库表为准：表里有这个角色就用表，表里没有就沿用楼层快照，不猜。
    const vitals = history ? null : (() => { const api = liveState236(); if (!api || typeof api.vitals !== 'function') return null; try { return api.vitals(actorId); } catch (_) { return null; } })();
    const yen = vitals ? vitals.yen : own(own(terminal, 'wallet'), 'yen');
    const R=typeof module==='object'&&module.exports?require('../运行时/roster.js'):globalThis.CxxRoster||globalThis.parent?.CxxRoster;
    let growth;try{growth=R?.progress(game,{receipt,actorId});}catch{}const progress=growth?(growth.required===null?'满级':growth.into+' / '+growth.required+' XP') : UNKNOWN;
    return {
      scope,
      growth: growth?{...growth,summary:growth.currentSummary}:null,
      fields: [
        { label: '钱包', value: finite(yen) ? String(yen) + ' 日元' : UNKNOWN },
        { label: '委托', value: '待更新' },
        { label: '等级 / 成长', value: growth?'LV '+growth.level+' · '+progress+(growth.required===null?'':' · 距下级 '+growth.remaining+' XP'):UNKNOWN },
        { label: 'SAN', value: finite(vitals ? vitals.sanity : game?.sanity?.value)?(vitals ? vitals.sanity : game.sanity.value)+' / 100':UNKNOWN },
      ],
      details: [
        { label: '钱包记录', items: ['yen', 'earned', 'spent'].map((key, i) => ({
          label: ['余额', '累计收入', '累计支出'][i],
          value: finite(own(own(terminal, 'wallet'), key)) ? String(terminal.wallet[key]) + ' 日元' : UNKNOWN,
        })) },
        { label: '委托记录（只读）', items: object(quests) ? Object.keys(quests).filter(id => id !== '$meta').map(id => ({
          label: id, value: states.has(own(quests[id], 'state')) ? quests[id].state : UNKNOWN,
        })) : [{ label: '委托状态', value: UNKNOWN }] },
        {label:'成长与状态',items:[{label:'属性点 / 专长点',value:growth?growth.attributePoints+' / '+growth.perkPoints:UNKNOWN},{label:'最近成果',value:growth?.lastReward?growth.lastSummary.text+' · '+(growth.lastReward.fact?.reason||growth.lastReward.award.source?.id||'已记录'):UNKNOWN},{label:'人物名册',value:'游戏菜单 → 人物表，可查看全部61人的精确数值'}]},
      ],
    };
  }

  return Object.freeze({ read });
});
