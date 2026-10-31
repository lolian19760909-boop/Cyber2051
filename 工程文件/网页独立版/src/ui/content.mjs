/** Player content editors and existing script/database inspectors share the settings surface. */
import {editBooks,editPreset,editRegex,contentTools} from './content-editor.mjs';
import {mountDatabaseTables} from './database-tables.mjs';
import {appUrl} from '../platform/paths.mjs';
export function mountSessionContent({parent,session,database,onChanged=async()=>{},onError=()=>{}}){
 const doc=parent.ownerDocument,n=(tag,text,into=parent)=>{const el=doc.createElement(tag);if(text!==null)el.textContent=text;into.append(el);return el;};
 parent.replaceChildren();parent.classList.add('cxx-session-content');
 const nav=n('nav',null),pages=n('div',null);nav.className='cx77-settings-actions';nav.setAttribute('aria-label','本局内容');
 let databaseView=null;
 let disposed=false,epoch=0,active='books';const buttons=[];
 for(const [id,label]of [['books','世界书'],['preset','预设'],['regex','正则'],['scripts','脚本'],...(database?[['database','数据库']]:[])]){const b=n('button',label,nav);b.type='button';b.onclick=()=>void select(id);buttons.push({id,b});}
 async function select(id){
  databaseView?.destroy();databaseView=null;
  const request=++epoch;active=id;for(const row of buttons)row.b.setAttribute('aria-pressed',String(row.id===id));pages.replaceChildren();
  try{
   if(['books','preset','regex'].includes(id)){
    const data=await session.readContent();if(disposed||epoch!==request)return;
    const panel=n('section',null,pages);panel.className='cxx-content-editor';
    const changed=async()=>{await onChanged();window.dispatchEvent(new Event('cxx-player-content-changed'));};
    const editor=({books:editBooks,preset:editPreset,regex:editRegex})[id]({parent:panel,session,data,onError,changed});
    if(session.hasContentLibrary)await library(id,editor,changed,request,panel);
   }else if(id==='database'){
    databaseView=mountDatabaseTables({parent:pages,database,session});
   }else{
    const root=appUrl(''),response=await fetch(appUrl('release-manifest.json'));if(!response.ok)throw Error('脚本清单读取失败');const manifest=await response.json();if(disposed||epoch!==request)return;
    const loaded=new Set([...doc.querySelectorAll('script[src]')].map(script=>script.src));
    const rows=manifest.files.filter(row=>/\.(?:m?js)$/.test(row.path)&&!row.path.startsWith('shared/mirror/')).map(row=>({title:(row.path==='database/shujuku-1.3.js'&&database?'已运行 · ':loaded.has(new URL(row.path,root).href)?'已载入 · ':'构建内 · ')+row.path,url:new URL(row.path,root).href,details:{文件:row.path,SHA256:row.sha256,字节:row.bytes}}));
    listing(rows);
   }
  }catch(error){if(!disposed&&epoch===request){pages.replaceChildren();n('p',error.message,pages);onError(error);}}
 }
 async function library(kind,editor,changed,request,panel){
  const store=await session.readLibrary();if(disposed||request!==epoch)return;const box=n('details',null,panel);n('summary','个人库',box);
  const {action,field}=contentTools(box,onError),choose=field('已保存内容','',{choices:[]}),items=store[kind]||[];
  for(const [i,row]of items.entries()){const option=n('option',row.name,choose);option.value=String(i);}
  action('保存到个人库',async()=>{const value=editor.value(),key=kind==='books'?value.bookId:kind==='preset'?session.presetId:'regex',name=value.name||(kind==='regex'?'正则规则':session.presetId),row={id:key,name,value};const at=items.findIndex(item=>item.id===key);if(at<0)items.push(row);else items[at]=row;store[kind]=items;await session.saveLibrary(store);await select(kind);});
  action('使用此项',async()=>{const row=items[Number(choose.value)];if(!row)return;if(kind==='books')await session.saveWorldbook(row.value);else if(kind==='preset')await session.savePreset(row.value,{id:row.id});else await session.saveRegex(row.value);await changed();await select(kind);});
  action('从个人库删除',async()=>{items.splice(Number(choose.value),1);store[kind]=items;await session.saveLibrary(store);await select(kind);});
 }
 function listing(rows){
  if(!rows.length){n('p','本局暂无此项内容。',pages);return;}
  const search=n('input',null,pages);search.type='search';search.placeholder='搜索内容';search.setAttribute('aria-label','搜索本局内容');
  const select=n('select',null,pages);select.setAttribute('aria-label','选择内容');
  const metadata=n('dl',null,pages);metadata.className='kv';
  const raw=n('textarea',null,pages);raw.readOnly=true;raw.rows=16;raw.setAttribute('aria-label','内容原文');raw.spellcheck=false;
  const copy=n('button','复制原文',pages);copy.type='button';copy.onclick=()=>navigator.clipboard.writeText(raw.value).catch(onError);
  let filtered=rows,selection=0;
  function fill(){filtered=rows.filter(row=>!search.value||(row.title+' '+(row.content||'')).toLowerCase().includes(search.value.toLowerCase()));select.replaceChildren();for(const [i,row]of filtered.entries()){const option=n('option',row.title,select);option.value=String(i);}void show();}
  async function show(){const current=++selection,row=filtered[Number(select.value)||0];metadata.replaceChildren();raw.value='';if(!row)return;for(const [key,value]of Object.entries(row.details||{})){if(value===undefined||value===null)continue;n('dt',key,metadata);n('dd',typeof value==='object'?JSON.stringify(value):String(value),metadata);}if(row.url){raw.value='正在读取…';try{const response=await fetch(row.url);if(!response.ok)throw Error('源码读取失败');const text=await response.text();if(!disposed&&current===selection&&active==='scripts')raw.value=text;}catch(error){if(!disposed&&current===selection)raw.value=error.message;}}else raw.value=row.content;}
  search.oninput=fill;select.onchange=()=>void show();fill();
 }
 void select(active);
 return {refresh:()=>select(active),destroy(){disposed=true;epoch++;databaseView?.destroy();parent.replaceChildren();}};
}
