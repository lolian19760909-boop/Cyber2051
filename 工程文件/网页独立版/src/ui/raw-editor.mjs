/** In-place raw editor for one committed floor: full原文 including regex-hidden content; saves as a new route, old route preserved. */
export function mountRawEditor({session,busy=()=>false,onSaved=()=>{},onError=()=>{}}){
  let working=false,node=null;
  const dialog=document.createElement('dialog');dialog.className='cxx-raw-editor';dialog.setAttribute('aria-label','编辑原文');
  const build=(tag,text,where)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;where.append(el);return el;};
  build('h2','编辑原文',dialog);
  const bodyLabel=build('label','正文原文（完整内容，含被格式规则隐藏的部分）',dialog),body=build('textarea',undefined,bodyLabel);
  body.rows=16;body.style.cssText='width:100%;min-height:45vh;font-family:ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;';
  const actionLabel=build('label','原行动',dialog),input=build('textarea',undefined,actionLabel);
  input.rows=2;input.style.cssText='width:100%;';
  build('p','校验后另存为新路线，原路线和后续正文保留；可在楼层导航用「上一版／下一版」切换回来。',dialog);
  const status=build('p','',dialog);status.setAttribute('role','status');status.style.cssText='min-height:1.2em;';
  const actions=build('div',null,dialog),save=build('button','保存并另建路线',actions),cancel=build('button','取消',actions);
  save.type='button';cancel.type='button';save.style.cssText='margin-right:8px;';
  function close(){if(dialog.open)dialog.close();dialog.remove();node=null;}
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  async function runSave(){
    if(working||busy()||!node)return;working=true;save.disabled=true;status.textContent='正在校验并保存…';
    try{
      const result=await session.reprocessNode(node.nodeId,{raw:body.value,inputText:input.value});
      if(result?.status==='conflict')throw Error('这份回复的原路线已变化，请刷新后重试。');
      if(result?.status==='failed')throw Error(result.error?.message||'正文未通过校验，原文与旧路线保留。');
      close();onSaved(result);
    }catch(error){status.textContent=error.message;onError(error);}
    finally{working=false;save.disabled=false;}
  }
  save.onclick=runSave;cancel.onclick=close;
  return {
    open(target){
      if(!target?.message?.raw){onError(new Error('该层没有可编辑的原文'));return;}
      node=target;body.value=target.message.raw;input.value=target.message.input?.text||'';status.textContent='';
      document.body.append(dialog);dialog.showModal();body.focus();
    },
    destroy(){dialog.remove();node=null;},
  };
}
