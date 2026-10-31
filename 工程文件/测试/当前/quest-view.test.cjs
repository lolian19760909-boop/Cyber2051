const {test}=require('node:test'),assert=require('node:assert/strict'),View=require('../../卡片源码/运行时/quest-view.js');
const defs=[{id:'q_chip_night',title:'盗芯之夜',track:'main',goal:'共同行动'},{id:'q_heist',title:'旧版盗芯'},{id:'q01',title:'零件采购',goal:'交付零件'},{id:'secret',title:'未发现任务',hidden:true}];
test('visible catalog preserves hidden and legacy chapter rules without creating state',()=>{
 const stat={terminal:{quests:{},wallet:{yen:0}}},before=structuredClone(stat),p=View.project(stat,defs);
 assert.deepEqual(p.items.map(q=>q.id),['q_chip_night','q01']);assert.equal(p.tracked,null);assert.equal(View.display(p,'title'),'尚未选择追踪任务');assert.deepEqual(stat,before);
});
test('tracked state and objective are projections of saved values; results cannot mutate originals',()=>{
 const stat={terminal:{quests:{q01:{state:'进行中',objective:'已取货，返回诊所',unknown:7}},questJournal:{tracked:'q01',revision:4}}},before=structuredClone(stat);
 const p=View.project(stat,defs,{chatId:'a',floor:8,swipe:1,questContext:'private-text'});
 assert.equal(View.display(p,'title'),'零件采购');assert.equal(View.display(p,'objective'),'已取货，返回诊所');assert.equal(p.revision,4);assert.deepEqual(p.source,{chatId:'a',floor:8,swipe:1});
 p.tracked.record.unknown=9;p.tracked.definition.title='changed';assert.deepEqual(stat,before);assert.equal(defs[2].title,'零件采购');
});
test('missing package retains legacy task; discovered and already started old chapter stay visible',()=>{
 const stat={terminal:{quests:{lost:{title:'遗失的包',state:'完成',objective:'旧目标'},secret:{state:'进行中',discovered:true},q_heist:{state:'已接取'},$meta:{keep:true}},questJournal:{tracked:'lost'}}};
 const p=View.project(stat,defs);assert.deepEqual(p.items.map(q=>q.id),['q_chip_night','q_heist','q01','secret','lost']);assert.equal(p.tracked.legacy,true);assert.equal(View.display(p,'state'),'完成');assert.equal(View.display(p,'objective'),'旧目标');
});
test('switching tracking and unavailable references do not invent or settle tasks',()=>{
 const stat={terminal:{quests:{q01:{state:'完成',paidYen:0,settled:false}},questJournal:{tracked:'q01'},wallet:{yen:0}}};
 assert.equal(View.project(stat,defs).tracked.state,'完成');stat.terminal.questJournal.tracked='not-visible';assert.equal(View.display(View.project(stat,defs),'title'),'追踪记录暂不可见');
 assert.equal(stat.terminal.wallet.yen,0);assert.equal(stat.terminal.quests.q01.settled,false);assert.throws(()=>View.display(View.project(stat,defs),'pay'));
});
