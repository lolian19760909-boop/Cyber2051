/* Shared, pure inventory and cyberware rules. No DOM or host writes. */
(function(root,factory){const local=typeof module==='object'&&module.exports,api=factory(local?require('./item-definitions.js'):root.CxxItemDefinitions,local?require('./item-model.js'):root.CxxItemModel,local?require('./item-catalog-data.js'):root.CxxItemCatalog);if(local)module.exports=api;else root.CxxLoadout=api;})(globalThis,function(Definitions,M,Catalog){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const copy=v=>structuredClone(v),canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v,same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const version='2.1.1',packageId='cxx_loadout',customPackage='cxx_story_items';
  const parts={frontal:'额皮质',face:'面部／视觉',os:'操作系统',skeleton:'骨骼',hands:'手掌',arms:'臂部',nervous:'神经系统',circulatory:'循环系统',skin:'表皮系统',legs:'腿部'};
  const clothing={head:'头部',face:'面部',outer:'外套',inner:'内搭',legs:'下装',feet:'鞋',outfit:'外观着装'};
  const grades=['普通','精良','稀有','史诗','传奇'],values={weapon:[8,12,18,26,36],condition:[.03,.05,.07,.09,.12],vital:[5,8,12,17,23],ram:[1,2,3,4,5],active:[.10,.15,.20,.25,.30]};
  const templates={};
  function define(id,name,category,part,profile,tags,ability,active){templates[id]={id,name,category,part,profile,tags:tags||[],ability:ability||'',active:active||''};}
  for(const [id,name,tags] of [['pistol','普通手枪',['gun','pistol']],['revolver','左轮手枪',['gun','revolver']],['smg','冲锋枪',['gun','smg']],['rifle','突击步枪',['gun','rifle']],['shotgun','霰弹枪',['gun','shotgun']],['precision','精准步枪',['gun','precision']],['sniper','狙击步枪',['gun','sniper']],['lmg','轻机枪',['gun','lmg']],['blade','刀剑',['blade','melee']],['blunt','钝器',['blunt','melee']],['throwing','投掷武器',['throwing']]])define(id,name,'weapon','weapon','weapon',tags);
  for(const [id,name]of Object.entries(clothing))define('clothes_'+id,name,'clothing',id,'appearance',[],'改变外观，不自动增加防护。');
  define('armor_vest','防护背心','clothing','outer','hp',[],'提供躯干防护。');
  define('optics','歧路司基础义眼','cyberware','face','ability',[],'扫描、放大视野与读取可见信息。');
  define('sandevistan','斯安威斯坦','cyberware','os','active',[],'主动启用时加快感知与反应；持续及兼容情况由现场决定。','sandevistan');
  define('cyberdeck','网络接入仓','cyberware','os','ram',['cyberdeck'],'可连接与破解具备通路的设备，破解仍受现场权限和防护影响。');
  define('berserk','狂暴系统','cyberware','os','active',[],'主动启用时增强近战输出与抗压能力。','berserk');
  define('subdermal_armor','皮下护甲','cyberware','skin','hp',[],'提供身体防护。');
  define('optical_camo','光学迷彩','cyberware','skin','condition',[],'主动启用后降低可见度。','optical_camo');
  define('ballistic','弹道协处理器','cyberware','hands','gun',['gun'],'辅助枪械弹道判断。');
  define('smart_link','智能连接','cyberware','hands','smart',[],'支持兼容智能武器的连接与锁定。');
  define('memory_boost','记忆增强','cyberware','frontal','ram',[],'改善网络处理与破解续航。');
  define('ex_disk','额外磁盘','cyberware','frontal','ram',[],'扩充网络处理空间。');
  define('micro_rotors','微型转子','cyberware','skeleton','melee',[],'辅助近战动作。');
  define('bionic_joints','仿生关节','cyberware','skeleton','stamina',[],'改善承重与动作耐力。');
  define('kerenzikov','克伦齐科夫','cyberware','nervous','condition',[],'在合适的闪避与瞄准动作中短暂加速感知。','kerenzikov');
  define('blood_pump','血泵','cyberware','circulatory','ability',[],'可主动辅助急救；实际恢复由正文登记资源事件。');
  define('biomonitor','生物监测','cyberware','circulatory','ability',[],'监测身体状态，并在条件具备时协助触发救治。');
  define('tendons','强化肌腱','cyberware','legs','stamina',[],'支持二段跳与更灵活的跳跃动作。');
  define('ankles','加固踝骨','cyberware','legs','stamina',[],'支持蓄力高跳与落地稳定。');
  define('mantis','螳螂刀','cyberware','arms','weapon',['blade','melee'],'可展开臂部刀刃近战。');
  define('gorilla','大猩猩手臂','cyberware','arms','weapon',['blunt','melee'],'强化徒手打击、抓握与力量动作。');
  define('monowire','单分子线','cyberware','arms','weapon',['monowire','melee'],'可使用单分子线切割与作战。');
  define('launcher','射弹发射系统','cyberware','arms','weapon',['launcher','explosion'],'发射持有的弹药。');
  for(const [id,label]of [['pistol','手枪'],['smg','冲锋枪'],['rifle','突击步枪'],['shotgun','霰弹枪']])define('smart_'+id,'智能'+label,'weapon','weapon','weapon',['gun',id,'smart'],'兼容智能连接的锁定射击。');
  const starterWeapons=['pistol','smg','rifle','shotgun','blade','blunt','throwing'];
  const kits={street:[['optics',1],['sandevistan',2],['subdermal_armor',1],['ballistic',1]],corpo:[['optics',1],['cyberdeck',2],['optical_camo',1],['smart_link',1]],student:[['optics',1],['cyberdeck',2],['memory_boost',1],['ex_disk',1]]};
  const fail=message=>{throw Error(message);};
  function integer(n,min=0,max=1000000000){if(!Number.isSafeInteger(n)||n<min||n>max)fail('数量或品阶无效。');return n;}
  function validId(id){if(typeof id!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(id)||['constructor','prototype','__proto__'].includes(id))fail('物品编号无效。');return id;}
  function hash(text){let h=2166136261;for(const ch of text)h=Math.imul(h^ch.charCodeAt(0),16777619);return (h>>>0).toString(16);}
  function definition(input){
    if(input?.custom)return customDefinition(input);
    if(typeof input==='string'){const m=input.match(/^(.+)_t([1-5])$/);input={template:m?m[1]:input,tier:m?+m[2]:1};}
    if(!input||typeof input!=='object')fail('缺少物品资料。');
    const official=!templates[input.template]&&(Catalog?.find(input.template||input.id)||(!input.template&&input.name&&Catalog?.find(input.name)));
    if(official){const d=Catalog.definition(official.id,input.tier);if(input.name&&input.name!==d.name||input.description!==undefined&&input.description!==d.ability&&input.description!==d.description)return customDefinition({...d,id:undefined,name:input.name||d.name,description:input.description??d.ability,custom:true});return d;}
    const t=templates[input.template],tier=integer(input.tier??1,1,5),name=String(input.name||t?.name||'未分类物品').trim().slice(0,80),description=String(input.description||t?.ability||'').slice(0,2000);
    if(!t)fail('未找到已登记的型号或基础类型。');
    const custom=Boolean(input.name&&input.name!==t?.name||input.description&&input.description!==t?.ability||!t);
    const id=validId(input.id||(!custom?t.id+'_t'+tier:'story_'+hash(JSON.stringify([input.template||'',tier,name,description]))));
    const effects=[],add=(kind,value,when)=>effects.push({kind,...(value===undefined?{}:{value}),...(when?{when}:{})});
    if(t){const i=tier-1;
      if(t.profile==='weapon')add('powerFlat',values.weapon[i]);
      if(t.profile==='hp')add('hpMax',values.vital[i]);
      if(t.profile==='stamina')add('staminaMax',values.vital[i]);
      if(t.profile==='ram')add('ramMax',values.ram[i]);
      if(['gun','smart','melee','condition'].includes(t.profile))add('powerPct',values.condition[i],t.active||({gun:'gun',smart:'smart',melee:'melee',condition:t.tags[0]}[t.profile]));
      if(t.profile==='active')add('powerPct',values.active[i],t.active);
      if(t.ability)effects.push({kind:'ability',text:t.ability});
    }
    const result={id,name,description,ability:t?.ability||description,tier,template:t?.id||null,category:t?.category||'text',part:t?.part||null,tags:t?.tags||[],weapon:t?.profile==='weapon',active:t?.active||'',numericEffects:effects,load:t?.category==='cyberware'?tier*(t.part==='os'?8:t.part==='arms'?5:2):0,definitionRef:{packageId:custom?customPackage:packageId,version,kind:'items',id}};
    return custom?customDefinition(result):result;
  }
  const catalogue=()=>[...Object.keys(templates).flatMap(template=>grades.map((_,i)=>definition({template,tier:i+1}))),...(Catalog?.items||[]).flatMap(d=>grades.map((_,i)=>Catalog.definition(d.id,i+1)))];
  const oldTemplateText={"扫描、放大视野与读取可见信息；不能凭空获知秘密。": "扫描、放大视野与读取可见信息。", "主动启用后降低可见度，不保证免疫所有探测。": "主动启用后降低可见度。", "辅助枪械弹道判断，不替代实际瞄准与射击。": "辅助枪械弹道判断。", "可使用实际持有的弹药发射；不会凭空补充弹药。": "发射持有的弹药。"};
  function translateDefinition(value){const translated=Catalog?.translate(value);if(!translated||translated.custom||translated.definitionRef?.packageId!==packageId)return translated;const d=copy(translated);for(const key of ['description','ability'])if(oldTemplateText[d[key]])d[key]=oldTemplateText[d[key]];for(const e of d.numericEffects||[])if(e.kind==='ability'&&oldTemplateText[e.text])e.text=oldTemplateText[e.text];return d;}
  function get(state,id,ref){return translateDefinition(Definitions.resolve(state,id,ref,{official:key=>{try{return definition(key);}catch{return null;}}}));}
  function normalizeSetup(origin,setup={}){
    if(origin!=='custom'){const weapon=setup.weapon??'';if(weapon&&!starterWeapons.includes(weapon))fail('请选择可用的起步武器。');return {schema:1,weapon,items:[]};}
    if(!Array.isArray(setup.items||[]))fail('初始物品清单无效。');
    return {schema:1,weapon:'',items:(setup.items||[]).map(row=>{const d=definition(row),quantity=integer(Number(row.quantity??1),1),status=row.status||'inventory';if(!['inventory','equipped','installed'].includes(status))fail('请选择物品初始状态。');if(status==='installed'&&d.category!=='cyberware'||status==='equipped'&&!['weapon','clothing'].includes(d.category))fail('初始状态与物品类别不符。');return {...(d.custom?d:{}),...(row.artUpload?{artUpload:copy(row.artUpload)}:{}),template:d.template,tier:d.tier,name:d.name,description:d.description,quantity,status};})};
  }
  function base(state={}){return {...copy(state),schema:1,inventory:copy(state.inventory||{}),equipment:copy(state.equipment||{}),itemDefinitions:copy(state.itemDefinitions||{}),itemReceipts:copy(state.itemReceipts||{}),loadout:{activeWeapon:'weapon_1',active:[],...copy(state.loadout||{})}};}
  function register(state,d){const old=state.itemDefinitions[d.id];if(old&&!same(translateDefinition(old)||old,d))fail('同一物品编号不能改写已有定义。');state.itemDefinitions[d.id]=copy(d);return d;}
  const occupied=(s,id,except)=>new Set(Object.entries(s.equipment||{}).filter(([slot,r])=>slot!==except&&r?.itemId===id).map(([slot,r])=>r.instanceId||slot)).size;
  function add(state,d,quantity){integer(quantity,1);register(state,d);const old=state.inventory[d.id];if(old&&!same(old.definitionRef,d.definitionRef))fail('不同版本的物品不能混为一叠。');state.inventory[d.id]={...old,quantity:integer((old?.quantity||0)+quantity),definitionRef:copy(d.definitionRef)};}
  function slotFor(state,d){if(d.category==='cyberware'){let i=1;while(state.equipment['cyber_'+d.part+'_'+i])i++;return 'cyber_'+d.part+'_'+i;}if(d.category==='clothing')return 'wear_'+d.part;for(let i=1;i<=3;i++)if(!state.equipment['weapon_'+i])return 'weapon_'+i;fail('三个携带武器槽已满，请先替换或卸下一件。');}
  function equip(state,id,slot,source,cyber=false){const old=state.inventory[id],d=get(state,id,old?.definitionRef);if(!d||!old?.quantity)fail('没有可装配的这件物品。');if(d.category==='text')fail('文字物品尚无可装配类型。');if(d.category==='cyberware'&&!cyber)fail('义体须在正文中由具备能力的角色或设备完成改造。');slot=slot||slotFor(state,d);validId(slot);
    const matches=d.category==='weapon'?/^weapon_[123]$/.test(slot):d.category==='clothing'?slot==='wear_'+d.part:new RegExp('^cyber_'+d.part+'_\\d+$').test(slot);
    if(!matches)fail('物品与装配部位不匹配。');let instance=state.equipment[slot]?.itemId===id?state.equipment[slot].instanceId:null;
    if(occupied(state,id,slot)>=old.quantity){if(d.category==='cyberware')fail('没有额外的这一件物品。');const prior=Object.entries(state.equipment).find(([k,r])=>k!==slot&&r?.itemId===id);if(!prior)fail('没有额外的这一件物品。');instance=prior[1].instanceId;state.equipment[prior[0]]=null;if(state.loadout.activeWeapon===prior[0])state.loadout.activeWeapon=slot;}
    const used=new Set(Object.entries(state.equipment).filter(([k,r])=>k!==slot&&r).map(([,r])=>r.instanceId));if(!instance){let n=1;while(used.has('owned_'+id+'_'+n))n++;instance='owned_'+id+'_'+n;}
    state.loadout.active=(state.loadout.active||[]).filter(x=>x!==slot);
    state.equipment[slot]={itemId:id,definitionRef:copy(d.definitionRef),instanceId:instance,source:copy(source||{}),effects:{description:describe(d)}};return slot;
  }
  function initial(origin,setup){const s=base(),v=normalizeSetup(origin,setup);for(const [template,tier]of kits[origin]||[]){const d=definition({template,tier});add(s,d,1);equip(s,d.id,null,{kind:'opening'},true);}if(origin!=='custom'&&v.weapon){const d=definition(v.weapon);add(s,d,1);equip(s,d.id,'weapon_1',{kind:'opening'});}for(const row of v.items){const d=definition(row);add(s,d,row.quantity);if(row.status!=='inventory')equip(s,d.id,null,{kind:'opening'},true);}return s;}
  function list(state){const seen=new Set(),counts={};return Object.entries(state?.equipment||{}).flatMap(([slot,r])=>{if(!r?.itemId)return [];const d=get(state,r.itemId,r.definitionRef),instance=r.instanceId||slot;if(!d||seen.has(instance))return [];counts[r.itemId]=(counts[r.itemId]||0)+1;if(counts[r.itemId]>(state.inventory?.[r.itemId]?.quantity||0))return [];seen.add(instance);return [{slot,record:r,definition:d}];});}
  const isWeapon=d=>Boolean(d?.weapon||d?.category==='weapon'||d?.category==='cyberware'&&d?.part==='arms'&&(d.tags||[]).some(t=>['melee','launcher','monowire'].includes(t)));
  const restricted=(state,slot)=>Object.values(state.loadout?.policeRestrictions||{}).some(r=>r.slots?.includes(slot));
  const usable=state=>list(state).filter(x=>!restricted(state,x.slot));
  function activeSlots(state={}){const rows=usable(state);return (state.loadout?.active||[]).map(value=>rows.find(x=>x.slot===value&&x.definition.active)?.slot||rows.find(x=>x.definition.active===value)?.slot).filter(Boolean);}
  function effects(state){const active=new Set(activeSlots(state));return usable(state).filter(x=>!isWeapon(x.definition)||x.slot===(state.loadout?.activeWeapon??'weapon_1')).map(x=>({id:'equipped_'+x.slot,effects:copy(x.definition.numericEffects||[]).filter(e=>!x.definition.active||e.when!==x.definition.active||active.has(x.slot)).map(e=>x.definition.active&&e.when===x.definition.active?{...e,when:undefined}:e)}));}
  function tags(state,story=[]){const installed=usable(state).filter(x=>x.definition.category==='cyberware'),counts={};for(const x of installed)counts[x.definition.part]=(counts[x.definition.part]||0)+1;
    const active=activeSlots(state).map(slot=>installed.find(x=>x.slot===slot)?.definition.active).filter(Boolean),weaponTags=new Set(Object.values(templates).filter(t=>t.profile==='weapon').flatMap(t=>t.tags).concat('power_weapon','tech_weapon','explosives'));
    const result=new Set([...story.filter(t=>!['sandevistan','berserk','kerenzikov','optical_camo','time_slow','cyberware','cyberware_coordinated','cyberdeck','optical_camo_equipped','skeleton_pair','hands_pair','body_coverage','wide_coverage',...Object.values(state.itemDefinitions||{}).flatMap(d=>[d.active,...(d.tags||[])])].includes(t)&&!weaponTags.has(t)),...active]);for(const x of usable(state)){const d=x.definition;if(isWeapon(d)&&x.slot!==(state.loadout?.activeWeapon??'weapon_1'))continue;for(const t of d.tags||[])result.add(t);if(d.template==='optical_camo')result.add('optical_camo_equipped');}
    if(installed.length)result.add('cyberware');if(installed.length>=3)result.add('cyberware_coordinated');if((counts.skeleton||0)>=2)result.add('skeleton_pair');if((counts.hands||0)>=2)result.add('hands_pair');if((counts.skeleton||0)>=2&&(counts.skin||0)>=2)result.add('body_coverage');if(Object.keys(counts).length>=6)result.add('wide_coverage');if(result.has('sandevistan')||result.has('kerenzikov'))result.add('time_slow');return [...result];
  }
  function action(state,request){const s=base(state),source={kind:'player'};
    if(request.slot&&restricted(s,request.slot)||request.action==='active-state'&&request.slots?.some(slot=>restricted(s,slot)))fail('该义体仍受拘押限制，实际解除后才能使用或调整。');
    if(request.action==='equip')equip(s,request.id,request.slot,source,true);
    else if(request.action==='unequip'){const r=s.equipment[request.slot];if(!r)fail('该部位没有装备。');s.equipment[request.slot]=null;s.loadout.active=s.loadout.active.filter(x=>x!==request.slot);if(s.loadout.activeWeapon===request.slot)s.loadout.activeWeapon='';}
    else if(request.action==='active-state'){if(!Array.isArray(request.slots)||request.slots.some(slot=>!list(s).some(x=>x.slot===slot&&x.definition.active)))fail('主动状态必须选择已安装的义体。');s.loadout.active=[...new Set(request.slots)];}
    else if(request.action==='active-weapon'){if(request.slot&&!usable(s).some(x=>x.slot===request.slot&&isWeapon(x.definition)))fail('请选择可用的已携带武器或臂部武器。');s.loadout.activeWeapon=request.slot;}
    else fail('不支持的装配操作。');s.loadout.active=activeSlots(s);if(s.loadout.activeWeapon&&!s.equipment[s.loadout.activeWeapon])s.loadout.activeWeapon='';return s;
  }
  function preview(state,id,slot){const s=base(state);if(slot&&s.equipment[slot]?.itemId===id)return s;equip(s,id,slot,{kind:'preview'},get(s,id)?.category==='cyberware');return s;}
  const eventKinds=new Set(['item-gain','item-loss','item-equip','item-unequip','cyberware-install','cyberware-remove','equipment-state']);
  function qualityIssues(state,events){return events.filter(e=>e?.kind==='item-gain'&&!state.itemReceipts?.[e.id]).flatMap(e=>{const raw=e.item,known=e.itemId&&get(state,e.itemId)||raw?.name&&Object.values(state.itemDefinitions||{}).find(d=>d.custom&&d.name===raw.name);if(known)return [];const missing=[];if(!raw||typeof raw!=='object'||!Number.isInteger(raw.tier)||raw.tier<1||raw.tier>5)missing.push('品质');if(!raw||raw.custom||raw.numericEffects||raw.name&&!Catalog?.find(raw.name)&&!Object.values(templates).some(t=>t.name===raw.name)||!raw.name&&!templates[raw.template]&&!Catalog?.find(raw.template))missing.push('已登记的型号或玩家确认的定义');return missing.length?[{id:e.id,name:raw?.name||raw?.template||e.itemId||'待确认装备',missing,reason:e.reason}]:[];});}
  function applyEvents(state,events){let s=copy(state);for(const e of events){if(!eventKinds.has(e?.kind))continue;s=base(s);validId(e.id);if(typeof e.reason!=='string'||!e.reason.trim())fail('物品变化需要已发生的正文依据。');if(s.numeric?.receipts?.[e.id]||s.growth?.rewards?.[e.id])fail('该事件编号已用于其他结算。');if(s.itemReceipts[e.id]){if(!same(s.itemReceipts[e.id],e))fail('同一物品事件不能改变内容。');continue;}
      const source={kind:'story',id:e.id,reason:e.reason};
      if(e.kind==='item-gain'){const issues=qualityIssues(s,[e]);if(issues.length)fail('装备待确认：'+issues[0].missing.join('、')+'；本次交易未发放物品。');const raw=e.item; if(raw?.custom||raw?.numericEffects)fail('AI不能创建自定义数值定义，请由玩家确认。');if(raw?.name&&!Catalog?.find(raw.name)&&!Object.values(templates).some(t=>t.name===raw.name)&&!Object.values(s.itemDefinitions).some(d=>d.custom&&d.name===raw.name))fail('命名型号不在正式目录或玩家确认清单中。');const known=raw?.name&&Object.values(s.itemDefinitions).find(d=>d.custom&&d.name===raw.name);const official=raw?.name&&Catalog?.find(raw.name);const d=known||(official?definition({template:official.id,tier:raw.tier}):raw?definition(raw):get(s,e.itemId));if(!d)fail('缺少物品定义或基础模板。');add(s,d,e.quantity??1);}
      if(e.kind==='item-loss'){const r=s.inventory[e.itemId],q=integer(e.quantity??1,1);if(!r||r.quantity<q)fail('失去数量超过实际持有。');const remaining=r.quantity-q,slots=Object.entries(s.equipment).filter(([,x])=>x?.itemId===e.itemId);while(slots.length>remaining){const [slot,record]=slots.pop();if(get(s,e.itemId,record.definitionRef)?.category==='cyberware')fail('已安装义体须先登记实际完成的拆除。');s.equipment[slot]=null;}r.quantity=remaining;}
      if(e.kind==='item-equip'){const slot=equip(s,e.itemId,e.slot,source);if(e.active===true&&/^weapon_/.test(slot))s.loadout.activeWeapon=slot;}
      if(['cyberware-install','cyberware-remove'].includes(e.kind)&&e.completed!==true)fail('只登记本轮实际发生的装配变化。');
      if(e.kind==='cyberware-install'){const d=get(s,e.itemId,s.inventory[e.itemId]?.definitionRef);if(d?.category!=='cyberware')fail('该物品不是义体。');equip(s,e.itemId,e.slot,source,true);}
      if(['item-unequip','cyberware-remove'].includes(e.kind)){const r=s.equipment[e.slot];if(!r)fail('该部位没有已装配物品。');const cyber=get(s,r.itemId,r.definitionRef)?.category==='cyberware'||e.slot?.startsWith('cyber_');if(cyber!==(e.kind==='cyberware-remove'))fail('请按实际改造类型登记。');s.equipment[e.slot]=null;}
      if(e.kind==='equipment-state'){if(e.activeWeapon!==undefined){if(e.activeWeapon&&!usable(s).some(x=>x.slot===e.activeWeapon&&isWeapon(x.definition)))fail('当前选择不是已装配武器。');s.loadout.activeWeapon=e.activeWeapon;}if(e.active!==undefined){if(!Array.isArray(e.active))fail('主动状态应为列表。');const available=new Set(usable(s).filter(x=>x.definition.active).map(x=>x.slot));if(e.active.some(t=>!available.has(t)))fail('主动状态必须指明实际已安装的义体部位编号。');s.loadout.active=[...new Set(e.active)];}}
      s.loadout.active=activeSlots(s);if(s.loadout.activeWeapon&&!s.equipment[s.loadout.activeWeapon])s.loadout.activeWeapon='';
      s.itemReceipts[e.id]=copy(e);
    }return s;}
  function legacyDescribe(d){const names={sandevistan:'斯安威斯坦启用时',berserk:'狂暴启用时',kerenzikov:'克伦齐科夫启用时',optical_camo:'光学迷彩启用时',gun:'使用枪械时',smart:'使用智能武器时',melee:'近战时',launcher:'使用发射系统时'};return (d.numericEffects||[]).map(e=>e.kind==='ability'?e.text:({powerFlat:'作为当前武器时战力 +',powerPct:'条件战力 +',hpMax:'生命上限 +',staminaMax:'耐力上限 +',ramMax:'RAM上限 +'}[e.kind]||e.kind)+(e.kind==='powerPct'?Math.round(e.value*100)+'%':e.value)+(e.when?'（'+(names[e.when]||e.when)+'）':'')).join('；')||'仅记录物品资料，无数值加成。';}
  function describe(d){return (d.numericEffects||[]).map(M.describe).join('；')||'仅记录资料，无数值效果。';}
  function playerDescription(d){const text=String(d?.description||d?.ability||'');return !d?.custom&&d?.adaptation?text.replace(d.adaptation,'').trim():text;}
  function context(state={},mention=''){const rows=list(state),cyber=rows.filter(x=>x.definition.category==='cyberware'),active=new Set(activeSlots(state)),equipped=new Set(rows.map(x=>x.definition.id));const related=Object.entries(state.inventory||{}).filter(([,v])=>v?.quantity).map(([id,v])=>get(state,id,v.definitionRef)).filter(d=>d?.custom&&!equipped.has(d.id));return '【当前分支已保存装配，优先于旧正文】\n'+(cyber.length?'已安装义体：'+cyber.map(x=>x.definition.name).join('、'):'当前没有已装配义体')+'。\n当前武器：'+(rows.find(x=>x.slot===state.loadout?.activeWeapon)?.definition.name||'未选择')+'。\n'+rows.map(x=>x.slot+' '+x.definition.name+(restricted(state,x.slot)?'〔拘押限制中，效果停用〕':active.has(x.slot)?'〔已启用〕':'')+'：'+(x.definition.custom?playerDescription(x.definition)+'；':'')+describe(x.definition)).join('\n')+(related.length?'\n本轮带入的自定义持有物品：'+related.map(d=>d.name+'（'+d.category+'）：'+playerDescription(d)+'；'+describe(d)).join('\n'):'')+'\n玩家可以自由装卸已拥有物品。重复描述已有物品不算获得或重新安装；旧正文不构成恢复已卸下装备的依据。';}
  function protocol(state={}){return [
    '【物品登记】只在 numericInput 事件数组 写本轮真正发生的变化，id稳定且带reason；技术重试使用相同id。重复描述已有物品不算获得或重新安装。玩家装配保存优先，禁止用旧正文覆盖。',
    '获得：{id,kind:"item-gain",itemId:"正式目录编号_t1到_t5",quantity:1,reason}。必须保留明确品质和型号；最好的枪结合当时商品及报价，缺失信息不要猜为一级。普通无专名枪械、衣物可用item:{template:"基础类型",tier:1}；命名型号必须匹配正式目录或玩家确认的自定义定义。不得自行生成numericEffects。',
    '失去：{id,kind:"item-loss",itemId,quantity,reason}。装配：item-equip {itemId,slot} 或 cyberware-install {itemId,slot,completed:true}。卸下：item-unequip {slot} 或 cyberware-remove {slot,completed:true}。均带id和reason，只登记本轮已发生变化。',
    '状态：{id,kind:"equipment-state",activeWeapon:"slot或空字符串",active:["实际开启的义体slot"],reason}。无变化不填。战斗数值由程序结算，MVU不能重复登记本轮生命、耐力或RAM增减，不能用encounter开启或结束战斗。',
    '基础类型：'+Object.values(templates).map(t=>t.id+'='+t.name).join('；'),
    '当前持有：'+JSON.stringify(Object.entries(state.inventory||{}).filter(([,v])=>v?.quantity).map(([id,v])=>({id,quantity:v.quantity,name:get(state,id,v.definitionRef)?.name,category:get(state,id,v.definitionRef)?.category})))].join('\n');}
  Definitions?.registerOfficial(definition);
  function customDefinition(input){const d=M.draft(input),id=validId(input.id||'custom_'+hash(JSON.stringify(d)));const unknown=copy(input);for(const k of ['artUpload','quantity','status','definitionRef','id','ability','load'])delete unknown[k];for(const k of Object.keys(unknown))if(unknown[k]===undefined)delete unknown[k];return {...unknown,...d,id,template:input.template||null,ability:d.numericEffects.filter(e=>e.kind==='ability').map(e=>e.text).join('；'),load:d.category==='cyberware'?d.tier*2:0,definitionRef:{packageId:'cxx_custom_items',version:'2.1.12',kind:'items',id}};}
  const stamp=s=>JSON.stringify(canonical({inventory:s.inventory||{},equipment:s.equipment||{},loadout:s.loadout||{},itemDefinitions:s.itemDefinitions||{}}));
  function saveDraft(state,request){if(request.id&&state.loadout?.lastSave?.id===request.id){if(state.loadout.lastSave.operations!==JSON.stringify(request.operations))fail('同一保存请求内容不可改变。');return copy(state);}if(request.expected!==stamp(state))fail('装配或持有物品已变化，草稿已保留。请重新读取后再应用。');let s=base(state);for(const op of request.operations||[])s=action(s,op);s.loadout.revision=(s.loadout.revision||0)+1;s.loadout.lastSave={id:request.id,operations:JSON.stringify(request.operations)};return s;}
  function editCustom(state,request){let s=base(state);if(s.itemReceipts?.[request.newId]?.kind==='custom-edit'){if(!same(s.itemReceipts[request.newId].definition,request.definition))fail('同一编辑请求不可改变。');return s;}const old=get(s,request.id),r=s.inventory[request.id];if(!(old?.custom||old?.definitionRef?.packageId===customPackage)||!r?.quantity)fail('请选择已确认的自定义物品。');if(request.expected!==stamp(state))fail('物品记录已经变化，请重新打开编辑。');const d=customDefinition({...old,...request.definition,appearance:request.definition.appearance,id:request.newId});if(d.id===old.id)fail('编辑需要新的定义编号。');const slot=request.slot;if(slot&&s.equipment[slot]?.itemId!==old.id)fail('所选实物已经改变。');if(!slot&&occupied(s,old.id)>=r.quantity)fail('请从已装配槽选择要编辑的那一件。');if(slot&&(d.category!==old.category||d.part!==old.part))fail('已装配实物变更类别或部位前，请先卸下。');r.quantity--;add(s,d,1);s.itemReceipts[d.id]={kind:'custom-edit',definition:copy(request.definition)};if(slot){const prior=s.equipment[slot];s.equipment[slot]={...prior,itemId:d.id,definitionRef:copy(d.definitionRef)};if(!d.active)s.loadout.active=s.loadout.active.filter(x=>x!==slot);}return s;}
  return {qualityIssues,version,parts,clothing,grades,values,templates,starterWeapons,kits,eventKinds,definition,catalogue,get,normalizeSetup,initial,base,list,restricted,isWeapon,activeSlots,effects,tags,action,preview,applyEvents,describe,playerDescription,context,protocol,hash,customDefinition,stamp,saveDraft,editCustom,model:M,official:Catalog};
});
