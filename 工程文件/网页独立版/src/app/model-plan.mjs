/** Model assignments contain connection and generation choices, scoped separately from story content. */
export const MODEL_OPTION_KEYS=['contextSize','outputTokens','memoryBudgetTokens','recentTurns','variableMode','sampling','purposes','selection'];
const CONNECTION_KEYS=['adapter','baseUrl','model','connection','provider','thinking','rememberKey','apiKey','serviceAccount'];
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,structuredClone(value[key])]));
export function modelOptions(value,{credentials=false}={}){
 const result=pick(value,MODEL_OPTION_KEYS);result.sampling??={};result.purposes??={};
 if(!credentials)for(const purpose of Object.values(result.purposes)){delete purpose.credential;delete purpose.apiKey;}
 return result;
}
export function modelPlan(main,options){return {schema:1,main:pick(main,CONNECTION_KEYS),options:modelOptions(options,{credentials:true})};}
export function checkedModelPlan(value){
 if(value?.schema!==1||!value.main||typeof value.main!=='object'||Array.isArray(value.main)||!value.options||typeof value.options!=='object'||Array.isArray(value.options))throw Error('模型分工方案格式无效。');
 for(const key of ['adapter','baseUrl','model'])if(typeof value.main[key]!=='string')throw Error('模型分工方案缺少连接字段：'+key);
 const options=value.options;for(const key of ['sampling','purposes'])if(!options[key]||typeof options[key]!=='object'||Array.isArray(options[key]))throw Error('模型分工方案字段无效：'+key);
 for(const entry of Object.values(options.purposes))if(!entry||typeof entry!=='object'||Array.isArray(entry))throw Error('模型用途配置无效。');
 return modelPlan(value.main,options);
}
export function withoutModelCredentials(value){const result=checkedModelPlan(value);delete result.main.apiKey;delete result.main.serviceAccount;result.options=modelOptions(result.options);return result;}
export function modelCredentials(value){return {main:pick(value.main,['apiKey','serviceAccount']),purposes:Object.fromEntries(Object.entries(value.options.purposes||{}).map(([id,entry])=>[id,pick(entry,['credential','apiKey'])]))};}
export function withModelCredentials(value,secrets){const result=checkedModelPlan(value);Object.assign(result.main,pick(secrets?.main||{},['apiKey','serviceAccount']));for(const [id,entry]of Object.entries(result.options.purposes))Object.assign(entry,pick(secrets?.purposes?.[id]||{},['credential','apiKey']));return result;}
