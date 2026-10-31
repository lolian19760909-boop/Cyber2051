/* Derived from 卡片源码/运行时/battle-ui.js; source SHA256 d5036ff33f3db2cfda210a5f4db903a0dba32eb12d12d9dd70cfebd0dce9435f. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const local=typeof module==='object'&&module.exports,api=factory(root,local?require('./battle.js'):root.CxxBattle,local?require('./loadout.js'):root.CxxLoadout);if(local)module.exports=api;else root.CxxBattleUI=api;})(globalThis,function(root,B,L){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;const drafts=new Map();
 const css=`
 .cxx-battle{min-width:0;display:grid;gap:16px;color:var(--cxx-text);font:16px/1.6 var(--cxx-font-ui)}
 .cxx-battle *{box-sizing:border-box}
 .cxx-battle h3,.cxx-battle h4,.cxx-battle p{margin:0;overflow-wrap:anywhere}
 .cxx-battle h3{font-size:24px;font-weight:500;letter-spacing:.1em;color:var(--cxx-red)}
 .cxx-battle h4{font-size:18px;font-weight:500;color:var(--cxx-red)}
 .cxx-battle>p{color:var(--cxx-text);font-size:16px;max-width:64em}
 .cxx-battle>h3::before{content:'ROUND CONTROL / 2051';display:block;color:var(--cxx-muted);font:13px/1.4 var(--cxx-font-mono);letter-spacing:.12em;margin:0 0 8px}
 .cxx-battle label{display:grid;gap:6px;min-width:0;font-size:14px;color:var(--cxx-muted)}
 .cxx-battle article{display:grid;align-content:start;gap:12px;padding:18px;background:linear-gradient(135deg,var(--cxx-raised),var(--cxx-panel));border:1px solid var(--cxx-line);border-top:2px solid var(--cxx-red);min-width:0}
 .cxx-battle .battle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
 .cxx-battle input,.cxx-battle select,.cxx-battle textarea{width:100%;max-width:100%;min-width:0;box-sizing:border-box;min-height:44px;padding:8px;background:var(--cxx-ink);color:var(--cxx-text);border:1px solid var(--cxx-line);border-radius:0;font:16px/1.5 var(--cxx-font-ui)}
 .cxx-battle input[type=checkbox]{width:20px;min-height:20px;accent-color:var(--cxx-cyan)}
 .cxx-battle label:has(input[type=checkbox]){min-height:44px;align-content:center}
 .cxx-battle button{min-height:44px;white-space:normal;padding:10px 16px;color:var(--cxx-text);background:var(--cxx-raised);border:1px solid var(--cxx-line);font:inherit;letter-spacing:.04em;cursor:pointer;border-radius:0;touch-action:manipulation}
 .cxx-battle button:hover{border-color:var(--cxx-cyan);background:color-mix(in srgb,var(--cxx-cyan) 8%,var(--cxx-ink))}
 .cxx-battle button.battle-primary{border:1px solid var(--cxx-cyan);background:color-mix(in srgb,var(--cxx-cyan) 14%,var(--cxx-ink));color:var(--cxx-cyan-soft);font-weight:600}
 .cxx-battle :is(button,input,select,textarea,summary):focus-visible{outline:2px solid var(--cxx-cyan);outline-offset:2px}
 .cxx-battle pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 var(--cxx-font-mono);padding:14px;background:var(--cxx-panel);max-height:260px;overflow:auto}
 .cxx-battle .battle-roster,.cxx-battle .battle-summary{display:grid;gap:12px}
 .cxx-battle .battle-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
 .cxx-battle .battle-side{display:grid;gap:12px;align-content:start;min-width:0}
 .cxx-battle .battle-side>h4{font-size:14px;letter-spacing:.12em;color:var(--cxx-muted)}
 .cxx-battle .battle-unit{border:1px solid var(--cxx-line);padding:12px;background:var(--cxx-panel);min-width:0}
 .cxx-battle .battle-unit[data-side=enemies]{border-color:color-mix(in srgb,var(--cxx-enemy) 50%,transparent)}
 .cxx-battle .battle-unit strong{font-size:16px;font-weight:500;overflow-wrap:anywhere}
 .cxx-battle .battle-unit small{display:block;color:var(--cxx-muted);font:13px/1.6 var(--cxx-font-ui);overflow-wrap:anywhere}
 .cxx-battle .battle-hp{height:4px;margin-top:9px;background:color-mix(in srgb,var(--cxx-text) 10%,transparent)}
 .cxx-battle .battle-hp i{display:block;height:100%;background:var(--cxx-ally)}
 .cxx-battle [data-side=enemies] .battle-hp i{background:var(--cxx-enemy)}
 .cxx-battle .battle-action-head{display:flex;gap:12px;align-items:center;justify-content:space-between}
 .cxx-battle .battle-action-head small{font-size:13px;color:var(--cxx-muted)}
 .cxx-battle .battle-actions{position:sticky;bottom:0;z-index:1;display:flex;flex-wrap:wrap;gap:8px;padding:12px 0;background:var(--cxx-ink);border-top:1px solid var(--cxx-line)}
 .cxx-battle .battle-actions>button{flex:1}
 .cxx-battle details>summary{cursor:pointer;min-height:44px;padding:10px 0;color:var(--cxx-cyan)}
 .cxx-battle details>article{margin-top:8px}
 .cxx-battle .battle-modes,.cxx-battle .battle-scan{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
 .cxx-battle .battle-modes{padding-bottom:12px;border-bottom:1px solid var(--cxx-line)}
 .cxx-battle .battle-modes small{color:var(--cxx-muted);font-size:13px}
 .cxx-battle .battle-modes button[aria-pressed=true]{border-color:var(--cxx-cyan);background:color-mix(in srgb,var(--cxx-cyan) 8%,var(--cxx-ink));color:var(--cxx-cyan-soft)}
 .cxx-battle[data-mode=cheat] .battle-modes button[aria-pressed=true]{border-color:var(--cxx-red);background:color-mix(in srgb,var(--cxx-red) 14%,var(--cxx-ink));color:var(--cxx-red-soft)}
 .cxx-battle [hidden]{display:none!important}
 .cxx-battle button:disabled{opacity:.5;cursor:wait}
 @media(max-width:600px){.cxx-battle h3{font-size:20px}.cxx-battle article{padding:13px}.cxx-battle .battle-grid{grid-template-columns:1fr 1fr;gap:10px}.cxx-battle .battle-actions>button:first-child{flex-basis:100%}}
 @media(max-width:400px){.cxx-battle .battle-grid{grid-template-columns:1fr}}
 `;
 const recognized=B.recognized;
 function addEquipment(a,d){const ids=new Set(a.equipment.map(x=>x.id));let i=0;while(ids.has('battle_item_'+i))i++;a.equipment.push({id:'battle_item_'+i,name:d.name,effects:structuredClone(d.numericEffects||[]),tags:[...(d.tags||[])]});a.tags=[...new Set([...a.tags,...(d.tags||[])])];}
 function removeEquipment(a,i){const [item]=a.equipment.splice(i,1),remaining=new Set(a.equipment.flatMap(x=>x.tags||[]));a.tags=a.tags.filter(t=>!item.tags?.includes(t)||remaining.has(t));}
 function mount({document:doc,parent,read,commit,scope}){
  const host=doc.createElement('section'),top=doc.defaultView,E=root.CxxNumericEngine;parent.append(host);host.className='cxx-battle';
  let draft=structuredClone(drafts.get(scope)||B.seed(read())),candidate=null,disposed=false,busy=false,scanning=false,scanVersion=0,editing=null,selectedMode='system',status;
  const battleId='battle_'+L.hash(scope+Date.now()+Math.random()),service=()=>top.CxxWebBattle;
  const el=(tag,text,where=host)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;where.append(n);return n;};
  const button=(name,fn,where=host)=>{const b=el('button',name,where);b.type='button';if(/^(确认资料并开始战斗|保存本轮行动|采用识别草稿)$/.test(name))b.className='battle-primary';b.onclick=async()=>{if(busy)return;try{await fn();}catch(e){if(!disposed){status.textContent=e.message;saveRetry();}}};return b;};
  function saveRetry(){
   if(!['error','timeout'].includes(top.CxxWebPlayer?.saveState?.().status)||host.querySelector('[data-save-retry]'))return;
   const retry=button('重试保存并读回',async()=>{busy=true;status.textContent='正在重试存档保存…';try{await top.CxxWebPlayer.retrySave();if(!disposed)paint();}finally{busy=false;}});
   retry.dataset.saveRetry='true';status.after(retry);
  }
  function remember(){drafts.delete(scope);drafts.set(scope,structuredClone(draft));if(drafts.size>32)drafts.delete(drafts.keys().next().value);}
  function select(label,choices,current,change,where){const l=el('label',label,where),s=el('select',undefined,l);s.setAttribute('aria-label',label);for(const [v,t]of choices){const o=el('option',t,s);o.value=v;}s.value=current;s.onchange=()=>change(s.value);return s;}
  function input(label,value,change,where,number=false){const l=el('label',label,where),n=el('input',undefined,l);n.setAttribute('aria-label',label);if(number){n.type='number';n.step='any';}n.value=value??'';n.oninput=()=>change(number?Number(n.value):n.value);return n;}
  async function save(request){busy=true;status.textContent='正在保存并读回…';try{await commit(request);if(!disposed)paint();}finally{busy=false;}}
  function actorForm(a,side,index,where){
   const box=el('article',undefined,where);el('h4',a.name,box);const grid=el('div',undefined,box);grid.className='battle-grid';
   input('名称',a.name,v=>{a.name=v;remember();},grid);
   if(a.id!=='player')select('阵营',[['allies','友方'],['enemies','敌方']],side,v=>{draft[side].splice(index,1);draft[v].push(a);remember();paint();},grid);
   select('模板（预填起点）',Object.entries(E.rules.templates).map(([id,t])=>[id,t.label||id]),a.template||'civilian',v=>{Object.assign(a,B.actor({id:a.id,name:a.name,template:v,level:E.rules.templates[v].defaultLevel}));remember();paint();},grid);
   input('等级',a.level,v=>{a.level=v;remember();},grid,true);
   for(const [k,label]of Object.entries({body:'肉体',reflexes:'反应',intelligence:'智力',technical:'技术能力',cool:'镇定'}))input(label,a.attributes[k],v=>{a.attributes[k]=v;remember();},grid,true);
   const max=E.maximums(a.perks,undefined,a.equipment,a);input('生命上限',a.hpMax??max.hp,v=>{a.hpMax=v;remember();},grid,true);
   for(const [k,label]of Object.entries({hp:'当前生命',stamina:'当前耐力',ram:'当前RAM'}))input(label,a.vitals[k],v=>{a.vitals[k]=v;remember();},grid,true);
   input('条件标签（空格分隔）',(a.tags||[]).join(' '),v=>{a.tags=v.split(/\s+/).filter(Boolean);remember();},box);
   if(a.id==='player')el('p','作弊配置仅覆盖本场属性；装备和天赋读取已保存装配。交锋后的生命、耐力和RAM仍写回存档。',box);
   else{
    const items=[...L.official.items,...Object.values(read().itemDefinitions||{}).filter(d=>d.custom)];
    select('装备',[['','选择添加装备'],...items.map(d=>[d.id,d.name])],'',id=>{if(!id)return;addEquipment(a,L.official.find(id)?L.definition(id):L.get(read(),id));remember();paint();},box);
    for(const [i,item]of a.equipment.entries()){const line=el('p',item.name||item.id,box);button('移除装备',()=>{removeEquipment(a,i);remember();paint();},line);}
    button('移除此参战者',()=>{draft[side].splice(index,1);remember();paint();},box);
   }
  }
  function summary(roster){
   const summary=el('div');summary.className='battle-summary';
   for(const [side,name,members]of [['allies','我方',[roster.player,...roster.allies]],['enemies','对方',roster.enemies]]){
    const column=el('div',undefined,summary);column.className='battle-side';el('h4',name,column);
    for(const a of members){
     const unit=el('div',undefined,column);unit.className='battle-unit';unit.dataset.side=side;el('strong',a.name,unit);
     const max=E.maximums(a.perks,undefined,a.equipment,a).hp;el('small','LV '+a.level+' · HP '+a.vitals.hp+' / '+max,unit);
     if(a.id==='player')el('small','耐力 '+a.vitals.stamina+' · RAM '+a.vitals.ram,unit);
     if(a.id!=='player')el('small',E.rules.templates[a.template]?.label||a.template,unit);
     const bar=el('div',undefined,unit);bar.className='battle-hp';el('i',undefined,bar).style.width=Math.min(100,100*a.vitals.hp/max)+'%';
     const details=el('details',undefined,unit);el('summary','查看属性与装备',details);
     el('p',Object.entries({body:'肉体',reflexes:'反应',intelligence:'智力',technical:'技术',cool:'镇定'}).map(([k,n])=>n+' '+a.attributes[k]).join(' · '),details);
     el('p',(a.equipment||[]).map(i=>i.name||i.id).join('、')||'未记录装备',details);
     if(a.evidence)el('small',(a.evidence.role==='player'?'玩家声明':'正文依据')+' · '+a.evidence.quote,details);
    }
    if(!members.length)el('p','尚无已确认的对手',column);
   }
  }
  function actions(c,cheat,parent=host){
   const actors=[c.player,...c.allies,...c.enemies],values=cheat?structuredClone(c.actions||{}):{player:structuredClone(c.actions?.player||{kind:'attack'})};
   for(const a of cheat?actors:[c.player]){
    let where=parent;if(a.id!=='player'){where=el('details',undefined,parent);el('summary',a.name+' · 作弊行动设置',where);}
    const section=el('article',undefined,where),act=values[a.id]||{kind:'attack'};values[a.id]=act;el('h4',a.name+'的行动',section);
    const abilities=a.id==='player'?B.available(read()):(a.equipment||[]).flatMap(x=>x.effects||[]).map((e,i)=>({id:String(i),name:L.model.describe(e),effect:e})).filter(x=>L.model.actions.has(x.effect.kind)&&(x.effect.trigger||'manual')==='manual');
    const choices=[['attack','攻击'],['defend','防御'],['ability','使用能力'],...(a.id==='player'?[['withdraw','撤离']]:[])];
    if(!choices.some(([v])=>v===act.kind))act.kind='attack';
    const kind=select('行动',choices,act.kind,v=>{act.kind=v;updateTargets();},section);
    const target=select('目标',[],'',v=>act.target=v,section);
    const ability=select('能力',[['','未选择／仅叙事'],...abilities.map(x=>[x.id,x.name])],act.ability||'',v=>{act.ability=v;updateTargets();},section);
    function updateTargets(){
     const effect=abilities.find(x=>x.id===act.ability)?.effect,healing=act.kind==='ability'&&effect?.kind.startsWith('restore');
     const options=cheat?actors:healing?[c.player,...c.allies]:c.enemies;
     target.replaceChildren();for(const [v,t]of [['','自动选择目标'],...options.filter(x=>x.vitals.hp>0).map(x=>[x.id,x.name+'（生命'+x.vitals.hp+'）'])]){const o=el('option',t,target);o.value=v;}
     target.value=act.target||'';if(target.selectedIndex<0){target.value='';act.target='';}
     ability.parentElement.hidden=act.kind!=='ability';target.parentElement.hidden=act.kind==='withdraw';
    }
    updateTargets();kind.value=act.kind;
    if(a.id==='player'){
     act.activeSlots=act.activeSlots||L.activeSlots(read());
     for(const row of L.list(read()).filter(x=>x.definition.active)){const l=el('label',row.definition.name+' · 主动启用',section),n=el('input',undefined,l);n.type='checkbox';n.checked=act.activeSlots.includes(row.slot);n.onchange=()=>{act.activeSlots=n.checked?[...new Set([...act.activeSlots,row.slot])]:act.activeSlots.filter(x=>x!==row.slot);};}
    }
   }
   return values;
  }
  function recognition(){
   const row=el('div');row.className='battle-scan';
   const start=button(scanning?'正在识别现场…':'识别当前战况',async()=>{
    if(scanning)return;if(!service()?.recognize)throw Error('战况识别服务尚未就绪。');const sent=++scanVersion;scanning=true;paint();
    try{const result=await service().recognize();if(disposed||sent!==scanVersion)return;const c=read().numeric?.combat;candidate=!c?.active&&selectedMode==='cheat'&&result.inCombat?{player:draft.player,allies:result.allies,enemies:result.enemies}:null;scanning=false;paint();status.textContent=c?.active?(result.changed?'已识别名单变化，请核对后确认。':'名单没有变化，已有生命与回合保持。'):result.inCombat?'已识别当前交战，确认名单后开始。':'当前无战斗：没有识别到正在发生的交战。';}
    catch(e){if(!disposed&&sent===scanVersion){scanning=false;paint();status.textContent=e.message+' 已有资料保留。';}}
   },row);start.disabled=scanning;
   if(scanning)button('取消识别',()=>{scanVersion++;service()?.cancelRecognition();scanning=false;paint();},row);
  }
  function paint(){
   host.replaceChildren();el('style',css);el('h3','逐轮战斗');const c=read().numeric?.combat,active=c?.manual&&c.active,cheat=active?B.mode(c)==='cheat':selectedMode==='cheat';
   host.dataset.mode=cheat?'cheat':'system';
   const modes=el('div');modes.className='battle-modes';
   if(active){el('strong',cheat?'作弊模式':'系统决定',modes);el('small',c.mode?'本场模式已确定；结束后可切换。':'此旧版战斗保留原自由配置，下一场默认系统决定。',modes);}
   else for(const [id,label]of [['system','系统决定'],['cheat','作弊模式']]){const b=button(label,()=>{scanVersion++;service()?.cancelRecognition();scanning=false;candidate=null;editing=null;selectedMode=id;paint();},modes);b.setAttribute('aria-pressed',String(selectedMode===id));}
   status=el('p',cheat?'自由配置双方资料与行动；确认保存后生效。':'你的属性、装备和天赋读取存档；其余参战者由现场识别与固定规则确定。');status.setAttribute('role','status');
   saveRetry();
   const pending=service()?.state?.();const progress=el('p');progress.dataset.battleProgress='true';progress.setAttribute('role','status');refreshStatus();
   if(pending?.received)button('重试保存本轮结算',()=>service().finish());
   if(active&&!editing){
    el('h4','第 '+((c.round||0)+1)+' 轮待生成'+(c.paused?' · 已暂停':''));summary(c);
    el('p',c.paused?'当前按普通正文进行，不推进数值回合。正文明确结束同一冲突后会自动收尾；也可恢复战斗或异常结束。':'在正文输入你的行动后直接发送；只写交涉、观察或等待会按防守推进一轮。面板修正只作用于下一轮。');
    if(!cheat){recognition();const delta=service()?.roster?.();if(delta?.changed){el('h4','参战名单变化 · 待确认');for(const side of ['allies','enemies'])for(const a of delta[side])el('p',(side==='allies'?'新增友方：':'新增敌方：')+a.name+' — '+a.evidence.quote);for(const d of delta.departures)el('p','离场：'+[...c.allies,...c.enemies].find(a=>a.id===d.id)?.name+' — '+d.evidence.quote);button('确认名单变化',async()=>{await service().confirmRoster(delta.id);if(!disposed)paint();});}}
    const correction=el('details');el('summary',cheat?'手动配置本轮行动':'修正本轮行动（可选）',correction);const chosen=actions(c,cheat,correction);
    if(cheat)button('编辑战况资料',()=>{draft={player:structuredClone(c.player),allies:structuredClone(c.allies),enemies:structuredClone(c.enemies)};editing=JSON.stringify(c);remember();paint();});
    el('p',cheat?'未保存行动不生效；未修改时沿用上轮。':'队友和敌人按数值规则行动；撤离同样占一轮。修正后仍需发送正文，暂停状态不会自动恢复。');
    button('采用本轮修正',async()=>{await save({action:'battle-action',expected:JSON.stringify(c),actions:chosen});if(!disposed)status.textContent='本轮修正已保存。'+(c.paused?'当前仍暂停；恢复战斗后发送正文才会结算。':'返回正文发送即可；这次修正只用于下一轮。');},correction).disabled=!!pending?.received;
    if(!c.paused&&!cheat)button('重试识别本轮行动',async()=>{await service().preflight();if(!disposed){paint();status.textContent='行动识别通过，返回正文发送即可。';}}).disabled=!!pending?.received;
    const footer=el('div');footer.className='battle-actions';
    button(c.paused?'恢复战斗':'暂停战斗',()=>save({action:'battle-pause',expected:JSON.stringify(c),paused:!c.paused}),footer);
    if(c.paused)button('重查正文是否结束',()=>service().checkClosure({retry:true}),footer);
    button('异常结束战斗',async()=>{await service().endBattle('recovery');if(!disposed)paint();},footer);
    if(cheat)button('结束战斗',()=>save({action:'battle-end',expected:JSON.stringify(c)}),footer);el('p','异常结束保留已保存的资源变化，不判定胜利或发放奖励。');return;
   }
   if(c?.closed)el('p',c.closed.reason==='narrative_end'?'上一场已按正文结束；已保存资源保持。':'上一场已异常结束；已保存资源保持，未发放胜利奖励。');
   else if(c?.lastRound)el('p','上一场结果：'+({escaped:'成功撤离',enemy_incapacitated:'敌方失去行动能力',player_incapacitated:'我方失去行动能力',ongoing:'已手动结束'}[c.lastRound.outcome]||c.lastRound.outcome));
   if(editing){el('p','修改本场资料不增加交锋轮数。');button('放弃战况修改',()=>{editing=null;paint();});}
   recognition();
   if(!cheat){
    const scene=service()?.encounter?.(),used=scene&&scene.source===c?.encounterSource;
    el('h4',scene?.inCombat&&!used?'现场交战 · 待确认':'当前无战斗');
    if(scene?.inCombat&&!used){
     el('p','现场依据：'+scene.evidence);el('p','属性按职业与强度生成，名单不符可重新识别。');summary({player:B.player(read()),allies:scene.allies,enemies:scene.enemies});
     const footer=el('div');footer.className='battle-actions';button('确认资料并开始战斗',()=>save({action:'battle-start',mode:'system',id:battleId,encounterId:scene.id}),footer).disabled=scanning;
    }else{
     el('p',used?'这段现场已经结算；新的正文进入交战后可再次确认。':'可查看当前状态或重新识别现场。识别到交战后才可开始。');summary(B.seed(read()));
    }
    return;
   }
   if(candidate){el('h4','识别草稿');summary(candidate);button('采用识别草稿',()=>{draft=candidate;candidate=null;remember();paint();});button('保留当前资料',()=>{candidate=null;paint();});}
   const roster=el('div');roster.className='battle-roster';actorForm(draft.player,'player',0,roster);
   for(const side of ['allies','enemies'])for(const [i,a]of draft[side].entries())actorForm(a,side,i,roster);
   for(const [side,name]of [['allies','友方'],['enemies','敌方']])button('添加'+name,()=>{draft[side].push(B.actor({id:side+'_'+Date.now().toString(36),name:'新'+name,template:'thug',level:E.rules.templates.thug.defaultLevel}));remember();paint();});
   button(editing?'确认更新本场资料':'确认资料并开始战斗',async()=>{await save(editing?{action:'battle-edit',expected:editing,draft}:{action:'battle-start',mode:'cheat',id:battleId,draft});editing=null;if(!disposed)paint();});
  }
  function refreshStatus(){const s=service()?.state?.(),line=host.querySelector('[data-battle-progress]');if(line)line.textContent=s?.error||({idle:'',recognizing:'正在识别，输入仍保留…',confirmation:'战况待确认',ready:'准备就绪',generating:'本轮正文生成中，尚未结算',saving:'正文已完成，正在保存结算',saved:'已保存',stopped:'正文已中止，尚未结算；续写沿用原行动，改行动后需重新生成。'}[s?.stage]||'');}
  top.addEventListener?.('cxx-player-changed',refreshStatus);paint();return {root:host,destroy(){disposed=true;scanVersion++;top.removeEventListener?.('cxx-player-changed',refreshStatus);if(scanning)service()?.cancelRecognition();host.remove();}};
 }
 return {mount,recognized,addEquipment,removeEquipment};
});
