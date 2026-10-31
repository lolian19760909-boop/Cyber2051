/** Temporary cross-device handoff imports into a new local story. */
export async function openTemporaryTransfer({sync,session,statePort,accountId,mode,onSwitch,onError}){
  const dialog=document.createElement('dialog');dialog.className='cxx-web-confirm cxx-temporary-transfer';dialog.setAttribute('aria-labelledby','temporary-transfer-title');
  const n=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;dialog.append(e);return e;};
  n('h2','跨设备续玩').id='temporary-transfer-title';n('p','每个账号保留一份临时备份。游玩保存后自动更新，最后一次上传起72小时后删除；读取不延期。');
  const note=n('p','正在读取临时存档…');note.setAttribute('role','status');const facts=n('dl');facts.className='kv';
  let row=null,working=false;
  const action=(text,fn)=>{const button=n('button',text);button.type='button';button.onclick=async()=>{if(working)return;working=true;button.disabled=true;try{await fn();}catch(error){note.textContent=error.message;onError(error);}finally{working=false;button.disabled=false;}};return button;};
  const load=action('读取到本机并继续',async()=>{if(!row)return;note.textContent='正在核对并导入本机…';const data=await sync.download();if(!data.inspection.readable)throw Error('这份临时档的历史不完整，请使用原设备的完整备份检查恢复。');await sync.withoutUpload(async()=>{const run=await statePort.importRun(data.snapshot,{accountId,mode,parser:globalThis.CxxGalParser});dialog.close();await onSwitch(run.runId);});});load.disabled=true;
  const upload=action('立即更新临时档',async()=>{sync.request(session.identity.runId);await sync.flush();const status=sync.read();if(status.phase==='failed')throw Error(status.error);row=await sync.metadata();paint();});upload.disabled=!session?.narrativeNode;
  action('返回',()=>dialog.close());
  function paint(){facts.replaceChildren();load.disabled=!row;if(!row){note.textContent='当前没有临时备份。原设备游玩保存成功并上传后，可在这里继续。';return;}note.textContent='读取会另建本机故事，现有故事保留。';for(const [label,value]of [['上传时间',new Date(row.updatedAt).toLocaleString('zh-CN')],['到期时间',new Date(row.expiresAt).toLocaleString('zh-CN')],['文件大小',(row.bytes/1024/1024).toFixed(2)+' MB']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;facts.append(dt,dd);}}
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();try{row=await sync.metadata();paint();}catch(error){note.textContent=error.message;onError(error);}
}
