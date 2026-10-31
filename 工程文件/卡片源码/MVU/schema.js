/* Card schema: parsing returns a copy; callers choose when normalized values may be committed. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const value=factory(root,local?require("../运行时/numeric-host.js"):root.CxxNumericHost);if(local)module.exports=value;else root.Cxx236Schema=value;})(globalThis,function(root,N){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const characters=['高松灯','千早爱音','长崎素世','椎名立希','要乐奈','丰川祥子','三角初华','若叶睦','八幡海铃','祐天寺若麦'];
 const Q=typeof module==='object'&&module.exports?require('../运行时/quests.js'):root.CxxQuests;
 const civic=()=>typeof module==='object'&&module.exports?require('../运行时/civic.js'):root.CxxCivic||root.parent?.CxxCivic;
 const actors=()=>typeof module==='object'&&module.exports?require('../运行时/ensemble-state.js'):root.CxxEnsembleState;
 const states=Q.states,ranks=['','无损交付','不惊动','人赃并获','无痕','账本到手','人证','完璧','零损伤'];
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),clone=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const numberInput=v=>typeof v==='string'&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v.trim())?Number(v.trim()):v;
 const own=(v,k)=>object(v)&&Object.hasOwn(v,k),get=(v,path)=>path.reduce((v,k)=>own(v,k)?v[k]:undefined,v);
 function pathOf(path){if(typeof path!=='string'||!path.startsWith('/')||path==='/'||/~(?![01])/u.test(path))throw Error('变量路径格式不正确。');const parts=path.slice(1).split('/').map(p=>p.replace(/~1/g,'/').replace(/~0/g,'~'));if(parts.some(p=>!p||['__proto__','constructor','prototype','$meta','$internal'].includes(p)))throw Error('该路径不是可更新的状态。');return parts;}
 function build(z,{talents:T=root.CxxTalents}={}){
  if(typeof z?.object!=='function'||typeof z?.preprocess!=='function')throw Error('变量校验库 Zod 尚未就绪。');
  const loose=shape=>typeof z.looseObject==='function'?z.looseObject(shape):z.object(shape).passthrough(),optional=shape=>Object.fromEntries(Object.entries(shape).map(([k,v])=>[k,v.optional()]));
  const numeric=(min,max,integer=false)=>z.preprocess(numberInput,integer?z.number().int().min(min).max(max):z.number().min(min).max(max));
  const money=numeric(0,Number.MAX_SAFE_INTEGER,true),amount=numeric(0,1000000000,true),id=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/),text=z.string();
  const ref=loose({packageId:id,version:text,kind:z.enum(['slots','resources','items','blueprints','recipes','skills','shops','services','encounters','starts']),id});
  const questRef=loose({packageId:id,version:text,questId:id});
  const effects=loose(optional({resources:z.record(id,numeric(-1000000000,1000000000,true)),description:text}));
  const inventory=loose({quantity:amount,definitionRef:ref}),blueprint=loose({owned:z.boolean(),learned:z.boolean(),definitionRef:ref});
  const skill=loose({owned:z.boolean(),learned:z.boolean(),active:z.boolean(),definitionRef:ref,effects:effects.optional()});
  const equipment=loose({itemId:id,definitionRef:ref,effects:effects.optional()}).nullable(),event=loose({status:z.enum(['completed','refused']),outcomeId:id,definitionRef:ref});
  const result=loose({requestHash:text,status:z.enum(['success','refused']),reason:text.optional()});
  const table=entry=>loose({$meta:z.unknown().optional()}).catchall(entry).superRefine((v,ctx)=>{for(const key of Object.keys(v))if(key!=='$meta'&&!id.safeParse(key).success)ctx.addIssue({code:'custom',path:[key],message:'记录编号格式错误'});});
  const location=loose({mapId:text,placeId:text}),story=loose(optional({eraId:text,eraName:text}));
  const origin=loose(optional({identityId:id,name:text,body:text,eraId:text,eraName:text,manifestVersion:text,initialState:loose({story:story.optional()}),timelineEvents:z.array(z.unknown()),definitionRef:ref}));
  const balance=numeric(-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,true),wallet=loose({id:z.literal('wallet').optional(),yen:balance,earned:money,spent:money});
  const quest=loose({id:id.optional(),ownerActorId:id.optional(),state:z.enum(states),rank:z.string().max(100).optional(),objective:z.string().max(2000).optional(),knownFacts:z.string().max(8000).optional(),agreedYen:money.optional(),paidYen:money.optional(),refundedYen:money.optional(),settled:z.boolean().optional(),deadlineAt:z.string().max(100).optional(),acceptedFloor:money.optional(),definitionRef:questRef.optional()});
  const gameplay=loose(optional({schema:z.literal(1),inventory:table(inventory),blueprints:table(blueprint),skills:table(skill),equipment:table(equipment),resources:table(numeric(-1000000000,1000000000,true)),events:table(event),results:table(result),location,origin}));
  const opening=loose(optional({schemaVersion:z.literal(1),token:text,scopeHash:text,manifestVersion:text,confirmedFloor:money,initialState:z.unknown(),timelineEvents:z.array(z.unknown())}));
  const net=loose(optional({schemaVersion:z.literal(1),updatedAt:text,scopeHash:text,sourceFloor:numeric(-1,Number.MAX_SAFE_INTEGER,true),news:z.array(text),threads:z.array(text)}));
  const terminal=loose(optional({wallet,quests:table(quest),gameplay,opening,net}));
  const stat=loose({terminal:terminal.optional()});
  function parse(schema,value,label){const result=schema.safeParse(value);if(!result.success)throw Error(label+'：'+result.error.issues.map(i=>i.path.join('.')+' '+i.message).slice(0,2).join('；'));return result.data;}
  function audit(value){const result=stat.safeParse(value);return result.success?[]:result.error.issues.map(i=>({path:'/'+i.path.join('/'),message:i.message}));}
  function field(parts,before,policy){
   if(policy.civicTransaction?.changes.some(c=>same(c.path,parts)))return {schema:z.unknown(),kind:'civic',add:true};
   if(policy.numericTransaction?.changes.some(c=>same(c.path,parts)))return {schema:z.unknown(),kind:'numeric',add:true};
   if(policy.questTransaction?.changes.some(c=>same(c.path,parts)))return {schema:z.unknown(),kind:'questMeta',add:true};
   if(parts[0]==='terminal'&&parts[1]==='ensemble'&&parts[2]==='actors'&&id.safeParse(parts[3]).success){
    const A=actors();if(!A||A.address(before,parts[3]).record.stateRef.kind!=='actor')throw Error('人物状态关联无效。');
    if(parts.length===6&&parts[4]==='wallet'&&['yen','earned','spent'].includes(parts[5]))return {schema:parts[5]==='yen'?balance:money,kind:'actorWallet',actorId:parts[3]};
    if(parts[4]==='gameplay'&&parts[5]==='location'&&(parts.length===6||parts.length===7&&['mapId','placeId'].includes(parts[6])))return {schema:parts.length===6?location:text,kind:'actorLocation',actorId:parts[3],add:true};
   }
   if(parts.length===3&&parts[0]==='terminal'&&parts[1]==='wallet'&&['yen','earned','spent'].includes(parts[2]))return {schema:parts[2]==='yen'?balance:money,kind:'wallet'};
   if(parts.length===4&&parts[0]==='terminal'&&parts[1]==='quests'&&Q.leaves.includes(parts[3])){
    const record=before.terminal?.quests?.[parts[2]];if(!record||!policy.questRegistered(parts[2],record))throw Error('委托尚未接取或编号未登记：'+parts[2]);
    return {schema:parts[3]==='state'?z.enum(states):['agreedYen','paidYen','refundedYen'].includes(parts[3])?money:parts[3]==='settled'?z.boolean():parts[3]==='chapter'?z.unknown():z.string().max(parts[3]==='knownFacts'?8000:2000),kind:'quest',id:parts[2],add:parts[3]!=='state'};
   }
   if(parts[0]==='terminal'&&parts[1]==='gameplay'&&parts[2]==='location'&&(parts.length===3||parts.length===4&&['mapId','placeId'].includes(parts[3])))return {schema:parts.length===3?location:text,kind:'location',add:true};
   if(T&&parts[0]==='terminal'&&parts[1]==='gameplay'){
    if(parts.length===2&&!before.terminal?.gameplay)return {schema:z.unknown(),kind:'growth',add:true};
    if(parts[2]==='growth'){
     const whole=parts.length===3,numeric=parts.length===4&&['level','xp','attributePoints','perkPoints'].includes(parts[3]);
     const reward=parts.length===5&&parts[3]==='rewards'&&id.safeParse(parts[4]).success;
     const allocation=policy.growthAction&&parts.length===5&&['attributes','perks'].includes(parts[3]);
     if(whole||numeric||reward||allocation)return {schema:numeric?money:z.unknown(),kind:'growth',add:true};
    }
    if(parts[2]==='results'&&parts.length===4&&parts[3]===policy.growthAction?.id)return {schema:result,kind:'growth',add:true};
   }
   throw Error('该字段由程序维护或尚未开放：/'+parts.join('/'));
  }
  function prepare(patches,before,policy={}){
   if(!Array.isArray(patches))throw Error('变量更新必须是数组。');
   for(const p of patches){if(!object(p)||!['replace','add'].includes(p.op)||!own(p,'value')||Object.keys(p).some(k=>!['op','path','value'].includes(k)))throw Error('本卡只接受 replace 和限定字段的 add。');pathOf(p.path);}
   // Older replies may still contain retired relationship updates. Keep their saved values untouched.
   const ignored=patches.filter(p=>{const parts=pathOf(p.path);return parts.length===2&&characters.includes(parts[0])&&parts[1]==='好感度';});
   patches=patches.filter(p=>!ignored.includes(p));
   const civicTransaction=civic()?.prepare(before,patches,policy);
   if(civicTransaction){patches=civicTransaction.patches;policy={...policy,civicTransaction,numericOptions:{...policy.numericOptions,custodyRestrictions:civicTransaction.custody}};}
   let numericTransaction=N?.prepare(before,patches,policy,T);
   if(numericTransaction){patches=numericTransaction.patches;policy={...policy,numericTransaction};}
   const questTransaction=Q.prepare(before,patches,policy);if(questTransaction){patches=questTransaction.patches;policy={...policy,questTransaction};}
   if(numericTransaction?.roster&&questTransaction){const R=typeof module==='object'&&module.exports?require('../运行时/roster.js'):root.CxxRoster;numericTransaction=R.questRewards(before,numericTransaction,questTransaction,policy);patches=questTransaction.patches;policy={...policy,numericTransaction};}
   patches=civic()?.linkCorrection(before,patches,policy)||patches;
   const expected=new Map(),touched=new Map();
   for(const patch of patches){
    if(!object(patch)||!['replace','add'].includes(patch.op)||!own(patch,'value')||Object.keys(patch).some(k=>!['op','path','value'].includes(k)))throw Error('本卡只接受 replace 和限定字段的 add。');
    const parts=pathOf(patch.path),spec=field(parts,before,policy),old=get(before,parts),parent=get(before,parts.slice(0,-1));
    if(patch.op==='replace'&&old===undefined)throw Error('replace 路径不存在：'+patch.path);
    if(patch.op==='add'&&(!spec.add||old!==undefined||!object(parent)))throw Error('add 仅补充已登记的缺失字段：'+patch.path);
    if(['location','actorLocation'].includes(spec.kind)&&parts.at(-1)==='location'&&(old!==undefined||!object(patch.value)||Object.keys(patch.value).some(k=>!['mapId','placeId'].includes(k))))throw Error('已有地点只逐项改 mapId/placeId，新地点只允许这两个字段。');
    const value=parse(spec.schema,patch.value,patch.path);
    if(spec.kind==='quest'){
     const record=before.terminal.quests[spec.id];parse(quest,record,'委托 '+spec.id);

    }
    expected.set(patch.path,{parts,value});touched.set(patch.path,{...spec,parts});
   }
   // Normalize only submitted values. The MVU executor remains the sole state writer.
   return {ignored,patches:patches.map(p=>({...p,value:parse(field(pathOf(p.path),before,policy).schema,p.value,p.path)})),expected,touched,policy};
  }
  function check(transaction,before,after){
   for(const [path,{parts,value}]of transaction.expected)if(!same(get(after,parts),value))throw Error('MVU 未完整执行本批更新：'+path);
   const allowed=[...transaction.expected.values()].map(x=>x.parts);
   function unchanged(a,b,path=[]){if(allowed.some(p=>same(path,p)))return;if(same(a,b))return;if(!object(a)||!object(b))throw Error('本批改动包含未登记字段：/'+path.join('/'));for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(key!=='$internal'||path.length!==0)unchanged(a[key],b[key],[...path,key]);}unchanged(before,after);
   const kinds=new Set([...transaction.touched.values()].map(x=>x.kind));
   if(kinds.has('wallet')){
    const a=parse(wallet,before.terminal?.wallet,'旧钱包'),b=parse(wallet,after.terminal?.wallet,'新钱包');
    if(b.earned<a.earned||b.spent<a.spent||b.yen-a.yen!==(b.earned-a.earned)-(b.spent-a.spent))throw Error('钱包余额与本轮累计收入、支出不一致。');
   }
   const registered=at=>transaction.policy.mapIndex?.[at.mapId]?.includes(at.placeId)||(typeof module==='object'&&module.exports?require('../运行时/city.js'):root.CxxCity||root.parent?.CxxCity)?.registered(before,at.mapId,at.placeId);
   if(kinds.has('location')){const at=parse(location,after.terminal?.gameplay?.location,'地点');if(!registered(at))throw Error('地点编号未登记。');}
   for(const actorId of new Set([...transaction.touched.values()].filter(x=>x.kind==='actorWallet').map(x=>x.actorId))){
    const A=actors(),a=parse(wallet,A.read(before,actorId).wallet,'人物旧钱包'),b=parse(wallet,A.read(after,actorId).wallet,'人物新钱包');
    if(b.earned<a.earned||b.spent<a.spent||b.yen-a.yen!==(b.earned-a.earned)-(b.spent-a.spent))throw Error('人物钱包余额与本轮累计收入、支出不一致。');
   }
   for(const actorId of new Set([...transaction.touched.values()].filter(x=>x.kind==='actorLocation').map(x=>x.actorId))){
    const at=parse(location,actors().read(after,actorId).gameplay?.location,'人物地点');if(!registered(at))throw Error('人物地点编号未登记。');
   }
   if(transaction.policy.numericTransaction)N.check(transaction.policy.numericTransaction,before,after);
   else if(kinds.has('growth'))T.validateTransition(before,after,transaction.policy);
   return true;
  }
  function program(before,after,options={}){
   if(options.engineOperation){const O=typeof module==='object'&&module.exports?require("../运行时/player-operations.js"):root.CxxPlayerOperations;return O.validate(before,after,options.engineOperation);}
   if(!same(before?.terminal?.ensemble,after?.terminal?.ensemble))throw Error('人物档案与控制权需要已校验的人物操作，界面不能直接改写。');
   if(!same(before?.terminal?.gameplay?.growth,after?.terminal?.gameplay?.growth))throw Error('角色成长由正文MVU保存，界面不能直接改写。');
   if(!same(before?.terminal?.gameplay?.numeric,after?.terminal?.gameplay?.numeric))throw Error('战况与资源由正文MVU保存，界面不能直接改写。');
   if(!same(before?.terminal?.quests||{},after?.terminal?.quests||{}))throw Error('委托功能待更新，暂不更新委托记录。');
   // Existing front-end writes are limited to the terminal records they actually change.
   for(const [key,schema]of Object.entries({wallet,opening,net}))if(!same(before?.terminal?.[key],after?.terminal?.[key]))parse(schema,after.terminal[key],'终端 '+key);
   for(const [id,record]of Object.entries(after?.terminal?.quests||{}))if(id!=='$meta'&&!same(before?.terminal?.quests?.[id],record))parse(quest,record,'委托 '+id);
   return after;
  }
  return {stat,wallet,quest,gameplay,parse,audit,prepare,check,program,...(N?{commands:patches=>N.commands(patches,pathOf)}:{})};
 }
 // Compatible field additions keep this identity; breaking state changes require a new contract.
 return {SCHEMA_ID:'cxx2051-state/1',build,characters,numberInput,pathOf,get,same,clone};
});
