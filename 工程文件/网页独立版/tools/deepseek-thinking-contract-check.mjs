/** DeepSeek思考合同检查：预设含「思维链折叠」合同时原生思考默认关闭（继承的show_thoughts遗留值不覆盖合同），无合同保持酒馆默认，运行时显式覆盖仍可开启。无网络、无Key。 */
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';

const card={data:{name:'C',first_mes:'FIRST',character_book:{entries:[]}}};
const basePrompts=[{identifier:'main',role:'system',content:'SYSTEM'},{identifier:'chatHistory',marker:true}];
const baseOrder=[{identifier:'main',enabled:true},{identifier:'chatHistory',enabled:true}];
const makePreset=({fold,showThoughts})=>({
 prompts:basePrompts,prompt_order:[{character_id:100001,order:baseOrder}],
 ...(fold?{extensions:{regex_scripts:[{scriptName:'思维链折叠',disabled:false,findRegex:'/<(?:think_nya~|think)>([\\s\\S]*?)<\\/(?:think_nya~?|think)>/g',replaceString:'',placement:[1,2],markdownOnly:false,promptOnly:false,runOnEdit:true,substituteRegex:false,minDepth:null,maxDepth:null}]}}:{}),
 ...(showThoughts===undefined?{}:{show_thoughts:showThoughts})
});
const capture=async (preset,extra={})=>{
 const sent=[];
 const app=createWebSession({mode:'local',accountId:'thinking-contract-check',runId:'thinking-contract-check',
  ports:{state:createMemoryStatePort({accountId:'thinking-contract-check'}),model:{async chat(payload){sent.push(payload);return {text:'<cxx-story>合成正文。</cxx-story>',complete:true};}}},
  chain:{...cardRuleChain(),parser:cardParser()},card,preset,profile:{name:'U'},
  model:{adapter:'chat:deepseek',model:'deepseek-flash'},...extra});
 let body;
 try{await app.runTurn('ACTION');body=sent[0]?.body;}finally{app.dispose();}
 // thinking:{type}由适配器层在buildRequest时生成；会话层载荷携带include_reasoning，是同一决定的来源。
 return body&&'include_reasoning'in body?String(body.include_reasoning):'(absent)';
};
const foldPreset=makePreset({fold:true}),foldInherited=makePreset({fold:true,showThoughts:true}),plainPreset=makePreset({});
const results={
 foldDefault:await capture(foldPreset),
 foldInheritedShowThoughts:await capture(foldInherited),
 plainDefault:await capture(plainPreset),
 plainInheritedShowThoughts:await capture(makePreset({showThoughts:true})),
 plainDisabled:await capture(makePreset({showThoughts:false})),
 foldRuntimeOverride:await capture(foldPreset,{promptOptions:{sampling:{include_reasoning:true}}})
};
const ok=results.foldDefault==='false'&&results.foldInheritedShowThoughts==='false'&&results.plainDefault==='true'&&results.plainInheritedShowThoughts==='true'&&results.plainDisabled==='false'&&results.foldRuntimeOverride==='true';
console.log(JSON.stringify({results,ok}));
if(!ok)process.exit(1);
