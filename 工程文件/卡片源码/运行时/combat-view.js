(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxCombatView=api;})(globalThis,function(){
 'use strict';
 const storyKey=raw=>{let hash=2166136261;for(const ch of String(raw||'').replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,'').replace(/\r\n/g,'\n').replace(/<StatusPlaceHolderImpl\/>/g,'').trim())hash=Math.imul(hash^ch.charCodeAt(0),16777619);return (hash>>>0).toString(16);};
 const numeric=m=>m?.variables?.[m.swipe_id||0]?.stat_data?.terminal?.gameplay?.numeric;
 const liveNumeric=()=>{const s=(typeof globalThis!=='undefined'&&globalThis.Cxx236State)||(typeof window!=='undefined'&&window.parent&&window.parent.Cxx236State);if(!s||typeof s.stat!=='function')return null;try{const stat=s.stat(),id=stat?.terminal?.ensemble?.control?.actorId||'player';return (id==='player'?stat?.terminal?.gameplay:stat?.terminal?.ensemble?.actors?.[id]?.gameplay)?.numeric||null;}catch(e){return null;}};
 function forFloor(chat,floor){
  const m=chat?.[floor];if(!m||m.is_user)return [];
  const current=numeric(m)||(floor===chat.length-1?liveNumeric():null);if(!current)return [];
  let prior={};for(let i=floor-1;i>=0;i--){const n=numeric(chat[i]);if(n){prior=n.receipts||{};break;}}
  return Object.entries(current.receipts||{}).flatMap(([id,r])=>r.round&&!prior[id]?.round&&r.round.source?.floor===floor&&r.round.source?.swipe===(m.swipe_id||0)?[r.round]:r.assessment&&!prior[id]?.assessment&&(!r.assessment.source?.story||r.assessment.source.story===storyKey(m.mes)&&r.assessment.source.swipe===(m.swipe_id||0))?[r.assessment]:[]);
 }
 function mount({document:doc,parent,compact=false}){
  const root=doc.createElement('div');root.dataset.cxxSlot='combat';root.dataset.compact=String(compact);root.hidden=true;const shadow=root.attachShadow({mode:'open'}),style=doc.createElement('style');style.textContent=globalThis.CxxCombatViewStyle||'';shadow.append(style);parent.append(root);let signature='';
  const el=(tag,text,parent,cls)=>{const n=doc.createElement(tag);n.textContent=text;if(cls)n.className=cls;parent.append(n);return n;};
  function render(rows=[]){const next=JSON.stringify(rows);if(next===signature)return;signature=next;shadow.querySelectorAll('.card').forEach(n=>n.remove());root.hidden=!rows.length;
   for(const row of rows){if(row.round){const card=el('section','',shadow,'card');card.setAttribute('aria-label','本轮交锋');const h=el('div','',card,'head');el('span','本轮交锋 · 第 '+row.round+' 轮',h);el('span',row.advantage==='player'?'我方取得优势':'敌方取得优势',h);const scores=el('div','',card,'scores');for(const a of row.actors){const cell=el('div','',scores);el('span',a.name+' ',cell);el('strong',a.hp+' → '+a.after+' / '+a.hpMax,cell,'value');}el('p',row.stillFighting?'战斗仍在进行；下一层继续一轮。':row.outcome==='escaped'?'成功脱离战斗。':'一方失去行动能力，战斗结束；不自动判定死亡。',card,'note');continue;}const card=el('section','',shadow,'card');card.setAttribute('aria-label','战况评估');const h=el('div','',card,'head');el('span',row.reason==='reinforcement'?'战况更新 · 敌方增援':'战况评估 · 交战开始',h);el('span','TACTICAL READOUT',h);const r=row.result||{};
    if(r.known){const scores=el('div','',card,'scores');for(const [label,value]of [['我方有效战力',Math.round(r.playerPower)],['敌方有效战力',Math.round(r.enemyPower)],['参考胜率',Math.round(r.playerChance*100)+'%']]){const cell=el('div','',scores);el('span',label+' ',cell);el('strong',String(value),cell,'value');}el('p',r.incapacitated?'当前失去战斗能力，等待救援或脱离。':'依据交战时状态评估；战术与现场仍会影响结果。',card,'note');}
    else el('p','对手资料尚不完整，暂不提供胜率。',card,'note');
   }
  }
  return {root,render,destroy(){root.remove();}};
 }
 function native({api,win=api.parent||api,runtime=win.Cxx233Runtime}){
  const doc=win.document,views=new Map();let stopped=false;
  function refresh(){if(stopped)return;const chat=api.SillyTavern.getContext().chat,live=new Set();
   for(const mes of doc.querySelectorAll('#chat .mes[mesid]')){const floor=Number(mes.getAttribute('mesid')),message=chat[floor],parent=mes.querySelector('.mes_text');if(!parent||!message||message.is_user||message.is_system||mes.hidden||mes.classList.contains('mes_editing'))continue;
    const rows=forFloor(chat,floor);if(!rows.length)continue;live.add(mes);let view=views.get(mes);if(view&&!parent.contains(view.root)){view.destroy();views.delete(mes);view=null;}if(!view){view=mount({document:doc,parent});views.set(mes,view);}view.render(rows);
   }
   for(const [mes,view]of views)if(!live.has(mes)){view.destroy();views.delete(mes);}
  }
  const stop=runtime.watchMessages(refresh);refresh();return {refresh,destroy(){stopped=true;stop();for(const v of views.values())v.destroy();views.clear();}};
 }
 return {forFloor,mount,native};
});
