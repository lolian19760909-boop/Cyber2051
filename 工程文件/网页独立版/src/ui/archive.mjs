/** The existing story-library layout, using the web state port and save controls. */
import {sourceStyle,sourceJson} from './source.mjs';
export async function mountStoryArchive({parent,session,statePort,accountId,onPlay,onClose,onError,mountTools,temporary,mode='local',busy=()=>false}){
  await sourceStyle('运行时/story-ui.css');
  const covers=(await sourceJson('运行时/story-covers.json')).covers;
  const root=document.createElement('section');root.className='cxx-story-library cxx-web-archive';root.setAttribute('aria-label','故事与存档');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.tabIndex=-1;parent.append(root);
  const n=(tag,text,where,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;where.append(e);return e;};
  const button=(text,fn,where,cls)=>{const b=n('button',text,where,cls);b.type='button';b.onclick=()=>act(fn);return b;};
  let tab='stories',rows=[],selected=null,working=false,disposed=false,tools=null;const cards=new Map();
  const head=n('header',null,root,'story-header');n('h1','故事与存档',head);
  // 返回主菜单是唯一出口，不经过 busy 闸门：生成或失败状态下也必须能离开本页。
  const back=n('button','返回主菜单',head,'subtle');back.type='button';back.onclick=()=>{if(!disposed)onClose();};
  const tabs=n('nav',null,root,'story-tabs');tabs.setAttribute('aria-label','存档分类');
  const tabButtons=new Map();for(const [id,label]of [['stories','故事'],['branches','历史路线'],['points','存档点']])tabButtons.set(id,button(label,()=>load(id),tabs));
  const workspace=n('div',null,root,'story-workspace'),main=n('main',null,workspace,'story-main'),toolbar=n('div',null,main,'story-toolbar');
  const search=n('input',null,toolbar,'story-search');search.type='search';search.placeholder='搜索故事或存档';search.setAttribute('aria-label','搜索故事或存档');search.oninput=paintList;
  const grid=n('div',null,main,'story-grid'),aside=n('aside',null,workspace,'story-aside');
  const foot=n('footer',null,root,'story-footer'),status=n('p','正在读取存档…',foot,'story-status');status.setAttribute('role','status');
  button('刷新列表',()=>load(tab),foot,'subtle');
  if(temporary)button('跨设备续玩',temporary,foot,'subtle');
  if(session?.narrativeNode)button('保存当前进度',async()=>{await session.createCheckpoint('存档 '+new Date().toLocaleString('zh-CN'));await load('points');},foot,'primary');
  const imports=n('details',null,foot,'story-import-tools');n('summary','导入与导出',imports);const toolParent=n('div',null,imports);tools=await mountTools(toolParent);
  async function act(fn){if(working||busy())return;working=true;root.setAttribute('aria-busy','true');try{await fn();}catch(error){status.textContent=error.message;onError(error);}finally{working=false;root.removeAttribute('aria-busy');}}
  const cover=location=>(covers.find(c=>c.aliases?.some(alias=>String(location).includes(alias)))||covers[0])?.src;
  function picture(where,row){const wrap=n('div',null,where,'story-image'),image=n('img',null,wrap);image.alt='';image.loading='lazy';image.src=cover(row.location)||'';}
  async function load(next=tab){tab=next;for(const [id,b]of tabButtons)b.setAttribute('aria-selected',String(id===tab));
    const runs=await statePort.listRuns(accountId);rows=[];
    for(const run of runs){if(tab==='stories')rows.push({id:run.runId,runId:run.runId,title:run.profile?.name||run.title||'未命名故事',location:run.profile?.origin?.name||'',date:run.updatedAt||run.createdAt,creating:!run.headNodeId,open:()=>onPlay(run.runId)});
      else for(const [index,item] of (await statePort[tab==='branches'?'listBranches':'listCheckpoints'](run.runId)).entries())rows.push({id:run.runId+':'+(tab==='branches'?item.branchId:item.checkpointId),runId:run.runId,branchId:tab==='branches'?item.branchId:null,checkpointId:tab==='points'?item.checkpointId:null,title:item.label||((run.profile?.name||'故事')+' · 路线 '+(index+1)),date:item.updatedAt||item.createdAt,headNodeId:item.nodeId||item.headNodeId,open:async()=>{const result=tab==='branches'?await statePort.selectBranch(run.runId,item.branchId,(await statePort.readHead(run.runId)).revision):await statePort.restoreCheckpoint(run.runId,item.checkpointId);if(result.status==='conflict')throw Error('故事已有更新，请刷新后选择。');await onPlay(run.runId);}});
    }
    if(disposed)return;selected=rows.find(row=>row.id===selected?.id)||rows[0]||null;paintList();await showDetails(selected);status.textContent=rows.length?rows.length+' '+({stories:'个故事',branches:'条路线',points:'个存档点'})[tab]:'这里还没有'+({stories:'故事',branches:'历史路线',points:'存档点'})[tab]+'。';
  }
  function paintList(){grid.replaceChildren();cards.clear();for(const row of rows.filter(row=>(row.title+' '+(row.location||'')).includes(search.value.trim()))){const b=button('',()=>showDetails(row),grid,'story-card');cards.set(row.id,b);b.setAttribute('aria-pressed',String(selected?.id===row.id));picture(b,row);const copy=n('div',null,b,'story-card-copy');n('strong',row.title,copy);n('span',row.location||({stories:row.creating?'创建中':'继续故事',branches:'历史路线',points:'已保存的时刻'})[tab],copy,'place');n('small',row.date?new Date(row.date).toLocaleString('zh-CN'):'',copy);}}
  async function showDetails(row){selected=row;for(const [id,card]of cards)card.setAttribute('aria-pressed',String(id===row?.id));aside.replaceChildren();if(!row){n('h2','暂无存档',aside);return;}picture(aside,row);n('h2',row.title,aside);const facts=n('dl',null,aside,'story-facts');n('dt','保存时间',facts);n('dd',row.date?new Date(row.date).toLocaleString('zh-CN'):'未记录',facts);
    const line=await statePort.readLineage(row.runId,row.headNodeId);if(disposed||selected!==row)return;const turns=line.filter(node=>node.message?.kind!=='program'&&node.message?.raw),parsed=globalThis.CxxGalParser?.parseMessage(turns.at(-1)?.message.raw||'');n('dt','进度',facts);n('dd',turns.length+' 层',facts);if(parsed?.scene?.location){n('dt','地点',facts);n('dd',String(parsed.scene.location.name||parsed.scene.location),facts);}if(parsed?.paragraphs?.length)n('p',parsed.paragraphs.map(p=>p.text).join(' ').slice(0,180),aside,'story-excerpt');button(row.creating?'继续创建人物':tab==='points'?'读取并继续':'继续故事',row.open,aside,'primary');
    if(mode!=='tavern'&&statePort.deleteRun){
      if(tab==='stories')button('删除此故事',async()=>{if(session?.identity?.runId===row.runId)throw Error('该故事正在游玩中，请先返回主菜单再删除');if(!window.confirm('删除整个故事「'+row.title+'」？全部历史、路线与存档点都会一并删除，且无法恢复。'))return;await statePort.deleteRun(row.runId);selected=null;status.textContent='故事已删除。';await load('stories');},aside,'subtle');
      if(tab==='points'&&row.checkpointId)button('删除此存档点',async()=>{if(!window.confirm('删除存档点「'+row.title+'」？此操作无法恢复。'))return;await statePort.deleteCheckpoint(row.runId,row.checkpointId);selected=null;status.textContent='存档点已删除。';await load('points');},aside,'subtle');
    }
  }
  const onKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}};root.addEventListener('keydown',onKey);await load();
  return {destroy(){disposed=true;tools?.destroy();root.removeEventListener('keydown',onKey);root.remove();}};
}
