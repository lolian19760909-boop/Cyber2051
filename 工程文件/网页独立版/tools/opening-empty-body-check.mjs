/** 开局空正文分类检查：上游只返回原生思考、正文为0时，失败必须是 empty_reasoning_only 且带思考字数。无网络、无Key、无真实供应商调用。 */
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';

const REASONING='X'.repeat(3272);
const card={data:{name:'C',first_mes:'FIRST',character_version:'VERSION',extensions:{depth_prompt:{prompt:'DEPTH'}},character_book:{entries:[]}}};
const preset={prompts:[{identifier:'main',role:'system',content:'SYSTEM'},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'main',enabled:true},{identifier:'chatHistory',enabled:true}]}]};
const sent=[];
const model={async chat(payload,{onReasoning}={}){sent.push(payload);if(onReasoning)onReasoning(REASONING);return {text:'',reasoning:REASONING,complete:true,finishReason:'stop',diagnostics:{reasoningCharacters:REASONING.length,decodedCharacters:0}};}};
const app=createWebSession({mode:'local',accountId:'opening-empty-body-check',runId:'opening-empty-body-check',ports:{state:createMemoryStatePort({accountId:'opening-empty-body-check'}),model},chain:{...cardRuleChain(),parser:cardParser()},card,preset,profile:{name:'U'},model:{adapter:'chat:deepseek',model:'deepseek-flash'}});
let result;
try{result=await app.runTurn('ACTION');}finally{app.dispose();}
const code=result?.error?.code,message=result?.error?.message||'';
const ok=result?.status==='failed'&&code==='empty_reasoning_only'&&message.includes(String(REASONING.length));
console.log(JSON.stringify({status:result?.status,code,message,supplierCalls:0,ok}));
if(!ok)process.exit(1);
