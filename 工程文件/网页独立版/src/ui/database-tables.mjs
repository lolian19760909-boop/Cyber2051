/** One read-only view of the selected story's actual database tables. */
export function mountDatabaseTables({parent,database,session,openMemory}){
 const doc=parent.ownerDocument,root=doc.createElement('section');root.className='cxx-database-tables';parent.append(root);
 const n=(tag,text,into=root)=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;into.append(e);return e;};
 n('style',TABLE_STYLE);
 const head=n('header',null),status=n('p','',head),tools=n('div',null),choose=n('select',null,tools),search=n('input',null,tools),refreshButton=n('button','刷新',tools);
 choose.setAttribute('aria-label','数据库表格');search.type='search';search.placeholder='搜索表内内容';search.setAttribute('aria-label','搜索表内内容');refreshButton.type='button';refreshButton.onclick=refresh;
 if(openMemory){const button=n('button','记忆与历史整理',tools);button.type='button';button.onclick=openMemory;}
 n('h1','数据库',head);
 const caption=n('p',''),scroller=n('div',null),table=n('table',null,scroller);scroller.className='database-table-scroll';table.setAttribute('aria-label','当前数据库表');
 let tables={},selected='',signature='';
 const cell=value=>value==null?'':typeof value==='object'?JSON.stringify(value):String(value);
 function render(){
  selected=choose.value;table.replaceChildren();const current=tables[selected];if(!current){caption.textContent='当前没有表格。';return;}
  const [columns=[],...rows]=current.content,needle=search.value.trim().toLocaleLowerCase(),shown=rows.filter(row=>!needle||row.some(value=>cell(value).toLocaleLowerCase().includes(needle)));
  caption.textContent=(current.name||selected)+' · '+rows.length+' 行'+(needle?' · 匹配 '+shown.length+' 行':'');
  const thead=n('thead',null,table),tr=n('tr',null,thead);for(const value of columns){const th=n('th',cell(value),tr);th.scope='col';}
  const tbody=n('tbody',null,table);for(const row of shown){const tr=n('tr',null,tbody);for(const value of row)n('td',cell(value),tr);}
  if(!shown.length){const tr=n('tr',null,tbody),td=n('td',needle?'无匹配记录':'暂无记录',tr);td.colSpan=Math.max(1,columns.length);}
 }
 function refresh(){
  const next=database.tables,memory=session.memory?.status?.(),state=session.currentState;
  status.textContent='回合 '+(state?.terminal?.turn??0)+' · 长期记忆'+(memory?.enabled?'已启用':'未启用')+(memory?.enabled?(memory.auto?'／自动整理':'／手动整理'):'');
  const stamp=JSON.stringify(next);if(stamp===signature)return;signature=stamp;tables=Object.fromEntries(Object.entries(next).filter(([,row])=>Array.isArray(row?.content)));choose.replaceChildren();
  for(const [id,row]of Object.entries(tables)){const option=n('option',(row.name||id)+'（'+Math.max(0,row.content.length-1)+'）',choose);option.value=id;}
  if(Object.hasOwn(tables,selected))choose.value=selected;render();
 }
 choose.onchange=render;search.oninput=render;refresh();return {refresh,destroy(){root.remove();}};
}

const TABLE_STYLE=`.cxx-database-tables{padding:18px clamp(12px,3vw,42px);height:100%;min-height:0;display:flex;flex-direction:column;gap:14px}.cxx-database-tables header{display:flex;align-items:baseline;gap:20px;flex-wrap:wrap}.cxx-database-tables h1{margin:0;color:var(--cxx-structure)}.cxx-database-tables header p{color:var(--cxx-muted)}
.cxx-database-tables>div:not(.database-table-scroll){display:flex;gap:10px;flex-wrap:wrap}.cxx-database-tables :is(select,input,button){min-height:44px;max-width:100%;padding:8px 12px;border:1px solid var(--cxx-line);background:var(--cxx-panel);color:var(--cxx-text);font:inherit}.database-table-scroll{overflow:auto;min-height:0;max-height:70dvh;flex:1}.database-table-scroll table{border-collapse:collapse;width:100%;text-align:left;font-size:14px}.database-table-scroll :is(th,td){border:1px solid var(--cxx-line);padding:10px 14px;min-width:6em;max-width:32em;white-space:pre-wrap;overflow-wrap:anywhere;vertical-align:top}.database-table-scroll th{position:sticky;top:0;background:var(--cxx-raised);color:var(--cxx-structure)}`;
