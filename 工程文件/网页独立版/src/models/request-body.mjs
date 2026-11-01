/** Connection-owned JSON/YAML fields, normalized at the form and transport boundaries. */
import {parse as parseYaml} from './native/yaml/index.js';
function read(value,label){
 if(value===undefined||value===null||value==='')return undefined;
 if(typeof value!=='string')return value;
 try{return parseYaml(value,{maxAliasCount:100});}catch(error){throw Error(label+'的 JSON/YAML 格式有误：'+error.message,{cause:error});}
}
export function requestBodyOptions(value={}){
 const bodyOverrides=read(value.bodyOverrides,'附加字段')??{},removed=read(value.bodyOmissions,'移除字段')??[],bodyOmissions=typeof removed==='string'?[removed]:removed;
 if(typeof bodyOverrides!=='object'||Array.isArray(bodyOverrides))throw Error('附加字段请填写 JSON/YAML 对象，例如 {route: "example"}。');
 if(!Array.isArray(bodyOmissions)||bodyOmissions.some(key=>typeof key!=='string'))throw Error('移除字段请填写字段名列表，例如 [top_k, thinking]。');
 return {bodyOverrides:structuredClone(bodyOverrides),bodyOmissions:[...new Set(bodyOmissions.map(key=>key.trim()).filter(Boolean))]};
}
