(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxIdentity=api;})(globalThis,function(){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const local=typeof module==='object'&&module.exports,L=local?require('./loadout.js'):globalThis.CxxLoadout;
  const KEY='__cxx_identity';
  const entries=Object.freeze([
    {id:'street',name:'街头小子',en:'STREET KID',cover:'548653075070d756/2051CG_RING_midnight.png',intro:'人们都说，要想了解街头的疾苦，就得在那儿过日子。黑帮、中间人、性爱机偶、不入流的毒贩子……你是吃百家饭长大的。在这里，弱肉强食，丛林法则说了算，你深谙此道。它是东京都唯一一条还没有被你打破的法则。',background:'你在 RiNG 社区吃百家饭长大，靠街头活计维持生活，熟悉帮派规矩、街头交涉与基础格斗，也了解本地音乐文化。'},
    {id:'corpo',name:'公司员工',en:'CORPORATE',cover:'49304315c92bb762/2051CG_core_morning.png',intro:'没有多少人可以活着离开公司世界，能够完整保住良心的就更少了。至少在东京都是如此。你经历过，你灵活变通，你用别人的秘密获利，情报就是你手里的武器。根本就没有所谓的公平竞争，只有成王败寇。',background:'你是在弦卷集团工作的公司职员，生活较为富裕，工作压力不小。你熟悉公司竞争与交涉，善于观察、交换和利用情报，但并非无所不知；具体掌握的秘密须由已发生剧情确认。'},
    {id:'student',name:'青年学生',en:'YOUNG STUDENT',cover:'d167b5dcb3dd4b73/2051CG_lowtown_morning.png',intro:'像大多数人玩玩乐队，和狐朋狗友闲逛，对于一个年轻人来讲再正常不过了……但起码你还有能支撑你学业的家庭。接受教育也有好处。在成长中你萌生了对诚实、正直、公平与自由这些过时的价值观的思考。在东京都，拥有这些特质的人不多，而且它们花再多的钱也买不来。',background:'你是在平民区居住、处于高中阶段的年轻学生，家庭条件能够支撑学业，偶尔也有娱乐的余裕。你了解基础网路与理化知识，喜欢音乐和朋友相聚，并在成长中思考诚实、正直、公平与自由的价值。'}
  ].map(Object.freeze));
  const attributes=Object.freeze([
    {id:'body',name:'肉体',hint:'力量、体能与承受力'},
    {id:'reflexes',name:'反应',hint:'机动、反应与动作协调'},
    {id:'intelligence',name:'智力',hint:'网络、分析与破解'},
    {id:'technical',name:'技术能力',hint:'工程、设备与义体技术'},
    {id:'cool',name:'镇定',hint:'冷静、潜行与精准行动'}
  ].map(Object.freeze));
  // Editable starting presets. Their differences are anchors, not hard-coded narrative outcomes.
  const anchors=Object.freeze({
    street:Object.freeze({body:4,reflexes:4,intelligence:3,technical:3,cool:4}),
    corpo:Object.freeze({body:3,reflexes:3,intelligence:4,technical:4,cool:4}),
    student:Object.freeze({body:3,reflexes:3,intelligence:5,technical:4,cool:3})
  });
  function initialSetup(id){
    if(id!=='custom'&&!anchors[id])throw Error('身份编号无效。');
    return {schema:1,unrestricted:id==='custom',level:1,xp:0,
      attributes:{...(anchors[id]||Object.fromEntries(attributes.map(a=>[a.id,3])))},
      attributePoints:id==='custom'?7:4,perkPoints:0};
  }
  function normalizeSetup(id,value){
    const input=(message,field,label)=>{throw Object.assign(Error(message),{code:'identity-setup-input',field,label});};
    if(!value||value.schema!==1||!value.attributes)input('请完成初始配点。','','能力配点');
    const number=(v,label,field,min=0)=>{if(typeof v!=='number'&&typeof v!=='string'||String(v).trim()==='')input('请填写'+label+'。',field,label);const n=Number(v);if(!Number.isSafeInteger(n)||n<min)input(label+'须为不小于'+min+'的整数。',field,label);return n;};
    const result={schema:1,unrestricted:id==='custom',level:number(value.level,'初始等级','level',1),xp:number(value.xp,'初始经验','xp'),attributes:{},attributePoints:number(value.attributePoints,'可用属性点','attributePoints'),perkPoints:number(value.perkPoints,'可用天赋点','perkPoints')};
    for(const a of attributes)result.attributes[a.id]=number(value.attributes[a.id],a.name,a.id);
    if(id!=='custom'){
      const base=initialSetup(id),total=Object.values(result.attributes).reduce((sum,n)=>sum+n,0)+result.attributePoints;
      if(result.level!==1||result.xp!==0||result.perkPoints!==0||total!==22||attributes.some(a=>result.attributes[a.id]<base.attributes[a.id]||result.attributes[a.id]>20))input('预设出身保留属性起点，并在4点自由配点内调整。','','能力配点');
    }
    if(value.perks&&Object.keys(value.perks).length)result.perks=structuredClone(value.perks);return result;
  }
  function snapshot(id,custom='',growthSetup,loadoutSetup){
    const entry=entries.find(e=>e.id===id);
    if(id==='custom'){
      if(typeof custom!=='string'||/<\s*\/?(?:script|iframe)|<[%]/i.test(custom))throw Object.assign(Error('出身背景只接受纯文字，也可以留空。'),{code:'identity-background-input'});
      return {schema:1,id,name:'自定义身份',background:custom.trim(),...(growthSetup===undefined?{}:{growthSetup:normalizeSetup(id,growthSetup)}),...(loadoutSetup===undefined?{}:{loadoutSetup:L.normalizeSetup(id,loadoutSetup)})};
    }
    if(!entry)throw Error('身份编号无效。');
    return {schema:1,id,name:entry.name,background:entry.background,...(growthSetup===undefined?{}:{growthSetup:normalizeSetup(id,growthSetup)}),...(loadoutSetup===undefined?{}:{loadoutSetup:L.normalizeSetup(id,loadoutSetup)})};
  }
  function valid(value){if(!(value?.schema===1&&['street','corpo','student','custom'].includes(value.id)&&typeof value.background==='string'))return false;try{if(value.growthSetup!==undefined)normalizeSetup(value.id,value.growthSetup);if(value.loadoutSetup!==undefined)L.normalizeSetup(value.id,value.loadoutSetup);return true;}catch(_){return false;}}
  function promptContext(value){
    if(!valid(value))return '';
    const publicValue={...value};delete publicValue.setupToken;delete publicValue.loadoutSetup;
    return (value.growthSetup?'当前聊天已确认出身与初始配点。初始配点属于玩家选择的开局设定，仅在首次建立成长记录时使用；之后以已保存的实际成长记录为准，不能每轮重置或重复发点。自定义出身允许超过常规初始数值，不得擅自削弱。初始装备以开局建档和当前实际存档为准，不重复领取；后续取得与改造通过正文登记：\n':'当前聊天已确认身份，属于背景资料，不赠送初始资产：\n')+JSON.stringify(publicValue);
  }
  const css=(typeof CxxIdentityStyle==='string'?CxxIdentityStyle:'');
  const setupCss='';
  return Object.freeze({KEY,entries,attributes,anchors,initialSetup,normalizeSetup,snapshot,valid,promptContext,css});
});
