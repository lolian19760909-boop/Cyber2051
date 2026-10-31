/** REM-01 宏环境检查：会话入口处 model／instruct／深度提示／版本／问候／系统提示等宏按实际值展开。无网络、无Key。 */
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';

const card={data:{name:'C',first_mes:'FIRST',character_version:'V1.2',system_prompt:'SYSPROMPT',alternate_greetings:['ALT1'],
 extensions:{depth_prompt:{prompt:'DEPTHPROMPT'}},character_book:{entries:[]}}};
const preset={
 prompts:[
  {identifier:'main',role:'system',content:'MAIN-TEMPLATE'},
  {identifier:'aux',role:'system',content:'MODEL=[{{model}}] DEPTH=[{{charDepthPrompt}}] VERSION=[{{charVersion}}] FIRST=[{{greeting}}] FIRST2=[{{charFirstMessage:1}}] INPUT=[{{instructInput}}] SYS=[{{charPrompt}}] EXT=[{{hasExtension:helper}}] MOB=[{{isMobile}}]'},
  {identifier:'chatHistory',marker:true}
 ],
 prompt_order:[{character_id:100001,order:[
  {identifier:'main',enabled:true},{identifier:'aux',enabled:true},{identifier:'chatHistory',enabled:true}
 ]}],
 instruct:{enabled:true,input_sequence:'[INST]'}
};
const sent=[];
const app=createWebSession({mode:'local',accountId:'macro-env-check',runId:'macro-env-check',
 ports:{state:createMemoryStatePort({accountId:'macro-env-check'}),model:{
  async chat(payload){sent.push(payload);return {text:'<cxx-story>合成正文。</cxx-story>',complete:true};}
 }},
 chain:{...cardRuleChain(),parser:cardParser()},card,preset,profile:{name:'U'},
 model:{adapter:'chat:deepseek',model:'deepseek-flash'}});
let result;
try{result=await app.runTurn('ACTION');}finally{app.dispose();}
const messages=sent[0]?.body?.messages||[],aux=String(messages.find(row=>row.role==='system'&&String(row.content).startsWith('MODEL=['))?.content||'');
const checks={mainOverride:String(messages[0]?.content||'')==='SYSPROMPT',model:aux.includes('MODEL=[deepseek-flash]'),depth:aux.includes('DEPTH=[DEPTHPROMPT]'),version:aux.includes('VERSION=[V1.2]'),first:aux.includes('FIRST=[FIRST]'),altGreeting:aux.includes('FIRST2=[ALT1]'),instruct:aux.includes('INPUT=[[INST]]'),sysPrompt:aux.includes('SYS=[SYSPROMPT]'),hasExtension:aux.includes('EXT=[false]'),isMobile:aux.includes('MOB=[false]'),bodyModel:sent[0]?.body?.model==='deepseek-flash',bodyInstruct:sent[0]?.body?.instruct?.input_sequence==='[INST]'};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({checks,ok}));
if(!ok)process.exit(1);
