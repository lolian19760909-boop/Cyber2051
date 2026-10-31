/** Saved replies stay reviewable after a refresh; editing always keeps the old route. */
export function mountReplyControls({parent,session,statePort,busy=()=>false,onBusy=()=>{},onCommitted=()=>{},onError=()=>{}}){
  let disposed=false,working=false,target=null;const edits=new Map(),pendingEdits=new Map();
  const node=(tag,text,where=parent)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;where.append(el);return el;};
  const status=node('p');status.setAttribute('role','status');
  async function run(task){if(working||busy())return;working=true;onBusy(true);try{const result=await task();if(result?.status==='conflict')throw Error('这份回复的原路线已变化，请选择另建路线。');if(result?.status==='failed')throw Error(result.error?.message||'正文未通过校验，原文与旧路线保留。');if(result?.status==='interrupted')status.textContent='已中断，正文保留，可稍后继续。';if(result?.status==='committed'||result?.status==='replayed'){status.textContent='校验通过并已保存，旧路线保留。';await onCommitted(result);await refresh();}return result;}catch(error){status.textContent=error.message;onError(error);}finally{working=false;onBusy(false);}}
  const action=(title,fn,where=parent)=>{const button=node('button',title,where);button.type='button';button.onclick=()=>run(fn);return button;};
  const edit=node('details'),title=node('summary','编辑已提交正文',edit),select=node('select',undefined,edit);select.setAttribute('aria-label','选择已提交回合');
  const actionLabel=node('label','原行动 ',edit),input=node('textarea',undefined,actionLabel);input.setAttribute('aria-label','编辑原行动');
  const bodyLabel=node('label','正文原文 ',edit),body=node('textarea',undefined,bodyLabel);body.setAttribute('aria-label','编辑已提交正文原文');body.rows=14;
  node('p','校验后另存为新路线，原路线和后续正文保留。',edit);
  action('校验并另建路线',()=>{if(!target)throw Error('请先选择已提交回合');return session.reprocessNode(target.nodeId,{raw:body.value,inputText:input.value});},edit);
  const remember=()=>{if(target)edits.set(target.nodeId,{raw:body.value,inputText:input.value});};
  function pick(){target=session.nodes.find(row=>row.nodeId===select.value)||null;const draft=edits.get(target?.nodeId);input.value=draft?.inputText??target?.message?.input?.text??'';body.value=draft?.raw??target?.message?.raw??'';}
  select.onchange=()=>{remember();pick();};
  const recover=node('details');node('summary','待处理回复',recover);const list=node('div',undefined,recover);
  action('重新读取待处理回复',refresh,recover);
  function download(row){const url=URL.createObjectURL(new Blob([JSON.stringify(row,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='东京都2051-待处理回复-'+row.operationId+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function refresh(){
    if(disposed)return;remember();const previous=edit.open?select.value:'',turns=session.nodes.filter(row=>row.message?.kind!=='program'&&row.message?.raw);select.replaceChildren();for(const [i,row]of turns.entries()){const option=node('option','第 '+(i+1)+' 段 · '+(row.message.input?.text||'开场').slice(0,32),select);option.value=row.nodeId;}select.value=turns.some(row=>row.nodeId===previous)?previous:turns.at(-1)?.nodeId||'';pick();
    const records=(await statePort.listRecords('drafts',session.identity.runId)).filter(row=>row.operationId&&typeof row.raw==='string'),pending=[];for(const row of records)if(!await statePort.readReceipt(session.identity.runId,row.operationId))pending.push(row);if(disposed)return;list.replaceChildren();
    if(!pending.length)node('p','没有待处理回复。',list);
    for(const row of pending.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))){
      const extraPending=row.processing?.mode==='extra'&&row.processing.stage!=='complete',item=node('details',undefined,list);item.dataset.cxxCandidate=row.operationId;node('summary',(extraPending?'正文已收到，变量待处理':row.complete?'完整回复':'未完整结束')+' · '+(row.error?.message||row.phase||'待校验'),item);node('p','原行动：'+(row.input?.text||''),item);
      const text=node('textarea',undefined,item);text.value=pendingEdits.get(row.operationId)??row.raw;text.oninput=()=>pendingEdits.set(row.operationId,text.value);text.rows=10;text.setAttribute('aria-label','待处理回复原文 '+row.operationId);
      const confirm=node('label',undefined,item),check=node('input',undefined,confirm);check.type='checkbox';confirm.append(document.createTextNode('我已补全并确认这份正文'));
      const source=node('details',undefined,item);node('summary','来源与失败原因',source);node('pre',JSON.stringify({parentNodeId:row.parentNodeId,branchId:row.branchId,complete:row.complete,completion:row.completion,error:row.error},null,2),source);
      for(const [fork,label]of [[false,'按原路线恢复并校验'],[true,'校验并另建路线']])action(label,()=>{const edited=text.value!==row.raw||check.checked;if(!row.complete&&!edited)throw Error('回复未完整结束，请先补全原文并勾选确认；也可直接导出保留。');if(text.value!==row.raw&&!check.checked)throw Error('请勾选确认修改后的正文');return session.reprocessCandidate(row,{fork,...(edited?{editedText:text.value}:{})});},item);
      if(extraPending)action('继续变量解析并另建路线',()=>{status.textContent='正文已保留，正在解析变量…';return session.retryAnalysis(row,{fork:true});},item);
      action('导出这份原回复',()=>download(row),item);
    }
  }
  const ready=refresh().catch(error=>{status.textContent=error.message;onError(error);});
  return {ready,refresh,async open(nodeId){await ready;remember();await refresh();select.value=nodeId;pick();edit.open=true;body.focus();},destroy(){disposed=true;parent.replaceChildren();}};
}
