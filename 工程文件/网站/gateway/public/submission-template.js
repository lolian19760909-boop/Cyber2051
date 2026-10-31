(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxSubmissionTemplate = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  // 投稿写作格式独立于包 format；同一份栏目供网页、校验、成稿及审核使用。
  const version = 1;
  const f = (name, label, required, max, help, example, suggested, input = 'textarea') =>
    ({ name, label, required, max, help, example, suggested, input });
  const templates = [
    { id: 'npc', type: 'character', title: ['NPC 人物', 'NPC character', 'NPC 人物'], format: 2, fields: [
      f('name', ['姓名', 'Name', '名前'], true, 60, '填写人物通常使用的姓名。', '林澈', '一个姓名', 'input'),
      f('identity', ['身份与活动范围', 'Role and usual locations', '身分と活動範囲'], true, 500, '说明靠什么生活、在什么地方活动。', '他在广场周边接零散维修活，通常傍晚收工。', '1—3句'),
      f('appearance', ['外貌识别特征', 'Recognizable appearance', '外見の特徴'], true, 400, '写出相遇时能识别的具体特征。', '短发，灰色工装袖口有焊痕，总背着旧工具包。', '1—3句'),
      f('personality', ['性格与行为动机', 'Personality and motivation', '性格と動機'], true, 650, '用具体行为说明性格，以及他为什么这样做。', '他习惯先报价再动手，因为过去替人垫过钱；遇到急修会先确认对方是否安全。', '2—5句'),
      f('background', ['关键经历', 'Key experiences', '主な経歴'], true, 1000, '选择能解释当前处境的经历，不把未发生的剧情写成过去。', '他曾在维修铺做学徒，店铺停业后开始独自接活。', '1—3段'),
      f('speech', ['说话习惯', 'Speech style', '話し方'], true, 400, '说明语气、措辞和交流习惯。', '他讲话简短，解释故障时喜欢拿日用品打比方，不熟时称对方为客人。', '1—3句'),
      f('skills', ['能力及局限', 'Abilities and limits', '能力と限界'], true, 500, '写清能做什么、做不到什么；不声明自动获得的游戏技能或数值。', '他能处理常见民用设备故障，但没有破解企业加密终端的本领。', '2—4句'),
      f('boundaries', ['知情范围与行为边界', 'Knowledge and behavior limits', '知識と行動の範囲'], true, 700, '说明信息来源、不能预知的事及不会轻易做的事。', '他只知道亲历的维修纠纷，不掌握主角的秘密；没有证据时不会替陌生人指认嫌疑人。', '2—5句'),
      f('aliases', ['别名与年龄', 'Aliases and age', '別名と年齢'], false, 100, '只填写已经确定的资料。', '同行叫他小林，28岁。', '1句', 'input'),
      f('habits', ['爱好与日常习惯', 'Interests and habits', '趣味と習慣'], false, 250, '写能自然进入互动的生活细节。', '收工后喜欢听旧收音机，修东西时会把螺丝按大小排好。', '1—3句'),
      f('relationships', ['具体人际关系', 'Relationships', '人間関係'], false, 700, '分别说明与谁相识、如何相识、目前关系；不要替基础人物添加未确认的亲密关系。', '他与邻近摊主互相照看工具，和第一次遇见的玩家尚不熟悉。', '每段一段关系'),
      f('dialogue', ['简短对话示例', 'Dialogue example', '会話例'], false, 350, '只示范人物语气，不固定玩家的回答。', '“先别通电，我看看线。能修我就报个价，不能修也不耽误你找别人。”', '1—3句'),
    ] },
    { id: 'user_identity', type: 'user_identity', title: ['玩家人设', 'Player background', 'プレイヤーの背景'], format: 2, fields: [
      f('identity', ['出身名称', 'Background name', '出自名'], true, 60, '用简短名称概括可选择的出身。', '街区维修学徒', '一个名称', 'input'),
      f('social', ['社会身份与生活处境', 'Social role and circumstances', '身分と生活状況'], true, 650, '说明谋生方式、生活条件及与社会的关系。', '玩家靠维修杂活维持生活，收入不稳定，熟悉附近普通人的日常。', '2—4句'),
      f('background', ['背景经历', 'Background history', '経歴'], true, 1400, '只确定这份出身必要的过去，给玩家留出自定义空间。', '玩家曾跟随街区师傅学习维修，最近开始独立接活；家庭细节由玩家自行补充。', '1—3段'),
      f('skills', ['能力与局限', 'Abilities and limits', '能力と限界'], true, 700, '说明常识和经验，不预设金钱、道具或额外技能到账。', '熟悉基础电路和工具使用，缺乏军用设备知识，也不能凭空破解加密系统。', '2—4句'),
      f('startingPoint', ['进入故事的起点', 'Starting situation', '物語の始点'], true, 700, '说明为何来到选定地点、眼下可做什么，不替玩家做决定。', '玩家带着修好的设备来到广场等候取件，可以等候、联系委托人或观察周围。', '1—2段'),
      f('opening', ['通用开场正文', 'Opening scene', '導入本文'], true, 4000, '写眼前情境与行动余地，不规定玩家台词、情绪或必选行为。', '傍晚的广场仍然嘈杂。工具包旁放着修好的设备，约定的取件人还没有出现。终端亮起一条询问到达位置的消息。', '2—5段'),
      f('appearance', ['外貌建议', 'Optional appearance', '外見の提案'], false, 500, '注明这是可调整的建议，避免锁死玩家外形。', '可穿便于工作的旧外套，具体样貌由玩家决定。', '1—3句'),
      f('relationships', ['已有关系', 'Existing relationships', '既存の関係'], false, 600, '仅写这份背景必要的社会联系。', '与教过自己的师傅仍有联系，其他关系由玩家补充。', '1—3句'),
      f('goals', ['个人目标', 'Possible goals', '目標の候補'], false, 400, '给出可选方向，不当作玩家已经决定的目标。', '可以考虑开一家维修铺，也可以继续接零活。', '1—3句'),
      f('notes', ['其他背景细节', 'Other background notes', 'その他の背景'], false, 500, '补充前面没有涵盖、且确实影响扮演的事实。', '工具来自多年积攒，具体财产仍以开局实际记录为准。', '1—3句'),
    ] },
    { id: 'contract', type: 'contract', title: ['任务委托', 'Quest contract', '任務依頼'], format: 1, fields: [
      f('fixer', ['委托人', 'Issuer', '依頼人'], true, 200, '写发布人或中间人的姓名与身份。', '临时寄存摊的值班员', '一个称呼', 'input'),
      f('brief', ['起因与简报', 'Cause and brief', '発端と概要'], true, 2400, '交代谁遇到了什么问题、为何需要玩家介入。', '一件寄存包裹被取错，值班员想在失主回来前找回它。', '1—3段'),
      f('goal', ['行动目标及完成条件', 'Objective and completion', '目的と完了条件'], true, 2000, '明确对象、交付地点与怎样算完成；允许不同解决方法。', '找到误取包裹的人，将包裹归还值班员，并核对寄存单。', '1—3句'),
      f('risk', ['主要阻碍与风险', 'Obstacles and risks', '障害と危険'], true, 1500, '说明阻碍如何发生；低风险委托也应写清实际困难。', '误取者担心被讹诈，可能拒绝交谈；只凭外观无法确认包裹归属。', '2—4句'),
      f('outcome', ['成功、失败或放弃后的承接', 'Success, failure or withdrawal', '成功・失敗・辞退の続き'], true, 800, '分别交代合理收尾，不强制成功或自动发奖。', '成功：核对后交还包裹。失败：告知值班员现有线索。放弃：值班员另找人帮忙。报酬仍按实际完成情况结算。', '三种情况各1句'),
      f('fixerNote', ['委托人备注', 'Issuer notes', '依頼人の補足'], false, 400, '补充联系或见面方式。', '值班员通常在寄存摊等候。', '1—2句'),
      f('deadline', ['期限', 'Deadline', '期限'], false, 200, '没有期限可以留空；不要写不可执行的自动倒计时。', '失主今晚取件前；迟到后可以继续追查，但需重新协商。', '1—2句'),
      f('terms', ['特殊要求', 'Special requirements', '特別条件'], false, 450, '写具体要求，不重复行动目标。', '不要拆开包裹，也不要冒充失主。', '1—3句'),
      f('payNote', ['报酬说明', 'Payment notes', '報酬の説明'], false, 400, '说明付款条件，不把报酬写成已到账。', '交还并核对后支付；没有交付则没有基础报酬。', '1—3句'),
      f('bonus', ['额外奖励条件', 'Bonus conditions', '追加報酬の条件'], false, 500, '使用现有奖励规则，写明达成条件和金额或比例。', '无额外奖励。', '1—3句'),
      f('unlock', ['解锁说明', 'Availability notes', '解放条件の説明'], false, 500, '描述适用情境；真正前置任务在下方选择。', '适合刚来到广场的玩家，不要求既有关系。', '1—3句'),
      f('clues', ['额外线索与不同处理方式', 'Clues and approaches', '手掛かりと別の方法'], false, 900, '提供可用线索和选择，不规定唯一通关路线。', '可询问周围摊主，也可请值班员出示寄存单，让误取者自行核对。', '1—3段'),
    ] },
  ];
  const byKind = id => templates.find(t => t.id === id);
  const kindOf = (type, payload = {}) => payload.templateKind || (type === 'character' ? 'npc' : type);
  const isOpen = (type, payload = {}) => Boolean(byKind(kindOf(type, payload))?.type === type);
  const value = x => typeof x === 'string' ? x.trim() : '';
  function sectionsText(kind, sections, names) {
    const form = byKind(kind);
    return form.fields.filter(f => (!names || names.includes(f.name)) && value(sections[f.name]))
      .map(f => '【' + f.label[0] + '】\n' + value(sections[f.name])).join('\n\n');
  }
  function toLegacy(type, payload) {
    if (payload.templateVersion !== version) return JSON.parse(JSON.stringify(payload));
    const s = payload.sections, kind = kindOf(type, payload);
    if (kind === 'contract') {
      const q = { ...payload.contract };
      for (const key of ['fixer','goal','risk','fixerNote','deadline','payNote','bonus','unlock']) if (value(s[key])) q[key] = value(s[key]);
      q.brief = sectionsText(kind, s, ['brief','fixerNote','deadline','payNote','clues']);
      q.terms = sectionsText(kind, s, ['terms','outcome']);
      return { format: 1, templateKind: 'contract', contract: q };
    }
    const p = { format: 2, templateKind: kind, mapId: payload.mapId, placeId: payload.placeId, keywords: payload.keywords };
    if (kind === 'npc') return { ...p, name: value(s.name), identity: value(s.identity),
      background: sectionsText(kind, s, ['appearance','personality','background','speech','skills','aliases','habits','dialogue']),
      relationships: value(s.relationships), boundaries: value(s.boundaries), ...(payload.media ? { media: payload.media } : {}) };
    return { ...p, identity: value(s.identity), background: sectionsText(kind, s, ['social','background','startingPoint','relationships','goals','notes']),
      opening: value(s.opening), appearance: value(s.appearance), skills: value(s.skills) };
  }
  function upgradeLegacy(type, payload) {
    if (payload.templateVersion === version) return JSON.parse(JSON.stringify(payload));
    const kind = kindOf(type, payload), form = byKind(kind);
    if (!form || form.type !== type) return null;
    const source = payload.contract || payload, sections = {};
    for (const field of form.fields) if (typeof source[field.name] === 'string') sections[field.name] = source[field.name];
    // 不猜测缺栏、不拆解任意旧正文；原稿始终在详情中可查看和导出。
    const out = { format: form.format, templateVersion: version, templateKind: kind, sections };
    if (kind === 'contract') out.contract = Object.fromEntries(['mapId','placeId','type','difficulty','pay','prerequisites'].filter(k => source[k] !== undefined).map(k => [k,source[k]]));
    else Object.assign(out, { mapId: source.mapId, placeId: source.placeId, keywords: source.keywords || [] }, source.media ? {media:source.media} : {});
    return out;
  }
  // 与现行 controller.questEntry 的可见正文一致；不改变卡内结算。
  function questText(q) {
    return ['任务编号：' + q.id, '任务名称：' + q.title, '委托人：' + q.fixer,
      '地点：' + q.district, '简报：' + q.brief, '目标：' + q.goal, '报酬：' + q.pay + '日元',
      ...['terms','risk','bonus','unlock'].filter(k => q[k]).map(k => ({terms:'条款：',risk:'风险：',bonus:'加成：',unlock:'解锁条件：'}[k]) + q[k]),
      '仅在玩家接取后推进。既有任务状态和账目按原委托系统处理，不因安装内容包自动接单、结算或改写历史。'].join('\n');
  }
  return { version, templates, byKind, kindOf, isOpen, sectionsText, toLegacy, upgradeLegacy, questText };
});
