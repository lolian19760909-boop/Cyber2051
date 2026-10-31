'use strict';
const line = {
  schema: 1, id: 'sample_parcel', title: '隔离样例·包裹', track: 'main', summary: '核对包裹的去向。',
  nodes: [
    {id: 'P1', title: '答应调查', content: '店主提出调查请求，玩家可以决定是否参与。', conditions: {agreed: '玩家明确答应调查包裹'},
      outcomes: {refuse: {label: '玩家明确拒绝调查', effect: 'end_line'}}},
    {id: 'P2', title: '调查与取回', content: '核对寄存记录并寻找包裹持有人。', requires: ['P1'],
      gate: [{check: 'wallet', op: '>=', value: 2000}], conditions: {found: '实际找到持有人', recovered: '包裹实际回到玩家手中'},
      outcomes: {pause: {label: '玩家实际暂停调查', effect: 'pause'}, lost: {label: '包裹已经销毁', effect: 'jump', target: 'Bad'},
        branch: {label: '玩家委托同伴另外核对收据', effect: 'fork', target: 'Extra'}},
      illustrations: [{id: 'parcel', file: 'sample/parcel.webp', caption: '取回包裹', trigger: 'complete'}]},
    {id: 'Good', title: '交还包裹', content: '店主等待玩家交还已经找回的包裹。', requires: ['P2'], exclusive: 'ending', conditions: {returned: '玩家实际交还包裹'}, ending: {id: 'returned', title: '物归原主', type: 'good'}},
    {id: 'Bad', title: '说明损失', content: '玩家向店主说明包裹已经销毁。', requires: ['P2'], exclusive: 'ending', conditions: {reported: '玩家实际说明包裹已经销毁'}, ending: {id: 'lost', title: '无法挽回', type: 'bad'}},
    {id: 'Extra', title: '另外核验', content: '同伴核对另一份收据。', requires: ['Good'], conditions: {checked: '同伴实际核对收据'}}
  ]
};
const quotes = {
  agreed: '玩家当面对店主答应，会接下这件事并开始调查包裹的去向。',
  found: '玩家来到寄存处，实际找到了记录中领走包裹的那名学生。',
  recovered: '学生核对标签后，把包裹完整地交到了玩家手中。',
  returned: '玩家把取回的包裹交到店主手里，店主清点后确认收妥。',
  reported: '玩家当面告诉店主包裹已经销毁，并交出了现场的销毁记录。',
  pause: '玩家收好调查资料，决定先暂停寻找包裹，离开寄存处休息。',
  resume: '玩家重新走进寄存处，把资料放到柜台上，恢复包裹调查。',
  lost: '寄存员当面打开焚化记录，确认那件包裹已经完全销毁。',
  refuse: '玩家当面拒绝店主提出的调查请求，明确表示不会接下这件事。',
  branch: '玩家把收据复印件交给同伴，请她现在开始另外核对记录。',
  checked: '同伴已经核对收据上的编号，带回了盖章的查验记录。'
};
const state = () => ({terminal: {quests: {}, wallet: {yen: 3000, earned: 3000, spent: 0}, gameplay: {location: {mapId: 'tokyo', placeId: 'shop'}}}, future: {zero: 0, keep: false}});
const event = (node, facts, type = 'progress', outcome) => ({event: type, node, kind: 'happened', evidence: facts.map(fact => ({fact, quote: quotes[fact]})), ...(outcome ? {outcome} : {})});
const body = Object.values(quotes).join('\n');
module.exports = {line, quotes, state, event, body};
