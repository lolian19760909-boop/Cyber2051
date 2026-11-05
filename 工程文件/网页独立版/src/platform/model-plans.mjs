import {checkedModelPlan,withoutModelCredentials,modelCredentials,withModelCredentials} from '../app/model-plan.mjs';
/** Local settings hold named choices; unremembered credentials follow the browser session. */
export function createModelPlanStore({local,session,scope,uuid=()=>crypto.randomUUID()}){
 const key='cxx2051:model-plans:'+scope,prefix=key+':secrets:';
 const secretKey=row=>prefix+row.id+':'+row.revision;
 function read(){const text=local.getItem(key);if(!text)return [];const data=JSON.parse(text);if(data.schema!==1||!Array.isArray(data.plans))throw Error('本地模型分工方案格式无效。');return data.plans;}
 function write(rows){local.setItem(key,JSON.stringify({schema:1,plans:rows}));}
 function restore(row){if(!row)return null;const saved=session.getItem(secretKey(row));return {...row,configuration:withModelCredentials(row.configuration,saved?JSON.parse(saved):null)};}
 function save({id='modelplan_'+uuid(),name,configuration}){
  if(!/^(current|modelplan_[a-z0-9-]+)$/i.test(id))throw Error('模型方案编号无效。');name=String(name||'').trim();if(!name||name.length>80)throw Error('请填写80字以内的方案名称。');
  const plan=checkedModelPlan(configuration),rows=read(),previous=rows.find(row=>row.id===id),row={schema:1,id,name,revision:uuid(),updatedAt:new Date().toISOString(),configuration:plan.main.rememberKey?plan:withoutModelCredentials(plan)};
  if(!plan.main.rememberKey)session.setItem(secretKey(row),JSON.stringify(modelCredentials(plan)));
  try{write([...rows.filter(value=>value.id!==id),row]);}catch(error){session.removeItem(secretKey(row));throw error;}if(previous)session.removeItem(secretKey(previous));return {...row,configuration:plan};
 }
 return {
  list:()=>read().filter(row=>row.id!=='current').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(restore),
  current:()=>restore(read().find(row=>row.id==='current')),
  save,saveCurrent:configuration=>save({id:'current',name:'当前分工',configuration}),
  remove(id){const rows=read(),row=rows.find(value=>value.id===id);write(rows.filter(value=>value.id!==id));if(row)session.removeItem(secretKey(row));},
  clearSession(){for(let i=session.length-1;i>=0;i--){const entry=session.key(i);if(entry.startsWith(prefix))session.removeItem(entry);}},
  clearCredentials(){write(read().map(row=>{const configuration=withoutModelCredentials(row.configuration);configuration.main.rememberKey=false;return {...row,configuration};}));this.clearSession();},
 };
}
