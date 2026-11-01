/** REM-01 宏环境检查：会话入口处 model／instruct／深度提示／版本／问候／系统提示等宏按实际值展开。无网络、无Key。 */
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';

const card={data:{name:'C',first_mes:'FIRST',character_version:'V1.2',system_prompt:'SYSPROMPT',alternate_greetings:['ALT1'],
 extensions:{depth_prompt:{prompt:'DEPTHPROMPT'}},character_book:{entries:[]}}};
const preset={
 prompts:[
  {identifier:'main',role:'system',content:'MAIN-TEMPLATE'},
  {identifier:'aux',role:'system',content:'MODEL=[{{model}}] DEPTH=[{{charDepthPrompt}}] VERSION=[{{charVersion}}] FIRST=[{{greeting}}] FIRST2=[{{charFirstMessage:1}}] INPUT=[{{instructInput}}] SYS=[{{charPrompt}}] SYSDEF=[{{systemPrompt}}] DSYS=[{{defaultSystemPrompt}}] EXT=[{{hasExtension:helper}}] MOB=[{{isMobile}}]'},
  {identifier:'chatHistory',marker:true}
 ],
 prompt_order:[{character_id:100001,order:[
  {identifier:'main',enabled:true},{identifier:'aux',enabled:true},{identifier:'chatHistory',enabled:true}
 ]}],
 sysprompt:{enabled:true,content:'DEFAULT-SYSPROMPT'},instruct:{enabled:true,input_sequence:'[INST]'}
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
const checks={mainOverride:String(messages[0]?.content||'')==='SYSPROMPT',model:aux.includes('MODEL=[deepseek-flash]'),depth:aux.includes('DEPTH=[DEPTHPROMPT]'),version:aux.includes('VERSION=[V1.2]'),first:aux.includes('FIRST=[FIRST]'),altGreeting:aux.includes('FIRST2=[ALT1]'),instruct:aux.includes('INPUT=[[INST]]'),sysPrompt:aux.includes('SYS=[SYSPROMPT]'),sysPromptMacro:aux.includes('SYSDEF=[SYSPROMPT]'),defaultSys:aux.includes('DSYS=[DEFAULT-SYSPROMPT]'),hasExtension:aux.includes('EXT=[false]'),isMobile:aux.includes('MOB=[false]'),bodyModel:sent[0]?.body?.model==='deepseek-flash',bodyInstruct:sent[0]?.body?.instruct?.input_sequence==='[INST]'};
// 解析路径（#14-1）：variableMode extra 时作者注释中的宏在解析请求里按实际值展开
const sent2=[];
const card2={data:{...card.data,character_book:{entries:[{id:1,keys:[],content:'变量规则占位',comment:'[mvu_update]变量输出格式 · 额外解析',enabled:true,constant:true,position:0}]}}};
const app2=createWebSession({mode:'local',accountId:'macro-env-check-parse',runId:'macro-env-check-parse',
 ports:{state:createMemoryStatePort({accountId:'macro-env-check-parse'}),model:{
  async chat(payload){sent2.push(payload);return {text:'<cxx-story>合成正文。</cxx-story>',complete:true};}
 }},
 chain:{...cardRuleChain(),parser:cardParser()},card:card2,preset,profile:{name:'U'},
 model:{adapter:'chat:deepseek',model:'deepseek-flash'},promptOptions:{variableMode:'extra'}});
try{await app2.saveAuthorNote({content:'AN-MODEL=[{{model}}] AN-INPUT=[{{instructInput}}] AN-SYS=[{{systemPrompt}}]',enabled:true});await app2.runTurn('ACTION');}finally{app2.dispose();}
const analysis=JSON.stringify(sent2[1]?.body?.messages||[]);
checks.parseModel=analysis.includes('AN-MODEL=[deepseek-flash]');
checks.parseInstruct=analysis.includes('AN-INPUT=[[INST]]');
checks.parseSys=analysis.includes('AN-SYS=[SYSPROMPT]');
checks.parseRequestExists=sent2.length>=2;

const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({checks,ok}));
if(!ok)process.exit(1);
